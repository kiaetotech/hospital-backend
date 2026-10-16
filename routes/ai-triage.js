// D:\hospital backend\routes\ai-triage.js
// ============================================
// AI TRIAGE ROUTE
// Wires ai-core/InsuranceAgent to HTTP
// Graceful fallback if ai-core unavailable
// Mount: app.use('/api/ai-triage', ...)
// ============================================

const express = require('express');
const router = express.Router();
const InsuranceClaim = require('../models/InsuranceClaim');
const InsurancePolicy = require('../models/InsurancePolicy');
const { authenticate: auth } = require('../middleware/auth');

// ============================================
// LOAD AI AGENT (with fallback)
// ============================================
let InsuranceAgent = null;
let agentInstance = null;

try {
  const agentPath = '../ai-core/agents/business/InsuranceAgent';
  const AgentModule = require(agentPath);
  InsuranceAgent = AgentModule.default || AgentModule.InsuranceAgent || AgentModule;

  if (typeof InsuranceAgent === 'function') {
    agentInstance = new InsuranceAgent();
    console.log('[ai-triage] InsuranceAgent loaded');
  }
} catch (e) {
  console.warn('[ai-triage] AI agent unavailable — falling back to rules engine:', e.message);
}

// ============================================
// RULE-BASED FALLBACK SCORING
// (mirrors frontend logic so behavior is consistent)
// ============================================
function rulesTriage(claim, policy) {
  let riskScore = 0;
  const flags = [];

  const amt = Number(claim.amount || 0);
  const sumInsured = Number(policy?.sumInsured || 0);

  // Rule 1: High claim relative to sum insured
  if (sumInsured > 0) {
    const pct = (amt / sumInsured) * 100;
    if (pct > 80) { riskScore += 30; flags.push({ level: 'high', msg: `Claim is ${Math.round(pct)}% of sum insured` }); }
    else if (pct > 50) { riskScore += 15; flags.push({ level: 'medium', msg: `Claim is ${Math.round(pct)}% of sum insured` }); }
  }

  // Rule 2: Filed too soon after policy start
  if (policy?.startDate && claim.createdAt) {
    const days = Math.floor((new Date(claim.createdAt) - new Date(policy.startDate)) / (1000 * 60 * 60 * 24));
    if (days < 30) { riskScore += 25; flags.push({ level: 'high', msg: `Filed only ${days} days after policy start` }); }
    else if (days < 90) { riskScore += 10; flags.push({ level: 'medium', msg: `Filed ${days} days after policy start` }); }
  }

  // Rule 3: No documents
  const docCount = (claim.documents || []).length;
  if (docCount === 0) { riskScore += 25; flags.push({ level: 'high', msg: 'No supporting documents attached' }); }
  else if (docCount < 2) { riskScore += 10; flags.push({ level: 'medium', msg: 'Only one document attached' }); }

  // Rule 4: Round-number amount
  if (amt > 0 && amt % 10000 === 0) { riskScore += 8; flags.push({ level: 'low', msg: 'Suspiciously round amount' }); }

  // Rule 5: Weekend filing
  const filed = claim.createdAt ? new Date(claim.createdAt) : null;
  if (filed && (filed.getDay() === 0 || filed.getDay() === 6)) {
    riskScore += 5; flags.push({ level: 'low', msg: 'Filed on weekend' });
  }

  // Rule 6: High value needs senior review
  if (amt > 500000) { riskScore += 15; flags.push({ level: 'high', msg: 'High-value claim needs senior review' }); }

  // Urgency
  let urgency = 'normal';
  if (amt > 500000) urgency = 'critical';
  else if (amt > 100000) urgency = 'high';
  else if (amt > 25000) urgency = 'medium';
  const ageHours = filed ? Math.round((Date.now() - filed.getTime()) / (1000 * 60 * 60)) : 0;
  if (ageHours > 48 && urgency !== 'critical') urgency = 'high';
  if (ageHours > 120) urgency = 'critical';

  const riskScoreCapped = Math.min(100, riskScore);
  const riskLevel = riskScoreCapped >= 60 ? 'high' : riskScoreCapped >= 30 ? 'medium' : 'low';

  const recommendations = {
    high: '🚨 Escalate to senior underwriter. Request additional documents. Consider field investigation.',
    medium: '⚠️ Verify hospital records. Request supporting documents before approving.',
    low: '✅ Low risk. Proceed with standard approval flow.',
  };

  return {
    riskScore: riskScoreCapped,
    riskLevel,
    urgency,
    ageHours,
    flags,
    recommendation: recommendations[riskLevel],
    source: 'rules',
  };
}

// ============================================
// POST /api/ai-triage/analyze
// Body: { claimId }
// Auth: insurer (via authenticate middleware)
// ============================================
router.post('/analyze', auth, async (req, res) => {
  try {
    const { claimId } = req.body;
    if (!claimId) return res.status(400).json({ success: false, message: 'claimId required' });

    const claim = await InsuranceClaim.findById(claimId)
      .populate('policyId')
      .populate('userId', 'name email phone age gender')
      .lean();

    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    // Try AI agent first
    if (agentInstance && typeof agentInstance.analyze === 'function') {
      try {
        const aiResult = await Promise.race([
          agentInstance.analyze({
            claim: {
              id: String(claim._id),
              claimNumber: claim.claimNumber,
              amount: claim.amount,
              description: claim.description,
              hospitalName: claim.hospitalName,
              documents: (claim.documents || []).map((d) => (typeof d === 'string' ? d : d.url || '')),
              createdAt: claim.createdAt,
            },
            policy: {
              number: claim.policyId?.policyNumber,
              sumInsured: claim.policyId?.sumInsured,
              startDate: claim.policyId?.startDate,
            },
            customer: {
              name: claim.userId?.name,
              age: claim.userId?.age,
              gender: claim.userId?.gender,
            },
          }),
          // Timeout: 8 seconds
          new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 8000)),
        ]);

        if (aiResult && typeof aiResult === 'object') {
          // Normalize AI response to match rules-triage shape
          const normalized = {
            riskScore: Math.min(100, Math.max(0, Number(aiResult.riskScore ?? aiResult.score ?? 0))),
            riskLevel: aiResult.riskLevel || (aiResult.riskScore >= 60 ? 'high' : aiResult.riskScore >= 30 ? 'medium' : 'low'),
            urgency: aiResult.urgency || 'normal',
            ageHours: Math.round((Date.now() - new Date(claim.createdAt).getTime()) / (1000 * 60 * 60)),
            flags: Array.isArray(aiResult.flags) ? aiResult.flags : (Array.isArray(aiResult.signals) ? aiResult.signals : []),
            recommendation: aiResult.recommendation || aiResult.action || 'Review manually',
            source: 'ai',
            aiModel: aiResult.model || 'ai-core/InsuranceAgent',
          };
          return res.json({ success: true, data: normalized });
        }
      } catch (aiErr) {
        console.warn('[ai-triage] AI failed, using rules:', aiErr.message);
      }
    }

    // Fallback: rules engine
    const result = rulesTriage(claim, claim.policyId);
    return res.json({ success: true, data: result });
  } catch (e) {
    console.error('[ai-triage/analyze]', e);
    return res.status(500).json({ success: false, message: 'Failed to analyze claim' });
  }
});

// ============================================
// POST /api/ai-triage/batch
// Body: { claimIds: [] }
// Useful for scoring a whole queue at once
// ============================================
router.post('/batch', auth, async (req, res) => {
  try {
    const { claimIds } = req.body;
    if (!Array.isArray(claimIds) || claimIds.length === 0) {
      return res.status(400).json({ success: false, message: 'claimIds array required' });
    }

    const claims = await InsuranceClaim.find({ _id: { $in: claimIds.slice(0, 50) } })
      .populate('policyId')
      .populate('userId', 'name email phone age gender')
      .lean();

    const results = claims.map((claim) => {
      const rules = rulesTriage(claim, claim.policyId);
      return {
        claimId: claim._id,
        ...rules,
      };
    });

    return res.json({ success: true, data: results });
  } catch (e) {
    console.error('[ai-triage/batch]', e);
    return res.status(500).json({ success: false, message: 'Failed to batch analyze' });
  }
});

// ============================================
// GET /api/ai-triage/health
// Returns AI availability status
// ============================================
router.get('/health', (req, res) => {
  return res.json({
    success: true,
    data: {
      aiAvailable: !!agentInstance,
      agentLoaded: !!InsuranceAgent,
      model: agentInstance?.model || null,
    },
  });
});

module.exports = router;
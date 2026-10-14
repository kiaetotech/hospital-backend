const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const InsuranceClaim = require('../models/InsuranceClaim');
const InsurancePolicy = require('../models/InsurancePolicy');
const InsuranceCompany = require('../models/InsuranceCompany');
const { authenticate: auth } = require('../middleware/auth');
const upload = require('../middleware/upload').upload;
const notificationService = require('../services/notificationService');

// ============================================
// FILE A CLAIM
// ============================================

// Submit a new claim
router.post('/file', auth, async (req, res) => {
  try {
    const {
      policyId,
      claimType,
      amount,
      description,
      hospitalName,
      hospitalAddress,
      hospitalCity,
      hospitalPincode,
      admissionDate,
      dischargeDate,
      diagnosis,
      treatment
    } = req.body;

    // Validate required fields
    if (!policyId || !claimType || !amount || !description || !hospitalName || !admissionDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Verify policy exists and belongs to user
    const policy = await InsurancePolicy.findOne({ 
      _id: policyId, 
      userId: req.user.id,
      status: 'active'
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Active policy not found'
      });
    }

    // Check if claim amount exceeds policy limit
    if (amount > policy.sumInsured) {
      return res.status(400).json({
        success: false,
        message: `Claim amount (₹${amount}) exceeds policy limit (₹${policy.sumInsured})`
      });
    }

    // Get company
    const company = await InsuranceCompany.findById(policy.companyId);
    if (!company || !company.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Insurance company is not active'
      });
    }

    // Create claim
    const claim = new InsuranceClaim({
      policyId: policy._id,
      bookingId: policy.bookingId,
      companyId: policy.companyId,
      userId: req.user.id,
      claimType,
      amount,
      description,
      hospitalName,
      hospitalAddress,
      hospitalCity,
      hospitalPincode,
      admissionDate: new Date(admissionDate),
      dischargeDate: dischargeDate ? new Date(dischargeDate) : null,
      diagnosis,
      treatment,
      status: 'submitted',
      submittedBy: req.user.id
    });

    await claim.save();

    // Add timeline entry
    await claim.addTimeline('submitted', 'Claim submitted by customer', req.user.id);

    // Send notification to insurer
    await notificationService.sendEmail(
      company.email,
      'New Claim Submitted',
      {
        template: 'new_claim',
        data: {
          companyName: company.companyName,
          claimNumber: claim.claimNumber,
          amount: claim.amount,
          customerName: req.user.name,
          policyNumber: policy.policyNumber
        }
      }
    );

    // Send confirmation to customer
    await notificationService.sendEmail(
      req.user.email,
      'Claim Submitted Successfully',
      {
        template: 'claim_submitted',
        data: {
          name: req.user.name,
          claimNumber: claim.claimNumber,
          amount: claim.amount,
          policyNumber: policy.policyNumber
        }
      }
    );

    res.json({
      success: true,
      message: 'Claim submitted successfully',
      data: {
        claimId: claim._id,
        claimNumber: claim.claimNumber,
        status: claim.status
      }
    });

  } catch (error) {
    console.error('Claim submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit claim: ' + error.message
    });
  }
});

// Upload claim documents
router.post('/:claimId/documents', auth, upload.array('documents', 10), async (req, res) => {
  try {
    const claimId = req.params.claimId;
    const files = req.files || [];

    const claim = await InsuranceClaim.findOne({ 
      _id: claimId, 
      userId: req.user.id 
    });

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Add documents to claim
    const documents = files.map(file => ({
      name: file.originalname,
      url: file.path || file.location,
      type: req.body.documentType || 'other',
      uploadedAt: new Date()
    }));

    claim.documents.push(...documents);
    
    // Update status if it was submitted
    if (claim.status === 'submitted') {
      claim.status = 'document_uploaded';
      await claim.addTimeline('document_uploaded', `${documents.length} document(s) uploaded`, req.user.id);
    }

    await claim.save();

    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      data: {
        documents: documents,
        totalDocuments: claim.documents.length
      }
    });

  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload documents'
    });
  }
});

// ============================================
// CLAIM TRACKING
// ============================================

// Get all claims for user
router.get('/my-claims', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = { userId: req.user.id };
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const claims = await InsuranceClaim.find(query)
      .populate('policyId', 'policyNumber planName sumInsured')
      .populate('companyId', 'companyName logo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await InsuranceClaim.countDocuments(query);

    res.json({
      success: true,
      data: claims,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Claims fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claims'
    });
  }
});

// Get claim details
router.get('/my-claims/:id', auth, async (req, res) => {
  try {
    const claim = await InsuranceClaim.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    })
      .populate('policyId')
      .populate('companyId', 'companyName logo phone email');

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    res.json({
      success: true,
      data: claim
    });

  } catch (error) {
    console.error('Claim details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claim details'
    });
  }
});

// ============================================
// CLAIM STATUS CHECK
// ============================================

// Get claim status (simplified)
router.get('/status/:claimNumber', auth, async (req, res) => {
  try {
    const claim = await InsuranceClaim.findOne({ 
      claimNumber: req.params.claimNumber,
      userId: req.user.id 
    });

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Get claim timeline
    const timeline = claim.timeline || [];

    res.json({
      success: true,
      data: {
        claimNumber: claim.claimNumber,
        status: claim.status,
        statusLabel: this.getStatusLabel(claim.status),
        amount: claim.amount,
        approvedAmount: claim.approvedAmount,
        settlementAmount: claim.settlementAmount,
        submittedAt: claim.createdAt,
        timeline: timeline,
        documents: claim.documents
      }
    });

  } catch (error) {
    console.error('Claim status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claim status'
    });
  }
});

// Helper: Get status label
const getStatusLabel = (status) => {
  const labels = {
    'submitted': 'Submitted',
    'document_uploaded': 'Documents Uploaded',
    'under_review': 'Under Review',
    'pending_verification': 'Pending Verification',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'settled': 'Settled',
    'partially_settled': 'Partially Settled',
    'cancelled': 'Cancelled'
  };
  return labels[status] || status;
};

// ============================================
// CLAIM CANCELLATION
// ============================================

// Cancel a claim
router.post('/:id/cancel', auth, async (req, res) => {
  try {
    const claim = await InsuranceClaim.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Only allow cancellation for certain statuses
    if (!['submitted', 'document_uploaded'].includes(claim.status)) {
      return res.status(400).json({
        success: false,
        message: 'Claim cannot be cancelled at this stage'
      });
    }

    claim.status = 'cancelled';
    claim.updatedAt = new Date();
    await claim.save();

    await claim.addTimeline('cancelled', 'Claim cancelled by customer', req.user.id);

    res.json({
      success: true,
      message: 'Claim cancelled successfully',
      data: {
        claimNumber: claim.claimNumber,
        status: claim.status
      }
    });

  } catch (error) {
    console.error('Claim cancellation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel claim'
    });
  }
});

// ============================================
// SLA TRACKER — GET /:id/sla
// ============================================
router.get('/:id/sla', auth, async (req, res) => {
  try {
    const raw = req.params.id;
    const isObjectId = /^[a-f\d]{24}$/i.test(raw);
    const claim = await InsuranceClaim.findOne({
      userId: req.user.id,
      $or: isObjectId
        ? [{ _id: raw }, { claimNumber: raw }]
        : [{ claimNumber: raw }]
    });
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    const filedAt = claim.createdAt || new Date();
    const daysSinceFiled = Math.floor((Date.now() - new Date(filedAt).getTime()) / (24 * 60 * 60 * 1000));
    const IRDAI_SLA_DAYS = 30;
    const daysRemaining = Math.max(0, IRDAI_SLA_DAYS - daysSinceFiled);
    const isOverdue = daysSinceFiled > IRDAI_SLA_DAYS;

    const terminalStatuses = ['settled', 'rejected', 'cancelled', 'partially_settled'];
    const isActive = !terminalStatuses.includes(claim.status);

    res.json({
      success: true,
      data: {
        claimNumber: claim.claimNumber,
        status: claim.status,
        filedAt,
        daysSinceFiled,
        slaDays: IRDAI_SLA_DAYS,
        daysRemaining,
        isOverdue,
        isActive,
        isEscalated: claim.escalationLevel === 'escalated' || claim.escalationLevel === 'critical',
        message: isOverdue && isActive
          ? `⚠️ IRDAI SLA breached by ${daysSinceFiled - IRDAI_SLA_DAYS} days. You can escalate.`
          : isActive
            ? `${daysRemaining} days remaining in IRDAI 30-day settlement window.`
            : `Claim ${claim.status}.`
      }
    });
  } catch (e) {
    console.error('[claim sla] error:', e.message);
    res.status(500).json({ success: false, message: 'Failed to load SLA' });
  }
});

// ============================================
// DISPUTE CLAIM — POST /:id/dispute
// Body: { reason }
// ============================================
router.post('/:id/dispute', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Dispute reason must be at least 10 characters' });
    }

    const raw = req.params.id;
const isObjectId = /^[a-f\d]{24}$/i.test(raw);
const claim = await InsuranceClaim.findOne({
  userId: req.user.id,
  $or: isObjectId ? [{ _id: raw }, { claimNumber: raw }] : [{ claimNumber: raw }]
});
if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    if (!['rejected', 'partially_settled'].includes(claim.status)) {
      return res.status(400).json({ success: false, message: 'Only rejected or partially-settled claims can be disputed' });
    }

    if (claim.isGrievance) {
      return res.status(400).json({ success: false, message: 'This claim has already been disputed' });
    }

    claim.isGrievance = true;
    claim.grievanceRaisedAt = new Date();
    claim.escalationLevel = 'escalated';
    claim.status = 'under_review'; // Re-open for insurer review
    claim.timeline.push({
      status: 'disputed',
      date: new Date(),
      note: `Dispute raised by customer: ${reason.trim()}`,
      performedBy: req.user.id
    });
    await claim.save();

    // Send email to insurer (fire and forget)
    try {
      const company = await InsuranceCompany.findById(claim.companyId);
      const notificationService = require('../services/notificationService');
      if (company && notificationService && notificationService.sendEmail) {
        await notificationService.sendEmail(
          company.email,
          `Claim Dispute Raised: ${claim.claimNumber}`,
          {
            template: 'claim_dispute',
            data: {
              claimNumber: claim.claimNumber,
              reason: reason.trim(),
              customerName: req.user.name || 'Customer'
            }
          }
        );
      }
    } catch (mailErr) {
      console.log('[dispute] email failed:', mailErr.message);
    }

    res.json({
      success: true,
      message: 'Dispute raised. The insurer has been notified and will review within 15 days.',
      data: { claimNumber: claim.claimNumber, status: claim.status, escalationLevel: claim.escalationLevel }
    });
  } catch (e) {
    console.error('[claim dispute] error:', e.message);
    res.status(500).json({ success: false, message: 'Failed to raise dispute' });
  }
});

// ============================================
// SETTLEMENT RECEIPT PDF — GET /:id/settlement-receipt
// ============================================
router.get('/:id/settlement-receipt', auth, async (req, res) => {
  try {
    const raw = req.params.id;
const isObjectId = /^[a-f\d]{24}$/i.test(raw);
const claim = await InsuranceClaim.findOne({
  userId: req.user.id,
  $or: isObjectId ? [{ _id: raw }, { claimNumber: raw }] : [{ claimNumber: raw }]
})
      .populate('policyId')
      .populate('companyId', 'companyName name email phone address logo');
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    if (!['settled', 'partially_settled'].includes(claim.status)) {
      return res.status(400).json({ success: false, message: 'Settlement receipt is available only for settled claims' });
    }

    const pdfService = require('../services/pdfService');
    const result = await pdfService.generateSettlementReceipt({
      ...claim.toObject(),
      policyNumber: claim.policyId?.policyNumber,
      planName: claim.policyId?.policyName,
      companyName: claim.companyId?.companyName || claim.companyId?.name
    });

    if (!result?.success || !result.pdf) {
      return res.status(503).json({ success: false, message: result?.error || 'PDF generation failed' });
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="settlement-${claim.claimNumber}.pdf"`,
      'Cache-Control': 'private, no-store'
    });
    res.send(result.pdf);
  } catch (e) {
    console.error('[settlement receipt] error:', e.message);
    res.status(500).json({ success: false, message: 'Failed to generate settlement receipt' });
  }
});

// ============================================
// POST /admin/auto-escalate — cron-triggered
// ============================================
router.post('/admin/auto-escalate', async (req, res) => {
  try {
    const key = req.headers['x-admin-key'];
    if (!key || key !== process.env.ADMIN_KEY) {
      return res.status(401).json({ success: false, message: 'Admin key required' });
    }

    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

    const overdueClaims = await InsuranceClaim.find({
      createdAt: { $lte: cutoff },
      status: { $in: ['submitted', 'document_uploaded', 'under_review', 'pending_verification'] },
      escalationLevel: { $ne: 'critical' },
    });

    let escalated = 0;
    const notificationService = require('../services/notificationService');
    const User = require('../models/User');
    const InsuranceCompany = require('../models/InsuranceCompany');

    for (const claim of overdueClaims) {
      claim.escalationLevel = 'critical';
      claim.timeline.push({
        status: 'escalated',
        date: new Date(),
        note: 'Auto-escalated: IRDAI 30-day SLA breached',
        performedBy: null,
      });
      await claim.save();
      escalated++;

      try {
        const patient = await User.findById(claim.userId);
        const company = await InsuranceCompany.findById(claim.companyId);
        if (patient?.email) {
          await notificationService.sendEmail(
            patient.email,
            `Claim ${claim.claimNumber} — Escalated`,
            `<p>Your claim exceeded the 30-day IRDAI window and has been auto-escalated.</p>`
          );
        }
        if (company?.email) {
          await notificationService.sendEmail(
            company.email,
            `URGENT: Claim ${claim.claimNumber} SLA breached`,
            `<p>Claim ${claim.claimNumber} has breached the 30-day IRDAI SLA.</p>`
          );
        }
      } catch (notifyErr) {
        console.error('[auto-escalate] notify failed:', notifyErr.message);
      }
    }

    res.json({ success: true, escalated, checked: overdueClaims.length });
  } catch (e) {
    console.error('[auto-escalate] error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ============================================
// POST /admin/sla-reminder — day 25-30 reminder
// ============================================
router.post('/admin/sla-reminder', async (req, res) => {
  try {
    const key = req.headers['x-admin-key'];
    if (!key || key !== process.env.ADMIN_KEY) {
      return res.status(401).json({ success: false, message: 'Admin key required' });
    }

    const TWENTY_FIVE_DAYS_MS = 25 * 24 * 60 * 60 * 1000;
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const from = new Date(Date.now() - THIRTY_DAYS_MS);
    const to = new Date(Date.now() - TWENTY_FIVE_DAYS_MS);

    const nearSlaClaims = await InsuranceClaim.find({
      createdAt: { $gte: from, $lte: to },
      status: { $in: ['submitted', 'document_uploaded', 'under_review', 'pending_verification'] },
      escalationLevel: 'normal',
    });

    let reminded = 0;
    const notificationService = require('../services/notificationService');
    const InsuranceCompany = require('../models/InsuranceCompany');

    for (const claim of nearSlaClaims) {
      try {
        const company = await InsuranceCompany.findById(claim.companyId);
        if (company?.email) {
          await notificationService.sendEmail(
            company.email,
            `Reminder: Claim ${claim.claimNumber} nearing SLA`,
            `<p>Claim ${claim.claimNumber} is approaching the 30-day IRDAI deadline.</p>`
          );
          reminded++;
        }
      } catch (notifyErr) {
        console.error('[sla-reminder] notify failed:', notifyErr.message);
      }
    }

    res.json({ success: true, reminded, checked: nearSlaClaims.length });
  } catch (e) {
    console.error('[sla-reminder] error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;

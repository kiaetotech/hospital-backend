// D:\hospital backend\routes\insurance-preauth.js
// ============================================
// CASH-LESS PRE-AUTHORIZATION
// Mount: app.use('/api/insurance-preauth', ...)
// ============================================

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

require('../models/User');
const InsurancePreAuth = require('../models/InsuranceMarketplace').InsurancePreAuth;
const InsurancePolicy = require('../models/InsurancePolicy');
const InsuranceCompany = require('../models/InsuranceCompany');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

function ok(res, data, meta = {}) {
  return res.json({ success: true, data, meta: { ...meta, timestamp: new Date().toISOString() } });
}
function fail(res, status, code, message, details = {}) {
  return res.status(status).json({ success: false, error: { code, message, details } });
}
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const uid = (req) => req.user.id || req.user.userId || req.user._id;

// ============================================
// MODEL GUARD
// ============================================
function ensureModels() {
  const mod = require('mongoose');
  if (mod.models.InsurancePlan) return;
  const paths = [
    '../models/User',
    '../models/InsurancePlan',
    '../models/InsuranceCompany',
    '../models/InsurancePolicy',
    '../models/InsuranceClaim',
    '../models/Booking',
    '../models/Transaction',
    '../models/InsuranceMarketplace',
  ];
  for (const p of paths) {
    try {
      const resolved = require.resolve(p);
      delete require.cache[resolved];
      require(p);
    } catch (e) { /* ignore */ }
  }
}

// ============================================
// GET /my-preauths — list patient's pre-auth requests
// ============================================
router.get('/my-preauths', authenticate, asyncHandler(async (req, res) => {
  ensureModels();
  const preauths = await InsurancePreAuth.find({ userId: uid(req) })
    .populate('policyId', 'policyNumber policyName sumInsured')
    .sort({ createdAt: -1 })
    .lean();
  return ok(res, preauths);
}));

// ============================================
// GET /policy/:policyId — pre-auths for a specific policy
// ============================================
router.get('/policy/:policyId', authenticate, asyncHandler(async (req, res) => {
  ensureModels();
  const policy = await InsurancePolicy.findOne({ _id: req.params.policyId, userId: String(uid(req)) });
  if (!policy) return fail(res, 404, 'NOT_FOUND', 'Policy not found');

  const preauths = await InsurancePreAuth.find({ policyId: policy._id })
    .sort({ createdAt: -1 })
    .lean();
  return ok(res, preauths);
}));

// ============================================
// POST /submit — file a new pre-auth request
// Body: { policyId, hospitalName, hospitalAddress, admissionDate, admissionType, diagnosis, treatment, estimatedCost, requestedAmount, documents }
// ============================================
router.post('/submit', authenticate, asyncHandler(async (req, res) => {
  ensureModels();
  const userId = uid(req);
  const {
    policyId, hospitalName, hospitalAddress, admissionDate, admissionType,
    diagnosis, treatment, estimatedCost, requestedAmount, documents = [],
  } = req.body;

  if (!policyId || !hospitalName || !admissionDate || !estimatedCost || !requestedAmount) {
    return fail(res, 400, 'MISSING_FIELDS', 'policyId, hospitalName, admissionDate, estimatedCost, requestedAmount required');
  }

  const policy = await InsurancePolicy.findOne({ _id: policyId, userId: String(userId) });
  if (!policy) return fail(res, 404, 'NOT_FOUND', 'Policy not found');
  if (policy.status !== 'active') return fail(res, 400, 'POLICY_NOT_ACTIVE', 'Only active policies can request pre-auth');

  if (Number(requestedAmount) > policy.sumInsured) {
    return fail(res, 400, 'EXCEEDS_COVER', `Requested amount exceeds sum insured of ₹${policy.sumInsured}`);
  }

  const preauth = new InsurancePreAuth({
    policyId: policy._id,
    userId,
    companyId: policy.companyId,
    hospitalName,
    hospitalAddress: hospitalAddress || '',
    admissionDate: new Date(admissionDate),
    admissionType: admissionType || 'planned',
    diagnosis: diagnosis || '',
    treatment: treatment || '',
    estimatedCost: Number(estimatedCost),
    requestedAmount: Number(requestedAmount),
    documents: Array.isArray(documents) ? documents : [],
    status: 'submitted',
    submittedAt: new Date(),
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
  });

  await preauth.save();

  // Notify insurer
  try {
    const company = await InsuranceCompany.findOne({ userId: policy.companyId });
    if (company?.email) {
      await notificationService.sendEmail(
        company.email,
        `New Cashless Pre-Auth Request — ${preauth.preAuthNumber}`,
        `<p>A new cashless pre-authorization request has been submitted.</p>
         <ul>
           <li><strong>Pre-Auth Number:</strong> ${preauth.preAuthNumber}</li>
           <li><strong>Policy:</strong> ${policy.policyNumber}</li>
           <li><strong>Hospital:</strong> ${hospitalName}</li>
           <li><strong>Admission Date:</strong> ${new Date(admissionDate).toLocaleDateString()}</li>
           <li><strong>Estimated Cost:</strong> ₹${estimatedCost}</li>
           <li><strong>Requested Amount:</strong> ₹${requestedAmount}</li>
         </ul>
         <p>Please review within 24 hours (typical cashless SLA).</p>`
      );
    }
  } catch (notifyErr) {
    console.error('[preauth-submit] insurer notify failed:', notifyErr.message);
  }

  return ok(res, preauth);
}));

// ============================================
// GET /:id — single pre-auth detail
// ============================================
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  ensureModels();
  const preauth = await InsurancePreAuth.findOne({ _id: req.params.id, userId: uid(req) })
    .populate('policyId', 'policyNumber policyName sumInsured endDate')
    .lean();
  if (!preauth) return fail(res, 404, 'NOT_FOUND', 'Pre-auth not found');
  return ok(res, preauth);
}));

// ============================================
// PUT /:id/respond — patient responds to query
// Body: { response }
// ============================================
router.put('/:id/respond', authenticate, asyncHandler(async (req, res) => {
  ensureModels();
  const { response } = req.body;
  if (!response || response.trim().length < 5) {
    return fail(res, 400, 'INVALID', 'Response must be at least 5 characters');
  }

  const preauth = await InsurancePreAuth.findOne({ _id: req.params.id, userId: uid(req) });
  if (!preauth) return fail(res, 404, 'NOT_FOUND', 'Pre-auth not found');

  if (preauth.status !== 'query_raised') {
    return fail(res, 400, 'NOT_IN_QUERY', 'Pre-auth is not in query state');
  }

  preauth.queryResponse = response.trim();
  preauth.status = 'under_review';
  await preauth.save();

  return ok(res, preauth);
}));

// ============================================
// POST /:id/cancel — patient cancels pre-auth
// ============================================
router.post('/:id/cancel', authenticate, asyncHandler(async (req, res) => {
  ensureModels();
  const preauth = await InsurancePreAuth.findOne({ _id: req.params.id, userId: uid(req) });
  if (!preauth) return fail(res, 404, 'NOT_FOUND', 'Pre-auth not found');

  if (['approved', 'rejected', 'expired'].includes(preauth.status)) {
    return fail(res, 400, 'NOT_CANCELLABLE', `Pre-auth in ${preauth.status} state cannot be cancelled`);
  }

  preauth.status = 'expired';
  await preauth.save();
  return ok(res, preauth);
}));

// ============================================
// ADMIN / INSURER — update status
// Used by insurer portal
// ============================================

// GET /insurer/pending — insurer's pending pre-auths
router.get('/insurer/pending', authenticate, asyncHandler(async (req, res) => {
  ensureModels();
  const insurerUserId = uid(req);
  const preauths = await InsurancePreAuth.find({
    companyId: insurerUserId,
    status: { $in: ['submitted', 'under_review', 'query_raised'] },
  })
    .populate('policyId', 'policyNumber policyName sumInsured primaryInsured')
    .populate('userId', 'name phone email')
    .sort({ createdAt: -1 })
    .lean();
  return ok(res, preauths);
}));

// PUT /insurer/:id/decide — approve / reject / query
router.put('/insurer/:id/decide', authenticate, asyncHandler(async (req, res) => {
  ensureModels();
  const { action, approvedAmount, note, queryMessage } = req.body;
  if (!['approve', 'reject', 'query'].includes(action)) {
    return fail(res, 400, 'INVALID_ACTION', 'action must be approve, reject, or query');
  }

  const preauth = await InsurancePreAuth.findOne({ _id: req.params.id, companyId: uid(req) });
  if (!preauth) return fail(res, 404, 'NOT_FOUND', 'Pre-auth not found');

  if (action === 'approve') {
    preauth.status = 'approved';
    preauth.approvedAmount = Number(approvedAmount) || preauth.requestedAmount;
    preauth.insurerNotes = note || '';
    preauth.decidedAt = new Date();
  } else if (action === 'reject') {
    preauth.status = 'rejected';
    preauth.rejectionReason = note || 'Not eligible for cashless';
    preauth.decidedAt = new Date();
  } else if (action === 'query') {
    preauth.status = 'query_raised';
    preauth.queryMessage = queryMessage || 'Please provide additional documents';
  }

  await preauth.save();

  // Notify patient
  try {
    const patient = await User.findById(preauth.userId);
    const statusLabel = preauth.status.replace(/_/g, ' ');
    if (patient?.email) {
      await notificationService.sendEmail(
        patient.email,
        `Pre-Auth ${preauth.preAuthNumber} — ${statusLabel}`,
        `<p>Your cashless pre-authorization has been updated.</p>
         <ul>
           <li><strong>Pre-Auth Number:</strong> ${preauth.preAuthNumber}</li>
           <li><strong>Status:</strong> ${statusLabel}</li>
           ${preauth.approvedAmount ? `<li><strong>Approved Amount:</strong> ₹${preauth.approvedAmount}</li>` : ''}
           ${preauth.rejectionReason ? `<li><strong>Reason:</strong> ${preauth.rejectionReason}</li>` : ''}
           ${preauth.queryMessage ? `<li><strong>Query:</strong> ${preauth.queryMessage}</li>` : ''}
         </ul>`
      );
    }
    if (patient?.phone) {
      await notificationService.sendSMS(
        patient.phone,
        `Pre-Auth ${preauth.preAuthNumber}: ${statusLabel}. Login for details.`
      );
    }
  } catch (notifyErr) {
    console.error('[preauth-decide] notify failed:', notifyErr.message);
  }

  return ok(res, preauth);
}));

module.exports = router;
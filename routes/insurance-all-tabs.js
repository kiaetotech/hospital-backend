// D:\hospital backend\routes\insurance-all-tabs.js
// ============================================
// INSURANCE — ALL EXTENDED TABS (Company + Admin + Advertising)
// ============================================
// Single consolidated route file.
// Mount: app.use('/api/insurance', require('./routes/insurance-all-tabs'));
// ============================================

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Models
const InsuranceCompany = require('../models/InsuranceCompany');
const InsurancePlan = require('../models/InsurancePlan');
const InsurancePolicy = require('../models/InsurancePolicy');
const InsuranceClaim = require('../models/InsuranceClaim');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

const {
  InsuranceComplaint,
  InsuranceCampaign,
  InsuranceAdEvent
} = require('../models/InsuranceTag');

const { authenticate: auth } = require('../middleware/auth');

// ============================================
// HELPERS
// ============================================

function ok(res, data, meta = {}) {
  return res.json({ success: true, data, meta: { ...meta, timestamp: new Date().toISOString() } });
}
function fail(res, status, code, message, details = {}) {
  return res.status(status).json({ success: false, error: { code, message, details } });
}
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
function requireAdminKey(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key && key === process.env.ADMIN_KEY) return next();
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const jwt = require('jsonwebtoken');
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin') return next();
    } catch (e) {}
  }
  return fail(res, 401, 'UNAUTHORIZED', 'Admin authentication required');
}

// ============================================
// MIDDLEWARE — Insurer access
// ============================================

const checkInsurer = asyncHandler(async (req, res, next) => {
  let company = await InsuranceCompany.findOne({ userId: req.user.id, isActive: true });
  if (!company && req.user.email) {
    company = await InsuranceCompany.findOne({ email: req.user.email, isActive: true });
    if (company && !company.userId) {
      company.userId = req.user.id;
      await company.save();
    }
  }
  if (!company) return fail(res, 403, 'FORBIDDEN', 'Insurance company access required');
  req.insuranceCompany = company;
  next();
});

// ============================================
// COMPANY — COMPLAINTS
// ============================================

router.get('/company/complaints', auth, checkInsurer, asyncHandler(async (req, res) => {
  const { status, priority, page = 1, limit = 20 } = req.query;
  const companyId = req.insuranceCompany._id;

  const policyIds = await InsurancePolicy.find({ companyId }).distinct('_id');
  const query = { policyId: { $in: policyIds } };
  if (status && status !== 'all') query.status = status;
  if (priority && priority !== 'all') query.priority = priority;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [complaints, total] = await Promise.all([
    InsuranceComplaint.find(query)
      .populate('policyId', 'policyNumber policyName')
      .populate('claimId', 'claimNumber amount')
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    InsuranceComplaint.countDocuments(query)
  ]);

  const summaryAgg = await InsuranceComplaint.aggregate([
    { $match: { policyId: { $in: policyIds } } },
    { $group: { _id: null,
      total: { $sum: 1 },
      open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
      inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
      resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
      escalated: { $sum: { $cond: [{ $eq: ['$status', 'escalated'] }, 1, 0] } }
    }}
  ]);
  const summary = summaryAgg[0] || { total: 0, open: 0, inProgress: 0, resolved: 0, escalated: 0 };

  return ok(res, complaints, {
    summary,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
  });
}));

router.get('/company/complaints/:id', auth, checkInsurer, asyncHandler(async (req, res) => {
  const complaint = await InsuranceComplaint.findById(req.params.id)
    .populate('policyId', 'policyNumber policyName sumInsured')
    .populate('claimId', 'claimNumber amount status')
    .populate('userId', 'name email phone');
  if (!complaint) return fail(res, 404, 'NOT_FOUND', 'Complaint not found');

  const policy = await InsurancePolicy.findById(complaint.policyId);
  if (!policy || String(policy.companyId) !== String(req.insuranceCompany._id)) {
    return fail(res, 403, 'FORBIDDEN', 'Not your complaint');
  }
  return ok(res, complaint);
}));

router.post('/company/complaints/:id/respond', auth, checkInsurer, asyncHandler(async (req, res) => {
  const { message, attachments = [] } = req.body;
  if (!message || message.trim().length < 3) return fail(res, 400, 'INVALID_MESSAGE', 'Message must be at least 3 characters');

  const complaint = await InsuranceComplaint.findById(req.params.id);
  if (!complaint) return fail(res, 404, 'NOT_FOUND', 'Complaint not found');

  const policy = await InsurancePolicy.findById(complaint.policyId);
  if (!policy || String(policy.companyId) !== String(req.insuranceCompany._id)) {
    return fail(res, 403, 'FORBIDDEN', 'Not your complaint');
  }

  complaint.responses = complaint.responses || [];
  complaint.responses.push({
    from: 'insurer', userId: String(req.user.id),
    message: message.trim().slice(0, 2000), attachments, at: new Date()
  });
  if (complaint.status === 'open') complaint.status = 'in_progress';
  await complaint.save();
  return ok(res, complaint);
}));

router.post('/company/complaints/:id/resolve', auth, checkInsurer, asyncHandler(async (req, res) => {
  const { resolutionNote } = req.body;
  const complaint = await InsuranceComplaint.findById(req.params.id);
  if (!complaint) return fail(res, 404, 'NOT_FOUND', 'Complaint not found');

  const policy = await InsurancePolicy.findById(complaint.policyId);
  if (!policy || String(policy.companyId) !== String(req.insuranceCompany._id)) {
    return fail(res, 403, 'FORBIDDEN', 'Not your complaint');
  }

  complaint.status = 'resolved';
  if (resolutionNote) {
    complaint.responses = complaint.responses || [];
    complaint.responses.push({
      from: 'insurer', userId: String(req.user.id),
      message: `Resolved: ${resolutionNote}`, at: new Date()
    });
  }
  await complaint.save();
  return ok(res, complaint);
}));

// ============================================
// COMPANY — REVIEWS
// ============================================

router.get('/company/reviews', auth, checkInsurer, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, minRating, maxRating } = req.query;
  const companyId = req.insuranceCompany._id;

  const policies = await InsurancePolicy.find({ companyId })
    .select('_id policyNumber policyName review').lean();

  let reviews = [];
  policies.forEach(p => {
    if (p.review && (p.review.rating || p.review.comment)) {
      reviews.push({
        policyId: p._id, policyNumber: p.policyNumber, policyName: p.policyName,
        rating: p.review.rating, comment: p.review.comment,
        insurerResponse: p.review.insurerResponse || '',
        insurerRespondedAt: p.review.insurerRespondedAt,
        createdAt: p.review.createdAt
      });
    }
  });

  if (minRating) reviews = reviews.filter(r => r.rating >= parseInt(minRating));
  if (maxRating) reviews = reviews.filter(r => r.rating <= parseInt(maxRating));
  reviews.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const total = reviews.length;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const paginated = reviews.slice(skip, skip + parseInt(limit));
  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length) * 10) / 10 : 0;

  return ok(res, paginated, {
    averageRating: avgRating, totalReviews: total,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
  });
}));

router.post('/company/reviews/:policyId/respond', auth, checkInsurer, asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message || message.trim().length < 3) return fail(res, 400, 'INVALID_MESSAGE', 'Message must be at least 3 characters');

  const policy = await InsurancePolicy.findOne({ _id: req.params.policyId, companyId: req.insuranceCompany._id });
  if (!policy) return fail(res, 404, 'NOT_FOUND', 'Policy not found');
  if (!policy.review || (!policy.review.rating && !policy.review.comment)) {
    return fail(res, 400, 'NO_REVIEW', 'No review to respond to');
  }

  policy.review.insurerResponse = message.trim().slice(0, 1000);
  policy.review.insurerRespondedAt = new Date();
  policy.markModified('review');
  await policy.save();
  return ok(res, policy.review);
}));

// ============================================
// COMPANY — CORPORATE
// ============================================

router.post('/company/corporate/toggle', auth, checkInsurer, asyncHandler(async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return fail(res, 400, 'INVALID', 'enabled must be boolean');

  const company = await InsuranceCompany.findById(req.insuranceCompany._id);
  company.sellingChannels = company.sellingChannels || {};
  company.sellingChannels.corporate = enabled;
  await company.save();
  return ok(res, { corporateEnabled: enabled });
}));

router.get('/company/corporate/packages', auth, checkInsurer, asyncHandler(async (req, res) => {
  const plans = await InsurancePlan.find({
    companyId: req.insuranceCompany.userId || req.user.id,
    isCorporate: true
  }).sort({ createdAt: -1 }).lean();
  return ok(res, plans);
}));

router.get('/company/corporate/enquiries', auth, checkInsurer, asyncHandler(async (req, res) => {
  let CorporatePlan = null;
  try { CorporatePlan = require('../models/CorporatePlan'); } catch (e) {}
  if (!CorporatePlan) return ok(res, []);

  const myPlanIds = await InsurancePlan.find({
    companyId: req.insuranceCompany.userId || req.user.id,
    isCorporate: true
  }).distinct('_id');

  const enquiries = await CorporatePlan.find({ planId: { $in: myPlanIds } })
    .sort({ createdAt: -1 }).lean();
  return ok(res, enquiries);
}));

// ============================================
// COMPANY — KYC
// ============================================

router.get('/company/kyc', auth, checkInsurer, asyncHandler(async (req, res) => {
  const company = await InsuranceCompany.findById(req.insuranceCompany._id)
    .select('documents verificationStatus status companyName');
  return ok(res, {
    documents: company.documents || {},
    verificationStatus: company.verificationStatus || company.status || 'pending'
  });
}));

router.post('/company/kyc/submit', auth, checkInsurer, asyncHandler(async (req, res) => {
  const { irdaCertificate, gstCertificate, panCard, bankProof,
          registrationCertificate, panNumber, gstNumber } = req.body;

  if (!irdaCertificate || !gstCertificate || !panCard) {
    return fail(res, 400, 'MISSING_DOCS', 'IRDAI certificate, GST certificate, and PAN card are required');
  }

  const company = await InsuranceCompany.findById(req.insuranceCompany._id);
  company.documents = {
    ...(company.documents || {}),
    irdaCertificate, gstCertificate, panCard,
    bankProof: bankProof || company.documents?.bankProof,
    registrationCertificate: registrationCertificate || company.documents?.registrationCertificate,
    panNumber: panNumber || company.documents?.panNumber,
    gstNumber: gstNumber || company.documents?.gstNumber,
    kycStatus: 'submitted', submittedAt: new Date()
  };
  company.verificationStatus = 'pending';
  await company.save();

  return ok(res, {
    kycStatus: 'submitted',
    message: 'KYC submitted for review. You will be notified once verified.'
  });
}));

// ============================================
// COMPANY — SUSPENDED STATUS
// ============================================

router.get('/company/suspended-status', auth, checkInsurer, asyncHandler(async (req, res) => {
  const company = await InsuranceCompany.findById(req.insuranceCompany._id)
    .select('verificationStatus status suspendedReason suspendedAt suspendedUntil');

  const isSuspended = company.verificationStatus === 'suspended' || company.status === 'suspended';
  return ok(res, {
    isSuspended,
    reason: company.suspendedReason || null,
    suspendedAt: company.suspendedAt || null,
    suspendedUntil: company.suspendedUntil || null,
    verificationStatus: company.verificationStatus || company.status
  });
}));

// ============================================
// ADMIN — OVERVIEW
// ============================================

router.get('/admin/overview', requireAdminKey, asyncHandler(async (req, res) => {
  const [totalCompanies, activeCompanies, pendingCompanies, suspendedCompanies,
         totalPlans, activePlans, pendingPlans,
         totalPolicies, activePolicies, pendingPolicies,
         totalClaims, pendingClaims, approvedClaims, rejectedClaims, settledClaims] = await Promise.all([
    InsuranceCompany.countDocuments(),
    InsuranceCompany.countDocuments({ isActive: true, isVerified: true }),
    InsuranceCompany.countDocuments({ verificationStatus: 'pending' }),
    InsuranceCompany.countDocuments({ verificationStatus: 'suspended' }),
    InsurancePlan.countDocuments(),
    InsurancePlan.countDocuments({ isActive: true, isVerified: true }),
    InsurancePlan.countDocuments({ isVerified: false }),
    InsurancePolicy.countDocuments(),
    InsurancePolicy.countDocuments({ status: 'active' }),
    InsurancePolicy.countDocuments({ status: 'pending' }),
    InsuranceClaim.countDocuments(),
    InsuranceClaim.countDocuments({ status: { $in: ['submitted', 'under_review', 'pending_verification'] } }),
    InsuranceClaim.countDocuments({ status: 'approved' }),
    InsuranceClaim.countDocuments({ status: 'rejected' }),
    InsuranceClaim.countDocuments({ status: 'settled' })
  ]);

  const revenueAgg = await Transaction.aggregate([
    { $match: { bookingType: 'insurance', status: 'completed' } },
    { $group: {
      _id: null,
      totalPremium: { $sum: '$premiumAmount' },
      totalCommission: { $sum: '$insurancePlatformCommission' },
      totalPayout: { $sum: '$insurancePayoutToCompany' }
    }}
  ]);
  const revenue = revenueAgg[0] || { totalPremium: 0, totalCommission: 0, totalPayout: 0 };

  // Last 30 days trend
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const trendAgg = await Transaction.aggregate([
    { $match: { bookingType: 'insurance', status: 'completed', createdAt: { $gte: thirtyDaysAgo } } },
    { $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      policies: { $sum: 1 },
      premium: { $sum: '$premiumAmount' },
      commission: { $sum: '$insurancePlatformCommission' }
    }},
    { $sort: { _id: 1 } }
  ]);

  return ok(res, {
    companies: { total: totalCompanies, active: activeCompanies, pending: pendingCompanies, suspended: suspendedCompanies },
    plans: { total: totalPlans, active: activePlans, pending: pendingPlans },
    policies: { total: totalPolicies, active: activePolicies, pending: pendingPolicies },
    claims: { total: totalClaims, pending: pendingClaims, approved: approvedClaims, rejected: rejectedClaims, settled: settledClaims },
    revenue,
    trend: trendAgg
  });
}));

// ============================================
// ADMIN — COMPANIES
// ============================================

router.get('/admin/companies', requireAdminKey, asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const query = {};
  if (status && status !== 'all') query.verificationStatus = status;
  if (search) query.$or = [
    { companyName: { $regex: search, $options: 'i' } },
    { registrationNumber: { $regex: search, $options: 'i' } },
    { irdaRegistration: { $regex: search, $options: 'i' } }
  ];

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [companies, total] = await Promise.all([
    InsuranceCompany.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    InsuranceCompany.countDocuments(query)
  ]);

  return ok(res, companies, {
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
  });
}));

router.post('/admin/companies/:id/approve', requireAdminKey, asyncHandler(async (req, res) => {
  const company = await InsuranceCompany.findById(req.params.id);
  if (!company) return fail(res, 404, 'NOT_FOUND', 'Company not found');

  company.verificationStatus = 'approved';
  company.isVerified = true;
  company.status = 'active';
  company.verifiedAt = new Date();
  company.verificationHistory = company.verificationHistory || [];
  company.verificationHistory.push({ action: 'approved', at: new Date(), by: req.user?.id });
  await company.save();

  return ok(res, company);
}));

router.post('/admin/companies/:id/reject', requireAdminKey, asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason || reason.trim().length < 3) return fail(res, 400, 'REASON_REQUIRED', 'Rejection reason required');

  const company = await InsuranceCompany.findById(req.params.id);
  if (!company) return fail(res, 404, 'NOT_FOUND', 'Company not found');

  company.verificationStatus = 'rejected';
  company.isVerified = false;
  company.rejectionReason = reason.trim();
  company.verificationHistory = company.verificationHistory || [];
  company.verificationHistory.push({ action: 'rejected', at: new Date(), reason, by: req.user?.id });
  await company.save();
  return ok(res, company);
}));

router.post('/admin/companies/:id/suspend', requireAdminKey, asyncHandler(async (req, res) => {
  const { reason, until } = req.body;
  if (!reason || reason.trim().length < 3) return fail(res, 400, 'REASON_REQUIRED', 'Suspension reason required');

  const company = await InsuranceCompany.findById(req.params.id);
  if (!company) return fail(res, 404, 'NOT_FOUND', 'Company not found');

  company.verificationStatus = 'suspended';
  company.status = 'suspended';
  company.isActive = false;
  company.suspendedReason = reason.trim();
  company.suspendedAt = new Date();
  company.suspendedUntil = until ? new Date(until) : undefined;
  company.verificationHistory = company.verificationHistory || [];
  company.verificationHistory.push({ action: 'suspended', at: new Date(), reason, by: req.user?.id });
  await company.save();
  return ok(res, company);
}));

router.post('/admin/companies/:id/unsuspend', requireAdminKey, asyncHandler(async (req, res) => {
  const company = await InsuranceCompany.findById(req.params.id);
  if (!company) return fail(res, 404, 'NOT_FOUND', 'Company not found');

  company.verificationStatus = 'approved';
  company.status = 'active';
  company.isActive = true;
  company.suspendedReason = undefined;
  company.suspendedAt = undefined;
  company.suspendedUntil = undefined;
  company.verificationHistory = company.verificationHistory || [];
  company.verificationHistory.push({ action: 'unsuspended', at: new Date(), by: req.user?.id });
  await company.save();
  return ok(res, company);
}));

router.get('/admin/suspended', requireAdminKey, asyncHandler(async (req, res) => {
  const companies = await InsuranceCompany.find({ verificationStatus: 'suspended' })
    .select('companyName email phone suspendedReason suspendedAt suspendedUntil').lean();
  return ok(res, companies, { total: companies.length });
}));

// ============================================
// ADMIN — PLANS
// ============================================

router.get('/admin/plans', requireAdminKey, asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const query = {};
  if (status === 'pending') query.isVerified = false;
  if (status === 'approved') query.isVerified = true;
  if (status === 'active') query.isActive = true;
  if (status === 'inactive') query.isActive = false;
  if (search) query.planName = { $regex: search, $options: 'i' };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [plans, total] = await Promise.all([
    InsurancePlan.find(query).populate('companyId', 'companyName').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    InsurancePlan.countDocuments(query)
  ]);
  return ok(res, plans, {
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
  });
}));

router.post('/admin/plans/:id/approve', requireAdminKey, asyncHandler(async (req, res) => {
  const plan = await InsurancePlan.findById(req.params.id);
  if (!plan) return fail(res, 404, 'NOT_FOUND', 'Plan not found');
  plan.isVerified = true;
  plan.verificationDate = new Date();
  await plan.save();
  return ok(res, plan);
}));

router.post('/admin/plans/:id/reject', requireAdminKey, asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason || reason.trim().length < 3) return fail(res, 400, 'REASON_REQUIRED', 'Rejection reason required');
  const plan = await InsurancePlan.findById(req.params.id);
  if (!plan) return fail(res, 404, 'NOT_FOUND', 'Plan not found');
  plan.isVerified = false;
  plan.rejectionReason = reason.trim();
  await plan.save();
  return ok(res, plan);
}));

router.post('/admin/plans/:id/toggle', requireAdminKey, asyncHandler(async (req, res) => {
  const plan = await InsurancePlan.findById(req.params.id);
  if (!plan) return fail(res, 404, 'NOT_FOUND', 'Plan not found');
  plan.isActive = !plan.isActive;
  await plan.save();
  return ok(res, plan);
}));

// ============================================
// ADMIN — POLICIES
// ============================================

router.get('/admin/policies', requireAdminKey, asyncHandler(async (req, res) => {
  const { status, companyId, search, page = 1, limit = 20 } = req.query;
  const query = {};
  if (status && status !== 'all') query.status = status;
  if (companyId) query.companyId = companyId;
  if (search) query.$or = [
    { policyNumber: { $regex: search, $options: 'i' } },
    { 'primaryInsured.name': { $regex: search, $options: 'i' } }
  ];

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [policies, total] = await Promise.all([
    InsurancePolicy.find(query)
      .populate('planId', 'planName planType')
      .populate('companyId', 'companyName')
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    InsurancePolicy.countDocuments(query)
  ]);
  return ok(res, policies, {
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
  });
}));

router.post('/admin/policies/:id/force-cancel', requireAdminKey, asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason) return fail(res, 400, 'REASON_REQUIRED', 'Reason required');

  const policy = await InsurancePolicy.findById(req.params.id);
  if (!policy) return fail(res, 404, 'NOT_FOUND', 'Policy not found');
  if (policy.status === 'cancelled') return fail(res, 400, 'ALREADY_CANCELLED', 'Already cancelled');

  policy.status = 'cancelled';
  policy.cancellationReason = `Admin: ${reason}`;
  policy.cancellationDate = new Date();
  await policy.save();

  return ok(res, policy);
}));

// ============================================
// ADMIN — CLAIMS
// ============================================

router.get('/admin/claims', requireAdminKey, asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const query = {};
  if (status && status !== 'all') query.status = status;
  if (search) query.$or = [
    { claimNumber: { $regex: search, $options: 'i' } },
    { policyNumber: { $regex: search, $options: 'i' } },
    { hospitalName: { $regex: search, $options: 'i' } }
  ];

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [claims, total] = await Promise.all([
    InsuranceClaim.find(query)
      .populate('policyId', 'policyNumber policyName')
      .populate('companyId', 'companyName')
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    InsuranceClaim.countDocuments(query)
  ]);
  return ok(res, claims, {
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
  });
}));

// ============================================
// ADMIN — PENDING QUEUE
// ============================================

router.get('/admin/pending', requireAdminKey, asyncHandler(async (req, res) => {
  const [pendingCompanies, pendingPlans, pendingKyc, pendingClaims] = await Promise.all([
    InsuranceCompany.find({ verificationStatus: 'pending' }).select('companyName email phone createdAt').lean(),
    InsurancePlan.find({ isVerified: false }).populate('companyId', 'companyName').select('planName planType createdAt').lean(),
    InsuranceCompany.find({ 'documents.kycStatus': 'submitted' })
      .select('companyName email documents.submittedAt').lean(),
    InsuranceClaim.find({ status: 'submitted' }).populate('policyId', 'policyNumber').select('claimNumber amount createdAt').lean()
  ]);

  return ok(res, {
    companies: pendingCompanies,
    plans: pendingPlans,
    kyc: pendingKyc,
    claims: pendingClaims,
    totalPending: pendingCompanies.length + pendingPlans.length + pendingKyc.length + pendingClaims.length
  });
}));

// ============================================
// ADMIN — REVIEWS MODERATION
// ============================================

router.get('/admin/reviews', requireAdminKey, asyncHandler(async (req, res) => {
  const { page = 1, limit = 30, flagged } = req.query;
  const policies = await InsurancePolicy.find({ 'review.rating': { $exists: true, $ne: null } })
    .populate('companyId', 'companyName')
    .select('policyNumber policyName review companyId')
    .sort({ 'review.createdAt': -1 })
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit))
    .lean();

  const reviews = policies.map(p => ({
    policyId: p._id,
    policyNumber: p.policyNumber,
    policyName: p.policyName,
    companyName: p.companyId?.companyName || 'N/A',
    rating: p.review?.rating,
    comment: p.review?.comment,
    isFlagged: p.review?.isFlagged === true,
    isHidden: p.review?.isHidden === true,
    createdAt: p.review?.createdAt
  })).filter(r => !flagged || r.isFlagged);

  return ok(res, reviews);
}));

router.post('/admin/reviews/:policyId/flag', requireAdminKey, asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const policy = await InsurancePolicy.findById(req.params.policyId);
  if (!policy || !policy.review) return fail(res, 404, 'NOT_FOUND', 'Review not found');

  policy.review.isFlagged = true;
  policy.review.flaggedReason = (reason || 'Flagged by admin').slice(0, 500);
  policy.review.flaggedAt = new Date();
  policy.markModified('review');
  await policy.save();
  return ok(res, policy.review);
}));

router.post('/admin/reviews/:policyId/hide', requireAdminKey, asyncHandler(async (req, res) => {
  const { reason, unhide } = req.body;
  const policy = await InsurancePolicy.findById(req.params.policyId);
  if (!policy || !policy.review) return fail(res, 404, 'NOT_FOUND', 'Review not found');

  if (unhide === true) {
    policy.review.isHidden = false;
    policy.review.hiddenReason = '';
    policy.review.hiddenAt = null;
  } else {
    policy.review.isHidden = true;
    policy.review.hiddenReason = (reason || 'Hidden by admin').slice(0, 500);
    policy.review.hiddenAt = new Date();
  }
  policy.markModified('review');
  await policy.save();
  return ok(res, policy.review);
}));

// ============================================
// ADMIN — COMPLAINTS MODERATION
// ============================================

router.get('/admin/complaints', requireAdminKey, asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 30 } = req.query;
  const query = {};
  if (status && status !== 'all') query.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [complaints, total] = await Promise.all([
    InsuranceComplaint.find(query)
      .populate('policyId', 'policyNumber policyName')
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    InsuranceComplaint.countDocuments(query)
  ]);
  return ok(res, complaints, {
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
  });
}));

router.post('/admin/complaints/:id/escalate', requireAdminKey, asyncHandler(async (req, res) => {
  const { note } = req.body;
  const complaint = await InsuranceComplaint.findById(req.params.id);
  if (!complaint) return fail(res, 404, 'NOT_FOUND', 'Complaint not found');

  complaint.status = 'escalated';
  complaint.priority = 'high';
  complaint.responses = complaint.responses || [];
  complaint.responses.push({
    from: 'platform', message: note || 'Escalated by admin', at: new Date()
  });
  await complaint.save();
  return ok(res, complaint);
}));

// ============================================
// ADMIN — KYC VERIFICATION
// ============================================

router.get('/admin/kyc/pending', requireAdminKey, asyncHandler(async (req, res) => {
  const companies = await InsuranceCompany.find({ 'documents.kycStatus': 'submitted' })
    .select('companyName email phone documents').lean();
  return ok(res, companies);
}));

router.post('/admin/kyc/:companyId/verify', requireAdminKey, asyncHandler(async (req, res) => {
  const company = await InsuranceCompany.findById(req.params.companyId);
  if (!company) return fail(res, 404, 'NOT_FOUND', 'Company not found');

  company.documents = company.documents || {};
  company.documents.kycStatus = 'verified';
  company.documents.verifiedAt = new Date();
  company.documents.verifiedBy = req.user?.id;
  company.verificationStatus = 'approved';
  company.isVerified = true;
  company.status = 'active';
  await company.save();
  return ok(res, company.documents);
}));

router.post('/admin/kyc/:companyId/reject', requireAdminKey, asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason || reason.trim().length < 3) return fail(res, 400, 'REASON_REQUIRED', 'Reason required');

  const company = await InsuranceCompany.findById(req.params.companyId);
  if (!company) return fail(res, 404, 'NOT_FOUND', 'Company not found');

  company.documents = company.documents || {};
  company.documents.kycStatus = 'rejected';
  company.documents.rejectionReason = reason.trim();
  await company.save();
  return ok(res, company.documents);
}));

// ============================================
// ADMIN — CORPORATE
// ============================================

router.get('/admin/corporate/pending', requireAdminKey, asyncHandler(async (req, res) => {
  const plans = await InsurancePlan.find({ isCorporate: true, isVerified: false })
    .populate('companyId', 'companyName').lean();
  return ok(res, plans);
}));

// ============================================
// COMPANY — ADVERTISING
// ============================================

router.get('/company/ads/wallet', auth, checkInsurer, asyncHandler(async (req, res) => {
  const company = await InsuranceCompany.findById(req.insuranceCompany._id).select('adWallet adSettings');
  return ok(res, {
    wallet: company.adWallet || { balance: 0, currency: 'INR', totalSpent: 0 },
    settings: company.adSettings || {}
  });
}));

router.post('/company/ads/wallet/topup', auth, checkInsurer, asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return fail(res, 400, 'INVALID_AMOUNT', 'Amount must be positive');

  const company = await InsuranceCompany.findById(req.insuranceCompany._id);
  company.adWallet = company.adWallet || { balance: 0, currency: 'INR', totalSpent: 0 };
  company.adWallet.balance = (company.adWallet.balance || 0) + amt;
  company.adWallet.lastToppedUpAt = new Date();
  await company.save();

  return ok(res, { newBalance: company.adWallet.balance });
}));

router.get('/company/ads/campaigns', auth, checkInsurer, asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const query = { companyId: req.insuranceCompany._id };
  if (status && status !== 'all') query.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [campaigns, total] = await Promise.all([
    InsuranceCampaign.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    InsuranceCampaign.countDocuments(query)
  ]);
  return ok(res, campaigns, {
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
  });
}));

router.post('/company/ads/campaigns', auth, checkInsurer, asyncHandler(async (req, res) => {
  const {
    name, description, type, planIds, placements, billingModel, rateCard,
    budget, startDate, endDate, targetAudience, creative
  } = req.body;

  if (!name || !type || !billingModel) {
    return fail(res, 400, 'MISSING_FIELDS', 'name, type, billingModel required');
  }

  const campaign = new InsuranceCampaign({
    companyId: req.insuranceCompany._id,
    name: name.trim(),
    description: description || '',
    type,
    planIds: planIds || [],
    placements: placements || ['search_results'],
    billingModel,
    rateCard: rateCard || {},
    budget: { total: budget?.total || 0, daily: budget?.daily || 0, spent: 0, currency: 'INR' },
    startDate: startDate ? new Date(startDate) : new Date(),
    endDate: endDate ? new Date(endDate) : null,
    targetAudience: targetAudience || {},
    creative: creative || {},
    status: 'pending_approval',
    metrics: { impressions: 0, clicks: 0, leads: 0, conversions: 0, spend: 0 }
  });
  await campaign.save();
  return ok(res, campaign);
}));

router.post('/company/ads/campaigns/:id/pause', auth, checkInsurer, asyncHandler(async (req, res) => {
  const campaign = await InsuranceCampaign.findOne({ _id: req.params.id, companyId: req.insuranceCompany._id });
  if (!campaign) return fail(res, 404, 'NOT_FOUND', 'Campaign not found');
  campaign.status = 'paused';
  await campaign.save();
  return ok(res, campaign);
}));

router.post('/company/ads/campaigns/:id/resume', auth, checkInsurer, asyncHandler(async (req, res) => {
  const campaign = await InsuranceCampaign.findOne({ _id: req.params.id, companyId: req.insuranceCompany._id });
  if (!campaign) return fail(res, 404, 'NOT_FOUND', 'Campaign not found');
  if (campaign.status === 'paused') campaign.status = 'active';
  await campaign.save();
  return ok(res, campaign);
}));

router.delete('/company/ads/campaigns/:id', auth, checkInsurer, asyncHandler(async (req, res) => {
  const campaign = await InsuranceCampaign.findOneAndDelete({ _id: req.params.id, companyId: req.insuranceCompany._id, status: 'draft' });
  if (!campaign) return fail(res, 404, 'NOT_FOUND', 'Draft campaign not found');
  return ok(res, { deleted: true });
}));

router.get('/company/ads/analytics', auth, checkInsurer, asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const match = { companyId: req.insuranceCompany._id };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const agg = await InsuranceAdEvent.aggregate([
    { $match: match },
    { $group: {
      _id: '$eventType',
      count: { $sum: 1 },
      cost: { $sum: '$cost' }
    }}
  ]);

  const summary = {
    impressions: 0, clicks: 0, leads: 0, conversions: 0, spend: 0,
    ctr: 0, cpl: 0, cpa: 0
  };
  agg.forEach(r => {
    if (summary[r._id] !== undefined) summary[r._id] = r.count;
    summary.spend += r.cost || 0;
  });
  if (summary.impressions > 0) summary.ctr = (summary.clicks / summary.impressions * 100).toFixed(2);
  if (summary.leads > 0) summary.cpl = (summary.spend / summary.leads).toFixed(2);
  if (summary.conversions > 0) summary.cpa = (summary.spend / summary.conversions).toFixed(2);

  return ok(res, summary);
}));

// ============================================
// PUBLIC — AD TRACKING
// ============================================

router.get('/ads/active', asyncHandler(async (req, res) => {
  const { placement = 'search_results', city, planType } = req.query;
  const query = {
    status: 'active',
    placements: placement,
    startDate: { $lte: new Date() },
    $or: [{ endDate: null }, { endDate: { $gte: new Date() } }]
  };
  if (city) query['targetAudience.cities'] = city;
  if (planType) query['targetAudience.planTypes'] = planType;

  const campaigns = await InsuranceCampaign.find(query)
    .select('name type creative companyId rateCard billingModel placements')
    .populate('companyId', 'companyName logo')
    .limit(10).lean();

  return ok(res, campaigns);
}));

router.post('/ads/impression', asyncHandler(async (req, res) => {
  const { campaignId, placement, sessionId } = req.body;
  if (!campaignId) return fail(res, 400, 'MISSING', 'campaignId required');

  const campaign = await InsuranceCampaign.findById(campaignId);
  if (!campaign || campaign.status !== 'active') return ok(res, { tracked: false });

  const cost = campaign.billingModel === 'cpm' ? (campaign.rateCard?.cpm || 0) / 1000 : 0;

  await InsuranceAdEvent.create({
    campaignId, companyId: campaign.companyId,
    eventType: 'impression', placement, sessionId,
    cost,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  campaign.metrics.impressions = (campaign.metrics.impressions || 0) + 1;
  campaign.metrics.spend = (campaign.metrics.spend || 0) + cost;
  await campaign.save();

  return ok(res, { tracked: true });
}));

router.post('/ads/click', asyncHandler(async (req, res) => {
  const { campaignId, placement, sessionId } = req.body;
  if (!campaignId) return fail(res, 400, 'MISSING', 'campaignId required');

  const campaign = await InsuranceCampaign.findById(campaignId);
  if (!campaign || campaign.status !== 'active') return ok(res, { tracked: false });

  const cost = campaign.billingModel === 'cpc' ? (campaign.rateCard?.cpc || 0) : 0;

  await InsuranceAdEvent.create({
    campaignId, companyId: campaign.companyId,
    eventType: 'click', placement, sessionId,
    cost, ip: req.ip, userAgent: req.headers['user-agent']
  });

  campaign.metrics.clicks = (campaign.metrics.clicks || 0) + 1;
  campaign.metrics.spend = (campaign.metrics.spend || 0) + cost;
  await campaign.save();

  // Deduct from wallet
  await InsuranceCompany.updateOne(
    { _id: campaign.companyId },
    { $inc: { 'adWallet.balance': -cost, 'adWallet.totalSpent': cost } }
  );

  return ok(res, { tracked: true, cost });
}));

// ============================================
// ADMIN — ADVERTISING
// ============================================

router.get('/admin/ads/campaigns', requireAdminKey, asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 30 } = req.query;
  const query = {};
  if (status && status !== 'all') query.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [campaigns, total] = await Promise.all([
    InsuranceCampaign.find(query)
      .populate('companyId', 'companyName')
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    InsuranceCampaign.countDocuments(query)
  ]);
  return ok(res, campaigns, {
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
  });
}));

router.post('/admin/ads/campaigns/:id/approve', requireAdminKey, asyncHandler(async (req, res) => {
  const campaign = await InsuranceCampaign.findById(req.params.id);
  if (!campaign) return fail(res, 404, 'NOT_FOUND', 'Campaign not found');
  campaign.status = 'active';
  campaign.approvedAt = new Date();
  campaign.approvedBy = req.user?.id;
  await campaign.save();
  return ok(res, campaign);
}));

router.post('/admin/ads/campaigns/:id/reject', requireAdminKey, asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason) return fail(res, 400, 'REASON_REQUIRED', 'Reason required');

  const campaign = await InsuranceCampaign.findById(req.params.id);
  if (!campaign) return fail(res, 404, 'NOT_FOUND', 'Campaign not found');
  campaign.status = 'rejected';
  campaign.rejectionReason = reason;
  await campaign.save();
  return ok(res, campaign);
}));

router.post('/admin/ads/campaigns/:id/pause', requireAdminKey, asyncHandler(async (req, res) => {
  const campaign = await InsuranceCampaign.findById(req.params.id);
  if (!campaign) return fail(res, 404, 'NOT_FOUND', 'Campaign not found');
  campaign.status = 'paused';
  await campaign.save();
  return ok(res, campaign);
}));

router.get('/admin/ads/revenue', requireAdminKey, asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const match = {};
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const totalAgg = await InsuranceAdEvent.aggregate([
    { $match: match },
    { $group: { _id: null, totalRevenue: { $sum: '$cost' }, totalEvents: { $sum: 1 } } }
  ]);

  const byCompany = await InsuranceAdEvent.aggregate([
    { $match: match },
    { $group: { _id: '$companyId', revenue: { $sum: '$cost' }, events: { $sum: 1 } } },
    { $lookup: { from: 'insurancecompanies', localField: '_id', foreignField: '_id', as: 'company' } },
    { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
    { $project: { companyName: '$company.companyName', revenue: 1, events: 1 } },
    { $sort: { revenue: -1 } }
  ]);

  const byPlacement = await InsuranceAdEvent.aggregate([
    { $match: match },
    { $group: { _id: '$placement', revenue: { $sum: '$cost' }, events: { $sum: 1 } } },
    { $sort: { revenue: -1 } }
  ]);

  return ok(res, {
    total: totalAgg[0] || { totalRevenue: 0, totalEvents: 0 },
    byCompany, byPlacement
  });
}));

module.exports = router;
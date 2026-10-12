// D:\hospital backend\routes\insurance-policy-center.js
// ============================================
// INSURANCE POLICY CENTER
// Renewal • Servicing • Free-look • Portability
// Mount: app.use('/api/insurance-policy-center', ...)
// ============================================

const express = require('express');
const router = express.Router();

require('../models/User');
const InsurancePolicy = require('../models/InsurancePolicy');
const InsurancePlan = require('../models/InsurancePlan');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const { authenticate } = require('../middleware/auth');
const { calculateRenewalPremium } = require('../services/insurancePremiumEngine');

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
// GET /renewal-quote/:policyId
// ============================================
router.get('/renewal-quote/:policyId', authenticate, asyncHandler(async (req, res) => {
  const policy = await InsurancePolicy.findOne({ _id: req.params.policyId, userId: String(uid(req)) });
  if (!policy) return fail(res, 404, 'NOT_FOUND', 'Policy not found');

  const plan = await InsurancePlan.findById(policy.planId).lean();
  if (!plan) return fail(res, 404, 'NOT_FOUND', 'Plan no longer available');

  const members = (policy.members || []).map((m) => ({
    relation: m.relation, age: m.age, gender: m.gender,
    smoker: !!m.isSmoker, preExisting: [],
  }));

  let quote = { total: policy.totalAmount, base: policy.premiumAmount, gst: policy.gstAmount, monthly: Math.round(policy.totalAmount / 12) };

  try {
    const calc = calculateRenewalPremium({
      plan, members,
      sumInsured: policy.sumInsured,
      addonCodes: (policy.selectedAddons || []).map((a) => a.name),
      previousPremium: policy.totalAmount,
    });
    quote = calc;
  } catch (e) {
    // Fallback: 8% inflation on previous premium
    const inflated = Math.round(policy.totalAmount * 1.08);
    quote = { total: inflated, base: Math.round(inflated / 1.18), gst: Math.round(inflated - inflated / 1.18), monthly: Math.round(inflated / 12) };
  }

  return ok(res, {
    policyId: policy._id,
    policyNumber: policy.policyNumber,
    currentCover: policy.sumInsured,
    currentPremium: policy.totalAmount,
    renewalPremium: quote.total,
    quote,
    expiresAt: policy.endDate,
    gracePeriodEnd: policy.gracePeriodEnd,
  });
}));

// ============================================
// POST /renew/:policyId
// Body: { sumInsured? }
// ============================================
router.post('/renew/:policyId', authenticate, asyncHandler(async (req, res) => {
  const policy = await InsurancePolicy.findOne({ _id: req.params.policyId, userId: String(uid(req)) });
  if (!policy) return fail(res, 404, 'NOT_FOUND', 'Policy not found');

  if (policy.status === 'cancelled') {
    return fail(res, 400, 'CANCELLED_POLICY', 'Cannot renew a cancelled policy');
  }

  const plan = await InsurancePlan.findById(policy.planId).lean();
  if (!plan) return fail(res, 404, 'NOT_FOUND', 'Plan no longer available');

  const members = (policy.members || []).map((m) => ({
    relation: m.relation, age: m.age, gender: m.gender,
    smoker: !!m.isSmoker, preExisting: [],
  }));

  const newCover = Number(req.body.sumInsured) || policy.sumInsured;

  let quote;
  try {
    quote = calculateRenewalPremium({
      plan, members, sumInsured: newCover,
      addonCodes: (policy.selectedAddons || []).map((a) => a.name),
      previousPremium: policy.totalAmount,
    });
  } catch (e) {
    const inflated = Math.round(policy.totalAmount * 1.08);
    quote = { total: inflated, base: Math.round(inflated / 1.18), gst: Math.round(inflated - inflated / 1.18), monthly: Math.round(inflated / 12) };
  }

  const userId = uid(req);
  const prevStart = policy.startDate;
  const prevEnd = policy.endDate;
  const startDate = new Date(prevEnd);
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);

  const booking = new Booking({
    userId, bookingType: 'insurance',
    bookingDate: new Date(), amount: quote.total,
    status: 'pending', paymentStatus: 'pending',
    insurancePlanId: plan._id, insuranceCompanyId: plan.companyId,
  });
  await booking.save();

  const transaction = new Transaction({
    userId, bookingId: booking._id, bookingType: 'insurance',
    amount: quote.total, status: 'initiated', providerId: plan.companyId,
  });
  await transaction.save();

  policy.startDate = startDate;
  policy.endDate = endDate;
  policy.sumInsured = newCover;
  policy.premiumAmount = quote.base;
  policy.gstAmount = quote.gst;
  policy.totalAmount = quote.total;
  policy.status = 'active';
  policy.paymentStatus = 'paid';
  policy.renewalDate = new Date();

  policy.renewals = policy.renewals || [];
  policy.renewals.push({
    policyNumber: policy.policyNumber,
    startDate: prevStart,
    endDate: prevEnd,
    premiumAmount: quote.total,
    transactionId: transaction._id.toString(),
    renewedAt: new Date(),
  });

  policy.paymentHistory = policy.paymentHistory || [];
  policy.paymentHistory.push({
    transactionId: transaction._id.toString(),
    amount: quote.total, paymentMethod: 'razorpay',
    paymentDate: new Date(), status: 'paid',
  });

  await policy.save();

  booking.insurancePolicyId = policy._id;
  booking.paymentStatus = 'paid';
  booking.status = 'confirmed';
  await booking.save();

  return ok(res, { policy, booking, transaction, renewalQuote: quote });
}));

// ============================================
// POST /service/:policyId
// Body: { action, data }
// ============================================
router.post('/service/:policyId', authenticate, asyncHandler(async (req, res) => {
  const { action, data = {} } = req.body;
  if (!action) return fail(res, 400, 'MISSING_ACTION', 'action required');

  const policy = await InsurancePolicy.findOne({ _id: req.params.policyId, userId: String(uid(req)) });
  if (!policy) return fail(res, 404, 'NOT_FOUND', 'Policy not found');

  if (policy.status === 'cancelled') {
    return fail(res, 400, 'CANCELLED_POLICY', 'Cannot service a cancelled policy');
  }

  const now = new Date();

  switch (action) {
    case 'change_nominee': {
      if (!data.name || !data.relationship) {
        return fail(res, 400, 'INVALID', 'Nominee name + relationship required');
      }
      policy.nominee = {
        name: data.name,
        relation: data.relationship,
        age: data.age,
        contactNumber: data.phone,
        address: data.address,
      };
      break;
    }

    case 'add_member': {
      const m = data.member;
      if (!m || !m.name || !m.relation || !m.age) {
        return fail(res, 400, 'INVALID', 'member.name, relation, age required');
      }
      const plan = await InsurancePlan.findById(policy.planId).lean();
      const maxMembers = plan?.maxMembers || 6;
      if ((policy.members || []).length >= maxMembers) {
        return fail(res, 400, 'MAX_MEMBERS', `Plan allows max ${maxMembers} members`);
      }
      policy.members.push({
        name: m.name, relation: m.relation, age: m.age, gender: m.gender,
        dateOfBirth: m.dateOfBirth, isSmoker: !!m.isSmoker, isPrimary: false,
      });
      break;
    }

    case 'remove_member': {
      const memberId = data.memberId;
      if (!memberId) return fail(res, 400, 'INVALID', 'memberId required');
      const before = (policy.members || []).length;
      policy.members = policy.members.filter((m) => String(m._id) !== String(memberId));
      if (policy.members.length === before) return fail(res, 404, 'NOT_FOUND', 'Member not found');
      if (policy.members.length === 0) return fail(res, 400, 'LAST_MEMBER', 'Cannot remove last member');
      break;
    }

    case 'change_address': {
      policy.policyAddress = data.address || '';
      break;
    }

    case 'endorsement': {
      policy.endorsementRequests = policy.endorsementRequests || [];
      policy.endorsementRequests.push({
        requestedAt: now,
        type: data.endorsementType || 'general',
        notes: data.notes || '',
        status: 'pending',
      });
      break;
    }

    default:
      return fail(res, 400, 'UNKNOWN_ACTION', `Unknown action: ${action}`);
  }

  policy.serviceHistory = policy.serviceHistory || [];
  policy.serviceHistory.push({ action, data, at: now, by: uid(req) });

  await policy.save();
  return ok(res, policy);
}));

// ============================================
// GET /service-history/:policyId
// ============================================
router.get('/service-history/:policyId', authenticate, asyncHandler(async (req, res) => {
  const policy = await InsurancePolicy.findOne({ _id: req.params.policyId, userId: String(uid(req)) })
    .select('serviceHistory endorsementRequests renewals').lean();
  if (!policy) return fail(res, 404, 'NOT_FOUND', 'Policy not found');
  return ok(res, {
    serviceHistory: policy.serviceHistory || [],
    endorsementRequests: policy.endorsementRequests || [],
    renewals: policy.renewals || [],
  });
}));

// ============================================
// POST /free-look-cancel/:policyId
// Within 15 days — full refund
// ============================================
router.post('/free-look-cancel/:policyId', authenticate, asyncHandler(async (req, res) => {
  const policy = await InsurancePolicy.findOne({ _id: req.params.policyId, userId: String(uid(req)) });
  if (!policy) return fail(res, 404, 'NOT_FOUND', 'Policy not found');

  const daysSinceStart = Math.floor((Date.now() - new Date(policy.startDate).getTime()) / (24 * 60 * 60 * 1000));
  if (daysSinceStart > 15) {
    return fail(res, 400, 'FREE_LOOK_EXPIRED', 'Free-look period (15 days) has passed');
  }
  if (policy.status === 'cancelled') {
    return fail(res, 400, 'ALREADY_CANCELLED', 'Policy already cancelled');
  }

  policy.status = 'cancelled';
  policy.cancellationReason = req.body.reason || 'Free-look cancellation';
  policy.cancellationDate = new Date();
  policy.refundAmount = policy.totalAmount;
  policy.paymentStatus = 'refunded';
  policy.serviceHistory = policy.serviceHistory || [];
  policy.serviceHistory.push({
    action: 'free_look_cancel',
    data: { reason: req.body.reason, refundAmount: policy.totalAmount },
    at: new Date(), by: uid(req),
  });
  await policy.save();

  return ok(res, { policy, refundAmount: policy.totalAmount, message: 'Free-look cancellation processed.' });
}));

// ============================================
// POST /portability-request/:policyId
// Must file 30+ days before renewal
// ============================================
router.post('/portability-request/:policyId', authenticate, asyncHandler(async (req, res) => {
  const policy = await InsurancePolicy.findOne({ _id: req.params.policyId, userId: String(uid(req)) });
  if (!policy) return fail(res, 404, 'NOT_FOUND', 'Policy not found');

  if (policy.status !== 'active') {
    return fail(res, 400, 'POLICY_NOT_ACTIVE', 'Only active policies can be ported');
  }

  const daysToExpiry = Math.floor((new Date(policy.endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysToExpiry < 30) {
    return fail(res, 400, 'TOO_LATE', 'Portability must be filed at least 30 days before renewal');
  }

  policy.portabilityRequests = policy.portabilityRequests || [];
  policy.portabilityRequests.push({
    requestedAt: new Date(),
    preferredInsurer: req.body.preferredInsurerId || null,
    reason: req.body.reason || '',
    status: 'submitted',
  });
  await policy.save();

  return ok(res, { policy, message: 'Portability request submitted.' });
}));

module.exports = router;
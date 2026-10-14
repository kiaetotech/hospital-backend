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

    const primaryMember = (policy.members || [])[0] || {};
  const booking = new Booking({
    userId: String(userId),
    bookingType: 'insurance',
    patientName: policy.primaryInsured?.name || primaryMember.name || 'Policyholder',
    patientPhone: '0000000000',
    patientEmail: 'noreply@hospitalhub.in',
    patientAge: policy.primaryInsured?.age || primaryMember.age,
    patientGender: policy.primaryInsured?.gender || primaryMember.gender,
    bookingDate: new Date(),
    appointmentDate: startDate,
    originalAmount: quote.total,
    discount: 0,
    finalAmount: quote.total,
    paymentStatus: 'paid',
    status: 'policy_issued',
    providerId: plan.companyId,
    providerName: 'Insurance Company',
    platformCommission: 0,
    providerCommission: quote.total,
    commissionStatus: 'pending',
    insurancePlanId: plan._id,
    insuranceCompanyName: 'Insurance Company',
    insurancePlanName: plan.planName,
    sumInsured: newCover,
    premiumAmount: quote.total,
    insuranceMembers: (policy.members || []).map((m) => ({
      name: m.name, relation: m.relation, age: m.age, gender: m.gender,
    })),
    policyStartDate: startDate,
    policyEndDate: endDate,
    policyRenewalDate: endDate,
    insuranceSettlementStatus: 'pending',
    bookingId: 'INS' + Date.now() + Math.random().toString(36).slice(2, 5).toUpperCase(),
    location: { type: 'Point', coordinates: [0, 0] },
  });
  await booking.save();

    const transaction = new Transaction({
    transactionId: typeof Transaction.generateTransactionId === 'function'
      ? Transaction.generateTransactionId()
      : 'TXN' + Date.now() + Math.random().toString(36).slice(2, 8).toUpperCase(),
    applicationId: booking._id.toString(),
    lenderId: plan.companyId ? plan.companyId.toString() : null,
    type: 'booking_payment',
    amount: quote.total,
    commissionAmount: 0,
    status: 'completed',
    paymentGateway: 'internal',
    bookingId: booking._id,
    bookingType: 'insurance',
    userId: String(userId),
    providerId: plan.companyId,
    originalAmount: quote.total,
    netAmount: quote.total,
    platformCommission: 0,
    providerAmount: quote.total,
    commissionStatus: 'pending',
    settledToProvider: false,
    insurancePolicyId: policy._id,
    insurancePlanId: plan._id,
    premiumAmount: quote.total,
    gstAmount: quote.gst,
    totalPremium: quote.total,
    insuranceCommissionRate: 0,
    insurancePlatformCommission: 0,
    insurancePayoutToCompany: quote.total,
    insuranceSettlementStatus: 'pending',
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

  // Portability does NOT change policy status — coverage continues until renewal
  // We only add a tracking flag
  policy.serviceHistory = policy.serviceHistory || [];
  policy.serviceHistory.push({
    action: 'portability_requested',
    data: { reason: req.body.reason, preferredInsurer: req.body.preferredInsurerId },
    at: new Date(),
    by: uid(req),
  });

  await policy.save();

  return ok(res, { policy, message: 'Portability request submitted.' });
}));

// ============================================
// POST /renewal/create-order/:policyId — Razorpay order for renewal
// ============================================
router.post('/renewal/create-order/:policyId', authenticate, asyncHandler(async (req, res) => {
  const policy = await InsurancePolicy.findOne({ _id: req.params.policyId, userId: String(uid(req)) });
  if (!policy) return fail(res, 404, 'NOT_FOUND', 'Policy not found');
  if (policy.status === 'cancelled') return fail(res, 400, 'CANCELLED', 'Cannot renew a cancelled policy');

  const plan = await InsurancePlan.findById(policy.planId).lean();
  if (!plan) return fail(res, 404, 'NOT_FOUND', 'Plan not available');

  const members = (policy.members || []).map((m) => ({
    relation: m.relation, age: m.age, gender: m.gender,
    smoker: !!m.isSmoker, preExisting: [],
  }));

  let quote;
  try {
    quote = calculateRenewalPremium({
      plan, members, sumInsured: policy.sumInsured,
      addonCodes: (policy.selectedAddons || []).map((a) => a.name),
      previousPremium: policy.totalAmount,
    });
  } catch (e) {
    const inflated = Math.round(policy.totalAmount * 1.08);
    quote = { total: inflated, base: Math.round(inflated / 1.18), gst: Math.round(inflated - inflated / 1.18), monthly: Math.round(inflated / 12) };
  }

  const razorpayService = require('../services/razorpayService');
  const receipt = 'RENEW_' + policy._id.toString().slice(-12);

  let orderResult;
  try {
    orderResult = await razorpayService.createOrder(
      Math.round(quote.total * 100) / 100,
      'INR',
      receipt,
      { policyId: policy._id.toString(), userId: String(uid(req)) }
    );
  } catch (e) {
    return fail(res, 502, 'RAZORPAY_ERROR', 'Payment gateway unavailable: ' + e.message);
  }

  if (!orderResult?.success || !orderResult.order?.id) {
    return fail(res, 502, 'ORDER_FAILED', 'Unable to create payment order');
  }

  return ok(res, {
    orderId: orderResult.order.id,
    amount: quote.total,
    currency: 'INR',
    razorpayKey: process.env.RAZORPAY_KEY_ID,
    quote,
  });
}));

// ============================================
// POST /renewal/verify-payment/:policyId — verify + execute renewal
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// ============================================
router.post('/renewal/verify-payment/:policyId', authenticate, asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return fail(res, 400, 'MISSING_FIELDS', 'razorpay_order_id, razorpay_payment_id, razorpay_signature required');
  }

  const policy = await InsurancePolicy.findOne({ _id: req.params.policyId, userId: String(uid(req)) });
  if (!policy) return fail(res, 404, 'NOT_FOUND', 'Policy not found');

  // Verify signature inline (matches Ayurveda pattern)
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return fail(res, 400, 'INVALID_SIGNATURE', 'Payment signature verification failed');
  }

  const plan = await InsurancePlan.findById(policy.planId).lean();
  if (!plan) return fail(res, 404, 'NOT_FOUND', 'Plan not available');

  const members = (policy.members || []).map((m) => ({
    relation: m.relation, age: m.age, gender: m.gender,
    smoker: !!m.isSmoker, preExisting: [],
  }));

  let quote;
  try {
    quote = calculateRenewalPremium({
      plan, members, sumInsured: policy.sumInsured,
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

  const primaryMember = (policy.members || [])[0] || {};
  const booking = new Booking({
    userId: String(userId),
    bookingType: 'insurance',
    patientName: policy.primaryInsured?.name || primaryMember.name || 'Policyholder',
    patientPhone: '0000000000',
    patientEmail: 'noreply@hospitalhub.in',
    patientAge: policy.primaryInsured?.age || primaryMember.age,
    patientGender: policy.primaryInsured?.gender || primaryMember.gender,
    bookingDate: new Date(),
    appointmentDate: startDate,
    originalAmount: quote.total,
    discount: 0,
    finalAmount: quote.total,
    paymentStatus: 'paid',
    status: 'policy_issued',
    providerId: plan.companyId,
    providerName: 'Insurance Company',
    platformCommission: 0,
    providerCommission: quote.total,
    commissionStatus: 'pending',
    insurancePlanId: plan._id,
    insuranceCompanyName: 'Insurance Company',
    insurancePlanName: plan.planName,
    sumInsured: policy.sumInsured,
    premiumAmount: quote.total,
    insuranceMembers: (policy.members || []).map((m) => ({
      name: m.name, relation: m.relation, age: m.age, gender: m.gender,
    })),
    policyStartDate: startDate,
    policyEndDate: endDate,
    policyRenewalDate: endDate,
    insuranceSettlementStatus: 'pending',
    bookingId: 'INS' + Date.now() + Math.random().toString(36).slice(2, 5).toUpperCase(),
    location: { type: 'Point', coordinates: [0, 0] },
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    paymentId: razorpay_payment_id,
    orderId: razorpay_order_id,
  });
  await booking.save();

  const transaction = new Transaction({
    transactionId: typeof Transaction.generateTransactionId === 'function'
      ? Transaction.generateTransactionId()
      : 'TXN' + Date.now() + Math.random().toString(36).slice(2, 8).toUpperCase(),
    applicationId: booking._id.toString(),
    lenderId: plan.companyId ? plan.companyId.toString() : null,
    type: 'booking_payment',
    amount: quote.total,
    commissionAmount: 0,
    status: 'completed',
    paymentGateway: 'razorpay',
    gatewayReferenceId: razorpay_order_id,
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    paidAt: new Date(),
    completedAt: new Date(),
    bookingId: booking._id,
    bookingType: 'insurance',
    userId: String(userId),
    providerId: plan.companyId,
    originalAmount: quote.total,
    netAmount: quote.total,
    platformCommission: 0,
    providerAmount: quote.total,
    commissionStatus: 'pending',
    settledToProvider: false,
    insurancePolicyId: policy._id,
    insurancePlanId: plan._id,
    premiumAmount: quote.total,
    gstAmount: quote.gst,
    totalPremium: quote.total,
    insuranceCommissionRate: 0,
    insurancePlatformCommission: 0,
    insurancePayoutToCompany: quote.total,
    insuranceSettlementStatus: 'pending',
  });
  await transaction.save();

  policy.startDate = startDate;
  policy.endDate = endDate;
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
    amount: quote.total,
    paymentMethod: 'razorpay',
    paymentDate: new Date(),
    status: 'paid',
  });

  await policy.save();

  booking.insurancePolicyId = policy._id;
  await booking.save();

  return ok(res, { policy, booking, transaction, renewalQuote: quote });
}));

// ============================================
// GET /cancellation-quote/:policyId
// Returns refund breakdown based on policy wording
// ============================================
router.get('/cancellation-quote/:policyId', authenticate, asyncHandler(async (req, res) => {
  const policy = await InsurancePolicy.findOne({ _id: req.params.policyId, userId: String(uid(req)) });
  if (!policy) return fail(res, 404, 'NOT_FOUND', 'Policy not found');

  if (policy.status !== 'active') {
    return fail(res, 400, 'POLICY_NOT_ACTIVE', 'Only active policies can be cancelled');
  }

  const plan = await InsurancePlan.findById(policy.planId).lean();
  if (!plan) return fail(res, 404, 'NOT_FOUND', 'Plan not found');

  const cp = plan.cancellationPolicy || {};
  const after = cp.afterFreeLook || {};

  const daysSinceStart = Math.floor((Date.now() - new Date(policy.startDate).getTime()) / (24 * 60 * 60 * 1000));
  const freeLookDays = cp.freeLookDays || 15;
  const withinFreeLook = daysSinceStart <= freeLookDays;

  const premiumPaid = policy.totalAmount || policy.premiumAmount || 0;
  let refundAmount = 0;
  let refundPercent = 0;
  let breakdown = {
    premiumPaid,
    daysSinceStart,
    freeLookDays,
    withinFreeLook,
  };

  if (withinFreeLook) {
    // Free-look: 100% minus admin + medical
    const adminFee = cp.freeLookAdminFee || 0;
    const medFee = cp.freeLookMedicalExamFee || 0;
    const flPercent = cp.freeLookRefundPercent || 100;
    const baseRefund = Math.round((premiumPaid * flPercent) / 100);
    refundAmount = Math.max(0, baseRefund - adminFee - medFee);
    refundPercent = premiumPaid > 0 ? Math.round((refundAmount / premiumPaid) * 1000) / 10 : 0;

    breakdown.mode = 'free_look';
    breakdown.freeLookRefundPercent = flPercent;
    breakdown.adminFee = adminFee;
    breakdown.medicalExamFee = medFee;
    breakdown.baseRefund = baseRefund;
  } else {
    // After free-look: use insurer's config
    if (!after.refundType || after.refundType === 'none') {
      refundAmount = 0;
      refundPercent = 0;
      breakdown.mode = 'none';
      breakdown.note = 'No refund after free-look period as per policy wording.';
    } else if (after.refundType === 'pro_rata') {
      const totalDays = Math.max(1, Math.floor((new Date(policy.endDate).getTime() - new Date(policy.startDate).getTime()) / (24 * 60 * 60 * 1000)));
      const unusedDays = Math.max(0, totalDays - daysSinceStart);
      const proRataRefund = Math.round((premiumPaid * unusedDays) / totalDays);
      const configPercent = after.refundPercent != null ? after.refundPercent : 100;
      const afterConfig = Math.round((proRataRefund * configPercent) / 100);
      const fee = after.cancellationFee || 0;
      refundAmount = Math.max(0, afterConfig - fee);
      refundPercent = premiumPaid > 0 ? Math.round((refundAmount / premiumPaid) * 1000) / 10 : 0;

      breakdown.mode = 'pro_rata';
      breakdown.totalPolicyDays = totalDays;
      breakdown.unusedDays = unusedDays;
      breakdown.proRataRefund = proRataRefund;
      breakdown.configPercent = configPercent;
      breakdown.cancellationFee = fee;
    } else if (after.refundType === 'slab') {
      const monthsUsed = daysSinceStart / 30;
      const slabs = (after.slabs || []).sort((a, b) => a.uptoMonths - b.uptoMonths);
      let slabPercent = 0;
      let matchedSlab = null;
      for (const s of slabs) {
        if (monthsUsed <= s.uptoMonths) { slabPercent = s.percent; matchedSlab = s; break; }
      }
      const fee = after.cancellationFee || 0;
      refundAmount = Math.max(0, Math.round((premiumPaid * slabPercent) / 100) - fee);
      refundPercent = premiumPaid > 0 ? Math.round((refundAmount / premiumPaid) * 1000) / 10 : 0;

      breakdown.mode = 'slab';
      breakdown.monthsUsed = Math.round(monthsUsed * 10) / 10;
      breakdown.appliedSlab = matchedSlab;
      breakdown.cancellationFee = fee;
    }

    // Claims impact
    if (after.claimsImpact === 'zero_refund' && (policy.claims || []).length > 0) {
      refundAmount = 0;
      refundPercent = 0;
      breakdown.mode = 'zero_due_to_claims';
      breakdown.note = 'No refund because claims exist on this policy.';
    } else if (after.claimsImpact === 'reduce_refund' && (policy.claims || []).length > 0) {
      refundAmount = Math.round(refundAmount * 0.5);
      refundPercent = premiumPaid > 0 ? Math.round((refundAmount / premiumPaid) * 1000) / 10 : 0;
      breakdown.claimsReduction = true;
      breakdown.note = 'Refund reduced by 50% because claims exist on this policy.';
    }
  }

  return ok(res, {
    policyId: policy._id,
    policyNumber: policy.policyNumber,
    premiumPaid,
    refundAmount,
    refundPercent,
    breakdown,
  });
}));

module.exports = router;
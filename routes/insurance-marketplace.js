// D:\hospital backend\routes\insurance-marketplace.js
// ============================================
// INSURANCE MARKETPLACE ROUTES
// Public:   plans, compare, quote, addons
// Patient:  apply stepper (auth required)
// Mount:    app.use('/api/insurance-marketplace', ...)
// ============================================

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

require('../models/User');

const InsurancePlan = require('../models/InsurancePlan');
const InsuranceCompany = require('../models/InsuranceCompany');
const InsurancePolicy = require('../models/InsurancePolicy');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');

const {
  InsuranceAddon,
  InsuranceProposal,
} = require('../models/InsuranceMarketplace');

const { authenticate } = require('../middleware/auth');
const { calculatePremium } = require('../services/insurancePremiumEngine');


// ============================================
// MODEL REGISTRY GUARD
// server.js clears mongoose.models on connect.
// Re-register needed models at request time so populate() works.
// ============================================
function ensureModels() {
  const mongoose = require('mongoose');

  // If User is registered, assume all models are — done.
  if (mongoose.models.User) return;

  const paths = [
    '../models/User',
    '../models/InsurancePlan',
    '../models/InsuranceCompany',
    '../models/InsurancePolicy',
    '../models/Booking',
    '../models/Transaction',
    '../models/InsuranceMarketplace',
  ];

  for (const p of paths) {
    try {
      // Clear require cache so the file re-executes and calls mongoose.model(...) again
      const resolved = require.resolve(p);
      delete require.cache[resolved];
      require(p);
    } catch (e) {
      console.warn('[ensureModels] failed:', p, e.message);
    }
  }
}

// ============================================
// HELPERS
// ============================================
function ok(res, data, meta = {}) {
  return res.json({
    success: true,
    data,
    meta: { ...meta, timestamp: new Date().toISOString() },
  });
}
function fail(res, status, code, message, details = {}) {
  return res.status(status).json({
    success: false,
    error: { code, message, details },
  });
}
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const uid = (req) => req.user && req.user.id;

// ============================================
// HEALTH
// ============================================
router.get('/health', (req, res) => {
  res.json({
    success: true,
    module: 'Insurance Marketplace',
    status: 'active',
    endpoints: {
      plans: 'GET /api/insurance-marketplace/plans',
      planDetail: 'GET /api/insurance-marketplace/plans/:id',
      compare: 'GET /api/insurance-marketplace/compare?planIds=a,b,c',
      addons: 'GET /api/insurance-marketplace/addons',
      quote: 'POST /api/insurance-marketplace/quote',
      apply: 'POST /api/insurance-marketplace/apply',
    },
  });
});

// ============================================
// GET /plans — public listing with filters
// ============================================
router.get('/plans', asyncHandler(async (req, res) => {
  ensureModels();
  const {
    companyId, planCategory,
    minCover, maxCover, minAge, maxAge,
    maternity, opd, ayush, mentalHealth, cashless,
    pincode, sort = 'recommended',
    page = 1, limit = 20, search,
  } = req.query;

  const query = { isVerified: true, isActive: true };

  if (companyId) query.companyId = companyId;
  if (planCategory) query.planCategory = planCategory;
  if (search) query.planName = { $regex: search, $options: 'i' };

  if (minCover || maxCover) {
    query['coverage.sumInsured'] = {};
    if (minCover) query['coverage.sumInsured'].$gte = Number(minCover);
    if (maxCover) query['coverage.sumInsured'].$lte = Number(maxCover);
  }
  if (minAge) query.maxAge = { $gte: Number(minAge) };
  if (maxAge) query.minAge = { $lte: Number(maxAge) };

  if (maternity === 'true') query['coverage.maternity'] = true;
  if (opd === 'true') query['coverage.opd'] = true;
  if (ayush === 'true') query['coverage.ayush'] = true;
  if (mentalHealth === 'true') query['coverage.psychiatric'] = true;
  if (cashless === 'true') query.networkHospitalCount = { $gte: 5000 };
  if (pincode) {
    query.$or = [
      { availablePincodes: { $size: 0 } },
      { availablePincodes: pincode },
    ];
  }

  let sortSpec = { createdAt: -1 };
  if (sort === 'premium_low') sortSpec = { basePremium: 1 };
  if (sort === 'premium_high') sortSpec = { basePremium: -1 };
  if (sort === 'cover_high') sortSpec = { 'coverage.sumInsured': -1 };
  if (sort === 'recommended') {
    sortSpec = { isFeatured: -1, rating: -1, createdAt: -1 };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [plans, total] = await Promise.all([
    InsurancePlan.find(query)
      .populate('companyId', 'name companyLogo companyName')
      .sort(sortSpec).skip(skip).limit(parseInt(limit)).lean(),
    InsurancePlan.countDocuments(query),
  ]);

  return ok(res, plans, {
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

// ============================================
// GET /plans/:id — full detail
// ============================================
router.get('/plans/:id', asyncHandler(async (req, res) => {
  ensureModels();
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return fail(res, 400, 'INVALID_ID', 'Invalid plan id');
  }
  const plan = await InsurancePlan.findOne({
    _id: req.params.id,
    isVerified: true,
  })
    .populate('companyId', 'name companyLogo companyName companyDescription companyPhone companyEmail')
    .lean();

  if (!plan) return fail(res, 404, 'NOT_FOUND', 'Plan not found');

  // Attach InsuranceCompany profile if available
  if (plan.companyId) {
    const profile = await InsuranceCompany
      .findOne({ userId: plan.companyId._id })
      .select('companyName logo description claimSettlementRatio foundedYear')
      .lean();
    plan.companyProfile = profile || null;
  }

  return ok(res, plan);
}));

// ============================================
// GET /compare?planIds=a,b,c — side-by-side
// ============================================
router.get('/compare', asyncHandler(async (req, res) => {
  ensureModels();
  const ids = String(req.query.planIds || '')
    .split(',').filter(Boolean).slice(0, 3);

  if (ids.length < 2) {
    return fail(res, 400, 'NEED_TWO_PLANS', 'At least 2 planIds required');
  }

  const plans = await InsurancePlan.find({
    _id: { $in: ids },
    isVerified: true,
  })
    .populate('companyId', 'name companyLogo companyName')
    .lean();

  const diffFields = [
    ['basePremium', 'Premium'],
    ['coverage.sumInsured', 'Sum Insured'],
    ['coverage.roomRent', 'Room Rent'],
    ['coverage.icu', 'ICU'],
    ['coverage.restoration', 'Restore'],
    ['coverage.ayush', 'AYUSH'],
    ['coverage.psychiatric', 'Mental Health'],
    ['coverage.opd', 'OPD'],
    ['coverage.maternity', 'Maternity'],
    ['ncb.percentage', 'NCB %'],
    ['waitingPeriods.preExisting', 'PED Waiting (days)'],
    ['networkHospitalCount', 'Network Hospitals'],
    ['limits.coPay', 'Co-pay %'],
    ['limits.deductible', 'Deductible'],
  ];

  const getPath = (obj, path) =>
    path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);

  const differences = diffFields.map(([path, label]) => {
    const values = plans.map((p) => getPath(p, path));
    const distinct = new Set(values.map((v) => JSON.stringify(v)));
    return { path, label, values, differs: distinct.size > 1 };
  });

  return ok(res, { plans, differences });
}));

// ============================================
// GET /addons — global catalog
// ============================================
router.get('/addons', asyncHandler(async (req, res) => {
  const addons = await InsuranceAddon.find({ isActive: true }).lean();
  return ok(res, addons);
}));

// ============================================
// POST /quote — live premium calc (no persistence)
// ============================================
router.post('/quote', asyncHandler(async (req, res) => {
  ensureModels();
  const { planId, members, sumInsured, addonCodes, deductible, discountPct } = req.body;
  if (!planId) return fail(res, 400, 'MISSING_PLAN', 'planId required');

  const plan = await InsurancePlan.findById(planId).lean();
  if (!plan || !plan.isVerified) {
    return fail(res, 404, 'NOT_FOUND', 'Plan not available');
  }

  try {
    const premium = calculatePremium({
      plan,
      members: members || [],
      sumInsured,
      addonCodes: addonCodes || [],
      deductible: deductible || 0,
      discountPct: discountPct || 0,
    });
    return ok(res, premium);
  } catch (e) {
    return fail(res, 400, 'CALC_FAILED', e.message);
  }
}));

// ============================================
// POST /apply — create a new draft proposal
// Body: { planId }
// ============================================
router.post('/apply', authenticate, asyncHandler(async (req, res) => {
  ensureModels();
  const { planId } = req.body;
  if (!planId) return fail(res, 400, 'MISSING_PLAN', 'planId required');

  const plan = await InsurancePlan.findById(planId).lean();
  if (!plan || !plan.isVerified) {
    return fail(res, 404, 'NOT_FOUND', 'Plan not available');
  }

  const proposal = new InsuranceProposal({
    userId: uid(req),
    planId: plan._id,
    companyId: plan.companyId,
    sumInsured: plan.coverage?.sumInsured || 500000,
    currentStep: 1,
  });
  await proposal.save();

  return ok(res, proposal);
}));

// ============================================
// GET /apply/:id — resume draft
// ============================================
router.get('/apply/:id', authenticate, asyncHandler(async (req, res) => {
  const proposal = await InsuranceProposal.findOne({
    _id: req.params.id,
    userId: uid(req),
  }).lean();

  if (!proposal) return fail(res, 404, 'NOT_FOUND', 'Proposal not found');
  return ok(res, proposal);
}));

// ============================================
// PUT /apply/:id/personal — step 1
// ============================================
router.put('/apply/:id/personal', authenticate, asyncHandler(async (req, res) => {
  const proposal = await InsuranceProposal.findOne({
    _id: req.params.id,
    userId: uid(req),
  });
  if (!proposal) return fail(res, 404, 'NOT_FOUND', 'Proposal not found');

  const { fullName, dob, gender, mobile, email, address, city, state, pincode, panNumber } = req.body;
  if (!fullName || !dob || !gender || !mobile || !email) {
    return fail(res, 400, 'MISSING_FIELDS', 'fullName, dob, gender, mobile, email required');
  }

  proposal.personal = { fullName, dob, gender, mobile, email, address, city, state, pincode, panNumber };
  proposal.currentStep = 2;
  await proposal.save();

  return ok(res, proposal);
}));

// ============================================
// PUT /apply/:id/members — step 2
// ============================================
router.put('/apply/:id/members', authenticate, asyncHandler(async (req, res) => {
  const proposal = await InsuranceProposal.findOne({
    _id: req.params.id,
    userId: uid(req),
  });
  if (!proposal) return fail(res, 404, 'NOT_FOUND', 'Proposal not found');

  const { members, sumInsured } = req.body;
  if (!Array.isArray(members) || members.length === 0) {
    return fail(res, 400, 'MISSING_MEMBERS', 'members array required');
  }

  // Validate each member
  for (const m of members) {
    if (!m.relation || !m.name || !m.dob || !m.gender) {
      return fail(res, 400, 'INVALID_MEMBER', 'Each member needs relation, name, dob, gender');
    }
  }

  proposal.members = members.map((m) => ({
    ...m,
    age: m.age || Math.floor((Date.now() - new Date(m.dob)) / (365.25 * 24 * 60 * 60 * 1000)),
  }));
  if (sumInsured) proposal.sumInsured = sumInsured;
  proposal.currentStep = 3;
  await proposal.save();

  return ok(res, proposal);
}));

// ============================================
// PUT /apply/:id/medical — step 3
// ============================================
router.put('/apply/:id/medical', authenticate, asyncHandler(async (req, res) => {
  const proposal = await InsuranceProposal.findOne({
    _id: req.params.id,
    userId: uid(req),
  });
  if (!proposal) return fail(res, 404, 'NOT_FOUND', 'Proposal not found');

  const {
    conditions, otherCondition, hospitalizedLast4Years,
    hospitalizationDetails, currentMedications, medicationDetails, consentGiven,
  } = req.body;

  if (!consentGiven) {
    return fail(res, 400, 'CONSENT_REQUIRED', 'Medical consent required');
  }

  proposal.medical = {
    conditions: conditions || [],
    otherCondition, hospitalizedLast4Years: !!hospitalizedLast4Years,
    hospitalizationDetails, currentMedications: !!currentMedications,
    medicationDetails, consentGiven: true,
  };
  proposal.currentStep = 4;
  await proposal.save();

  return ok(res, proposal);
}));

// ============================================
// PUT /apply/:id/nominee — step 4
// ============================================
router.put('/apply/:id/nominee', authenticate, asyncHandler(async (req, res) => {
  const proposal = await InsuranceProposal.findOne({
    _id: req.params.id,
    userId: uid(req),
  });
  if (!proposal) return fail(res, 404, 'NOT_FOUND', 'Proposal not found');

  const { name, relationship, dob, share, phone } = req.body;
  if (!name || !relationship) {
    return fail(res, 400, 'MISSING_FIELDS', 'name and relationship required');
  }

  proposal.nominee = { name, relationship, dob, share: share || 100, phone };
  proposal.currentStep = 5;
  await proposal.save();

  return ok(res, proposal);
}));

// ============================================
// PUT /apply/:id/addons — add/remove addons, recalc premium
// ============================================
router.put('/apply/:id/addons', authenticate, asyncHandler(async (req, res) => {
  const proposal = await InsuranceProposal.findOne({
    _id: req.params.id,
    userId: uid(req),
  });
  if (!proposal) return fail(res, 404, 'NOT_FOUND', 'Proposal not found');

  const { addonCodes = [], deductible } = req.body;

  const plan = await InsurancePlan.findById(proposal.planId).lean();
  if (!plan) return fail(res, 404, 'NOT_FOUND', 'Plan not found');

  proposal.selectedAddons = addonCodes;
  if (typeof deductible === 'number') proposal.deductible = deductible;

  const premium = calculatePremium({
    plan,
    members: proposal.members,
    sumInsured: proposal.sumInsured,
    addonCodes,
    deductible: proposal.deductible,
  });
  proposal.premium = premium;
  await proposal.save();

  return ok(res, proposal);
}));

// ============================================
// GET /apply/:id/review — step 5, compute final premium
// ============================================
router.get('/apply/:id/review', authenticate, asyncHandler(async (req, res) => {
  const proposal = await InsuranceProposal.findOne({
    _id: req.params.id,
    userId: uid(req),
  }).lean();
  if (!proposal) return fail(res, 404, 'NOT_FOUND', 'Proposal not found');

  const plan = await InsurancePlan.findById(proposal.planId).lean();
  if (!plan) return fail(res, 404, 'NOT_FOUND', 'Plan not found');

  const premium = calculatePremium({
    plan,
    members: proposal.members,
    sumInsured: proposal.sumInsured,
    addonCodes: proposal.selectedAddons || [],
    deductible: proposal.deductible || 0,
  });

  return ok(res, { proposal, plan, premium });
}));

// ============================================
// POST /apply/:id/confirm — convert proposal to policy
// Creates Booking + InsurancePolicy. Marks proposal as converted.
// Idempotent — safe to call twice.
// ============================================
router.post('/apply/:id/confirm', authenticate, asyncHandler(async (req, res) => {
  const proposal = await InsuranceProposal.findOne({
    _id: req.params.id,
    userId: uid(req),
  });
  if (!proposal) return fail(res, 404, 'NOT_FOUND', 'Proposal not found');

  // Idempotency: if already converted, return the existing policy
  if (proposal.status === 'converted' && proposal.convertedPolicyId) {
    const existing = await InsurancePolicy.findById(proposal.convertedPolicyId).lean();
    return ok(res, { proposal, policy: existing, alreadyConverted: true });
  }

  const plan = await InsurancePlan.findById(proposal.planId).lean();
  if (!plan) return fail(res, 404, 'NOT_FOUND', 'Plan not found');

  // Recalculate premium one final time
  const premium = calculatePremium({
    plan,
    members: proposal.members,
    sumInsured: proposal.sumInsured,
    addonCodes: proposal.selectedAddons || [],
    deductible: proposal.deductible || 0,
  });

  const userId = uid(req);
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);

      // ============================================
  // Model creation — matches routes/insurance.js production pattern
  // ============================================
  const userIdStr = String(userId);
  const primaryMember = proposal.members.find((m) => m.relation === 'self') || proposal.members[0] || {};
  const now = new Date();

  // 1) BOOKING
  const booking = new Booking({
    userId: userIdStr,
    bookingType: 'insurance',
    patientName: proposal.personal?.fullName || primaryMember.name || 'Policyholder',
    patientPhone: proposal.personal?.mobile || '0000000000',
    patientEmail: proposal.personal?.email || 'noreply@hospitalhub.in',
    patientAge: primaryMember.age,
    patientGender: primaryMember.gender,
    bookingDate: now,
    appointmentDate: startDate,
    originalAmount: premium.total,
    discount: premium.discount || 0,
    finalAmount: premium.total,
    paymentStatus: 'pending',
    status: 'pending',
    providerId: plan.companyId,
    providerName: 'Insurance Company',
    platformCommission: 0,
    providerCommission: premium.total,
    commissionStatus: 'pending',
    insurancePlanId: plan._id,
    insuranceCompanyName: 'Insurance Company',
    insurancePlanName: plan.planName,
    sumInsured: proposal.sumInsured,
    premiumAmount: premium.total,
    insuranceMembers: proposal.members.map((m) => ({
      name: m.name,
      relation: m.relation,
      age: m.age,
      gender: m.gender,
    })),
    policyStartDate: startDate,
    policyEndDate: endDate,
    policyRenewalDate: endDate,
    insuranceSettlementStatus: 'pending',
    bookingId: 'INS' + Date.now() + Math.random().toString(36).slice(2, 5).toUpperCase(),
    location: { type: 'Point', coordinates: [0, 0] },
  });
  await booking.save();

  // 2) INSURANCE POLICY
  const policy = new InsurancePolicy({
    bookingId: booking._id,
    planId: plan._id,
    companyId: plan.companyId,
    userId: userIdStr,
    policyName: plan.planName,
    policyType: plan.planCategory || plan.planType || 'individual',
    sumInsured: proposal.sumInsured,
    roomRentLimit: plan.roomRentLimit || plan.coverage?.roomRent,
    premiumAmount: premium.base + premium.addons - premium.discount,
    gstAmount: premium.gst,
    discountAmount: premium.discount,
    totalAmount: premium.total,
    platformCommission: 0,
    platformCommissionRate: 0,
    payoutToCompany: premium.total,
    members: proposal.members.map((m) => ({
      name: m.name,
      relation: m.relation,
      age: m.age,
      gender: m.gender,
      dateOfBirth: m.dob,
      isSmoker: !!m.smoker,
      isPrimary: m.relation === 'self',
    })),
    primaryInsured: {
      name: primaryMember.name,
      age: primaryMember.age,
      gender: primaryMember.gender,
      dateOfBirth: primaryMember.dob,
      isSmoker: !!primaryMember.smoker,
    },
    nominee: proposal.nominee ? {
      name: proposal.nominee.name,
      relation: proposal.nominee.relationship,
      age: proposal.nominee.dob
        ? Math.floor((Date.now() - new Date(proposal.nominee.dob)) / (365.25 * 24 * 60 * 60 * 1000))
        : undefined,
      contactNumber: proposal.nominee.phone,
    } : undefined,
    selectedAddons: (proposal.selectedAddons || []).map((code) => {
      const a = (plan.addons || []).find((x) => x.code === code);
      return a ? { name: a.name, price: a.price, coverage: a.coverage || '' } : null;
    }).filter(Boolean),
    startDate,
    endDate,
    renewalDate: endDate,
    status: 'pending',
    paymentStatus: 'pending',
    settlementStatus: 'pending',
    termsAccepted: true,
    termsAcceptedAt: now,
    proposalNumber: proposal.proposalNumber,
    proposalDate: now,
    proposalFormData: { personal: proposal.personal, medical: proposal.medical },
    declarations: {
      medicalHistoryDeclared: true,
      preExistingDeclared: (proposal.medical?.conditions || []).length > 0,
    },
    medicalHistory: {
      chronicDiseases: proposal.medical?.conditions || [],
      currentMedications: proposal.medical?.currentMedications ? [proposal.medical.medicationDetails || ''] : [],
    },
  });
  await policy.save();

  // 3) TRANSACTION
  const transaction = new Transaction({
    transactionId: typeof Transaction.generateTransactionId === 'function'
      ? Transaction.generateTransactionId()
      : 'TXN' + Date.now() + Math.random().toString(36).slice(2, 8).toUpperCase(),
    applicationId: booking._id.toString(),
    lenderId: plan.companyId ? plan.companyId.toString() : null,
    type: 'booking_payment',
    amount: premium.total,
    commissionAmount: 0,
    status: 'initiated',
    paymentGateway: 'razorpay',
    bookingId: booking._id,
    bookingType: 'insurance',
    userId: userIdStr,
    providerId: plan.companyId,
    originalAmount: premium.total,
    netAmount: premium.total,
    platformCommission: 0,
    providerAmount: premium.total,
    commissionStatus: 'pending',
    settledToProvider: false,
    insurancePolicyId: policy._id,
    insurancePlanId: plan._id,
    premiumAmount: premium.total,
    gstAmount: premium.gst,
    totalPremium: premium.total,
    insuranceCommissionRate: 0,
    insurancePlatformCommission: 0,
    insurancePayoutToCompany: premium.total,
    insuranceSettlementStatus: 'pending',
  });
  await transaction.save();

  // 4) Link booking → policy
  booking.insurancePolicyId = policy._id;
  await booking.save();

  // 5) Mark proposal converted
  proposal.status = 'converted';
  proposal.convertedPolicyId = policy._id;
  proposal.premium = premium;
  proposal.currentStep = 6;
  await proposal.save();

  return ok(res, { proposal, policy, booking, transaction });
}));

// ============================================
// POST /apply/:id/create-order — Razorpay order for the proposal
// ============================================
router.post('/apply/:id/create-order', authenticate, asyncHandler(async (req, res) => {
  const proposal = await InsuranceProposal.findOne({
    _id: req.params.id,
    userId: uid(req),
  });
  if (!proposal) return fail(res, 404, 'NOT_FOUND', 'Proposal not found');

  if (proposal.status === 'converted') {
    return fail(res, 400, 'ALREADY_CONVERTED', 'Proposal already converted to policy');
  }

  const plan = await InsurancePlan.findById(proposal.planId).lean();
  if (!plan) return fail(res, 404, 'NOT_FOUND', 'Plan not found');

  // Recalculate premium one more time to be safe
  const premium = calculatePremium({
    plan,
    members: proposal.members,
    sumInsured: proposal.sumInsured,
    addonCodes: proposal.selectedAddons || [],
    deductible: proposal.deductible || 0,
  });

  if (!premium || !premium.total || premium.total <= 0) {
    return fail(res, 400, 'INVALID_AMOUNT', 'Premium amount could not be calculated');
  }

  // Call Razorpay
  const razorpayService = require('../services/razorpayService');
  const receipt = 'PROP_' + proposal._id.toString().slice(-12);

  let orderResult;
  try {
    orderResult = await razorpayService.createOrder(
      Math.round(premium.total * 100) / 100,
      'INR',
      receipt,
      {
        proposalId: proposal._id.toString(),
        planId: plan._id.toString(),
        userId: String(uid(req)),
      }
    );
  } catch (e) {
    console.error('[create-order] Razorpay error:', e.message);
    return fail(res, 502, 'RAZORPAY_ERROR', 'Payment gateway unavailable: ' + e.message);
  }

  if (!orderResult?.success || !orderResult.order?.id) {
    return fail(res, 502, 'ORDER_FAILED', 'Unable to create payment order');
  }

  const order = orderResult.order;

  proposal.payment = {
    ...(proposal.payment || {}),
    orderId: order.id,
    amount: premium.total,
    status: 'pending',
  };
  proposal.premium = premium;
  await proposal.save();

  return ok(res, {
    orderId: order.id,
    amount: premium.total,
    currency: 'INR',
    razorpayKey: process.env.RAZORPAY_KEY_ID,
    proposalId: proposal._id,
  });
}));

// ============================================
// POST /apply/:id/verify-payment — verify signature + convert to policy
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// ============================================
router.post('/apply/:id/verify-payment', authenticate, asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return fail(res, 400, 'MISSING_FIELDS', 'razorpay_order_id, razorpay_payment_id, razorpay_signature required');
  }

  const proposal = await InsuranceProposal.findOne({
    _id: req.params.id,
    userId: uid(req),
  });
  if (!proposal) return fail(res, 404, 'NOT_FOUND', 'Proposal not found');

  if (proposal.status === 'converted' && proposal.convertedPolicyId) {
    const existing = await InsurancePolicy.findById(proposal.convertedPolicyId).lean();
    return ok(res, { proposal, policy: existing, alreadyConverted: true });
  }

  // Verify signature
  const razorpayService = require('../services/razorpayService');
  let isValid = false;
  try {
    isValid = razorpayService.verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
  } catch (e) {
    return fail(res, 400, 'VERIFY_ERROR', 'Signature verification failed: ' + e.message);
  }

  if (!isValid) {
    return fail(res, 400, 'INVALID_SIGNATURE', 'Payment signature verification failed');
  }

  // Sanity: order must match proposal
  if (!proposal.payment || proposal.payment.orderId !== razorpay_order_id) {
    return fail(res, 400, 'ORDER_MISMATCH', 'Payment order does not match proposal');
  }

  // Confirm conversion (reuses existing route logic internally)
  const plan = await InsurancePlan.findById(proposal.planId).lean();
  if (!plan) return fail(res, 404, 'NOT_FOUND', 'Plan not found');

  const premium = proposal.premium && proposal.premium.total
    ? proposal.premium
    : calculatePremium({
        plan,
        members: proposal.members,
        sumInsured: proposal.sumInsured,
        addonCodes: proposal.selectedAddons || [],
        deductible: proposal.deductible || 0,
      });

  const userId = uid(req);
  const userIdStr = String(userId);
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);
  const now = new Date();
  const primaryMember = proposal.members.find((m) => m.relation === 'self') || proposal.members[0] || {};

  // BOOKING
  const booking = new Booking({
    userId: userIdStr,
    bookingType: 'insurance',
    patientName: proposal.personal?.fullName || primaryMember.name || 'Policyholder',
    patientPhone: proposal.personal?.mobile || '0000000000',
    patientEmail: proposal.personal?.email || 'noreply@hospitalhub.in',
    patientAge: primaryMember.age,
    patientGender: primaryMember.gender,
    bookingDate: now,
    appointmentDate: startDate,
    originalAmount: premium.total,
    discount: premium.discount || 0,
    finalAmount: premium.total,
    paymentStatus: 'paid',
    status: 'policy_issued',
    providerId: plan.companyId,
    providerName: 'Insurance Company',
    platformCommission: 0,
    providerCommission: premium.total,
    commissionStatus: 'pending',
    insurancePlanId: plan._id,
    insuranceCompanyName: 'Insurance Company',
    insurancePlanName: plan.planName,
    sumInsured: proposal.sumInsured,
    premiumAmount: premium.total,
    insuranceMembers: proposal.members.map((m) => ({
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

  // POLICY
  const policy = new InsurancePolicy({
    bookingId: booking._id,
    planId: plan._id,
    companyId: plan.companyId,
    userId: userIdStr,
    policyName: plan.planName,
    policyType: plan.planCategory || plan.planType || 'individual',
    sumInsured: proposal.sumInsured,
    roomRentLimit: plan.roomRentLimit || plan.coverage?.roomRent,
    premiumAmount: premium.base + premium.addons - premium.discount,
    gstAmount: premium.gst,
    discountAmount: premium.discount,
    totalAmount: premium.total,
    platformCommission: 0,
    platformCommissionRate: 0,
    payoutToCompany: premium.total,
    members: proposal.members.map((m) => ({
      name: m.name, relation: m.relation, age: m.age, gender: m.gender,
      dateOfBirth: m.dob, isSmoker: !!m.smoker, isPrimary: m.relation === 'self',
    })),
    primaryInsured: {
      name: primaryMember.name,
      age: primaryMember.age,
      gender: primaryMember.gender,
      dateOfBirth: primaryMember.dob,
      isSmoker: !!primaryMember.smoker,
    },
    nominee: proposal.nominee ? {
      name: proposal.nominee.name,
      relation: proposal.nominee.relationship,
      age: proposal.nominee.dob
        ? Math.floor((Date.now() - new Date(proposal.nominee.dob)) / (365.25 * 24 * 60 * 60 * 1000))
        : undefined,
      contactNumber: proposal.nominee.phone,
    } : undefined,
    selectedAddons: (proposal.selectedAddons || []).map((code) => {
      const a = (plan.addons || []).find((x) => x.code === code);
      return a ? { name: a.name, price: a.price, coverage: a.coverage || '' } : null;
    }).filter(Boolean),
    startDate,
    endDate,
    renewalDate: endDate,
    status: 'active',
    paymentStatus: 'paid',
    settlementStatus: 'pending',
    termsAccepted: true,
    termsAcceptedAt: now,
    proposalNumber: proposal.proposalNumber,
    proposalDate: now,
    proposalFormData: { personal: proposal.personal, medical: proposal.medical },
    declarations: {
      medicalHistoryDeclared: true,
      preExistingDeclared: (proposal.medical?.conditions || []).length > 0,
    },
    medicalHistory: {
      chronicDiseases: proposal.medical?.conditions || [],
      currentMedications: proposal.medical?.currentMedications ? [proposal.medical.medicationDetails || ''] : [],
    },
  });
  await policy.save();

  // TRANSACTION
  const transaction = new Transaction({
    transactionId: typeof Transaction.generateTransactionId === 'function'
      ? Transaction.generateTransactionId()
      : 'TXN' + Date.now() + Math.random().toString(36).slice(2, 8).toUpperCase(),
    applicationId: booking._id.toString(),
    lenderId: plan.companyId ? plan.companyId.toString() : null,
    type: 'booking_payment',
    amount: premium.total,
    commissionAmount: 0,
    status: 'completed',
    paymentGateway: 'razorpay',
    gatewayReferenceId: razorpay_order_id,
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    paidAt: now,
    completedAt: now,
    bookingId: booking._id,
    bookingType: 'insurance',
    userId: userIdStr,
    providerId: plan.companyId,
    originalAmount: premium.total,
    netAmount: premium.total,
    platformCommission: 0,
    providerAmount: premium.total,
    commissionStatus: 'pending',
    settledToProvider: false,
    insurancePolicyId: policy._id,
    insurancePlanId: plan._id,
    premiumAmount: premium.total,
    gstAmount: premium.gst,
    totalPremium: premium.total,
    insuranceCommissionRate: 0,
    insurancePlatformCommission: 0,
    insurancePayoutToCompany: premium.total,
    insuranceSettlementStatus: 'pending',
  });
  await transaction.save();

  booking.insurancePolicyId = policy._id;
  await booking.save();

  // Mark proposal converted
  proposal.status = 'converted';
  proposal.convertedPolicyId = policy._id;
  proposal.payment = {
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    amount: premium.total,
    status: 'paid',
    paidAt: now,
  };
  await proposal.save();

  return ok(res, { proposal, policy, booking, transaction });
}));

module.exports = router;
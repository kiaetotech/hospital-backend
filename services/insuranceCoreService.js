// D:\hospital backend\services\insuranceCoreService.js
// ============================================
// INSURANCE CORE SERVICE
// ============================================
// Business logic for insurance tag (no AI yet — AI stubs return fallbacks)
// ============================================

const mongoose = require('mongoose');

const InsurancePlan = require('../models/InsurancePlan');
const InsurancePolicy = require('../models/InsurancePolicy');
const InsuranceClaim = require('../models/InsuranceClaim');
const InsuranceCompany = require('../models/InsuranceCompany');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');

const {
  InsuranceAddon,
  InsuranceNetworkHospital,
  InsuranceEndorsement,
  InsuranceClaimAppeal,
  InsuranceComplaint,
  AIAuditLog
} = require('../models/InsuranceTag');

// ============================================
// HELPERS
// ============================================

function round(n, precision = 2) {
  const factor = Math.pow(10, precision);
  return Math.round(n * factor) / factor;
}

function nowIso() {
  return new Date().toISOString();
}

// ============================================
// PREMIUM CALCULATION (§5)
// ============================================

/**
 * Full premium quote with breakdown.
 * @param {Object} params
 * @param {string} params.planId
 * @param {Array}  params.members   [{relation, age, gender, isSmoker, hasPED}]
 * @param {number} params.sumInsured
 * @param {number} [params.deductible]
 * @param {Array}  [params.selectedAddonCodes]
 * @param {string} [params.couponCode]
 * @returns {Object} full breakdown
 */
async function calculateQuote({
  planId,
  members = [],
  sumInsured,
  deductible = 0,
  selectedAddonCodes = [],
  couponCode = null
}) {
  if (!planId) throw new Error('planId required');
  if (!Array.isArray(members) || members.length === 0) throw new Error('members required');
  if (!sumInsured) throw new Error('sumInsured required');

  const plan = await InsurancePlan.findById(planId).populate('companyId');
  if (!plan) throw new Error('Plan not found');
  if (!plan.isActive || !plan.isVerified) throw new Error('Plan not available');

  // Validate sum insured
  if (sumInsured < plan.sumInsured.min || sumInsured > plan.sumInsured.max) {
    throw new Error(`Sum insured must be between ${plan.sumInsured.min} and ${plan.sumInsured.max}`);
  }

  // ---- Base premium ----
  const primaryMember = members.find(m => m.relation === 'self') || members[0];
  const membersCount = members.length;

  const calc = plan.calculatePremium(
    Number(primaryMember.age),
    Number(sumInsured),
    membersCount,
    Boolean(primaryMember.isSmoker)
  );

  // ---- Per-member loadings ----
  const memberLoadings = [];
  let totalAgeLoading = 0;
  members.forEach((m, i) => {
    const age = Number(m.age) || 0;
    let loading = 0;
    let reason = '';
    if (age > 60) { loading = 0.5; reason = `Age ${age} → 1.5x`; }
    else if (age > 50) { loading = 0.2; reason = `Age ${age} → 1.2x`; }
    else if (age > 40) { loading = 0.1; reason = `Age ${age} → 1.1x`; }
    else if (age < 25) { loading = -0.1; reason = `Age ${age} → 0.9x (discount)`; }
    const loadingAmount = i === 0 ? 0 : round(calc.basePremium * loading, 2);
    totalAgeLoading += loadingAmount;
    memberLoadings.push({
      member: m.relation || `member_${i}`,
      loading: loadingAmount,
      reason: reason || `Age ${age} → standard rate`
    });
  });

  // ---- Deductible discount ----
  let deductibleDiscount = 0;
  if (deductible > 0) {
    deductibleDiscount = round(calc.discountedPrice * Math.min(deductible / 500000, 0.1), 2);
  }

  // ---- Add-ons ----
  const addonList = [];
  let addonTotal = 0;
  if (selectedAddonCodes.length > 0) {
    const addons = await InsuranceAddon.find({
      planId: plan._id,
      code: { $in: selectedAddonCodes.map(c => c.toUpperCase()) },
      isActive: true
    }).lean();
    addons.forEach(a => {
      let price = a.price;
      if (a.priceType === 'percentage') {
        price = round(calc.discountedPrice * a.price / 100, 2);
      }
      addonTotal += price;
      addonList.push({ code: a.code, name: a.name, price });
    });
  }

  // ---- Discount ----
  let discountAmount = 0;
  let discountCode = null;
  let discountMessage = null;
  if (couponCode) {
    // In Phase 1, simple pattern: HEALTH10 = 10%, FAMILY5 = 5%
    const knownCoupons = {
      HEALTH10: { type: 'percentage', value: 10 },
      FAMILY5: { type: 'percentage', value: 5 },
      FIRST500: { type: 'fixed', value: 500 },
      RENEW3: { type: 'percentage', value: 3 }
    };
    const coupon = knownCoupons[couponCode.toUpperCase()];
    if (coupon) {
      if (coupon.type === 'percentage') {
        discountAmount = round(calc.discountedPrice * coupon.value / 100, 2);
      } else {
        discountAmount = coupon.value;
      }
      discountCode = couponCode.toUpperCase();
    } else {
      discountMessage = 'Coupon not valid or expired';
    }
  }

  // ---- Final math ----
  const subtotal = calc.basePremium + totalAgeLoading + addonTotal - deductibleDiscount;
  const discountedPremium = round(subtotal - discountAmount, 2);
  const gstRate = plan.gstRate || 18;
  const gstAmount = round(discountedPremium * gstRate / 100, 2);
  const totalPremium = round(discountedPremium + gstAmount, 2);
  const monthlyPremium = round(totalPremium / 12, 2);

  // ---- AI insight stub ----
  const aiInsights = await aiLog({
    tag: 'insurance',
    feature: 'quote',
    userId: null,
    input: { planId, members: members.length, sumInsured },
    output: { totalPremium }
  }, () => ({
    underInsuredWarning: {
      triggered: false,
      message: sumInsured < 500000 ? 'Consider ₹5L+ cover for a family' : null
    },
    recommendations: [],
    alternatives: [],
    model: 'rule-based-fallback',
    promptVersion: 'v1.0-fallback'
  }));

  return {
    plan: {
      _id: plan._id,
      planName: plan.planName,
      company: plan.companyId?.companyName || plan.companyId?.name || 'Insurance Company'
    },
    breakdown: {
      basePremium: round(calc.basePremium, 2),
      memberLoadings,
      sumInsuredAdjustment: 0,
      deductibleDiscount,
      addonTotal: round(addonTotal, 2),
      subtotal: round(subtotal, 2),
      discountAmount,
      discountCode,
      discountMessage,
      discountedPremium,
      gstAmount,
      gstRate,
      totalPremium,
      monthlyPremium
    },
    addons: addonList,
    aiInsights,
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
}

// ============================================
// COMPARE PLANS (§3)
// ============================================

/**
 * Compare 2-4 plans field-by-field.
 * @param {Array<string>} planIds
 * @param {Object} [context] { age, members, pincode }
 * @returns {Object} comparison matrix + AI narrative (stub)
 */
async function comparePlans(planIds = [], context = {}) {
  if (!Array.isArray(planIds) || planIds.length < 2 || planIds.length > 4) {
    throw new Error('Provide 2 to 4 planIds');
  }

  const plans = await InsurancePlan.find({ _id: { $in: planIds }, isActive: true })
    .populate('companyId')
    .lean();

  if (plans.length < 2) throw new Error('At least 2 valid plans required');

  // Build comparison matrix
  const matrix = [
    { field: 'Premium (₹/year)', key: 'basePremium' },
    { field: 'Sum Insured', key: 'sumInsuredDisplay' },
    { field: 'Room Rent', key: 'roomRentLimit' },
    { field: 'ICU', key: 'icuCoverage' },
    { field: 'No-Claim Bonus', key: 'ncbDisplay' },
    { field: 'Restore Benefit', key: 'restoreBenefit' },
    { field: 'Maternity', key: 'maternityCoverage' },
    { field: 'OPD', key: 'opdCoverage' },
    { field: 'AYUSH', key: 'ayushCoverage' },
    { field: 'Mental Health', key: 'mentalHealthCoverage' },
    { field: 'Ambulance', key: 'ambulanceCoverage' },
    { field: 'Pre-Existing Waiting', key: 'pedDisplay' },
    { field: 'Network Hospitals', key: 'totalNetworkHospitals' }
  ];

  const formatted = plans.map(p => ({
    planId: p._id,
    planName: p.planName,
    company: p.companyId?.companyName || p.companyId?.name || 'Insurance Company',
    basePremium: p.basePremium,
    sumInsuredDisplay: `₹${((p.sumInsured?.default || 0) / 100000).toFixed(1)}L`,
    roomRentLimit: p.roomRentLimit || 'single',
    icuCoverage: p.icuCoverage ? 'Covered' : 'Not covered',
    ncbDisplay: `${p.ncbPercentage || 0}%`,
    restoreBenefit: p.restoreBenefit ? 'Yes' : 'No',
    maternityCoverage: p.maternityCoverage ? 'Yes' : 'No',
    opdCoverage: p.opdCoverage ? 'Yes' : 'No',
    ayushCoverage: p.ayushCoverage ? 'Yes' : 'No',
    mentalHealthCoverage: p.mentalHealthCoverage ? 'Yes' : 'No',
    ambulanceCoverage: p.ambulanceCoverage ? 'Yes' : 'No',
    pedDisplay: `${p.preExistingWaiting || 48} months`,
    totalNetworkHospitals: p.totalNetworkHospitals || 0
  }));

  const differenceMatrix = matrix.map(row => {
    const values = formatted.map(f => f[row.key]);
    const unique = new Set(values.map(v => String(v)));
    return {
      field: row.field,
      values,
      differs: unique.size > 1
    };
  }).filter(r => r.differs);

  // AI stub
  const aiInsights = await aiLog({
    tag: 'insurance',
    feature: 'compare',
    input: { planIds, context },
    output: { differences: differenceMatrix.length }
  }, () => ({
    recommendation: formatted[0].planName,
    confidence: 0.5,
    reasoning: 'Rule-based fallback: recommending first plan. AI narrative coming in Week 4.',
    warnings: [],
    model: 'rule-based-fallback',
    promptVersion: 'v1.0-fallback'
  }));

  return {
    plans: formatted,
    differenceMatrix,
    aiInsights
  };
}

// ============================================
// APPLICATION SUBMISSION (§8-§11)
// ============================================

/**
 * Create booking + policy + transaction for a new application.
 * NOTE: This does NOT create the Razorpay order — route layer does that.
 * Returns bookingId, policyId, amount.
 */
async function createApplication({ userId, planId, requestData }) {
  const plan = await InsurancePlan.findById(planId).populate('companyId');
  if (!plan) throw new Error('Plan not found');
  if (!plan.isActive || !plan.isVerified) throw new Error('Plan not available');

  // Recalculate quote to prevent tampering
  const quote = await calculateQuote({
    planId,
    members: requestData.members,
    sumInsured: requestData.sumInsured,
    deductible: requestData.deductible || 0,
    selectedAddonCodes: requestData.selectedAddons || [],
    couponCode: requestData.couponCode || null
  });

  const company = await InsuranceCompany.findOne({ userId: plan.companyId?._id || plan.companyId });
  if (!company) {
    // Fallback: plan.companyId might already be InsuranceCompany._id
    const companyDirect = await InsuranceCompany.findById(plan.companyId);
    if (!companyDirect) throw new Error('Insurance company not found');
    return _createAppWithCompany(userId, plan, companyDirect, quote, requestData);
  }
  return _createAppWithCompany(userId, plan, company, quote, requestData);
}

async function _createAppWithCompany(userId, plan, company, quote, requestData) {
  const start = new Date(requestData.startDate || Date.now());
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  const bookingId = 'INS' + Date.now() + Math.floor(Math.random() * 1000);

  const booking = new Booking({
    userId: String(userId),
    bookingType: 'insurance',
    patientName: requestData.primaryInsured?.name || 'Unknown',
    patientPhone: requestData.phone || requestData.primaryInsured?.phone || '',
    patientEmail: requestData.primaryInsured?.email || '',
    patientAge: requestData.primaryInsured?.age,
    patientGender: requestData.primaryInsured?.gender,
    bookingDate: new Date(),
    appointmentDate: start,
    originalAmount: quote.breakdown.totalPremium,
    discount: quote.breakdown.discountAmount,
    finalAmount: quote.breakdown.totalPremium,
    paymentStatus: 'pending',
    status: 'pending',
    providerId: company._id,
    providerName: company.companyName,
    insurancePlanId: plan._id,
    insuranceCompanyName: company.companyName,
    insurancePlanName: plan.planName,
    sumInsured: requestData.sumInsured,
    premiumAmount: quote.breakdown.totalPremium,
    insuranceMembers: requestData.members || [],
    policyStartDate: start,
    policyEndDate: end,
    policyRenewalDate: end,
    bookingId
  });
  await booking.save();

  const policy = new InsurancePolicy({
    bookingId: booking._id,
    planId: plan._id,
    companyId: company._id,
    userId: String(userId),
    policyName: plan.planName,
    policyType: plan.planType,
    sumInsured: requestData.sumInsured,
    roomRentLimit: plan.roomRentLimit,
    premiumAmount: quote.breakdown.discountedPremium,
    gstAmount: quote.breakdown.gstAmount,
    discountAmount: quote.breakdown.discountAmount,
    totalAmount: quote.breakdown.totalPremium,
    platformCommission: round(quote.breakdown.discountedPremium * (plan.commissionRate || 15) / 100, 2),
    platformCommissionRate: plan.commissionRate || 15,
    payoutToCompany: round(quote.breakdown.discountedPremium * (1 - (plan.commissionRate || 15) / 100), 2),
    members: requestData.members || [],
    primaryInsured: requestData.primaryInsured || {},
    nominee: requestData.nominee || {},
    selectedAddons: quote.addons || [],
    startDate: start,
    endDate: end,
    renewalDate: end,
    status: 'pending',
    paymentStatus: 'pending',
    settlementStatus: 'pending',
    underwritingStatus: 'auto_approved',
    termsAccepted: Boolean(requestData.termsAccepted),
    termsAcceptedAt: requestData.termsAccepted ? new Date() : null,
    medicalHistory: requestData.medicalHistory || {},
    declarations: requestData.declarations || {}
  });
  await policy.save();

  booking.insurancePolicyId = policy._id;
  await booking.save();

  const transaction = new Transaction({
    transactionId: Transaction.generateTransactionId(),
    applicationId: String(booking._id),
    lenderId: String(company._id),
    type: 'booking_payment',
    amount: quote.breakdown.totalPremium,
    status: 'initiated',
    paymentGateway: 'razorpay',
    bookingId: booking._id,
    bookingType: 'insurance',
    userId: String(userId),
    providerId: company._id,
    originalAmount: quote.breakdown.totalPremium,
    netAmount: quote.breakdown.totalPremium,
    platformCommission: policy.platformCommission,
    providerAmount: policy.payoutToCompany,
    insurancePolicyId: policy._id,
    insurancePlanId: plan._id,
    policyNumber: policy.policyNumber,
    premiumAmount: quote.breakdown.totalPremium,
    totalPremium: quote.breakdown.totalPremium,
    gstAmount: quote.breakdown.gstAmount,
    insuranceCommissionRate: plan.commissionRate || 15,
    insurancePlatformCommission: policy.platformCommission,
    insurancePayoutToCompany: policy.payoutToCompany,
    insuranceSettlementStatus: 'pending'
  });
  await transaction.save();

  return {
    booking,
    policy,
    transaction,
    amount: quote.breakdown.totalPremium,
    quote
  };
}

// ============================================
// POLICY ACTIVATION (post-payment)
// ============================================

async function activatePolicy({ bookingId, paymentId, razorpayOrderId, razorpaySignature }) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error('Booking not found');
  if (booking.paymentStatus === 'paid') return { alreadyPaid: true };

  booking.paymentStatus = 'paid';
  booking.status = 'policy_issued';
  booking.paymentId = paymentId;
  booking.razorpayPaymentId = paymentId;
  booking.razorpaySignature = razorpaySignature;
  booking.completedAt = new Date();
  await booking.save();

  const policy = await InsurancePolicy.findOne({ bookingId: booking._id });
  if (policy) {
    policy.status = 'active';
    policy.paymentStatus = 'paid';
    policy.underwritingStatus = 'auto_approved';
    await policy.save();
  }

  const transaction = await Transaction.findOne({ bookingId: booking._id });
  if (transaction) {
    transaction.status = 'completed';
    transaction.paymentId = paymentId;
    transaction.paidAt = new Date();
    transaction.completedAt = new Date();
    transaction.webhookReceived = true;
    await transaction.save();
  }

  return { booking, policy, transaction };
}

// ============================================
// CLAIM LIFECYCLE
// ============================================

async function createClaim({ userId, policyId, claimType = 'reimbursement', claimData }) {
  const policy = await InsurancePolicy.findById(policyId);
  if (!policy) throw new Error('Policy not found');
  if (String(policy.userId) !== String(userId)) throw new Error('Unauthorized');
  if (policy.status !== 'active') throw new Error('Only active policies can file claims');

  const amount = Number(claimData.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > policy.sumInsured) {
    throw new Error('Invalid claim amount');
  }

  // Look up company by InsuranceCompany._id
  const company = await InsuranceCompany.findById(policy.companyId);
  if (!company) throw new Error('Insurance company not found');

  const claim = new InsuranceClaim({
    policyId: policy._id,
    bookingId: policy.bookingId,
    companyId: company._id,
    userId: String(userId),
    claimType,
    amount,
    description: claimData.description || '',
    hospitalName: claimData.hospitalName || '',
    hospitalAddress: claimData.hospitalAddress || '',
    hospitalCity: claimData.hospitalCity || '',
    hospitalPincode: claimData.hospitalPincode || '',
    admissionDate: claimData.admissionDate ? new Date(claimData.admissionDate) : null,
    dischargeDate: claimData.dischargeDate ? new Date(claimData.dischargeDate) : null,
    diagnosis: claimData.diagnosis || '',
    treatment: claimData.treatment || '',
    documents: Array.isArray(claimData.documents) ? claimData.documents : [],
    status: 'submitted',
    submittedBy: userId
  });
  await claim.save();

  await claim.addTimeline('submitted', 'Claim submitted by patient', userId);

  // AI precheck stub (real AI in week 4)
  const aiPrecheck = await aiLog({
    tag: 'insurance',
    feature: 'precheck_claim',
    userId,
    resourceType: 'claim',
    resourceId: claim._id,
    input: { amount, diagnosis: claimData.diagnosis },
    output: {}
  }, () => {
    const riskScore = amount > 100000 ? 45 : 15;
    return {
      status: riskScore < 30 ? 'clear' : 'review',
      riskScore,
      message: riskScore < 30
        ? 'Looks standard. Will be processed normally.'
        : 'Higher amount — insurer may request additional documents.',
      model: 'rule-based-fallback'
    };
  });

  claim.aiPrecheck = aiPrecheck;
  claim.aiScore = aiPrecheck.riskScore || 0;
  await claim.save();

  return claim;
}

async function updateClaimStatus({ claimId, status, note, amount, actorUserId }) {
  const allowed = ['submitted', 'under_review', 'approved', 'rejected', 'settled', 'partially_settled', 'cancelled', 'pending_verification'];
  if (!allowed.includes(status)) throw new Error('Invalid status');

  const claim = await InsuranceClaim.findById(claimId);
  if (!claim) throw new Error('Claim not found');

  const numericAmount = amount != null ? Number(amount) : null;
  if (numericAmount != null && (!Number.isFinite(numericAmount) || numericAmount < 0)) {
    throw new Error('Invalid amount');
  }

  if (status === 'approved') {
    claim.approvedAmount = numericAmount ?? claim.amount;
    claim.approvedBy = actorUserId;
    claim.approvedAt = new Date();
  }
  if (status === 'rejected') {
    claim.rejectedReason = note || 'Claim rejected';
    claim.rejectedAt = new Date();
  }
  if (status === 'settled' || status === 'partially_settled') {
    const settlement = numericAmount ?? claim.approvedAmount ?? claim.amount;
    if (status === 'partially_settled' && settlement >= claim.amount) {
      throw new Error('Partial settlement must be less than claim amount');
    }
    claim.settlementAmount = settlement;
    claim.settlementDate = new Date();
    claim.settlementReference = claim.settlementReference || `SETTLE_${Date.now()}`;
  }

  claim.status = status;
  claim.updatedAt = new Date();
  await claim.save();
  await claim.addTimeline(status, note || `Status updated to ${status}`, actorUserId);

  return claim;
}

// ============================================
// ENDORSEMENTS
// ============================================

async function createEndorsement({ userId, policyId, type, requestData }) {
  const policy = await InsurancePolicy.findById(policyId);
  if (!policy) throw new Error('Policy not found');
  if (String(policy.userId) !== String(userId)) throw new Error('Unauthorized');
  if (policy.status !== 'active') throw new Error('Only active policies can be modified');

  const endorsement = new InsuranceEndorsement({
    policyId,
    userId: String(userId),
    type,
    requestData,
    status: 'pending',
    aiPrecheck: {
      status: 'clear',
      confidence: 0.7,
      message: 'Endorsement request received. Insurer will process in 2-3 business days.',
      model: 'rule-based-fallback'
    }
  });
  await endorsement.save();
  return endorsement;
}

// ============================================
// CLAIM APPEAL
// ============================================

async function createAppeal({ userId, claimId, reason, documents = [] }) {
  const claim = await InsuranceClaim.findById(claimId);
  if (!claim) throw new Error('Claim not found');
  if (String(claim.userId) !== String(userId)) throw new Error('Unauthorized');

  const appeal = new InsuranceClaimAppeal({
    claimId,
    userId: String(userId),
    reason,
    documents,
    originalDecision: {
      status: claim.status,
      approvedAmount: claim.approvedAmount,
      rejectionReason: claim.rejectedReason,
      decidedAt: claim.approvedAt || claim.rejectedAt
    },
    requestedAmount: claim.amount,
    status: 'submitted',
    aiDraft: {
      draftText: 'Dear Sir/Madam,\n\nI am writing to appeal the decision on my claim. Reason: ' + reason + '\n\n[Detailed appeal draft will be generated by AI in Week 4.]',
      citations: [],
      confidence: 0.5,
      model: 'rule-based-fallback'
    }
  });
  await appeal.save();
  return appeal;
}

// ============================================
// COMPLAINTS
// ============================================

async function createComplaint({ userId, policyId, claimId, category, subject, description, attachments = [], priority = 'normal' }) {
  const now = new Date();
  const responseBy = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const resolutionBy = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const complaint = new InsuranceComplaint({
    userId: String(userId),
    policyId,
    claimId,
    category,
    subject,
    description,
    attachments,
    status: 'open',
    priority,
    sla: { responseBy, resolutionBy, breached: false }
  });
  await complaint.save();
  return complaint;
}

// ============================================
// AI LOG WRAPPER (stub — real AI in Week 4)
// ============================================

/**
 * Wraps a stubbed AI computation and logs to AIAuditLog.
 * In Week 4, the `compute` callback will call Gemini/Groq.
 */
async function aiLog(meta, compute) {
  const start = Date.now();
  let result;
  let error = null;
  try {
    result = await compute();
  } catch (e) {
    error = e.message;
    result = { fallback: true, error: e.message, model: 'rule-based-fallback' };
  }

  try {
    await AIAuditLog.create({
      tag: meta.tag,
      feature: meta.feature,
      agentName: 'InsuranceCoreService',
      userId: meta.userId || null,
      resourceType: meta.resourceType || null,
      resourceId: meta.resourceId || null,
      input: { summary: JSON.stringify(meta.input || {}).slice(0, 500) },
      output: { summary: JSON.stringify(result || {}).slice(0, 500) },
      model: result.model || 'rule-based-fallback',
      provider: 'internal',
      promptVersion: result.promptVersion || 'v1.0-fallback',
      confidence: result.confidence || 0.5,
      latencyMs: Date.now() - start,
      costEstimate: 0,
      fallback: Boolean(result.fallback),
      fallbackReason: result.fallback ? 'AI not enabled yet' : null,
      error
    });
  } catch (logErr) {
    // Never let logging break the main flow
    console.error('AIAuditLog write failed:', logErr.message);
  }
  return result;
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  calculateQuote,
  comparePlans,
  createApplication,
  activatePolicy,
  createClaim,
  updateClaimStatus,
  createEndorsement,
  createAppeal,
  createComplaint,
  aiLog
};
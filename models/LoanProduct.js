// D:\hospital backend\models\LoanProduct.js
// ============================================
// LOAN PRODUCT MODEL
// ============================================
// First-class product catalog per lender.
// Replaces the embedded array inside Lender.loanProducts (legacy).
//
// Production notes:
// - Products are VERSIONED — never overwrite published terms.
// - Products are ACTIVATABLE/DEACTIVATABLE — never hard-deleted if used.
// - One lender can have many products (Medical Loan, Surgery EMI, No-Cost EMI, etc.)
// - New applications must reference an active product.
// ============================================

const mongoose = require('mongoose');

const loanProductSchema = new mongoose.Schema({
  // ============================================
  // IDENTIFICATION
  // ============================================
  productId: {
    type: String,
    unique: true,
    required: true,
    index: true,
  },
  lenderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lender',
    required: true,
    index: true,
  },
  productCode: {
    type: String,
    required: true,
    // Human-readable code like "MED-EMI-001" — unique per lender
  },
  productName: {
    type: String,
    required: true, // "Medical Loan", "Surgery EMI", "No-Cost EMI"
  },
  productCategory: {
    type: String,
    enum: [
      'medical_loan',        // general healthcare financing
      'surgery_financing',   // surgery-specific
      'diagnostic_emi',      // diagnostics/lab tests
      'treatment_loan',      // treatment packages
      'no_cost_emi',         // subsidized by provider
      'corporate_loan',      // corporate borrower
    ],
    required: true,
    index: true,
  },
  description: { type: String, default: '' },

  // ============================================
  // LOAN AMOUNT
  // ============================================
  minAmount: { type: Number, required: true, min: 0 },
  maxAmount: { type: Number, required: true, min: 0 },

  // ============================================
  // INTEREST RATE
  // ============================================
  interestRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    // Annual percentage rate
  },
  interestType: {
    type: String,
    enum: ['reducing', 'flat'],
    default: 'reducing',
  },
  isInterestRateFixed: { type: Boolean, default: true },

  // ============================================
  // TENURE
  // ============================================
  minTenureMonths: { type: Number, required: true, min: 1 },
  maxTenureMonths: { type: Number, required: true, min: 1 },

  // ============================================
  // PROCESSING FEE
  // ============================================
  processingFeeType: {
    type: String,
    enum: ['percentage', 'fixed', 'hybrid'],
    default: 'percentage',
  },
  processingFeePercent: { type: Number, default: 0, min: 0, max: 10 },
  processingFeeFixed: { type: Number, default: 0, min: 0 },
  processingFeeMin: { type: Number, default: 0, min: 0 },
  processingFeeMax: { type: Number, default: null, min: 0 },
  gstOnProcessingFee: { type: Number, default: 18, min: 0, max: 28 },

  // ============================================
  // OTHER CHARGES
  // ============================================
  documentationCharge: { type: Number, default: 0, min: 0 },
  stampDutyPercent: { type: Number, default: 0, min: 0, max: 5 },
  insurancePercent: { type: Number, default: 0, min: 0, max: 5 },
  prepaymentPenaltyPercent: { type: Number, default: 0, min: 0, max: 10 },
  latePaymentFeeFixed: { type: Number, default: 0, min: 0 },
  latePaymentFeePercent: { type: Number, default: 0, min: 0, max: 10 },
  cancellationCharge: { type: Number, default: 0, min: 0 },

  // ============================================
  // ELIGIBILITY
  // ============================================
  minCibilScore: { type: Number, default: 650, min: 300, max: 900 },
  minAge: { type: Number, default: 21, min: 18, max: 70 },
  maxAge: { type: Number, default: 65, min: 18, max: 80 },
  minMonthlyIncome: { type: Number, default: 0, min: 0 },
  employmentTypesAllowed: [{
    type: String,
    enum: ['salaried', 'self_employed', 'business_owner', 'professional', 'any'],
  }],
  requiresCollateral: { type: Boolean, default: false },
  collateralTypes: [{ type: String }],
  requiresGuarantor: { type: Boolean, default: false },

  // ============================================
  // APPROVAL
  // ============================================
  approvalTimeHours: { type: Number, default: 24, min: 0 },
  autoApprovalEnabled: { type: Boolean, default: false },
  autoApprovalMaxAmount: { type: Number, default: 0, min: 0 },

  // ============================================
  // VERSIONING
  // ============================================
  version: { type: Number, default: 1, required: true },
  previousVersionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoanProduct',
    default: null,
  },

  // ============================================
  // STATUS
  // ============================================
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'suspended', 'archived'],
    default: 'draft',
    index: true,
  },
  publishedAt: { type: Date, default: null },
  activatedAt: { type: Date, default: null },
  deactivatedAt: { type: Date, default: null },
  deactivationReason: { type: String, default: '' },

  // ============================================
  // EFFECTIVE DATES
  // ============================================
  effectiveFrom: { type: Date, default: Date.now },
  effectiveUntil: { type: Date, default: null },

  // ============================================
  // AUDIT
  // ============================================
  createdBy: { type: String, default: 'system' },
  updatedBy: { type: String, default: 'system' },
  changeReason: { type: String, default: '' },

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: false,
});

// ============================================
// INDEXES
// ============================================
loanProductSchema.index({ lenderId: 1, productCode: 1 }, { unique: true });
loanProductSchema.index({ lenderId: 1, status: 1 });
loanProductSchema.index({ productCategory: 1, status: 1 });
loanProductSchema.index({ status: 1, effectiveFrom: 1, effectiveUntil: 1 });
loanProductSchema.index({ minAmount: 1, maxAmount: 1 });

// ============================================
// VIRTUALS
// ============================================
loanProductSchema.virtual('isActive').get(function () {
  if (this.status !== 'active') return false;
  const now = new Date();
  if (this.effectiveFrom && now < this.effectiveFrom) return false;
  if (this.effectiveUntil && now > this.effectiveUntil) return false;
  return true;
});

// ============================================
// METHODS
// ============================================

// Check if a loan amount is within product range
loanProductSchema.methods.isAmountEligible = function (amount) {
  return amount >= this.minAmount && amount <= this.maxAmount;
};

// Calculate processing fee for a given loan amount
loanProductSchema.methods.calculateProcessingFee = function (loanAmount) {
  let fee = 0;
  if (this.processingFeeType === 'percentage') {
    fee = Math.round((loanAmount * this.processingFeePercent) / 100);
  } else if (this.processingFeeType === 'fixed') {
    fee = this.processingFeeFixed;
  } else if (this.processingFeeType === 'hybrid') {
    fee = Math.round((loanAmount * this.processingFeePercent) / 100) + this.processingFeeFixed;
  }
  if (this.processingFeeMin && fee < this.processingFeeMin) fee = this.processingFeeMin;
  if (this.processingFeeMax && fee > this.processingFeeMax) fee = this.processingFeeMax;
  const gst = Math.round((fee * this.gstOnProcessingFee) / 100);
  return {
    baseFee: fee,
    gst,
    totalFee: fee + gst,
  };
};

// Calculate EMI for a given amount, tenure, rate
loanProductSchema.methods.calculateEMI = function (loanAmount, tenureMonths) {
  const monthlyRate = this.interestRate / 100 / 12;
  if (monthlyRate === 0) {
    return {
      emi: Math.round(loanAmount / tenureMonths),
      totalPayable: loanAmount,
      totalInterest: 0,
    };
  }
  const emiNumerator = loanAmount * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths);
  const emiDenominator = Math.pow(1 + monthlyRate, tenureMonths) - 1;
  const emi = Math.round(emiNumerator / emiDenominator);
  const totalPayable = emi * tenureMonths;
  const totalInterest = totalPayable - loanAmount;
  return {
    emi,
    totalPayable,
    totalInterest,
  };
};

// ============================================
// STATICS
// ============================================

// Get active products for a lender
loanProductSchema.statics.getActiveByLender = async function (lenderId) {
  const now = new Date();
  return this.find({
    lenderId,
    status: 'active',
    effectiveFrom: { $lte: now },
    $or: [
      { effectiveUntil: null },
      { effectiveUntil: { $gte: now } },
    ],
  }).sort({ productCategory: 1, productName: 1 });
};

// Find products eligible for a given loan amount
loanProductSchema.statics.getEligibleForAmount = async function (amount, filters = {}) {
  const now = new Date();
  const query = {
    status: 'active',
    minAmount: { $lte: amount },
    maxAmount: { $gte: amount },
    effectiveFrom: { $lte: now },
    $or: [
      { effectiveUntil: null },
      { effectiveUntil: { $gte: now } },
    ],
    ...filters,
  };
  return this.find(query).sort({ interestRate: 1 });
};

// ============================================
// PRE-SAVE
// ============================================
loanProductSchema.pre('save', function (next) {
  this.updatedAt = new Date();

  if (!this.productId) {
    this.productId = `LP_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }

  // Auto-set publishedAt when status changes to 'active'
  if (this.status === 'active' && !this.publishedAt) {
    this.publishedAt = new Date();
    this.activatedAt = new Date();
  }

  // Validate min < max
  if (this.minAmount >= this.maxAmount) {
    return next(new Error('minAmount must be less than maxAmount'));
  }

  // Validate tenure
  if (this.minTenureMonths >= this.maxTenureMonths) {
    return next(new Error('minTenureMonths must be less than maxTenureMonths'));
  }

  next();
});

module.exports = mongoose.model('LoanProduct', loanProductSchema);
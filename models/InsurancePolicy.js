const mongoose = require('mongoose');

const InsurancePolicySchema = new mongoose.Schema({
  // ============================================
  // REFERENCES
  // ============================================
  
  bookingId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Booking', 
    required: true 
  },
  planId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'InsurancePlan', 
    required: true 
  },
  companyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  userId: { 
    type: String, 
    required: true 
  },
  
  // ============================================
  // POLICY DETAILS
  // ============================================
  
  policyNumber: { type: String, unique: true },
  policyName: { type: String, required: true },
  policyType: { 
    type: String, 
    enum: [
      'individual', 
      'family_floater', 
      'critical_illness', 
      'senior_citizen', 
      'maternity',
      'personal_accident',
      'travel'
    ],
    required: true 
  },
  policyCode: { type: String },
  
  // ============================================
  // COVERAGE
  // ============================================
  
  sumInsured: { type: Number, required: true },
  roomRentLimit: { type: String },
  icuCoverage: { type: Boolean, default: true },
  icuLimit: { type: Number },
  
  // ============================================
  // PREMIUM DETAILS
  // ============================================
  
  premiumAmount: { type: Number, required: true },
  gstAmount: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  
  // ============================================
  // COMMISSION
  // ============================================
  
  platformCommission: { type: Number },
  platformCommissionRate: { type: Number },
  payoutToCompany: { type: Number },
  agentCommission: { type: Number },
  agentCommissionRate: { type: Number },
  
  // ============================================
  // MEMBERS (for family floater)
  // ============================================
  
  members: [{
    name: { type: String, required: true },
    relation: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    aadhaar: { type: String },
    pan: { type: String },
    dateOfBirth: { type: Date },
    isSmoker: { type: Boolean, default: false },
    isPrimary: { type: Boolean, default: false }
  }],
  
  // ============================================
  // PRIMARY INSURED
  // ============================================
  
  primaryInsured: {
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    dateOfBirth: { type: Date },
    aadhaar: { type: String },
    pan: { type: String },
    occupation: { type: String },
    income: { type: Number },
    isSmoker: { type: Boolean, default: false }
  },
  
  // ============================================
  // NOMINEE
  // ============================================
  
  nominee: {
    name: { type: String },
    relation: { type: String },
    age: { type: Number },
    contactNumber: { type: String },
    address: { type: String }
  },
  
  // ============================================
  // DATES
  // ============================================
  
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  renewalDate: { type: Date },
  freeLookPeriodEnd: { type: Date }, // 15 days from start
  gracePeriodEnd: { type: Date }, // 30 days after end date
  
  // ============================================
  // STATUS
  // ============================================
  
  status: { 
    type: String, 
    enum: [
      'pending', 
      'active', 
      'expired', 
      'cancelled', 
      'suspended',
      'lapsed',
      'surrendered',
      'paid_up'
    ],
    default: 'pending' 
  },
  
  // ============================================
  // PAYMENT STATUS
  // ============================================
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  
  // ============================================
  // SETTLEMENT STATUS
  // ============================================
  
  settlementStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  settlementDate: { type: Date },
  settlementTransactionId: { type: String },
  
  // ============================================
  // DOCUMENTS
  // ============================================
  
  policyDocumentUrl: { type: String },
  certificateUrl: { type: String },
  proposalFormUrl: { type: String },
  welcomeKitUrl: { type: String },
  policyScheduleUrl: { type: String },
  
  // ============================================
  // ADD-ONS SELECTED
  // ============================================
  
  selectedAddons: [{
    name: { type: String },
    price: { type: Number },
    coverage: { type: String }
  }],
  
  // ============================================
  // CLAIMS
  // ============================================
  
  claims: [{
    claimId: { type: String },
    claimNumber: { type: String },
    date: { type: Date },
    amount: { type: Number },
    approvedAmount: { type: Number },
    status: { 
      type: String, 
      enum: [
        'initiated', 
        'document_uploaded', 
        'under_review', 
        'approved', 
        'rejected', 
        'settled',
        'pending_documents'
      ]
    },
    description: { type: String },
    hospitalName: { type: String },
    hospitalAddress: { type: String },
    admissionDate: { type: Date },
    dischargeDate: { type: Date },
    documents: [{ type: String }],
    rejectionReason: { type: String },
    settledDate: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],
  
  // ============================================
  // RENEWAL HISTORY
  // ============================================
  
  renewals: [{
    policyNumber: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    premiumAmount: { type: Number },
    paymentId: { type: String },
    transactionId: { type: String },
    renewedAt: { type: Date, default: Date.now }
  }],
  
  // ============================================
  // PAYMENT HISTORY
  // ============================================
  
  paymentHistory: [{
    transactionId: { type: String },
    amount: { type: Number },
    paymentMethod: { type: String },
    paymentDate: { type: Date },
    status: { type: String },
    razorpayPaymentId: { type: String },
    razorpayOrderId: { type: String }
  }],
  
  // ============================================
  // COMMUNICATION
  // ============================================
  
  communications: [{
    type: { type: String }, // email, sms, call
    sentAt: { type: Date, default: Date.now },
    subject: { type: String },
    content: { type: String },
    status: { type: String }
  }],
  
  // ============================================
  // POLICY TERMS
  // ============================================
  
  termsAccepted: { type: Boolean, default: false },
  termsAcceptedAt: { type: Date },
  termsVersion: { type: String },
  
  // ============================================
  // PROPOSAL DETAILS
  // ============================================
  
  proposalNumber: { type: String },
  proposalDate: { type: Date },
  proposalFormData: { type: mongoose.Schema.Types.Mixed },
  
  // ============================================
  // DECLARATIONS
  // ============================================
  
  declarations: {
    medicalHistoryDeclared: { type: Boolean, default: false },
    preExistingDeclared: { type: Boolean, default: false },
    occupationalHazardsDeclared: { type: Boolean, default: false },
    familyHistoryDeclared: { type: Boolean, default: false }
  },
  
  // ============================================
  // MEDICAL HISTORY
  // ============================================
  
  medicalHistory: {
    chronicDiseases: [{ type: String }],
    pastSurgeries: [{ type: String }],
    currentMedications: [{ type: String }],
    familyHistory: [{ type: String }],
    lifestyle: {
      smoking: { type: Boolean, default: false },
      alcohol: { type: Boolean, default: false },
      exercise: { type: String },
      dietType: { type: String }
    }
  },
  
  // ============================================
  // UNDERWRITING
  // ============================================
  
  underwritingStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'needs_review'],
    default: 'pending'
  },
  underwritingNotes: { type: String },
  underwritingDate: { type: Date },
  underwrittenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // ============================================
  // CANCELLATION
  // ============================================
  
  cancellationReason: { type: String },
  cancellationDate: { type: Date },
  refundAmount: { type: Number },
  refundProcessedAt: { type: Date },
  
  // ============================================
  // AUDIT
  // ============================================
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// ============================================
// INDEXES
// ============================================

InsurancePolicySchema.index({ policyNumber: 1 });
InsurancePolicySchema.index({ userId: 1 });
InsurancePolicySchema.index({ companyId: 1 });
InsurancePolicySchema.index({ planId: 1 });
InsurancePolicySchema.index({ bookingId: 1 });
InsurancePolicySchema.index({ status: 1 });
InsurancePolicySchema.index({ paymentStatus: 1 });
InsurancePolicySchema.index({ startDate: -1, endDate: -1 });
InsurancePolicySchema.index({ 'members.aadhaar': 1 });
InsurancePolicySchema.index({ 'primaryInsured.aadhaar': 1 });
InsurancePolicySchema.index({ claimStatus: 1 });
InsurancePolicySchema.index({ settlementStatus: 1 });

// ============================================
// COMPOUND INDEXES
// ============================================

InsurancePolicySchema.index({ userId: 1, status: 1 });
InsurancePolicySchema.index({ companyId: 1, status: 1 });
InsurancePolicySchema.index({ userId: 1, startDate: -1 });

// ============================================
// PRE-SAVE HOOKS
// ============================================

InsurancePolicySchema.pre('save', function(next) {
  // Auto-generate policy number
  if (!this.policyNumber) {
    const prefix = 'POL';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.policyNumber = `${prefix}${timestamp}${random}`;
  }
  
  // Set free-look period end (15 days from start)
  if (this.startDate && !this.freeLookPeriodEnd) {
    this.freeLookPeriodEnd = new Date(this.startDate);
    this.freeLookPeriodEnd.setDate(this.freeLookPeriodEnd.getDate() + 15);
  }
  
  // Set grace period end (30 days after end date)
  if (this.endDate && !this.gracePeriodEnd) {
    this.gracePeriodEnd = new Date(this.endDate);
    this.gracePeriodEnd.setDate(this.gracePeriodEnd.getDate() + 30);
  }
  
  this.updatedAt = new Date();
  next();
});

// ============================================
// VIRTUAL FIELDS
// ============================================

InsurancePolicySchema.virtual('isActive').get(function() {
  return this.status === 'active' && new Date() <= this.endDate;
});

InsurancePolicySchema.virtual('isExpired').get(function() {
  return this.status === 'expired' || (new Date() > this.endDate && this.status !== 'cancelled');
});

InsurancePolicySchema.virtual('isLapsed').get(function() {
  return this.status === 'lapsed';
});

InsurancePolicySchema.virtual('isCancelled').get(function() {
  return this.status === 'cancelled';
});

InsurancePolicySchema.virtual('daysRemaining').get(function() {
  if (!this.isActive) return 0;
  const now = new Date();
  const diff = this.endDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

InsurancePolicySchema.virtual('monthsRemaining').get(function() {
  if (!this.isActive) return 0;
  return Math.floor(this.daysRemaining / 30);
});

InsurancePolicySchema.virtual('policyAge').get(function() {
  if (!this.startDate) return 0;
  const diff = Date.now() - this.startDate;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

InsurancePolicySchema.virtual('policyAgeInMonths').get(function() {
  return Math.floor(this.policyAge / 30);
});

InsurancePolicySchema.virtual('totalMembers').get(function() {
  return this.members ? this.members.length : 0;
});

InsurancePolicySchema.virtual('hasClaimHistory').get(function() {
  return this.claims && this.claims.length > 0;
});

InsurancePolicySchema.virtual('totalClaimAmount').get(function() {
  if (!this.claims) return 0;
  return this.claims.reduce((sum, claim) => sum + (claim.amount || 0), 0);
});

InsurancePolicySchema.virtual('totalClaimSettled').get(function() {
  if (!this.claims) return 0;
  return this.claims
    .filter(claim => claim.status === 'settled')
    .reduce((sum, claim) => sum + (claim.approvedAmount || 0), 0);
});

InsurancePolicySchema.virtual('isWithinFreeLookPeriod').get(function() {
  if (!this.startDate) return false;
  const now = new Date();
  const daysSinceStart = Math.ceil((now - this.startDate) / (1000 * 60 * 60 * 24));
  return daysSinceStart <= 15 && this.status !== 'cancelled';
});

InsurancePolicySchema.virtual('needsRenewal').get(function() {
  if (this.status === 'cancelled' || this.status === 'expired') return false;
  const daysBeforeExpiry = this.daysRemaining;
  return daysBeforeExpiry <= 30 && daysBeforeExpiry >= 0;
});

InsurancePolicySchema.virtual('isGracePeriodActive').get(function() {
  if (this.status !== 'expired') return false;
  if (!this.gracePeriodEnd) return false;
  return new Date() <= this.gracePeriodEnd;
});

// ============================================
// METHODS
// ============================================

InsurancePolicySchema.methods.renew = function(premiumAmount, paymentId, transactionId) {
  if (this.status === 'cancelled') {
    throw new Error('Cannot renew a cancelled policy');
  }
  
  const newStartDate = new Date(this.endDate);
  const newEndDate = new Date(this.endDate);
  newEndDate.setFullYear(newEndDate.getFullYear() + 1);
  
  this.renewals.push({
    policyNumber: this.policyNumber,
    startDate: this.startDate,
    endDate: this.endDate,
    premiumAmount: this.premiumAmount,
    paymentId: paymentId,
    transactionId: transactionId,
    renewedAt: new Date()
  });
  
  this.startDate = newStartDate;
  this.endDate = newEndDate;
  this.renewalDate = new Date();
  this.premiumAmount = premiumAmount || this.premiumAmount;
  this.status = 'active';
  this.paymentStatus = 'paid';
  
  this.paymentHistory.push({
    transactionId: transactionId,
    amount: premiumAmount || this.premiumAmount,
    paymentMethod: 'razorpay',
    paymentDate: new Date(),
    status: 'paid',
    razorpayPaymentId: paymentId
  });
  
  return this.save();
};

InsurancePolicySchema.methods.cancel = function(reason, refundAmount) {
  if (this.status === 'cancelled') {
    throw new Error('Policy is already cancelled');
  }
  
  if (this.status === 'active' && this.isWithinFreeLookPeriod) {
    // Full refund within free-look period
    this.status = 'cancelled';
    this.cancellationReason = reason;
    this.cancellationDate = new Date();
    this.refundAmount = refundAmount || this.totalAmount;
    this.status = 'cancelled';
    this.paymentStatus = 'refunded';
  } else if (this.status === 'active') {
    // Pro-rated refund after free-look period
    this.status = 'cancelled';
    this.cancellationReason = reason;
    this.cancellationDate = new Date();
    this.refundAmount = refundAmount || 0;
  } else {
    this.status = 'cancelled';
    this.cancellationReason = reason;
    this.cancellationDate = new Date();
  }
  
  return this.save();
};

InsurancePolicySchema.methods.addClaim = function(claimData) {
  const claimId = `CLM${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  
  this.claims.push({
    claimId: claimId,
    claimNumber: claimId,
    date: new Date(),
    amount: claimData.amount,
    status: 'initiated',
    description: claimData.description,
    hospitalName: claimData.hospitalName,
    hospitalAddress: claimData.hospitalAddress,
    admissionDate: claimData.admissionDate,
    documents: claimData.documents || []
  });
  
  return this.save();
};

InsurancePolicySchema.methods.updateClaimStatus = function(claimId, status, notes) {
  const claim = this.claims.find(c => c.claimId === claimId || c.claimNumber === claimId);
  if (!claim) {
    throw new Error('Claim not found');
  }
  
  claim.status = status;
  if (status === 'settled') {
    claim.settledDate = new Date();
  }
  
  if (notes) {
    claim.notes = notes;
  }
  
  return this.save();
};

InsurancePolicySchema.methods.getClaim = function(claimId) {
  return this.claims.find(c => c.claimId === claimId || c.claimNumber === claimId);
};

InsurancePolicySchema.methods.getActiveClaims = function() {
  return this.claims.filter(c => 
    ['initiated', 'document_uploaded', 'under_review', 'pending_documents'].includes(c.status)
  );
};

InsurancePolicySchema.methods.getSettledClaims = function() {
  return this.claims.filter(c => c.status === 'settled');
};

InsurancePolicySchema.methods.getAddonTotal = function() {
  if (!this.selectedAddons) return 0;
  return this.selectedAddons.reduce((sum, addon) => sum + (addon.price || 0), 0);
};

// ============================================
// STATIC METHODS
// ============================================

InsurancePolicySchema.statics.findActivePolicies = function(userId) {
  const query = { status: 'active' };
  if (userId) query.userId = userId;
  return this.find(query)
    .populate('planId', 'planName planType sumInsured')
    .populate('companyId', 'name companyLogo')
    .sort({ startDate: -1 });
};

InsurancePolicySchema.statics.findExpiringPolicies = function(days = 30) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  
  return this.find({
    status: 'active',
    endDate: { $lte: expiryDate, $gte: new Date() }
  })
    .populate('planId', 'planName')
    .populate('companyId', 'name');
};

InsurancePolicySchema.statics.findExpiredPolicies = function() {
  return this.find({
    status: { $ne: 'cancelled' },
    endDate: { $lt: new Date() }
  })
    .populate('planId', 'planName')
    .populate('companyId', 'name');
};

InsurancePolicySchema.statics.findByCompany = function(companyId) {
  return this.find({ companyId })
    .populate('planId', 'planName planType')
    .sort({ createdAt: -1 });
};

InsurancePolicySchema.statics.findByUserId = function(userId) {
  return this.find({ userId })
    .populate('planId', 'planName planType sumInsured features')
    .populate('companyId', 'name companyLogo')
    .sort({ createdAt: -1 });
};

InsurancePolicySchema.statics.getPolicyStats = function(companyId) {
  const match = companyId ? { companyId } : {};
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalPremium: { $sum: '$premiumAmount' },
        totalCommission: { $sum: '$platformCommission' }
      }
    }
  ]);
};

InsurancePolicySchema.statics.getMonthlySales = function(year, companyId) {
  const match = {
    createdAt: {
      $gte: new Date(year, 0, 1),
      $lte: new Date(year, 11, 31)
    }
  };
  if (companyId) match.companyId = companyId;
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $month: '$createdAt' },
        count: { $sum: 1 },
        totalPremium: { $sum: '$premiumAmount' },
        totalCommission: { $sum: '$platformCommission' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

module.exports = mongoose.model('InsurancePolicy', InsurancePolicySchema);
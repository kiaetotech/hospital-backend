const mongoose = require('mongoose');

const InsurancePolicySchema = new mongoose.Schema({
  // ============================================
  // REFERENCES
  // ============================================
  
  bookingId: { 
    type.Schema.Types.ObjectId, 
    ref: 'Booking', 
    required},
  planId: { 
    type.Schema.Types.ObjectId, 
    ref: 'InsurancePlan', 
    required},
  companyId: { 
    type.Schema.Types.ObjectId, 
    ref: 'User', 
    required},
  userId: { 
    type, 
    required},
  
  // ============================================
  // POLICY DETAILS
  // ============================================
  
  policyNumber: { type, unique},
  policyName: { type, required},
  policyType: { 
    type, 
    enum: [
      'individual', 
      'family_floater', 
      'critical_illness', 
      'senior_citizen', 
      'maternity',
      'personal_accident',
      'travel'
    ],
    required},
  policyCode: { type},
  
  // ============================================
  // COVERAGE
  // ============================================
  
  sumInsured: { type, required},
  roomRentLimit: { type},
  icuCoverage: { type, default},
  icuLimit: { type},
  
  // ============================================
  // PREMIUM DETAILS
  // ============================================
  
  premiumAmount: { type, required},
  gstAmount: { type, required},
  discountAmount: { type, default: 0 },
  totalAmount: { type, required},
  
  // ============================================
  // COMMISSION
  // ============================================
  
  platformCommission: { type},
  platformCommissionRate: { type},
  payoutToCompany: { type},
  agentCommission: { type},
  agentCommissionRate: { type},
  
  // ============================================
  // MEMBERS (for family floater)
  // ============================================
  
  members: [{
    name: { type, required},
    relation: { type, required},
    age: { type, required},
    gender: { type, enum: ['male', 'female', 'other'] },
    aadhaar: { type},
    pan: { type},
    dateOfBirth: { type},
    isSmoker: { type, default},
    isPrimary: { type, default}
  }],
  
  // ============================================
  // PRIMARY INSURED
  // ============================================
  
  primaryInsured: {
    name: { type, required},
    age: { type, required},
    gender: { type, required},
    dateOfBirth: { type},
    aadhaar: { type},
    pan: { type},
    occupation: { type},
    income: { type},
    isSmoker: { type, default}
  },
  
  // ============================================
  // NOMINEE
  // ============================================
  
  nominee: {
    name: { type},
    relation: { type},
    age: { type},
    contactNumber: { type},
    address: { type}
  },
  
  // ============================================
  // DATES
  // ============================================
  
  startDate: { type, required},
  endDate: { type, required},
  renewalDate: { type},
  freeLookPeriodEnd: { type}, // 15 days from start
  gracePeriodEnd: { type}, // 30 days after end date
  
  // ============================================
  // STATUS
  // ============================================
  
  status: { 
    type, 
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
    type,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  
  // ============================================
  // SETTLEMENT STATUS
  // ============================================
  
  settlementStatus: {
    type,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  settlementDate: { type},
  settlementTransactionId: { type},
  
  // ============================================
  // DOCUMENTS
  // ============================================
  
  policyDocumentUrl: { type},
  certificateUrl: { type},
  proposalFormUrl: { type},
  welcomeKitUrl: { type},
  policyScheduleUrl: { type},
  
  // ============================================
  // ADD-ONS SELECTED
  // ============================================
  
  selectedAddons: [{
    name: { type},
    price: { type},
    coverage: { type}
  }],
  
  // ============================================
  // CLAIMS
  // ============================================
  
  claims: [{
    claimId: { type},
    claimNumber: { type},
    date: { type},
    amount: { type},
    approvedAmount: { type},
    status: { 
      type, 
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
    description: { type},
    hospitalName: { type},
    hospitalAddress: { type},
    admissionDate: { type},
    dischargeDate: { type},
    documents: [{ type}],
    rejectionReason: { type},
    settledDate: { type},
    createdAt: { type, default.now },
    updatedAt: { type, default.now }
  }],
  
  // ============================================
  // RENEWAL HISTORY
  // ============================================
  
  renewals: [{
    policyNumber: { type},
    startDate: { type},
    endDate: { type},
    premiumAmount: { type},
    paymentId: { type},
    transactionId: { type},
    renewedAt: { type, default.now }
  }],
  
  // ============================================
  // PAYMENT HISTORY
  // ============================================
  
  paymentHistory: [{
    transactionId: { type},
    amount: { type},
    paymentMethod: { type},
    paymentDate: { type},
    status: { type},
    razorpayPaymentId: { type},
    razorpayOrderId: { type}
  }],
  
  // ============================================
  // COMMUNICATION
  // ============================================
  
  communications: [{
    type: { type}, // email, sms, call
    sentAt: { type, default.now },
    subject: { type},
    content: { type},
    status: { type}
  }],
  
  // ============================================
  // POLICY TERMS
  // ============================================
  
  termsAccepted: { type, default},
  termsAcceptedAt: { type},
  termsVersion: { type},
  
  // ============================================
  // PROPOSAL DETAILS
  // ============================================
  
  proposalNumber: { type},
  proposalDate: { type},
  proposalFormData: { type.Schema.Types.Mixed },
  
  // ============================================
  // DECLARATIONS
  // ============================================
  
  declarations: {
    medicalHistoryDeclared: { type, default},
    preExistingDeclared: { type, default},
    occupationalHazardsDeclared: { type, default},
    familyHistoryDeclared: { type, default}
  },
  
  // ============================================
  // MEDICAL HISTORY
  // ============================================
  
  medicalHistory: {
    chronicDiseases: [{ type}],
    pastSurgeries: [{ type}],
    currentMedications: [{ type}],
    familyHistory: [{ type}],
    lifestyle: {
      smoking: { type, default},
      alcohol: { type, default},
      exercise: { type},
      dietType: { type}
    }
  },
  
  // ============================================
  // UNDERWRITING
  // ============================================
  
  underwritingStatus: {
    type,
    enum: ['pending', 'approved', 'rejected', 'needs_review'],
    default: 'pending'
  },
  underwritingNotes: { type},
  underwritingDate: { type},
  underwrittenBy: { type.Schema.Types.ObjectId, ref: 'User' },
  
  // ============================================
  // CANCELLATION
  // ============================================
  
  cancellationReason: { type},
  cancellationDate: { type},
  refundAmount: { type},
  refundProcessedAt: { type},
  
  // ============================================
  // AUDIT
  // ============================================
  
  createdAt: { type, default.now },
  updatedAt: { type, default.now },
  createdBy: { type.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps});

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
    policyNumber.policyNumber,
    startDate.startDate,
    endDate.endDate,
    premiumAmount.premiumAmount,
    paymentId,
    transactionId,
    renewedAtDate()
  });
  
  this.startDate = newStartDate;
  this.endDate = newEndDate;
  this.renewalDate = new Date();
  this.premiumAmount = premiumAmount || this.premiumAmount;
  this.status = 'active';
  this.paymentStatus = 'paid';
  
  this.paymentHistory.push({
    transactionId,
    amount|| this.premiumAmount,
    paymentMethod: 'razorpay',
    paymentDateDate(),
    status: 'paid',
    razorpayPaymentId});
  
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
    claimId,
    claimNumber,
    dateDate(),
    amount.amount,
    status: 'initiated',
    description.description,
    hospitalName.hospitalName,
    hospitalAddress.hospitalAddress,
    admissionDate.admissionDate,
    documents.documents || []
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
    endDate: { $lte, $gteDate() }
  })
    .populate('planId', 'planName')
    .populate('companyId', 'name');
};

InsurancePolicySchema.statics.findExpiredPolicies = function() {
  return this.find({
    status: { $ne: 'cancelled' },
    endDate: { $ltDate() }
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
    { $match},
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
      $gteDate(year, 0, 1),
      $lteDate(year, 11, 31)
    }
  };
  if (companyId) match.companyId = companyId;
  
  return this.aggregate([
    { $match},
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


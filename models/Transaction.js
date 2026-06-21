const mongoose = require('mongoose');

// ============================================
// TRANSACTION MODEL - Updated with Razorpay Support
// ============================================

const transactionSchema = new mongoose.Schema({
  // ============================================
  // YOUR EXISTING FIELDS (ALL PRESERVED)
  // ============================================
  
  transactionId: { type: String, unique: true, required: true },
  applicationId: { type: String, required: true },
  lenderId: { type: String, required: true },
  
  type: { 
    type: String, 
    enum: [
      'disbursal', 
      'commission_payment', 
      'refund', 
      'booking_payment', 
      'subscription', 
      'payout',
      'insurance_premium'  // ✅ NEW INSURANCE TYPE
    ] 
  },
  amount: Number,
  commissionAmount: Number,  // Platform commission from this transaction
  
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'initiated', 'captured', 'refunded', 'partially_refunded'], 
    default: 'pending' 
  },
  
  // Payment details
  paymentGateway: String,  // 'razorpay', 'bank_transfer', etc.
  gatewayReferenceId: String,
  utrNumber: String,
  
  // Bank account details
  fromAccount: {
    bankName: String,
    accountNumber: String,
    ifsc: String
  },
  toAccount: {
    bankName: String,
    accountNumber: String,
    ifsc: String
  },
  
  initiatedAt: Date,
  completedAt: Date,
  
  webhookReceived: { type: Boolean, default: false },
  
  // ============================================
  // NEW PAYMENT-RELATED FIELDS (ADDED)
  // ============================================
  
  // Razorpay specific fields
  orderId: { type: String },
  paymentId: { type: String },
  refundId: { type: String },
  razorpaySignature: { type: String },
  
  // Booking/Service details (for non-loan transactions)
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  bookingType: { 
    type: String, 
    enum: [
      'opd', 
      'admission', 
      'ambulance', 
      'labtest', 
      'health_package', 
      'caregiver', 
      'loan',
      'insurance'  // ✅ NEW INSURANCE TYPE
    ] 
  },
  userId: { type: String }, // Patient/User ID
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' }, // Hospital/Lab/Caregiver
  
  // Amount details
  originalAmount: { type: Number },
  discountAmount: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  convenienceFee: { type: Number, default: 0 },
  netAmount: { type: Number },
  refundAmount: { type: Number, default: 0 },
  
  // Payment method
  paymentMethod: { type: String, enum: ['card', 'upi', 'netbanking', 'wallet', 'emi', 'bank_transfer'] },
  
  // Discount details
  discountCode: { type: String },
  discountType: { type: String, enum: ['percentage', 'fixed'] },
  discountValue: { type: Number },
  
  // Commission & Settlement
  platformCommission: { type: Number, default: 0 },
  providerAmount: { type: Number, default: 0 }, // Amount to settle to provider
  commissionStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  commissionPaidAt: { type: Date },
  commissionPaymentId: { type: String },
  
  settledToProvider: { type: Boolean, default: false },
  settledAt: { type: Date },
  settlementId: { type: String },
  settlementAmount: { type: Number },
  
  // Payment failure details
  failureReason: { type: String },
  failureCode: { type: String },
  paymentAttempts: { type: Number, default: 0 },
  
  // Timestamps
  paidAt: { type: Date },
  refundedAt: { type: Date },
  updatedAt: { type: Date, default: Date.now },
  
  // Metadata
  notes: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  webhookPayload: { type: mongoose.Schema.Types.Mixed },

  // ============================================
  // NEW INSURANCE-SPECIFIC FIELDS (ADDED)
  // ============================================
  
  // Insurance policy reference
  insurancePolicyId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePolicy' },
  insurancePlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePlan' },
  
  // Insurance premium details
  premiumAmount: { type: Number },
  gstAmount: { type: Number, default: 0 },
  totalPremium: { type: Number },
  policyNumber: { type: String },
  
  // Insurance commission breakdown
  insuranceCommissionRate: { type: Number, default: 15 }, // Platform commission percentage
  insurancePlatformCommission: { type: Number, default: 0 },
  insurancePayoutToCompany: { type: Number, default: 0 },
  
  // Insurance settlement
  insuranceSettlementStatus: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  insuranceSettlementDate: { type: Date },
  insuranceSettlementTransactionId: { type: String },
  
  // Insurance claim payment
  claimPaymentId: { type: String },
  claimAmount: { type: Number },
  claimSettlementDate: { type: Date },
  
  // Insurance renewal
  isRenewal: { type: Boolean, default: false },
  previousPolicyNumber: { type: String },
  renewalYear: { type: Number }
});

// ============================================
// INDEXES (PRESERVED + NEW)
// ============================================

transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ applicationId: 1 });
transactionSchema.index({ lenderId: 1 });
transactionSchema.index({ orderId: 1 });
transactionSchema.index({ paymentId: 1 });
transactionSchema.index({ bookingId: 1 });
transactionSchema.index({ userId: 1 });
transactionSchema.index({ providerId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ insurancePolicyId: 1 }); // ✅ NEW
transactionSchema.index({ policyNumber: 1 }); // ✅ NEW
transactionSchema.index({ insuranceSettlementStatus: 1 }); // ✅ NEW

// ============================================
// VIRTUAL FIELDS
// ============================================

transactionSchema.virtual('isSuccessful').get(function() {
  return this.status === 'completed' || this.status === 'captured';
});

transactionSchema.virtual('isRefunded').get(function() {
  return this.status === 'refunded' || this.status === 'partially_refunded';
});

transactionSchema.virtual('isPending').get(function() {
  return this.status === 'initiated' || this.status === 'pending';
});

transactionSchema.virtual('balanceDue').get(function() {
  if (this.status === 'completed' || this.status === 'refunded') {
    return 0;
  }
  return this.amount || this.netAmount || 0;
});

// ============================================
// NEW INSURANCE VIRTUAL FIELDS (ADDED)
// ============================================

transactionSchema.virtual('isInsuranceTransaction').get(function() {
  return this.bookingType === 'insurance' || this.type === 'insurance_premium';
});

transactionSchema.virtual('netPayoutToCompany').get(function() {
  if (!this.isInsuranceTransaction) return 0;
  return this.totalPremium - this.insurancePlatformCommission;
});

// ============================================
// METHODS (PRESERVED + NEW)
// ============================================

// Existing method - mark as completed
transactionSchema.methods.markAsCompleted = function(gatewayReferenceId) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.gatewayReferenceId = gatewayReferenceId || this.gatewayReferenceId;
  this.webhookReceived = true;
  this.updatedAt = new Date();
  return this.save();
};

// Existing method - mark as failed
transactionSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.failureReason = reason;
  this.updatedAt = new Date();
  return this.save();
};

// New method - mark as paid
transactionSchema.methods.markAsPaid = function(paymentId, method) {
  this.status = 'completed';
  this.paymentId = paymentId;
  this.paidAt = new Date();
  this.paymentMethod = method || this.paymentMethod;
  this.completedAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

// New method - mark as refunded
transactionSchema.methods.markAsRefunded = function(refundId, amount) {
  this.status = 'refunded';
  this.refundId = refundId;
  this.refundAmount = amount || this.amount;
  this.refundedAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

// New method - mark commission as paid
transactionSchema.methods.markCommissionPaid = function(paymentId) {
  this.commissionStatus = 'paid';
  this.commissionPaidAt = new Date();
  this.commissionPaymentId = paymentId;
  this.updatedAt = new Date();
  return this.save();
};

// ============================================
// NEW INSURANCE-SPECIFIC METHODS (ADDED)
// ============================================

transactionSchema.methods.markInsuranceSettlementCompleted = function(transactionId) {
  this.insuranceSettlementStatus = 'completed';
  this.insuranceSettlementDate = new Date();
  this.insuranceSettlementTransactionId = transactionId;
  this.settledToProvider = true;
  this.settledAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.markInsuranceCommissionPaid = function(paymentId) {
  this.commissionStatus = 'paid';
  this.commissionPaidAt = new Date();
  this.commissionPaymentId = paymentId;
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.calculateInsuranceCommission = function() {
  if (!this.isInsuranceTransaction) return 0;
  const rate = this.insuranceCommissionRate || 15;
  this.insurancePlatformCommission = (this.totalPremium * rate) / 100;
  this.insurancePayoutToCompany = this.totalPremium - this.insurancePlatformCommission;
  this.platformCommission = this.insurancePlatformCommission;
  this.providerAmount = this.insurancePayoutToCompany;
  return {
    platformCommission: this.insurancePlatformCommission,
    payoutToCompany: this.insurancePayoutToCompany,
    commissionRate: rate
  };
};

// ============================================
// STATIC METHODS
// ============================================

transactionSchema.statics.generateTransactionId = function() {
  const prefix = 'TXN';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}_${timestamp}_${random}`;
};

// ============================================
// NEW INSURANCE STATIC METHODS (ADDED)
// ============================================

transactionSchema.statics.getInsuranceTransactions = function(userId) {
  return this.find({ 
    userId: userId, 
    bookingType: 'insurance' 
  }).sort({ createdAt: -1 });
};

transactionSchema.statics.getInsuranceSettlements = function(status) {
  const query = { bookingType: 'insurance' };
  if (status) {
    query.insuranceSettlementStatus = status;
  }
  return this.find(query).sort({ createdAt: -1 });
};

// ============================================
// PRE-SAVE HOOK
// ============================================

transactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
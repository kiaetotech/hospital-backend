const mongoose = require('mongoose');

// ============================================
// TRANSACTION MODEL - Updated with Full Healthcare Support
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
      'insurance_premium',
      'opd_booking',        // 🆕
      'admission_booking',  // 🆕
      'advance_payment',    // 🆕
      'settlement_payment'  // 🆕
    ] 
  },
  amount: Number,
  commissionAmount: Number,
  
  status: { 
    type: String, 
    enum: [
      'pending', 'completed', 'failed', 'initiated', 
      'captured', 'refunded', 'partially_refunded',
      'processing', 'settled'  // 🆕
    ], 
    default: 'pending' 
  },
  
  // Payment details
  paymentGateway: String,
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
  // EXISTING PAYMENT FIELDS (PRESERVED)
  // ============================================
  
  orderId: { type: String },
  paymentId: { type: String },
  refundId: { type: String },
  razorpaySignature: { type: String },
  
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
      'insurance'
    ] 
  },
  userId: { type: String },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },
  
  // Amount details
  originalAmount: { type: Number },
  discountAmount: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },  // 🆕 GST specific
  convenienceFee: { type: Number, default: 0 },
  netAmount: { type: Number },
  refundAmount: { type: Number, default: 0 },
  
  // Payment method
  paymentMethod: { type: String, enum: ['card', 'upi', 'netbanking', 'wallet', 'emi', 'bank_transfer', 'cod'] },
  
  // Discount details
  discountCode: { type: String },
  discountType: { type: String, enum: ['percentage', 'fixed'] },
  discountValue: { type: Number },
  
  // Commission & Settlement
  platformCommission: { type: Number, default: 0 },
  providerAmount: { type: Number, default: 0 },
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
  createdAt: { type: Date, default: Date.now },  // 🆕
  
  // Metadata
  notes: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  webhookPayload: { type: mongoose.Schema.Types.Mixed },

  // ============================================
  // EXISTING INSURANCE FIELDS (PRESERVED)
  // ============================================
  
  insurancePolicyId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePolicy' },
  insurancePlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePlan' },
  
  premiumAmount: { type: Number },
  totalPremium: { type: Number },
  policyNumber: { type: String },
  
  insuranceCommissionRate: { type: Number, default: 15 },
  insurancePlatformCommission: { type: Number, default: 0 },
  insurancePayoutToCompany: { type: Number, default: 0 },
  
  insuranceSettlementStatus: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  insuranceSettlementDate: { type: Date },
  insuranceSettlementTransactionId: { type: String },
  
  claimPaymentId: { type: String },
  claimAmount: { type: Number },
  claimSettlementDate: { type: Date },
  
  isRenewal: { type: Boolean, default: false },
  previousPolicyNumber: { type: String },
  renewalYear: { type: Number },

  // ============================================
  // 🆕 HOSPITAL/OPD/ADMISSION SPECIFIC FIELDS
  // ============================================
  
  // Hospital reference
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
  hospitalName: { type: String },
  
  // Doctor details
  doctorName: { type: String },
  doctorSpecialization: { type: String },
  
  // Patient details
  patientName: { type: String },
  patientPhone: { type: String },
  
  // Admission specific
  roomType: { type: String },
  numberOfDays: { type: Number },
  advancePercentage: { type: Number, default: 25 },
  
  // GST breakdown
  gst: {
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    totalGst: { type: Number, default: 0 }
  },
  
  // ============================================
  // 🆕 REFUND BREAKDOWN (ADDED)
  // ============================================
  
  refund: {
    initiatedBy: { type: String, enum: ['patient', 'provider', 'admin', 'system'] },
    initiatedAt: { type: Date },
    reason: { type: String },
    refundType: { type: String, enum: ['full', 'partial', 'advance_only'] },
    refundPercentage: { type: Number },
    cancellationFee: { type: Number, default: 0 },
    platformFeeRefunded: { type: Number, default: 0 },
    gstRefunded: { type: Number, default: 0 },
    processedBy: { type: String },
    processedAt: { type: Date },
    refundMode: { type: String, enum: ['auto', 'manual', 'gateway'] },
    gatewayRefundId: { type: String },
    gatewayRefundStatus: { type: String }
  },
  
  // ============================================
  // 🆕 INVOICE DETAILS (ADDED)
  // ============================================
  
  invoice: {
    invoiceNumber: { type: String },
    invoiceDate: { type: Date },
    invoiceUrl: { type: String },
    gstin: { type: String },
    hsnCode: { type: String },
    placeOfSupply: { type: String }
  },
  
  // ============================================
  // 🆕 SETTLEMENT TRACKING (ADDED)
  // ============================================
  
  settlement: {
    scheduledDate: { type: Date },
    actualSettlementDate: { type: Date },
    settlementMode: { type: String, enum: ['neft', 'rtgs', 'imps', 'upi', 'bank_transfer'] },
    settlementReference: { type: String },
    settlementStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'on_hold'] },
    holdReason: { type: String },
    settlementNotes: { type: String }
  },
  
  // ============================================
  // 🆕 RECONCILIATION FIELDS (ADDED)
  // ============================================
  
  reconciliation: {
    status: { type: String, enum: ['pending', 'matched', 'mismatch', 'not_required'] },
    reconciledAt: { type: Date },
    reconciledBy: { type: String },
    mismatchReason: { type: String },
    adjustmentAmount: { type: Number, default: 0 },
    adjustmentNote: { type: String }
  }
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
transactionSchema.index({ insurancePolicyId: 1 });
transactionSchema.index({ policyNumber: 1 });
transactionSchema.index({ insuranceSettlementStatus: 1 });
transactionSchema.index({ hospitalId: 1 });          // 🆕
transactionSchema.index({ 'refund.gatewayRefundId': 1 });  // 🆕
transactionSchema.index({ 'settlement.settlementStatus': 1 }); // 🆕
transactionSchema.index({ 'invoice.invoiceNumber': 1 }); // 🆕
transactionSchema.index({ paidAt: -1 });             // 🆕
transactionSchema.index({ refundedAt: -1 });         // 🆕

// ============================================
// VIRTUAL FIELDS (PRESERVED + NEW)
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

transactionSchema.virtual('isInsuranceTransaction').get(function() {
  return this.bookingType === 'insurance' || this.type === 'insurance_premium';
});

transactionSchema.virtual('netPayoutToCompany').get(function() {
  if (!this.isInsuranceTransaction) return 0;
  return this.totalPremium - this.insurancePlatformCommission;
});

// 🆕 New virtuals
transactionSchema.virtual('isHospitalBooking').get(function() {
  return ['opd', 'admission'].includes(this.bookingType);
});

transactionSchema.virtual('refundableAmount').get(function() {
  if (!this.refundAmount) return this.netAmount || this.amount || 0;
  return this.refundAmount;
});

transactionSchema.virtual('platformEarning').get(function() {
  return this.platformCommission + (this.convenienceFee || 0);
});

transactionSchema.virtual('providerEarning').get(function() {
  return (this.netAmount || this.amount || 0) - (this.platformCommission || 0) - (this.convenienceFee || 0);
});

// ============================================
// METHODS (PRESERVED + NEW)
// ============================================

// Existing methods
transactionSchema.methods.markAsCompleted = function(gatewayReferenceId) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.gatewayReferenceId = gatewayReferenceId || this.gatewayReferenceId;
  this.webhookReceived = true;
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.failureReason = reason;
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.markAsPaid = function(paymentId, method) {
  this.status = 'completed';
  this.paymentId = paymentId;
  this.paidAt = new Date();
  this.paymentMethod = method || this.paymentMethod;
  this.completedAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.markAsRefunded = function(refundId, amount) {
  this.status = 'refunded';
  this.refundId = refundId;
  this.refundAmount = amount || this.amount;
  this.refundedAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.markCommissionPaid = function(paymentId) {
  this.commissionStatus = 'paid';
  this.commissionPaidAt = new Date();
  this.commissionPaymentId = paymentId;
  this.updatedAt = new Date();
  return this.save();
};

// Insurance methods
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
// 🆕 NEW METHODS (ADDED)
// ============================================

// Calculate platform commission for hospital bookings
transactionSchema.methods.calculateHospitalCommission = function(commissionRate = 10) {
  const amount = this.netAmount || this.amount || 0;
  this.platformCommission = Math.round((amount * commissionRate) / 100);
  this.providerAmount = amount - this.platformCommission;
  return {
    platformCommission: this.platformCommission,
    providerAmount: this.providerAmount,
    commissionRate
  };
};

// Process refund
transactionSchema.methods.processRefund = function(refundData) {
  this.status = refundData.refundType === 'full' ? 'refunded' : 'partially_refunded';
  this.refundAmount = refundData.refundAmount || this.netAmount || this.amount;
  this.refundedAt = new Date();
  this.refundId = refundData.gatewayRefundId || this.refundId;
  
  this.refund = {
    initiatedBy: refundData.initiatedBy || 'system',
    initiatedAt: new Date(),
    reason: refundData.reason || 'Refund processed',
    refundType: refundData.refundType || 'full',
    refundPercentage: refundData.refundPercentage || 100,
    cancellationFee: refundData.cancellationFee || 0,
    platformFeeRefunded: refundData.platformFeeRefunded || 0,
    gstRefunded: refundData.gstRefunded || 0,
    processedBy: refundData.processedBy || 'system',
    processedAt: new Date(),
    refundMode: refundData.refundMode || 'gateway',
    gatewayRefundId: refundData.gatewayRefundId,
    gatewayRefundStatus: 'completed'
  };
  
  this.updatedAt = new Date();
  return this.save();
};

// Generate invoice
transactionSchema.methods.generateInvoice = function(invoiceData) {
  this.invoice = {
    invoiceNumber: invoiceData.invoiceNumber || `INV-${this.transactionId}`,
    invoiceDate: new Date(),
    invoiceUrl: invoiceData.invoiceUrl || '',
    gstin: invoiceData.gstin || '',
    hsnCode: invoiceData.hsnCode || '999311',
    placeOfSupply: invoiceData.placeOfSupply || ''
  };
  this.updatedAt = new Date();
  return this.save();
};

// Mark settlement as completed
transactionSchema.methods.markSettlementCompleted = function(reference) {
  this.settlement = {
    ...this.settlement,
    actualSettlementDate: new Date(),
    settlementReference: reference,
    settlementStatus: 'completed'
  };
  this.settledToProvider = true;
  this.settledAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

// Reconcile transaction
transactionSchema.methods.reconcile = function(status, notes) {
  this.reconciliation = {
    status: status || 'matched',
    reconciledAt: new Date(),
    reconciledBy: 'system',
    mismatchReason: status === 'mismatch' ? notes : '',
    adjustmentAmount: 0
  };
  this.updatedAt = new Date();
  return this.save();
};

// ============================================
// STATIC METHODS (PRESERVED + NEW)
// ============================================

transactionSchema.statics.generateTransactionId = function() {
  const prefix = 'TXN';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}_${timestamp}_${random}`;
};

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

// 🆕 Get hospital transactions
transactionSchema.statics.getHospitalTransactions = function(hospitalId, filters = {}) {
  const query = { hospitalId, ...filters };
  return this.find(query).sort({ createdAt: -1 });
};

// 🆕 Get pending settlements
transactionSchema.statics.getPendingSettlements = function() {
  return this.find({
    settledToProvider: false,
    status: { $in: ['completed', 'captured'] },
    providerAmount: { $gt: 0 }
  }).sort({ createdAt: 1 });
};

// 🆕 Get daily revenue report
transactionSchema.statics.getDailyRevenue = function(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: ['completed', 'captured'] }
      }
    },
    {
      $group: {
        _id: '$bookingType',
        totalAmount: { $sum: '$netAmount' },
        totalCommission: { $sum: '$platformCommission' },
        count: { $sum: 1 }
      }
    }
  ]);
};

// 🆕 Get provider revenue
transactionSchema.statics.getProviderRevenue = function(providerId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        providerId: mongoose.Types.ObjectId(providerId),
        status: { $in: ['completed', 'captured'] },
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
      }
    },
    {
      $group: {
        _id: '$bookingType',
        totalRevenue: { $sum: '$netAmount' },
        totalCommission: { $sum: '$platformCommission' },
        netEarnings: { $sum: '$providerAmount' },
        bookingCount: { $sum: 1 }
      }
    }
  ]);
};

// ============================================
// PRE-SAVE HOOK (PRESERVED + ENHANCED)
// ============================================

transactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-generate transaction ID if not provided
  if (!this.transactionId) {
    this.transactionId = this.constructor.generateTransactionId();
  }
  
  // Auto-calculate net amount
  if ((this.amount || this.originalAmount) && !this.netAmount) {
    const baseAmount = this.amount || this.originalAmount || 0;
    this.netAmount = baseAmount - (this.discountAmount || 0) + (this.taxAmount || 0) + (this.convenienceFee || 0);
  }
  
  // Auto-calculate GST if tax amount exists
  if (this.taxAmount && this.taxAmount > 0 && this.gst.totalGst === 0) {
    const gstRate = 0.18; // 18% GST
    const taxableAmount = (this.netAmount || this.amount) / (1 + gstRate);
    const totalGst = (this.netAmount || this.amount) - taxableAmount;
    
    this.gst = {
      cgst: Math.round(totalGst / 2 * 100) / 100,
      sgst: Math.round(totalGst / 2 * 100) / 100,
      igst: 0,
      totalGst: Math.round(totalGst * 100) / 100
    };
  }
  
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
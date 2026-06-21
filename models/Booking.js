const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // ============================================
  // YOUR EXISTING FIELDS (ALL PRESERVED)
  // ============================================
  
  // Common fields for all booking types
  userId: { type: String, required: true },
  bookingType: { 
    type: String, 
    enum: [
      'opd', 
      'admission', 
      'ambulance', 
      'labtest', 
      'health_package', 
      'caregiver', 
      'ayurveda_consultation', 
      'homeopathy_consult', 
      'homeopathy_medicine',
      'insurance'  // ✅ NEW INSURANCE TYPE ADDED
    ], 
    required: true 
  },
  patientName: { type: String, required: true },
  patientPhone: { type: String, required: true },
  patientAge: { type: Number },
  patientGender: { type: String, enum: ['male', 'female', 'other'] },
  patientEmail: { type: String },
  bookingDate: { type: Date, default: Date.now },
  appointmentDate: { type: Date, required: true },
  originalAmount: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'], 
    default: 'pending' 
  },
  paymentId: { type: String },
  orderId: { type: String },
  status: { 
    type: String, 
    enum: [
      'pending', 
      'confirmed', 
      'sample_collected', 
      'processing', 
      'report_ready', 
      'completed', 
      'cancelled', 
      'shipped', 
      'out_for_delivery', 
      'delivered',
      'policy_issued'  // ✅ NEW STATUS FOR INSURANCE
    ], 
    default: 'pending' 
  },
  createdAt: { type: Date, default: Date.now },
  
  // Hospital/OPD/Admission fields
  hospitalId: { type: String },
  hospitalName: { type: String },
  doctorName: { type: String },
  timeSlot: { type: String },
  
  // Ambulance fields
  ambulanceType: { type: String },
  pickupAddress: { type: String },
  dropAddress: { type: String },
  
  // Lab Test fields
  tests: [{ type: String }],
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },
  providerName: { type: String },
  homeCollectionRequested: { type: Boolean, default: false },
  homeAddress: { type: String },
  bookingId: { type: String, unique: true },
  
  // Status tracking fields
  statusHistory: [{
    status: { 
      type: String, 
      enum: [
        'pending', 
        'confirmed', 
        'sample_collected', 
        'processing', 
        'report_ready', 
        'completed', 
        'cancelled', 
        'shipped', 
        'out_for_delivery', 
        'delivered',
        'policy_issued'  // ✅ NEW STATUS FOR INSURANCE
      ] 
    },
    timestamp: { type: Date, default: Date.now },
    note: { type: String }
  }],
  estimatedReportTime: { type: Date },
  
  // ============================================
  // NEW PAYMENT-RELATED FIELDS (ADDED)
  // ============================================
  
  // Razorpay payment details
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  
  // Discount details
  discountCode: { type: String },
  discountType: { type: String, enum: ['percentage', 'fixed'] },
  discountValue: { type: Number },
  
  // Payment method
  paymentMethod: { type: String, enum: ['card', 'upi', 'netbanking', 'wallet', 'emi'] },
  
  // Refund details
  refundId: { type: String },
  refundAmount: { type: Number },
  refundStatus: { type: String, enum: ['pending', 'processed', 'failed'] },
  refundedAt: { type: Date },
  
  // Commission tracking
  platformCommission: { type: Number, default: 0 },
  providerCommission: { type: Number, default: 0 },
  commissionStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  
  // Payment failure tracking
  paymentAttempts: { type: Number, default: 0 },
  lastPaymentError: { type: String },
  
  // Settlement tracking
  settledToProvider: { type: Boolean, default: false },
  settledAt: { type: Date },
  settlementId: { type: String },
  
  // Delivery OTP for medicine orders
  deliveryOTP: { type: String },
  
  // Medicine order fields
  medicines: [{ 
    name: String, 
    potency: String, 
    quantity: Number, 
    price: Number 
  }],
  deliveryAddress: { type: String },
  trackingNumber: { type: String },
  deliveryStatus: { type: String, enum: ['processing', 'shipped', 'out_for_delivery', 'delivered'] },

  // ============================================
  // NEW INSURANCE-SPECIFIC FIELDS (ADDED)
  // ============================================
  
  // Insurance policy reference
  insurancePolicyId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePolicy' },
  insurancePlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePlan' },
  
  // Insurance details
  insuranceCompanyName: { type: String },
  insurancePlanName: { type: String },
  policyNumber: { type: String },
  sumInsured: { type: Number },
  premiumAmount: { type: Number },
  
  // Insurance members (for family floater)
  insuranceMembers: [{
    name: { type: String },
    relation: { type: String },
    age: { type: Number },
    gender: { type: String },
    aadhaar: { type: String },
    pan: { type: String }
  }],
  
  // Insurance dates
  policyStartDate: { type: Date },
  policyEndDate: { type: Date },
  policyRenewalDate: { type: Date },
  
  // Insurance claim details (if any)
  insuranceClaimId: { type: String },
  claimAmount: { type: Number },
  claimStatus: { 
    type: String, 
    enum: ['none', 'initiated', 'document_uploaded', 'under_review', 'approved', 'rejected', 'settled'],
    default: 'none'
  },
  claimDocuments: [{ type: String }],
  claimSettledAt: { type: Date },

  // Insurance settlement details
  insuranceSettlementStatus: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  insuranceSettlementDate: { type: Date },
  insuranceSettlementTransactionId: { type: String },
  
  // Insurance document URLs
  insurancePolicyDocumentUrl: { type: String },
  insuranceCertificateUrl: { type: String },
  insuranceProposalFormUrl: { type: String }
});

// ============================================
// YOUR EXISTING PRE-SAVE HOOK (PRESERVED)
// ============================================

bookingSchema.pre('save', function(next) {
  if (!this.bookingId && this.bookingType === 'labtest') {
    this.bookingId = 'LAB' + Date.now() + Math.floor(Math.random() * 1000);
  }
  if (!this.bookingId && this.bookingType === 'insurance') {
    this.bookingId = 'INS' + Date.now() + Math.floor(Math.random() * 1000);
  }
  if (this.isModified('status') && (!this.statusHistory || this.statusHistory.length === 0)) {
    this.statusHistory = this.statusHistory || [];
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      note: 'Booking created'
    });
  }
  next();
});

// ============================================
// NEW: Virtual field for balance due
// ============================================

bookingSchema.virtual('balanceDue').get(function() {
  if (this.paymentStatus === 'paid' || this.paymentStatus === 'refunded') {
    return 0;
  }
  return this.finalAmount;
});

// ============================================
// NEW: Check if booking is refundable
// ============================================

bookingSchema.methods.isRefundable = function() {
  const refundableStatuses = ['paid', 'partially_refunded'];
  return refundableStatuses.includes(this.paymentStatus) && this.finalAmount > 0;
};

bookingSchema.methods.canCancel = function() {
  const cancelableStatuses = ['pending', 'confirmed'];
  return cancelableStatuses.includes(this.status);
};

// ============================================
// NEW: Insurance-specific methods (ADDED)
// ============================================

bookingSchema.methods.isInsuranceBooking = function() {
  return this.bookingType === 'insurance';
};

bookingSchema.methods.hasActivePolicy = function() {
  if (this.bookingType !== 'insurance') return false;
  return this.status === 'policy_issued' || this.status === 'completed';
};

bookingSchema.methods.isPolicyExpired = function() {
  if (this.bookingType !== 'insurance') return false;
  if (!this.policyEndDate) return false;
  return new Date() > this.policyEndDate;
};

bookingSchema.methods.getDaysRemaining = function() {
  if (this.bookingType !== 'insurance') return 0;
  if (!this.policyEndDate) return 0;
  const now = new Date();
  const diff = this.policyEndDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

module.exports = mongoose.model('Booking', bookingSchema);
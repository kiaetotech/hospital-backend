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
      'insurance'
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
      'policy_issued'
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
        'policy_issued'
      ] 
    },
    timestamp: { type: Date, default: Date.now },
    note: { type: String }
  }],
  estimatedReportTime: { type: Date },
  
  // ============================================
  // EXISTING PAYMENT FIELDS (PRESERVED)
  // ============================================
  
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  
  discountCode: { type: String },
  discountType: { type: String, enum: ['percentage', 'fixed'] },
  discountValue: { type: Number },
  
  paymentMethod: { type: String, enum: ['card', 'upi', 'netbanking', 'wallet', 'emi'] },
  
  refundId: { type: String },
  refundAmount: { type: Number },
  refundStatus: { type: String, enum: ['pending', 'processed', 'failed'] },
  refundedAt: { type: Date },
  
  platformCommission: { type: Number, default: 0 },
  providerCommission: { type: Number, default: 0 },
  commissionStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  
  paymentAttempts: { type: Number, default: 0 },
  lastPaymentError: { type: String },
  
  settledToProvider: { type: Boolean, default: false },
  settledAt: { type: Date },
  settlementId: { type: String },
  
  deliveryOTP: { type: String },
  
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
  // EXISTING INSURANCE FIELDS (PRESERVED)
  // ============================================
  
  insurancePolicyId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePolicy' },
  insurancePlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePlan' },
  insuranceCompanyName: { type: String },
  insurancePlanName: { type: String },
  policyNumber: { type: String },
  sumInsured: { type: Number },
  premiumAmount: { type: Number },
  
  insuranceMembers: [{
    name: { type: String },
    relation: { type: String },
    age: { type: Number },
    gender: { type: String },
    aadhaar: { type: String },
    pan: { type: String }
  }],
  
  policyStartDate: { type: Date },
  policyEndDate: { type: Date },
  policyRenewalDate: { type: Date },
  
  insuranceClaimId: { type: String },
  claimAmount: { type: Number },
  claimStatus: { 
    type: String, 
    enum: ['none', 'initiated', 'document_uploaded', 'under_review', 'approved', 'rejected', 'settled'],
    default: 'none'
  },
  claimDocuments: [{ type: String }],
  claimSettledAt: { type: Date },

  insuranceSettlementStatus: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  insuranceSettlementDate: { type: Date },
  insuranceSettlementTransactionId: { type: String },
  
  insurancePolicyDocumentUrl: { type: String },
  insuranceCertificateUrl: { type: String },
  insuranceProposalFormUrl: { type: String },

  // ============================================
  // OPD/ADMISSION SPECIFIC FIELDS
  // ============================================
  
  doctorSpecialization: { type: String },
  doctorQualification: { type: String },
  consultationFee: { type: Number },
  
  roomType: { type: String },
  roomPrice: { type: Number },
  numberOfDays: { type: Number, default: 1 },
  advanceAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number },
  
  guardianName: { type: String },
  guardianPhone: { type: String },
  relation: { type: String },
  
  reason: { type: String },
  existingReports: { type: Boolean, default: false },
  
  insuranceProvider: { type: String },
  insurancePolicyNumber: { type: String },
  schemeApplied: { type: String },
  
  // ============================================
  // CANCELLATION & REFUND FIELDS
  // ============================================
  
  cancellation: {
    cancelledAt: { type: Date },
    reason: { type: String },
    cancelledBy: { type: String },
    refundAmount: { type: Number, default: 0 },
    refundPercentage: { type: Number, default: 0 },
    cancellationFee: { type: Number, default: 0 },
    refundStatus: {
      type: String,
      enum: ['pending', 'processed', 'failed', 'not_applicable'],
      default: 'not_applicable'
    },
    refundProcessedAt: { type: Date },
    refundTransactionId: { type: String }
  },
  
  // ============================================
  // REVIEW & RATING FIELDS
  // ============================================
  
  review: {
    rating: { type: Number, default: 0, min: 0, max: 5 },
    review: { type: String },
    doctorRating: { type: Number, default: 0, min: 0, max: 5 },
    staffRating: { type: Number, default: 0, min: 0, max: 5 },
    cleanlinessRating: { type: Number, default: 0, min: 0, max: 5 },
    waitTimeRating: { type: Number, default: 0, min: 0, max: 5 },
    valueForMoneyRating: { type: Number, default: 0, min: 0, max: 5 },
    submittedAt: { type: Date },
    isVerified: { type: Boolean, default: false },
    response: { type: String },
    responseAt: { type: Date }
  },
  
  // ============================================
  // FEEDBACK & FOLLOW-UP FIELDS
  // ============================================
  
  feedback: {
    wouldRecommend: { type: Boolean },
    feedbackText: { type: String },
    submittedAt: { type: Date }
  },
  
  followUp: {
    required: { type: Boolean, default: false },
    followUpDate: { type: Date },
    followUpBooked: { type: Boolean, default: false },
    followUpBookingId: { type: String }
  },
  
  // ============================================
  // QUEUE & WAIT TIME FIELDS
  // ============================================
  
  queueNumber: { type: Number },
  estimatedWaitTime: { type: Number },
  actualWaitTime: { type: Number },
  checkInTime: { type: Date },
  consultationStartTime: { type: Date },
  consultationEndTime: { type: Date },
  
  // ============================================
  // PRESCRIPTION FIELDS
  // ============================================
  
  prescription: {
    generated: { type: Boolean, default: false },
    prescriptionId: { type: String },
    medicines: [{
      name: String,
      dosage: String,
      duration: String,
      instructions: String
    }],
    tests: [{
      testName: String,
      instructions: String
    }],
    doctorNotes: { type: String },
    generatedAt: { type: Date }
  },

  // ============================================
  // NOTIFICATION TRACKING
  // ============================================
  
  notifications: [{
    type: { type: String, enum: ['email', 'sms', 'whatsapp', 'push'] },
    sentAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['sent', 'failed', 'delivered', 'read'] },
    message: { type: String }
  }],
  
  // ============================================
  // ADMIN & PROVIDER FIELDS
  // ============================================
  
  assignedTo: { type: String },
  priority: { type: String, enum: ['normal', 'urgent', 'emergency'], default: 'normal' },
  notes: [{
    text: { type: String },
    addedBy: { type: String },
    addedAt: { type: Date, default: Date.now }
  }],
  
  reportDeliveryMethod: { type: String, enum: ['email', 'whatsapp', 'physical', 'portal'] },
  reportDeliveredAt: { type: Date },
  
  // ============================================
  // SPECIAL REQUIREMENTS
  // ============================================
  
  specialRequirements: { type: String },
  languagePreference: { type: String },
  wheelchairRequired: { type: Boolean, default: false },
  interpreterRequired: { type: Boolean, default: false }
});

// ============================================
// PRE-SAVE HOOK
// ============================================

bookingSchema.pre('save', function(next) {
  if (!this.bookingId) {
    const prefixMap = {
      'labtest': 'LAB',
      'opd': 'OPD',
      'admission': 'ADM',
      'ambulance': 'AMB',
      'health_package': 'HP',
      'caregiver': 'CG',
      'ayurveda_consultation': 'AYU',
      'homeopathy_consult': 'HOM',
      'homeopathy_medicine': 'HMD',
      'insurance': 'INS'
    };
    const prefix = prefixMap[this.bookingType] || 'GEN';
    this.bookingId = prefix + Date.now() + Math.floor(Math.random() * 1000);
  }
  
  if (this.isModified('status')) {
    this.statusHistory = this.statusHistory || [];
    if (this.statusHistory.length === 0 || 
        this.statusHistory[this.statusHistory.length - 1].status !== this.status) {
      this.statusHistory.push({
        status: this.status,
        timestamp: new Date(),
        note: this.statusHistory.length === 0 ? 'Booking created' : `Status updated to ${this.status}`
      });
    }
  }
  
  if (this.bookingType === 'admission' && this.finalAmount && this.advanceAmount) {
    this.remainingAmount = this.finalAmount - this.advanceAmount;
  }
  
  if (this.status === 'completed' && this.isModified('status')) {
    this.completedAt = new Date();
  }
  
  next();
});

// ============================================
// VIRTUAL FIELDS (ALL UNIQUE - NO CONFLICTS)
// ============================================

bookingSchema.virtual('balanceDue').get(function() {
  if (this.paymentStatus === 'paid' || this.paymentStatus === 'refunded') {
    return 0;
  }
  return this.finalAmount - (this.advanceAmount || 0);
});

bookingSchema.virtual('canReview').get(function() {
  return this.status === 'completed' && !this.review?.submittedAt;
});

bookingSchema.virtual('refundEligibility').get(function() {
  if (!this.appointmentDate) return { eligible: false, percentage: 0 };
  
  const now = new Date();
  const appointmentTime = new Date(this.appointmentDate);
  const hoursBefore = (appointmentTime - now) / (1000 * 60 * 60);
  
  if (hoursBefore > 24) return { eligible: true, percentage: 90, label: 'Full refund (90%)' };
  if (hoursBefore > 6) return { eligible: true, percentage: 50, label: 'Partial refund (50%)' };
  if (hoursBefore > 2) return { eligible: true, percentage: 25, label: 'Partial refund (25%)' };
  return { eligible: false, percentage: 0, label: 'No refund' };
});

// ============================================
// METHODS (ALL UNIQUE - NO CONFLICTS WITH VIRTUALS)
// ============================================

bookingSchema.methods.isRefundable = function() {
  const refundableStatuses = ['paid', 'partially_refunded'];
  return refundableStatuses.includes(this.paymentStatus) && this.finalAmount > 0;
};

bookingSchema.methods.canCancel = function() {
  const cancelableStatuses = ['pending', 'confirmed'];
  return cancelableStatuses.includes(this.status);
};

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

bookingSchema.methods.cancelBooking = async function(reason, cancelledBy) {
  const refundInfo = this.refundEligibility;
  
  this.status = 'cancelled';
  this.cancellation = {
    cancelledAt: new Date(),
    reason: reason || 'Cancelled by patient',
    cancelledBy: cancelledBy || this.userId,
    refundAmount: refundInfo.eligible ? Math.round(this.finalAmount * refundInfo.percentage / 100) : 0,
    refundPercentage: refundInfo.percentage,
    cancellationFee: this.finalAmount - (refundInfo.eligible ? Math.round(this.finalAmount * refundInfo.percentage / 100) : 0),
    refundStatus: refundInfo.eligible ? 'pending' : 'not_applicable'
  };
  
  this.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    note: `Cancelled. Refund: ₹${this.cancellation.refundAmount} (${refundInfo.percentage}%)`
  });
  
  return this.save();
};

bookingSchema.methods.submitReview = async function(reviewData) {
  this.review = {
    ...reviewData,
    submittedAt: new Date(),
    isVerified: false
  };
  
  this.statusHistory.push({
    status: this.status,
    timestamp: new Date(),
    note: 'Review submitted by patient'
  });
  
  return this.save();
};

bookingSchema.methods.checkIn = async function() {
  this.checkInTime = new Date();
  this.status = 'in_progress';
  
  this.statusHistory.push({
    status: 'in_progress',
    timestamp: new Date(),
    note: 'Patient checked in'
  });
  
  return this.save();
};

bookingSchema.methods.completeConsultation = async function(prescriptionData) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.consultationEndTime = new Date();
  
  if (this.checkInTime && this.consultationStartTime) {
    this.actualWaitTime = Math.round((this.consultationStartTime - this.checkInTime) / (1000 * 60)) || 0;
  }
  
  if (prescriptionData) {
    this.prescription = {
      generated: true,
      ...prescriptionData,
      generatedAt: new Date()
    };
  }
  
  this.statusHistory.push({
    status: 'completed',
    timestamp: new Date(),
    note: 'Consultation completed'
  });
  
  return this.save();
};

module.exports = mongoose.model('Booking', bookingSchema);
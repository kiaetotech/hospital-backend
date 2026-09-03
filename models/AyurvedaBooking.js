const mongoose = require('mongoose');

const ayurvedaBookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  
  // ============================================
  // PATIENT INFORMATION
  // ============================================
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patient: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    abhaId: { type: String },
    age: { type: Number },
    gender: { type: String, enum: ['male', 'female', 'other'] }
  },
  
  // ============================================
  // BOOKING TYPE
  // ============================================
  type: { 
    type: String, 
    enum: ['doctor_consultation', 'panchakarma_package', 'home_therapy', 'medicine_order'],
    required: true 
  },
  
  // ============================================
  // DOCTOR CONSULTATION
  // ============================================
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'AyurvedaDoctor' },
  doctorName: { type: String },
  doctorPhone: { type: String },
  doctorSpecialization: { type: String },
  consultationType: { 
    type: String, 
    enum: ['online', 'clinic', 'home'],
    default: 'online'
  },
  
  // ============================================
  // PANCHAKARMA PACKAGE
  // ============================================
  center: { type: mongoose.Schema.Types.ObjectId, ref: 'WellnessCenter' },
  centerName: { type: String },
  centerPhone: { type: String },
  package: {
    packageId: { type: String },
    name: { type: String },
    duration: { type: Number },
    therapies: [{ type: String }],
    inclusions: [{ type: String }]
  },
  
  // ============================================
  // SCHEDULE
  // ============================================
  bookingDate: { type: Date, required: true },
  slotTime: { type: String },
  admissionDate: { type: Date },
  dischargeDate: { type: Date },
  
  // ============================================
  // MEDICAL INFORMATION
  // ============================================
  symptoms: { type: String },
  medicalHistory: { type: String },
  prakritiType: { type: String, enum: ['Vata', 'Pitta', 'Kapha', 'Vata-Pitta', 'Pitta-Kapha', 'Vata-Kapha', 'Tridosha'] },
  currentMedications: { type: String },
  allergies: { type: String },
  
  // ============================================
  // PAYMENT INFORMATION
  // ============================================
  amount: { type: Number, required: true },
  discount: {
    code: { type: String },
    percentage: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    description: { type: String }
  },
  finalAmount: { type: Number, required: true },
  platformFee: { type: Number, default: 0 },
  platformCommission: { type: Number, required: true },
  providerEarning: { type: Number, required: true },
  gstAmount: { type: Number, default: 0 },
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'initiated', 'paid', 'failed', 'refunded', 'partial_refund'],
    default: 'pending'
  },
  paymentMethod: { type: String, enum: ['card', 'upi', 'netbanking', 'wallet', 'emi'] },
  transactionId: { type: String },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  paidAt: { type: Date },
  
  // ============================================
  // OTP VERIFICATION
  // ============================================
  otp: { type: String },
  otpVerified: { type: Boolean, default: false },
  otpExpiry: { type: Date },
  otpAttempts: { type: Number, default: 0 },
  
  // ============================================
  // BOOKING STATUS
  // ============================================
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'],
    default: 'pending'
  },
  confirmedAt: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  cancellationReason: { type: String },
  
  // ============================================
  // STATUS HISTORY (AUDIT TRAIL)
  // ============================================
  statusHistory: [{
    status: { type: String },
    timestamp: { type: Date, default: Date.now },
    note: { type: String },
    updatedBy: { type: String, enum: ['patient', 'doctor', 'center', 'admin', 'system'] }
  }],
  
  // ============================================
  // CANCELLATION & REFUND
  // ============================================
  cancellation: {
    cancelledAt: { type: Date },
    reason: { type: String },
    cancelledBy: { type: String, enum: ['patient', 'doctor', 'center', 'admin', 'system'] },
    refundAmount: { type: Number, default: 0 },
    refundPercentage: { type: Number, default: 0 },
    cancellationFee: { type: Number, default: 0 },
    refundStatus: { 
      type: String, 
      enum: ['pending', 'processed', 'failed', 'not_applicable'],
      default: 'not_applicable'
    },
    refundProcessedAt: { type: Date },
    refundTransactionId: { type: String },
    refundReason: { type: String }
  },
  
  // ============================================
  // RESCHEDULING
  // ============================================
  rescheduleHistory: [{
    fromDate: { type: Date },
    toDate: { type: Date },
    fromSlot: { type: String },
    toSlot: { type: String },
    rescheduledAt: { type: Date, default: Date.now },
    reason: { type: String },
    rescheduledBy: { type: String }
  }],
  rescheduleCount: { type: Number, default: 0 },
  
  // ============================================
  // SETTLEMENT
  // ============================================
  commissionPayoutStatus: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'failed', 'on_hold'],
    default: 'pending'
  },
  payoutDate: { type: Date },
  payoutTransactionId: { type: String },
  settledToProvider: { type: Boolean, default: false },
  settledAt: { type: Date },
  settlementId: { type: String },
  settlementRequestedAt: { type: Date },
  
  // ============================================
  // REVIEWS & RATINGS
  // ============================================
  reviewed: { type: Boolean, default: false },
  review: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    createdAt: { type: Date },
    isVerified: { type: Boolean, default: false },
    doctorResponse: { type: String },
    doctorResponseAt: { type: Date }
  },
  
  // ============================================
  // VIDEO CONSULTATION
  // ============================================
  videoConsultation: {
    roomId: { type: String },
    token: { type: String },
    startedAt: { type: Date },
    endedAt: { type: Date },
    duration: { type: Number },
    recordingUrl: { type: String },
    platform: { type: String, enum: ['dyte', 'zoom', 'custom', 'none'], default: 'none' }
  },
  
  // ============================================
  // PRESCRIPTION
  // ============================================
  prescription: {
    generated: { type: Boolean, default: false },
    prescriptionId: { type: String },
    diagnosis: { type: String },
    medicines: [{
      name: { type: String },
      dosage: { type: String },
      duration: { type: String },
      instructions: { type: String },
      quantity: { type: Number },
      timing: { type: String, enum: ['morning', 'afternoon', 'evening', 'night', 'before_meal', 'after_meal'] }
    }],
    dietAdvice: { type: String },
    lifestyleAdvice: { type: String },
    followUpDate: { type: Date },
    generatedAt: { type: Date },
    pdfUrl: { type: String }
  },
  
  // ============================================
  // FOLLOW-UP
  // ============================================
  followUp: {
    required: { type: Boolean, default: false },
    followUpDate: { type: Date },
    followUpBooked: { type: Boolean, default: false },
    followUpBookingId: { type: String }
  },
  
  // ============================================
  // NOTIFICATIONS TRACKING
  // ============================================
  notifications: [{
    type: { type: String, enum: ['sms', 'email', 'whatsapp', 'push'] },
    sentAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['sent', 'failed', 'delivered', 'read'] },
    message: { type: String }
  }],
  
  // ============================================
  // TIMESTAMPS
  // ============================================
  bookingRequestedAt: { type: Date, default: Date.now },
  doctorAcceptedAt: { type: Date },
  consultationStartedAt: { type: Date },
  consultationEndedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ============================================
// INDEXES
// ============================================
ayurvedaBookingSchema.index({ bookingId: 1 }, { unique: true });
ayurvedaBookingSchema.index({ userId: 1, createdAt: -1 });
ayurvedaBookingSchema.index({ 'patient.phone': 1 });
ayurvedaBookingSchema.index({ doctor: 1, bookingDate: 1 });
ayurvedaBookingSchema.index({ center: 1, bookingDate: 1 });
ayurvedaBookingSchema.index({ paymentStatus: 1 });
ayurvedaBookingSchema.index({ status: 1 });
ayurvedaBookingSchema.index({ commissionPayoutStatus: 1 });
ayurvedaBookingSchema.index({ type: 1, status: 1 });
ayurvedaBookingSchema.index({ createdAt: -1 });

// ============================================
// PRE-SAVE HOOK
// ============================================
ayurvedaBookingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Generate booking ID
  if (!this.bookingId) {
    const prefix = 'AYU';
    this.bookingId = prefix + Date.now() + Math.floor(Math.random() * 1000);
  }
  
  // Track status changes
  if (this.isModified('status')) {
    if (!this.statusHistory) this.statusHistory = [];
    const lastStatus = this.statusHistory[this.statusHistory.length - 1];
    if (!lastStatus || lastStatus.status !== this.status) {
      this.statusHistory.push({
        status: this.status,
        timestamp: new Date(),
        note: lastStatus ? `Status changed from ${lastStatus.status} to ${this.status}` : 'Booking created',
        updatedBy: 'system'
      });
    }
  }
  
  // Set confirmed timestamp
  if (this.status === 'confirmed' && this.isModified('status') && !this.confirmedAt) {
    this.confirmedAt = new Date();
  }
  
  // Set completed timestamp
  if (this.status === 'completed' && this.isModified('status') && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

// ============================================
// VIRTUAL FIELDS
// ============================================
ayurvedaBookingSchema.virtual('refundEligibility').get(function() {
  if (!this.bookingDate || this.status === 'completed') {
    return { eligible: false, percentage: 0, label: 'Not eligible' };
  }
  
  const now = new Date();
  const bookingTime = new Date(this.bookingDate);
  const hoursBefore = (bookingTime - now) / (1000 * 60 * 60);
  
  if (this.type === 'doctor_consultation' || this.type === 'home_therapy') {
    if (hoursBefore > 24) return { eligible: true, percentage: 90, label: 'Full refund (90%)' };
    if (hoursBefore > 6) return { eligible: true, percentage: 50, label: 'Partial refund (50%)' };
    if (hoursBefore > 2) return { eligible: true, percentage: 25, label: 'Partial refund (25%)' };
    return { eligible: false, percentage: 0, label: 'No refund' };
  }
  
  if (this.type === 'panchakarma_package') {
    if (hoursBefore > 72) return { eligible: true, percentage: 90, label: 'Full refund (90%)' };
    if (hoursBefore > 48) return { eligible: true, percentage: 75, label: 'Partial refund (75%)' };
    if (hoursBefore > 24) return { eligible: true, percentage: 50, label: 'Partial refund (50%)' };
    return { eligible: false, percentage: 0, label: 'No refund' };
  }
  
  if (this.type === 'medicine_order') {
    if (['pending', 'confirmed'].includes(this.status)) {
      return { eligible: true, percentage: 100, label: 'Full refund (100%)' };
    }
    return { eligible: false, percentage: 0, label: 'No refund' };
  }
  
  return { eligible: false, percentage: 0, label: 'Not eligible' };
});

ayurvedaBookingSchema.virtual('canReview').get(function() {
  return this.status === 'completed' && !this.reviewed;
});

ayurvedaBookingSchema.virtual('canCancel').get(function() {
  return ['pending', 'confirmed'].includes(this.status);
});

ayurvedaBookingSchema.virtual('canReschedule').get(function() {
  const now = new Date();
  const bookingTime = new Date(this.bookingDate);
  const hoursBefore = (bookingTime - now) / (1000 * 60 * 60);
  return this.status === 'confirmed' && hoursBefore > 2 && this.rescheduleCount < 2;
});

// ============================================
// METHODS
// ============================================

// Generate OTP
ayurvedaBookingSchema.methods.generateOtp = function() {
  this.otp = Math.floor(1000 + Math.random() * 9000).toString();
  this.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  this.otpAttempts = 0;
  return this.otp;
};

// Verify OTP
ayurvedaBookingSchema.methods.verifyOtp = async function(otp) {
  if (this.otpAttempts >= 5) {
    throw new Error('Too many OTP attempts. Please request a new OTP.');
  }
  
  if (this.otpExpiry < new Date()) {
    throw new Error('OTP expired. Please request a new OTP.');
  }
  
  if (this.otp !== otp) {
    this.otpAttempts += 1;
    await this.save();
    return false;
  }
  
  this.otpVerified = true;
  this.status = 'confirmed';
  this.confirmedAt = new Date();
  
  this.statusHistory.push({
    status: 'confirmed',
    timestamp: new Date(),
    note: 'Booking confirmed via OTP verification',
    updatedBy: 'patient'
  });
  
  await this.save();
  return true;
};

// Cancel booking
ayurvedaBookingSchema.methods.cancelBooking = async function(reason, cancelledBy) {
  if (!this.canCancel) {
    throw new Error('Booking cannot be cancelled in current status');
  }
  
  const refundInfo = this.refundEligibility;
  
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancellationReason = reason || 'Cancelled by patient';
  
  this.cancellation = {
    cancelledAt: new Date(),
    reason: reason || 'Cancelled by patient',
    cancelledBy: cancelledBy || 'patient',
    refundAmount: refundInfo.eligible ? Math.round(this.finalAmount * refundInfo.percentage / 100) : 0,
    refundPercentage: refundInfo.percentage,
    cancellationFee: this.finalAmount - (refundInfo.eligible ? Math.round(this.finalAmount * refundInfo.percentage / 100) : 0),
    refundStatus: refundInfo.eligible ? 'pending' : 'not_applicable'
  };
  
  if (refundInfo.eligible && refundInfo.percentage > 0) {
    this.paymentStatus = 'partial_refund';
  }
  
  this.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    note: `Booking cancelled by ${cancelledBy}. Reason: ${reason}. Refund: ₹${this.cancellation.refundAmount}`,
    updatedBy: cancelledBy
  });
  
  return this.save();
};

// Reschedule booking
ayurvedaBookingSchema.methods.rescheduleBooking = async function(newDate, newSlot, reason, rescheduledBy) {
  if (!this.canReschedule) {
    throw new Error('Booking cannot be rescheduled');
  }
  
  const oldDate = this.bookingDate;
  const oldSlot = this.slotTime;
  
  this.rescheduleHistory.push({
    fromDate: oldDate,
    toDate: newDate,
    fromSlot: oldSlot,
    toSlot: newSlot,
    rescheduledAt: new Date(),
    reason: reason,
    rescheduledBy: rescheduledBy
  });
  
  this.bookingDate = newDate;
  this.slotTime = newSlot;
  this.rescheduleCount += 1;
  this.status = 'rescheduled';
  
  this.statusHistory.push({
    status: 'rescheduled',
    timestamp: new Date(),
    note: `Booking rescheduled from ${oldDate} to ${newDate}`,
    updatedBy: rescheduledBy
  });
  
  // Generate new OTP for rescheduled booking
  this.generateOtp();
  this.otpVerified = false;
  
  return this.save();
};

// Submit review
ayurvedaBookingSchema.methods.submitReview = async function(rating, comment) {
  if (this.status !== 'completed') {
    throw new Error('Can only review completed bookings');
  }
  
  if (this.reviewed) {
    throw new Error('Review already submitted');
  }
  
  this.reviewed = true;
  this.review = {
    rating,
    comment,
    createdAt: new Date(),
    isVerified: false
  };
  
  // Update doctor rating
  if (this.doctor) {
    const AyurvedaDoctor = mongoose.model('AyurvedaDoctor');
    const doctor = await AyurvedaDoctor.findById(this.doctor);
    if (doctor) {
      const newRating = ((doctor.rating * doctor.totalReviews) + rating) / (doctor.totalReviews + 1);
      doctor.rating = Math.round(newRating * 10) / 10;
      doctor.totalReviews += 1;
      doctor.reviews.push({
        patient: this.userId,
        patientName: this.patient.name,
        rating,
        review: comment,
        treatment: this.symptoms || '',
        consultationType: this.consultationType,
        createdAt: new Date(),
        verified: false
      });
      await doctor.save();
    }
  }
  
  // Update center rating
  if (this.center) {
    const WellnessCenter = mongoose.model('WellnessCenter');
    const center = await WellnessCenter.findById(this.center);
    if (center) {
      const newRating = ((center.rating * center.totalReviews) + rating) / (center.totalReviews + 1);
      center.rating = Math.round(newRating * 10) / 10;
      center.totalReviews += 1;
      center.reviews.push({
        patient: this.userId.toString(),
        patientName: this.patient.name,
        rating,
        review: comment,
        packageName: this.package?.name || '',
        createdAt: new Date()
      });
      await center.save();
    }
  }
  
  return this.save();
};

// Accept booking (doctor/center)
ayurvedaBookingSchema.methods.acceptBooking = async function(acceptedBy) {
  if (this.status !== 'pending') {
    throw new Error('Only pending bookings can be accepted');
  }
  
  this.status = 'confirmed';
  this.confirmedAt = new Date();
  this.doctorAcceptedAt = new Date();
  
  this.statusHistory.push({
    status: 'confirmed',
    timestamp: new Date(),
    note: `Booking accepted by ${acceptedBy}`,
    updatedBy: acceptedBy
  });
  
  return this.save();
};

// Start consultation
ayurvedaBookingSchema.methods.startConsultation = async function() {
  if (this.status !== 'confirmed') {
    throw new Error('Only confirmed bookings can start');
  }
  
  this.status = 'in_progress';
  this.consultationStartedAt = new Date();
  
  this.statusHistory.push({
    status: 'in_progress',
    timestamp: new Date(),
    note: 'Consultation started',
    updatedBy: 'doctor'
  });
  
  return this.save();
};

// Complete consultation
ayurvedaBookingSchema.methods.completeConsultation = async function(prescriptionData) {
  if (this.status !== 'in_progress') {
    throw new Error('Only in-progress bookings can be completed');
  }
  
  this.status = 'completed';
  this.completedAt = new Date();
  this.consultationEndedAt = new Date();
  
  if (prescriptionData) {
    this.prescription = {
      generated: true,
      prescriptionId: 'RX' + Date.now(),
      ...prescriptionData,
      generatedAt: new Date()
    };
  }
  
  this.statusHistory.push({
    status: 'completed',
    timestamp: new Date(),
    note: 'Consultation completed',
    updatedBy: 'doctor'
  });
  
  return this.save();
};

// Mark no-show
ayurvedaBookingSchema.methods.markNoShow = async function() {
  if (this.status !== 'confirmed') {
    throw new Error('Only confirmed bookings can be marked no-show');
  }
  
  this.status = 'no_show';
  
  this.statusHistory.push({
    status: 'no_show',
    timestamp: new Date(),
    note: 'Patient did not show up',
    updatedBy: 'doctor'
  });
  
  return this.save();
};

// Pre-save hook to generate bookingId
ayurvedaBookingSchema.pre('save', function(next) {
  if (!this.bookingId) {
    this.bookingId = 'AYU' + Date.now() + Math.floor(Math.random() * 1000);
  }
  next();
});

module.exports = mongoose.model('AyurvedaBooking', ayurvedaBookingSchema);
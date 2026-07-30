const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // ============================================
  // COMMON FIELDS FOR ALL BOOKING TYPES
  // ============================================
  
  userId: { type: String, required: true },
  bookingType: { 
    type: String, 
    enum: [
      'opd', 
      'admission', 
      'ambulance', 
      'ambulance_emergency',     // 🚑 NEW: Emergency ambulance dispatch
      'labtest', 
      'health_package', 
      'caregiver', 
      'ayurveda_consultation', 
      'homeopathy_consult', 
      'homeopathy_medicine',
      'insurance',
      'online_consult'
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
      'policy_issued',
      // 🚑 NEW: Ambulance emergency statuses
      'driver_assigned',
      'driver_en_route',
      'driver_arrived',
      'patient_onboard',
      'arrived_hospital',
      'no_driver_found'
    ], 
    default: 'pending' 
  },
  createdAt: { type: Date, default: Date.now },
  
  // ============================================
  // HOSPITAL / OPD / ADMISSION FIELDS
  // ============================================
  
  hospitalId: { type: String },
  hospitalName: { type: String },
  doctorName: { type: String },
  timeSlot: { type: String },
  
  // ============================================
  // 🚑 AMBULANCE FIELDS (ENHANCED FOR BLITZ RESPONSE SYSTEM)
  // ============================================
  
  ambulanceType: { 
    type: String,
    enum: ['basic', 'cardiac', 'ventilator', 'neonatal', 'mortuary', 'wheelchair']
  },
  pickupAddress: { type: String },
  dropAddress: { type: String },

  // 🚑 Emergency type classification
  emergencyType: {
    type: String,
    enum: ['blitz', 'scheduled', 'intercity'],
    default: 'scheduled'
  },

  // 🚑 Patient condition assessment (from triage quiz)
  patientCondition: {
    isBreathing: { type: Boolean },
    isConscious: { type: Boolean },
    isBleeding: { type: Boolean },
    chiefComplaint: { type: String },
    additionalNotes: { type: String },
    ageGroup: { type: String, enum: ['infant', 'child', 'adult', 'senior'] }
  },

  // 🚑 Geo-location for real-time tracking
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] }  // [longitude, latitude]
  },

  pickupCoordinates: {
    lat: { type: Number },
    lng: { type: Number }
  },

  pickupLocation: {
    address: { type: String },
    landmark: { type: String },
    city: { type: String },
    pincode: { type: String }
  },

  // 🚑 Hospital destination details
  hospitalDestination: {
    hospitalId: { type: String },
    hospitalName: { type: String },
    address: { type: String },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number }
    },
    emergencyDepartment: { type: String },
    bedAvailability: {
      general: { type: Number },
      icu: { type: Number },
      ventilator: { type: Number }
    }
  },

  // 🚑 Driver assignment & tracking
  driverId: { type: String },
  driverName: { type: String },
  driverPhone: { type: String },
  driverRating: { type: Number },
  vehicleNumber: { type: String },
  vehicleType: { type: String },

  // 🚑 Emergency timestamps for SLA tracking
  emergencyRequestedAt: { type: Date },
  driverAcceptedAt: { type: Date },
  driverReachedAt: { type: Date },
  patientOnboardAt: { type: Date },
  arrivedHospitalAt: { type: Date },
  completedAt: { type: Date },

  // 🚑 Dispatch metadata
  dispatchAttempts: { type: Number, default: 0 },
  driversContacted: [{ 
    driverId: String, 
    driverName: String,
    accepted: Boolean, 
    responseTime: Number  // seconds
  }],
  dispatchRadius: { type: Number },  // km
  retryCount: { type: Number, default: 0 },

  // 🚑 Trip OTP for patient-driver verification
  tripOtp: { type: String },
  otpVerified: { type: Boolean, default: false },

  // 🚑 Emergency contacts notified during emergency
  emergencyContacts: [{
    name: { type: String },
    phone: { type: String },
    relationship: { type: String },
    notified: { type: Boolean, default: false },
    notifiedAt: { type: Date }
  }],

  // 🚑 Hospital ER notification tracking
  hospitalNotified: { type: Boolean, default: false },
  hospitalNotificationId: { type: String },
  hospitalNotificationTime: { type: Date },

  // 🚑 Insurance card sharing with hospital
  insuranceCardShared: { type: Boolean, default: false },
  insuranceInfo: {
    provider: { type: String },
    policyNumber: { type: String },
    cardImageUrl: { type: String }
  },

  // 🚑 Digital trip sheet (insurance claim ready)
  digitalTripSheet: {
    generated: { type: Boolean, default: false },
    tripSheetId: { type: String },
    pickupTime: { type: Date },
    dropTime: { type: Date },
    distance: { type: Number },  // km
    duration: { type: Number },  // minutes
    vitals: {
      bloodPressure: { type: String },
      pulse: { type: Number },
      spo2: { type: Number },
      temperature: { type: Number },
      glucose: { type: Number }
    },
    oxygenAdministered: { type: Boolean, default: false },
    oxygenFlowRate: { type: Number },  // L/min
    medicationsGiven: [{ 
      name: String, 
      dosage: String, 
      time: Date 
    }],
    proceduresDone: [{ type: String }],
    patientConditionDuringTransport: { type: String },
    driverNotes: { type: String },
    generatedAt: { type: Date }
  },

  // 🚑 Surge pricing
  surgeMultiplier: { type: Number, default: 1.0 },
  surgeReason: { type: String },
  isPeakHour: { type: Boolean, default: false },

  // 🚑 Detailed fare breakdown
  fareBreakdown: {
    baseFare: { type: Number },
    distanceCharge: { type: Number },
    waitingCharge: { type: Number },
    nightCharge: { type: Number },
    oxygenCharge: { type: Number },
    equipmentCharge: { type: Number },
    surgeCharge: { type: Number },
    platformFee: { type: Number },
    gst: { type: Number },
    total: { type: Number }
  },

  // 🚑 Live tracking
  trackingUrl: { type: String },
  liveTrackingEnabled: { type: Boolean, default: false },

  // 🚑 Emergency-specific cancellation
  emergencyCancellation: {
    cancelledAt: { type: Date },
    cancelledBy: { type: String, enum: ['patient', 'driver', 'system'] },
    reason: { type: String },
    driverReachedBeforeCancel: { type: Boolean, default: false },
    cancellationFee: { type: Number },
    refundAmount: { type: Number }
  },

  // 🚑 Non-emergency scheduled transport
  scheduledTransport: {
    isRecurring: { type: Boolean, default: false },
    recurringDays: [{ type: String }],  // ['monday', 'wednesday', 'friday']
    recurringEndDate: { type: Date },
    requiresOxygen: { type: Boolean, default: false },
    requiresAttendant: { type: Boolean, default: false },
    mobilityType: { type: String, enum: ['walking', 'wheelchair', 'stretcher'] },
    specialEquipment: [{ type: String }]
  },
  
  // ============================================
  // LAB TEST / DIAGNOSTICS FIELDS
  // ============================================
  
  tests: [{ type: String }],
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },
  providerName: { type: String },
  homeCollectionRequested: { type: Boolean, default: false },
  homeAddress: { type: String },
  bookingId: { type: String, unique: true },
  
  // ============================================
  // STATUS TRACKING
  // ============================================
  
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
        'policy_issued',
        // 🚑 Ambulance statuses in history
        'driver_assigned',
        'driver_en_route',
        'driver_arrived',
        'patient_onboard',
        'arrived_hospital',
        'no_driver_found'
      ] 
    },
    timestamp: { type: Date, default: Date.now },
    note: { type: String }
  }],
  estimatedReportTime: { type: Date },
  
  // ============================================
  // PAYMENT FIELDS
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
  
  // ============================================
  // MEDICINE / HOMEOPATHY PHARMACY FIELDS
  // ============================================
  
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
  // INSURANCE FIELDS
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
  // OPD / ADMISSION SPECIFIC FIELDS
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
  // CANCELLATION & REFUND
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
  // REVIEW & RATING
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
  // FEEDBACK & FOLLOW-UP
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
  // QUEUE & WAIT TIME
  // ============================================
  
  queueNumber: { type: Number },
  estimatedWaitTime: { type: Number },
  actualWaitTime: { type: Number },
  checkInTime: { type: Date },
  consultationStartTime: { type: Date },
  consultationEndTime: { type: Date },
  
  // ============================================
  // PRESCRIPTION
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
  // ADMIN & PROVIDER METADATA
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
  // Generate unique booking ID
  if (!this.bookingId) {
    const prefixMap = {
      'labtest': 'LAB',
      'opd': 'OPD',
      'admission': 'ADM',
      'ambulance': 'AMB',
      'ambulance_emergency': 'AMB',  // 🚑 Same AMB prefix for emergency
      'health_package': 'HP',
      'caregiver': 'CG',
      'ayurveda_consultation': 'AYU',
      'homeopathy_consult': 'HOM',
      'homeopathy_medicine': 'HMD',
      'insurance': 'INS',
      'online_consult': 'ONC'
    };
    const prefix = prefixMap[this.bookingType] || 'GEN';
    this.bookingId = prefix + Date.now() + Math.floor(Math.random() * 1000);
  }
  
  // Track status changes
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
  
  // Calculate remaining amount for admissions
  if (this.bookingType === 'admission' && this.finalAmount && this.advanceAmount) {
    this.remainingAmount = this.finalAmount - this.advanceAmount;
  }
  
  // 🚑 Generate trip OTP for emergency ambulance bookings
  if ((this.bookingType === 'ambulance_emergency' || this.emergencyType === 'blitz') && !this.tripOtp) {
    this.tripOtp = Math.floor(1000 + Math.random() * 9000).toString();
  }

  // 🚑 Set emergency requested timestamp for blitz bookings
  if ((this.bookingType === 'ambulance_emergency' || this.emergencyType === 'blitz') && !this.emergencyRequestedAt) {
    this.emergencyRequestedAt = new Date();
  }

  // 🚑 Auto-set priority to emergency for blitz bookings
  if (this.emergencyType === 'blitz') {
    this.priority = 'emergency';
  }

  // 🚑 Enable live tracking for blitz emergencies
  if (this.emergencyType === 'blitz') {
    this.liveTrackingEnabled = true;
  }

  // Set completed timestamp
  if (this.status === 'completed' && this.isModified('status')) {
    this.completedAt = new Date();
  }
  
  next();
});

// ============================================
// VIRTUAL FIELDS
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

// 🚑 Virtual: Check if booking is an active emergency
bookingSchema.virtual('isActiveEmergency').get(function() {
  if (this.bookingType !== 'ambulance_emergency' && this.emergencyType !== 'blitz') {
    return false;
  }
  const activeStatuses = ['confirmed', 'driver_assigned', 'driver_en_route', 'driver_arrived', 'patient_onboard'];
  return activeStatuses.includes(this.status);
});

// 🚑 Virtual: Get emergency response time in seconds
bookingSchema.virtual('emergencyResponseTime').get(function() {
  if (this.emergencyRequestedAt && this.driverAcceptedAt) {
    return Math.round((this.driverAcceptedAt - this.emergencyRequestedAt) / 1000);
  }
  return null;
});

// 🚑 Virtual: Get total trip time in minutes
bookingSchema.virtual('totalTripTime').get(function() {
  if (this.driverAcceptedAt && this.arrivedHospitalAt) {
    return Math.round((this.arrivedHospitalAt - this.driverAcceptedAt) / (1000 * 60));
  }
  return null;
});

// ============================================
// INSTANCE METHODS
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

// ============================================
// 🚑 AMBULANCE-SPECIFIC METHODS
// ============================================

// Assign a driver to emergency booking
bookingSchema.methods.assignDriver = async function(driverData) {
  this.status = 'driver_assigned';
  this.driverId = driverData.driverId;
  this.driverName = driverData.name;
  this.driverPhone = driverData.phone;
  this.driverRating = driverData.rating || 0;
  this.vehicleNumber = driverData.vehicleNumber;
  this.vehicleType = driverData.vehicleType;
  this.driverAcceptedAt = new Date();
  
  this.statusHistory.push({
    status: 'driver_assigned',
    timestamp: new Date(),
    note: `🚑 Driver ${driverData.name} (${driverData.vehicleNumber}) assigned. Response time: ${this.emergencyResponseTime}s`
  });
  
  return this.save();
};

// Driver reached pickup location
bookingSchema.methods.driverArrived = async function() {
  this.status = 'driver_arrived';
  this.driverReachedAt = new Date();
  
  this.statusHistory.push({
    status: 'driver_arrived',
    timestamp: new Date(),
    note: '🚑 Driver arrived at pickup location'
  });
  
  return this.save();
};

// Patient onboard, heading to hospital
bookingSchema.methods.patientOnboard = async function() {
  this.status = 'patient_onboard';
  this.patientOnboardAt = new Date();
  this.otpVerified = true;
  
  this.statusHistory.push({
    status: 'patient_onboard',
    timestamp: new Date(),
    note: '🚑 Patient onboard, heading to hospital'
  });
  
  return this.save();
};

// Reached hospital
bookingSchema.methods.arrivedHospital = async function(vitalsData) {
  this.status = 'arrived_hospital';
  this.arrivedHospitalAt = new Date();
  
  if (vitalsData && this.digitalTripSheet) {
    this.digitalTripSheet.vitals = vitalsData;
  }
  
  this.statusHistory.push({
    status: 'arrived_hospital',
    timestamp: new Date(),
    note: `🚑 Arrived at ${this.hospitalDestination?.hospitalName || 'hospital'}`
  });
  
  return this.save();
};

// Complete emergency trip
bookingSchema.methods.completeEmergencyTrip = async function(tripData) {
  this.status = 'completed';
  this.completedAt = new Date();
  
  if (tripData) {
    if (!this.digitalTripSheet) this.digitalTripSheet = {};
    Object.assign(this.digitalTripSheet, tripData);
    this.digitalTripSheet.generated = true;
    this.digitalTripSheet.tripSheetId = 'TRIP' + Date.now();
    this.digitalTripSheet.generatedAt = new Date();
  }
  
  this.statusHistory.push({
    status: 'completed',
    timestamp: new Date(),
    note: '🚑 Emergency trip completed'
  });
  
  return this.save();
};

// Cancel emergency with different logic than regular cancellation
bookingSchema.methods.cancelEmergency = async function(reason, cancelledBy) {
  const now = new Date();
  
  this.status = 'cancelled';
  this.emergencyCancellation = {
    cancelledAt: now,
    cancelledBy: cancelledBy || 'patient',
    reason: reason || 'Cancelled by patient',
    driverReachedBeforeCancel: this.status === 'driver_arrived',
    cancellationFee: this.status === 'driver_arrived' ? Math.round(this.finalAmount * 0.3) : 0,
    refundAmount: this.status === 'driver_arrived' 
      ? Math.round(this.finalAmount * 0.7) 
      : this.finalAmount
  };
  
  this.statusHistory.push({
    status: 'cancelled',
    timestamp: now,
    note: `🚑 Emergency cancelled by ${cancelledBy}. Reason: ${reason}`
  });
  
  return this.save();
};

// Verify trip OTP
bookingSchema.methods.verifyTripOtp = async function(otp) {
  if (this.tripOtp === otp) {
    this.otpVerified = true;
    await this.save();
    return true;
  }
  return false;
};

// Generate digital trip sheet for insurance claims
bookingSchema.methods.generateTripSheet = async function(tripData) {
  this.digitalTripSheet = {
    ...this.digitalTripSheet,
    ...tripData,
    generated: true,
    tripSheetId: 'TRIP' + Date.now(),
    generatedAt: new Date()
  };
  
  this.statusHistory.push({
    status: this.status,
    timestamp: new Date(),
    note: '🚑 Digital trip sheet generated for insurance'
  });
  
  return this.save();
};

// Calculate ambulance fare based on distance and other factors
bookingSchema.methods.calculateFare = function() {
  const baseFare = this.fareBreakdown?.baseFare || 500;
  const perKm = 25;
  const distance = this.digitalTripSheet?.distance || 0;
  const nightCharge = this.isPeakHour ? baseFare * 0.5 : 0;
  const surgeCharge = this.surgeMultiplier > 1 ? baseFare * (this.surgeMultiplier - 1) : 0;
  const oxygenCharge = this.digitalTripSheet?.oxygenAdministered ? 200 : 0;
  const platformFee = 50;
  
  const subTotal = baseFare + (distance * perKm) + nightCharge + surgeCharge + oxygenCharge;
  const gst = Math.round(subTotal * 0.05);
  const total = subTotal + gst + platformFee;
  
  this.fareBreakdown = {
    baseFare,
    distanceCharge: distance * perKm,
    waitingCharge: 0,
    nightCharge,
    oxygenCharge,
    equipmentCharge: 0,
    surgeCharge,
    platformFee,
    gst,
    total
  };
  
  this.originalAmount = total;
  this.finalAmount = total;
  
  return this.fareBreakdown;
};

// Check if booking can be dispatched (has required data)
bookingSchema.methods.canDispatch = function() {
  return !!(
    this.pickupCoordinates?.lat &&
    this.pickupCoordinates?.lng &&
    this.patientPhone &&
    this.emergencyType === 'blitz'
  );
};

// Add a driver to contacted list
bookingSchema.methods.addContactedDriver = async function(driverId, driverName, accepted, responseTime) {
  this.driversContacted.push({
    driverId,
    driverName,
    accepted,
    responseTime
  });
  this.dispatchAttempts += 1;
  return this.save();
};

// Mark emergency contacts as notified
bookingSchema.methods.notifyEmergencyContacts = async function() {
  if (this.emergencyContacts && this.emergencyContacts.length > 0) {
    this.emergencyContacts = this.emergencyContacts.map(contact => ({
      ...contact,
      notified: true,
      notifiedAt: new Date()
    }));
  }
  return this.save();
};

// Share insurance card with hospital
bookingSchema.methods.shareInsuranceWithHospital = async function(insuranceData) {
  this.insuranceCardShared = true;
  this.insuranceInfo = insuranceData;
  return this.save();
};

// Notify hospital ER
bookingSchema.methods.notifyHospital = async function(notificationId) {
  this.hospitalNotified = true;
  this.hospitalNotificationId = notificationId;
  this.hospitalNotificationTime = new Date();
  return this.save();
};

// ============================================
// GEOSPATIAL INDEXES FOR AMBULANCE QUERIES
// ============================================

bookingSchema.index({ 'pickupCoordinates': '2dsphere' });
bookingSchema.index({ 'location': '2dsphere' });
bookingSchema.index({ bookingType: 1, emergencyType: 1, status: 1 });
bookingSchema.index({ driverId: 1, status: 1 });
bookingSchema.index({ emergencyRequestedAt: -1 });
bookingSchema.index({ 'hospitalDestination.hospitalId': 1, status: 1 });

// ============================================
// EXPORT
// ============================================

module.exports = mongoose.model('Booking', bookingSchema);
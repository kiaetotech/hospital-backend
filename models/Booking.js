const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // ============================================
  // COMMON FIELDS FOR ALL BOOKING TYPES
  // ============================================
  
  userId: { type, required},
  bookingType: { 
    type, 
    enum: [
      'opd', 
      'admission', 
      'ambulance', 
      'ambulance_emergency',     // 🚑 NEWambulance dispatch
      'labtest', 
      'health_package', 
      'caregiver', 
      'ayurveda_consultation', 
      'homeopathy_consult', 
      'homeopathy_medicine',
      'insurance',
      'online_consult'
    ], 
    required},
  patientName: { type, required},
  patientPhone: { type, required},
  patientAge: { type},
  patientGender: { type, enum: ['male', 'female', 'other'] },
  patientEmail: { type},
  bookingDate: { type, default.now },
  appointmentDate: { type, required},
  originalAmount: { type, required},
  discount: { type, default: 0 },
  finalAmount: { type, required},
  paymentStatus: { 
    type, 
    enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'], 
    default: 'pending' 
  },
  paymentId: { type},
  orderId: { type},
  status: { 
    type, 
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
      // 🚑 NEWemergency statuses
      'driver_assigned',
      'driver_en_route',
      'driver_arrived',
      'patient_onboard',
      'arrived_hospital',
      'no_driver_found'
    ], 
    default: 'pending' 
  },
  createdAt: { type, default.now },
  
  // ============================================
  // HOSPITAL / OPD / ADMISSION FIELDS
  // ============================================
  
  hospitalId: { type},
  hospitalName: { type},
  doctorName: { type},
  timeSlot: { type},
  
  // ============================================
  // 🚑 AMBULANCE FIELDS (ENHANCED FOR BLITZ RESPONSE SYSTEM)
  // ============================================
  
  ambulanceType: { 
    type,
    enum: ['basic', 'cardiac', 'ventilator', 'neonatal', 'mortuary', 'wheelchair']
  },
  pickupAddress: { type},
  dropAddress: { type},

  // 🚑 Emergency type classification
  emergencyType: {
    type,
    enum: ['blitz', 'scheduled', 'intercity'],
    default: 'scheduled'
  },

  // 🚑 Patient condition assessment (from triage quiz)
  patientCondition: {
    isBreathing: { type},
    isConscious: { type},
    isBleeding: { type},
    chiefComplaint: { type},
    additionalNotes: { type},
    ageGroup: { type, enum: ['infant', 'child', 'adult', 'senior'] }
  },

  // 🚑 Geo-location for real-time tracking
  location: {
    type: { type, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] }  // [longitude, latitude]
  },

  pickupCoordinates: {
    lat: { type},
    lng: { type}
  },

  pickupLocation: {
    address: { type},
    landmark: { type},
    city: { type},
    pincode: { type}
  },

  // 🚑 Hospital destination details
  hospitalDestination: {
    hospitalId: { type},
    hospitalName: { type},
    address: { type},
    coordinates: {
      lat: { type},
      lng: { type}
    },
    emergencyDepartment: { type},
    bedAvailability: {
      general: { type},
      icu: { type},
      ventilator: { type}
    }
  },

  // 🚑 Driver assignment & tracking
  driverId: { type},
  driverName: { type},
  driverPhone: { type},
  driverRating: { type},
  vehicleNumber: { type},
  vehicleType: { type},

  // 🚑 Emergency timestamps for SLA tracking
  emergencyRequestedAt: { type},
  driverAcceptedAt: { type},
  driverReachedAt: { type},
  patientOnboardAt: { type},
  arrivedHospitalAt: { type},
  completedAt: { type},

  // 🚑 Dispatch metadata
  dispatchAttempts: { type, default: 0 },
  driversContacted: [{ 
    driverId, 
    driverName,
    accepted, 
    responseTime// seconds
  }],
  dispatchRadius: { type},  // km
  retryCount: { type, default: 0 },

  // 🚑 Trip OTP for patient-driver verification
  tripOtp: { type},
  otpVerified: { type, default},

  // 🚑 Emergency contacts notified during emergency
  emergencyContacts: [{
    name: { type},
    phone: { type},
    relationship: { type},
    notified: { type, default},
    notifiedAt: { type}
  }],

  // 🚑 Hospital ER notification tracking
  hospitalNotified: { type, default},
  hospitalNotificationId: { type},
  hospitalNotificationTime: { type},

  // 🚑 Insurance card sharing with hospital
  insuranceCardShared: { type, default},
  insuranceInfo: {
    provider: { type},
    policyNumber: { type},
    cardImageUrl: { type}
  },

  // 🚑 Digital trip sheet (insurance claim ready)
  digitalTripSheet: {
    generated: { type, default},
    tripSheetId: { type},
    pickupTime: { type},
    dropTime: { type},
    distance: { type},  // km
    duration: { type},  // minutes
    vitals: {
      bloodPressure: { type},
      pulse: { type},
      spo2: { type},
      temperature: { type},
      glucose: { type}
    },
    oxygenAdministered: { type, default},
    oxygenFlowRate: { type},  // L/min
    medicationsGiven: [{ 
      name, 
      dosage, 
      time}],
    proceduresDone: [{ type}],
    patientConditionDuringTransport: { type},
    driverNotes: { type},
    generatedAt: { type}
  },

  // 🚑 Surge pricing
  surgeMultiplier: { type, default: 1.0 },
  surgeReason: { type},
  isPeakHour: { type, default},

  // 🚑 Detailed fare breakdown
  fareBreakdown: {
    baseFare: { type},
    distanceCharge: { type},
    waitingCharge: { type},
    nightCharge: { type},
    oxygenCharge: { type},
    equipmentCharge: { type},
    surgeCharge: { type},
    platformFee: { type},
    gst: { type},
    total: { type}
  },

  // 🚑 Live tracking
  trackingUrl: { type},
  liveTrackingEnabled: { type, default},

  // 🚑 Emergency-specific cancellation
  emergencyCancellation: {
    cancelledAt: { type},
    cancelledBy: { type, enum: ['patient', 'driver', 'system'] },
    reason: { type},
    driverReachedBeforeCancel: { type, default},
    cancellationFee: { type},
    refundAmount: { type}
  },

  // 🚑 Non-emergency scheduled transport
  scheduledTransport: {
    isRecurring: { type, default},
    recurringDays: [{ type}],  // ['monday', 'wednesday', 'friday']
    recurringEndDate: { type},
    requiresOxygen: { type, default},
    requiresAttendant: { type, default},
    mobilityType: { type, enum: ['walking', 'wheelchair', 'stretcher'] },
    specialEquipment: [{ type}]
  },
  
  // ============================================
  // LAB TEST / DIAGNOSTICS FIELDS
  // ============================================
  
  tests: [{ type}],
  providerId: { type.Schema.Types.ObjectId, ref: 'Provider' },
  providerName: { type},
  homeCollectionRequested: { type, default},
  homeAddress: { type},
  bookingId: { type, unique},
  
  // ============================================
  // STATUS TRACKING
  // ============================================
  
  statusHistory: [{
    status: { 
      type, 
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
    timestamp: { type, default.now },
    note: { type}
  }],
  estimatedReportTime: { type},
  
  // ============================================
  // PAYMENT FIELDS
  // ============================================
  
  razorpayOrderId: { type},
  razorpayPaymentId: { type},
  razorpaySignature: { type},
  
  discountCode: { type},
  discountType: { type, enum: ['percentage', 'fixed'] },
  discountValue: { type},
  
  paymentMethod: { type, enum: ['card', 'upi', 'netbanking', 'wallet', 'emi'] },
  
  refundId: { type},
  refundAmount: { type},
  refundStatus: { type, enum: ['pending', 'processed', 'failed'] },
  refundedAt: { type},
  
  platformCommission: { type, default: 0 },
  providerCommission: { type, default: 0 },
  commissionStatus: { type, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  
  paymentAttempts: { type, default: 0 },
  lastPaymentError: { type},
  
  settledToProvider: { type, default},
  settledAt: { type},
  settlementId: { type},
  
  deliveryOTP: { type},
  
  // ============================================
  // MEDICINE / HOMEOPATHY PHARMACY FIELDS
  // ============================================
  
  medicines: [{ 
    name, 
    potency, 
    quantity, 
    price}],
  deliveryAddress: { type},
  trackingNumber: { type},
  deliveryStatus: { type, enum: ['processing', 'shipped', 'out_for_delivery', 'delivered'] },

  // ============================================
  // INSURANCE FIELDS
  // ============================================
  
  insurancePolicyId: { type.Schema.Types.ObjectId, ref: 'InsurancePolicy' },
  insurancePlanId: { type.Schema.Types.ObjectId, ref: 'InsurancePlan' },
  insuranceCompanyName: { type},
  insurancePlanName: { type},
  policyNumber: { type},
  sumInsured: { type},
  premiumAmount: { type},
  
  insuranceMembers: [{
    name: { type},
    relation: { type},
    age: { type},
    gender: { type},
    aadhaar: { type},
    pan: { type}
  }],
  
  policyStartDate: { type},
  policyEndDate: { type},
  policyRenewalDate: { type},
  
  insuranceClaimId: { type},
  claimAmount: { type},
  claimStatus: { 
    type, 
    enum: ['none', 'initiated', 'document_uploaded', 'under_review', 'approved', 'rejected', 'settled'],
    default: 'none'
  },
  claimDocuments: [{ type}],
  claimSettledAt: { type},

  insuranceSettlementStatus: { 
    type, 
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  insuranceSettlementDate: { type},
  insuranceSettlementTransactionId: { type},
  
  insurancePolicyDocumentUrl: { type},
  insuranceCertificateUrl: { type},
  insuranceProposalFormUrl: { type},

  // ============================================
  // OPD / ADMISSION SPECIFIC FIELDS
  // ============================================
  
  doctorSpecialization: { type},
  doctorQualification: { type},
  consultationFee: { type},
  
  roomType: { type},
  roomPrice: { type},
  numberOfDays: { type, default: 1 },
  advanceAmount: { type, default: 0 },
  remainingAmount: { type},
  
  guardianName: { type},
  guardianPhone: { type},
  relation: { type},
  
  reason: { type},
  existingReports: { type, default},
  
  insuranceProvider: { type},
  insurancePolicyNumber: { type},
  schemeApplied: { type},
  
  // ============================================
  // CANCELLATION & REFUND
  // ============================================
  
  cancellation: {
    cancelledAt: { type},
    reason: { type},
    cancelledBy: { type},
    refundAmount: { type, default: 0 },
    refundPercentage: { type, default: 0 },
    cancellationFee: { type, default: 0 },
    refundStatus: {
      type,
      enum: ['pending', 'processed', 'failed', 'not_applicable'],
      default: 'not_applicable'
    },
    refundProcessedAt: { type},
    refundTransactionId: { type}
  },
  
  // ============================================
  // REVIEW & RATING
  // ============================================
  
  review: {
    rating: { type, default: 0, min: 0, max: 5 },
    review: { type},
    doctorRating: { type, default: 0, min: 0, max: 5 },
    staffRating: { type, default: 0, min: 0, max: 5 },
    cleanlinessRating: { type, default: 0, min: 0, max: 5 },
    waitTimeRating: { type, default: 0, min: 0, max: 5 },
    valueForMoneyRating: { type, default: 0, min: 0, max: 5 },
    submittedAt: { type},
    isVerified: { type, default},
    response: { type},
    responseAt: { type}
  },
  
  // ============================================
  // FEEDBACK & FOLLOW-UP
  // ============================================
  
  feedback: {
    wouldRecommend: { type},
    feedbackText: { type},
    submittedAt: { type}
  },
  
  followUp: {
    required: { type, default},
    followUpDate: { type},
    followUpBooked: { type, default},
    followUpBookingId: { type}
  },
  
  // ============================================
  // QUEUE & WAIT TIME
  // ============================================
  
  queueNumber: { type},
  estimatedWaitTime: { type},
  actualWaitTime: { type},
  checkInTime: { type},
  consultationStartTime: { type},
  consultationEndTime: { type},
  
  // ============================================
  // PRESCRIPTION
  // ============================================
  
  prescription: {
    generated: { type, default},
    prescriptionId: { type},
    medicines: [{
      name,
      dosage,
      duration,
      instructions}],
    tests: [{
      testName,
      instructions}],
    doctorNotes: { type},
    generatedAt: { type}
  },

  // ============================================
  // NOTIFICATION TRACKING
  // ============================================
  
  notifications: [{
    type: { type, enum: ['email', 'sms', 'whatsapp', 'push'] },
    sentAt: { type, default.now },
    status: { type, enum: ['sent', 'failed', 'delivered', 'read'] },
    message: { type}
  }],
  
  // ============================================
  // ADMIN & PROVIDER METADATA
  // ============================================
  
  assignedTo: { type},
  priority: { type, enum: ['normal', 'urgent', 'emergency'], default: 'normal' },
  notes: [{
    text: { type},
    addedBy: { type},
    addedAt: { type, default.now }
  }],
  
  reportDeliveryMethod: { type, enum: ['email', 'whatsapp', 'physical', 'portal'] },
  reportDeliveredAt: { type},
  
  // ============================================
  // SPECIAL REQUIREMENTS
  // ============================================
  
  specialRequirements: { type},
  languagePreference: { type},
  wheelchairRequired: { type, default},
  interpreterRequired: { type, default}
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
        status.status,
        timestampDate(),
        note.statusHistory.length === 0 ? 'Booking created' : `Status updated to ${this.status}`
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
  if (!this.appointmentDate) return { eligible, percentage: 0 };
  
  const now = new Date();
  const appointmentTime = new Date(this.appointmentDate);
  const hoursBefore = (appointmentTime - now) / (1000 * 60 * 60);
  
  if (hoursBefore > 24) return { eligible, percentage: 90, label: 'Full refund (90%)' };
  if (hoursBefore > 6) return { eligible, percentage: 50, label: 'Partial refund (50%)' };
  if (hoursBefore > 2) return { eligible, percentage: 25, label: 'Partial refund (25%)' };
  return { eligible, percentage: 0, label: 'No refund' };
});

// 🚑 Virtualif booking is an active emergency
bookingSchema.virtual('isActiveEmergency').get(function() {
  if (this.bookingType !== 'ambulance_emergency' && this.emergencyType !== 'blitz') {
    return false;
  }
  const activeStatuses = ['confirmed', 'driver_assigned', 'driver_en_route', 'driver_arrived', 'patient_onboard'];
  return activeStatuses.includes(this.status);
});

// 🚑 Virtualemergency response time in seconds
bookingSchema.virtual('emergencyResponseTime').get(function() {
  if (this.emergencyRequestedAt && this.driverAcceptedAt) {
    return Math.round((this.driverAcceptedAt - this.emergencyRequestedAt) / 1000);
  }
  return null;
});

// 🚑 Virtualtotal trip time in minutes
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
    cancelledAtDate(),
    reason|| 'Cancelled by patient',
    cancelledBy|| this.userId,
    refundAmount.eligible ? Math.round(this.finalAmount * refundInfo.percentage / 100) : 0,
    refundPercentage.percentage,
    cancellationFee.finalAmount - (refundInfo.eligible ? Math.round(this.finalAmount * refundInfo.percentage / 100) : 0),
    refundStatus.eligible ? 'pending' : 'not_applicable'
  };
  
  this.statusHistory.push({
    status: 'cancelled',
    timestampDate(),
    note: `Cancelled. Refund: ₹${this.cancellation.refundAmount} (${refundInfo.percentage}%)`
  });
  
  return this.save();
};

bookingSchema.methods.submitReview = async function(reviewData) {
  this.review = {
    ...reviewData,
    submittedAtDate(),
    isVerified};
  
  this.statusHistory.push({
    status.status,
    timestampDate(),
    note: 'Review submitted by patient'
  });
  
  return this.save();
};

bookingSchema.methods.checkIn = async function() {
  this.checkInTime = new Date();
  this.status = 'in_progress';
  
  this.statusHistory.push({
    status: 'in_progress',
    timestampDate(),
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
      generated,
      ...prescriptionData,
      generatedAtDate()
    };
  }
  
  this.statusHistory.push({
    status: 'completed',
    timestampDate(),
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
    timestampDate(),
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
    timestampDate(),
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
    timestampDate(),
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
    timestampDate(),
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
    timestampDate(),
    note: '🚑 Emergency trip completed'
  });
  
  return this.save();
};

// Cancel emergency with different logic than regular cancellation
bookingSchema.methods.cancelEmergency = async function(reason, cancelledBy) {
  const now = new Date();
  
  this.status = 'cancelled';
  this.emergencyCancellation = {
    cancelledAt,
    cancelledBy|| 'patient',
    reason|| 'Cancelled by patient',
    driverReachedBeforeCancel.status === 'driver_arrived',
    cancellationFee.status === 'driver_arrived' ? Math.round(this.finalAmount * 0.3) : 0,
    refundAmount.status === 'driver_arrived' 
      ? Math.round(this.finalAmount * 0.7) 
      .finalAmount
  };
  
  this.statusHistory.push({
    status: 'cancelled',
    timestamp,
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
    generated,
    tripSheetId: 'TRIP' + Date.now(),
    generatedAtDate()
  };
  
  this.statusHistory.push({
    status.status,
    timestampDate(),
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
    distanceCharge* perKm,
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
      notified,
      notifiedAtDate()
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


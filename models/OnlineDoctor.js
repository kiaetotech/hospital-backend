const mongoose = require('mongoose');

const onlineDoctorSchema = new mongoose.Schema({
  // ============================================
  // BASIC INFO
  // ============================================
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // ============================================
  // PROFESSIONAL DETAILS
  // ============================================
  specialization: { type: String, required: true, index: true },
  subSpecialization: String,
  qualification: { type: String, required: true },
  experience: { type: Number, default: 0 },
  yearsOfExperience: Number,
  languages: [{ type: String }],
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  about: { type: String, maxlength: 1000 },
  
  // ============================================
  // REGISTRATION
  // ============================================
  registrationNumber: { type: String, required: true },
  medicalCouncil: { type: String, default: 'MCI' },
  registrationYear: Number,
  
  // ============================================
  // 🆕 FEE SETTINGS (Doctor Controlled)
  // ============================================
  consultationFee: { 
    type: Number, 
    required: true,
    default: 500,
    min: 0 
  },
  followUpFee: { 
    type: Number, 
    default: 200,
    min: 0 
  },
  followUpWindowDays: { 
    type: Number, 
    default: 7,
    min: 1,
    max: 30 
  },
  freeFollowUps: { 
    type: Number, 
    default: 1,
    min: 0,
    max: 5 
  },
  emergencyConsultFee: { 
    type: Number, 
    default: 800,
    min: 0 
  },
  consultationDuration: { 
    type: Number, 
    default: 15,
    min: 5,
    max: 60 
  },
  packagePrice: {
    type: Number,
    default: 0,  // 0 = no package offered
    min: 0
  },
  
  // ============================================
  // CONSULTATION MODES
  // ============================================
  consultationModes: {
    video: { type: Boolean, default: true },
    audio: { type: Boolean, default: true }
  },
  
  // ============================================
  // AVAILABILITY (Doctor-Managed)
  // ============================================
  availability: [{
    day: { 
      type: String, 
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] 
    },
    isAvailable: { type: Boolean, default: false },
    slots: [{
      startTime: { type: String },
      endTime: { type: String },
      maxBookings: { type: Number, default: 5 },
      currentBookings: { type: Number, default: 0 }
    }]
  }],
  
  // Blocked dates (vacation, holidays)
  blockedDates: [{
    date: Date,
    reason: String
  }],
  
  isAvailable: { type: Boolean, default: true },
  
  // ============================================
  // DOCUMENTS
  // ============================================
  documents: {
    registrationCert: { type: String },
    degreeCert: { type: String },
    idProof: { type: String },
    photo: { type: String },
    panCard: { type: String }
  },
  
  // ============================================
  // VERIFICATION
  // ============================================
  verificationStatus: {
    type: String,
    enum: ['pending', 'documents_uploaded', 'verified', 'rejected', 'suspended'],
    default: 'pending'
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  verifiedAt: Date,
  rejectionReason: String,
  isActive: { type: Boolean, default: false },
  
  // ============================================
  // RATINGS & REVIEWS
  // ============================================
  ratingSummary: {
    averageRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 }
  },
  
  // ============================================
  // STATISTICS
  // ============================================
  stats: {
    totalConsultations: { type: Number, default: 0 },
    completedConsultations: { type: Number, default: 0 },
    cancelledConsultations: { type: Number, default: 0 },
    totalFollowUps: { type: Number, default: 0 },
    freeFollowUpsGiven: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    platformCommissionPaid: { type: Number, default: 0 },
    repeatPatients: { type: Number, default: 0 },
    monthlyConsultVolume: { type: Number, default: 0 }
  },
  
  // ============================================
  // COMMISSION (Performance-Based)
  // ============================================
  commissionSlab: {
    type: String,
    enum: ['default', 'silver', 'gold', 'platinum', 'diamond'],
    default: 'default'
  },
  commissionPercentage: { type: Number, default: 20 },
  
  // ============================================
  // BANK DETAILS (For Payouts)
  // ============================================
  bankDetails: {
    accountHolder: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    branchName: String,
    upiId: String
  },
  
  // ============================================
  // PROFILE PHOTO
  // ============================================
  profilePhoto: String,
  
  // ============================================
  // OPTIONAL: HOSPITAL AFFILIATION
  // ============================================
  hospitalAffiliation: {
    mentioned: { type: Boolean, default: false },
    hospitalName: String,
    city: String
  },
  
  // ============================================
  // PASSWORD RESET
  // ============================================
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  
  // ============================================
  // OTP
  // ============================================
  otp: String,
  otpExpires: Date,
  
  // ============================================
  // TIMESTAMPS
  // ============================================
  lastLoginAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
  
}, { timestamps: true });

// ============================================
// INDEXES
// ============================================

onlineDoctorSchema.index({ specialization: 1, isActive: 1 });
onlineDoctorSchema.index({ verificationStatus: 1 });
onlineDoctorSchema.index({ 'ratingSummary.averageRating': -1 });
onlineDoctorSchema.index({ consultationFee: 1 });
onlineDoctorSchema.index({ followUpFee: 1 });
onlineDoctorSchema.index({ name: 'text', specialization: 'text' });

// ============================================
// VIRTUALS
// ============================================

onlineDoctorSchema.virtual('fullTitle').get(function() {
  return `Dr. ${this.name} - ${this.specialization}`;
});

onlineDoctorSchema.virtual('netEarningPerConsult').get(function() {
  return this.consultationFee * (1 - this.commissionPercentage / 100);
});

onlineDoctorSchema.virtual('netEarningPerFollowUp').get(function() {
  return this.followUpFee * (1 - this.commissionPercentage / 100);
});

onlineDoctorSchema.virtual('packageSavings').get(function() {
  if (!this.packagePrice || this.packagePrice <= 0) return 0;
  const separateTotal = this.consultationFee + this.followUpFee;
  return separateTotal - this.packagePrice;
});

// ============================================
// METHODS
// ============================================

// Check if doctor is available on a specific day
onlineDoctorSchema.methods.isAvailableOn = function(dayName) {
  const daySchedule = this.availability?.find(a => a.day === dayName);
  if (!daySchedule || !daySchedule.isAvailable) return false;
  if (!this.isAvailable || !this.isActive) return false;
  return true;
};

// Get available slots for a day
onlineDoctorSchema.methods.getAvailableSlots = function(dayName) {
  const daySchedule = this.availability?.find(a => a.day === dayName);
  if (!daySchedule) return [];
  return daySchedule.slots.filter(s => s.currentBookings < s.maxBookings);
};

// Check if patient is eligible for follow-up rate
onlineDoctorSchema.methods.isFollowUpEligible = function(lastConsultDate) {
  if (!lastConsultDate) return false;
  const daysSinceConsult = Math.floor((Date.now() - new Date(lastConsultDate).getTime()) / (1000 * 60 * 60 * 24));
  return daysSinceConsult <= this.followUpWindowDays;
};

// Check if patient has free follow-ups remaining
onlineDoctorSchema.methods.hasFreeFollowUps = function(patientFreeFollowUpsUsed = 0) {
  return patientFreeFollowUpsUsed < this.freeFollowUps;
};

// Get pricing for patient
onlineDoctorSchema.methods.getPricingForPatient = function(lastConsultDate = null, freeFollowUpsUsed = 0) {
  const pricing = {
    consultation: {
      type: 'video_consult',
      label: 'Video Consultation',
      fee: this.consultationFee,
      duration: this.consultationDuration
    },
    followUp: null,
    emergency: {
      type: 'emergency_consult',
      label: 'Emergency Consult',
      fee: this.emergencyConsultFee,
      duration: this.consultationDuration
    },
    package: null
  };

  // Check follow-up eligibility
  if (this.isFollowUpEligible(lastConsultDate)) {
    if (this.hasFreeFollowUps(freeFollowUpsUsed)) {
      pricing.followUp = {
        type: 'free_follow_up',
        label: 'Free Follow-up',
        fee: 0,
        originalFee: this.followUpFee,
        freeRemaining: this.freeFollowUps - freeFollowUpsUsed,
        windowDays: this.followUpWindowDays
      };
    } else {
      pricing.followUp = {
        type: 'follow_up',
        label: 'Follow-up Consultation',
        fee: this.followUpFee,
        originalFee: this.consultationFee,
        savings: this.consultationFee - this.followUpFee,
        windowDays: this.followUpWindowDays
      };
    }
  }

  // Package pricing
  if (this.packagePrice > 0) {
    pricing.package = {
      type: 'package_consult',
      label: 'Package (Consult + Follow-up)',
      fee: this.packagePrice,
      originalFee: this.consultationFee + this.followUpFee,
      savings: this.packageSavings
    };
  }

  return pricing;
};

// Update commission slab based on performance
onlineDoctorSchema.methods.updateCommissionSlab = function() {
  const consults = this.stats?.completedConsultations || 0;
  const rating = this.ratingSummary?.averageRating || 0;
  
  if (consults >= 1000 && rating >= 4.9) {
    this.commissionSlab = 'diamond';
    this.commissionPercentage = 12;
  } else if (consults >= 500 && rating >= 4.8) {
    this.commissionSlab = 'platinum';
    this.commissionPercentage = 15;
  } else if (consults >= 200 && rating >= 4.5) {
    this.commissionSlab = 'gold';
    this.commissionPercentage = 18;
  } else if (consults >= 50 && rating >= 4.2) {
    this.commissionSlab = 'silver';
    this.commissionPercentage = 20;
  } else {
    this.commissionSlab = 'default';
    this.commissionPercentage = 20;
  }
  
  return this.commissionPercentage;
};

// Get public profile (safe data)
onlineDoctorSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    name: this.name,
    specialization: this.specialization,
    subSpecialization: this.subSpecialization,
    qualification: this.qualification,
    experience: this.experience,
    languages: this.languages,
    gender: this.gender,
    about: this.about,
    consultationFee: this.consultationFee,
    followUpFee: this.followUpFee,
    followUpWindowDays: this.followUpWindowDays,
    freeFollowUps: this.freeFollowUps,
    emergencyConsultFee: this.emergencyConsultFee,
    consultationDuration: this.consultationDuration,
    packagePrice: this.packagePrice,
    consultationModes: this.consultationModes,
    ratingSummary: this.ratingSummary,
    profilePhoto: this.profilePhoto,
    isAvailable: this.isAvailable,
    availability: this.availability,
    hospitalAffiliation: this.hospitalAffiliation
  };
};

module.exports = mongoose.model('OnlineDoctor', onlineDoctorSchema);
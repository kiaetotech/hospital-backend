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
  // CONSULTATION SETTINGS
  // ============================================
  consultationFee: { type: Number, required: true },
  consultationDuration: { type: Number, default: 15 },
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
    totalEarnings: { type: Number, default: 0 },
    platformCommissionPaid: { type: Number, default: 0 },
    repeatPatients: { type: Number, default: 0 }
  },
  
  // ============================================
  // COMMISSION (Performance-Based)
  // ============================================
  commissionSlab: {
    type: String,
    enum: ['default', 'silver', 'gold', 'platinum', 'diamond'],
    default: 'default'
  },
  commissionPercentage: { type: Number, default: 25 },
  
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
    this.commissionPercentage = 20;
  } else if (consults >= 50 && rating >= 4.2) {
    this.commissionSlab = 'silver';
    this.commissionPercentage = 22;
  } else {
    this.commissionSlab = 'default';
    this.commissionPercentage = 25;
  }
  
  return this.commissionPercentage;
};

// Get public profile (safe data)
onlineDoctorSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    name: this.name,
    specialization: this.specialization,
    qualification: this.qualification,
    experience: this.experience,
    languages: this.languages,
    gender: this.gender,
    about: this.about,
    consultationFee: this.consultationFee,
    consultationDuration: this.consultationDuration,
    consultationModes: this.consultationModes,
    ratingSummary: this.ratingSummary,
    profilePhoto: this.profilePhoto,
    isAvailable: this.isAvailable,
    availability: this.availability,
    hospitalAffiliation: this.hospitalAffiliation
  };
};

module.exports = mongoose.model('OnlineDoctor', onlineDoctorSchema);
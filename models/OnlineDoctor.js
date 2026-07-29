const mongoose = require('mongoose');

const onlineDoctorSchema = new mongoose.Schema({
  // ============================================
  // BASIC INFO
  // ============================================
  name: { type, required},
  email: { type, unique, sparse},
  phone: { type, required, unique},
  password: { type, required},
  
  // ============================================
  // PROFESSIONAL DETAILS
  // ============================================
  specialization: { type, required, index},
  subSpecialization,
  qualification: { type, required},
  experience: { type, default: 0 },
  yearsOfExperience,
  languages: [{ type}],
  gender: { type, enum: ['Male', 'Female', 'Other'] },
  about: { type, maxlength: 1000 },
  
  // ============================================
  // REGISTRATION
  // ============================================
  registrationNumber: { type, required},
  medicalCouncil: { type, default: 'MCI' },
  registrationYear,
  
  // ============================================
  // FEE SETTINGS (Doctor Controlled)
  // ============================================
  consultationFee: { 
    type, 
    required,
    default: 500,
    min: 0 
  },
  followUpFee: { 
    type, 
    default: 200,
    min: 0 
  },
  followUpWindowDays: { 
    type, 
    default: 7,
    min: 1,
    max: 30 
  },
  freeFollowUps: { 
    type, 
    default: 1,
    min: 0,
    max: 5 
  },
  emergencyConsultFee: { 
    type, 
    default: 800,
    min: 0 
  },
  consultationDuration: { 
    type, 
    default: 15,
    min: 5,
    max: 60 
  },
  packagePrice: {
    type,
    default: 0,
    min: 0
  },
  
  // ============================================
  // CONSULTATION MODES
  // ============================================
  consultationModes: {
    video: { type, default},
    audio: { type, default}
  },
  
  // ============================================
  // AVAILABILITY (Doctor-Managed)
  // ============================================
  availability: [{
    day: { 
      type, 
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] 
    },
    isAvailable: { type, default},
    slots: [{
      startTime: { type},
      endTime: { type},
      maxBookings: { type, default: 5 },
      currentBookings: { type, default: 0 }
    }]
  }],
  
  blockedDates: [{
    date,
    reason}],
  
  isAvailable: { type, default},
  
  // ============================================
  // DOCUMENTS
  // ============================================
  documents: {
    registrationCert: { type},
    degreeCert: { type},
    idProof: { type},
    photo: { type},
    panCard: { type}
  },
  
  // ============================================
  // VERIFICATION
  // ============================================
  verificationStatus: {
    type,
    enum: ['pending', 'documents_uploaded', 'verified', 'rejected', 'suspended'],
    default: 'pending'
  },
  verifiedBy: { type.Schema.Types.ObjectId, ref: 'Admin' },
  verifiedAt,
  rejectionReason,
  isActive: { type, default},
  
  // ============================================
  // RATINGS & REVIEWS
  // ============================================
  ratingSummary: {
    averageRating: { type, default: 0 },
    totalReviews: { type, default: 0 }
  },
  
  // ============================================
  // STATISTICS
  // ============================================
  stats: {
    totalConsultations: { type, default: 0 },
    completedConsultations: { type, default: 0 },
    cancelledConsultations: { type, default: 0 },
    totalFollowUps: { type, default: 0 },
    freeFollowUpsGiven: { type, default: 0 },
    totalEarnings: { type, default: 0 },
    platformCommissionPaid: { type, default: 0 },
    repeatPatients: { type, default: 0 },
    monthlyConsultVolume: { type, default: 0 }
  },
  
  // ============================================
  // COMMISSION (Performance-Based)
  // ============================================
  commissionSlab: {
    type,
    enum: ['default', 'silver', 'gold', 'platinum', 'diamond'],
    default: 'default'
  },
  commissionPercentage: { type, default: 20 },
  
  // ============================================
  // BANK DETAILS (For Payouts)
  // ============================================
  bankDetails: {
    accountHolder,
    accountNumber,
    ifscCode,
    bankName,
    branchName,
    upiId},
  
  // ============================================
  // PROFILE PHOTO
  // ============================================
  profilePhoto,
  
  // ============================================
  // OPTIONALAFFILIATION
  // ============================================
  hospitalAffiliation: {
    mentioned: { type, default},
    hospitalName,
    city},
  
  // ============================================
  // PASSWORD RESET
  // ============================================
  resetPasswordToken,
  resetPasswordExpires,
  
  // ============================================
  // OTP
  // ============================================
  otp,
  otpExpires,

  // ============================================
  // 🆕 CORPORATE HEALTH
  // ============================================
  servesCorporate: { 
    type, 
    default,
    index},
  
  corporatePackages: [{
    packageName: { type, required},
    packageType: {
      type,
      enum: ['opd_subscription', 'teleconsult_package', 'wellness_program', 'specialist_panel', 'custom'],
      default: 'teleconsult_package'
    },
    description,
    servicesIncluded: [String],
    pricePerEmployee: { type, required},
    discountedPricePerEmployee,
    minEmployees: { type, default: 10 },
    maxEmployees,
    validityDays: { type, default: 365 },
    consultationLimitPerEmployee: { type, default: 12 },
    availableCities: [String],
    dedicatedPOC: {
      name,
      phone,
      email},
    slaTerms,
    isActive: { type, default},
    createdAt: { type, default.now },
    updatedAt: { type, default.now }
  }],
  
  corporateEnquiries: [{
    companyName,
    contactPerson,
    email,
    phone,
    employeeCount,
    requirements,
    status: {
      type,
      enum: ['new', 'contacted', 'negotiating', 'converted', 'closed'],
      default: 'new'
    },
    createdAt: { type, default.now }
  }],
  
  // ============================================
  // TIMESTAMPS
  // ============================================
  lastLoginAt,
  createdAt: { type, default.now },
  updatedAt: { type, default.now }
  
}, { timestamps});

// ============================================
// INDEXES
// ============================================

onlineDoctorSchema.index({ specialization: 1, isActive: 1 });
onlineDoctorSchema.index({ verificationStatus: 1 });
onlineDoctorSchema.index({ 'ratingSummary.averageRating': -1 });
onlineDoctorSchema.index({ consultationFee: 1 });
onlineDoctorSchema.index({ followUpFee: 1 });
onlineDoctorSchema.index({ name: 'text', specialization: 'text' });

// 🆕 Corporate indexes
onlineDoctorSchema.index({ servesCorporate: 1, 'corporatePackages.packageType': 1 });
onlineDoctorSchema.index({ 'corporatePackages.isActive': 1 });

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

onlineDoctorSchema.methods.isAvailableOn = function(dayName) {
  const daySchedule = this.availability?.find(a => a.day === dayName);
  if (!daySchedule || !daySchedule.isAvailable) return false;
  if (!this.isAvailable || !this.isActive) return false;
  return true;
};

onlineDoctorSchema.methods.getAvailableSlots = function(dayName) {
  const daySchedule = this.availability?.find(a => a.day === dayName);
  if (!daySchedule) return [];
  return daySchedule.slots.filter(s => s.currentBookings < s.maxBookings);
};

onlineDoctorSchema.methods.isFollowUpEligible = function(lastConsultDate) {
  if (!lastConsultDate) return false;
  const daysSinceConsult = Math.floor((Date.now() - new Date(lastConsultDate).getTime()) / (1000 * 60 * 60 * 24));
  return daysSinceConsult <= this.followUpWindowDays;
};

onlineDoctorSchema.methods.hasFreeFollowUps = function(patientFreeFollowUpsUsed = 0) {
  return patientFreeFollowUpsUsed < this.freeFollowUps;
};

onlineDoctorSchema.methods.getPricingForPatient = function(lastConsultDate = null, freeFollowUpsUsed = 0) {
  const pricing = {
    consultation: {
      type: 'video_consult',
      label: 'Video Consultation',
      fee.consultationFee,
      duration.consultationDuration
    },
    followUp,
    emergency: {
      type: 'emergency_consult',
      label: 'Emergency Consult',
      fee.emergencyConsultFee,
      duration.consultationDuration
    },
    package};

  if (this.isFollowUpEligible(lastConsultDate)) {
    if (this.hasFreeFollowUps(freeFollowUpsUsed)) {
      pricing.followUp = {
        type: 'free_follow_up',
        label: 'Free Follow-up',
        fee: 0,
        originalFee.followUpFee,
        freeRemaining.freeFollowUps - freeFollowUpsUsed,
        windowDays.followUpWindowDays
      };
    } else {
      pricing.followUp = {
        type: 'follow_up',
        label: 'Follow-up Consultation',
        fee.followUpFee,
        originalFee.consultationFee,
        savings.consultationFee - this.followUpFee,
        windowDays.followUpWindowDays
      };
    }
  }

  if (this.packagePrice > 0) {
    pricing.package = {
      type: 'package_consult',
      label: 'Package (Consult + Follow-up)',
      fee.packagePrice,
      originalFee.consultationFee + this.followUpFee,
      savings.packageSavings
    };
  }

  return pricing;
};

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

onlineDoctorSchema.methods.getPublicProfile = function() {
  return {
    id._id,
    name.name,
    specialization.specialization,
    subSpecialization.subSpecialization,
    qualification.qualification,
    experience.experience,
    languages.languages,
    gender.gender,
    about.about,
    consultationFee.consultationFee,
    followUpFee.followUpFee,
    followUpWindowDays.followUpWindowDays,
    freeFollowUps.freeFollowUps,
    emergencyConsultFee.emergencyConsultFee,
    consultationDuration.consultationDuration,
    packagePrice.packagePrice,
    consultationModes.consultationModes,
    ratingSummary.ratingSummary,
    profilePhoto.profilePhoto,
    isAvailable.isAvailable,
    availability.availability,
    hospitalAffiliation.hospitalAffiliation
  };
};

// 🆕 Corporate methods
onlineDoctorSchema.methods.toggleCorporate = function(enable = true) {
  this.servesCorporate = enable;
  if (!enable) {
    this.corporatePackages.forEach(pkg => { pkg.isActive = false; });
  }
  return this.save();
};

onlineDoctorSchema.methods.addCorporatePackage = function(packageData) {
  this.corporatePackages.push(packageData);
  if (!this.servesCorporate) {
    this.servesCorporate = true;
  }
  return this.save();
};

onlineDoctorSchema.methods.getActiveCorporatePackages = function() {
  return this.corporatePackages.filter(pkg => pkg.isActive);
};

// 🆕 Statics
onlineDoctorSchema.statics.findCorporateDoctors = function(city = null) {
  const query = { servesCorporate, isActive, verificationStatus: 'verified' };
  return this.find(query).select('name specialization consultationFee corporatePackages ratingSummary profilePhoto');
};

module.exports = mongoose.model('OnlineDoctor', onlineDoctorSchema);


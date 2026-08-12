const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // ============================================
  // YOUR EXISTING FIELDS (ALL PRESERVED)
  // ============================================
  
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['hospital', 'diagnostics_provider', 'caregiver_provider', 'lender', 'online_doctor', 'ayurveda_doctor', 'homeopathy_doctor', 'therapist', 'corporate_hr', 'admin', 'patient', 'ambulance_provider', 'insurance_company'], 
    default: 'patient' 
  },
     // Patient profile fields
  patientAddress: {
    line1: { type: String },
    line2: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String }
  },
  patientLocation: {
    lat: { type: Number },
    lng: { type: Number }
  },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },

  // ============================================
  // NEW FIELDS FOR INSURANCE (ADDED)
  // ============================================
  
  // Insurance Company specific fields
  companyName: { type: String },
  companyRegistrationNumber: { type: String },
  irdaRegistration: { type: String },
  gstNumber: { type: String },
  companyLogo: { type: String },
  companyDescription: { type: String },
  companyWebsite: { type: String },
  companyPhone: { type: String },
  companyEmail: { type: String },
  
  // Insurance Company address
  companyAddress: {
    line1: { type: String },
    line2: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    country: { type: String, default: 'India' }
  },
  
  // Insurance Company bank details (for settlements)
  companyBankDetails: {
    accountNumber: { type: String },
    ifscCode: { type: String },
    accountHolderName: { type: String },
    bankName: { type: String },
    branchName: { type: String }
  },
  
  // Insurance Company documents
  companyDocuments: [{
    name: { type: String },
    url: { type: String },
    type: { type: String }, // irda_certificate, gst_certificate, pan_card, etc.
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // Insurance Company settings
  companySettings: {
    defaultCommissionRate: { type: Number, default: 15 }, // Platform commission percentage
    settlementTerms: { 
      type: String, 
      enum: ['immediate', 'weekly', 'monthly'],
      default: 'weekly'
    },
    autoApprovePlans: { type: Boolean, default: false },
    enableCashlessClaim: { type: Boolean, default: true }
  },
  
  // Insurance Agent specific fields
  agentId: { type: String },
  agentLicenseNumber: { type: String },
  agencyName: { type: String },
  agentExperience: { type: Number },
  agentSpecializations: [{ type: String }],
  agentCommissionRate: { type: Number, default: 5 }, // Agent's commission share
  
  // Corporate HR specific fields
  corporateName: { type: String },
  corporateGST: { type: String },
  corporatePAN: { type: String },
  employeeCount: { type: Number },
  corporateIndustry: { type: String },
  corporateAddress: {
    line1: { type: String },
    line2: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    country: { type: String, default: 'India' }
  },

  // ============================================
  // 🚑 AMBULANCE PROVIDER FIELDS (NEW)
  // ============================================

  // Ambulance company/fleet details
  ambulanceCompanyName: { type: String },
  ambulanceCompanyPhone: { type: String },
  ambulanceCompanyEmail: { type: String },
  ambulanceCompanyAddress: {
    line1: { type: String },
    line2: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    country: { type: String, default: 'India' }
  },
  ambulanceCompanyGST: { type: String },
  ambulanceCompanyPAN: { type: String },

  // Ambulance fleet
  ambulanceFleet: [{
    vehicleId: { type: String },
    vehicleNumber: { type: String },
    vehicleType: { 
      type: String, 
      enum: ['basic', 'cardiac', 'ventilator', 'neonatal', 'mortuary', 'wheelchair']
    },
    make: { type: String },           // Tata, Force, Maruti, etc.
    model: { type: String },          // Winger, Traveller, Eeco, etc.
    year: { type: Number },
    registrationCertificate: { type: String },    // Cloudinary URL
    insuranceDocument: { type: String },          // Cloudinary URL
    fitnessCertificate: { type: String },         // Cloudinary URL
    pollutionCertificate: { type: String },       // Cloudinary URL
    permitsDocument: { type: String },            // Cloudinary URL
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    equipment: [{ 
      name: { type: String },         // Oxygen cylinder, Defibrillator, Suction machine, etc.
      available: { type: Boolean, default: true },
      lastServiced: { type: Date }
    }],
    basePrice: { type: Number },                  // Base fare for this vehicle
    pricePerKm: { type: Number, default: 25 },    // Per km charge
    minimumCharge: { type: Number, default: 500 }, // Minimum fare
    nightChargeMultiplier: { type: Number, default: 1.5 },
    oxygenCharge: { type: Number, default: 200 },
    createdAt: { type: Date, default: Date.now }
  }],

  // Ambulance drivers (managed by provider)
  ambulanceDrivers: [{
    driverId: { type: String },
    name: { type: String },
    phone: { type: String },
    email: { type: String },
    dateOfBirth: { type: Date },
    licenseNumber: { type: String },
    licenseDocument: { type: String },            // Cloudinary URL
    aadhaarCard: { type: String },                // Cloudinary URL
    photo: { type: String },                      // Cloudinary URL
    experience: { type: Number },                 // Years of experience
    trainingCertifications: [{ 
      name: { type: String },                     // BLS, ACLS, First Aid, etc.
      document: { type: String },                 // Cloudinary URL
      issuedDate: { type: Date },
      expiryDate: { type: Date }
    }],
    isVerified: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: false },
        currentLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }
    },
    lastLocationUpdate: { type: Date },
    assignedVehicle: { type: String },
    rating: { type: Number, default: 0 },
    totalTrips: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    emergencyTripsCompleted: { type: Number, default: 0 },
    acceptanceRate: { type: Number, default: 100 },
    averageResponseTime: { type: Number },
    isOnTrip: { type: Boolean, default: false },
    currentTripId: { type: String },
    joinedAt: { type: Date, default: Date.now }
  }],

  // Ambulance provider settings
  ambulanceSettings: {
    serviceArea: { type: String },                // City/Region name
    serviceAreaCoordinates: {
      center: {
        lat: { type: Number },
        lng: { type: Number }
      },
      radius: { type: Number }                    // Service radius in km
    },
    operatingHours: {
      open: { type: String, default: '00:00' },   // 24/7 by default
      close: { type: String, default: '23:59' }
    },
    acceptsEmergency: { type: Boolean, default: true },
    acceptsScheduled: { type: Boolean, default: true },
    acceptsIntercity: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: false },
    emergencyResponseTime: { type: Number },       // Target response time in minutes
    maxConcurrentEmergencies: { type: Number, default: 5 },
    autoAcceptEmergencies: { type: Boolean, default: false },
    commissionRate: { type: Number, default: 15 }, // Platform commission
    settlementTerms: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly'],
      default: 'weekly'
    },
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'upi', 'both'],
      default: 'bank_transfer'
    }
  },

  // Ambulance provider bank details
  ambulanceBankDetails: {
    accountNumber: { type: String },
    ifscCode: { type: String },
    accountHolderName: { type: String },
    bankName: { type: String },
    branchName: { type: String },
    upiId: { type: String }
  },

  // Ambulance provider documents
  ambulanceDocuments: [{
    name: { type: String },
    url: { type: String },
    type: { type: String },              // pan_card, gst_certificate, fleet_registration, etc.
    uploadedAt: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    rejectionReason: { type: String }
  }],

  // Ambulance provider statistics
  ambulanceStats: {
    totalTripsCompleted: { type: Number, default: 0 },
    emergencyTripsCompleted: { type: Number, default: 0 },
    scheduledTripsCompleted: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    totalCommissionPaid: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    averageResponseTime: { type: Number },       // Seconds across all trips
    cancellationRate: { type: Number, default: 0 },
    activeVehicles: { type: Number, default: 0 },
    activeDrivers: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },

  // Ambulance provider verification status
  ambulanceVerificationStatus: {
    type: String,
    enum: ['pending', 'under_review', 'verified', 'rejected', 'suspended'],
    default: 'pending'
  },
  ambulanceVerificationNotes: { type: String },
  ambulanceVerifiedAt: { type: Date },
  ambulanceVerifiedBy: { type: String },         // Admin ID who verified

  // 🚑 Ambulance DRIVER-specific fields (for role: 'ambulance_driver')
  driverProviderId: { type: String },            // Linked ambulance_provider ID
  driverProviderName: { type: String },
  driverLicenseNumber: { type: String },
  driverLicenseDocument: { type: String },
  driverPhoto: { type: String },
  driverAadhaar: { type: String },
  driverExperience: { type: Number },
  driverTrainingCertifications: [{
    name: { type: String },
    document: { type: String },
    issuedDate: { type: Date },
    expiryDate: { type: Date }
  }],
  driverAssignedVehicle: { type: String },
  driverCurrentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
  driverLastLocationUpdate: { type: Date },
  driverIsAvailable: { type: Boolean, default: false },
  driverIsOnTrip: { type: Boolean, default: false },
  driverCurrentTripId: { type: String },
  driverRating: { type: Number, default: 0 },
  driverTotalTrips: { type: Number, default: 0 },
  driverTotalEarnings: { type: Number, default: 0 },
  driverEmergencyTripsCompleted: { type: Number, default: 0 },
  driverAcceptanceRate: { type: Number, default: 100 },
  driverAverageResponseTime: { type: Number },
  driverVerificationStatus: {
    type: String,
    enum: ['pending', 'under_review', 'verified', 'rejected', 'suspended'],
    default: 'pending'
  },
  
  // ============================================
  // EXISTING FIELDS CONTINUED
  // ============================================
  
  // Profile fields (for all users)
  profilePicture: { type: String },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  
  // Address (for patients/customers)
  address: {
    line1: { type: String },
    line2: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    country: { type: String, default: 'India' }
  },
  
  // Emergency contact
  emergencyContact: {
    name: { type: String },
    phone: { type: String },
    relation: { type: String }
  },
  
  // Medical info (for patients)
  medicalHistory: { type: String },
  allergies: [{ type: String }],
  bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  
  // Caregiver specific fields
  caregiverExperience: { type: Number },
  caregiverSpecializations: [{ type: String }],
  caregiverCertifications: [{ type: String }],
  
  // Admin specific fields
  adminLevel: { type: String, enum: ['super', 'moderator', 'support'] },
  adminPermissions: [{ type: String }],
  
  // Account status
  isActive: { type: Boolean, default: true },
  isBlocked: { type: Boolean, default: false },
  blockedReason: { type: String },
  
  // Login tracking
  lastLogin: { type: Date },
  loginCount: { type: Number, default: 0 },
  
  // Two-factor authentication
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  
  // Password reset
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  
  // ============================================
  // EMAIL VERIFICATION (EXISTING - PRESERVED)
  // ============================================
  
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },
  
  // ============================================
  // PHONE VERIFICATION (EXISTING - PRESERVED)
  // ============================================
  
  phoneVerified: { type: Boolean, default: false },
  phoneVerificationToken: { type: String },
  phoneVerificationExpires: { type: Date },
  
  // ============================================
  // ADDITIONAL PHONE VERIFICATION FIELDS (NEW - ADDED)
  // ============================================
  
  phoneVerificationDate: { type: Date },
  phoneVerificationAttempts: { type: Number, default: 0 },
  phoneVerificationBlockedUntil: { type: Date },
  
  // ============================================
  // ADDITIONAL EMAIL VERIFICATION FIELDS (NEW - ADDED)
  // ============================================
  
  emailVerificationDate: { type: Date },
  emailVerificationAttempts: { type: Number, default: 0 },
  
  // ============================================
  // KYC STATUS (EXISTING - PRESERVED)
  // ============================================
  
  kycStatus: { 
    type: String, 
    enum: ['pending', 'submitted', 'verified', 'rejected'],
    default: 'pending'
  },
  kycDocuments: [{
    type: { type: String },
    url: { type: String },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    rejectionReason: { type: String }
  }],
  
  // ============================================
  // NOTIFICATION PREFERENCES (EXISTING - PRESERVED)
  // ============================================
  
  notificationPreferences: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false }
  },
  
  // ============================================
  // APP SETTINGS (EXISTING - PRESERVED)
  // ============================================
  
  appSettings: {
    language: { type: String, default: 'en' },
    currency: { type: String, default: 'INR' },
    timezone: { type: String, default: 'Asia/Kolkata' }
  },
  
  // ============================================
  // DEVICE INFO (EXISTING - PRESERVED)
  // ============================================
  
  devices: [{
    deviceId: { type: String },
    deviceName: { type: String },
    deviceType: { type: String },
    lastUsed: { type: Date },
    isActive: { type: Boolean, default: true }
  }],
  
  // ============================================
  // REFERRAL SYSTEM (EXISTING - PRESERVED)
  // ============================================
  
  referralCode: { type: String, unique: true },
  referredBy: { type: String },
  referrals: [{
    userId: { type: String },
    date: { type: Date, default: Date.now },
    rewardEarned: { type: Number }
  }],
  
  // ============================================
  // POINTS/LOYALTY (EXISTING - PRESERVED)
  // ============================================
  
  loyaltyPoints: { type: Number, default: 0 },
  loyaltyTier: { 
    type: String, 
    enum: ['bronze', 'silver', 'gold', 'platinum'],
    default: 'bronze'
  },
  
  // ============================================
  // AUDIT (EXISTING - PRESERVED)
  // ============================================
  
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date }
}, {
  timestamps: true
});

// ============================================
// INDEXES (PRESERVED + NEW)
// ============================================

userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ companyName: 1 });
userSchema.index({ irdaRegistration: 1 });
userSchema.index({ corporateName: 1 });
userSchema.index({ phoneVerified: 1 });
userSchema.index({ emailVerified: 1 });
// 🚑 NEW: Ambulance indexes
userSchema.index({ ambulanceCompanyName: 1 });
userSchema.index({ ambulanceVerificationStatus: 1 });
userSchema.index({ 'ambulanceDrivers.currentLocation': '2dsphere' }, { sparse: true });
userSchema.index({ driverCurrentLocation: '2dsphere' }, { sparse: true });
userSchema.index({ 'ambulanceDrivers.driverId': 1 });
userSchema.index({ 'ambulanceDrivers.isAvailable': 1, 'ambulanceDrivers.isOnTrip': 1 });
userSchema.index({ driverIsAvailable: 1, driverIsOnTrip: 1 });
userSchema.index({ ambulanceSettings: 1 });

// ============================================
// VIRTUAL FIELDS (EXISTING + NEW)
// ============================================

userSchema.virtual('isPatient').get(function() {
  return this.role === 'patient';
});

userSchema.virtual('isAdmin').get(function() {
  return this.role === 'admin';
});

userSchema.virtual('isCaregiver').get(function() {
  return this.role === 'caregiver';
});

// ============================================
// INSURANCE VIRTUAL FIELDS
// ============================================

userSchema.virtual('isInsuranceCompany').get(function() {
  return this.role === 'insurance_company';
});

userSchema.virtual('isInsuranceAgent').get(function() {
  return this.role === 'insurance_agent';
});

userSchema.virtual('isCorporateHR').get(function() {
  return this.role === 'corporate_hr';
});

userSchema.virtual('isInsuranceUser').get(function() {
  return ['insurance_company', 'insurance_agent', 'corporate_hr'].includes(this.role);
});

userSchema.virtual('companyDisplayName').get(function() {
  return this.companyName || this.name;
});

userSchema.virtual('corporateDisplayName').get(function() {
  return this.corporateName || this.name;
});

// ============================================
// 🚑 AMBULANCE VIRTUAL FIELDS (NEW)
// ============================================

userSchema.virtual('isAmbulanceProvider').get(function() {
  return this.role === 'ambulance_provider';
});

userSchema.virtual('isAmbulanceDriver').get(function() {
  return this.role === 'ambulance_driver';
});

userSchema.virtual('isAmbulanceUser').get(function() {
  return ['ambulance_provider', 'ambulance_driver'].includes(this.role);
});

userSchema.virtual('ambulanceDisplayName').get(function() {
  return this.ambulanceCompanyName || this.name;
});

userSchema.virtual('availableDrivers').get(function() {
  if (!this.ambulanceDrivers) return [];
  return this.ambulanceDrivers.filter(d => d.isAvailable && !d.isOnTrip && d.isVerified);
});

userSchema.virtual('availableVehicles').get(function() {
  if (!this.ambulanceFleet) return [];
  return this.ambulanceFleet.filter(v => v.isActive && v.isVerified);
});

userSchema.virtual('activeEmergencyDrivers').get(function() {
  if (!this.ambulanceDrivers) return [];
  return this.ambulanceDrivers.filter(d => d.isAvailable && d.isVerified && !d.isOnTrip);
});

userSchema.virtual('fleetSize').get(function() {
  return this.ambulanceFleet ? this.ambulanceFleet.length : 0;
});

userSchema.virtual('driverCount').get(function() {
  return this.ambulanceDrivers ? this.ambulanceDrivers.length : 0;
});

userSchema.virtual('averageDriverRating').get(function() {
  if (!this.ambulanceDrivers || this.ambulanceDrivers.length === 0) return 0;
  const total = this.ambulanceDrivers.reduce((sum, d) => sum + (d.rating || 0), 0);
  return Math.round((total / this.ambulanceDrivers.length) * 10) / 10;
});

// ============================================
// VERIFICATION VIRTUAL FIELDS
// ============================================

userSchema.virtual('isPhoneVerified').get(function() {
  return this.phoneVerified === true;
});

userSchema.virtual('isEmailVerified').get(function() {
  return this.emailVerified === true;
});

userSchema.virtual('isFullyVerified').get(function() {
  return this.phoneVerified && this.emailVerified;
});

userSchema.virtual('isPhoneBlocked').get(function() {
  if (!this.phoneVerificationBlockedUntil) return false;
  return new Date() < this.phoneVerificationBlockedUntil;
});

userSchema.virtual('phoneBlockRemaining').get(function() {
  if (!this.phoneVerificationBlockedUntil) return 0;
  const remaining = this.phoneVerificationBlockedUntil - new Date();
  return Math.ceil(remaining / (60 * 1000));
});

// ============================================
// METHODS (EXISTING + NEW)
// ============================================

userSchema.methods.isActiveUser = function() {
  return this.isActive && !this.isBlocked;
};

userSchema.methods.hasCompletedKYC = function() {
  return this.kycStatus === 'verified';
};

// ============================================
// VERIFICATION METHODS
// ============================================

userSchema.methods.markPhoneVerified = function() {
  this.phoneVerified = true;
  this.phoneVerificationDate = new Date();
  this.phoneVerificationToken = undefined;
  this.phoneVerificationExpires = undefined;
  this.phoneVerificationAttempts = 0;
  this.phoneVerificationBlockedUntil = undefined;
  return this.save();
};

userSchema.methods.markPhoneUnverified = function() {
  this.phoneVerified = false;
  this.phoneVerificationDate = undefined;
  return this.save();
};

userSchema.methods.incrementPhoneAttempts = function() {
  this.phoneVerificationAttempts = (this.phoneVerificationAttempts || 0) + 1;
  
  if (this.phoneVerificationAttempts >= 5) {
    this.phoneVerificationBlockedUntil = new Date(Date.now() + 30 * 60 * 1000);
  }
  
  return this.save();
};

userSchema.methods.resetPhoneAttempts = function() {
  this.phoneVerificationAttempts = 0;
  this.phoneVerificationBlockedUntil = undefined;
  return this.save();
};

userSchema.methods.markEmailVerified = function() {
  this.emailVerified = true;
  this.emailVerificationDate = new Date();
  this.emailVerificationToken = undefined;
  this.emailVerificationExpires = undefined;
  this.emailVerificationAttempts = 0;
  return this.save();
};

userSchema.methods.markEmailUnverified = function() {
  this.emailVerified = false;
  this.emailVerificationDate = undefined;
  return this.save();
};

userSchema.methods.incrementEmailAttempts = function() {
  this.emailVerificationAttempts = (this.emailVerificationAttempts || 0) + 1;
  return this.save();
};

userSchema.methods.resetEmailAttempts = function() {
  this.emailVerificationAttempts = 0;
  return this.save();
};

// ============================================
// INSURANCE METHODS
// ============================================

userSchema.methods.isVerifiedInsuranceCompany = function() {
  if (!this.isInsuranceCompany) return false;
  return this.isVerified && this.kycStatus === 'verified';
};

userSchema.methods.canSellInsurance = function() {
  if (this.isInsuranceCompany) return this.isVerifiedInsuranceCompany();
  if (this.isInsuranceAgent) return this.isVerified && this.agentLicenseNumber;
  return false;
};

userSchema.methods.getCompanyCommissionRate = function() {
  if (!this.isInsuranceCompany) return 0;
  return this.companySettings?.defaultCommissionRate || 15;
};

userSchema.methods.getAgentCommissionRate = function() {
  if (!this.isInsuranceAgent) return 0;
  return this.agentCommissionRate || 5;
};

// ============================================
// 🚑 AMBULANCE PROVIDER METHODS (NEW)
// ============================================

// Check if ambulance provider is verified
userSchema.methods.isVerifiedAmbulanceProvider = function() {
  if (!this.isAmbulanceProvider) return false;
  return this.ambulanceVerificationStatus === 'verified';
};

// Check if provider can accept emergency dispatches
userSchema.methods.canAcceptEmergencies = function() {
  if (!this.isAmbulanceProvider) return false;
  return this.isVerifiedAmbulanceProvider() && 
         this.ambulanceSettings?.acceptsEmergency === true &&
         this.isActive && !this.isBlocked;
};

// Get all available drivers for dispatch
userSchema.methods.getAvailableDrivers = function() {
  if (!this.ambulanceDrivers) return [];
  return this.ambulanceDrivers.filter(d => 
    d.isAvailable && !d.isOnTrip && d.isVerified
  );
};

// Get drivers near a location (within radius)
userSchema.methods.getNearbyDrivers = function(lat, lng, radiusKm) {
  if (!this.ambulanceDrivers) return [];
  
  return this.ambulanceDrivers.filter(d => {
    if (!d.isAvailable || d.isOnTrip || !d.isVerified || !d.currentLocation?.coordinates) {
      return false;
    }
    
    const [driverLng, driverLat] = d.currentLocation.coordinates;
    const distance = getDistanceFromLatLngInKm(lat, lng, driverLat, driverLng);
    return distance <= radiusKm;
  });
};

// Get vehicles of a specific type
userSchema.methods.getVehiclesByType = function(type) {
  if (!this.ambulanceFleet) return [];
  return this.ambulanceFleet.filter(v => 
    v.vehicleType === type && v.isActive && v.isVerified
  );
};

// Add a vehicle to fleet
userSchema.methods.addVehicle = function(vehicleData) {
  const vehicleId = 'VEH' + Date.now();
  this.ambulanceFleet.push({
    vehicleId,
    ...vehicleData,
    createdAt: new Date()
  });
  this.ambulanceStats.activeVehicles = this.ambulanceFleet.filter(v => v.isActive).length;
  return this.save();
};

// Add a driver
userSchema.methods.addDriver = function(driverData) {
  const driverId = 'DRV' + Date.now();
  this.ambulanceDrivers.push({
    driverId,
    ...driverData,
    joinedAt: new Date()
  });
  this.ambulanceStats.activeDrivers = this.ambulanceDrivers.filter(d => d.isVerified).length;
  return this.save();
};

// Toggle driver availability
userSchema.methods.toggleDriverAvailability = function(driverId, isAvailable) {
  const driver = this.ambulanceDrivers.find(d => d.driverId === driverId);
  if (driver) {
    driver.isAvailable = isAvailable;
    if (!isAvailable) {
      driver.currentLocation = undefined;
      driver.lastLocationUpdate = undefined;
    }
  }
  return this.save();
};

// Update driver location
userSchema.methods.updateDriverLocation = function(driverId, lat, lng) {
  const driver = this.ambulanceDrivers.find(d => d.driverId === driverId);
  if (driver) {
    driver.currentLocation = {
      type: 'Point',
      coordinates: [lng, lat]
    };
    driver.lastLocationUpdate = new Date();
  }
  return this.save();
};

// Set driver on trip status
userSchema.methods.setDriverOnTrip = function(driverId, tripId) {
  const driver = this.ambulanceDrivers.find(d => d.driverId === driverId);
  if (driver) {
    driver.isOnTrip = true;
    driver.currentTripId = tripId;
  }
  return this.save();
};

// Clear driver trip status
userSchema.methods.clearDriverTrip = function(driverId) {
  const driver = this.ambulanceDrivers.find(d => d.driverId === driverId);
  if (driver) {
    driver.isOnTrip = false;
    driver.currentTripId = undefined;
  }
  return this.save();
};

// Update driver stats after trip completion
userSchema.methods.updateDriverStats = function(driverId, tripData) {
  const driver = this.ambulanceDrivers.find(d => d.driverId === driverId);
  if (driver) {
    driver.totalTrips += 1;
    driver.totalEarnings += tripData.driverEarnings || 0;
    if (tripData.isEmergency) {
      driver.emergencyTripsCompleted += 1;
    }
    if (tripData.responseTime) {
      const currentAvg = driver.averageResponseTime || 0;
      const currentTrips = driver.totalTrips - 1;
      driver.averageResponseTime = Math.round(
        ((currentAvg * currentTrips) + tripData.responseTime) / driver.totalTrips
      );
    }
  }
  
  // Update provider stats
  this.ambulanceStats.totalTripsCompleted += 1;
  this.ambulanceStats.totalEarnings += tripData.providerEarnings || 0;
  if (tripData.isEmergency) {
    this.ambulanceStats.emergencyTripsCompleted += 1;
  }
  this.ambulanceStats.lastUpdated = new Date();
  
  return this.save();
};

// Get provider commission rate
userSchema.methods.getAmbulanceCommissionRate = function() {
  return this.ambulanceSettings?.commissionRate || 15;
};

// Check if provider is operational (within operating hours)
userSchema.methods.isOperational = function() {
  if (!this.ambulanceSettings?.operatingHours) return true; // 24/7 by default
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  
  const [openHour, openMinute] = (this.ambulanceSettings.operatingHours.open || '00:00').split(':').map(Number);
  const [closeHour, closeMinute] = (this.ambulanceSettings.operatingHours.close || '23:59').split(':').map(Number);
  
  const openTime = openHour * 60 + openMinute;
  const closeTime = closeHour * 60 + closeMinute;
  
  return currentTime >= openTime && currentTime <= closeTime;
};

// ============================================
// 🚑 AMBULANCE DRIVER METHODS (for role: 'ambulance_driver')
// ============================================

userSchema.methods.isVerifiedDriver = function() {
  if (!this.isAmbulanceDriver) return false;
  return this.driverVerificationStatus === 'verified';
};

userSchema.methods.toggleDriverAvailable = function(isAvailable) {
  this.driverIsAvailable = isAvailable;
  if (!isAvailable) {
    this.driverCurrentLocation = undefined;
    this.driverLastLocationUpdate = undefined;
  }
  return this.save();
};

userSchema.methods.updateDriverLocation = function(lat, lng) {
  this.driverCurrentLocation = {
    type: 'Point',
    coordinates: [lng, lat]
  };
  this.driverLastLocationUpdate = new Date();
  return this.save();
};

userSchema.methods.startTrip = function(tripId) {
  this.driverIsOnTrip = true;
  this.driverCurrentTripId = tripId;
  return this.save();
};

userSchema.methods.endTrip = function() {
  this.driverIsOnTrip = false;
  this.driverCurrentTripId = undefined;
  return this.save();
};

userSchema.methods.canAcceptEmergency = function() {
  return this.isVerifiedDriver() && 
         this.driverIsAvailable && 
         !this.driverIsOnTrip &&
         this.isActive && 
         !this.isBlocked;
};

// ============================================
// STATIC METHODS (EXISTING + NEW)
// ============================================

userSchema.statics.findByRole = function(role) {
  return this.find({ role: role, isActive: true });
};

userSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true, isBlocked: false });
};

// ============================================
// INSURANCE STATIC METHODS
// ============================================

userSchema.statics.findInsuranceCompanies = function(verifiedOnly = false) {
  const query = { role: 'insurance_company', isActive: true };
  if (verifiedOnly) {
    query.isVerified = true;
    query.kycStatus = 'verified';
  }
  return this.find(query);
};

userSchema.statics.findInsuranceAgents = function(verifiedOnly = false) {
  const query = { role: 'insurance_agent', isActive: true };
  if (verifiedOnly) {
    query.isVerified = true;
  }
  return this.find(query);
};

userSchema.statics.findCorporateHR = function() {
  return this.find({ role: 'corporate_hr', isActive: true });
};

// ============================================
// 🚑 AMBULANCE STATIC METHODS (NEW)
// ============================================

// Find all verified ambulance providers
userSchema.statics.findAmbulanceProviders = function(verifiedOnly = false) {
  const query = { role: 'ambulance_provider', isActive: true };
  if (verifiedOnly) {
    query.ambulanceVerificationStatus = 'verified';
  }
  return this.find(query);
};

// Find ambulance providers in a service area
userSchema.statics.findProvidersInArea = function(city, state) {
  return this.find({
    role: 'ambulance_provider',
    isActive: true,
    ambulanceVerificationStatus: 'verified',
    $or: [
      { 'ambulanceCompanyAddress.city': { $regex: city, $options: 'i' } },
      { 'ambulanceCompanyAddress.state': { $regex: state, $options: 'i' } },
      { 'ambulanceSettings.serviceArea': { $regex: city, $options: 'i' } }
    ]
  });
};

// Find providers that accept emergency dispatches
userSchema.statics.findEmergencyProviders = function() {
  return this.find({
    role: 'ambulance_provider',
    isActive: true,
    ambulanceVerificationStatus: 'verified',
    'ambulanceSettings.acceptsEmergency': true
  });
};

// Find available drivers near a location (using geospatial query)
userSchema.statics.findNearbyDrivers = function(lat, lng, maxDistanceMeters = 5000) {
  return this.find({
    role: 'ambulance_driver',
    isActive: true,
    driverVerificationStatus: 'verified',
    driverIsAvailable: true,
    driverIsOnTrip: false,
    driverCurrentLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: maxDistanceMeters
      }
    }
  }).limit(10);
};

// Find available drivers from providers (embedded array query)
userSchema.statics.findProvidersWithNearbyDrivers = function(lat, lng, maxDistanceMeters = 5000) {
  return this.find({
    role: 'ambulance_provider',
    isActive: true,
    ambulanceVerificationStatus: 'verified',
    'ambulanceSettings.acceptsEmergency': true,
    'ambulanceDrivers': {
      $elemMatch: {
        isAvailable: true,
        isOnTrip: false,
        isVerified: true,
        currentLocation: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat]
            },
            $maxDistance: maxDistanceMeters
          }
        }
      }
    }
  });
};

// Find unverified ambulance providers (for admin review)
userSchema.statics.findUnverifiedAmbulanceProviders = function() {
  return this.find({
    role: 'ambulance_provider',
    ambulanceVerificationStatus: { $in: ['pending', 'under_review'] }
  });
};

// Find ambulance drivers by provider
userSchema.statics.findDriversByProvider = function(providerId) {
  return this.find({
    role: 'ambulance_driver',
    driverProviderId: providerId,
    isActive: true
  });
};

// ============================================
// VERIFICATION STATIC METHODS
// ============================================

userSchema.statics.findUnverifiedUsers = function() {
  return this.find({ 
    phoneVerified: false, 
    isActive: true,
    isBlocked: false
  });
};

userSchema.statics.findByPhone = function(phone) {
  return this.findOne({ phone, isActive: true });
};

userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email, isActive: true });
};

// ============================================
// HELPER: Haversine distance calculation
// ============================================

function getDistanceFromLatLngInKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLng = deg2rad(lng2 - lng1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// ============================================
// PRE-SAVE HOOKS (EXISTING + NEW)
// ============================================

userSchema.pre('save', function(next) {
  // Generate referral code if not exists
  if (!this.referralCode) {
    const prefix = 'REF';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.referralCode = prefix + random;
  }
  
  // 🚑 Update ambulance stats on save
  if (this.isAmbulanceProvider) {
    if (this.ambulanceFleet) {
      this.ambulanceStats.activeVehicles = this.ambulanceFleet.filter(v => v.isActive).length;
    }
    if (this.ambulanceDrivers) {
      this.ambulanceStats.activeDrivers = this.ambulanceDrivers.filter(d => d.isVerified).length;
    }
    this.ambulanceStats.lastUpdated = new Date();
  }
  
  this.updatedAt = new Date();
  next();
});

// ============================================
// POST-SAVE HOOKS
// ============================================

userSchema.post('save', function(doc) {
  // Any post-save logic here
});

module.exports = mongoose.model('User', userSchema);
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // ============================================
  // YOUR EXISTING FIELDS (ALL PRESERVED)
  // ============================================
  
  name: { type, required},
  email: { type, required, unique},
  phone: { type, required, unique},
  password: { type, required},
  role: { 
    type, 
    enum: [
      'patient', 
      'caregiver', 
      'admin',
      // ============================================
      // NEW INSURANCE ROLES (ADDED)
      // ============================================
      'insurance_company',   // Insurance company admin
      'insurance_agent',     // Insurance agent/broker
      'corporate_hr',        // Corporate HR for employee plans
      // ============================================
      // 🚑 NEW AMBULANCE ROLES (ADDED)
      // ============================================
      'ambulance_provider',  // Ambulance company/fleet owner
      'ambulance_driver'     // Individual ambulance driver
    ], 
    default: 'patient' 
  },
  isVerified: { type, default},
  createdAt: { type, default.now },

  // ============================================
  // NEW FIELDS FOR INSURANCE (ADDED)
  // ============================================
  
  // Insurance Company specific fields
  companyName: { type},
  companyRegistrationNumber: { type},
  irdaRegistration: { type},
  gstNumber: { type},
  companyLogo: { type},
  companyDescription: { type},
  companyWebsite: { type},
  companyPhone: { type},
  companyEmail: { type},
  
  // Insurance Company address
  companyAddress: {
    line1: { type},
    line2: { type},
    city: { type},
    state: { type},
    pincode: { type},
    country: { type, default: 'India' }
  },
  
  // Insurance Company bank details (for settlements)
  companyBankDetails: {
    accountNumber: { type},
    ifscCode: { type},
    accountHolderName: { type},
    bankName: { type},
    branchName: { type}
  },
  
  // Insurance Company documents
  companyDocuments: [{
    name: { type},
    url: { type},
    type: { type}, // irda_certificate, gst_certificate, pan_card, etc.
    uploadedAt: { type, default.now }
  }],
  
  // Insurance Company settings
  companySettings: {
    defaultCommissionRate: { type, default: 15 }, // Platform commission percentage
    settlementTerms: { 
      type, 
      enum: ['immediate', 'weekly', 'monthly'],
      default: 'weekly'
    },
    autoApprovePlans: { type, default},
    enableCashlessClaim: { type, default}
  },
  
  // Insurance Agent specific fields
  agentId: { type},
  agentLicenseNumber: { type},
  agencyName: { type},
  agentExperience: { type},
  agentSpecializations: [{ type}],
  agentCommissionRate: { type, default: 5 }, // Agent's commission share
  
  // Corporate HR specific fields
  corporateName: { type},
  corporateGST: { type},
  corporatePAN: { type},
  employeeCount: { type},
  corporateIndustry: { type},
  corporateAddress: {
    line1: { type},
    line2: { type},
    city: { type},
    state: { type},
    pincode: { type},
    country: { type, default: 'India' }
  },

  // ============================================
  // 🚑 AMBULANCE PROVIDER FIELDS (NEW)
  // ============================================

  // Ambulance company/fleet details
  ambulanceCompanyName: { type},
  ambulanceCompanyPhone: { type},
  ambulanceCompanyEmail: { type},
  ambulanceCompanyAddress: {
    line1: { type},
    line2: { type},
    city: { type},
    state: { type},
    pincode: { type},
    country: { type, default: 'India' }
  },
  ambulanceCompanyGST: { type},
  ambulanceCompanyPAN: { type},

  // Ambulance fleet
  ambulanceFleet: [{
    vehicleId: { type},
    vehicleNumber: { type},
    vehicleType: { 
      type, 
      enum: ['basic', 'cardiac', 'ventilator', 'neonatal', 'mortuary', 'wheelchair']
    },
    make: { type},           // Tata, Force, Maruti, etc.
    model: { type},          // Winger, Traveller, Eeco, etc.
    year: { type},
    registrationCertificate: { type},    // Cloudinary URL
    insuranceDocument: { type},          // Cloudinary URL
    fitnessCertificate: { type},         // Cloudinary URL
    pollutionCertificate: { type},       // Cloudinary URL
    permitsDocument: { type},            // Cloudinary URL
    isVerified: { type, default},
    isActive: { type, default},
    equipment: [{ 
      name: { type},         // Oxygen cylinder, Defibrillator, Suction machine, etc.
      available: { type, default},
      lastServiced: { type}
    }],
    basePrice: { type},                  // Base fare for this vehicle
    pricePerKm: { type, default: 25 },    // Per km charge
    minimumCharge: { type, default: 500 }, // Minimum fare
    nightChargeMultiplier: { type, default: 1.5 },
    oxygenCharge: { type, default: 200 },
    createdAt: { type, default.now }
  }],

  // Ambulance drivers (managed by provider)
  ambulanceDrivers: [{
    driverId: { type},
    name: { type},
    phone: { type},
    email: { type},
    dateOfBirth: { type},
    licenseNumber: { type},
    licenseDocument: { type},            // Cloudinary URL
    aadhaarCard: { type},                // Cloudinary URL
    photo: { type},                      // Cloudinary URL
    experience: { type},                 // Years of experience
    trainingCertifications: [{ 
      name: { type},                     // BLS, ACLS, First Aid, etc.
      document: { type},                 // Cloudinary URL
      issuedDate: { type},
      expiryDate: { type}
    }],
    isVerified: { type, default},
    isAvailable: { type, default},
        currentLocation: {
      type: { type, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }
    },
    lastLocationUpdate: { type},
    assignedVehicle: { type},
    rating: { type, default: 0 },
    totalTrips: { type, default: 0 },
    totalEarnings: { type, default: 0 },
    emergencyTripsCompleted: { type, default: 0 },
    acceptanceRate: { type, default: 100 },
    averageResponseTime: { type},
    isOnTrip: { type, default},
    currentTripId: { type},
    joinedAt: { type, default.now }
  }],

  // Ambulance provider settings
  ambulanceSettings: {
    serviceArea: { type},                // City/Region name
    serviceAreaCoordinates: {
      center: {
        lat: { type},
        lng: { type}
      },
      radius: { type}                    // Service radius in km
    },
    operatingHours: {
      open: { type, default: '00:00' },   // 24/7 by default
      close: { type, default: '23:59' }
    },
    acceptsEmergency: { type, default},
    acceptsScheduled: { type, default},
    acceptsIntercity: { type, default},
    emergencyResponseTime: { type},       // Target response time in minutes
    maxConcurrentEmergencies: { type, default: 5 },
    autoAcceptEmergencies: { type, default},
    commissionRate: { type, default: 15 }, // Platform commission
    settlementTerms: {
      type,
      enum: ['daily', 'weekly', 'biweekly', 'monthly'],
      default: 'weekly'
    },
    paymentMethod: {
      type,
      enum: ['bank_transfer', 'upi', 'both'],
      default: 'bank_transfer'
    }
  },

  // Ambulance provider bank details
  ambulanceBankDetails: {
    accountNumber: { type},
    ifscCode: { type},
    accountHolderName: { type},
    bankName: { type},
    branchName: { type},
    upiId: { type}
  },

  // Ambulance provider documents
  ambulanceDocuments: [{
    name: { type},
    url: { type},
    type: { type},              // pan_card, gst_certificate, fleet_registration, etc.
    uploadedAt: { type, default.now },
    verified: { type, default},
    verifiedAt: { type},
    rejectionReason: { type}
  }],

  // Ambulance provider statistics
  ambulanceStats: {
    totalTripsCompleted: { type, default: 0 },
    emergencyTripsCompleted: { type, default: 0 },
    scheduledTripsCompleted: { type, default: 0 },
    totalEarnings: { type, default: 0 },
    totalCommissionPaid: { type, default: 0 },
    averageRating: { type, default: 0 },
    averageResponseTime: { type},       // Seconds across all trips
    cancellationRate: { type, default: 0 },
    activeVehicles: { type, default: 0 },
    activeDrivers: { type, default: 0 },
    lastUpdated: { type, default.now }
  },

  // Ambulance provider verification status
  ambulanceVerificationStatus: {
    type,
    enum: ['pending', 'under_review', 'verified', 'rejected', 'suspended'],
    default: 'pending'
  },
  ambulanceVerificationNotes: { type},
  ambulanceVerifiedAt: { type},
  ambulanceVerifiedBy: { type},         // Admin ID who verified

  // 🚑 Ambulance DRIVER-specific fields (for role: 'ambulance_driver')
  driverProviderId: { type},            // Linked ambulance_provider ID
  driverProviderName: { type},
  driverLicenseNumber: { type},
  driverLicenseDocument: { type},
  driverPhoto: { type},
  driverAadhaar: { type},
  driverExperience: { type},
  driverTrainingCertifications: [{
    name: { type},
    document: { type},
    issuedDate: { type},
    expiryDate: { type}
  }],
  driverAssignedVehicle: { type},
  driverCurrentLocation: {
    type: { type, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
  driverLastLocationUpdate: { type},
  driverIsAvailable: { type, default},
  driverIsOnTrip: { type, default},
  driverCurrentTripId: { type},
  driverRating: { type, default: 0 },
  driverTotalTrips: { type, default: 0 },
  driverTotalEarnings: { type, default: 0 },
  driverEmergencyTripsCompleted: { type, default: 0 },
  driverAcceptanceRate: { type, default: 100 },
  driverAverageResponseTime: { type},
  driverVerificationStatus: {
    type,
    enum: ['pending', 'under_review', 'verified', 'rejected', 'suspended'],
    default: 'pending'
  },
  
  // ============================================
  // EXISTING FIELDS CONTINUED
  // ============================================
  
  // Profile fields (for all users)
  profilePicture: { type},
  dateOfBirth: { type},
  gender: { type, enum: ['male', 'female', 'other'] },
  
  // Address (for patients/customers)
  address: {
    line1: { type},
    line2: { type},
    city: { type},
    state: { type},
    pincode: { type},
    country: { type, default: 'India' }
  },
  
  // Emergency contact
  emergencyContact: {
    name: { type},
    phone: { type},
    relation: { type}
  },
  
  // Medical info (for patients)
  medicalHistory: { type},
  allergies: [{ type}],
  bloodGroup: { type, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  
  // Caregiver specific fields
  caregiverExperience: { type},
  caregiverSpecializations: [{ type}],
  caregiverCertifications: [{ type}],
  
  // Admin specific fields
  adminLevel: { type, enum: ['super', 'moderator', 'support'] },
  adminPermissions: [{ type}],
  
  // Account status
  isActive: { type, default},
  isBlocked: { type, default},
  blockedReason: { type},
  
  // Login tracking
  lastLogin: { type},
  loginCount: { type, default: 0 },
  
  // Two-factor authentication
  twoFactorEnabled: { type, default},
  twoFactorSecret: { type},
  
  // Password reset
  resetPasswordToken: { type},
  resetPasswordExpires: { type},
  
  // ============================================
  // EMAIL VERIFICATION (EXISTING - PRESERVED)
  // ============================================
  
  emailVerified: { type, default},
  emailVerificationToken: { type},
  emailVerificationExpires: { type},
  
  // ============================================
  // PHONE VERIFICATION (EXISTING - PRESERVED)
  // ============================================
  
  phoneVerified: { type, default},
  phoneVerificationToken: { type},
  phoneVerificationExpires: { type},
  
  // ============================================
  // ADDITIONAL PHONE VERIFICATION FIELDS (NEW - ADDED)
  // ============================================
  
  phoneVerificationDate: { type},
  phoneVerificationAttempts: { type, default: 0 },
  phoneVerificationBlockedUntil: { type},
  
  // ============================================
  // ADDITIONAL EMAIL VERIFICATION FIELDS (NEW - ADDED)
  // ============================================
  
  emailVerificationDate: { type},
  emailVerificationAttempts: { type, default: 0 },
  
  // ============================================
  // KYC STATUS (EXISTING - PRESERVED)
  // ============================================
  
  kycStatus: { 
    type, 
    enum: ['pending', 'submitted', 'verified', 'rejected'],
    default: 'pending'
  },
  kycDocuments: [{
    type: { type},
    url: { type},
    verified: { type, default},
    verifiedAt: { type},
    rejectionReason: { type}
  }],
  
  // ============================================
  // NOTIFICATION PREFERENCES (EXISTING - PRESERVED)
  // ============================================
  
  notificationPreferences: {
    email: { type, default},
    sms: { type, default},
    push: { type, default},
    marketing: { type, default}
  },
  
  // ============================================
  // APP SETTINGS (EXISTING - PRESERVED)
  // ============================================
  
  appSettings: {
    language: { type, default: 'en' },
    currency: { type, default: 'INR' },
    timezone: { type, default: 'Asia/Kolkata' }
  },
  
  // ============================================
  // DEVICE INFO (EXISTING - PRESERVED)
  // ============================================
  
  devices: [{
    deviceId: { type},
    deviceName: { type},
    deviceType: { type},
    lastUsed: { type},
    isActive: { type, default}
  }],
  
  // ============================================
  // REFERRAL SYSTEM (EXISTING - PRESERVED)
  // ============================================
  
  referralCode: { type, unique},
  referredBy: { type},
  referrals: [{
    userId: { type},
    date: { type, default.now },
    rewardEarned: { type}
  }],
  
  // ============================================
  // POINTS/LOYALTY (EXISTING - PRESERVED)
  // ============================================
  
  loyaltyPoints: { type, default: 0 },
  loyaltyTier: { 
    type, 
    enum: ['bronze', 'silver', 'gold', 'platinum'],
    default: 'bronze'
  },
  
  // ============================================
  // AUDIT (EXISTING - PRESERVED)
  // ============================================
  
  updatedAt: { type, default.now },
  deletedAt: { type}
}, {
  timestamps});

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
// 🚑 NEWindexes
userSchema.index({ ambulanceCompanyName: 1 });
userSchema.index({ ambulanceVerificationStatus: 1 });
userSchema.index({ 'ambulanceDrivers.currentLocation': '2dsphere' }, { sparse});
userSchema.index({ driverCurrentLocation: '2dsphere' }, { sparse});
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
    createdAtDate()
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
    joinedAtDate()
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
  return this.find({ role, isActive});
};

userSchema.statics.findActiveUsers = function() {
  return this.find({ isActive, isBlocked});
};

// ============================================
// INSURANCE STATIC METHODS
// ============================================

userSchema.statics.findInsuranceCompanies = function(verifiedOnly = false) {
  const query = { role: 'insurance_company', isActive};
  if (verifiedOnly) {
    query.isVerified = true;
    query.kycStatus = 'verified';
  }
  return this.find(query);
};

userSchema.statics.findInsuranceAgents = function(verifiedOnly = false) {
  const query = { role: 'insurance_agent', isActive};
  if (verifiedOnly) {
    query.isVerified = true;
  }
  return this.find(query);
};

userSchema.statics.findCorporateHR = function() {
  return this.find({ role: 'corporate_hr', isActive});
};

// ============================================
// 🚑 AMBULANCE STATIC METHODS (NEW)
// ============================================

// Find all verified ambulance providers
userSchema.statics.findAmbulanceProviders = function(verifiedOnly = false) {
  const query = { role: 'ambulance_provider', isActive};
  if (verifiedOnly) {
    query.ambulanceVerificationStatus = 'verified';
  }
  return this.find(query);
};

// Find ambulance providers in a service area
userSchema.statics.findProvidersInArea = function(city, state) {
  return this.find({
    role: 'ambulance_provider',
    isActive,
    ambulanceVerificationStatus: 'verified',
    $or: [
      { 'ambulanceCompanyAddress.city': { $regex, $options: 'i' } },
      { 'ambulanceCompanyAddress.state': { $regex, $options: 'i' } },
      { 'ambulanceSettings.serviceArea': { $regex, $options: 'i' } }
    ]
  });
};

// Find providers that accept emergency dispatches
userSchema.statics.findEmergencyProviders = function() {
  return this.find({
    role: 'ambulance_provider',
    isActive,
    ambulanceVerificationStatus: 'verified',
    'ambulanceSettings.acceptsEmergency'});
};

// Find available drivers near a location (using geospatial query)
userSchema.statics.findNearbyDrivers = function(lat, lng, maxDistanceMeters = 5000) {
  return this.find({
    role: 'ambulance_driver',
    isActive,
    driverVerificationStatus: 'verified',
    driverIsAvailable,
    driverIsOnTrip,
    driverCurrentLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance}
    }
  }).limit(10);
};

// Find available drivers from providers (embedded array query)
userSchema.statics.findProvidersWithNearbyDrivers = function(lat, lng, maxDistanceMeters = 5000) {
  return this.find({
    role: 'ambulance_provider',
    isActive,
    ambulanceVerificationStatus: 'verified',
    'ambulanceSettings.acceptsEmergency',
    'ambulanceDrivers': {
      $elemMatch: {
        isAvailable,
        isOnTrip,
        isVerified,
        currentLocation: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat]
            },
            $maxDistance}
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
    driverProviderId,
    isActive});
};

// ============================================
// VERIFICATION STATIC METHODS
// ============================================

userSchema.statics.findUnverifiedUsers = function() {
  return this.find({ 
    phoneVerified, 
    isActive,
    isBlocked});
};

userSchema.statics.findByPhone = function(phone) {
  return this.findOne({ phone, isActive});
};

userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email, isActive});
};

// ============================================
// HELPERdistance calculation
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


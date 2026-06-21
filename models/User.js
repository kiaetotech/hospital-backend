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
    enum: [
      'patient', 
      'caregiver', 
      'admin',
      // ============================================
      // NEW INSURANCE ROLES (ADDED)
      // ============================================
      'insurance_company',   // Insurance company admin
      'insurance_agent',     // Insurance agent/broker
      'corporate_hr'         // Corporate HR for employee plans
    ], 
    default: 'patient' 
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
  
  phoneVerificationDate: { type: Date }, // When phone was verified
  phoneVerificationAttempts: { type: Number, default: 0 }, // Failed attempts
  phoneVerificationBlockedUntil: { type: Date }, // Block until date if too many attempts
  
  // ============================================
  // ADDITIONAL EMAIL VERIFICATION FIELDS (NEW - ADDED)
  // ============================================
  
  emailVerificationDate: { type: Date }, // When email was verified
  emailVerificationAttempts: { type: Number, default: 0 }, // Failed attempts
  
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
userSchema.index({ companyName: 1 }); // ✅ NEW
userSchema.index({ irdaRegistration: 1 }); // ✅ NEW
userSchema.index({ corporateName: 1 }); // ✅ NEW
userSchema.index({ phoneVerified: 1 }); // ✅ NEW - For phone verification queries
userSchema.index({ emailVerified: 1 }); // ✅ NEW - For email verification queries

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
// NEW INSURANCE VIRTUAL FIELDS (ADDED)
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
// NEW VERIFICATION VIRTUAL FIELDS (ADDED)
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
  return Math.ceil(remaining / (60 * 1000)); // Minutes remaining
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
// NEW VERIFICATION METHODS (ADDED)
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
  
  // Block after 5 failed attempts
  if (this.phoneVerificationAttempts >= 5) {
    this.phoneVerificationBlockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Block for 30 minutes
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
// NEW INSURANCE METHODS (ADDED)
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
// STATIC METHODS (EXISTING + NEW)
// ============================================

userSchema.statics.findByRole = function(role) {
  return this.find({ role: role, isActive: true });
};

userSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true, isBlocked: false });
};

// ============================================
// NEW INSURANCE STATIC METHODS (ADDED)
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
// NEW VERIFICATION STATIC METHODS (ADDED)
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
// PRE-SAVE HOOKS (EXISTING + NEW)
// ============================================

userSchema.pre('save', function(next) {
  // Generate referral code if not exists
  if (!this.referralCode) {
    const prefix = 'REF';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.referralCode = prefix + random;
  }
  
  // Auto-set phoneVerified if token is cleared
  if (!this.phoneVerificationToken && !this.phoneVerificationExpires) {
    // Only if phoneVerified is not already true
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
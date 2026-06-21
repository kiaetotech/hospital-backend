const mongoose = require('mongoose');

// ============================================
// OTP MODEL - Reusable for all services
// ============================================

const otpSchema = new mongoose.Schema({
  // ============================================
  // CONTACT INFORMATION
  // ============================================
  
  phone: { 
    type: String, 
    required: true,
    index: true 
  },
  email: { 
    type: String,
    index: true 
  },
  
  // ============================================
  // OTP DETAILS
  // ============================================
  
  otp: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: [
      // Authentication
      'login',
      'registration',
      'password_reset',
      
      // Healthcare Services
      'hospital_booking',
      'ambulance_booking',
      'labtest_booking',
      'caregiver_booking',
      'ayurveda_consultation',
      'homeopathy_consult',
      
      // Insurance
      'insurance_application',
      'insurance_claim',
      'policy_issue',
      
      // General
      'verification',
      'two_factor'
    ],
    required: true,
    index: true
  },
  
  // ============================================
  // REFERENCE TO RELATED DOCUMENT
  // ============================================
  
  referenceId: { 
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceModel',
    index: true
  },
  referenceModel: { 
    type: String,
    enum: ['User', 'Booking', 'InsurancePolicy', 'Hospital', 'Ambulance', 'Caregiver']
  },
  
  // ============================================
  // USER REFERENCE
  // ============================================
  
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    index: true 
  },
  
  // ============================================
  // STATUS & VALIDITY
  // ============================================
  
  expiresAt: { 
    type: Date, 
    required: true,
    index: true,
    // Auto-delete after expiry (TTL index will be created)
  },
  isUsed: { 
    type: Boolean, 
    default: false,
    index: true 
  },
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  
  // ============================================
  // SECURITY & ATTEMPTS
  // ============================================
  
  attempts: { 
    type: Number, 
    default: 0 
  },
  maxAttempts: { 
    type: Number, 
    default: 5 
  },
  isBlocked: { 
    type: Boolean, 
    default: false 
  },
  blockedUntil: { 
    type: Date 
  },
  
  // ============================================
  // IP & DEVICE TRACKING (For Security)
  // ============================================
  
  ipAddress: { type: String },
  userAgent: { type: String },
  deviceInfo: { type: String },
  
  // ============================================
  // DELIVERY TRACKING
  // ============================================
  
  sentVia: { 
    type: String, 
    enum: ['sms', 'email', 'both'],
    default: 'sms'
  },
  sentAt: { 
    type: Date, 
    default: Date.now 
  },
  deliveredAt: { type: Date },
  
  // ============================================
  // AUDIT
  // ============================================
  
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  verifiedAt: { type: Date }
}, {
  timestamps: true
});

// ============================================
// INDEXES
// ============================================

// TTL Index - Auto-delete expired OTPs after 10 minutes
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes for faster queries
otpSchema.index({ phone: 1, type: 1 });
otpSchema.index({ email: 1, type: 1 });
otpSchema.index({ referenceId: 1, referenceModel: 1 });
otpSchema.index({ userId: 1, type: 1 });

// ============================================
// VIRTUAL FIELDS
// ============================================

otpSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

otpSchema.virtual('isValid').get(function() {
  return !this.isUsed && !this.isExpired && !this.isBlocked;
});

otpSchema.virtual('remainingAttempts').get(function() {
  return this.maxAttempts - this.attempts;
});

otpSchema.virtual('timeRemaining').get(function() {
  if (this.isExpired) return 0;
  return Math.floor((this.expiresAt - new Date()) / 1000);
});

// ============================================
// METHODS
// ============================================

// Verify OTP
otpSchema.methods.verify = function(providedOtp) {
  // Check if OTP matches
  if (this.otp !== providedOtp) {
    this.attempts = this.attempts + 1;
    
    // Block if max attempts exceeded
    if (this.attempts >= this.maxAttempts) {
      this.isBlocked = true;
      this.blockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Block for 30 minutes
    }
    
    return {
      success: false,
      message: 'Invalid OTP',
      attemptsRemaining: this.maxAttempts - this.attempts,
      isBlocked: this.isBlocked
    };
  }

  // Check if expired
  if (this.isExpired) {
    return {
      success: false,
      message: 'OTP has expired. Please request a new one.',
      isExpired: true
    };
  }

  // Check if already used
  if (this.isUsed) {
    return {
      success: false,
      message: 'OTP has already been used.'
    };
  }

  // Check if blocked
  if (this.isBlocked) {
    return {
      success: false,
      message: 'Too many failed attempts. Please try again after 30 minutes.',
      isBlocked: true
    };
  }

  // Mark as used and verified
  this.isUsed = true;
  this.isVerified = true;
  this.verifiedAt = new Date();

  return {
    success: true,
    message: 'OTP verified successfully'
  };
};

// Mark OTP as used (without verification)
otpSchema.methods.markAsUsed = function() {
  this.isUsed = true;
  this.updatedAt = new Date();
  return this.save();
};

// Reset attempts
otpSchema.methods.resetAttempts = function() {
  this.attempts = 0;
  this.isBlocked = false;
  this.blockedUntil = undefined;
  return this.save();
};

// ============================================
// STATIC METHODS
// ============================================

// Generate a random OTP
otpSchema.statics.generateOTP = function(length = 6) {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

// Create a new OTP
otpSchema.statics.createOTP = async function(data) {
  const {
    phone,
    email,
    type,
    userId,
    referenceId,
    referenceModel,
    ipAddress,
    userAgent,
    sentVia = 'sms',
    expiresIn = 300 // 5 minutes default
  } = data;

  // Validate: at least phone or email
  if (!phone && !email) {
    throw new Error('Either phone or email is required');
  }

  // Delete any existing unused OTPs for this contact/type
  const query = { type, isUsed: false };
  if (phone) query.phone = phone;
  if (email) query.email = email;
  
  await this.deleteMany(query);

  // Generate OTP
  const otp = this.generateOTP();

  // Set expiry
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Create OTP document
  const otpDoc = new this({
    phone,
    email,
    otp,
    type,
    userId,
    referenceId,
    referenceModel,
    ipAddress,
    userAgent,
    sentVia,
    expiresAt,
    sentAt: new Date()
  });

  await otpDoc.save();

  return otpDoc;
};

// Find and verify OTP
otpSchema.statics.verifyOTP = async function(phone, email, otp, type) {
  const query = { type, isUsed: false };
  if (phone) query.phone = phone;
  if (email) query.email = email;
  
  const otpDoc = await this.findOne(query);
  
  if (!otpDoc) {
    return {
      success: false,
      message: 'OTP not found. Please request a new one.'
    };
  }

  return otpDoc.verify(otp);
};

// Clean up old OTPs (manual cleanup)
otpSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  return result;
};

// Get OTP status
otpSchema.statics.getStatus = async function(phone, email, type) {
  const query = { type, isUsed: false };
  if (phone) query.phone = phone;
  if (email) query.email = email;
  
  const otpDoc = await this.findOne(query);
  
  if (!otpDoc) {
    return {
      exists: false,
      message: 'No active OTP found'
    };
  }

  return {
    exists: true,
    isValid: otpDoc.isValid,
    isExpired: otpDoc.isExpired,
    attemptsRemaining: otpDoc.remainingAttempts,
    timeRemaining: otpDoc.timeRemaining,
    isBlocked: otpDoc.isBlocked
  };
};

// ============================================
// PRE-SAVE HOOKS
// ============================================

otpSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Otp', otpSchema);
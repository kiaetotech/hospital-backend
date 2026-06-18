const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
  // ============================================
  // BASIC DISCOUNT INFO
  // ============================================
  
  code: { 
    type: String, 
    required: true, 
    unique: true,
    uppercase: true,
    trim: true
  },
  
  type: { 
    type: String, 
    enum: ['percentage', 'fixed'], 
    required: true 
  },
  
  value: { 
    type: Number, 
    required: true,
    min: 0 
  },
  
  description: { 
    type: String,
    default: '' 
  },
  
  // ============================================
  // APPLICABILITY
  // ============================================
  
  applicableTags: [{ 
    type: String, 
    enum: ['opd', 'admission', 'ambulance', 'labtest', 'health_package', 'caregiver', 'loan', 'hospital', 'diagnostics', 'general'] 
  }],
  
  // ============================================
  // AMOUNT RESTRICTIONS
  // ============================================
  
  minAmount: { 
    type: Number, 
    default: 0 
  },
  
  maxDiscount: { 
    type: Number 
  },
  
  // ============================================
  // VALIDITY PERIOD
  // ============================================
  
  validFrom: { 
    type: Date, 
    default: Date.now 
  },
  
  validUntil: { 
    type: Date 
  },
  
  // ============================================
  // USAGE LIMITS
  // ============================================
  
  maxUses: { 
    type: Number,
    default: null 
  },
  
  usedCount: { 
    type: Number, 
    default: 0 
  },
  
  // Per user limit
  maxUsesPerUser: { 
    type: Number,
    default: null 
  },
  
  // ============================================
  // STATUS
  // ============================================
  
  isActive: { 
    type: Boolean, 
    default: true 
  },
  
  // ============================================
  // TIMESTAMPS
  // ============================================
  
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// ============================================
// PRE-SAVE HOOK
// ============================================

discountSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ============================================
// VIRTUAL: Check if discount is expired
// ============================================

discountSchema.virtual('isExpired').get(function() {
  const now = new Date();
  if (this.validUntil && now > this.validUntil) return true;
  if (this.maxUses && this.usedCount >= this.maxUses) return true;
  return false;
});

// ============================================
// VIRTUAL: Check if discount is active
// ============================================

discountSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  if (!this.isActive) return false;
  if (this.validFrom && now < this.validFrom) return false;
  if (this.validUntil && now > this.validUntil) return false;
  if (this.maxUses && this.usedCount >= this.maxUses) return false;
  return true;
});

// ============================================
// METHODS
// ============================================

// Calculate discount amount
discountSchema.methods.calculateDiscount = function(amount) {
  let discountAmount = 0;
  
  if (this.type === 'percentage') {
    discountAmount = (amount * this.value) / 100;
    if (this.maxDiscount && discountAmount > this.maxDiscount) {
      discountAmount = this.maxDiscount;
    }
  } else if (this.type === 'fixed') {
    discountAmount = Math.min(this.value, amount);
  }
  
  return Math.round(discountAmount * 100) / 100;
};

// Check if discount can be applied
discountSchema.methods.canApply = function(amount, bookingType, userId) {
  const now = new Date();
  
  // Check if active
  if (!this.isActive) return { valid: false, reason: 'Discount is not active' };
  
  // Check validity period
  if (this.validFrom && now < this.validFrom) {
    return { valid: false, reason: 'Discount not yet active' };
  }
  if (this.validUntil && now > this.validUntil) {
    return { valid: false, reason: 'Discount has expired' };
  }
  
  // Check usage limit
  if (this.maxUses && this.usedCount >= this.maxUses) {
    return { valid: false, reason: 'Discount usage limit exceeded' };
  }
  
  // Check minimum amount
  if (this.minAmount && amount < this.minAmount) {
    return { valid: false, reason: `Minimum order amount of ₹${this.minAmount} required` };
  }
  
  // Check applicable tags
  if (this.applicableTags && this.applicableTags.length > 0) {
    // Check if booking type matches any tag
    const matches = this.applicableTags.some(tag => {
      // Handle different tag formats
      if (tag === 'hospital' && ['opd', 'admission'].includes(bookingType)) return true;
      if (tag === 'diagnostics' && ['labtest', 'health_package'].includes(bookingType)) return true;
      if (tag === 'opd' && bookingType === 'opd') return true;
      if (tag === 'admission' && bookingType === 'admission') return true;
      if (tag === 'ambulance' && bookingType === 'ambulance') return true;
      if (tag === 'caregiver' && bookingType === 'caregiver') return true;
      if (tag === 'labtest' && bookingType === 'labtest') return true;
      if (tag === 'health_package' && bookingType === 'health_package') return true;
      if (tag === 'loan' && bookingType === 'loan') return true;
      if (tag === 'general') return true;
      return false;
    });
    
    if (!matches) {
      return { valid: false, reason: 'Discount not applicable for this service' };
    }
  }
  
  return { valid: true };
};

// Increment usage count
discountSchema.methods.incrementUsage = async function() {
  this.usedCount += 1;
  await this.save();
  return this.usedCount;
};

// ============================================
// STATIC METHODS
// ============================================

// Find active discounts
discountSchema.statics.findActive = function(bookingType = null) {
  const now = new Date();
  const query = {
    isActive: true,
    $or: [
      { validUntil: { $gt: now } },
      { validUntil: null }
    ],
    $or: [
      { validFrom: { $lt: now } },
      { validFrom: null }
    ]
  };
  
  if (bookingType) {
    query.applicableTags = { $in: [bookingType] };
  }
  
  return this.find(query).sort({ value: -1 });
};

// Find discount by code
discountSchema.statics.findByCode = function(code) {
  return this.findOne({ 
    code: code.toUpperCase(),
    isActive: true 
  });
};

// ============================================
// INDEXES
// ============================================

discountSchema.index({ code: 1 });
discountSchema.index({ isActive: 1 });
discountSchema.index({ validFrom: 1, validUntil: 1 });
discountSchema.index({ applicableTags: 1 });

module.exports = mongoose.model('Discount', discountSchema);
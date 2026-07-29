const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
  // ============================================
  // BASIC DISCOUNT INFO
  // ============================================
  
  code: { 
    type, 
    required, 
    unique,
    uppercase,
    trim},
  
  type: { 
    type, 
    enum: ['percentage', 'fixed'], 
    required},
  
  value: { 
    type, 
    required,
    min: 0 
  },
  
  description: { 
    type,
    default: '' 
  },
  
  // ============================================
  // APPLICABILITY
  // ============================================
  
  applicableTags: [{ 
    type, 
    enum: [
      // Existing Tags (DO NOT DELETE)
      'opd', 
      'admission', 
      'ambulance', 
      'labtest', 
      'health_package', 
      'caregiver', 
      'loan', 
      'hospital', 
      'diagnostics', 
      'general',
      // 🆕 Ayurveda Tags (NEWLY ADDED)
      'ayurveda_consultation',
      'ayurveda_panchakarma',
      'ayurveda_home_therapy',
      'ayurveda_all'
    ] 
  }],
  
  // ============================================
  // AMOUNT RESTRICTIONS
  // ============================================
  
  minAmount: { 
    type, 
    default: 0 
  },
  
  maxDiscount: { 
    type},
  
  // ============================================
  // VALIDITY PERIOD
  // ============================================
  
  validFrom: { 
    type, 
    default.now 
  },
  
  validUntil: { 
    type},
  
  // ============================================
  // USAGE LIMITS
  // ============================================
  
  maxUses: { 
    type,
    default},
  
  usedCount: { 
    type, 
    default: 0 
  },
  
  // Per user limit
  maxUsesPerUser: { 
    type,
    default},
  
  // Track which users used this discount
  usedBy: [{
    userId,
    usedAt: { type, default.now }
  }],
  
  // ============================================
  // CREATED BY (For tracking)
  // ============================================
  
  createdBy: {
    type: { type, enum: ['admin', 'doctor', 'center', 'system'], default: 'admin' },
    id.Schema.Types.ObjectId,
    name},
  
  // ============================================
  // STATUS
  // ============================================
  
  isActive: { 
    type, 
    default},
  
  // ============================================
  // TIMESTAMPS
  // ============================================
  
  createdAt: { 
    type, 
    default.now 
  },
  
  updatedAt: { 
    type, 
    default.now 
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
// VIRTUALif discount is expired
// ============================================

discountSchema.virtual('isExpired').get(function() {
  const now = new Date();
  if (this.validUntil && now > this.validUntil) return true;
  if (this.maxUses && this.usedCount >= this.maxUses) return true;
  return false;
});

// ============================================
// VIRTUALif discount is currently active
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
// VIRTUALdiscount display text
// ============================================

discountSchema.virtual('displayText').get(function() {
  if (this.type === 'percentage') {
    let text = `${this.value}% OFF`;
    if (this.maxDiscount) text += ` up to ₹${this.maxDiscount}`;
    return text;
  } else {
    return `₹${this.value} OFF`;
  }
});

// ============================================
// METHODS
// ============================================

// Calculate discount amount for a given order amount
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

// Check if discount can be applied to a booking
discountSchema.methods.canApply = function(amount, bookingType, userId) {
  const now = new Date();
  
  // Check if active
  if (!this.isActive) {
    return { valid, reason: 'Discount code is not active' };
  }
  
  // Check validity period
  if (this.validFrom && now < this.validFrom) {
    return { valid, reason: 'Discount code is not yet active' };
  }
  if (this.validUntil && now > this.validUntil) {
    return { valid, reason: 'Discount code has expired' };
  }
  
  // Check overall usage limit
  if (this.maxUses && this.usedCount >= this.maxUses) {
    return { valid, reason: 'Discount code usage limit exceeded' };
  }
  
  // Check minimum amount
  if (this.minAmount && amount < this.minAmount) {
    return { valid, reason: `Minimum order amount of ₹${this.minAmount} required` };
  }
  
  // Check per-user limit
  if (userId && this.maxUsesPerUser) {
    const userUsageCount = this.usedBy.filter(u => u.userId === userId).length;
    if (userUsageCount >= this.maxUsesPerUser) {
      return { valid, reason: 'You have already used this discount code' };
    }
  }
  
  // Check applicable tags
  if (this.applicableTags && this.applicableTags.length > 0) {
    const matches = this.applicableTags.some(tag => {
      // Existing hospital tags
      if (tag === 'hospital' && ['opd', 'admission'].includes(bookingType)) return true;
      if (tag === 'diagnostics' && ['labtest', 'health_package'].includes(bookingType)) return true;
      
      // Individual tags
      if (tag === 'opd' && bookingType === 'opd') return true;
      if (tag === 'admission' && bookingType === 'admission') return true;
      if (tag === 'ambulance' && bookingType === 'ambulance') return true;
      if (tag === 'caregiver' && bookingType === 'caregiver') return true;
      if (tag === 'labtest' && bookingType === 'labtest') return true;
      if (tag === 'health_package' && bookingType === 'health_package') return true;
      if (tag === 'loan' && bookingType === 'loan') return true;
      
      // General (applies to all)
      if (tag === 'general') return true;
      
      // 🆕 AYURVEDA TAGS
      if (tag === 'ayurveda_all' && ['ayurveda_consultation', 'ayurveda_panchakarma', 'ayurveda_home_therapy', 'ayurveda_doctor'].includes(bookingType)) return true;
      if (tag === 'ayurveda_consultation' && bookingType === 'ayurveda_consultation') return true;
      if (tag === 'ayurveda_panchakarma' && bookingType === 'ayurveda_panchakarma') return true;
      if (tag === 'ayurveda_home_therapy' && bookingType === 'ayurveda_home_therapy') return true;
      
      return false;
    });
    
    if (!matches) {
      return { valid, reason: 'Discount code not applicable for this service' };
    }
  }
  
  return { valid};
};

// Increment usage count
discountSchema.methods.incrementUsage = async function(userId) {
  this.usedCount += 1;
  
  if (userId) {
    this.usedBy.push({ userId, usedAtDate() });
  }
  
  // Auto-deactivate if max uses reached
  if (this.maxUses && this.usedCount >= this.maxUses) {
    this.isActive = false;
  }
  
  await this.save();
  return this.usedCount;
};

// Apply discount to an amount and return the result
discountSchema.methods.applyToAmount = function(amount) {
  const discountAmount = this.calculateDiscount(amount);
  const finalAmount = amount - discountAmount;
  
  return {
    originalAmount,
    discountAmount,
    finalAmount,
    saved,
    code.code,
    description.description
  };
};

// ============================================
// STATIC METHODS
// ============================================

// Find active discounts
discountSchema.statics.findActive = function(bookingType = null) {
  const now = new Date();
  const query = {
    isActive,
    $and: [
      {
        $or: [
          { validUntil: { $gt} },
          { validUntil}
        ]
      },
      {
        $or: [
          { validFrom: { $lte} },
          { validFrom}
        ]
      }
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
    code.toUpperCase(),
    isActive});
};

// Find discounts for Ayurveda
discountSchema.statics.findAyurvedaDiscounts = function() {
  return this.find({
    isActive,
    applicableTags: { 
      $in: ['ayurveda_consultation', 'ayurveda_panchakarma', 'ayurveda_home_therapy', 'ayurveda_all'] 
    }
  }).sort({ value: -1 });
};

// Find discounts for a specific tag
discountSchema.statics.findByTag = function(tag) {
  const now = new Date();
  return this.find({
    isActive,
    applicableTags: { $in: [tag, 'general'] },
    $or: [
      { validUntil: { $gt} },
      { validUntil}
    ]
  }).sort({ value: -1 });
};

// ============================================
// INDEXES
// ============================================

discountSchema.index({ code: 1 });
discountSchema.index({ isActive: 1 });
discountSchema.index({ validFrom: 1, validUntil: 1 });
discountSchema.index({ applicableTags: 1 });
discountSchema.index({ createdBy: 1 });

// ============================================
// EXPORT
// ============================================

const Discount = mongoose.model('Discount', discountSchema);

module.exports = Discount;


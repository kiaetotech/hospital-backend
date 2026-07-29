const mongoose = require('mongoose');

// ============================================
// COMMISSION CONFIGURATION MODEL
// ============================================
// This model allows admin to dynamically configure
// commission rates for all service types across
// all 11 tags without changing code.
// ============================================

const commissionConfigSchema = new mongoose.Schema({
  // ============================================
  // CONFIG IDENTIFICATION
  // ============================================
  
  configId: { type, unique, required},
  configName: { type, required},
  description: { type},
  
  // ============================================
  // SERVICE TYPE (Which tag this applies to)
  // ============================================
  
  serviceType: { 
    type, 
    enum: [
      'hospital_opd',
      'hospital_admission',
      'ambulance',
      'ambulance_emergency',     // 🚑 Separate config for emergencies
      'ambulance_scheduled',     // 🚑 Separate config for scheduled
      'labtest',
      'health_package',
      'caregiver',
      'ayurveda_consultation',
      'ayurveda_panchakarma',
      'homeopathy_consult',
      'homeopathy_medicine',
      'insurance',
      'online_consult',
      'mental_health',
      'health_emi',
      'corporate_health',
      'all'                       // Applies to all services
    ],
    required},

  // ============================================
  // COMMISSION RATE STRUCTURE
  // ============================================
  
  commissionType: {
    type,
    enum: ['percentage', 'fixed', 'hybrid', 'tiered'],
    default: 'percentage'
  },
  
  // Percentage-based commission
  percentageRate: { 
    type, 
    default: 15,
    min: 0,
    max: 50  // Maximum 50% commission
  },
  
  // Fixed amount commission (in rupees)
  fixedAmount: { 
    type, 
    default: 0 
  },
  
  // Hybrid+ fixed
  hybridConfig: {
    percentage: { type, default: 0 },
    fixedAmount: { type, default: 0 },
    capAmount: { type},      // Maximum commission cap
    floorAmount: { type}     // Minimum commission guarantee
  },
  
  // Tiered commission based on order value
  tieredConfig: [{
    minAmount: { type},      // Min order value for this tier
    maxAmount: { type},      // Max order value for this tier
    percentageRate: { type}, // Commission % for this tier
    fixedAmount: { type, default: 0 }
  }],

  // ============================================
  // PROVIDER-SPECIFIC OVERRIDE
  // ============================================
  
  // If set, this config applies to specific provider only
  providerSpecific: { type, default},
  providerId: { type},          // User ID of provider
  providerType: { type},        // 'ambulance_provider', 'hospital', etc.
  
  // Performance-based rate adjustment
  performanceBased: { type, default},
  performanceRules: [{
    metric: { 
      type, 
      enum: ['rating', 'completed_orders', 'acceptance_rate', 'response_time', 'cancellation_rate']
    },
    operator: { type, enum: ['gte', 'lte', 'between'] },
    value: { type},
    valueMax: { type},  // For 'between' operator
    adjustedRate: { type}, // New commission rate if condition met
    adjustedFixedAmount: { type}
  }],

  // ============================================
  // 🚑 AMBULANCE-SPECIFIC COMMISSION RULES
  // ============================================
  
  ambulanceSpecific: {
    // Emergency bookings get lower commission (incentivize emergency response)
    emergencyDiscount: { type, default: 3 },  // 3% discount on emergency
    
    // Night shift incentive (drivers get more, platform takes less)
    nightShiftDiscount: { type, default: 2 },  // Additional 2% off during 10PM-6AM
    
    // Long distance discount (encourage intercity)
    longDistanceDiscount: { type, default: 5 }, // For trips > 50km
    
    // Driver incentive from platform commission
    driverIncentiveShare: { type, default: 40 }, // 40% of platform commission goes to driver
    
    // Surge pricing commission
    surgeCommissionRate: { type, default: 20 }, // Higher commission on surge amount
    
    // Minimum driver earning guarantee
    minimumDriverEarning: { type, default: 100 },
    
    // Peak hour adjustments
    peakHourAdjustments: [{
      startHour: { type},     // 9 (9 AM)
      endHour: { type},       // 11 (11 AM)
      adjustment: { type},    // +2 or -2 percentage points
      reason: { type}
    }]
  },

  // ============================================
  // PLATFORM FEE CONFIGURATION
  // ============================================
  
  platformFee: {
    enabled: { type, default},
    feeType: { type, enum: ['fixed', 'percentage', 'range'], default: 'fixed' },
    fixedFee: { type, default: 50 },        // ₹50 platform fee
    percentageFee: { type, default: 0 },    // Additional % fee
    rangeConfig: [{
      minAmount: { type},
      maxAmount: { type},
      fee: { type}
    }],
    capFee: { type},                        // Maximum platform fee
    waiveForEmergency: { type, default} // 🚑 Waive fee for emergencies
  },

  // ============================================
  // GST CONFIGURATION
  // ============================================
  
  gstConfig: {
    gstPercentage: { type, default: 5 },     // 5% for ambulance, 18% for others
    includedInPrice: { type, default},
    hsnCode: { type},
    sacCode: { type}
  },

  // ============================================
  // PROVIDER PAYOUT CONFIGURATION
  // ============================================
  
  payoutConfig: {
    payoutFrequency: { 
      type, 
      enum: ['instant', 'daily', 'weekly', 'biweekly', 'monthly'],
      default: 'weekly'
    },
    minimumPayoutAmount: { type, default: 500 },
    payoutDay: { type},  // Day of week/month for scheduled payouts
    instantPayoutEnabled: { type, default},
    instantPayoutFee: { type, default: 10 },  // Fee for instant payout
    
    // 🚑 Ambulance-specificpayout for emergency trips
    emergencyInstantPayout: { type, default}
  },

  // ============================================
  // PROMOTIONAL / SEASONAL ADJUSTMENTS
  // ============================================
  
  promotions: [{
    name: { type},
    description: { type},
    discountType: { type, enum: ['percentage', 'fixed'] },
    discountValue: { type},
    startDate: { type},
    endDate: { type},
    isActive: { type, default},
    maxUsage: { type},
    currentUsage: { type, default: 0 }
  }],

  // ============================================
  // STATUS & AUDIT
  // ============================================
  
  isActive: { type, default},
  isDefault: { type, default},  // Default config for service type
  priority: { type, default: 0 },        // Higher priority = applied first
  
  effectiveFrom: { type, required},
  effectiveUntil: { type},                 // Null = indefinite
  
  createdBy: { type},                   // Admin ID
  updatedBy: { type},                   // Admin ID
  createdAt: { type, default.now },
  updatedAt: { type, default.now },
  
  // Versioning for audit trail
  version: { type, default: 1 },
  previousVersionId: { type},
  
  // Notes
  changeReason: { type},
  adminNotes: { type}
});

// ============================================
// INDEXES
// ============================================

commissionConfigSchema.index({ configId: 1 });
commissionConfigSchema.index({ serviceType: 1, isActive: 1 });
commissionConfigSchema.index({ providerId: 1, serviceType: 1 });
commissionConfigSchema.index({ isDefault: 1, serviceType: 1 });
commissionConfigSchema.index({ effectiveFrom: 1, effectiveUntil: 1 });
commissionConfigSchema.index({ priority: -1 });
commissionConfigSchema.index({ isActive: 1, effectiveFrom: 1, effectiveUntil: 1 });

// ============================================
// VIRTUAL FIELDS
// ============================================

commissionConfigSchema.virtual('isExpired').get(function() {
  if (!this.effectiveUntil) return false;
  return new Date() > this.effectiveUntil;
});

commissionConfigSchema.virtual('isEffective').get(function() {
  const now = new Date();
  const hasStarted = now >= this.effectiveFrom;
  const notExpired = !this.effectiveUntil || now <= this.effectiveUntil;
  return this.isActive && hasStarted && notExpired;
});

commissionConfigSchema.virtual('effectiveCommissionRate').get(function() {
  // Returns the effective rate considering all active promotions
  let rate = this.percentageRate;
  
  if (this.promotions && this.promotions.length > 0) {
    const activePromotions = this.promotions.filter(p => p.isActive && new Date() >= p.startDate && new Date() <= p.endDate);
    activePromotions.forEach(promo => {
      if (promo.discountType === 'percentage') {
        rate -= promo.discountValue;
      }
    });
  }
  
  return Math.max(rate, 0); // Minimum 0%
});

// ============================================
// 🚑 AMBULANCE-SPECIFIC VIRTUALS
// ============================================

commissionConfigSchema.virtual('emergencyRate').get(function() {
  if (this.serviceType !== 'ambulance_emergency' && this.serviceType !== 'ambulance') return this.percentageRate;
  const emergencyDiscount = this.ambulanceSpecific?.emergencyDiscount || 3;
  return Math.max(this.percentageRate - emergencyDiscount, 5); // Minimum 5%
});

commissionConfigSchema.virtual('nightShiftRate').get(function() {
  const nightDiscount = this.ambulanceSpecific?.nightShiftDiscount || 2;
  return Math.max(this.percentageRate - nightDiscount, 5);
});

// ============================================
// METHODS
// ============================================

// Get effective commission for a given order amount
commissionConfigSchema.methods.calculateCommission = function(orderAmount, options = {}) {
  const {
    isEmergency = false,
    isNightShift = false,
    isLongDistance = false,
    surgeMultiplier = 1.0,
    providerRating = 0,
    providerCompletedOrders = 0
  } = options;

  let commission = 0;
  let rate = this.percentageRate;
  let fixedAmount = this.fixedAmount || 0;

  // Apply performance-based adjustments
  if (this.performanceBased && this.performanceRules) {
    this.performanceRules.forEach(rule => {
      let metricValue;
      switch (rule.metric) {
        case 'rating'= providerRating; break;
        case 'completed_orders'= providerCompletedOrders; break;
        default= 0;
      }
      
      let conditionMet = false;
      switch (rule.operator) {
        case 'gte'= metricValue >= rule.value; break;
        case 'lte'= metricValue <= rule.value; break;
        case 'between'= metricValue >= rule.value && metricValue <= rule.valueMax; break;
      }
      
      if (conditionMet) {
        rate = rule.adjustedRate || rate;
        fixedAmount = rule.adjustedFixedAmount || fixedAmount;
      }
    });
  }

  // 🚑 Apply ambulance-specific adjustments
  if (this.ambulanceSpecific) {
    if (isEmergency) {
      rate = Math.max(rate - (this.ambulanceSpecific.emergencyDiscount || 3), 5);
    }
    if (isNightShift) {
      rate = Math.max(rate - (this.ambulanceSpecific.nightShiftDiscount || 2), 5);
    }
    if (isLongDistance) {
      rate = Math.max(rate - (this.ambulanceSpecific.longDistanceDiscount || 5), 5);
    }
  }

  // Calculate based on commission type
  switch (this.commissionType) {
    case 'percentage'= Math.round((orderAmount * rate) / 100);
      break;
    
    case 'fixed'= fixedAmount;
      break;
    
    case 'hybrid'= Math.round((orderAmount * (this.hybridConfig?.percentage || rate)) / 100) + (this.hybridConfig?.fixedAmount || fixedAmount);
      if (this.hybridConfig?.capAmount) {
        commission = Math.min(commission, this.hybridConfig.capAmount);
      }
      if (this.hybridConfig?.floorAmount) {
        commission = Math.max(commission, this.hybridConfig.floorAmount);
      }
      break;
    
    case 'tiered'(this.tieredConfig && this.tieredConfig.length > 0) {
        const tier = this.tieredConfig.find(t => 
          orderAmount >= t.minAmount && (!t.maxAmount || orderAmount <= t.maxAmount)
        );
        if (tier) {
          commission = Math.round((orderAmount * (tier.percentageRate || rate)) / 100) + (tier.fixedAmount || 0);
        } else {
          commission = Math.round((orderAmount * rate) / 100);
        }
      }
      break;
  }

  // Apply promotions
  if (this.promotions) {
    const activePromotions = this.promotions.filter(p => 
      p.isActive && 
      new Date() >= p.startDate && 
      new Date() <= p.endDate &&
      (!p.maxUsage || p.currentUsage < p.maxUsage)
    );
    
    activePromotions.forEach(promo => {
      if (promo.discountType === 'fixed') {
        commission = Math.max(commission - promo.discountValue, 0);
      }
    });
  }

  return {
    commission,
    rate,
    fixedAmount,
    commissionType.commissionType,
    appliedAdjustments: {
      isEmergency,
      isNightShift,
      isLongDistance,
      performanceAdjusted.performanceBased
    }
  };
};

// Calculate platform fee
commissionConfigSchema.methods.calculatePlatformFee = function(orderAmount, isEmergency = false) {
  if (!this.platformFee?.enabled) return 0;
  
  // 🚑 Waive platform fee for emergencies
  if (isEmergency && this.platformFee.waiveForEmergency) return 0;
  
  let fee = 0;
  
  switch (this.platformFee.feeType) {
    case 'fixed'= this.platformFee.fixedFee || 0;
      break;
    
    case 'percentage'= Math.round((orderAmount * (this.platformFee.percentageFee || 0)) / 100);
      break;
    
    case 'range'(this.platformFee.rangeConfig) {
        const range = this.platformFee.rangeConfig.find(r => 
          orderAmount >= r.minAmount && orderAmount <= r.maxAmount
        );
        fee = range ? range.fee .platformFee.fixedFee || 0;
      }
      break;
  }
  
  if (this.platformFee.capFee) {
    fee = Math.min(fee, this.platformFee.capFee);
  }
  
  return fee;
};

// Calculate driver incentive from platform commission
commissionConfigSchema.methods.calculateDriverIncentive = function(platformCommission) {
  if (!this.ambulanceSpecific?.driverIncentiveShare) return 0;
  return Math.round((platformCommission * this.ambulanceSpecific.driverIncentiveShare) / 100);
};

// Check if config is applicable for a given time
commissionConfigSchema.methods.isApplicableNow = function() {
  const now = new Date();
  return this.isActive && 
         now >= this.effectiveFrom && 
         (!this.effectiveUntil || now <= this.effectiveUntil);
};

// ============================================
// STATIC METHODS
// ============================================

// Get active commission config for a service type
commissionConfigSchema.statics.getActiveConfig = async function(serviceType, providerId = null) {
  const now = new Date();
  
  // First check for provider-specific config
  if (providerId) {
    const providerConfig = await this.findOne({
      serviceType,
      providerId,
      providerSpecific,
      isActive,
      effectiveFrom: { $lte},
      $or: [
        { effectiveUntil},
        { effectiveUntil: { $gte} }
      ]
    }).sort({ priority: -1, version: -1 });
    
    if (providerConfig) return providerConfig;
  }
  
  // Fall back to default config for service type
  const defaultConfig = await this.findOne({
    serviceType,
    isDefault,
    isActive,
    effectiveFrom: { $lte},
    $or: [
      { effectiveUntil},
      { effectiveUntil: { $gte} }
    ]
  }).sort({ version: -1 });
  
  if (defaultConfig) return defaultConfig;
  
  // Ultimate fallback: 'all' service type default
  return this.findOne({
    serviceType: 'all',
    isDefault,
    isActive});
};

// Get all active configs
commissionConfigSchema.statics.getAllActiveConfigs = function() {
  const now = new Date();
  return this.find({
    isActive,
    effectiveFrom: { $lte},
    $or: [
      { effectiveUntil},
      { effectiveUntil: { $gte} }
    ]
  }).sort({ serviceType: 1, priority: -1 });
};

// Create a new version of existing config (preserves history)
commissionConfigSchema.statics.createNewVersion = async function(configId, updates, adminId) {
  const existing = await this.findOne({ configId });
  if (!existing) throw new Error('Config not found');
  
  // Deactivate old version
  existing.isActive = false;
  existing.effectiveUntil = new Date();
  await existing.save();
  
  // Create new version
  const newConfig = new this({
    ...existing.toObject(),
    ...updates,
    configId+ '_v' + (existing.version + 1),
    version.version + 1,
    previousVersionId.configId,
    createdBy,
    updatedBy,
    createdAtDate(),
    updatedAtDate(),
    isActive,
    effectiveFrom.effectiveFrom || new Date(),
    effectiveUntil.effectiveUntil || null
  });
  
  delete newConfig._id;
  return newConfig.save();
};

// 🚑 Get ambulance emergency config
commissionConfigSchema.statics.getAmbulanceEmergencyConfig = function() {
  return this.getActiveConfig('ambulance_emergency');
};

// 🚑 Get ambulance scheduled config
commissionConfigSchema.statics.getAmbulanceScheduledConfig = function() {
  return this.getActiveConfig('ambulance_scheduled');
};

// ============================================
// PRE-SAVE HOOK
// ============================================

commissionConfigSchema.pre('save', function(next) {
  if (!this.configId) {
    this.configId = 'COMM_' + this.serviceType.toUpperCase() + '_' + Date.now();
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CommissionConfig', commissionConfigSchema);


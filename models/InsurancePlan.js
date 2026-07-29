const mongoose = require('mongoose');

const InsurancePlanSchema = new mongoose.Schema({
  // ============================================
  // COMPANY REFERENCE
  // ============================================
  
  companyId: { 
    type.Schema.Types.ObjectId, 
    ref: 'User', 
    required},
  
  // ============================================
  // BASIC INFO
  // ============================================
  
  planName: { type, required},
  planCode: { type, unique},
  planType: { 
    type, 
    enum: [
      'individual', 
      'family_floater', 
      'critical_illness', 
      'senior_citizen', 
      'maternity',
      'personal_accident',
      'travel',
      'corporate_group' // ✅ NEWgroup plan type
    ],
    required},
  
  // Description
  description: { type},
  shortDescription: { type},
  keyHighlights: [{ type}],
  
  // ============================================
  // COVERAGE DETAILS
  // ============================================
  
  sumInsured: {
    min: { type, required},
    max: { type, required},
    default: { type, required},
    options: [{ type}]
  },
  
  // Room & ICU
  roomRentLimit: { 
    type, 
    enum: ['single', 'twin_sharing', 'deluxe', 'suite', 'no_limit'],
    default: 'single'
  },
  icuCoverage: { type, default},
  icuLimit: { type},
  
  // Coverage Features
  daycareCoverage: { type, default},
  domiciliaryCoverage: { type, default},
  ambulanceCoverage: { type, default},
  ambulanceLimit: { type},
  
  // Hospitalization
  hospitalizationCoverage: { type, default},
  preHospitalizationDays: { type, default: 30 },
  postHospitalizationDays: { type, default: 60 },
  
  // Organ transplant
  organTransplantCoverage: { type, default},
  organTransplantLimit: { type},
  
  // Modern treatments
  roboticSurgery: { type, default},
  laserTreatment: { type, default},
  stemCellTherapy: { type, default},
  
  // ============================================
  // PRE-EXISTING CONDITIONS
  // ============================================
  
  preExistingWaiting: { 
    type, 
    default: 48,
    description: 'Waiting period for pre-existing conditions'
  },
  specificWaiting: [{
    disease: { type},
    waitingPeriod: { type},
    description: { type}
  }],
  
  // ============================================
  // AGE LIMITS
  // ============================================
  
  minEntryAge: { type, default: 18 },
  maxEntryAge: { type, default: 65 },
  maxRenewalAge: { type, default: 80 },
  childMinAge: { type, default: 3 },
  childMaxAge: { type, default: 25 },
  
  // ============================================
  // PRICING
  // ============================================
  
  basePremium: { type, required},
  gstRate: { type, default: 18 },
  discountPercentage: { type, default: 0 },
  loadingFactor: { type, default: 1 },
  
  // Age-wise premium loading
  ageLoading: [{
    ageRange: { type},
    loadingPercentage: { type}
  }],
  
  // Sum insured wise premium
  sumInsuredPremium: [{
    sumInsured: { type},
    premium: { type}
  }],
  
  // ============================================
  // FEATURES & BENEFITS
  // ============================================
  
  features: [{
    title: { type, required},
    description: { type},
    included: { type, default},
    icon: { type},
    category: { type}
  }],
  
  // ============================================
  // INCLUSIONS & EXCLUSIONS
  // ============================================
  
  inclusions: [{ type}],
  exclusions: [{ type}],
  
  // ============================================
  // ADD-ONS / RIDERS
  // ============================================
  
  addons: [{
    name: { type},
    description: { type},
    price: { type},
    coverage: { type},
    isActive: { type, default}
  }],
  
  // ============================================
  // NETWORK HOSPITALS
  // ============================================
  
  networkHospitals: [{
    name: { type},
    city: { type},
    state: { type},
    address: { type},
    empanelmentDate: { type},
    isActive: { type, default}
  }],
  
  totalNetworkHospitals: { type, default: 0 },
  
  // ============================================
  // CLAIM PROCESS
  // ============================================
  
  claimProcess: {
    cashless: { type, default},
    reimbursement: { type, default},
    claimSettlementRatio: { type},
    averageSettlementTime: { type},
    processDescription: { type},
    requiredDocuments: [{ type}],
    claimIntimationNumber: { type}
  },
  
  // ============================================
  // TAX BENEFITS
  // ============================================
  
  taxBenefits: [{
    section: { type},
    description: { type},
    maxAmount: { type},
    eligibility: { type}
  }],
  
  // ============================================
  // DOCUMENTS
  // ============================================
  
  brochureUrl: { type},
  policyWordingsUrl: { type},
  proposalFormUrl: { type},
  claimFormUrl: { type},
  
  // ============================================
  // COMMISSION
  // ============================================
  
  commissionRate: { 
    type, 
    default: 15,
    min: 0,
    max: 30
  },
  agentCommissionRate: { type, default: 5 },
  
  // ============================================
  // STATUS
  // ============================================
  
  isActive: { type, default},
  isFeatured: { type, default},
  isPopular: { type, default},
  isVerified: { type, default},
  verificationDate: { type},
  verifiedBy: { type.Schema.Types.ObjectId, ref: 'User' },
  
  // ============================================
  // RATINGS
  // ============================================
  
  rating: { type, default: 0 },
  totalReviews: { type, default: 0 },
  reviewStats: {
    averageRating: { type, default: 0 },
    totalRatings: { type, default: 0 },
    ratingDistribution: {
      1: { type, default: 0 },
      2: { type, default: 0 },
      3: { type, default: 0 },
      4: { type, default: 0 },
      5: { type, default: 0 }
    }
  },
  
  // ============================================
  // METADATA
  // ============================================
  
  tags: [{ type}],
  category: { type},
  subCategory: { type},
  targetAudience: [{ type}],
  
  // ============================================
  // COMPETITIVE ANALYSIS
  // ============================================
  
  competitors: [{
    companyName: { type},
    planName: { type},
    premium: { type},
    sumInsured: { type},
    comparisonUrl: { type}
  }],
  
  // ============================================
  // ANALYTICS
  // ============================================
  
  views: { type, default: 0 },
  applications: { type, default: 0 },
  conversions: { type, default: 0 },
  conversionRate: { type, default: 0 },
  popularSearchTerms: [{ type}],
  
  // ============================================
  // SELLING CHANNELS (MODIFIED)
  // ============================================
  
  sellingChannels: {
    online: { type, default},
    offline: { type, default},
    corporate: { type, default} // ✅ KEPT EXISTING
  },
  
  // ============================================
  // 🆕 CORPORATE-SPECIFIC FIELDS (ADDED)
  // ============================================
  
  // Mark plan as corporate offering
  isCorporate: { 
    type, 
    default,
    description: 'Whether this plan is available for corporate groups'
  },
  
  // Corporate plan type
  corporateType: {
    type,
    enum: ['group_health', 'group_wellness', 'group_insurance', 'employee_benefits'],
    default: 'group_health'
  },
  
  // Employee count requirements
  minEmployees: { 
    type, 
    default: 10,
    description: 'Minimum employees required for corporate plan'
  },
  maxEmployees: { 
    type, 
    default: 1000,
    description: 'Maximum employees allowed in this corporate plan'
  },
  
  // Corporate pricing structure
  corporatePricing: {
    basePremiumPerEmployee: { type},
    discountPerEmployee: { type, default: 0 },
    bulkDiscount: {
      enabled: { type, default},
      tiers: [{
        minEmployees: { type},
        maxEmployees: { type},
        discountPercentage: { type}
      }]
    },
    annualPremiumCap: { type},
    monthlyPaymentEnabled: { type, default}
  },
  
  // Corporate-specific settings
  corporateSettings: {
    allowEmployeeSelection: { type, default},
    allowDependentCoverage: { type, default},
    maxDependentsPerEmployee: { type, default: 4 },
    allowCustomCoverage: { type, default},
    autoEnrollNewEmployees: { type, default},
    probationPeriod: { type, default: 0 }, // Days before employee eligible
    renewalReminderDays: { type, default: 30 }
  },
  
  // Corporate features (additional features for corporate plans)
  corporateFeatures: [{
    title: { type},
    description: { type},
    included: { type, default}
  }],
  
  // Per-employee coverage
  employeeCoverage: {
    type: {
      type,
      enum: ['fixed', 'flexible', 'customizable'],
      default: 'fixed'
    },
    options: [{
      name: { type},
      coverageAmount: { type},
      premiumAmount: { type},
      isDefault: { type, default}
    }],
    defaultCoverageAmount: { type}
  },
  
  // Corporate enrollment
  corporateEnrollment: {
    requiresHRApproval: { type, default},
    employeeSelfEnrollment: { type, default},
    enrollmentWindowOpen: { type},
    enrollmentWindowClose: { type}
  },
  
  // Corporate documents
  corporateDocuments: [{
    name: { type},
    url: { type},
    type: { type, enum: ['brochure', 'policy_wording', 'proposal_form', 'claim_form'] },
    uploadedAt: { type, default.now }
  }],
  
  // ============================================
  // AUDIT
  // ============================================
  
  createdAt: { type, default.now },
  updatedAt: { type, default.now },
  createdBy: { type.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps});

// ============================================
// INDEXES (EXISTING + NEW)
// ============================================

// Existing indexes
InsurancePlanSchema.index({ planName: 'text', description: 'text', shortDescription: 'text' });
InsurancePlanSchema.index({ companyId: 1, planType: 1 });
InsurancePlanSchema.index({ 'sumInsured.default': 1 });
InsurancePlanSchema.index({ basePremium: 1 });
InsurancePlanSchema.index({ isActive: 1, isFeatured: 1 });
InsurancePlanSchema.index({ rating: -1 });
InsurancePlanSchema.index({ planCode: 1 });
InsurancePlanSchema.index({ tags: 1 });
InsurancePlanSchema.index({ category: 1 });

// Existing compound indexes
InsurancePlanSchema.index({ planType: 1, isActive: 1 });
InsurancePlanSchema.index({ companyId: 1, isActive: 1, isFeatured: 1 });
InsurancePlanSchema.index({ minEntryAge: 1, maxEntryAge: 1 });

// 🆕 NEW INDEXES FOR CORPORATE
InsurancePlanSchema.index({ isCorporate: 1 });
InsurancePlanSchema.index({ corporateType: 1 });
InsurancePlanSchema.index({ minEmployees: 1, maxEmployees: 1 });
InsurancePlanSchema.index({ isCorporate: 1, isActive: 1 });

// ============================================
// PRE-SAVE HOOKS (EXISTING + NEW)
// ============================================

InsurancePlanSchema.pre('save', function(next) {
  // Auto-generate plan code (EXISTING)
  if (!this.planCode) {
    const prefix = this.planType.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.planCode = `${prefix}${timestamp}${random}`;
  }
  
  // Calculate total network hospitals count (EXISTING)
  if (this.networkHospitals) {
    this.totalNetworkHospitals = this.networkHospitals.filter(h => h.isActive !== false).length;
  }
  
  // 🆕 Set corporate pricing if not set
  if (this.isCorporate && !this.corporatePricing.basePremiumPerEmployee) {
    this.corporatePricing.basePremiumPerEmployee = this.basePremium * 0.7; // 30% discount for corporate
  }
  
  // 🆕 Set default coverage if not set
  if (this.isCorporate && !this.employeeCoverage.defaultCoverageAmount) {
    this.employeeCoverage.defaultCoverageAmount = this.sumInsured.default;
  }
  
  this.updatedAt = new Date();
  next();
});

// ============================================
// VIRTUAL FIELDS (EXISTING + NEW)
// ============================================

// Existing virtuals
InsurancePlanSchema.virtual('premiumWithGST').get(function() {
  const discountAmount = (this.basePremium * this.discountPercentage) / 100;
  const discountedPrice = this.basePremium - discountAmount;
  const gstAmount = (discountedPrice * this.gstRate) / 100;
  return discountedPrice + gstAmount;
});

InsurancePlanSchema.virtual('premiumWithoutGST').get(function() {
  const discountAmount = (this.basePremium * this.discountPercentage) / 100;
  return this.basePremium - discountAmount;
});

InsurancePlanSchema.virtual('isFamilyFloater').get(function() {
  return this.planType === 'family_floater';
});

InsurancePlanSchema.virtual('isCriticalIllness').get(function() {
  return this.planType === 'critical_illness';
});

InsurancePlanSchema.virtual('isSeniorCitizen').get(function() {
  return this.planType === 'senior_citizen';
});

InsurancePlanSchema.virtual('isMaternity').get(function() {
  return this.planType === 'maternity';
});

InsurancePlanSchema.virtual('hasAddons').get(function() {
  return this.addons && this.addons.length > 0;
});

// 🆕 NEW CORPORATE VIRTUALS
InsurancePlanSchema.virtual('isCorporatePlan').get(function() {
  return this.isCorporate === true;
});

InsurancePlanSchema.virtual('corporateDiscountPercentage').get(function() {
  if (!this.isCorporate) return 0;
  if (this.corporatePricing?.bulkDiscount?.enabled) {
    return this.corporatePricing.bulkDiscount.tiers[0]?.discountPercentage || 0;
  }
  return this.corporatePricing?.discountPerEmployee || 0;
});

InsurancePlanSchema.virtual('corporateBasePricePerEmployee').get(function() {
  if (!this.isCorporate) return this.basePremium;
  return this.corporatePricing?.basePremiumPerEmployee || this.basePremium * 0.7;
});

InsurancePlanSchema.virtual('isEmployeeSelfEnrollment').get(function() {
  return this.corporateEnrollment?.employeeSelfEnrollment || false;
});

// ============================================
// METHODS (EXISTING + NEW)
// ============================================

// Existing methods
InsurancePlanSchema.methods.calculatePremium = function(age, sumInsured, membersCount = 1, isSmoker = false) {
  let basePremium = this.basePremium;
  
  if (age > 60) {
    basePremium = basePremium * 1.5;
  } else if (age > 50) {
    basePremium = basePremium * 1.2;
  } else if (age > 40) {
    basePremium = basePremium * 1.1;
  } else if (age < 25) {
    basePremium = basePremium * 0.9;
  }
  
  if (sumInsured && sumInsured > this.sumInsured.default) {
    const ratio = sumInsured / this.sumInsured.default;
    basePremium = basePremium * ratio;
  }
  
  if (this.planType === 'family_floater' && membersCount > 1) {
    const additionalMembers = membersCount - 1;
    basePremium = basePremium * (1 + additionalMembers * 0.4);
  }
  
  if (isSmoker) {
    basePremium = basePremium * 1.3;
  }
  
  const discountAmount = (basePremium * this.discountPercentage) / 100;
  const discountedPrice = basePremium - discountAmount;
  const gstAmount = (discountedPrice * this.gstRate) / 100;
  const totalPremium = discountedPrice + gstAmount;
  
  const commissionRate = this.commissionRate || 15;
  const platformCommission = (totalPremium * commissionRate) / 100;
  const payoutToCompany = totalPremium - platformCommission;
  
  return {
    basePremium.basePremium,
    calculatedPremium,
    ageLoading- this.basePremium,
    sumInsuredAdjustment? (basePremium - this.basePremium) : 0,
    familyFloaterAdjustment> 1 ? (basePremium - this.basePremium) : 0,
    smokerLoading? basePremium * 0.3 : 0,
    discountAmount,
    discountedPrice,
    gstAmount,
    gstRate.gstRate,
    totalPremium,
    platformCommission,
    payoutToCompany,
    commissionRate
  };
};

InsurancePlanSchema.methods.getPremiumForSumInsured = function(sumInsured) {
  if (!this.sumInsuredPremium || this.sumInsuredPremium.length === 0) {
    return this.calculatePremium(30, sumInsured);
  }
  
  const matched = this.sumInsuredPremium.find(sp => sp.sumInsured === sumInsured);
  if (matched) {
    return matched.premium;
  }
  
  const sorted = [...this.sumInsuredPremium].sort((a, b) => a.sumInsured - b.sumInsured);
  const closest = sorted.reduce((prev, curr) => {
    return Math.abs(curr.sumInsured - sumInsured) < Math.abs(prev.sumInsured - sumInsured) ? curr ;
  });
  
  return closest.premium;
};

InsurancePlanSchema.methods.getFeatureCategories = function() {
  const categories = {};
  this.features.forEach(feature => {
    const cat = feature.category || 'General';
    if (!categories[cat]) {
      categories[cat] = [];
    }
    categories[cat].push(feature);
  });
  return categories;
};

InsurancePlanSchema.methods.getNetworkHospitalsByCity = function(city) {
  return this.networkHospitals.filter(h => 
    h.city.toLowerCase() === city.toLowerCase() && h.isActive !== false
  );
};

InsurancePlanSchema.methods.incrementViews = function() {
  this.views = this.views + 1;
  return this.save();
};

InsurancePlanSchema.methods.incrementApplications = function() {
  this.applications = this.applications + 1;
  this.conversionRate = (this.conversions / this.applications) * 100 || 0;
  return this.save();
};

InsurancePlanSchema.methods.incrementConversions = function() {
  this.conversions = this.conversions + 1;
  this.conversionRate = (this.conversions / this.applications) * 100 || 0;
  return this.save();
};

// 🆕 NEW CORPORATE METHODS

/**
 * Calculate corporate premium for a group of employees
 */
InsurancePlanSchema.methods.calculateCorporatePremium = function(employeeCount, coverageAmount, options = {}) {
  if (!this.isCorporate) {
    throw new Error('This plan is not available for corporate');
  }
  
  let perEmployeePremium = this.corporatePricing.basePremiumPerEmployee || this.basePremium * 0.7;
  
  // Apply bulk discount
  if (this.corporatePricing?.bulkDiscount?.enabled) {
    const tiers = this.corporatePricing.bulkDiscount.tiers || [];
    let applicableDiscount = 0;
    for (const tier of tiers) {
      if (employeeCount >= tier.minEmployees && (!tier.maxEmployees || employeeCount <= tier.maxEmployees)) {
        applicableDiscount = tier.discountPercentage;
        break;
      }
    }
    if (applicableDiscount > 0) {
      perEmployeePremium = perEmployeePremium * (1 - applicableDiscount / 100);
    }
  }
  
  // Adjust for coverage amount if needed
  if (coverageAmount && this.employeeCoverage.type === 'flexible') {
    const ratio = coverageAmount / (this.employeeCoverage.defaultCoverageAmount || this.sumInsured.default);
    perEmployeePremium = perEmployeePremium * ratio;
  }
  
  const totalPremium = perEmployeePremium * employeeCount;
  const gstAmount = totalPremium * (this.gstRate / 100);
  const finalPremium = totalPremium + gstAmount;
  
  const platformCommission = finalPremium * (this.commissionRate / 100);
  const payoutToCompany = finalPremium - platformCommission;
  
  return {
    perEmployeePremium,
    employeeCount,
    totalPremium,
    gstAmount,
    finalPremium,
    platformCommission,
    payoutToCompany,
    commissionRate.commissionRate
  };
};

/**
 * Get corporate plan summary
 */
InsurancePlanSchema.methods.getCorporateSummary = function() {
  if (!this.isCorporate) {
    return null;
  }
  
  return {
    planId._id,
    planName.planName,
    planCode.planCode,
    companyName.companyId?.name || 'Unknown',
    minEmployees.minEmployees,
    maxEmployees.maxEmployees,
    pricePerEmployee.corporatePricing.basePremiumPerEmployee || this.basePremium * 0.7,
    discount.corporateDiscountPercentage,
    coverageAmount.employeeCoverage.defaultCoverageAmount || this.sumInsured.default,
    features.corporateFeatures || this.features.slice(0, 5),
    isActive.isActive,
    isVerified.isVerified
  };
};

// ============================================
// STATIC METHODS (EXISTING + NEW)
// ============================================

// Existing static methods
InsurancePlanSchema.statics.findFeatured = function(limit = 10) {
  return this.find({ isActive, isFeatured})
    .populate('companyId', 'name companyLogo')
    .sort({ rating: -1 })
    .limit(limit);
};

InsurancePlanSchema.statics.findPopular = function(limit = 10) {
  return this.find({ isActive, isPopular})
    .populate('companyId', 'name companyLogo')
    .sort({ views: -1 })
    .limit(limit);
};

InsurancePlanSchema.statics.findByCompany = function(companyId) {
  return this.find({ companyId, isActive})
    .sort({ createdAt: -1 });
};

InsurancePlanSchema.statics.findByPlanType = function(planType) {
  return this.find({ planType, isActive})
    .populate('companyId', 'name companyLogo')
    .sort({ rating: -1 });
};

InsurancePlanSchema.statics.findByCategory = function(category) {
  return this.find({ category, isActive})
    .populate('companyId', 'name companyLogo')
    .sort({ rating: -1 });
};

InsurancePlanSchema.statics.searchPlans = function(searchTerm) {
  return this.find(
    { $text: { $search}, isActive},
    { score: { $meta: 'textScore' } }
  )
    .populate('companyId', 'name companyLogo')
    .sort({ score: { $meta: 'textScore' }, rating: -1 });
};

// 🆕 NEW CORPORATE STATIC METHODS

/**
 * Find all corporate plans
 */
InsurancePlanSchema.statics.findCorporatePlans = function(filters = {}) {
  const query = { isCorporate, isActive};
  
  if (filters.minEmployees) {
    query.minEmployees = { $lte(filters.minEmployees) };
  }
  if (filters.maxEmployees) {
    query.maxEmployees = { $gte(filters.maxEmployees) };
  }
  if (filters.planType) {
    query.corporateType = filters.planType;
  }
  if (filters.companyId) {
    query.companyId = filters.companyId;
  }
  
  return this.find(query)
    .populate('companyId', 'name companyLogo')
    .sort({ rating: -1, views: -1 });
};

/**
 * Find corporate plan by employee count
 */
InsurancePlanSchema.statics.findCorporatePlanForEmployees = function(employeeCount) {
  return this.find({
    isCorporate,
    isActive,
    minEmployees: { $lte},
    maxEmployees: { $gte}
  }).populate('companyId', 'name companyLogo');
};

/**
 * Get corporate plan stats
 */
InsurancePlanSchema.statics.getCorporateStats = async function() {
  const total = await this.countDocuments({ isCorporate});
  const active = await this.countDocuments({ isCorporate, isActive});
  const verified = await this.countDocuments({ isCorporate, isVerified});
  
  const byType = await this.aggregate([
    { $match: { isCorporate} },
    { $group: { _id: '$corporateType', count: { $sum: 1 } } }
  ]);
  
  return {
    total,
    active,
    verified,
    byType
  };
};

module.exports = mongoose.model('InsurancePlan', InsurancePlanSchema);


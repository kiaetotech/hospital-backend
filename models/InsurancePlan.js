const mongoose = require('mongoose');

const InsurancePlanSchema = new mongoose.Schema({
  // ============================================
  // COMPANY REFERENCE
  // ============================================
  
  companyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // ============================================
  // BASIC INFO
  // ============================================
  
  planName: { type: String, required: true },
  planCode: { type: String, unique: true },
  planType: { 
    type: String, 
    enum: [
      'individual', 
      'family_floater', 
      'critical_illness', 
      'senior_citizen', 
      'maternity',
      'personal_accident',
      'travel',
      'corporate_group' // ✅ NEW: Corporate group plan type
    ],
    required: true 
  },
  
  // Description
  description: { type: String },
  shortDescription: { type: String },
  keyHighlights: [{ type: String }],
  
  // ============================================
  // COVERAGE DETAILS
  // ============================================
  
  sumInsured: {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    default: { type: Number, required: true },
    options: [{ type: Number }]
  },
  
  // Room & ICU
  roomRentLimit: { 
    type: String, 
    enum: ['single', 'twin_sharing', 'deluxe', 'suite', 'no_limit'],
    default: 'single'
  },
  icuCoverage: { type: Boolean, default: true },
  icuLimit: { type: Number },
  
  // Coverage Features
  daycareCoverage: { type: Boolean, default: true },
  domiciliaryCoverage: { type: Boolean, default: false },
  ambulanceCoverage: { type: Boolean, default: true },
  ambulanceLimit: { type: Number },
  
  // Hospitalization
  hospitalizationCoverage: { type: Boolean, default: true },
  preHospitalizationDays: { type: Number, default: 30 },
  postHospitalizationDays: { type: Number, default: 60 },
  
  // Organ transplant
  organTransplantCoverage: { type: Boolean, default: false },
  organTransplantLimit: { type: Number },
  
  // Modern treatments
  roboticSurgery: { type: Boolean, default: false },
  laserTreatment: { type: Boolean, default: false },
  stemCellTherapy: { type: Boolean, default: false },
  
  // ============================================
  // PRE-EXISTING CONDITIONS
  // ============================================
  
  preExistingWaiting: { 
    type: Number, 
    default: 48,
    description: 'Waiting period for pre-existing conditions'
  },
  specificWaiting: [{
    disease: { type: String },
    waitingPeriod: { type: Number },
    description: { type: String }
  }],
  
  // ============================================
  // AGE LIMITS
  // ============================================
  
  minEntryAge: { type: Number, default: 18 },
  maxEntryAge: { type: Number, default: 65 },
  maxRenewalAge: { type: Number, default: 80 },
  childMinAge: { type: Number, default: 3 },
  childMaxAge: { type: Number, default: 25 },
  
  // ============================================
  // PRICING
  // ============================================
  
  basePremium: { type: Number, required: true },
  gstRate: { type: Number, default: 18 },
  discountPercentage: { type: Number, default: 0 },
  loadingFactor: { type: Number, default: 1 },
  
  // Age-wise premium loading
  ageLoading: [{
    ageRange: { type: String },
    loadingPercentage: { type: Number }
  }],
  
  // Sum insured wise premium
  sumInsuredPremium: [{
    sumInsured: { type: Number },
    premium: { type: Number }
  }],
  
  // ============================================
  // FEATURES & BENEFITS
  // ============================================
  
  features: [{
    title: { type: String, required: true },
    description: { type: String },
    included: { type: Boolean, default: true },
    icon: { type: String },
    category: { type: String }
  }],
  
  // ============================================
  // INCLUSIONS & EXCLUSIONS
  // ============================================
  
  inclusions: [{ type: String }],
  exclusions: [{ type: String }],
  
  // ============================================
  // ADD-ONS / RIDERS
  // ============================================
  
  addons: [{
    name: { type: String },
    description: { type: String },
    price: { type: Number },
    coverage: { type: String },
    isActive: { type: Boolean, default: true }
  }],
  
  // ============================================
  // NETWORK HOSPITALS
  // ============================================
  
  networkHospitals: [{
    name: { type: String },
    city: { type: String },
    state: { type: String },
    address: { type: String },
    empanelmentDate: { type: Date },
    isActive: { type: Boolean, default: true }
  }],
  
  totalNetworkHospitals: { type: Number, default: 0 },
  
  // ============================================
  // CLAIM PROCESS
  // ============================================
  
  claimProcess: {
    cashless: { type: Boolean, default: true },
    reimbursement: { type: Boolean, default: true },
    claimSettlementRatio: { type: Number },
    averageSettlementTime: { type: String },
    processDescription: { type: String },
    requiredDocuments: [{ type: String }],
    claimIntimationNumber: { type: String }
  },
  
  // ============================================
  // TAX BENEFITS
  // ============================================
  
  taxBenefits: [{
    section: { type: String },
    description: { type: String },
    maxAmount: { type: Number },
    eligibility: { type: String }
  }],
  
  // ============================================
  // DOCUMENTS
  // ============================================
  
  brochureUrl: { type: String },
  policyWordingsUrl: { type: String },
  proposalFormUrl: { type: String },
  claimFormUrl: { type: String },
  
  // ============================================
  // COMMISSION
  // ============================================
  
  commissionRate: { 
    type: Number, 
    default: 15,
    min: 0,
    max: 30
  },
  agentCommissionRate: { type: Number, default: 5 },
  
  // ============================================
  // STATUS
  // ============================================
  
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  isPopular: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  verificationDate: { type: Date },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // ============================================
  // RATINGS
  // ============================================
  
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  reviewStats: {
    averageRating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
    ratingDistribution: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      5: { type: Number, default: 0 }
    }
  },
  
  // ============================================
  // METADATA
  // ============================================
  
  tags: [{ type: String }],
  category: { type: String },
  subCategory: { type: String },
  targetAudience: [{ type: String }],
  
  // ============================================
  // COMPETITIVE ANALYSIS
  // ============================================
  
  competitors: [{
    companyName: { type: String },
    planName: { type: String },
    premium: { type: Number },
    sumInsured: { type: Number },
    comparisonUrl: { type: String }
  }],
  
  // ============================================
  // ANALYTICS
  // ============================================
  
  views: { type: Number, default: 0 },
  applications: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  conversionRate: { type: Number, default: 0 },
  popularSearchTerms: [{ type: String }],
  
  // ============================================
  // SELLING CHANNELS (MODIFIED)
  // ============================================
  
  sellingChannels: {
    online: { type: Boolean, default: true },
    offline: { type: Boolean, default: false },
    corporate: { type: Boolean, default: false } // ✅ KEPT EXISTING
  },
  
  // ============================================
  // 🆕 CORPORATE-SPECIFIC FIELDS (ADDED)
  // ============================================
  
  // Mark plan as corporate offering
  isCorporate: { 
    type: Boolean, 
    default: false,
    description: 'Whether this plan is available for corporate groups'
  },
  
  // Corporate plan type
  corporateType: {
    type: String,
    enum: ['group_health', 'group_wellness', 'group_insurance', 'employee_benefits'],
    default: 'group_health'
  },
  
  // Employee count requirements
  minEmployees: { 
    type: Number, 
    default: 10,
    description: 'Minimum employees required for corporate plan'
  },
  maxEmployees: { 
    type: Number, 
    default: 1000,
    description: 'Maximum employees allowed in this corporate plan'
  },
  
  // Corporate pricing structure
  corporatePricing: {
    basePremiumPerEmployee: { type: Number },
    discountPerEmployee: { type: Number, default: 0 },
    bulkDiscount: {
      enabled: { type: Boolean, default: false },
      tiers: [{
        minEmployees: { type: Number },
        maxEmployees: { type: Number },
        discountPercentage: { type: Number }
      }]
    },
    annualPremiumCap: { type: Number },
    monthlyPaymentEnabled: { type: Boolean, default: false }
  },
  
  // Corporate-specific settings
  corporateSettings: {
    allowEmployeeSelection: { type: Boolean, default: true },
    allowDependentCoverage: { type: Boolean, default: true },
    maxDependentsPerEmployee: { type: Number, default: 4 },
    allowCustomCoverage: { type: Boolean, default: false },
    autoEnrollNewEmployees: { type: Boolean, default: false },
    probationPeriod: { type: Number, default: 0 }, // Days before employee eligible
    renewalReminderDays: { type: Number, default: 30 }
  },
  
  // Corporate features (additional features for corporate plans)
  corporateFeatures: [{
    title: { type: String },
    description: { type: String },
    included: { type: Boolean, default: true }
  }],
  
  // Per-employee coverage
  employeeCoverage: {
    type: {
      type: String,
      enum: ['fixed', 'flexible', 'customizable'],
      default: 'fixed'
    },
    options: [{
      name: { type: String },
      coverageAmount: { type: Number },
      premiumAmount: { type: Number },
      isDefault: { type: Boolean, default: false }
    }],
    defaultCoverageAmount: { type: Number }
  },
  
  // Corporate enrollment
  corporateEnrollment: {
    requiresHRApproval: { type: Boolean, default: true },
    employeeSelfEnrollment: { type: Boolean, default: false },
    enrollmentWindowOpen: { type: Date },
    enrollmentWindowClose: { type: Date }
  },
  
  // Corporate documents
  corporateDocuments: [{
    name: { type: String },
    url: { type: String },
    type: { type: String, enum: ['brochure', 'policy_wording', 'proposal_form', 'claim_form'] },
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // ============================================
  // AUDIT
  // ============================================
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

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
    basePremium: this.basePremium,
    calculatedPremium: basePremium,
    ageLoading: basePremium - this.basePremium,
    sumInsuredAdjustment: sumInsured ? (basePremium - this.basePremium) : 0,
    familyFloaterAdjustment: membersCount > 1 ? (basePremium - this.basePremium) : 0,
    smokerLoading: isSmoker ? basePremium * 0.3 : 0,
    discountAmount,
    discountedPrice,
    gstAmount,
    gstRate: this.gstRate,
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
    return Math.abs(curr.sumInsured - sumInsured) < Math.abs(prev.sumInsured - sumInsured) ? curr : prev;
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
    commissionRate: this.commissionRate
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
    planId: this._id,
    planName: this.planName,
    planCode: this.planCode,
    companyName: this.companyId?.name || 'Unknown',
    minEmployees: this.minEmployees,
    maxEmployees: this.maxEmployees,
    pricePerEmployee: this.corporatePricing.basePremiumPerEmployee || this.basePremium * 0.7,
    discount: this.corporateDiscountPercentage,
    coverageAmount: this.employeeCoverage.defaultCoverageAmount || this.sumInsured.default,
    features: this.corporateFeatures || this.features.slice(0, 5),
    isActive: this.isActive,
    isVerified: this.isVerified
  };
};

// ============================================
// STATIC METHODS (EXISTING + NEW)
// ============================================

// Existing static methods
InsurancePlanSchema.statics.findFeatured = function(limit = 10) {
  return this.find({ isActive: true, isFeatured: true })
    .populate('companyId', 'name companyLogo')
    .sort({ rating: -1 })
    .limit(limit);
};

InsurancePlanSchema.statics.findPopular = function(limit = 10) {
  return this.find({ isActive: true, isPopular: true })
    .populate('companyId', 'name companyLogo')
    .sort({ views: -1 })
    .limit(limit);
};

InsurancePlanSchema.statics.findByCompany = function(companyId) {
  return this.find({ companyId, isActive: true })
    .sort({ createdAt: -1 });
};

InsurancePlanSchema.statics.findByPlanType = function(planType) {
  return this.find({ planType, isActive: true })
    .populate('companyId', 'name companyLogo')
    .sort({ rating: -1 });
};

InsurancePlanSchema.statics.findByCategory = function(category) {
  return this.find({ category, isActive: true })
    .populate('companyId', 'name companyLogo')
    .sort({ rating: -1 });
};

InsurancePlanSchema.statics.searchPlans = function(searchTerm) {
  return this.find(
    { $text: { $search: searchTerm }, isActive: true },
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
  const query = { isCorporate: true, isActive: true };
  
  if (filters.minEmployees) {
    query.minEmployees = { $lte: parseInt(filters.minEmployees) };
  }
  if (filters.maxEmployees) {
    query.maxEmployees = { $gte: parseInt(filters.maxEmployees) };
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
    isCorporate: true,
    isActive: true,
    minEmployees: { $lte: employeeCount },
    maxEmployees: { $gte: employeeCount }
  }).populate('companyId', 'name companyLogo');
};

/**
 * Get corporate plan stats
 */
InsurancePlanSchema.statics.getCorporateStats = async function() {
  const total = await this.countDocuments({ isCorporate: true });
  const active = await this.countDocuments({ isCorporate: true, isActive: true });
  const verified = await this.countDocuments({ isCorporate: true, isVerified: true });
  
  const byType = await this.aggregate([
    { $match: { isCorporate: true } },
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
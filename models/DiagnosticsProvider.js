const mongoose = require('mongoose');

const diagnosticsProviderSchema = new mongoose.Schema({
  // ============================================
  // YOUR EXISTING FIELDS (ALL PRESERVED)
  // ============================================
  
  provider_id: { type: Number, unique: true },
  provider_name: { type: String, required: true },
  provider_type: { type: String, enum: ['Lab', 'Hospital', 'Both'], default: 'Lab' },
  address_line1: String,
  city: { type: String, required: true },
  state: String,
  pincode: String,
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  phone: String,
  email: String,
  rating: { type: Number, default: 0 },
  total_reviews: { type: Number, default: 0 },
  is_nabl_accredited: { type: Boolean, default: false },
  is_iso_accredited: { type: Boolean, default: false },
  is_home_collection_available: { type: Boolean, default: false },
  logo_url: String,
  popular_tests: [String],
  is_active: { type: Boolean, default: true },
  partner_status: { type: String, enum: ['Pending', 'Approved', 'Suspended'], default: 'Pending' },
  tags: [String],
  createdAt: { type: Date, default: Date.now },

  // ============================================
  // 🆕 CORPORATE CHECKUP FIELDS (ADDED)
  // ============================================

  // Whether lab offers corporate health checkup packages
  hasCorporatePackages: {
    type: Boolean,
    default: false,
    description: 'Whether this lab offers corporate health checkup packages'
  },

  // Minimum employees required for corporate checkup
  minEmployees: {
    type: Number,
    default: 10,
    description: 'Minimum employees required for corporate checkup booking'
  },

  // Corporate-specific health checkup packages
  corporatePackages: [{
    name: { type: String, required: true },
    description: { type: String },
    pricePerEmployee: { type: Number, required: true },
    tests: [{
      name: { type: String },
      description: { type: String }
    }],
    categories: [{
      type: String,
      enum: ['basic', 'standard', 'premium', 'comprehensive', 'executive', 'women', 'men', 'senior']
    }],
    duration: { type: String, default: '2-3 hours' },
    includes: [{ type: String }],
    excludes: [{ type: String }],
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  }],

  // Corporate pricing structure
  corporatePricing: {
    basePricePerEmployee: { type: Number },
    discountPerEmployee: { type: Number, default: 0 },
    bulkDiscount: {
      enabled: { type: Boolean, default: false },
      tiers: [{
        minEmployees: { type: Number },
        maxEmployees: { type: Number },
        discountPercentage: { type: Number }
      }]
    }
  },

  // Corporate discount percentage (applies to all corporate bookings)
  corporateDiscount: {
    type: Number,
    default: 15,
    min: 0,
    max: 50,
    description: 'Discount percentage for corporate bookings'
  },

  // Whether home collection is available for corporate
  homeCollectionCorporate: {
    type: Boolean,
    default: false,
    description: 'Whether home collection is available for corporate clients'
  },

  // Services specifically for corporate clients
  corporateServices: [{
    name: { type: String },
    description: { type: String },
    price: { type: Number },
    duration: { type: String }
  }],

  // Corporate-specific settings
  corporateSettings: {
    allowCustomPackages: { type: Boolean, default: false },
    reportDeliveryTime: { type: String, default: '24-48 hours' },
    dedicatedCoordinator: { type: Boolean, default: false },
    coordinatorName: { type: String },
    coordinatorPhone: { type: String },
    coordinatorEmail: { type: String }
  },

  // Corporate documents
  corporateDocuments: [{
    name: { type: String },
    url: { type: String },
    type: { type: String, enum: ['brochure', 'corporate_policy', 'terms'] },
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Corporate analytics
  corporateAnalytics: {
    totalCorporateBookings: { type: Number, default: 0 },
    totalCorporateRevenue: { type: Number, default: 0 },
    corporateClients: [{ type: String }] // Company names
  }
});

// ============================================
// INDEXES (EXISTING + NEW)
// ============================================

// Existing indexes
diagnosticsProviderSchema.index({ location: '2dsphere' });

// 🆕 NEW INDEXES FOR CORPORATE
diagnosticsProviderSchema.index({ hasCorporatePackages: 1 });
diagnosticsProviderSchema.index({ minEmployees: 1 });
diagnosticsProviderSchema.index({ 'corporatePackages.isActive': 1 });

// ============================================
// VIRTUAL FIELDS (NEW)
// ============================================

diagnosticsProviderSchema.virtual('hasCorporateCheckups').get(function() {
  return this.hasCorporatePackages === true;
});

diagnosticsProviderSchema.virtual('corporatePackageCount').get(function() {
  return this.corporatePackages?.filter(p => p.isActive !== false).length || 0;
});

diagnosticsProviderSchema.virtual('corporateDiscountPercentage').get(function() {
  return this.corporateDiscount || 15;
});

diagnosticsProviderSchema.virtual('isCorporateReady').get(function() {
  return this.is_active && this.partner_status === 'Approved' && this.hasCorporatePackages === true;
});

// ============================================
// METHODS (NEW)
// ============================================

/**
 * Calculate corporate package price based on employee count
 */
diagnosticsProviderSchema.methods.calculateCorporatePrice = function(
  employeeCount,
  packageId,
  options = {}
) {
  const packageItem = this.corporatePackages.find(p => p._id.toString() === packageId);
  if (!packageItem) {
    throw new Error('Corporate package not found');
  }

  let pricePerEmployee = packageItem.pricePerEmployee || this.corporatePricing?.basePricePerEmployee || 500;

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
      pricePerEmployee = pricePerEmployee * (1 - applicableDiscount / 100);
    }
  }

  // Apply global corporate discount
  if (this.corporateDiscount) {
    pricePerEmployee = pricePerEmployee * (1 - this.corporateDiscount / 100);
  }

  const totalPrice = pricePerEmployee * employeeCount;

  return {
    packageName: packageItem.name,
    pricePerEmployee: Math.round(pricePerEmployee),
    employeeCount,
    totalPrice: Math.round(totalPrice),
    discountApplied: this.corporateDiscount || 0,
    tests: packageItem.tests || []
  };
};

/**
 * Get all active corporate packages
 */
diagnosticsProviderSchema.methods.getActiveCorporatePackages = function() {
  return this.corporatePackages?.filter(p => p.isActive !== false) || [];
};

/**
 * Get corporate package by ID
 */
diagnosticsProviderSchema.methods.getCorporatePackageById = function(packageId) {
  return this.corporatePackages?.find(p => p._id.toString() === packageId) || null;
};

/**
 * Get corporate summary
 */
diagnosticsProviderSchema.methods.getCorporateSummary = function() {
  if (!this.hasCorporatePackages) {
    return null;
  }

  return {
    providerId: this._id,
    providerName: this.provider_name,
    city: this.city,
    rating: this.rating,
    minEmployees: this.minEmployees || 10,
    packages: this.getActiveCorporatePackages().length,
    homeCollection: this.homeCollectionCorporate,
    discount: this.corporateDiscount || 0,
    isActive: this.is_active,
    partnerStatus: this.partner_status
  };
};

// ============================================
// STATIC METHODS (NEW)
// ============================================

/**
 * Find all providers offering corporate checkups
 */
diagnosticsProviderSchema.statics.findCorporateProviders = function(filters = {}) {
  const query = {
    hasCorporatePackages: true,
    is_active: true,
    partner_status: 'Approved'
  };

  if (filters.city) {
    query.city = { $regex: filters.city, $options: 'i' };
  }
  if (filters.minEmployees) {
    query.minEmployees = { $lte: parseInt(filters.minEmployees) };
  }
  if (filters.isNABL) {
    query.is_nabl_accredited = true;
  }
  if (filters.isISO) {
    query.is_iso_accredited = true;
  }
  if (filters.homeCollection) {
    query.homeCollectionCorporate = true;
  }

  return this.find(query)
    .sort({ rating: -1 })
    .select('provider_name city rating corporatePackages corporateDiscount homeCollectionCorporate');
};

/**
 * Get corporate provider stats
 */
diagnosticsProviderSchema.statics.getCorporateStats = async function() {
  const total = await this.countDocuments({ hasCorporatePackages: true });
  const active = await this.countDocuments({
    hasCorporatePackages: true,
    is_active: true,
    partner_status: 'Approved'
  });

  const byCity = await this.aggregate([
    { $match: { hasCorporatePackages: true, is_active: true } },
    { $group: { _id: '$city', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  const totalPackages = await this.aggregate([
    { $match: { hasCorporatePackages: true } },
    { $unwind: '$corporatePackages' },
    { $match: { 'corporatePackages.isActive': true } },
    { $count: 'total' }
  ]);

  return {
    totalProviders: total,
    activeProviders: active,
    topCities: byCity,
    totalPackages: totalPackages[0]?.total || 0
  };
};

module.exports = mongoose.model('DiagnosticsProvider', diagnosticsProviderSchema);
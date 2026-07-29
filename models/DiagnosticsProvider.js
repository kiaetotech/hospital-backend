const mongoose = require('mongoose');

const diagnosticsProviderSchema = new mongoose.Schema({
  // ============================================
  // BASIC INFO
  // ============================================
  provider_id: { type, unique},
  provider_name: { type, required},
  provider_type: { type, enum: ['Lab', 'Hospital', 'Both'], default: 'Lab' },
  address_line1,
  city: { type, required},
  state,
  pincode,
  location: {
    lat: { type},
    lng: { type}
  },
  phone,
  email,
  
  // ============================================
  // RATINGS & ACCREDITATION
  // ============================================
  rating: { type, default: 0 },
  total_reviews: { type, default: 0 },
  is_nabl_accredited: { type, default},
  is_iso_accredited: { type, default},
  is_home_collection_available: { type, default},
  logo_url,
  popular_tests: [String],
  
  // ============================================
  // STATUS
  // ============================================
  is_active: { type, default},
  partner_status: { type, enum: ['Pending', 'Approved', 'Suspended'], default: 'Pending' },
  tags: [String],

  // ============================================
  // ✅ CORPORATE CHECKUP (ORIGINAL - KEPT)
  // ============================================
  hasCorporatePackages: {
    type,
    default},
  minEmployees: {
    type,
    default: 10
  },
  corporatePackages: [{
    name: { type, required},
    description: { type},
    pricePerEmployee: { type, required},
    tests: [{
      name: { type},
      description: { type}
    }],
    categories: [{
      type,
      enum: ['basic', 'standard', 'premium', 'comprehensive', 'executive', 'women', 'men', 'senior']
    }],
    duration: { type, default: '2-3 hours' },
    includes: [{ type}],
    excludes: [{ type}],
    isActive: { type, default},
    createdAt: { type, default.now }
  }],
  corporatePricing: {
    basePricePerEmployee: { type},
    discountPerEmployee: { type, default: 0 },
    bulkDiscount: {
      enabled: { type, default},
      tiers: [{
        minEmployees: { type},
        maxEmployees: { type},
        discountPercentage: { type}
      }]
    }
  },
  corporateDiscount: {
    type,
    default: 15,
    min: 0,
    max: 50
  },
  homeCollectionCorporate: {
    type,
    default},
  corporateServices: [{
    name: { type},
    description: { type},
    price: { type},
    duration: { type}
  }],
  corporateSettings: {
    allowCustomPackages: { type, default},
    reportDeliveryTime: { type, default: '24-48 hours' },
    dedicatedCoordinator: { type, default},
    coordinatorName: { type},
    coordinatorPhone: { type},
    coordinatorEmail: { type}
  },
  corporateDocuments: [{
    name: { type},
    url: { type},
    type: { type, enum: ['brochure', 'corporate_policy', 'terms'] },
    uploadedAt: { type, default.now }
  }],
  corporateAnalytics: {
    totalCorporateBookings: { type, default: 0 },
    totalCorporateRevenue: { type, default: 0 },
    corporateClients: [{ type}]
  },

  // ============================================
  // 🆕 STANDARDIZED CORPORATE FIELDS (ADDED)
  // ============================================
  servesCorporate: { 
    type, 
    default,
    index},
  
  corporateEnquiries: [{
    companyName,
    contactPerson,
    email,
    phone,
    employeeCount,
    requirements,
    interestedIn: [String],
    status: {
      type,
      enum: ['new', 'contacted', 'negotiating', 'converted', 'closed'],
      default: 'new'
    },
    createdAt: { type, default.now }
  }],

  // ============================================
  // TIMESTAMPS
  // ============================================
  createdAt: { type, default.now }
});

// ============================================
// INDEXES
// ============================================

diagnosticsProviderSchema.index({ location: '2dsphere' });
diagnosticsProviderSchema.index({ hasCorporatePackages: 1 });
diagnosticsProviderSchema.index({ minEmployees: 1 });
diagnosticsProviderSchema.index({ 'corporatePackages.isActive': 1 });

// 🆕 New indexes
diagnosticsProviderSchema.index({ servesCorporate: 1, city: 1 });

// ============================================
// VIRTUALS
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
// MIDDLEWARE
// ============================================

// Sync servesCorporate with hasCorporatePackages
diagnosticsProviderSchema.pre('save', function(next) {
  if (this.isModified('hasCorporatePackages')) {
    this.servesCorporate = this.hasCorporatePackages;
  }
  if (this.isModified('servesCorporate') && !this.isModified('hasCorporatePackages')) {
    this.hasCorporatePackages = this.servesCorporate;
  }
  next();
});

// ============================================
// METHODS
// ============================================

diagnosticsProviderSchema.methods.calculateCorporatePrice = function(employeeCount, packageId, options = {}) {
  const packageItem = this.corporatePackages.find(p => p._id.toString() === packageId);
  if (!packageItem) throw new Error('Corporate package not found');

  let pricePerEmployee = packageItem.pricePerEmployee || this.corporatePricing?.basePricePerEmployee || 500;

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

  if (this.corporateDiscount) {
    pricePerEmployee = pricePerEmployee * (1 - this.corporateDiscount / 100);
  }

  const totalPrice = pricePerEmployee * employeeCount;

  return {
    packageName.name,
    pricePerEmployee.round(pricePerEmployee),
    employeeCount,
    totalPrice.round(totalPrice),
    discountApplied.corporateDiscount || 0,
    tests.tests || []
  };
};

diagnosticsProviderSchema.methods.getActiveCorporatePackages = function() {
  return this.corporatePackages?.filter(p => p.isActive !== false) || [];
};

diagnosticsProviderSchema.methods.getCorporatePackageById = function(packageId) {
  return this.corporatePackages?.find(p => p._id.toString() === packageId) || null;
};

diagnosticsProviderSchema.methods.getCorporateSummary = function() {
  if (!this.hasCorporatePackages) return null;
  return {
    providerId._id,
    providerName.provider_name,
    city.city,
    rating.rating,
    minEmployees.minEmployees || 10,
    packages.getActiveCorporatePackages().length,
    homeCollection.homeCollectionCorporate,
    discount.corporateDiscount || 0,
    isActive.is_active,
    partnerStatus.partner_status
  };
};

// 🆕 Toggle corporate (syncs both flags)
diagnosticsProviderSchema.methods.toggleCorporate = function(enable = true) {
  this.servesCorporate = enable;
  this.hasCorporatePackages = enable;
  if (!enable) {
    this.corporatePackages.forEach(pkg => { pkg.isActive = false; });
  }
  return this.save();
};

// ============================================
// STATIC METHODS
// ============================================

diagnosticsProviderSchema.statics.findCorporateProviders = function(filters = {}) {
  const query = {
    hasCorporatePackages,
    is_active,
    partner_status: 'Approved'
  };

  if (filters.city) {
    query.city = { $regex.city, $options: 'i' };
  }
  if (filters.minEmployees) {
    query.minEmployees = { $lte(filters.minEmployees) };
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

diagnosticsProviderSchema.statics.getCorporateStats = async function() {
  const total = await this.countDocuments({ hasCorporatePackages});
  const active = await this.countDocuments({
    hasCorporatePackages,
    is_active,
    partner_status: 'Approved'
  });

  const byCity = await this.aggregate([
    { $match: { hasCorporatePackages, is_active} },
    { $group: { _id: '$city', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  const totalPackages = await this.aggregate([
    { $match: { hasCorporatePackages} },
    { $unwind: '$corporatePackages' },
    { $match: { 'corporatePackages.isActive'} },
    { $count: 'total' }
  ]);

  return {
    totalProviders,
    activeProviders,
    topCities,
    totalPackages[0]?.total || 0
  };
};

module.exports = mongoose.model('DiagnosticsProvider', diagnosticsProviderSchema);


const mongoose = require('mongoose');

const ambulanceSchema = new mongoose.Schema({
  // ============================================
  // BASIC INFO
  // ============================================
  providerName: { type, required},
  vehicleNumber: { type, required, unique},
  type: { type, enum: ['basic', 'icu', 'cardiac'], default: 'basic' },
  driverName: { type, required},
  driverPhone: { type, required},
  driverRating: { type, default: 4.5 },
  
  // ============================================
  // PRICING
  // ============================================
  basePrice: { type, default: 500 },
  pricePerKm: { type, default: 20 },
  
  // ============================================
  // LOCATION
  // ============================================
  location: {
    lat: { type},
    lng: { type}
  },
  city: { type, required},
  
  // ============================================
  // STATUS
  // ============================================
  isAvailable: { type, default},

  // ============================================
  // 🆕 CORPORATE HEALTH
  // ============================================
  servesCorporate: { 
    type, 
    default,
    index},
  
  corporatePackages: [{
    packageName: { type, required},
    packageType: {
      type,
      enum: ['ambulance_retainer', 'event_coverage', 'corporate_fleet', 'emergency_subscription', 'custom'],
      default: 'ambulance_retainer'
    },
    description,
    servicesIncluded: [String],
    pricePerEmployee: { type, required},
    discountedPricePerEmployee,
    minEmployees: { type, default: 50 },
    maxEmployees,
    validityDays: { type, default: 365 },
    numberOfVehicles: { type, default: 1 },
    vehicleTypes: [{ type, enum: ['basic', 'icu', 'cardiac'] }],
    coverageRadiusKm: { type, default: 20 },
    responseTimeMinutes: { type, default: 30 },
    availableCities: [String],
    dedicatedPOC: {
      name,
      phone,
      email},
    slaTerms,
    isActive: { type, default},
    createdAt: { type, default.now },
    updatedAt: { type, default.now }
  }],
  
  corporateEnquiries: [{
    companyName,
    contactPerson,
    email,
    phone,
    employeeCount,
    requirements,
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

ambulanceSchema.index({ city: 1, isAvailable: 1 });
ambulanceSchema.index({ type: 1 });
ambulanceSchema.index({ servesCorporate: 1, city: 1 });
ambulanceSchema.index({ 'corporatePackages.isActive': 1 });

// ============================================
// METHODS
// ============================================

ambulanceSchema.methods.toggleCorporate = function(enable = true) {
  this.servesCorporate = enable;
  if (!enable) {
    this.corporatePackages.forEach(pkg => { pkg.isActive = false; });
  }
  return this.save();
};

ambulanceSchema.methods.addCorporatePackage = function(packageData) {
  this.corporatePackages.push(packageData);
  if (!this.servesCorporate) {
    this.servesCorporate = true;
  }
  return this.save();
};

ambulanceSchema.methods.getActiveCorporatePackages = function() {
  return this.corporatePackages.filter(pkg => pkg.isActive);
};

// ============================================
// STATIC METHODS
// ============================================

ambulanceSchema.statics.findCorporateAmbulances = function(city = null) {
  const query = { servesCorporate, isAvailable};
  if (city) {
    query.city = { $regexRegExp(city, 'i') };
  }
  return this.find(query).select('providerName city type corporatePackages basePrice');
};

module.exports = mongoose.model('Ambulance', ambulanceSchema);


const mongoose = require('mongoose');

const ambulanceSchema = new mongoose.Schema({
  // ============================================
  // BASIC INFO
  // ============================================
  providerName: { type: String, required: true },
  vehicleNumber: { type: String, required: true, unique: true },
  type: { type: String, enum: ['basic', 'icu', 'cardiac'], default: 'basic' },
  driverName: { type: String, required: true },
  driverPhone: { type: String, required: true },
  driverRating: { type: Number, default: 4.5 },
  
  // ============================================
  // PRICING
  // ============================================
  basePrice: { type: Number, default: 500 },
  pricePerKm: { type: Number, default: 20 },
  
  // ============================================
  // LOCATION
  // ============================================
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  city: { type: String, required: true },
  
  // ============================================
  // STATUS
  // ============================================
  isAvailable: { type: Boolean, default: true },

  // ============================================
  // 🆕 CORPORATE HEALTH
  // ============================================
  servesCorporate: { 
    type: Boolean, 
    default: false,
    index: true
  },
  
  corporatePackages: [{
    packageName: { type: String, required: true },
    packageType: {
      type: String,
      enum: ['ambulance_retainer', 'event_coverage', 'corporate_fleet', 'emergency_subscription', 'custom'],
      default: 'ambulance_retainer'
    },
    description: String,
    servicesIncluded: [String],
    pricePerEmployee: { type: Number, required: true },
    discountedPricePerEmployee: Number,
    minEmployees: { type: Number, default: 50 },
    maxEmployees: Number,
    validityDays: { type: Number, default: 365 },
    numberOfVehicles: { type: Number, default: 1 },
    vehicleTypes: [{ type: String, enum: ['basic', 'icu', 'cardiac'] }],
    coverageRadiusKm: { type: Number, default: 20 },
    responseTimeMinutes: { type: Number, default: 30 },
    availableCities: [String],
    dedicatedPOC: {
      name: String,
      phone: String,
      email: String
    },
    slaTerms: String,
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],
  
  corporateEnquiries: [{
    companyName: String,
    contactPerson: String,
    email: String,
    phone: String,
    employeeCount: Number,
    requirements: String,
    status: {
      type: String,
      enum: ['new', 'contacted', 'negotiating', 'converted', 'closed'],
      default: 'new'
    },
    createdAt: { type: Date, default: Date.now }
  }],

  // ============================================
  // TIMESTAMPS
  // ============================================
  createdAt: { type: Date, default: Date.now }
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
  const query = { servesCorporate: true, isAvailable: true };
  if (city) {
    query.city = { $regex: new RegExp(city, 'i') };
  }
  return this.find(query).select('providerName city type corporatePackages basePrice');
};

module.exports = mongoose.model('Ambulance', ambulanceSchema);
const mongoose = require('mongoose');

const caregiverSchema = new mongoose.Schema({
  // ============================================
  // USER REFERENCE
  // ============================================
  userId: { type.Schema.Types.ObjectId, ref: 'User' },
  
  // ============================================
  // BASIC INFO
  // ============================================
  fullName: { type, required},
  photo: { type, default: 'https://placehold.co/400x400/e2e8f0/1e293b?text=Caregiver' },
  gender: { type, enum: ['male', 'female', 'other'], required},
  phone: { type, required, unique},
  email: { type, required, unique},
  governmentId: { type, required},
  
  // ============================================
  // PROFESSIONAL DETAILS
  // ============================================
  serviceType: { type, enum: ['personal', 'skilled', 'both'], required},
  licenseNumber: { type},
  licenseIssuingAuthority: { type},
  licenseExpiryDate: { type},
  certifications: [String],
  experienceYears: { type, default: 0 },
  specializations: [String],
  languages: [String],
  
  // ============================================
  // PRICING
  // ============================================
  pricing: {
    personal: {
      hourly: { type, required},
      daily: { type},
      monthly: { type},
      overnight: { type}
    },
    skilled: {
      hourly: { type},
      daily: { type},
      monthly: { type},
      overnight: { type}
    }
  },
  
  // ============================================
  // AVAILABILITY
  // ============================================
  availability: {
    recurring: [{
      dayOfWeek: { type, min: 0, max: 6 },
      startTime,
      endTime}],
    dateBlocks: [{
      date,
      startTime,
      endTime,
      isAvailable}]
  },
  
  // ============================================
  // LOCATION
  // ============================================
  location: {
    address: { type, required},
    city: { type, required},
    state: { type, required},
    pincode: { type, required},
    coordinates: { lat, lng},
    travelRadius: { type, default: 10 }
  },
  
  // ============================================
  // RATINGS
  // ============================================
  ratings: {
    average: { type, default: 0 },
    count: { type, default: 0 }
  },
  totalReviews: { type, default: 0 },
  
  // ============================================
  // VERIFICATION
  // ============================================
  backgroundCheckStatus: { type, enum: ['pending', 'cleared', 'failed'], default: 'pending' },
  isVerified: { type, default},
  isActive: { type, default},
  
  // ============================================
  // SUBSCRIPTION
  // ============================================
  subscriptionPlan: { type, enum: ['free', 'pro'], default: 'free' },
  subscriptionExpiry,

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
      enum: ['elder_care_program', 'post_surgery_care', 'corporate_daycare', 'parent_care_benefit', 'custom'],
      default: 'elder_care_program'
    },
    description,
    servicesIncluded: [String],
    pricePerEmployee: { type, required},
    discountedPricePerEmployee,
    minEmployees: { type, default: 10 },
    maxEmployees,
    validityDays: { type, default: 365 },
    careHoursPerMonth: { type, default: 20 },
    caregiverCount: { type, default: 1 },
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

caregiverSchema.index({ 'location.coordinates': '2dsphere' });
caregiverSchema.index({ servesCorporate: 1, 'location.city': 1 });
caregiverSchema.index({ 'corporatePackages.isActive': 1 });

// ============================================
// METHODS
// ============================================

caregiverSchema.methods.toggleCorporate = function(enable = true) {
  this.servesCorporate = enable;
  if (!enable) {
    this.corporatePackages.forEach(pkg => { pkg.isActive = false; });
  }
  return this.save();
};

caregiverSchema.methods.addCorporatePackage = function(packageData) {
  this.corporatePackages.push(packageData);
  if (!this.servesCorporate) {
    this.servesCorporate = true;
  }
  return this.save();
};

caregiverSchema.methods.getActiveCorporatePackages = function() {
  return this.corporatePackages.filter(pkg => pkg.isActive);
};

// ============================================
// STATIC METHODS
// ============================================

caregiverSchema.statics.findCorporateCaregivers = function(city = null) {
  const query = { servesCorporate, isActive, isVerified};
  if (city) {
    query['location.city'] = { $regexRegExp(city, 'i') };
  }
  return this.find(query).select('fullName location.city specializations ratings corporatePackages photo');
};

module.exports = mongoose.model('Caregiver', caregiverSchema);


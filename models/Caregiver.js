const mongoose = require('mongoose');

const caregiverSchema = new mongoose.Schema({
  // ============================================
  // USER REFERENCE
  // ============================================
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // ============================================
  // BASIC INFO
  // ============================================
  fullName: { type: String, required: true },
  photo: { type: String, default: 'https://placehold.co/400x400/e2e8f0/1e293b?text=Caregiver' },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  governmentId: { type: String, required: true },
  
  // ============================================
  // PROFESSIONAL DETAILS
  // ============================================
  serviceType: { type: String, enum: ['personal', 'skilled', 'both'], required: true },
  licenseNumber: { type: String },
  licenseIssuingAuthority: { type: String },
  licenseExpiryDate: { type: Date },
  certifications: [String],
  experienceYears: { type: Number, default: 0 },
  specializations: [String],
  languages: [String],
  
  // ============================================
  // PRICING
  // ============================================
  pricing: {
    personal: {
      hourly: { type: Number, required: true },
      daily: { type: Number },
      monthly: { type: Number },
      overnight: { type: Number }
    },
    skilled: {
      hourly: { type: Number },
      daily: { type: Number },
      monthly: { type: Number },
      overnight: { type: Number }
    }
  },
  
  // ============================================
  // AVAILABILITY
  // ============================================
  availability: {
    recurring: [{
      dayOfWeek: { type: Number, min: 0, max: 6 },
      startTime: String,
      endTime: String
    }],
    dateBlocks: [{
      date: Date,
      startTime: String,
      endTime: String,
      isAvailable: Boolean
    }]
  },
  
  // ============================================
  // LOCATION
  // ============================================
  location: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    coordinates: { lat: Number, lng: Number },
    travelRadius: { type: Number, default: 10 }
  },
  
  // ============================================
  // RATINGS
  // ============================================
  ratings: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  totalReviews: { type: Number, default: 0 },
  
  // ============================================
  // VERIFICATION
  // ============================================
  backgroundCheckStatus: { type: String, enum: ['pending', 'cleared', 'failed'], default: 'pending' },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  
  // ============================================
  // SUBSCRIPTION
  // ============================================
  subscriptionPlan: { type: String, enum: ['free', 'pro'], default: 'free' },
  subscriptionExpiry: Date,

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
      enum: ['elder_care_program', 'post_surgery_care', 'corporate_daycare', 'parent_care_benefit', 'custom'],
      default: 'elder_care_program'
    },
    description: String,
    servicesIncluded: [String],
    pricePerEmployee: { type: Number, required: true },
    discountedPricePerEmployee: Number,
    minEmployees: { type: Number, default: 10 },
    maxEmployees: Number,
    validityDays: { type: Number, default: 365 },
    careHoursPerMonth: { type: Number, default: 20 },
    caregiverCount: { type: Number, default: 1 },
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
  const query = { servesCorporate: true, isActive: true, isVerified: true };
  if (city) {
    query['location.city'] = { $regex: new RegExp(city, 'i') };
  }
  return this.find(query).select('fullName location.city specializations ratings corporatePackages photo');
};

module.exports = mongoose.model('Caregiver', caregiverSchema);
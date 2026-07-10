const mongoose = require('mongoose');

const homeopathyDoctorSchema = new mongoose.Schema({
  // ============================================
  // BASIC INFO
  // ============================================
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String },
  password: { type: String },
  
  // ============================================
  // PROFESSIONAL DETAILS
  // ============================================
  specialization: { 
    type: String, 
    enum: [
      'Classical Homeopathy', 
      'Clinical Homeopathy', 
      'Naturopathy', 
      'Yoga & Naturopathy', 
      'Diet Therapy', 
      'Acupuncture', 
      'Biochemic Medicine', 
      'Bach Flower Therapy'
    ], 
    required: true 
  },
  experience: { type: Number, required: true },
  education: { type: String },
  about: { type: String },
  
  registrationNumber: { type: String, required: true, unique: true },
  registrationCouncil: { type: String },
  
  languages: [String],
  consultationFee: { type: Number, required: true },
  
  // ============================================
  // LOCATION
  // ============================================
  address: {
    street: String, 
    area: String,
    city: { type: String, required: true },
    state: String, 
    pincode: String,
    coordinates: { lat: Number, lng: Number }
  },
  
  clinicName: { type: String },
  
  // ============================================
  // CONSULTATION TYPES
  // ============================================
  consultationTypes: { 
    online: { type: Boolean, default: true }, 
    clinic: { type: Boolean, default: true } 
  },
  
  // ============================================
  // RATINGS & REVIEWS
  // ============================================
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  reviews: [{ 
    patient: String, 
    patientName: String, 
    rating: Number, 
    review: String, 
    createdAt: { type: Date, default: Date.now } 
  }],
  
  // ============================================
  // VERIFICATION
  // ============================================
  verificationStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  isActive: { type: Boolean, default: false },
  verifiedBy: String, 
  verifiedAt: Date, 
  rejectionReason: String,
  
  // ============================================
  // DOCUMENTS
  // ============================================
  documents: { 
    degreeCertificate: String, 
    registrationCertificate: String, 
    idProof: String, 
    photo: String 
  },
  
  // ============================================
  // AVAILABILITY
  // ============================================
  availability: [{ 
    day: String, 
    slots: [{ startTime: String, endTime: String }] 
  }],
  
  // ============================================
  // STATISTICS
  // ============================================
  stats: { 
    totalConsultations: { type: Number, default: 0 }, 
    totalEarnings: { type: Number, default: 0 } 
  },
  
  // ============================================
  // BANK DETAILS
  // ============================================
  bankDetails: { 
    accountHolder: String, 
    accountNumber: String, 
    ifscCode: String, 
    bankName: String, 
    upiId: String 
  },

  // ============================================
  // ✅ CORPORATE WELLNESS (ORIGINAL - KEPT)
  // ============================================
  offersCorporateWellness: {
    type: Boolean,
    default: false
  },
  minEmployees: {
    type: Number,
    default: 10
  },
  corporateWellnessPackages: [{
    name: { type: String, required: true },
    description: { type: String },
    pricePerEmployee: { type: Number, required: true },
    duration: { 
      type: String, 
      enum: ['1-day', '3-day', '5-day', '7-day', '14-day', '21-day', 'monthly'],
      default: '1-day'
    },
    sessions: { type: Number, default: 1 },
    includes: [{ type: String }],
    benefits: [{ type: String }],
    therapies: [{ type: String }],
    category: {
      type: String,
      enum: ['stress_management', 'detox', 'immunity_boost', 'sleep_health', 'weight_management', 'general_wellness', 'homeopathy_consultation']
    },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  }],
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
  corporateDiscount: {
    type: Number,
    default: 15,
    min: 0,
    max: 50
  },
  corporateServices: [{
    name: { type: String },
    description: { type: String },
    price: { type: Number },
    duration: { type: String },
    category: { type: String }
  }],
  corporateWorkshops: [{
    name: { type: String },
    description: { type: String },
    duration: { type: String, default: '2 hours' },
    maxParticipants: { type: Number, default: 20 },
    price: { type: Number },
    topics: [{ type: String }],
    isActive: { type: Boolean, default: true }
  }],
  corporateSettings: {
    allowGroupSessions: { type: Boolean, default: true },
    dedicatedWellnessCoach: { type: Boolean, default: false },
    coachName: { type: String },
    coachPhone: { type: String },
    coachEmail: { type: String },
    reportDeliveryTime: { type: String, default: '48 hours' },
    corporateVisitAvailable: { type: Boolean, default: false }
  },
  corporateAnalytics: {
    totalCorporateBookings: { type: Number, default: 0 },
    totalCorporateRevenue: { type: Number, default: 0 },
    corporateClients: [{ type: String }]
  },

  // ============================================
  // 🆕 STANDARDIZED CORPORATE FIELDS (ADDED)
  // ============================================
  servesCorporate: { 
    type: Boolean, 
    default: false,
    index: true
  },
  
  corporateEnquiries: [{
    companyName: String,
    contactPerson: String,
    email: String,
    phone: String,
    employeeCount: Number,
    requirements: String,
    interestedIn: [String],
    status: {
      type: String,
      enum: ['new', 'contacted', 'negotiating', 'converted', 'closed'],
      default: 'new'
    },
    createdAt: { type: Date, default: Date.now }
  }],

  createdAt: { type: Date, default: Date.now }
});

// ============================================
// INDEXES
// ============================================

homeopathyDoctorSchema.index({ phone: 1 });
homeopathyDoctorSchema.index({ registrationNumber: 1 });
homeopathyDoctorSchema.index({ offersCorporateWellness: 1 });
homeopathyDoctorSchema.index({ minEmployees: 1 });
homeopathyDoctorSchema.index({ specialization: 1 });
homeopathyDoctorSchema.index({ 'corporateWellnessPackages.isActive': 1 });

// 🆕 New indexes
homeopathyDoctorSchema.index({ servesCorporate: 1, 'address.city': 1 });

// ============================================
// VIRTUALS
// ============================================

homeopathyDoctorSchema.virtual('hasCorporateWellness').get(function() {
  return this.offersCorporateWellness === true;
});

homeopathyDoctorSchema.virtual('corporatePackageCount').get(function() {
  return this.corporateWellnessPackages?.filter(p => p.isActive !== false).length || 0;
});

homeopathyDoctorSchema.virtual('corporateDiscountPercentage').get(function() {
  return this.corporateDiscount || 15;
});

homeopathyDoctorSchema.virtual('isCorporateReady').get(function() {
  return this.isActive && 
         this.verificationStatus === 'approved' && 
         this.offersCorporateWellness === true;
});

// ============================================
// MIDDLEWARE
// ============================================

// Sync servesCorporate with offersCorporateWellness
homeopathyDoctorSchema.pre('save', function(next) {
  if (this.isModified('offersCorporateWellness')) {
    this.servesCorporate = this.offersCorporateWellness;
  }
  if (this.isModified('servesCorporate') && !this.isModified('offersCorporateWellness')) {
    this.offersCorporateWellness = this.servesCorporate;
  }
  next();
});

// ============================================
// METHODS
// ============================================

homeopathyDoctorSchema.methods.calculateCorporatePrice = function(employeeCount, packageId, options = {}) {
  const packageItem = this.corporateWellnessPackages.find(p => p._id.toString() === packageId);
  if (!packageItem) throw new Error('Corporate wellness package not found');

  let pricePerEmployee = packageItem.pricePerEmployee || this.corporatePricing?.basePricePerEmployee || 1000;

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
    packageName: packageItem.name,
    pricePerEmployee: Math.round(pricePerEmployee),
    employeeCount,
    totalPrice: Math.round(totalPrice),
    discountApplied: this.corporateDiscount || 0,
    duration: packageItem.duration,
    sessions: packageItem.sessions
  };
};

homeopathyDoctorSchema.methods.getActiveCorporatePackages = function() {
  return this.corporateWellnessPackages?.filter(p => p.isActive !== false) || [];
};

homeopathyDoctorSchema.methods.getActiveCorporateWorkshops = function() {
  return this.corporateWorkshops?.filter(w => w.isActive !== false) || [];
};

homeopathyDoctorSchema.methods.getCorporateSummary = function() {
  if (!this.offersCorporateWellness) return null;
  return {
    doctorId: this._id,
    name: this.name,
    city: this.address?.city,
    rating: this.rating,
    minEmployees: this.minEmployees || 10,
    packages: this.getActiveCorporatePackages().length,
    workshops: this.getActiveCorporateWorkshops().length,
    discount: this.corporateDiscount || 0,
    isActive: this.isActive,
    verificationStatus: this.verificationStatus
  };
};

// 🆕 Toggle corporate (syncs both flags)
homeopathyDoctorSchema.methods.toggleCorporate = function(enable = true) {
  this.servesCorporate = enable;
  this.offersCorporateWellness = enable;
  if (!enable) {
    this.corporateWellnessPackages.forEach(pkg => { pkg.isActive = false; });
    this.corporateWorkshops.forEach(w => { w.isActive = false; });
  }
  return this.save();
};

// ============================================
// STATIC METHODS
// ============================================

homeopathyDoctorSchema.statics.findCorporateDoctors = function(filters = {}) {
  const query = {
    offersCorporateWellness: true,
    isActive: true,
    verificationStatus: 'approved'
  };

  if (filters.city) {
    query['address.city'] = { $regex: filters.city, $options: 'i' };
  }
  if (filters.specialization) {
    query.specialization = filters.specialization;
  }
  if (filters.minEmployees) {
    query.minEmployees = { $lte: parseInt(filters.minEmployees) };
  }
  if (filters.minRating) {
    query.rating = { $gte: parseFloat(filters.minRating) };
  }

  return this.find(query)
    .sort({ rating: -1 })
    .select('name rating address city specialization corporateWellnessPackages corporateDiscount');
};

homeopathyDoctorSchema.statics.getCorporateStats = async function() {
  const total = await this.countDocuments({ offersCorporateWellness: true });
  const active = await this.countDocuments({
    offersCorporateWellness: true,
    isActive: true,
    verificationStatus: 'approved'
  });

  const bySpecialization = await this.aggregate([
    { $match: { offersCorporateWellness: true, isActive: true } },
    { $group: { _id: '$specialization', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  const totalPackages = await this.aggregate([
    { $match: { offersCorporateWellness: true } },
    { $unwind: '$corporateWellnessPackages' },
    { $match: { 'corporateWellnessPackages.isActive': true } },
    { $count: 'total' }
  ]);

  return {
    totalDoctors: total,
    activeDoctors: active,
    bySpecialization,
    totalPackages: totalPackages[0]?.total || 0
  };
};

module.exports = mongoose.model('HomeopathyDoctor', homeopathyDoctorSchema);
const mongoose = require('mongoose');

const homeopathyDoctorSchema = new mongoose.Schema({
  // ============================================
  // BASIC INFO
  // ============================================
  name: { type, required},
  phone: { type, required, unique},
  email: { type},
  password: { type},
  
  // ============================================
  // PROFESSIONAL DETAILS
  // ============================================
  specialization: { 
    type, 
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
    required},
  experience: { type, required},
  education: { type},
  about: { type},
  
  registrationNumber: { type, required, unique},
  registrationCouncil: { type},
  
  languages: [String],
  consultationFee: { type, required},
  
  // ============================================
  // LOCATION
  // ============================================
  address: {
    street, 
    area,
    city: { type, required},
    state, 
    pincode,
    coordinates: { lat, lng}
  },
  
  clinicName: { type},
  
  // ============================================
  // CONSULTATION TYPES
  // ============================================
  consultationTypes: { 
    online: { type, default}, 
    clinic: { type, default} 
  },
  
  // ============================================
  // RATINGS & REVIEWS
  // ============================================
  rating: { type, default: 0 },
  totalReviews: { type, default: 0 },
  reviews: [{ 
    patient, 
    patientName, 
    rating, 
    review, 
    createdAt: { type, default.now } 
  }],
  
  // ============================================
  // VERIFICATION
  // ============================================
  verificationStatus: { 
    type, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  isActive: { type, default},
  verifiedBy, 
  verifiedAt, 
  rejectionReason,
  
  // ============================================
  // DOCUMENTS
  // ============================================
  documents: { 
    degreeCertificate, 
    registrationCertificate, 
    idProof, 
    photo},
  
  // ============================================
  // AVAILABILITY
  // ============================================
  availability: [{ 
    day, 
    slots: [{ startTime, endTime}] 
  }],
  
  // ============================================
  // STATISTICS
  // ============================================
  stats: { 
    totalConsultations: { type, default: 0 }, 
    totalEarnings: { type, default: 0 } 
  },
  
  // ============================================
  // BANK DETAILS
  // ============================================
  bankDetails: { 
    accountHolder, 
    accountNumber, 
    ifscCode, 
    bankName, 
    upiId},

  // ============================================
  // ✅ CORPORATE WELLNESS (ORIGINAL - KEPT)
  // ============================================
  offersCorporateWellness: {
    type,
    default},
  minEmployees: {
    type,
    default: 10
  },
  corporateWellnessPackages: [{
    name: { type, required},
    description: { type},
    pricePerEmployee: { type, required},
    duration: { 
      type, 
      enum: ['1-day', '3-day', '5-day', '7-day', '14-day', '21-day', 'monthly'],
      default: '1-day'
    },
    sessions: { type, default: 1 },
    includes: [{ type}],
    benefits: [{ type}],
    therapies: [{ type}],
    category: {
      type,
      enum: ['stress_management', 'detox', 'immunity_boost', 'sleep_health', 'weight_management', 'general_wellness', 'homeopathy_consultation']
    },
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
  corporateServices: [{
    name: { type},
    description: { type},
    price: { type},
    duration: { type},
    category: { type}
  }],
  corporateWorkshops: [{
    name: { type},
    description: { type},
    duration: { type, default: '2 hours' },
    maxParticipants: { type, default: 20 },
    price: { type},
    topics: [{ type}],
    isActive: { type, default}
  }],
  corporateSettings: {
    allowGroupSessions: { type, default},
    dedicatedWellnessCoach: { type, default},
    coachName: { type},
    coachPhone: { type},
    coachEmail: { type},
    reportDeliveryTime: { type, default: '48 hours' },
    corporateVisitAvailable: { type, default}
  },
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

  createdAt: { type, default.now }
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
    packageName.name,
    pricePerEmployee.round(pricePerEmployee),
    employeeCount,
    totalPrice.round(totalPrice),
    discountApplied.corporateDiscount || 0,
    duration.duration,
    sessions.sessions
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
    doctorId._id,
    name.name,
    city.address?.city,
    rating.rating,
    minEmployees.minEmployees || 10,
    packages.getActiveCorporatePackages().length,
    workshops.getActiveCorporateWorkshops().length,
    discount.corporateDiscount || 0,
    isActive.isActive,
    verificationStatus.verificationStatus
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
    offersCorporateWellness,
    isActive,
    verificationStatus: 'approved'
  };

  if (filters.city) {
    query['address.city'] = { $regex.city, $options: 'i' };
  }
  if (filters.specialization) {
    query.specialization = filters.specialization;
  }
  if (filters.minEmployees) {
    query.minEmployees = { $lte(filters.minEmployees) };
  }
  if (filters.minRating) {
    query.rating = { $gte(filters.minRating) };
  }

  return this.find(query)
    .sort({ rating: -1 })
    .select('name rating address city specialization corporateWellnessPackages corporateDiscount');
};

homeopathyDoctorSchema.statics.getCorporateStats = async function() {
  const total = await this.countDocuments({ offersCorporateWellness});
  const active = await this.countDocuments({
    offersCorporateWellness,
    isActive,
    verificationStatus: 'approved'
  });

  const bySpecialization = await this.aggregate([
    { $match: { offersCorporateWellness, isActive} },
    { $group: { _id: '$specialization', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  const totalPackages = await this.aggregate([
    { $match: { offersCorporateWellness} },
    { $unwind: '$corporateWellnessPackages' },
    { $match: { 'corporateWellnessPackages.isActive'} },
    { $count: 'total' }
  ]);

  return {
    totalDoctors,
    activeDoctors,
    bySpecialization,
    totalPackages[0]?.total || 0
  };
};

module.exports = mongoose.model('HomeopathyDoctor', homeopathyDoctorSchema);


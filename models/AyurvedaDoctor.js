const mongoose = require('mongoose');

const ayurvedaDoctorSchema = new mongoose.Schema({
  // ============================================
  // BASIC INFO
  // ============================================
  name: { type, required},
  email: { type, unique, sparse},
  phone: { type, required, unique},
  password: { type},
  
  // ============================================
  // PROFESSIONAL DETAILS
  // ============================================
  specialization: { 
    type, 
    enum: [
      'Panchakarma', 'General Ayurveda', 'Kerala Ayurveda', 
      'Ayurvedic Dermatology', 'Kayachikitsa', 'Rasayana Therapy',
      'Shalya Tantra', 'Shalakya Tantra', 'Prasuti & Stri Roga',
      'Bal Roga', 'Swasthavritta'
    ],
    required},
  experience: { type, required},
  education: { type, required},
  about: { type, maxlength: 1000 },
  languages: [{ type}],
  
  // ============================================
  // CONSULTATION
  // ============================================
  consultationFee: { type, required},
  consultationTypes: {
    online: { type, default},
    clinic: { type, default},
    homeVisit: { type, default}
  },
  
  // ============================================
  // LOCATION
  // ============================================
  address: {
    street,
    area,
    city: { type, required},
    state: { type, required},
    pincode,
    coordinates: {
      lat,
      lng}
  },
  
  // ============================================
  // WELLNESS CENTER / CLINIC INFO
  // ============================================
  wellnessCenter: {
    name: { type, required},
    type: { type, enum: ['Own Clinic', 'Hospital Attached', 'Wellness Center', 'Franchise'], default: 'Own Clinic' },
    address,
    facilities: [String],
    photos: [String],
    established,
    bedCount,
    panchakarmaRooms},
  
  // ============================================
  // KYC & VERIFICATION DOCUMENTS
  // ============================================
  documents: {
    ayushCertificate: { type, required},
    degreeCertificate: { type},
    idProof: { type, required},
    photo: { type},
    clinicLicense: { type},
    panCard: { type}
  },
  
  // ============================================
  // AYUSH REGISTRATION
  // ============================================
  ayushRegNo: { type, required, unique},
  ayushRegYear,
  
  // ============================================
  // VERIFICATION & APPROVAL STATUS
  // ============================================
  verificationStatus: {
    type,
    enum: ['pending', 'documents_verified', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  verifiedBy: { type.Schema.Types.ObjectId, ref: 'Admin' },
  verifiedAt,
  rejectionReason,
  isActive: { type, default},
  
  // ============================================
  // RATINGS & REVIEWS
  // ============================================
  rating: { type, default: 0 },
  totalReviews: { type, default: 0 },
  reviews: [{
    patient: { type.Schema.Types.ObjectId, ref: 'Patient' },
    patientName,
    rating: { type, min: 1, max: 5 },
    review,
    treatment,
    consultationType,
    createdAt: { type, default.now },
    verified: { type, default},
    adminApproved: { type, default}
  }],
  
  // ============================================
  // AVAILABILITY SLOTS
  // ============================================
  availability: [{
    day: { 
      type, 
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] 
    },
    slots: [{
      startTime,
      endTime,
      maxBookings: { type, default: 5 },
      currentBookings: { type, default: 0 }
    }]
  }],
  
  // ============================================
  // COMMISSION & SUBSCRIPTION
  // ============================================
  subscription: {
    plan: { type, enum: ['free', 'basic', 'premium', 'enterprise'], default: 'free' },
    startDate,
    endDate,
    commissionRate: {
      firstConsult: { type, default: 15 },
      repeatConsult: { type, default: 5 },
      package: { type, default: 20 }
    }
  },
  
  // ============================================
  // STATISTICS
  // ============================================
  stats: {
    totalConsultations: { type, default: 0 },
    totalEarnings: { type, default: 0 },
    platformCommissionPaid: { type, default: 0 },
    repeatPatients: { type, default: 0 }
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
  // DISCOUNTS
  // ============================================
  discounts: [{
    code,
    percentage,
    maxAmount,
    validFrom,
    validTill,
    isActive: { type, default},
    usageLimit,
    usedCount: { type, default: 0 }
  }],

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
      enum: ['stress_management', 'detox', 'panchakarma', 'immunity_boost', 'sleep_health', 'weight_management', 'general_wellness']
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

  // ============================================
  // TIMESTAMPS
  // ============================================
  createdAt: { type, default.now },
  updatedAt: { type, default.now }
});

// ============================================
// INDEXES
// ============================================

ayurvedaDoctorSchema.index({ 'address.city': 1 });
ayurvedaDoctorSchema.index({ specialization: 1 });
ayurvedaDoctorSchema.index({ rating: -1 });
ayurvedaDoctorSchema.index({ verificationStatus: 1 });
ayurvedaDoctorSchema.index({ name: 'text', specialization: 'text', 'address.city': 'text' });
ayurvedaDoctorSchema.index({ offersCorporateWellness: 1 });
ayurvedaDoctorSchema.index({ minEmployees: 1 });
ayurvedaDoctorSchema.index({ 'corporateWellnessPackages.isActive': 1 });

// 🆕 New indexes
ayurvedaDoctorSchema.index({ servesCorporate: 1, 'address.city': 1 });

// ============================================
// VIRTUALS
// ============================================

ayurvedaDoctorSchema.virtual('hasCorporateWellness').get(function() {
  return this.offersCorporateWellness === true;
});

ayurvedaDoctorSchema.virtual('corporatePackageCount').get(function() {
  return this.corporateWellnessPackages?.filter(p => p.isActive !== false).length || 0;
});

ayurvedaDoctorSchema.virtual('corporateDiscountPercentage').get(function() {
  return this.corporateDiscount || 15;
});

ayurvedaDoctorSchema.virtual('isCorporateReady').get(function() {
  return this.isActive && 
         this.verificationStatus === 'approved' && 
         this.offersCorporateWellness === true;
});

// ============================================
// MIDDLEWARE
// ============================================

// Sync servesCorporate with offersCorporateWellness
ayurvedaDoctorSchema.pre('save', function(next) {
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

ayurvedaDoctorSchema.methods.calculateCorporatePrice = function(employeeCount, packageId, options = {}) {
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

ayurvedaDoctorSchema.methods.getActiveCorporatePackages = function() {
  return this.corporateWellnessPackages?.filter(p => p.isActive !== false) || [];
};

ayurvedaDoctorSchema.methods.getActiveCorporateWorkshops = function() {
  return this.corporateWorkshops?.filter(w => w.isActive !== false) || [];
};

ayurvedaDoctorSchema.methods.getCorporateSummary = function() {
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
ayurvedaDoctorSchema.methods.toggleCorporate = function(enable = true) {
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

ayurvedaDoctorSchema.statics.findCorporateDoctors = function(filters = {}) {
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

ayurvedaDoctorSchema.statics.getCorporateStats = async function() {
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

module.exports = mongoose.model('AyurvedaDoctor', ayurvedaDoctorSchema);


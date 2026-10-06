// D:\hospital backend\models\HomeopathyDoctor.js
const mongoose = require('mongoose');

const homeopathyDoctorSchema = new mongoose.Schema({
  // ============================================
  // IDENTITY
  // ============================================
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String },
  password: { type: String },

    specialization: {
    type: String,
    enum: [
      'Classical Homeopathy',
      'Clinical Homeopathy',
      'Pediatric Homeopathy',
      "Women's Homeopathy",
      'Homeopathy for Skin',
      'Homeopathy for Hair',
      'Constitutional Homeopathy',
      'Acute Homeopathy',
      'Homeopathy for Allergies',
      'Homeopathy for Digestion',
      'Homeopathy for Respiratory',
      'Homeopathy for Joint & Arthritis',
      'Naturopathy',
      'Yoga & Naturopathy',
      'Diet Therapy',
      'Acupuncture'
    ],
    required: true
  },
  specializations: [{
    type: String,
    enum: [
      'Classical Homeopathy',
      'Clinical Homeopathy',
      'Pediatric Homeopathy',
      "Women's Homeopathy",
      'Homeopathy for Skin',
      'Homeopathy for Hair',
      'Constitutional Homeopathy',
      'Acute Homeopathy',
      'Homeopathy for Allergies',
      'Homeopathy for Digestion',
      'Homeopathy for Respiratory',
      'Homeopathy for Joint & Arthritis',
      'Naturopathy',
      'Yoga & Naturopathy',
      'Diet Therapy',
      'Acupuncture'
    ]
  }],
  experience: { type: Number, required: true },
  education: { type: String },
  about: { type: String },

  registrationNumber: { type: String, required: true, unique: true },
  registrationCouncil: { type: String },

  languages: [String],
  consultationFee: { type: Number, required: true },

  // ============================================
  // ADDRESS
  // ============================================
  address: {
    street: String,
    area: String,
    city: { type: String, required: true },
    state: String,
    pincode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },

  clinicName: { type: String },

  // ============================================
  // CONSULTATION MODES
  // ============================================
  consultationTypes: {
    online: { type: Boolean, default: true },
    clinic: { type: Boolean, default: true }
  },

  // ============================================
  // 🆕 LIVE AVAILABILITY STATUS (parity with AyurvedaDoctor)
  // ============================================
  isAvailable: {
    type: Boolean,
    default: false,
    description: 'Whether doctor is currently accepting consultations'
  },
  currentStatus: {
    type: String,
    enum: ['online', 'offline', 'in_clinic'],
    default: 'offline',
    description: 'Real-time availability state for "available now" listings'
  },
  currentConsultationMode: {
    type: String,
    enum: ['video', 'clinic', 'both'],
    default: 'video',
    description: 'Current mode the doctor is consulting in'
  },
  lastStatusUpdate: {
    type: Date,
    default: null,
    description: 'Timestamp of last isAvailable/currentStatus change'
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
    bookingId: { type: String, default: '' },
    verified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],

  // ============================================
  // VERIFICATION
  // ============================================
    verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  verificationHistory: [{
    action: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended', 'unsuspended'] },
    at: { type: Date, default: Date.now },
    reason: { type: String }
  }],
  suspendedReason: { type: String },
  suspendedAt: { type: Date },
  isActive: { type: Boolean, default: false },
  verifiedKyc: { type: Boolean, default: false },
  verifiedBy: String,
  verifiedAt: Date,
  rejectionReason: String,

  documents: {
    degreeCertificate: String,
    registrationCertificate: String,
    idProof: String,
    photo: String
  },

  // ============================================
  // AVAILABILITY SLOTS
  // ============================================
      availability: [{
    day: String,
    slots: [{
      startTime: String,
      endTime: String,
      maxBookings: { type: Number, default: 1 },
      currentBookings: { type: Number, default: 0 }
    }]
  }],

  // ============================================
  // STATS
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
  // CORPORATE WELLNESS FIELDS (PRESERVED)
  // ============================================
  offersCorporateWellness: {
    type: Boolean,
    default: false,
    description: 'Whether this doctor offers corporate wellness programs'
  },

  minEmployees: {
    type: Number,
    description: 'Minimum employees required for corporate wellness program'
  },

    corporateWellnessPackages: [{
    name: { type: String, required: true },
    description: { type: String },
    pricePerEmployee: { type: Number, required: true },
     approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved'
    },
    approvalHistory: [{
      action: { type: String, enum: ['pending', 'approved', 'rejected'] },
      at: { type: Date, default: Date.now },
      reason: { type: String }
    }],
    rejectionReason: { type: String },
    approvedAt: { type: Date },
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
        minEmployees: { type: Number, min: 1 },
        maxEmployees: { type: Number },
        discountPercentage: { type: Number }
      }]
    }
  },

  corporateDiscount: {
    type: Number,
    default: 15,
    min: 0,
    max: 50,
    description: 'Discount percentage for corporate wellness bookings'
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

  corporateEnquiries: [{
    companyName: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    employeeCount: { type: Number },
    message: { type: String },
    status: { type: String, enum: ['new', 'contacted', 'converted', 'closed'], default: 'new' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date }
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

// 🆕 Live-status indexes (for "available now" queries)
homeopathyDoctorSchema.index({ isAvailable: 1, currentStatus: 1 });
homeopathyDoctorSchema.index({ isAvailable: 1, currentConsultationMode: 1 });
homeopathyDoctorSchema.index({ isActive: 1, verificationStatus: 1, rating: -1 });

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

// 🆕 Live-status virtual
homeopathyDoctorSchema.virtual('isOnlineNow').get(function() {
  return this.isAvailable === true &&
         ['online', 'in_clinic'].includes(this.currentStatus);
});

// ============================================
// METHODS
// ============================================

/**
 * Calculate corporate wellness package price
 */
homeopathyDoctorSchema.methods.calculateCorporatePrice = function(
  employeeCount,
  packageId,
  options = {}
) {
  const packageItem = this.corporateWellnessPackages.find(p => p._id.toString() === packageId);
  if (!packageItem) {
    throw new Error('Corporate wellness package not found');
  }

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
  if (!this.offersCorporateWellness) {
    return null;
  }

  return {
    doctorId: this._id,
    name: this.name,
    city: this.address?.city,
    rating: this.rating,
    minEmployees: this.minEmployees || null,
    packages: this.getActiveCorporatePackages().length,
    workshops: this.getActiveCorporateWorkshops().length,
    discount: this.corporateDiscount || 0,
    isActive: this.isActive,
    verificationStatus: this.verificationStatus
  };
};

// 🆕 Toggle live availability
homeopathyDoctorSchema.methods.setAvailabilityStatus = async function(status, consultationMode) {
  if (!['online', 'offline', 'in_clinic'].includes(status)) {
    throw new Error('Invalid status. Use: online | offline | in_clinic');
  }
  this.isAvailable = status === 'online' || status === 'in_clinic';
  this.currentStatus = status;
  this.lastStatusUpdate = new Date();
  if (consultationMode) {
    this.currentConsultationMode = consultationMode;
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
    query.$or = [
      { specialization: filters.specialization },
      { specializations: filters.specialization }
    ];
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

// 🆕 Find doctors available right now
homeopathyDoctorSchema.statics.findAvailableNow = function(consultationType = 'video') {
  const query = {
    isActive: true,
    verificationStatus: 'approved',
    isAvailable: true
  };

  if (consultationType === 'video') {
    query.currentConsultationMode = { $in: ['video', 'both'] };
  } else if (consultationType === 'clinic') {
    query.currentConsultationMode = { $in: ['clinic', 'both'] };
  }

  return this.find(query)
    .select('name specialization experience rating consultationFee address.city currentStatus currentConsultationMode')
    .sort({ rating: -1 })
    .limit(20);
};

module.exports = mongoose.model('HomeopathyDoctor', homeopathyDoctorSchema);
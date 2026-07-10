const mongoose = require('mongoose');

const mentalHealthTherapistSchema = new mongoose.Schema({
  // User Reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // ============================================
  // PERSONAL INFORMATION
  // ============================================
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  profileImage: {
    type: String,
    default: ''
  },
  
  // ============================================
  // LOCATION
  // ============================================
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true
  },
  address: {
    street: String,
    pincode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  
  // ============================================
  // PROFESSIONAL DETAILS
  // ============================================
  licenseNumber: {
    type: String,
    required: [true, 'License number is required'],
    unique: true,
    trim: true
  },
  licenseCouncil: {
    type: String,
    default: ''
  },
  specializations: {
    type: [String],
    required: [true, 'At least one specialization is required'],
    default: []
  },
  experience: {
    type: Number,
    required: [true, 'Years of experience is required'],
    min: 0,
    default: 0
  },
  education: {
    type: String,
    default: ''
  },
  about: {
    type: String,
    default: ''
  },
  languages: {
    type: [String],
    default: ['English']
  },
  
  // ============================================
  // ✅ FIXED PRICING - CORRECT STRUCTURE
  // ============================================
  consultationFee: {
    type: Number,
    required: [true, 'Consultation fee is required'],
    min: 0,
    default: 500
  },
  pricing: {
    consultation: {
      type: Number,
      required: [true, 'Pricing consultation is required'],
      default: 500
    },
    videoTherapy: {
      type: Number,
      default: 500
    },
    audioTherapy: {
      type: Number,
      default: 400
    },
    textTherapy: {
      type: Number,
      default: 300
    },
    emergency: {
      type: Number,
      default: 800
    },
    packageDiscount: {
      type: Number,
      default: 10
    }
  },
  
  // ============================================
  // CONSULTATION TYPES
  // ============================================
  consultationTypes: {
    video: { type: Boolean, default: true },
    audio: { type: Boolean, default: true },
    text: { type: Boolean, default: true },
    anonymous: { type: Boolean, default: true },
    emergency: { type: Boolean, default: false }
  },
  
  // ============================================
  // AVAILABILITY
  // ============================================
  availability: {
    monday: { start: String, end: String, isAvailable: { type: Boolean, default: true } },
    tuesday: { start: String, end: String, isAvailable: { type: Boolean, default: true } },
    wednesday: { start: String, end: String, isAvailable: { type: Boolean, default: true } },
    thursday: { start: String, end: String, isAvailable: { type: Boolean, default: true } },
    friday: { start: String, end: String, isAvailable: { type: Boolean, default: true } },
    saturday: { start: String, end: String, isAvailable: { type: Boolean, default: false } },
    sunday: { start: String, end: String, isAvailable: { type: Boolean, default: false } }
  },
  
  // ============================================
  // RATINGS
  // ============================================
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  totalSessions: {
    type: Number,
    default: 0
  },
  
  // ============================================
  // VERIFICATION
  // ============================================
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  isActive: {
    type: Boolean,
    default: true
  },

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
      enum: ['employee_assistance_program', 'group_therapy', 'wellness_workshop', 'stress_management', 'crisis_support', 'custom'],
      default: 'employee_assistance_program'
    },
    description: String,
    servicesIncluded: [String],
    pricePerEmployee: { type: Number, required: true },
    discountedPricePerEmployee: Number,
    minEmployees: { type: Number, default: 10 },
    maxEmployees: Number,
    validityDays: { type: Number, default: 365 },
    sessionsPerEmployee: { type: Number, default: 4 },
    sessionDurationMinutes: { type: Number, default: 50 },
    availableCities: [String],
    dedicatedPOC: {
      name: String,
      phone: String,
      email: String
    },
    anonymityGuaranteed: { type: Boolean, default: true },
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
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// ============================================
// INDEXES
// ============================================

// 🆕 Corporate indexes
mentalHealthTherapistSchema.index({ servesCorporate: 1, city: 1 });
mentalHealthTherapistSchema.index({ 'corporatePackages.packageType': 1 });
mentalHealthTherapistSchema.index({ 'corporatePackages.isActive': 1 });

// ============================================
// VIRTUALS
// ============================================
mentalHealthTherapistSchema.virtual('fullName').get(function() {
  return this.name;
});

mentalHealthTherapistSchema.virtual('formattedFee').get(function() {
  return `₹${this.consultationFee}`;
});

// ============================================
// MIDDLEWARE - Auto-update updatedAt
// ============================================
mentalHealthTherapistSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (this.consultationFee && !this.pricing.consultation) {
    this.pricing.consultation = this.consultationFee;
  }
  if (this.pricing.consultation && !this.consultationFee) {
    this.consultationFee = this.pricing.consultation;
  }
  next();
});

// ============================================
// STATIC METHODS
// ============================================
mentalHealthTherapistSchema.statics = {
  async findBySpecialization(specialization) {
    return this.find({
      specializations: { $in: [specialization] },
      isActive: true,
      verificationStatus: 'approved'
    }).sort({ rating: -1 });
  },
  
  async findVerified(limit = 20) {
    return this.find({
      isActive: true,
      verificationStatus: 'approved'
    }).sort({ rating: -1 }).limit(limit);
  },
  
  async updateRating(therapistId) {
    const result = await this.aggregate([
      { $match: { _id: mongoose.Types.ObjectId(therapistId) } },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'therapistId',
          as: 'reviews'
        }
      },
      {
        $project: {
          avgRating: { $avg: '$reviews.rating' },
          totalReviews: { $size: '$reviews' }
        }
      }
    ]);
    
    if (result.length > 0) {
      await this.findByIdAndUpdate(therapistId, {
        rating: result[0].avgRating || 0,
        totalReviews: result[0].totalReviews || 0
      });
    }
  },

  // 🆕 Find corporate therapists
  async findCorporateTherapists(city = null) {
    const query = { servesCorporate: true, isActive: true, verificationStatus: 'approved' };
    if (city) {
      query.city = { $regex: new RegExp(city, 'i') };
    }
    return this.find(query).select('name city specializations rating corporatePackages profileImage');
  }
};

// ============================================
// INSTANCE METHODS
// ============================================
mentalHealthTherapistSchema.methods = {
  isAvailableAt(date, time) {
    const day = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const availability = this.availability[day];
    if (!availability || !availability.isAvailable) return false;
    return time >= availability.start && time <= availability.end;
  },
  
  getFee(type = 'consultation') {
    return this.pricing[type] || this.pricing.consultation || this.consultationFee || 500;
  },

  // 🆕 Corporate methods
  toggleCorporate(enable = true) {
    this.servesCorporate = enable;
    if (!enable) {
      this.corporatePackages.forEach(pkg => { pkg.isActive = false; });
    }
    return this.save();
  },

  addCorporatePackage(packageData) {
    this.corporatePackages.push(packageData);
    if (!this.servesCorporate) {
      this.servesCorporate = true;
    }
    return this.save();
  },

  getActiveCorporatePackages() {
    return this.corporatePackages.filter(pkg => pkg.isActive);
  }
};

module.exports = mongoose.model('MentalHealthTherapist', mentalHealthTherapistSchema);
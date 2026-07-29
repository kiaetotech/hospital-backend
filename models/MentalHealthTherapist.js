const mongoose = require('mongoose');

const mentalHealthTherapistSchema = new mongoose.Schema({
  // User Reference
  userId: {
    type.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // ============================================
  // PERSONAL INFORMATION
  // ============================================
  name: {
    type,
    required: [true, 'Name is required'],
    trim},
  phone: {
    type,
    required: [true, 'Phone number is required'],
    unique,
    trim},
  email: {
    type,
    required: [true, 'Email is required'],
    unique,
    lowercase,
    trim},
  password: {
    type,
    required: [true, 'Password is required'],
    minlength: 6
  },
  profileImage: {
    type,
    default: ''
  },
  
  // ============================================
  // LOCATION
  // ============================================
  city: {
    type,
    required: [true, 'City is required'],
    trim},
  state: {
    type,
    required: [true, 'State is required'],
    trim},
  address: {
    street,
    pincode,
    coordinates: {
      lat,
      lng}
  },
  
  // ============================================
  // PROFESSIONAL DETAILS
  // ============================================
  licenseNumber: {
    type,
    required: [true, 'License number is required'],
    unique,
    trim},
  licenseCouncil: {
    type,
    default: ''
  },
  specializations: {
    type: [String],
    required: [true, 'At least one specialization is required'],
    default: []
  },
  experience: {
    type,
    required: [true, 'Years of experience is required'],
    min: 0,
    default: 0
  },
  education: {
    type,
    default: ''
  },
  about: {
    type,
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
    type,
    required: [true, 'Consultation fee is required'],
    min: 0,
    default: 500
  },
  pricing: {
    consultation: {
      type,
      required: [true, 'Pricing consultation is required'],
      default: 500
    },
    videoTherapy: {
      type,
      default: 500
    },
    audioTherapy: {
      type,
      default: 400
    },
    textTherapy: {
      type,
      default: 300
    },
    emergency: {
      type,
      default: 800
    },
    packageDiscount: {
      type,
      default: 10
    }
  },
  
  // ============================================
  // CONSULTATION TYPES
  // ============================================
  consultationTypes: {
    video: { type, default},
    audio: { type, default},
    text: { type, default},
    anonymous: { type, default},
    emergency: { type, default}
  },
  
  // ============================================
  // AVAILABILITY
  // ============================================
  availability: {
    monday: { start, end, isAvailable: { type, default} },
    tuesday: { start, end, isAvailable: { type, default} },
    wednesday: { start, end, isAvailable: { type, default} },
    thursday: { start, end, isAvailable: { type, default} },
    friday: { start, end, isAvailable: { type, default} },
    saturday: { start, end, isAvailable: { type, default} },
    sunday: { start, end, isAvailable: { type, default} }
  },
  
  // ============================================
  // RATINGS
  // ============================================
  rating: {
    type,
    min: 0,
    max: 5,
    default: 0
  },
  totalReviews: {
    type,
    default: 0
  },
  totalSessions: {
    type,
    default: 0
  },
  
  // ============================================
  // VERIFICATION
  // ============================================
  verificationStatus: {
    type,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  isActive: {
    type,
    default},

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
      enum: ['employee_assistance_program', 'group_therapy', 'wellness_workshop', 'stress_management', 'crisis_support', 'custom'],
      default: 'employee_assistance_program'
    },
    description,
    servicesIncluded: [String],
    pricePerEmployee: { type, required},
    discountedPricePerEmployee,
    minEmployees: { type, default: 10 },
    maxEmployees,
    validityDays: { type, default: 365 },
    sessionsPerEmployee: { type, default: 4 },
    sessionDurationMinutes: { type, default: 50 },
    availableCities: [String],
    dedicatedPOC: {
      name,
      phone,
      email},
    anonymityGuaranteed: { type, default},
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
  createdAt: {
    type,
    default.now
  },
  updatedAt: {
    type,
    default.now
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
      isActive,
      verificationStatus: 'approved'
    }).sort({ rating: -1 });
  },
  
  async findVerified(limit = 20) {
    return this.find({
      isActive,
      verificationStatus: 'approved'
    }).sort({ rating: -1 }).limit(limit);
  },
  
  async updateRating(therapistId) {
    const result = await this.aggregate([
      { $match: { _id.Types.ObjectId(therapistId) } },
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
        rating[0].avgRating || 0,
        totalReviews[0].totalReviews || 0
      });
    }
  },

  // 🆕 Find corporate therapists
  async findCorporateTherapists(city = null) {
    const query = { servesCorporate, isActive, verificationStatus: 'approved' };
    if (city) {
      query.city = { $regexRegExp(city, 'i') };
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


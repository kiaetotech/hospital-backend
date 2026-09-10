const mongoose = require('mongoose');

const wellnessCenterSchema = new mongoose.Schema({
  // ============================================
  // BASIC INFO
  // ============================================
  name: { type: String, required: true, index: true },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  type: { 
    type: String, 
    enum: ['Hospital', 'Wellness Center', 'Retreat', 'Clinic', 'Panchakarma Center'],
    default: 'Wellness Center' 
  },
  description: { type: String, maxlength: 2000 },
  established: { type: Number },
  tagline: { type: String, maxlength: 200 },
  
  // ============================================
  // LOCATION
  // ============================================
  address: {
    street: String,
    area: String,
    city: { type: String, required: true, index: true },
    state: { type: String, required: true },
    pincode: String,
    coordinates: { lat: Number, lng: Number }
  },
  
  distanceFromAirport: Number,      // km
  distanceFromRailway: Number,      // km
  nearestAirport: String,
  nearestRailway: String,
  googleMapsUrl: String,
  
  // ============================================
  // FACILITIES & INFRASTRUCTURE
  // ============================================
  bedCount: { type: Number, default: 0 },
  panchakarmaRooms: { type: Number, default: 0 },
  doctorCount: { type: Number, default: 0 },
  staffCount: { type: Number, default: 0 },
  facilities: [String],
  photos: [String],
  coverPhoto: String,
  videos: [String],
  
  // ============================================
  // ROOM TYPES (For accommodation selection)
  // ============================================
  roomTypes: [{
    name: { type: String, required: true },        // "Deluxe Single", "Standard Twin"
    type: { 
      type: String, 
      enum: ['Single', 'Double', 'Twin Sharing', 'Suite', 'Deluxe', 'Standard'],
      default: 'Standard'
    },
    pricePerNight: { type: Number, required: true },
    capacity: { type: Number, default: 1 },
    totalRooms: { type: Number, default: 1 },
    amenities: [String],
    photos: [String],
    description: String,
    isActive: { type: Boolean, default: true }
  }],
  
  // ============================================
  // MEAL OPTIONS
  // ============================================
  mealOptions: [{
    type: { type: String },                          // "Vegetarian", "Sattvic", "Custom"
    description: String,
    included: { type: Boolean, default: true },
    pricePerDay: Number
  }],
  dietaryAccommodations: [String],                   // "Gluten-free", "Vegan", "Diabetic"
  
  // ============================================
  // ASSOCIATED DOCTORS
  // ============================================
  doctors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AyurvedaDoctor' }],
  
  // ============================================
  // PACKAGES
  // ============================================
  packages: [{
    name: { type: String, required: true },
    duration: { type: Number, required: true },      // days
    price: { type: Number, required: true },
    discountPrice: Number,
    description: String,
    shortDescription: String,
    
    // Therapies & inclusions
    therapies: [String],
    inclusions: [String],
    exclusions: [String],
    
    // Program schedule (day-by-day)
    programSchedule: [{
      day: Number,
      title: String,
      description: String,
      therapies: [String]
    }],
    
    // What's included flags (for comparison)
    includesConsultation: { type: Boolean, default: true },
    includesAccommodation: { type: Boolean, default: false },
    includesMeals: { type: Boolean, default: false },
    includesMedicines: { type: Boolean, default: false },
    includesYoga: { type: Boolean, default: false },
    includesAirportTransfer: { type: Boolean, default: false },
    includesFollowUp: { type: Boolean, default: false },
    includesDiagnostics: { type: Boolean, default: false },
    
    // Capacity & availability
    maxCapacity: { type: Number, default: 10 },
    currentBookings: { type: Number, default: 0 },
    availableDates: [Date],
    blockedDates: [Date],
    
    // Room options for this package
    availableRoomTypes: [String],
    
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false }
  }],
  
  // ============================================
  // POLICIES
  // ============================================
  policies: {
    cancellation: {
      freeUntilDays: { type: Number, default: 7 },       // days before booking
      partialRefundUntilDays: { type: Number, default: 3 },
      partialRefundPercent: { type: Number, default: 50 },
      noRefundAfterDays: { type: Number, default: 2 }
    },
    deposit: {
      required: { type: Boolean, default: false },
      percent: { type: Number, default: 25 }
    },
    checkInTime: { type: String, default: '14:00' },
    checkOutTime: { type: String, default: '11:00' },
    companionPolicy: String,
    medicalEligibility: [String],
    ageRestrictions: String
  },
  
  // ============================================
  // ACCREDITATIONS & CERTIFICATIONS
  // ============================================
  accreditations: [{
    name: String,                                      // "AYUSH", "NABH", "ISO"
    number: String,
    issuedBy: String,
    validUntil: Date,
    verified: { type: Boolean, default: false },
    verifiedAt: Date,
    documentUrl: String
  }],
  
  // ============================================
  // VERIFICATION DOCUMENTS
  // ============================================
  documents: {
    license: String,
    registration: String,
    panCard: String,
    gstCertificate: String,
    photos: [String]
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'documents_verified', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  verifiedAt: Date,
  rejectionReason: String,
  isActive: { type: Boolean, default: false },
  
  // ============================================
  // RATINGS & REVIEWS (Enhanced)
  // ============================================
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  ratingBreakdown: {
    treatment: { type: Number, default: 0 },
    accommodation: { type: Number, default: 0 },
    food: { type: Number, default: 0 },
    staff: { type: Number, default: 0 }
  },
  reviews: [{
    patient: String,
    patientName: String,
    patientPhoto: String,
    rating: { type: Number, min: 1, max: 5 },
    treatmentRating: Number,
    accommodationRating: Number,
    foodRating: Number,
    staffRating: Number,
    review: String,
    packageName: String,
    bookingId: String,
    verified: { type: Boolean, default: false },
    photos: [String],
    adminApproved: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    providerResponse: {
      text: String,
      respondedAt: Date,
      respondedBy: String
    }
  }],
  
  // ============================================
  // BUSINESS
  // ============================================
  commissionRate: { type: Number, default: 20 },
  bankDetails: {
    accountHolder: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    upiId: String
  },
  stats: {
    totalBookings: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    platformCommissionPaid: { type: Number, default: 0 },
    pendingPayout: { type: Number, default: 0 }
  },
  
  // ============================================
  // DISCOUNTS
  // ============================================
  discounts: [{
    code: String,
    percentage: Number,
    maxAmount: Number,
    validFrom: Date,
    validTill: Date,
    isActive: { type: Boolean, default: true },
    usageLimit: Number,
    usedCount: { type: Number, default: 0 }
  }],
  
  // ============================================
  // CONTACT (For enquiries)
  // ============================================
  contact: {
    primaryPhone: String,
    secondaryPhone: String,
    whatsapp: String,
    email: String,
    website: String
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ============================================
// INDEXES
// ============================================
wellnessCenterSchema.index({ 'address.city': 1 });
wellnessCenterSchema.index({ verificationStatus: 1 });
wellnessCenterSchema.index({ rating: -1 });
wellnessCenterSchema.index({ isActive: 1, verificationStatus: 1 });
wellnessCenterSchema.index({ name: 'text', description: 'text', 'address.city': 'text' });
wellnessCenterSchema.index({ 'packages.therapies': 1 });
wellnessCenterSchema.index({ established: 1 });

// ============================================
// VIRTUALS
// ============================================
wellnessCenterSchema.virtual('isVerified').get(function() {
  return this.verificationStatus === 'approved';
});

wellnessCenterSchema.virtual('yearsOperating').get(function() {
  if (!this.established) return null;
  return new Date().getFullYear() - this.established;
});

wellnessCenterSchema.virtual('minPackagePrice').get(function() {
  const prices = (this.packages || [])
    .filter(p => p.isActive !== false)
    .map(p => p.discountPrice || p.price)
    .filter(Boolean);
  return prices.length ? Math.min(...prices) : 0;
});

wellnessCenterSchema.virtual('activePackagesCount').get(function() {
  return (this.packages || []).filter(p => p.isActive !== false).length;
});

module.exports = mongoose.model('WellnessCenter', wellnessCenterSchema);
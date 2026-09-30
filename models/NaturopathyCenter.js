// D:\hospital backend\models\NaturopathyCenter.js
const mongoose = require('mongoose');

const naturopathyCenterSchema = new mongoose.Schema({
  // ============================================
  // IDENTITY
  // ============================================
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String },
  password: { type: String },

  type: {
    type: String,
    enum: ['Naturopathy Center', 'Yoga Retreat', 'Wellness Resort', 'Diet Clinic'],
    default: 'Naturopathy Center'
  },
  description: String,
  tagline: { type: String, default: '' },
  established: { type: Number, default: null },

  // ============================================
  // MEDIA
  // ============================================
  coverPhoto: { type: String, default: '' },
  photos: [{ type: String }],

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

  // ============================================
  // LOCATION / DIRECTIONS
  // ============================================
  googleMapsUrl: { type: String, default: '' },
  nearestAirport: { type: String, default: '' },
  distanceFromAirport: { type: Number, default: null },
  nearestRailway: { type: String, default: '' },
  distanceFromRailway: { type: Number, default: null },

  // ============================================
  // FACILITIES & CAPACITY
  // ============================================
  facilities: [String],
  bedCount: Number,
  therapyRooms: { type: Number, default: 0 },
  doctorCount: { type: Number, default: 0 },

  // ============================================
  // DOCTORS ASSOCIATED WITH THE CENTER
  // ============================================
  doctors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'HomeopathyDoctor' }],

  // ============================================
  // ACCREDITATIONS (AYUSH, ISO, etc.)
  // ============================================
  accreditations: [{
    name: { type: String, required: true },
    number: { type: String, default: '' },
    issuedBy: { type: String, default: '' },
    verified: { type: Boolean, default: false }
  }],

  // ============================================
  // POLICIES
  // ============================================
  policies: {
    cancellation: {
      freeUntilDays: { type: Number, default: 7 },
      partialRefundUntilDays: { type: Number, default: 3 },
      partialRefundPercent: { type: Number, default: 50 },
      noRefundAfterDays: { type: Number, default: 2 }
    },
    checkInTime: { type: String, default: '14:00' },
    checkOutTime: { type: String, default: '11:00' },
    medicalEligibility: [{ type: String }],
    companionPolicy: { type: String, default: '' }
  },

  // ============================================
  // PACKAGES
  // ============================================
  packages: [{
    name: { type: String, required: true },
    description: { type: String },
    shortDescription: { type: String, default: '' },
    duration: { type: Number },              // days
    price: { type: Number, required: true },
    discountPrice: { type: Number, default: null },
    therapies: [{ type: String }],
    inclusions: [{ type: String }],
    exclusions: [{ type: String }],
    isActive: { type: Boolean, default: true },

    // Inclusion flags (used by listing card icons)
    includesConsultation: { type: Boolean, default: false },
    includesAccommodation: { type: Boolean, default: false },
    includesMeals: { type: Boolean, default: false },
    includesMedicines: { type: Boolean, default: false },
    includesYoga: { type: Boolean, default: false },
    includesAirportTransfer: { type: Boolean, default: false },
    includesFollowUp: { type: Boolean, default: false },

    // Day-by-day program schedule
    programSchedule: [{
      day: { type: Number },
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      therapies: [{ type: String }]
    }],

    // Capacity tracking
    currentBookings: { type: Number, default: 0 },
    maxCapacity: { type: Number, default: 5 },

    // Admin approval workflow
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    submittedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: String, default: null },
    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: String, default: null },
    rejectionReason: { type: String, default: '' },
    approvalNotes: { type: String, default: '' },

    deleted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],

    // ============================================
  // ROOM TYPES (accommodation for multi-day programs)
  // ============================================
    roomTypes: [{
    name: { type: String, required: true },
    type: { type: String, default: 'Standard' },   // Standard / Deluxe / Suite / etc.
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    pricePerNight: { type: Number, default: null }, // alias for compatibility
    maxOccupancy: { type: Number, default: 1 },
    capacity: { type: Number, default: null },      // alias for compatibility
    amenities: [{ type: String }],
    photos: [{ type: String }],
    totalRooms: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  }],

  // ============================================
  // RATINGS & REVIEWS
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
    patient: { type: String },
    patientName: { type: String },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String },
    packageName: { type: String, default: '' },
    verified: { type: Boolean, default: false },
    adminApproved: { type: Boolean, default: true },
    providerResponse: {
      text: { type: String, default: '' },
      respondedAt: { type: Date }
    },
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
  verifiedKyc: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null },

  documents: {
    license: String,
    registration: String,
    photos: [String]
  },

  // ============================================
  // BANK DETAILS
  // ============================================
  bankDetails: {
    accountHolder: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    upiId: { type: String, default: '' }
  },

    // ============================================
  // STATS
  // ============================================
  stats: {
    totalBookings: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 }
  },

  // ============================================
  // CONTACT (extended)
  // ============================================
  contact: {
    primaryPhone: { type: String, default: '' },
    secondaryPhone: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' }
  },

  // ============================================
  // STAFF & DIETARY
  // ============================================
  staffCount: { type: Number, default: 0 },
  dietaryAccommodations: [{ type: String }],

  createdAt: { type: Date, default: Date.now }
});

// ============================================
// INDEXES
// ============================================
naturopathyCenterSchema.index({ phone: 1 });
naturopathyCenterSchema.index({ isActive: 1, verificationStatus: 1 });
naturopathyCenterSchema.index({ 'packages.approvalStatus': 1 });
naturopathyCenterSchema.index({ 'address.city': 1 });

// ============================================
// VIRTUALS
// ============================================
naturopathyCenterSchema.virtual('activePackageCount').get(function() {
  return (this.packages || []).filter(
    p => p.isActive !== false && p.approvalStatus === 'approved' && !p.deleted
  ).length;
});

// ============================================
// METHODS
// ============================================
naturopathyCenterSchema.methods.getApprovedPackages = function() {
  return (this.packages || []).filter(
    p => p.isActive !== false && p.approvalStatus === 'approved' && !p.deleted
  );
};

naturopathyCenterSchema.methods.hasCapacity = function(packageId) {
  const pkg = (this.packages || []).find(p => p._id.toString() === packageId);
  if (!pkg) return false;
  return (pkg.currentBookings || 0) < (pkg.maxCapacity || 5);
};

module.exports = mongoose.model('NaturopathyCenter', naturopathyCenterSchema);
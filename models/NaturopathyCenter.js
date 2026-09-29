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

  facilities: [String],
  bedCount: Number,

  // ============================================
  // 🆕 PACKAGES (extended with approval + capacity + inclusions)
  // ============================================
  packages: [{
    name: { type: String, required: true },
    description: { type: String },
    duration: { type: Number },              // days
    price: { type: Number, required: true },
    discountPrice: { type: Number, default: null },
    therapies: [{ type: String }],
    inclusions: [{ type: String }],
    isActive: { type: Boolean, default: true },

    // 🆕 Capacity tracking
    currentBookings: { type: Number, default: 0 },
    maxCapacity: { type: Number, default: 5 },

    // 🆕 Admin approval workflow
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

    // Soft delete
    deleted: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now }
  }],

  // ============================================
  // RATINGS & REVIEWS
  // ============================================
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  reviews: [{
    patient: { type: String },
    patientName: { type: String },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String },
    packageName: { type: String, default: '' },
    adminApproved: { type: Boolean, default: true },
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
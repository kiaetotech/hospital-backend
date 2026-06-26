const mongoose = require('mongoose');

const onlineDoctorSchema = new mongoose.Schema({
  // Basic Info
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // Professional Details
  specialization: { type: String, required: true, index: true },
  subSpecialization: String,
  qualification: { type: String, required: true },
  experience: { type: Number, default: 0 },
  languages: [{ type: String }],
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  about: { type: String, maxlength: 1000 },
  
  // Registration
  registrationNumber: { type: String, required: true },
  medicalCouncil: { type: String, default: 'MCI' },
  registrationYear: Number,
  
  // Consultation Settings
  consultationFee: { type: Number, required: true },
  consultationDuration: { type: Number, default: 15 },
  consultationModes: {
    video: { type: Boolean, default: true },
    audio: { type: Boolean, default: true }
  },
  
  // Availability
  availability: [{
    day: { 
      type: String, 
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] 
    },
    isAvailable: { type: Boolean, default: false },
    slots: [{
      startTime: { type: String },
      endTime: { type: String },
      maxBookings: { type: Number, default: 5 },
      currentBookings: { type: Number, default: 0 }
    }]
  }],
  
  blockedDates: [{ date: Date, reason: String }],
  isAvailable: { type: Boolean, default: true },
  
  // Documents
  documents: {
    registrationCert: String,
    degreeCert: String,
    idProof: String,
    photo: String,
    panCard: String
  },
  
  // Verification
  verificationStatus: {
    type: String,
    enum: ['pending', 'documents_uploaded', 'verified', 'rejected', 'suspended'],
    default: 'pending'
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  verifiedAt: Date,
  rejectionReason: String,
  isActive: { type: Boolean, default: false },
  
  // Ratings
  ratingSummary: {
    averageRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 }
  },
  
  // Statistics
  stats: {
    totalConsultations: { type: Number, default: 0 },
    completedConsultations: { type: Number, default: 0 },
    cancelledConsultations: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    platformCommissionPaid: { type: Number, default: 0 }
  },
  
  // Commission
  commissionSlab: {
    type: String,
    enum: ['default', 'silver', 'gold', 'platinum', 'diamond'],
    default: 'default'
  },
  commissionPercentage: { type: Number, default: 25 },
  
  // Bank Details
  bankDetails: {
    accountHolder: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    branchName: String,
    upiId: String
  },
  
  // Profile
  profilePhoto: String,
  
  // Hospital Affiliation (optional mention)
  hospitalAffiliation: {
    mentioned: { type: Boolean, default: false },
    hospitalName: String,
    city: String
  },
  
  // Timestamps
  lastLoginAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
  
}, { timestamps: true });

// Indexes
onlineDoctorSchema.index({ specialization: 1, isActive: 1 });
onlineDoctorSchema.index({ verificationStatus: 1 });
onlineDoctorSchema.index({ 'ratingSummary.averageRating': -1 });
onlineDoctorSchema.index({ consultationFee: 1 });
onlineDoctorSchema.index({ name: 'text', specialization: 'text' });

// Virtual: Full title
onlineDoctorSchema.virtual('fullTitle').get(function() {
  return `Dr. ${this.name} - ${this.specialization}`;
});

// Method: Update commission slab based on performance
onlineDoctorSchema.methods.updateCommissionSlab = function() {
  const consults = this.stats?.completedConsultations || 0;
  const rating = this.ratingSummary?.averageRating || 0;
  
  if (consults >= 1000 && rating >= 4.9) {
    this.commissionSlab = 'diamond';
    this.commissionPercentage = 12;
  } else if (consults >= 500 && rating >= 4.8) {
    this.commissionSlab = 'platinum';
    this.commissionPercentage = 15;
  } else if (consults >= 200 && rating >= 4.5) {
    this.commissionSlab = 'gold';
    this.commissionPercentage = 20;
  } else if (consults >= 50 && rating >= 4.2) {
    this.commissionSlab = 'silver';
    this.commissionPercentage = 22;
  } else {
    this.commissionSlab = 'default';
    this.commissionPercentage = 25;
  }
  
  return this.commissionPercentage;
};

module.exports = mongoose.model('OnlineDoctor', onlineDoctorSchema);
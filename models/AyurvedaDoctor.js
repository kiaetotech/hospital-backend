const mongoose = require('mongoose');

const ayurvedaDoctorSchema = new mongoose.Schema({
  // Basic Info
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String }, // Hashed password for doctor login
  
  // Professional Details
  specialization: { 
    type: String, 
    enum: [
      'Panchakarma', 'General Ayurveda', 'Kerala Ayurveda', 
      'Ayurvedic Dermatology', 'Kayachikitsa', 'Rasayana Therapy',
      'Shalya Tantra', 'Shalakya Tantra', 'Prasuti & Stri Roga',
      'Bal Roga', 'Swasthavritta'
    ],
    required: true 
  },
  experience: { type: Number, required: true },
  education: { type: String, required: true },
  about: { type: String, maxlength: 1000 },
  languages: [{ type: String }],
  
  // Consultation
  consultationFee: { type: Number, required: true },
  consultationTypes: {
    online: { type: Boolean, default: true },
    clinic: { type: Boolean, default: true },
    homeVisit: { type: Boolean, default: false }
  },
  
  // Location
  address: {
    street: String,
    area: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  
  // Wellness Center / Clinic Info
  wellnessCenter: {
    name: { type: String, required: true },
    type: { type: String, enum: ['Own Clinic', 'Hospital Attached', 'Wellness Center', 'Franchise'], default: 'Own Clinic' },
    address: String,
    facilities: [String],
    photos: [String],
    established: Number,
    bedCount: Number,
    panchakarmaRooms: Number
  },
  
  // KYC & Verification Documents
  documents: {
    ayushCertificate: { type: String, required: true }, // URL to uploaded file
    degreeCertificate: { type: String },
    idProof: { type: String, required: true }, // Aadhar/PAN
    photo: { type: String },
    clinicLicense: { type: String },
    panCard: { type: String }
  },
  
  // AYUSH Registration
  ayushRegNo: { type: String, required: true, unique: true },
  ayushRegYear: Number,
  
  // Verification & Approval Status
  verificationStatus: {
    type: String,
    enum: ['pending', 'documents_verified', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  verifiedAt: Date,
  rejectionReason: String,
  isActive: { type: Boolean, default: false },
  
  // Ratings & Reviews
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  reviews: [{
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    patientName: String,
    rating: { type: Number, min: 1, max: 5 },
    review: String,
    treatment: String,
    consultationType: String,
    createdAt: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false }, // Admin verifies review
    adminApproved: { type: Boolean, default: false }
  }],
  
  // Availability Slots
  availability: [{
    day: { 
      type: String, 
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] 
    },
    slots: [{
      startTime: String,
      endTime: String,
      maxBookings: { type: Number, default: 5 },
      currentBookings: { type: Number, default: 0 }
    }]
  }],
  
  // Commission & Subscription
  subscription: {
    plan: { type: String, enum: ['free', 'basic', 'premium', 'enterprise'], default: 'free' },
    startDate: Date,
    endDate: Date,
    commissionRate: {
      firstConsult: { type: Number, default: 15 }, // 15%
      repeatConsult: { type: Number, default: 5 }, // 5%
      package: { type: Number, default: 20 } // 20% for Panchakarma packages
    }
  },
  
  // Statistics
  stats: {
    totalConsultations: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    platformCommissionPaid: { type: Number, default: 0 },
    repeatPatients: { type: Number, default: 0 }
  },
  
  // Bank Details for Payouts
  bankDetails: {
    accountHolder: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    upiId: String
  },
  
  // Discounts offered by doctor
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
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for search
ayurvedaDoctorSchema.index({ 'address.city': 1 });
ayurvedaDoctorSchema.index({ specialization: 1 });
ayurvedaDoctorSchema.index({ rating: -1 });
ayurvedaDoctorSchema.index({ verificationStatus: 1 });
ayurvedaDoctorSchema.index({ name: 'text', specialization: 'text', 'address.city': 'text' });

module.exports = mongoose.model('AyurvedaDoctor', ayurvedaDoctorSchema);
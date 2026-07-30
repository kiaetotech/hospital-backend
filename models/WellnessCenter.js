const mongoose = require('mongoose');

const wellnessCenterSchema = new mongoose.Schema({
  // Basic Info
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // Center Type
  type: { 
    type: String, 
    enum: ['Hospital', 'Wellness Center', 'Retreat', 'Clinic', 'Panchakarma Center'],
    default: 'Wellness Center' 
  },
  description: { type: String, maxlength: 2000 },
  established: { type: Number },
  
  // Location
  address: {
    street: String,
    area: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: String,
    coordinates: { lat: Number, lng: Number }
  },
  
  // Facilities
  bedCount: { type: Number },
  panchakarmaRooms: { type: Number },
  doctorCount: { type: Number },
  staffCount: { type: Number },
  facilities: [String],
  photos: [String],
  nearestAirport: String,
  
  // Associated Doctors
  doctors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AyurvedaDoctor' }],
  
  // Packages
  packages: [{
    name: { type: String, required: true },
    duration: { type: Number, required: true },
    price: { type: Number, required: true },
    discountPrice: Number,
    description: String,
    therapies: [String],
    inclusions: [String],
    maxCapacity: { type: Number, default: 10 },
    currentBookings: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  }],
  
  // Verification
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
  
  // Ratings
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  reviews: [{
    patient: String,
    patientName: String,
    rating: { type: Number, min: 1, max: 5 },
    review: String,
    packageName: String,
    createdAt: { type: Date, default: Date.now }
  }],
  
  // Commission
  commissionRate: { type: Number, default: 20 },
  
  // Bank Details
  bankDetails: {
    accountHolder: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    upiId: String
  },
  
  // Statistics
  stats: {
    totalBookings: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    platformCommissionPaid: { type: Number, default: 0 },
    pendingPayout: { type: Number, default: 0 }
  },
  
  // Discounts offered by center
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

wellnessCenterSchema.index({ 'address.city': 1 });
wellnessCenterSchema.index({ verificationStatus: 1 });
wellnessCenterSchema.index({ rating: -1 });

module.exports = mongoose.model('WellnessCenter', wellnessCenterSchema);
const mongoose = require('mongoose');

const panchakarmaCenterSchema = new mongoose.Schema({
  // Basic Info
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, required: true, unique: true },
  password: String,
  
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
  
  // Center Details
  type: { type: String, enum: ['Hospital', 'Wellness Center', 'Retreat', 'Clinic'], default: 'Wellness Center' },
  description: { type: String, maxlength: 2000 },
  established: Number,
  bedCount: Number,
  panchakarmaRooms: Number,
  doctorCount: Number,
  staffCount: Number,
  
  // Facilities
  facilities: [String],
  photos: [String],
  
  // Doctors associated
  doctors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AyurvedaDoctor' }],
  
  // Packages
  packages: [{
    name: { type: String, required: true },
    duration: { type: Number, required: true }, // Days
    price: { type: Number, required: true },
    discountPrice: Number,
    description: String,
    therapies: [String],
    inclusions: [String], // Food, Stay, etc.
    maxCapacity: { type: Number, default: 10 },
    currentBookings: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  }],
  
  // Verification
  documents: {
    license: { type: String, required: true },
    registration: { type: String, required: true },
    panCard: String,
    gstCertificate: String,
    photos: [String]
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  verifiedAt: Date,
  isActive: { type: Boolean, default: false },
  
  // Ratings
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  reviews: [{
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    patientName: String,
    rating: Number,
    review: String,
    packageName: String,
    createdAt: { type: Date, default: Date.now },
    adminApproved: { type: Boolean, default: false }
  }],
  
  // Commission
  commissionRate: { type: Number, default: 20 }, // 20%
  
  // Bank Details
  bankDetails: {
    accountHolder: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    upiId: String
  },
  
  // Discounts
  discounts: [{
    code: String,
    percentage: Number,
    maxAmount: Number,
    validFrom: Date,
    validTill: Date,
    isActive: Boolean
  }],
  
  nearestAirport: String,
  distanceFromAirport: Number,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

panchakarmaCenterSchema.index({ 'address.city': 1 });
panchakarmaCenterSchema.index({ rating: -1 });
panchakarmaCenterSchema.index({ name: 'text', 'address.city': 'text' });

module.exports = mongoose.model('PanchakarmaCenter', panchakarmaCenterSchema);
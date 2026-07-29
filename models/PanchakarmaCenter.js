const mongoose = require('mongoose');

const panchakarmaCenterSchema = new mongoose.Schema({
  // Basic Info
  name: { type, required},
  email: { type, unique, sparse},
  phone: { type, required, unique},
  password,
  
  // Location
  address: {
    street,
    area,
    city: { type, required},
    state: { type, required},
    pincode,
    coordinates: {
      lat,
      lng}
  },
  
  // Center Details
  type: { type, enum: ['Hospital', 'Wellness Center', 'Retreat', 'Clinic'], default: 'Wellness Center' },
  description: { type, maxlength: 2000 },
  established,
  bedCount,
  panchakarmaRooms,
  doctorCount,
  staffCount,
  
  // Facilities
  facilities: [String],
  photos: [String],
  
  // Doctors associated
  doctors: [{ type.Schema.Types.ObjectId, ref: 'AyurvedaDoctor' }],
  
  // Packages
  packages: [{
    name: { type, required},
    duration: { type, required}, // Days
    price: { type, required},
    discountPrice,
    description,
    therapies: [String],
    inclusions: [String], // Food, Stay, etc.
    maxCapacity: { type, default: 10 },
    currentBookings: { type, default: 0 },
    isActive: { type, default}
  }],
  
  // Verification
  documents: {
    license: { type, required},
    registration: { type, required},
    panCard,
    gstCertificate,
    photos: [String]
  },
  verificationStatus: {
    type,
    enum: ['pending', 'verified', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  verifiedBy: { type.Schema.Types.ObjectId, ref: 'Admin' },
  verifiedAt,
  isActive: { type, default},
  
  // Ratings
  rating: { type, default: 0 },
  totalReviews: { type, default: 0 },
  reviews: [{
    patient: { type.Schema.Types.ObjectId, ref: 'Patient' },
    patientName,
    rating,
    review,
    packageName,
    createdAt: { type, default.now },
    adminApproved: { type, default}
  }],
  
  // Commission
  commissionRate: { type, default: 20 }, // 20%
  
  // Bank Details
  bankDetails: {
    accountHolder,
    accountNumber,
    ifscCode,
    bankName,
    upiId},
  
  // Discounts
  discounts: [{
    code,
    percentage,
    maxAmount,
    validFrom,
    validTill,
    isActive}],
  
  nearestAirport,
  distanceFromAirport,
  
  createdAt: { type, default.now },
  updatedAt: { type, default.now }
});

panchakarmaCenterSchema.index({ 'address.city': 1 });
panchakarmaCenterSchema.index({ rating: -1 });
panchakarmaCenterSchema.index({ name: 'text', 'address.city': 'text' });

module.exports = mongoose.model('PanchakarmaCenter', panchakarmaCenterSchema);


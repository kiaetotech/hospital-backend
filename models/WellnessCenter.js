const mongoose = require('mongoose');

const wellnessCenterSchema = new mongoose.Schema({
  // Basic Info
  name: { type, required},
  email: { type, unique, sparse},
  phone: { type, required, unique},
  password: { type, required},
  
  // Center Type
  type: { 
    type, 
    enum: ['Hospital', 'Wellness Center', 'Retreat', 'Clinic', 'Panchakarma Center'],
    default: 'Wellness Center' 
  },
  description: { type, maxlength: 2000 },
  established: { type},
  
  // Location
  address: {
    street,
    area,
    city: { type, required},
    state: { type, required},
    pincode,
    coordinates: { lat, lng}
  },
  
  // Facilities
  bedCount: { type},
  panchakarmaRooms: { type},
  doctorCount: { type},
  staffCount: { type},
  facilities: [String],
  photos: [String],
  nearestAirport,
  
  // Associated Doctors
  doctors: [{ type.Schema.Types.ObjectId, ref: 'AyurvedaDoctor' }],
  
  // Packages
  packages: [{
    name: { type, required},
    duration: { type, required},
    price: { type, required},
    discountPrice,
    description,
    therapies: [String],
    inclusions: [String],
    maxCapacity: { type, default: 10 },
    currentBookings: { type, default: 0 },
    isActive: { type, default}
  }],
  
  // Verification
  documents: {
    license,
    registration,
    panCard,
    gstCertificate,
    photos: [String]
  },
  verificationStatus: {
    type,
    enum: ['pending', 'documents_verified', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  verifiedBy: { type.Schema.Types.ObjectId, ref: 'Admin' },
  verifiedAt,
  rejectionReason,
  isActive: { type, default},
  
  // Ratings
  rating: { type, default: 0 },
  totalReviews: { type, default: 0 },
  reviews: [{
    patient,
    patientName,
    rating: { type, min: 1, max: 5 },
    review,
    packageName,
    createdAt: { type, default.now }
  }],
  
  // Commission
  commissionRate: { type, default: 20 },
  
  // Bank Details
  bankDetails: {
    accountHolder,
    accountNumber,
    ifscCode,
    bankName,
    upiId},
  
  // Statistics
  stats: {
    totalBookings: { type, default: 0 },
    totalRevenue: { type, default: 0 },
    platformCommissionPaid: { type, default: 0 },
    pendingPayout: { type, default: 0 }
  },
  
  // Discounts offered by center
  discounts: [{
    code,
    percentage,
    maxAmount,
    validFrom,
    validTill,
    isActive: { type, default},
    usageLimit,
    usedCount: { type, default: 0 }
  }],
  
  createdAt: { type, default.now },
  updatedAt: { type, default.now }
});

wellnessCenterSchema.index({ 'address.city': 1 });
wellnessCenterSchema.index({ verificationStatus: 1 });
wellnessCenterSchema.index({ rating: -1 });

module.exports = mongoose.model('WellnessCenter', wellnessCenterSchema);


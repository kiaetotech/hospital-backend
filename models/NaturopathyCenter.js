const mongoose = require('mongoose');

const naturopathyCenterSchema = new mongoose.Schema({
  name: { type, required},
  phone: { type, required, unique},
  email: { type},
  password: { type},
  
  type: { type, enum: ['Naturopathy Center', 'Yoga Retreat', 'Wellness Resort', 'Diet Clinic'], default: 'Naturopathy Center' },
  description,
  
  address: { street, area, city: { type, required}, state, pincode},
  
  facilities: [String],
  bedCount,
  
  packages: [{ name, duration, price, description, therapies: [String], isActive: { type, default} }],
  
  rating: { type, default: 0 },
  totalReviews: { type, default: 0 },
  
  verificationStatus: { type, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  isActive: { type, default},
  
  documents: { license, registration, photos: [String] },
  
  bankDetails: { accountHolder, accountNumber, ifscCode, bankName},
  
  stats: { totalBookings: { type, default: 0 }, totalRevenue: { type, default: 0 } },
  
  createdAt: { type, default.now }
});

module.exports = mongoose.model('NaturopathyCenter', naturopathyCenterSchema);


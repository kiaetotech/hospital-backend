const mongoose = require('mongoose');

const naturopathyCenterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String },
  password: { type: String },
  
  type: { type: String, enum: ['Naturopathy Center', 'Yoga Retreat', 'Wellness Resort', 'Diet Clinic'], default: 'Naturopathy Center' },
  description: String,
  
  address: { street: String, area: String, city: { type: String, required: true }, state: String, pincode: String },
  
  facilities: [String],
  bedCount: Number,
  
  packages: [{ name: String, duration: Number, price: Number, description: String, therapies: [String], isActive: { type: Boolean, default: true } }],
  
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  
  verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  isActive: { type: Boolean, default: false },
  
  documents: { license: String, registration: String, photos: [String] },
  
  bankDetails: { accountHolder: String, accountNumber: String, ifscCode: String, bankName: String },
  
  stats: { totalBookings: { type: Number, default: 0 }, totalRevenue: { type: Number, default: 0 } },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NaturopathyCenter', naturopathyCenterSchema);
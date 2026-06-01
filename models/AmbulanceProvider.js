const mongoose = require('mongoose');

const ambulanceProviderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ownerName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  address: String,
  city: String,
  pincode: String,
  registrationNumber: { type: String, required: true, unique: true },
  gstNumber: String,
  documentStatus: {
    registrationCert: { type: Boolean, default: false },
    insuranceCert: { type: Boolean, default: false },
    vehiclePermit: { type: Boolean, default: false },
    driverLicense: { type: Boolean, default: false }
  },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  verifiedAt: Date,
  rating: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AmbulanceProvider', ambulanceProviderSchema);
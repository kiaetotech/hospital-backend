const mongoose = require('mongoose');

const ambulanceProviderSchema = new mongoose.Schema({
  name: { type, required},
  ownerName: { type, required},
  email: { type, required, unique},
  phone: { type, required},
  address,
  city,
  pincode,
  registrationNumber: { type, required, unique},
  gstNumber,
  documentStatus: {
    registrationCert: { type, default},
    insuranceCert: { type, default},
    vehiclePermit: { type, default},
    driverLicense: { type, default}
  },
  verificationStatus: { type, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  verifiedAt,
  rating: { type, default: 0 },
  totalRatings: { type, default: 0 },
  isActive: { type, default},
  createdAt: { type, default.now }
});

module.exports = mongoose.model('AmbulanceProvider', ambulanceProviderSchema);


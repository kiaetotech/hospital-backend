const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  providerName: { type, required, unique},
  email: { type, required, unique},
  password: { type, required},
  phone: { type},
  address: { type},
  city: { type},
  pincode: { type},
  latitude: { type},
  longitude: { type},
  rating: { type, default: 4.0 },
  isVerified: { type, default},
  isActive: { type, default},
  adminNote: { type},
  verifiedAt: { type},
  verifiedBy: { type},
  createdAt: { type, default.now },
  updatedAt: { type, default.now }
});

module.exports = mongoose.model('Provider', providerSchema);


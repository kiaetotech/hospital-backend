const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  providerName: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  city: { type: String },
  pincode: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  rating: { type: Number, default: 4.0 },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Provider', providerSchema);
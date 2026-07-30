const mongoose = require('mongoose');

const ambulanceSchema = new mongoose.Schema({
  providerName: { type: String, required: true },
  vehicleNumber: { type: String, required: true, unique: true },
  type: { type: String, enum: ['basic', 'icu', 'cardiac'], default: 'basic' },
  driverName: { type: String, required: true },
  driverPhone: { type: String, required: true },
  driverRating: { type: Number, default: 4.5 },
  basePrice: { type: Number, default: 500 },
  pricePerKm: { type: Number, default: 20 },
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  isAvailable: { type: Boolean, default: true },
  city: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ambulance', ambulanceSchema);
const mongoose = require('mongoose');

const ambulanceSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  providerName: { type: String },
  vehicleNumber: { type: String, required: true },
  type: { type: String, enum: ['basic', 'bls', 'als', 'cardiac', 'ventilator', 'neonatal', 'air', 'bike', 'mortuary', 'ptv', 'wheelchair'], default: 'basic' },
  model: { type: String },
  year: { type: String },
  equipment: [{ type: String }],
  driverName: { type: String },
  driverPhone: { type: String },
  driverLicense: { type: String },
  driverExperience: { type: String },
  driverRating: { type: Number, default: 4.5 },
  baseFare: { type: Number, default: 500 },
  perKmRate: { type: Number, default: 25 },
  nightCharge: { type: Number, default: 200 },
  waitingCharge: { type: Number, default: 100 },
  location: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 },
    updatedAt: { type: Date }
  },
  isAvailable: { type: Boolean, default: true },
  city: { type: String },
  serviceAreas: [{ type: String }],
  status: { type: String, enum: ['available', 'on_trip', 'offline', 'maintenance'], default: 'available' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ambulanceSchema.index({ city: 1, type: 1, isAvailable: 1 });
ambulanceSchema.index({ 'location': '2dsphere' });

module.exports = mongoose.model('Ambulance', ambulanceSchema);
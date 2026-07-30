const mongoose = require('mongoose');

const ambulanceVehicleSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'AmbulanceProvider', required: true },
  vehicleNumber: { type: String, required: true, unique: true },
  type: { type: String, enum: ['basic', 'icu', 'cardiac'], required: true },
  serviceType: { type: String, enum: ['emergency', 'non-emergency', 'both'], default: 'both' },
  hasAttendant: { type: Boolean, default: false },
  attendantName: String,
  attendantQualification: String,
  equipment: [String],
  basePrice: { type: Number, required: true },
  pricePerKm: { type: Number, required: true },
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  city: { type: String, required: true },
  isAvailable: { type: Boolean, default: true },
  rating: { type: Number, default: 0 },
  totalTrips: { type: Number, default: 0 },
  driverName: { type: String, required: true },
  driverPhone: { type: String, required: true },
  driverLicense: String,
  createdAt: { type: Date, default: Date.now }
});

ambulanceVehicleSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('AmbulanceVehicle', ambulanceVehicleSchema);
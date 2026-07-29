const mongoose = require('mongoose');

const ambulanceVehicleSchema = new mongoose.Schema({
  providerId: { type.Schema.Types.ObjectId, ref: 'AmbulanceProvider', required},
  vehicleNumber: { type, required, unique},
  type: { type, enum: ['basic', 'icu', 'cardiac'], required},
  serviceType: { type, enum: ['emergency', 'non-emergency', 'both'], default: 'both' },
  hasAttendant: { type, default},
  attendantName,
  attendantQualification,
  equipment: [String],
  basePrice: { type, required},
  pricePerKm: { type, required},
  location: {
    lat: { type},
    lng: { type}
  },
  city: { type, required},
  isAvailable: { type, default},
  rating: { type, default: 0 },
  totalTrips: { type, default: 0 },
  driverName: { type, required},
  driverPhone: { type, required},
  driverLicense,
  createdAt: { type, default.now }
});

ambulanceVehicleSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('AmbulanceVehicle', ambulanceVehicleSchema);


const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fullName: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  isPhoneVerified: { type: Boolean, default: false },
  serviceAddress: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    coordinates: { lat: Number, lng: Number }
  },
  emergencyContact: {
    name: { type: String, required: true },
    phone: { type: String, required: true }
  },
  patientDetails: {
    age: Number,
    gender: String,
    mobilityStatus: String,
    conditions: [String],
    requiredServiceType: { type: String, enum: ['personal', 'skilled', 'both'], required: true }
  },
  prescriptionUrl: { type: String }, // For skilled nursing
  budgetRange: {
    min: Number,
    max: Number
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Patient', patientSchema);
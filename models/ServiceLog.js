const mongoose = require('mongoose');

const serviceLogSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'CaregiverBooking', required: true },
  caregiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Caregiver', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  date: { type: Date, default: Date.now },
  notes: String,
  vitals: {
    bloodPressure: String,
    heartRate: Number,
    temperature: Number,
    oxygenLevel: Number,
    bloodSugar: Number
  },
  medicationsGiven: [{
    name: String,
    dosage: String,
    time: String
  }],
  meals: [{
    type: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
    food: String,
    intake: String // full, partial, none
  }],
  incidents: [{
    type: String,
    description: String,
    time: Date
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ServiceLog', serviceLogSchema);
const mongoose = require('mongoose');

const serviceLogSchema = new mongoose.Schema({
  bookingId: { type.Schema.Types.ObjectId, ref: 'CaregiverBooking', required},
  caregiverId: { type.Schema.Types.ObjectId, ref: 'Caregiver', required},
  patientId: { type.Schema.Types.ObjectId, ref: 'Patient', required},
  date: { type, default.now },
  notes,
  vitals: {
    bloodPressure,
    heartRate,
    temperature,
    oxygenLevel,
    bloodSugar},
  medicationsGiven: [{
    name,
    dosage,
    time}],
  meals: [{
    type: { type, enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
    food,
    intake// full, partial, none
  }],
  incidents: [{
    type,
    description,
    time}],
  createdAt: { type, default.now }
});

module.exports = mongoose.model('ServiceLog', serviceLogSchema);


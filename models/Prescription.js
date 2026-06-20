const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  prescriptionId: { type: String, unique: true, required: true },
  bookingId: { type: String, required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'AyurvedaDoctor', required: true },
  patientId: String,
  patientName: String,
  
  diagnosis: { type: String, required: true },
  prakritiType: String,
  
  medicines: [{
    name: String,
    dosage: String,
    duration: String,
    timing: String,
    anupana: String,
    instructions: String
  }],
  
  dietAdvice: String,
  lifestyleAdvice: String,
  yogaRecommendations: String,
  followUpDate: Date,
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AyurvedaDoctor' },
  createdAt: { type: Date, default: Date.now }
});

prescriptionSchema.index({ bookingId: 1 });
prescriptionSchema.index({ doctorId: 1 });

module.exports = mongoose.model('Prescription', prescriptionSchema);
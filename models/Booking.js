const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  bookingType: { type: String, enum: ['opd', 'admission', 'ambulance'], required: true },
  hospitalId: { type: String },
  hospitalName: { type: String, required: true },
  doctorName: { type: String },
  ambulanceType: { type: String },
  patientName: { type: String, required: true },
  patientPhone: { type: String, required: true },
  patientAge: { type: Number },
  bookingDate: { type: Date, default: Date.now },
  appointmentDate: { type: Date },
  timeSlot: { type: String },
  pickupAddress: { type: String },
  dropAddress: { type: String },
  originalAmount: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  paymentId: { type: String },
  status: { type: String, enum: ['confirmed', 'completed', 'cancelled'], default: 'confirmed' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);
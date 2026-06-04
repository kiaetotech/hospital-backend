const mongoose = require('mongoose');

const healthPackageBookingSchema = new mongoose.Schema({
  package_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HealthPackage', required: true },
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DiagnosticsProvider', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  booking_reference: { type: String, unique: true },
  patient_name: { type: String, required: true },
  patient_age: Number,
  patient_gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  patient_phone: { type: String, required: true },
  patient_email: String,
  appointment_date: Date,
  home_collection_requested: { type: Boolean, default: false },
  home_address: String,
  total_amount: Number,
  discount_applied: Number,
  final_amount: Number,
  payment_status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  payment_id: String,
  booking_status: { type: String, enum: ['confirmed', 'sample_collected', 'report_ready', 'completed', 'cancelled'], default: 'confirmed' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('HealthPackageBooking', healthPackageBookingSchema);
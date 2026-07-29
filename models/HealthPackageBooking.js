const mongoose = require('mongoose');

const healthPackageBookingSchema = new mongoose.Schema({
  package_id: { type.Schema.Types.ObjectId, ref: 'HealthPackage', required},
  provider_id: { type.Schema.Types.ObjectId, ref: 'DiagnosticsProvider', required},
  user_id: { type.Schema.Types.ObjectId, ref: 'User' },
  booking_reference: { type, unique},
  patient_name: { type, required},
  patient_age,
  patient_gender: { type, enum: ['Male', 'Female', 'Other'] },
  patient_phone: { type, required},
  patient_email,
  appointment_date,
  home_collection_requested: { type, default},
  home_address,
  total_amount,
  discount_applied,
  final_amount,
  payment_status: { type, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  payment_id,
  booking_status: { type, enum: ['confirmed', 'sample_collected', 'report_ready', 'completed', 'cancelled'], default: 'confirmed' },
  created_at: { type, default.now }
});

module.exports = mongoose.model('HealthPackageBooking', healthPackageBookingSchema);


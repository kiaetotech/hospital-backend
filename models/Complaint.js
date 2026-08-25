const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  complaintId: { type: String, unique: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  category: { type: String, enum: ['driver_behaviour', 'vehicle_condition', 'late_arrival', 'wrong_fare', 'overcharging', 'medical_assistance', 'unsafe_driving', 'equipment_problem', 'other'] },
  description: { type: String, required: true },
  status: { type: String, enum: ['open', 'investigating', 'resolved', 'rejected', 'escalated'], default: 'open' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  resolution: { type: String },
  resolvedAt: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Complaint', complaintSchema);
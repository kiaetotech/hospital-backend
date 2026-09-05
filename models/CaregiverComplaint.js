const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'CaregiverBooking', required: true, index: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  caregiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Caregiver', required: true, index: true },
  category: { type: String, enum: ['service_quality', 'no_show', 'late_arrival', 'billing', 'safety', 'misconduct', 'other'], required: true },
  description: { type: String, required: true, maxlength: 5000, trim: true },
  evidence: [{ type: String, maxlength: 1000 }],
  status: { type: String, enum: ['open', 'under_review', 'resolved', 'rejected'], default: 'open', index: true },
  resolution: { type: String, maxlength: 5000 },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('CaregiverComplaint', complaintSchema);

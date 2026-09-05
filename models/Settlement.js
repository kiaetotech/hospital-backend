const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
  settlementId: { type: String, unique: true, required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  providerType: { type: String, enum: ['doctor','center','hospital','ambulance','caregiver','diagnostics','insurance','corporate','lender','other'], default: 'other', index: true },
  amount: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['pending','processing','settled','failed','rejected'], default: 'pending', index: true },
  period: { type: String },
  bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
  caregiverBookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CaregiverBooking' }],
  createdAt: { type: Date, default: Date.now },
  settledAt: Date,
  transactionId: String,
  notes: String,
  rejectionReason: String,
  rejectedAt: Date
});

settlementSchema.index({ providerType: 1, status: 1, createdAt: -1 });
module.exports = mongoose.model('Settlement', settlementSchema);

const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
  settlementId: { type: String, unique: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'processing', 'settled', 'failed'], default: 'pending' },
  period: { type: String }, // e.g. '2026-08-25_week'
  bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
  createdAt: { type: Date, default: Date.now },
  settledAt: { type: Date },
  transactionId: { type: String },
  notes: { type: String }
});

module.exports = mongoose.model('Settlement', settlementSchema);
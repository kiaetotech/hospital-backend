const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  providerId: { type.Schema.Types.ObjectId, ref: 'Provider', required},
  providerName: { type, required},
  patientName: { type, required},
  patientPhone: { type, required},
  rating: { type, required, min: 1, max: 5 },
  comment: { type},
  bookingId: { type},
  isVerified: { type, default},
  createdAt: { type, default.now }
});

module.exports = mongoose.model('Review', reviewSchema);


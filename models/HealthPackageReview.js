const mongoose = require('mongoose');

const healthPackageReviewSchema = new mongoose.Schema({
  package_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HealthPackage', required: true },
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DiagnosticsProvider', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HealthPackageBooking' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  review_text: String,
  recommend: { type: Boolean, default: true },
  is_verified_purchase: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('HealthPackageReview', healthPackageReviewSchema);
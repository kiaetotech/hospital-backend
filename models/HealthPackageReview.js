const mongoose = require('mongoose');

const healthPackageReviewSchema = new mongoose.Schema({
  package_id: { type.Schema.Types.ObjectId, ref: 'HealthPackage', required},
  provider_id: { type.Schema.Types.ObjectId, ref: 'DiagnosticsProvider', required},
  user_id: { type.Schema.Types.ObjectId, ref: 'User' },
  booking_id: { type.Schema.Types.ObjectId, ref: 'HealthPackageBooking' },
  rating: { type, required, min: 1, max: 5 },
  review_text,
  recommend: { type, default},
  is_verified_purchase: { type, default},
  created_at: { type, default.now }
});

module.exports = mongoose.model('HealthPackageReview', healthPackageReviewSchema);


const mongoose = require('mongoose');

const testPricingSchema = new mongoose.Schema({
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DiagnosticsProvider', required: true },
  test_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TestMaster', required: true },
  mrp: { type: Number, required: true },
  discounted_price: { type: Number, required: true },
  discount_percentage: { type: Number },
  home_collection_available: { type: Boolean, default: false },
  home_collection_fee: { type: Number, default: 0 },
  report_time_hours: { type: Number, default: 24 },
  is_package: { type: Boolean, default: false },
  package_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HealthPackage' },
  insurance_coverage: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  price_valid_until: Date,
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TestPricing', testPricingSchema);
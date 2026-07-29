const mongoose = require('mongoose');

const testPricingSchema = new mongoose.Schema({
  provider_id: { type.Schema.Types.ObjectId, ref: 'DiagnosticsProvider', required},
  test_id: { type.Schema.Types.ObjectId, ref: 'TestMaster', required},
  mrp: { type, required},
  discounted_price: { type, required},
  discount_percentage: { type},
  home_collection_available: { type, default},
  home_collection_fee: { type, default: 0 },
  report_time_hours: { type, default: 24 },
  is_package: { type, default},
  package_id: { type.Schema.Types.ObjectId, ref: 'HealthPackage' },
  insurance_coverage: { type, default: 0 },
  is_active: { type, default},
  price_valid_until,
  updated_at: { type, default.now }
});

module.exports = mongoose.model('TestPricing', testPricingSchema);


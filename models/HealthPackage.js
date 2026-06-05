const mongoose = require('mongoose');

const healthPackageSchema = new mongoose.Schema({
  package_id: { type: Number, unique: true },
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DiagnosticsProvider', required: true },
  package_name: { type: String, required: true },
  package_type: { type: String, default: 'basic', enum: ['basic', 'executive', 'fullbody', 'women', 'men', 'senior', 'diabetes', '    
  cardiac', 'child', 'pregnancy', 'custom'] },
  package_description: String,
  tests_included_text: String,
  mrp: { type: Number, required: true },
  discounted_price: { type: Number, required: true },
  discount_percentage: { type: Number },
  home_collection_available: { type: Boolean, default: false },
  report_time_hours: { type: Number, default: 48 },
  gender: { type: String, enum: ['Male', 'Female', 'Unisex'], default: 'Unisex' },
  min_age: Number,
  max_age: Number,
  is_active: { type: Boolean, default: true },
  display_order: { type: Number, default: 0 },
  tags: String,
  is_popular: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('HealthPackage', healthPackageSchema);
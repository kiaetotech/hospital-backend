const mongoose = require('mongoose');

const healthPackageSchema = new mongoose.Schema({
  package_id: { type: Number, unique: true },
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DiagnosticsProvider', required: true },
  package_name: { type: String, required: true },
  package_slug: { type: String, unique: true },
  package_description: String,
  package_type: { 
    type: String, 
    default: 'basic',
    enum: ['basic', 'executive', 'fullbody', 'women', 'men', 'senior', 'diabetes', 'cardiac', 'child', 'pregnancy', 'custom']
  },
  tests_included_text: String,
  total_tests_count: { type: Number, default: 0 },
  total_parameters_count: { type: Number, default: 0 },
  mrp: { type: Number, required: true },
  discounted_price: { type: Number, required: true },
  discount_percentage: { type: Number, default: 0 },
  home_collection_available: { type: Boolean, default: false },
  home_collection_fee: { type: Number, default: 0 },
  report_time_hours: { type: Number, default: 48 },
  requires_fasting: { type: Boolean, default: false },
  fasting_hours: { type: Number, default: 0 },
  gender: { type: String, enum: ['Male', 'Female', 'Unisex'], default: 'Unisex' },
  min_age: { type: Number, default: 0 },
  max_age: { type: Number, default: 100 },
  is_active: { type: Boolean, default: true },
  is_approved: { type: Boolean, default: false },
  display_order: { type: Number, default: 0 },
  popularity_score: { type: Number, default: 0 },
  tags: String,
  search_keywords: String,
  city: String,
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  sample_report_url: String,
  terms_conditions: String,
  is_popular: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

healthPackageSchema.pre('save', function(next) {
  if (this.mrp && this.discounted_price) {
    this.discount_percentage = Math.round(((this.mrp - this.discounted_price) / this.mrp) * 100 * 100) / 100;
  }
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('HealthPackage', healthPackageSchema);
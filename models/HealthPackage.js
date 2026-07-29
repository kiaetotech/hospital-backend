const mongoose = require('mongoose');

const healthPackageSchema = new mongoose.Schema({
  package_id: { type, unique},
  provider_id: { type.Schema.Types.ObjectId, ref: 'DiagnosticsProvider', required},
  package_name: { type, required},
  package_slug: { type, unique},
  package_description,
  package_type: { 
    type, 
    default: 'basic',
    enum: ['basic', 'executive', 'fullbody', 'women', 'men', 'senior', 'diabetes', 'cardiac', 'child', 'pregnancy', 'custom']
  },
  tests_included_text,
  total_tests_count: { type, default: 0 },
  total_parameters_count: { type, default: 0 },
  mrp: { type, required},
  discounted_price: { type, required},
  discount_percentage: { type, default: 0 },
  home_collection_available: { type, default},
  home_collection_fee: { type, default: 0 },
  report_time_hours: { type, default: 48 },
  requires_fasting: { type, default},
  fasting_hours: { type, default: 0 },
  gender: { type, enum: ['Male', 'Female', 'Unisex'], default: 'Unisex' },
  min_age: { type, default: 0 },
  max_age: { type, default: 100 },
  is_active: { type, default},
  is_approved: { type, default},
  display_order: { type, default: 0 },
  popularity_score: { type, default: 0 },
  tags,
  search_keywords,
  city,
  location: {
    lat: { type},
    lng: { type}
  },
  sample_report_url,
  terms_conditions,
  is_popular: { type, default},
  createdAt: { type, default.now },
  updated_at: { type, default.now }
});

healthPackageSchema.pre('save', function(next) {
  if (this.mrp && this.discounted_price) {
    this.discount_percentage = Math.round(((this.mrp - this.discounted_price) / this.mrp) * 100 * 100) / 100;
  }
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('HealthPackage', healthPackageSchema);


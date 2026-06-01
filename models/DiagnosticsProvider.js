const mongoose = require('mongoose');

const diagnosticsProviderSchema = new mongoose.Schema({
  provider_id: { type: Number, unique: true },
  provider_name: { type: String, required: true },
  provider_type: { type: String, enum: ['Lab', 'Hospital', 'Both'], default: 'Lab' },
  address_line1: String,
  city: { type: String, required: true },
  state: String,
  pincode: String,
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  phone: String,
  email: String,
  rating: { type: Number, default: 0 },
  total_reviews: { type: Number, default: 0 },
  is_nabl_accredited: { type: Boolean, default: false },
  is_iso_accredited: { type: Boolean, default: false },
  is_home_collection_available: { type: Boolean, default: false },
  logo_url: String,
  popular_tests: [String],
  is_active: { type: Boolean, default: true },
  partner_status: { type: String, enum: ['Pending', 'Approved', 'Suspended'], default: 'Pending' },
  tags: [String],
  createdAt: { type: Date, default: Date.now }
});

diagnosticsProviderSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('DiagnosticsProvider', diagnosticsProviderSchema);
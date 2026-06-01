const mongoose = require('mongoose');

const providerTagSchema = new mongoose.Schema({
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DiagnosticsProvider', required: true },
  tag_name: { type: String, required: true },
  tag_category: { type: String, enum: ['Certification', 'Facility', 'Equipment', 'Specialty', 'Payment'], default: 'Facility' }
});

module.exports = mongoose.model('ProviderTag', providerTagSchema);
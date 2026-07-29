const mongoose = require('mongoose');

const providerTagSchema = new mongoose.Schema({
  provider_id: { type.Schema.Types.ObjectId, ref: 'DiagnosticsProvider', required},
  tag_name: { type, required},
  tag_category: { type, enum: ['Certification', 'Facility', 'Equipment', 'Specialty', 'Payment'], default: 'Facility' }
});

module.exports = mongoose.model('ProviderTag', providerTagSchema);


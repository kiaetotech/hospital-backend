const mongoose = require('mongoose');

const providerPriceSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  providerName: { type: String, required: true },
  testName: { type: String, required: true },
  price: { type: Number, required: true },
  discountedPrice: { type: Number },
  homeCollectionAvailable: { type: Boolean, default: false },
  reportTimeHours: { type: Number, default: 24 },
  city: { type: String, default: 'All' },
  address: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  rating: { type: Number, default: 4.0 },
  isActive: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
});

providerPriceSchema.index({ providerId: 1, testName: 1 });
providerPriceSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('ProviderPrice', providerPriceSchema);
const mongoose = require('mongoose');

const providerPriceSchema = new mongoose.Schema({
  providerName: { type: String, required: true },
  testName: { type: String, required: true },
  price: { type: Number, required: true },
  discountedPrice: { type: Number },
  homeCollectionAvailable: { type: Boolean, default: false },
  reportTimeHours: { type: Number, default: 24 },
  city: { type: String, default: 'All' },
  rating: { type: Number, default: 4.0 },
  isActive: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
});

providerPriceSchema.index({ testName: 1, providerName: 1 });

module.exports = mongoose.model('ProviderPrice', providerPriceSchema);
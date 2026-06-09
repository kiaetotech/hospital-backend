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
  rating: { type: Number, default: 4.0 },
  isActive: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
});

// Create compound index for faster queries
providerPriceSchema.index({ providerId: 1, testName: 1 });

module.exports = mongoose.model('ProviderPrice', providerPriceSchema);
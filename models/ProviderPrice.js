const mongoose = require('mongoose');

const providerPriceSchema = new mongoose.Schema({
  providerId: { type.Schema.Types.ObjectId, ref: 'Provider', required},
  providerName: { type, required},
  testName: { type, required},
  price: { type, required},
  discountedPrice: { type},
  homeCollectionAvailable: { type, default},
  reportTimeHours: { type, default: 24 },
  city: { type, default: 'All' },
  address: { type},
  latitude: { type},
  longitude: { type},
  rating: { type, default: 4.0 },
  isActive: { type, default},
  updatedAt: { type, default.now }
});

providerPriceSchema.index({ providerId: 1, testName: 1 });

module.exports = mongoose.model('ProviderPrice', providerPriceSchema);


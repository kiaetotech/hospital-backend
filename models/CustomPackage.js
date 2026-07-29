const mongoose = require('mongoose');

const customPackageSchema = new mongoose.Schema({
  packageId: { type, unique},
  packageName: { type, required},
  description: { type},
  tests: [{ 
    testName: { type, required},
    price: { type},
    category: { type}
  }],
  totalAmount: { type, default: 0 },
  discountedAmount: { type, default: 0 },
  discountPercent: { type, default: 0 },
  popular: { type, default},
  isActive: { type, default},
  createdBy: { type},
  createdAt: { type, default.now },
  updatedAt: { type, default.now }
});

customPackageSchema.pre('save', function(next) {
  if (!this.packageId) {
    this.packageId = 'PKG' + Date.now() + Math.floor(Math.random() * 1000);
  }
  next();
});

module.exports = mongoose.model('CustomPackage', customPackageSchema);


const mongoose = require('mongoose');

const customPackageSchema = new mongoose.Schema({
  packageId: { type: String, unique: true },
  packageName: { type: String, required: true },
  description: { type: String },
  tests: [{ 
    testName: { type: String, required: true },
    price: { type: Number },
    category: { type: String }
  }],
  totalAmount: { type: Number, default: 0 },
  discountedAmount: { type: Number, default: 0 },
  discountPercent: { type: Number, default: 0 },
  popular: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

customPackageSchema.pre('save', function(next) {
  if (!this.packageId) {
    this.packageId = 'PKG' + Date.now() + Math.floor(Math.random() * 1000);
  }
  next();
});

module.exports = mongoose.model('CustomPackage', customPackageSchema);
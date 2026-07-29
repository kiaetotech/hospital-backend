const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  testName: { type, required, unique},
  category: { type, required},
  subCategory: { type},
  description: { type},
  normalRange: { type},
  preparationInstructions: { type},
  isActive: { type, default},
  createdAt: { type, default.now }
});

testSchema.index({ testName: 'text' });

module.exports = mongoose.model('Test', testSchema);


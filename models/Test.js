const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  testName: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  subCategory: { type: String },
  description: { type: String },
  normalRange: { type: String },
  preparationInstructions: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

testSchema.index({ testName: 'text' });

module.exports = mongoose.model('Test', testSchema);
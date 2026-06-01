const mongoose = require('mongoose');

const labTestCategorySchema = new mongoose.Schema({
  category_code: { type: String, unique: true, required: true },
  category_name: { type: String, required: true },
  description: String,
  color: { type: String, default: '#3498db' },
  display_order: { type: Number, default: 0 },
  icon: String,
  is_active: { type: Boolean, default: true }
});

module.exports = mongoose.model('LabTestCategory', labTestCategorySchema);
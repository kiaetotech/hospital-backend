const mongoose = require('mongoose');

const labTestCategorySchema = new mongoose.Schema({
  category_code: { type, unique, required},
  category_name: { type, required},
  description,
  color: { type, default: '#3498db' },
  display_order: { type, default: 0 },
  icon,
  is_active: { type, default}
});

module.exports = mongoose.model('LabTestCategory', labTestCategorySchema);


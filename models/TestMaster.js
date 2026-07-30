const mongoose = require('mongoose');

const testMasterSchema = new mongoose.Schema({
  test_id: { type: Number, unique: true },
  test_name: { type: String, required: true },
  test_short_name: String,
  major_category: { type: String, required: true },
  major_category_name: { type: String, required: true },
  sub_category: String,
  common_or_unique: { type: String, enum: ['Common', 'Unique'], default: 'Common' },
  typical_setting: { type: String, enum: ['OPD', 'Admission', 'Both'], default: 'OPD' },
  urgency: { type: String, enum: ['Elective', 'Emergency', 'Both'], default: 'Elective' },
  search_keywords: String,
  is_active: { type: Boolean, default: true },
  requires_fasting: { type: Boolean, default: false },
  sample_type: { type: String, enum: ['Blood', 'Urine', 'Stool', 'CSF', 'Swab', 'Tissue', 'Other'], default: 'Blood' },
  turnaround_time_default_hours: { type: Number, default: 24 },
  home_collection_possible: { type: Boolean, default: true },
  sample_preparation: String,
  insurance_eligible: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TestMaster', testMasterSchema);
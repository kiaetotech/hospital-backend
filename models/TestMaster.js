const mongoose = require('mongoose');

const testMasterSchema = new mongoose.Schema({
  test_id: { type, unique},
  test_name: { type, required},
  test_short_name,
  major_category: { type, required},
  major_category_name: { type, required},
  sub_category,
  common_or_unique: { type, enum: ['Common', 'Unique'], default: 'Common' },
  typical_setting: { type, enum: ['OPD', 'Admission', 'Both'], default: 'OPD' },
  urgency: { type, enum: ['Elective', 'Emergency', 'Both'], default: 'Elective' },
  search_keywords,
  is_active: { type, default},
  requires_fasting: { type, default},
  sample_type: { type, enum: ['Blood', 'Urine', 'Stool', 'CSF', 'Swab', 'Tissue', 'Other'], default: 'Blood' },
  turnaround_time_default_hours: { type, default: 24 },
  home_collection_possible: { type, default},
  sample_preparation,
  insurance_eligible: { type, default},
  createdAt: { type, default.now }
});

module.exports = mongoose.model('TestMaster', testMasterSchema);


const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subscription_plan: { type: String, default: 'free' },
  address: {
    city: String,
    state: String,
    street: String
  },
  location: {
    lat: Number,
    lng: Number
  },
  diseases_treated: [String],
  specialties: [String],
  has24x7ER: { type: Boolean, default: false },
  beds: {
    total: Number,
    available: Number,
    icu_available: Number
  },
  pricing: {
    consultation: Number,
    icu_bed_per_day: Number,
    general_bed_per_day: Number
  },
  doctors: [{
    name: String,
    specialization: String,
    consultation_fee: Number
  }],
  insurance_accepted: [String],
  lab_tests_available: { type: Boolean, default: false },
  ambulance_available: { type: Boolean, default: false },
  ratings: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  contact: {
    phone: String,
    email: String
  }
}, { collection: 'hospitals' });

module.exports = mongoose.model('Hospital', hospitalSchema);

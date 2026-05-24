const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  name: String,
  address: {
    city: String,
    state: String,
    street: String,
    pincode: String
  },
  location: {
    lat: Number,
    lng: Number
  },
  specialties: [String],
  diseases_treated: [String],
  has24x7ER: Boolean,
  beds: {
    total: Number,
    available: Number,
    icu: Number,
    icu_available: Number,
    ventilator: Number,
    ventilator_available: Number,
    general: Number,
    general_available: Number
  },
  pricing: {
    consultation: Number,
    icu_bed_per_day: Number,
    general_bed_per_day: Number,
    ventilator_per_day: Number
  },
  insurance_accepted: [String],
  facilities: [String],
  ratings: {
    average: Number,
    count: Number
  },
  contact: {
    phone: String,
    email: String,
    emergency: String
  },
  ambulance_available: Boolean,
  ambulance_eta_minutes: Number
});

module.exports = mongoose.model('Hospital', hospitalSchema);
const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialization: { type: String, required: true },
  sub_specialization: String,
  qualification: String,
  experience: { type: String, default: '0' },
  consultation_fee: { type: Number, required: true },
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  languages: [String],
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  availability: {
    status: { 
      type: String, 
      enum: ['available', 'limited', 'full', 'leave'],
      default: 'available'
    },
    slots_available: { type: Number, default: 0 },
    next_available: String,
    days: [String],
    morning_slots: String,
    evening_slots: String,
    max_patients: { type: Number, default: 20 }
  },
  opd_room: String,
  consultation_duration: { type: Number, default: 15 },
  accepting_new_patients: { type: Boolean, default: true }
});

const reviewSchema = new mongoose.Schema({
  patientName: String,
  rating: Number,
  review: String,
  date: { type: Date, default: Date.now },
  doctorName: String,
  treatment: String,
  verified: { type: Boolean, default: false }
});

const hospitalSchema = new mongoose.Schema({
  // ============ BASIC INFO ============
  name: { type: String, required: true, index: true },
  subscription_plan: { 
    type: String, 
    enum: ['free', 'silver', 'gold', 'platinum'],
    default: 'free' 
  },
  type: {
    type: String,
    enum: ['private', 'government', 'trust', 'corporate'],
    default: 'private'
  },
  year_established: String,
  registration_number: String,
  
  // ============ LOCATION ============
  address: {
    street: String,
    city: { type: String, index: true },
    state: String,
    pincode: String,
    landmark: String
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      index: '2dsphere'
    },
    lat: Number,
    lng: Number
  },
  
  // ============ MEDICAL INFO ============
  diseases_treated: [{ type: String, index: true }],
  procedures_available: [{ type: String }],
  specialties: [{ type: String, index: true }],
  has24x7ER: { type: Boolean, default: false },
  trauma_center: { type: Boolean, default: false },
  stroke_ready: { type: Boolean, default: false },
  cardiac_emergency: { type: Boolean, default: false },
  
  // ============ ACCREDITATIONS ============
  accreditations: [{
    type: String,
    enum: ['NABH', 'JCI', 'NABL', 'ISO', 'NIC'],
    default: []
  }],
  
  // ============ BED MANAGEMENT ============
  beds: {
    total: { type: Number, default: 0 },
    available: { type: Number, default: 0 },
    occupied: { type: Number, default: 0 },
    icu_total: { type: Number, default: 0 },
    icu_available: { type: Number, default: 0 },
    ventilator_total: { type: Number, default: 0 },
    ventilator_available: { type: Number, default: 0 },
    emergency_beds: { type: Number, default: 0 },
    isolation_beds: { type: Number, default: 0 },
    
    categories: {
      general_ward: { total: Number, available: Number, price_per_day: Number },
      semi_private: { total: Number, available: Number, price_per_day: Number },
      private: { total: Number, available: Number, price_per_day: Number },
      deluxe: { total: Number, available: Number, price_per_day: Number },
      suite: { total: Number, available: Number, price_per_day: Number }
    },
    
    last_updated: { type: Date, default: Date.now },
    update_method: {
      type: String,
      enum: ['whatsapp', 'web_portal', 'mobile_app', 'api', 'excel_upload', 'manual'],
      default: 'manual'
    },
    auto_expire_at: Date
  },
  
  // ============ PRICING ============
  pricing: {
    consultation: { type: Number, default: 0 },
    consultation_discounted: Number,
    follow_up: Number,
    emergency_consultation: Number,
    
    icu_bed_per_day: { type: Number, default: 0 },
    general_bed_per_day: { type: Number, default: 0 },
    semi_private_per_day: Number,
    private_per_day: Number,
    deluxe_per_day: Number,
    suite_per_day: Number,
    
    online_booking_discount: { type: Number, default: 10 },
    first_time_discount: Number,
    
    health_packages: [{
      name: String,
      original_price: Number,
      discounted_price: Number,
      includes: [String],
      valid_till: Date
    }],
    
    offers: [{
      title: String,
      description: String,
      discount_percentage: Number,
      valid_till: Date,
      terms: String
    }]
  },
  
  // ============ DOCTORS ============
  doctors: [doctorSchema],
  
  // ============ SCHEMES & INSURANCE ============
  schemes_accepted: [{
    type: String,
    enum: [
      'ayushman', 'cghs', 'esi', 'echs', 
      'state_scheme', 'senior_citizen', 'disability',
      'pmjay', 'rsby'
    ]
  }],
  
  scheme_details: [{
    scheme_name: String,
    scheme_type: String,
    is_active: { type: Boolean, default: true },
    beds_allocated: Number,
    contact_person: String,
    contact_phone: String,
    last_updated: Date
  }],
  
  insurance_accepted: [{ type: String, index: true }],
  
  cashless_available: { type: Boolean, default: false },
  tpa_desk_available: { type: Boolean, default: false },
  reimbursement_accepted: { type: Boolean, default: true },
  
  tpa_partners: [String],
  
  // ============ FACILITIES ============
  lab_tests_available: { type: Boolean, default: false },
  lab_types: [String],
  in_house_pharmacy: { type: Boolean, default: false },
  pharmacy_24x7: { type: Boolean, default: false },
  ambulance_available: { type: Boolean, default: false },
  ambulance_count: { type: Number, default: 0 },
  
  technology: [{
    type: String,
    enum: [
      'MRI 3T', 'MRI 1.5T', 'CT 128 Slice', 'CT 64 Slice',
      'PET-CT', 'SPECT-CT', 'Cath Lab', 'Robotic Surgery',
      'Gamma Knife', 'CyberKnife', 'Lithotripsy',
      'Digital X-Ray', 'Mammography', 'DEXA Scan',
      'Ultrasound 4D', 'Echocardiography', 'EEG', 'EMG'
    ]
  }],
  
  operation_theaters: {
    total: Number,
    modular: Number,
    robotic: Boolean
  },
  
  amenities: [{
    type: String,
    enum: [
      'WiFi', 'AC Rooms', 'TV', 'Cafeteria', 'Parking',
      'Wheelchair Access', 'Prayer Room', 'ATM', 'Pharmacy',
      'Attendant Stay', 'Dietary Services', 'Laundry',
      'International Patient Services', 'Language Translator',
      'Airport Pickup', 'Currency Exchange'
    ]
  }],
  
  // ============ FACILITIES LIST (Custom) ============
  facilities: [{
    name: String,
    category: String,
    available_24x7: Boolean,
    description: String
  }],
  
  // ============ RATINGS & REVIEWS ============
  ratings: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
    breakdown: {
      doctor_communication: { type: Number, default: 0 },
      staff_behavior: { type: Number, default: 0 },
      cleanliness: { type: Number, default: 0 },
      wait_time: { type: Number, default: 0 },
      value_for_money: { type: Number, default: 0 }
    },
    avg_wait_time: { type: Number, default: 0 }
  },
  
  reviews: [reviewSchema],
  
  featured_review: {
    text: String,
    author: String,
    date: Date
  },
  
  // ============ CONTACT ============
  contact: {
    phone: String,
    alternate_phone: String,
    emergency_phone: String,
    ambulance_phone: String,
    email: String,
    website: String
  },
  
  // ============ OPERATIONAL ============
  working_hours: { type: String, default: '24x7' },
  opd_timings: {
    morning: { start: String, end: String },
    evening: { start: String, end: String }
  },
  visiting_hours: String,
  icu_visiting_hours: String,
  
  // ============ ACTIVITY & RANKING ============
  activity_score: { type: Number, default: 0 },
  last_activity: { type: Date, default: Date.now },
  
  update_frequency: {
    today: { type: Number, default: 0 },
    this_week: { type: Number, default: 0 },
    this_month: { type: Number, default: 0 }
  },
  
  // ============ MEDICAL TOURISM ============
  medical_tourism: {
    available: { type: Boolean, default: false },
    services: [String],
    languages_spoken: [String],
    visa_assistance: Boolean,
    airport_pickup: Boolean
  },
  
  // ============ PAYMENT OPTIONS ============
  payment_methods: [{
    type: String,
    enum: ['Cash', 'Credit Card', 'Debit Card', 'UPI', 'Net Banking', 'EMI']
  }],
  
  emi_available: { type: Boolean, default: false },
  emi_partners: [String],
  
  // ============ AMBULANCE FLEET ============
  ambulance_fleet: [{
    vehicle_number: String,
    type: { type: String, enum: ['basic', 'cardiac', 'ventilator', 'neonatal', 'wheelchair'] },
    driver_name: String,
    driver_phone: String,
    base_fare: Number,
    per_km: Number,
    available_24x7: { type: Boolean, default: true }
  }],
  
  // ============ DIAGNOSTICS ============
  diagnostics: {
    tests: [{
      name: String,
      category: String,
      price: Number,
      home_collection: Boolean,
      fasting_required: Boolean,
      report_time: Number,
      sample_type: String
    }]
  },
  
  // ============ USER LINKING ============
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  // ============ STATUS ============
  is_active: { type: Boolean, default: true },
  is_verified: { type: Boolean, default: false },
  verification_date: Date,
  verification_status: {
    type: String,
    enum: ['pending', 'under_review', 'verified', 'rejected'],
    default: 'pending'
  },
  verification_submitted_at: Date,
  
  // ============ DATA SOURCE ============
  data_filled_via: {
    type: String,
    enum: ['manual', 'excel_upload', 'city_template', 'api'],
    default: 'manual'
  },

  // ============ TIMESTAMPS ============
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }

}, { 
  collection: 'hospitals',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// ============ INDEXES ============

hospitalSchema.index({ 
  name: 'text', 
  specialties: 'text', 
  diseases_treated: 'text',
  'doctors.name': 'text',
  'doctors.specialization': 'text'
});

hospitalSchema.index({ 'location.coordinates': '2dsphere' });
hospitalSchema.index({ 'address.city': 1, 'ratings.average': -1 });
hospitalSchema.index({ schemes_accepted: 1, cashless_available: 1 });
hospitalSchema.index({ activity_score: -1 });
hospitalSchema.index({ diseases_treated: 1 });
hospitalSchema.index({ procedures_available: 1 });

// ============ MIDDLEWARE ============

hospitalSchema.pre('save', function(next) {
  if (this.beds && this.beds.update_method && 
      ['whatsapp', 'web_portal', 'manual'].includes(this.beds.update_method)) {
    const fourHours = 4 * 60 * 60 * 1000;
    this.beds.auto_expire_at = new Date(Date.now() + fourHours);
  }
  
  this.activity_score = calculateActivityScore(this);
  this.last_activity = new Date();
  
  next();
});

hospitalSchema.pre('save', function(next) {
  if (this.isModified('reviews')) {
    const totalRating = this.reviews.reduce((sum, r) => sum + r.rating, 0);
    this.ratings.count = this.reviews.length;
    this.ratings.average = this.reviews.length > 0 ? 
      (totalRating / this.reviews.length).toFixed(1) : 0;
  }
  next();
});

// ============ METHODS ============

hospitalSchema.methods.getAvailableDoctors = function(specialization = null) {
  let doctors = this.doctors.filter(d => 
    d.availability.status !== 'leave' && d.accepting_new_patients
  );
  
  if (specialization) {
    doctors = doctors.filter(d => 
      d.specialization.toLowerCase().includes(specialization.toLowerCase())
    );
  }
  
  return doctors;
};

hospitalSchema.methods.getBedStatusBadge = function() {
  const hours = (Date.now() - new Date(this.beds.last_updated).getTime()) / (1000 * 60 * 60);
  
  if (hours < 1) return { text: 'Live Updated', color: 'green', icon: '🟢' };
  if (hours < 4) return { text: 'Updated Recently', color: 'yellow', icon: '🟡' };
  if (hours < 12) return { text: 'Updated Today', color: 'orange', icon: '🟠' };
  return { text: 'May not be current', color: 'red', icon: '🔴' };
};

// ============ HELPER ============

function calculateActivityScore(hospital) {
  const now = new Date();
  const lastBedUpdate = hospital.beds?.last_updated;
  
  if (!lastBedUpdate) return 0;
  
  const hoursSinceUpdate = (now - new Date(lastBedUpdate)) / (1000 * 60 * 60);
  
  let score = 100;
  
  if (hoursSinceUpdate > 24) score -= 60;
  else if (hoursSinceUpdate > 12) score -= 40;
  else if (hoursSinceUpdate > 4) score -= 20;
  else if (hoursSinceUpdate > 2) score -= 10;
  
  if (hospital.doctors?.length > 0) score += 10;
  if (hospital.schemes_accepted?.length > 0) score += 5;
  if (hospital.insurance_accepted?.length > 0) score += 5;
  if (hospital.accreditations?.length > 0) score += 5;
  if (hospital.technology?.length > 0) score += 5;
  if (hospital.diseases_treated?.length > 0) score += 5;
  if (hospital.procedures_available?.length > 0) score += 5;
  
  return Math.max(0, Math.min(100, score));
}

module.exports = mongoose.model('Hospital', hospitalSchema);
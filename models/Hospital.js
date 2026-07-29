const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  name: { type, required},
  specialization: { type, required},
  sub_specialization,
  qualification,
  experience: { type, default: '0' },
  consultation_fee: { type, required},
  rating: { type, default: 0 },
  reviewCount: { type, default: 0 },
  languages: [String],
  gender: { type, enum: ['Male', 'Female', 'Other'] },
  availability: {
    status: { 
      type, 
      enum: ['available', 'limited', 'full', 'leave'],
      default: 'available'
    },
    slots_available: { type, default: 0 },
    next_available,
    days: [String],
    morning_slots,
    evening_slots,
    max_patients: { type, default: 20 }
  },
  opd_room,
  consultation_duration: { type, default: 15 },
  accepting_new_patients: { type, default}
});

const reviewSchema = new mongoose.Schema({
  patientName,
  rating,
  review,
  date: { type, default.now },
  doctorName,
  treatment,
  verified: { type, default}
});

const hospitalSchema = new mongoose.Schema({
  // ============ BASIC INFO ============
  name: { type, required, index},
  password: { type, select},
  subscription_plan: { 
    type, 
    enum: ['free', 'silver', 'gold', 'platinum'],
    default: 'free' 
  },
  type: {
    type,
    enum: ['private', 'government', 'trust', 'corporate'],
    default: 'private'
  },
  year_established,
  registration_number,
  
  // ============ LOCATION ============
  address: {
    street,
    city: { type, index},
    state,
    pincode,
    landmark},
  location: {
    type: {
      type,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      index: '2dsphere'
    },
    lat,
    lng},
  
  // ============ MEDICAL INFO ============
  diseases_treated: [{ type, index}],
  procedures_available: [{ type}],
  specialties: [{ type, index}],
  has24x7ER: { type, default},
  trauma_center: { type, default},
  stroke_ready: { type, default},
  cardiac_emergency: { type, default},
  
  // ============ ACCREDITATIONS ============
  accreditations: [{
    type: { type, enum: ['NABH', 'JCI', 'NABL', 'ISO', 'ISO 9001', 'ISO 15189', 'NIC'] },
    certificate_number,
    issuing_body,
    valid_until}],
  
  // ============ BED MANAGEMENT ============
  beds: {
    total: { type, default: 0 },
    available: { type, default: 0 },
    occupied: { type, default: 0 },
    icu_total: { type, default: 0 },
    icu_available: { type, default: 0 },
    ventilator_total: { type, default: 0 },
    ventilator_available: { type, default: 0 },
    emergency_beds: { type, default: 0 },
    isolation_beds: { type, default: 0 },
    categories: {
      general_ward: { total, available, price_per_day},
      semi_private: { total, available, price_per_day},
      private: { total, available, price_per_day},
      deluxe: { total, available, price_per_day},
      suite: { total, available, price_per_day}
    },
    last_updated: { type, default.now },
    update_method: {
      type,
      enum: ['whatsapp', 'web_portal', 'mobile_app', 'api', 'excel_upload', 'manual'],
      default: 'manual'
    },
    auto_expire_at},
  
  // ============ PRICING ============
  pricing: {
    consultation: { type, default: 0 },
    consultation_discounted,
    follow_up,
    emergency_consultation,
    icu_bed_per_day: { type, default: 0 },
    general_bed_per_day: { type, default: 0 },
    semi_private_per_day,
    private_per_day,
    deluxe_per_day,
    suite_per_day,
    opd_general: { type, default: 0 },
    opd_specialist: { type, default: 0 },
    opd_super_specialist: { type, default: 0 },
    opd_emergency: { type, default: 0 },
    opd_follow_up: { type, default: 0 },
    opd_online: { type, default: 0 },
    ipd_general_ward: { type, default: 0 },
    ipd_semi_private: { type, default: 0 },
    ipd_private_room: { type, default: 0 },
    ipd_deluxe: { type, default: 0 },
    ipd_super_deluxe: { type, default: 0 },
    ipd_suite: { type, default: 0 },
    ipd_icu: { type, default: 0 },
    ipd_icu_ventilator: { type, default: 0 },
    ipd_nicu: { type, default: 0 },
    ipd_picu: { type, default: 0 },
    ipd_hdu: { type, default: 0 },
    ipd_isolation: { type, default: 0 },
    ipd_day_care: { type, default: 0 },
    online_booking_discount: { type, default: 10 },
    first_time_discount,
    health_packages: [{
      name,
      original_price,
      discounted_price,
      includes: [String],
      valid_till}],
    offers: [{
      title,
      description,
      discount_percentage,
      valid_till,
      terms}]
  },
  
  // ============ DOCTORS ============
  doctors: [doctorSchema],
  
  // ============ SCHEMES & INSURANCE ============
  schemes_accepted: [{
    type,
    enum: ['ayushman', 'cghs', 'esi', 'echs', 'state_scheme', 'senior_citizen', 'disability', 'pmjay', 'rsby']
  }],
  scheme_details: [{
    scheme_name,
    scheme_type,
    is_active: { type, default},
    beds_allocated,
    contact_person,
    contact_phone,
    last_updated}],
  insurance_accepted: [{ type, index}],
  cashless_available: { type, default},
  tpa_desk_available: { type, default},
  reimbursement_accepted: { type, default},
  tpa_partners: [String],
  
  // ============ FACILITIES ============
  lab_tests_available: { type, default},
  lab_types: [String],
  in_house_pharmacy: { type, default},
  pharmacy_24x7: { type, default},
  ambulance_available: { type, default},
  ambulance_count: { type, default: 0 },
  technology: [{
    type,
    enum: ['MRI 3T', 'MRI 1.5T', 'CT 128 Slice', 'CT 64 Slice', 'PET-CT', 'SPECT-CT', 'Cath Lab', 'Robotic Surgery', 'Gamma Knife', 'CyberKnife', 'Lithotripsy', 'Digital X-Ray', 'Mammography', 'DEXA Scan', 'Ultrasound 4D', 'Echocardiography', 'EEG', 'EMG']
  }],
  operation_theaters: {
    total,
    modular,
    robotic},
  amenities: [{
    type,
    enum: ['WiFi', 'AC Rooms', 'TV', 'Cafeteria', 'Parking', 'Wheelchair Access', 'Prayer Room', 'ATM', 'Pharmacy', 'Attendant Stay', 'Dietary Services', 'Laundry', 'International Patient Services', 'Language Translator', 'Airport Pickup', 'Currency Exchange']
  }],
  facilities: [{
    name,
    category,
    available_24x7,
    description}],
  
  // ============ RATINGS & REVIEWS ============
  ratings: {
    average: { type, default: 0 },
    count: { type, default: 0 },
    breakdown: {
      doctor_communication: { type, default: 0 },
      staff_behavior: { type, default: 0 },
      cleanliness: { type, default: 0 },
      wait_time: { type, default: 0 },
      value_for_money: { type, default: 0 }
    },
    avg_wait_time: { type, default: 0 }
  },
  reviews: [reviewSchema],
  featured_review: {
    text,
    author,
    date},
  
  // ============ CONTACT ============
  contact: {
    phone,
    alternate_phone,
    emergency_phone,
    ambulance_phone,
    email,
    website},
  
  // ============ OPERATIONAL ============
  working_hours: { type, default: '24x7' },
  online_services: {
    enabled: { type, default},
    consultation_fee,
    follow_up_fee,
    emergency_fee,
    video_consult: { type, default},
    chat_consult: { type, default}
  },
  opd_timings: {
    morning: { start, end},
    evening: { start, end}
  },
  visiting_hours,
  icu_visiting_hours,
  
  // ============ ACTIVITY & RANKING ============
  activity_score: { type, default: 0 },
  last_activity: { type, default.now },
  update_frequency: {
    today: { type, default: 0 },
    this_week: { type, default: 0 },
    this_month: { type, default: 0 }
  },
  
  // ============ MEDICAL TOURISM ============
  medical_tourism: {
    available: { type, default},
    services: [String],
    languages_spoken: [String],
    visa_assistance,
    airport_pickup},
  
  // ============ PAYMENT OPTIONS ============
  payment_methods: [{
    type,
    enum: ['Cash', 'Credit Card', 'Debit Card', 'UPI', 'Net Banking', 'EMI']
  }],
  emi_available: { type, default},
  emi_partners: [String],
  
  // ============ GALLERY & DOCUMENTS ============
  gallery: [String],
  documents: [{
    doc_type: { type},
    name: { type},
    url: { type}
  }],

  // ============ AMBULANCE FLEET ============
  ambulance_fleet: [{
    vehicle_number,
    type: { type, enum: ['basic', 'cardiac', 'ventilator', 'neonatal', 'wheelchair'] },
    driver_name,
    driver_phone,
    base_fare,
    per_km,
    available_24x7: { type, default}
  }],
  
  // ============ DIAGNOSTICS ============
  diagnostics: {
    tests: [{
      name,
      category,
      price,
      home_collection,
      fasting_required,
      report_time,
      sample_type}]
  },
  
  // ============ USER LINKING ============
  userId: { type.Schema.Types.ObjectId, ref: 'User', index},
  
  // ============ STATUS ============
  is_active: { type, default},
  is_verified: { type, default},
  verification_date,
  verification_status: {
    type,
    enum: ['pending', 'under_review', 'verified', 'rejected'],
    default: 'pending'
  },
  verification_submitted_at,
  
  // ============ DATA SOURCE ============
  data_filled_via: {
    type,
    enum: ['manual', 'excel_upload', 'city_template', 'api'],
    default: 'manual'
  },

  // ============ CORPORATE HEALTH ============
  servesCorporate: { type, default, index},
  corporatePackages: [{
    packageName: { type, required},
    packageType: { type, enum: ['health_checkup', 'opd_subscription', 'wellness_camp', 'diagnostic_package', 'custom'], default: 'health_checkup' },
    description,
    servicesIncluded: [String],
    pricePerEmployee: { type, required},
    discountedPricePerEmployee,
    minEmployees: { type, default: 10 },
    maxEmployees,
    validityDays: { type, default: 365 },
    locations: [String],
    availableCities: [String],
    dedicatedPOC: { name, phone, email},
    slaTerms,
    isActive: { type, default},
    createdAt: { type, default.now },
    updatedAt: { type, default.now }
  }],
  upload_history: [],
  corporateEnquiries: [{
    companyName,
    contactPerson,
    email,
    phone,
    employeeCount,
    requirements,
    status: { type, enum: ['new', 'contacted', 'negotiating', 'converted', 'closed'], default: 'new' },
    createdAt: { type, default.now }
  }],

  // ============ TIMESTAMPS ============
  created_at: { type, default.now },
  updated_at: { type, default.now }

}, { 
  collection: 'hospitals',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// ============ INDEXES ============
hospitalSchema.index({ name: 'text', specialties: 'text', diseases_treated: 'text', 'doctors.name': 'text', 'doctors.specialization': 'text' });
hospitalSchema.index({ 'location.coordinates': '2dsphere' });
hospitalSchema.index({ 'address.city': 1, 'ratings.average': -1 });
hospitalSchema.index({ schemes_accepted: 1, cashless_available: 1 });
hospitalSchema.index({ activity_score: -1 });
hospitalSchema.index({ diseases_treated: 1 });
hospitalSchema.index({ procedures_available: 1 });
hospitalSchema.index({ servesCorporate: 1, 'address.city': 1 });
hospitalSchema.index({ 'corporatePackages.packageType': 1 });
hospitalSchema.index({ 'corporatePackages.isActive': 1 });

// ============ MIDDLEWARE ============
hospitalSchema.pre('save', function(next) {
  if (this.beds && this.beds.update_method && ['whatsapp', 'web_portal', 'manual'].includes(this.beds.update_method)) {
    this.beds.auto_expire_at = new Date(Date.now() + 4 * 60 * 60 * 1000);
  }
  this.activity_score = calculateActivityScore(this);
  this.last_activity = new Date();
  next();
});

hospitalSchema.pre('save', function(next) {
  if (this.isModified('reviews')) {
    const totalRating = this.reviews.reduce((sum, r) => sum + r.rating, 0);
    this.ratings.count = this.reviews.length;
    this.ratings.average = this.reviews.length > 0 ? (totalRating / this.reviews.length).toFixed(1) : 0;
  }
  next();
});

// ============ METHODS ============
hospitalSchema.methods.getAvailableDoctors = function(specialization = null) {
  let doctors = this.doctors.filter(d => d.availability.status !== 'leave' && d.accepting_new_patients);
  if (specialization) doctors = doctors.filter(d => d.specialization.toLowerCase().includes(specialization.toLowerCase()));
  return doctors;
};

hospitalSchema.methods.getBedStatusBadge = function() {
  const hours = (Date.now() - new Date(this.beds.last_updated).getTime()) / (1000 * 60 * 60);
  if (hours < 1) return { text: 'Live Updated', color: 'green', icon: '🟢' };
  if (hours < 4) return { text: 'Updated Recently', color: 'yellow', icon: '🟡' };
  if (hours < 12) return { text: 'Updated Today', color: 'orange', icon: '🟠' };
  return { text: 'May not be current', color: 'red', icon: '🔴' };
};

hospitalSchema.methods.toggleCorporate = function(enable = true) {
  this.servesCorporate = enable;
  if (!enable) this.corporatePackages.forEach(pkg => { pkg.isActive = false; });
  return this.save();
};

hospitalSchema.methods.addCorporatePackage = function(packageData) {
  this.corporatePackages.push(packageData);
  if (!this.servesCorporate) this.servesCorporate = true;
  return this.save();
};

hospitalSchema.methods.getActiveCorporatePackages = function() {
  return this.corporatePackages.filter(pkg => pkg.isActive);
};

// ============ STATICS ============
hospitalSchema.statics.findCorporateHospitals = function(city = null) {
  const query = { servesCorporate, is_active, is_verified};
  if (city) query['address.city'] = { $regexRegExp(city, 'i') };
  return this.find(query).select('name address corporatePackages ratings contact');
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

module.exports = mongoose.model('Hospital', hospitalSchema);// force model redeploy 



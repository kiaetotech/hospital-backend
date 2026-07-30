const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  // Prescription ID
  prescriptionId: { type: String, unique: true, required: true },
  
  // Booking reference
  bookingId: { type: String, required: true, index: true },
  bookingType: { type: String, enum: ['opd', 'admission', 'ayurveda_consultation', 'homeopathy_consult'] },
  
  // Patient info
  patientName: { type: String, required: true },
  patientAge: Number,
  patientGender: String,
  patientPhone: String,
  patientEmail: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Doctor info
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  doctorName: { type: String, required: true },
  doctorSpecialization: String,
  doctorRegistrationNumber: String,
  
  // Hospital info
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
  hospitalName: String,
  
  // Consultation details
  consultationDate: { type: Date, required: true },
  consultationType: { type: String, enum: ['in_person', 'video', 'phone'] },
  
  // Vital signs
  vitals: {
    bloodPressure: String,
    pulse: String,
    temperature: String,
    spo2: String,
    weight: String,
    height: String,
    bmi: String
  },
  
  // Diagnosis
  diagnosis: [{
    condition: String,
    icd10_code: String,
    severity: { type: String, enum: ['mild', 'moderate', 'severe', 'critical'] },
    notes: String
  }],
  
  // Symptoms
  symptoms: [String],
  
  // Medicines prescribed
  medicines: [{
    name: { type: String, required: true },
    dosage: String,
    frequency: { 
      type: String, 
      enum: ['Once daily', 'Twice daily', 'Thrice daily', 'Four times daily', 'As needed', 'At bedtime', 'Before meals', 'After meals']
    },
    duration: String,
    duration_days: Number,
    instructions: String,
    quantity: Number,
    timing: {
      morning: Boolean,
      afternoon: Boolean,
      evening: Boolean,
      night: Boolean
    },
    before_after_food: { type: String, enum: ['before', 'after', 'with', 'any'] },
    is_antibiotic: { type: Boolean, default: false },
    refills: { type: Number, default: 0 }
  }],
  
  // Lab tests recommended
  tests_recommended: [{
    test_name: String,
    test_code: String,
    instructions: String,
    is_urgent: { type: Boolean, default: false },
    report_review_date: Date
  }],
  
  // Follow-up
  follow_up: {
    required: { type: Boolean, default: false },
    follow_up_date: Date,
    follow_up_notes: String,
    follow_up_booked: { type: Boolean, default: false },
    follow_up_booking_id: String
  },
  
  // Additional notes
  doctor_notes: String,
  advice: String,
  diet_advice: String,
  exercise_advice: String,
  precautions: [String],
  
  // Referrals
  referrals: [{
    doctor_name: String,
    specialization: String,
    hospital_name: String,
    reason: String
  }],
  
  // Attachments
  attachments: [{
    name: String,
    url: String,
    type: { type: String, enum: ['report', 'scan', 'image', 'document'] },
    uploaded_at: { type: Date, default: Date.now }
  }],
  
  // Digital signature
  digital_signature: {
    signed: { type: Boolean, default: false },
    signature_url: String,
    signed_at: Date,
    ip_address: String
  },
  
  // Status
  status: { 
    type: String, 
    enum: ['draft', 'active', 'completed', 'expired', 'cancelled'],
    default: 'active'
  },
  
  // Validity
  valid_until: Date,
  
  // Pharmacy fulfillment
  pharmacy: {
    dispensed: { type: Boolean, default: false },
    pharmacy_name: String,
    pharmacist_name: String,
    dispensed_at: Date,
    notes: String
  },
  
  // Prescription type
  prescription_type: { 
    type: String, 
    enum: ['allopathy', 'ayurveda', 'homeopathy', 'general'],
    default: 'allopathy'
  },
  
  // For Ayurveda
  ayurveda_details: {
    prakriti_type: String,
    dosha_analysis: String,
    panchakarma_recommended: Boolean,
    herbs_recommended: [String],
    lifestyle_advice: String
  },
  
  // For Homeopathy
  homeopathy_details: {
    remedy_name: String,
    potency: String,
    dosage_form: String,
    case_analysis: String
  },
  
  // Next review
  next_review_date: Date,
  
  // Share settings
  shareable_link: String,
  is_shared: { type: Boolean, default: false },
  shared_with: [String],
  
  // Emergency
  is_emergency: { type: Boolean, default: false },
  
  // Timestamps
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }

}, { timestamps: true });

// Indexes
prescriptionSchema.index({ prescriptionId: 1 });
prescriptionSchema.index({ bookingId: 1 });
prescriptionSchema.index({ patientPhone: 1 });
prescriptionSchema.index({ doctorId: 1, created_at: -1 });
prescriptionSchema.index({ hospitalId: 1, created_at: -1 });
prescriptionSchema.index({ userId: 1 });
prescriptionSchema.index({ status: 1 });

// Pre-save hook
prescriptionSchema.pre('save', function(next) {
  if (!this.prescriptionId) {
    this.prescriptionId = 'RX' + Date.now() + Math.floor(Math.random() * 1000);
  }
  
  // Set validity (default 30 days from creation)
  if (!this.valid_until) {
    this.valid_until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  
  next();
});

// Virtual: Is prescription valid
prescriptionSchema.virtual('isValid').get(function() {
  if (this.status === 'expired' || this.status === 'cancelled') return false;
  if (this.valid_until && new Date() > this.valid_until) return false;
  return this.status === 'active';
});

// Virtual: Medicine count
prescriptionSchema.virtual('medicineCount').get(function() {
  return this.medicines?.length || 0;
});

// Virtual: Test count
prescriptionSchema.virtual('testCount').get(function() {
  return this.tests_recommended?.length || 0;
});

// Method: Mark as dispensed
prescriptionSchema.methods.markAsDispensed = function(pharmacyName, pharmacistName) {
  this.pharmacy = {
    dispensed: true,
    pharmacy_name: pharmacyName,
    pharmacist_name: pharmacistName,
    dispensed_at: new Date()
  };
  return this.save();
};

// Method: Sign prescription
prescriptionSchema.methods.sign = function(signatureUrl, ipAddress) {
  this.digital_signature = {
    signed: true,
    signature_url: signatureUrl,
    signed_at: new Date(),
    ip_address: ipAddress
  };
  return this.save();
};

// Method: Expire prescription
prescriptionSchema.methods.expire = function() {
  this.status = 'expired';
  this.valid_until = new Date();
  return this.save();
};

// Static: Get prescriptions for patient
prescriptionSchema.statics.getPatientPrescriptions = function(phone, limit = 20) {
  return this.find({ patientPhone: phone })
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();
};

// Static: Get prescriptions by doctor
prescriptionSchema.statics.getDoctorPrescriptions = function(doctorId, filters = {}) {
  const query = { doctorId, ...filters };
  return this.find(query)
    .sort({ created_at: -1 })
    .lean();
};

module.exports = mongoose.model('Prescription', prescriptionSchema);
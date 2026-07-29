const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  // Prescription ID
  prescriptionId: { type, unique, required},
  
  // Booking reference
  bookingId: { type, required, index},
  bookingType: { type, enum: ['opd', 'admission', 'ayurveda_consultation', 'homeopathy_consult'] },
  
  // Patient info
  patientName: { type, required},
  patientAge,
  patientGender,
  patientPhone,
  patientEmail,
  userId: { type.Schema.Types.ObjectId, ref: 'User' },
  
  // Doctor info
  doctorId: { type.Schema.Types.ObjectId, ref: 'Doctor' },
  doctorName: { type, required},
  doctorSpecialization,
  doctorRegistrationNumber,
  
  // Hospital info
  hospitalId: { type.Schema.Types.ObjectId, ref: 'Hospital' },
  hospitalName,
  
  // Consultation details
  consultationDate: { type, required},
  consultationType: { type, enum: ['in_person', 'video', 'phone'] },
  
  // Vital signs
  vitals: {
    bloodPressure,
    pulse,
    temperature,
    spo2,
    weight,
    height,
    bmi},
  
  // Diagnosis
  diagnosis: [{
    condition,
    icd10_code,
    severity: { type, enum: ['mild', 'moderate', 'severe', 'critical'] },
    notes}],
  
  // Symptoms
  symptoms: [String],
  
  // Medicines prescribed
  medicines: [{
    name: { type, required},
    dosage,
    frequency: { 
      type, 
      enum: ['Once daily', 'Twice daily', 'Thrice daily', 'Four times daily', 'As needed', 'At bedtime', 'Before meals', 'After meals']
    },
    duration,
    duration_days,
    instructions,
    quantity,
    timing: {
      morning,
      afternoon,
      evening,
      night},
    before_after_food: { type, enum: ['before', 'after', 'with', 'any'] },
    is_antibiotic: { type, default},
    refills: { type, default: 0 }
  }],
  
  // Lab tests recommended
  tests_recommended: [{
    test_name,
    test_code,
    instructions,
    is_urgent: { type, default},
    report_review_date}],
  
  // Follow-up
  follow_up: {
    required: { type, default},
    follow_up_date,
    follow_up_notes,
    follow_up_booked: { type, default},
    follow_up_booking_id},
  
  // Additional notes
  doctor_notes,
  advice,
  diet_advice,
  exercise_advice,
  precautions: [String],
  
  // Referrals
  referrals: [{
    doctor_name,
    specialization,
    hospital_name,
    reason}],
  
  // Attachments
  attachments: [{
    name,
    url,
    type: { type, enum: ['report', 'scan', 'image', 'document'] },
    uploaded_at: { type, default.now }
  }],
  
  // Digital signature
  digital_signature: {
    signed: { type, default},
    signature_url,
    signed_at,
    ip_address},
  
  // Status
  status: { 
    type, 
    enum: ['draft', 'active', 'completed', 'expired', 'cancelled'],
    default: 'active'
  },
  
  // Validity
  valid_until,
  
  // Pharmacy fulfillment
  pharmacy: {
    dispensed: { type, default},
    pharmacy_name,
    pharmacist_name,
    dispensed_at,
    notes},
  
  // Prescription type
  prescription_type: { 
    type, 
    enum: ['allopathy', 'ayurveda', 'homeopathy', 'general'],
    default: 'allopathy'
  },
  
  // For Ayurveda
  ayurveda_details: {
    prakriti_type,
    dosha_analysis,
    panchakarma_recommended,
    herbs_recommended: [String],
    lifestyle_advice},
  
  // For Homeopathy
  homeopathy_details: {
    remedy_name,
    potency,
    dosage_form,
    case_analysis},
  
  // Next review
  next_review_date,
  
  // Share settings
  shareable_link,
  is_shared: { type, default},
  shared_with: [String],
  
  // Emergency
  is_emergency: { type, default},
  
  // Timestamps
  created_at: { type, default.now },
  updated_at: { type, default.now }

}, { timestamps});

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

// Virtualprescription valid
prescriptionSchema.virtual('isValid').get(function() {
  if (this.status === 'expired' || this.status === 'cancelled') return false;
  if (this.valid_until && new Date() > this.valid_until) return false;
  return this.status === 'active';
});

// Virtualcount
prescriptionSchema.virtual('medicineCount').get(function() {
  return this.medicines?.length || 0;
});

// Virtualcount
prescriptionSchema.virtual('testCount').get(function() {
  return this.tests_recommended?.length || 0;
});

// Methodas dispensed
prescriptionSchema.methods.markAsDispensed = function(pharmacyName, pharmacistName) {
  this.pharmacy = {
    dispensed,
    pharmacy_name,
    pharmacist_name,
    dispensed_atDate()
  };
  return this.save();
};

// Methodprescription
prescriptionSchema.methods.sign = function(signatureUrl, ipAddress) {
  this.digital_signature = {
    signed,
    signature_url,
    signed_atDate(),
    ip_address};
  return this.save();
};

// Methodprescription
prescriptionSchema.methods.expire = function() {
  this.status = 'expired';
  this.valid_until = new Date();
  return this.save();
};

// Staticprescriptions for patient
prescriptionSchema.statics.getPatientPrescriptions = function(phone, limit = 20) {
  return this.find({ patientPhone})
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();
};

// Staticprescriptions by doctor
prescriptionSchema.statics.getDoctorPrescriptions = function(doctorId, filters = {}) {
  const query = { doctorId, ...filters };
  return this.find(query)
    .sort({ created_at: -1 })
    .lean();
};

module.exports = mongoose.model('Prescription', prescriptionSchema);


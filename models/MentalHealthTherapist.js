const mongoose = require('mongoose');

const MentalHealthTherapistSchema = new mongoose.Schema({
  // Basic Info
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String },
  
  // Professional Details
  licenseNumber: { type: String, required: true, unique: true },
  licenseCouncil: { type: String }, // RCI, Indian Psychiatric Society, etc.
  licenseExpiry: { type: Date },
  
  // Qualifications
  qualifications: [{
    degree: { type: String },
    institution: { type: String },
    year: { type: Number },
    specialization: { type: String }
  }],
  
  // Specializations
  specializations: [{
    type: String,
    enum: [
      'Anxiety Disorders',
      'Depression',
      'Stress Management',
      'Relationship Counseling',
      'Career Counseling',
      'Trauma Therapy',
      'PTSD',
      'OCD',
      'Panic Disorder',
      'Phobias',
      'Eating Disorders',
      'Substance Abuse',
      'Grief & Loss',
      'Anger Management',
      'Parenting Counseling',
      'Family Therapy',
      'Couples Therapy',
      'Child Psychology',
      'Adolescent Psychology',
      'Geriatric Psychology',
      'Workplace Stress',
      'Burnout',
      'LGBTQ+ Support',
      'Life Coaching',
      'Mindfulness',
      'Sleep Disorders'
    ]
  }],
  
  // Consultation Types
  consultationTypes: {
    video: { type: Boolean, default: true },
    audio: { type: Boolean, default: true },
    text: { type: Boolean, default: true },
    anonymous: { type: Boolean, default: true },
    emergency: { type: Boolean, default: true }
  },
  
  // Pricing
  pricing: {
    consultation: { type: Number, required: true },
    textTherapy: { type: Number },
    audioTherapy: { type: Number },
    videoTherapy: { type: Number },
    emergency: { type: Number },
    packageDiscount: { type: Number, default: 10 }
  },
  
  // Packages
  packages: [{
    name: { type: String },
    sessions: { type: Number },
    price: { type: Number },
    validity: { type: Number }, // days
    description: { type: String }
  }],
  
  // Experience
  experience: { type: Number, required: true },
  about: { type: String, maxlength: 2000 },
  languages: [{ type: String }],
  
  // Location
  address: {
    street: String,
    city: { type: String },
    state: { type: String },
    pincode: String,
    coordinates: { lat: Number, lng: Number }
  },
  
  // Availability
  availability: [{
    day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    slots: [{
      startTime: String,
      endTime: String,
      maxBookings: { type: Number, default: 5 },
      currentBookings: { type: Number, default: 0 }
    }]
  }],
  
  // Emergency Availability
  emergencyAvailability: {
    enabled: { type: Boolean, default: false },
    phone: { type: String },
    whatsapp: { type: String },
    telegram: { type: String }
  },
  
  // Anonymous Chat Settings
  anonymousSettings: {
    enabled: { type: Boolean, default: true },
    responseTime: { type: String, default: '24 hours' },
    pricing: { type: Number, default: 200 }
  },
  
  // Ratings & Reviews
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  reviews: [{
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    patientName: String,
    rating: { type: Number, min: 1, max: 5 },
    review: String,
    consultationType: String,
    isAnonymous: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false }
  }],
  
  // Documents
  documents: {
    licenseCertificate: { type: String },
    degreeCertificate: { type: String },
    idProof: { type: String },
    photo: { type: String },
    policeVerification: { type: String }
  },
  
  // Verification
  verificationStatus: {
    type: String,
    enum: ['pending', 'documents_verified', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  isActive: { type: Boolean, default: false },
  
  // Statistics
  stats: {
    totalConsultations: { type: Number, default: 0 },
    totalPatients: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    anonymousSessions: { type: Number, default: 0 },
    emergencyCalls: { type: Number, default: 0 },
    satisfactionRate: { type: Number, default: 0 }
  },
  
  // Bank Details
  bankDetails: {
    accountHolder: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    upiId: String
  },
  
  // Commission
  commissionRate: { type: Number, default: 15 },
  
  // Availability Status
  isAvailable: { type: Boolean, default: true },
  isEmergencyAvailable: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
MentalHealthTherapistSchema.index({ specializations: 1 });
MentalHealthTherapistSchema.index({ 'address.city': 1 });
MentalHealthTherapistSchema.index({ rating: -1 });
MentalHealthTherapistSchema.index({ isActive: 1 });
MentalHealthTherapistSchema.index({ verificationStatus: 1 });
MentalHealthTherapistSchema.index({ name: 'text', about: 'text' });

// Virtuals
MentalHealthTherapistSchema.virtual('isApproved').get(function() {
  return this.verificationStatus === 'approved' && this.isActive;
});

MentalHealthTherapistSchema.virtual('hasAnonymousChat').get(function() {
  return this.anonymousSettings.enabled;
});

MentalHealthTherapistSchema.virtual('consultationPriceRange').get(function() {
  return {
    min: this.pricing.consultation || 0,
    max: this.pricing.videoTherapy || this.pricing.consultation || 0
  };
});

// Methods
MentalHealthTherapistSchema.methods.calculatePackageDiscount = function(sessions) {
  const basePrice = this.pricing.consultation || 500;
  const discount = this.pricing.packageDiscount || 10;
  return {
    originalPrice: basePrice * sessions,
    discountedPrice: (basePrice * sessions) * (1 - discount / 100),
    savings: (basePrice * sessions) * (discount / 100)
  };
};

MentalHealthTherapistSchema.methods.getAvailableSlots = function(date, type) {
  // Implementation for slot availability
};

module.exports = mongoose.model('MentalHealthTherapist', MentalHealthTherapistSchema);
const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fullName: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  isPhoneVerified: { type: Boolean, default: false },
  serviceAddress: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    coordinates: { lat: Number, lng: Number }
  },
  emergencyContact: {
    name: { type: String, required: true },
    phone: { type: String, required: true }
  },
  patientDetails: {
    age: Number,
    gender: String,
    mobilityStatus: String,
    conditions: [String],
    requiredServiceType: { type: String, enum: ['personal', 'skilled', 'both'], required: true }
  },
  prescriptionUrl: { type: String },
  budgetRange: {
    min: Number,
    max: Number
  },
  
  // ============================================
  // LOAN MODULE ADDITIONS (DO NOT DELETE)
  // ============================================
  pan: { type: String },
  aadhaar: { type: String },
  cibilScore: { type: Number },
  monthlyIncome: { type: Number },
  employmentType: { type: String, enum: ['Salaried', 'Self-Employed', 'Business', 'Retired', 'Student', 'Unemployed'] },
  
  // Location details for lender assignment
  locationDetails: {
    pincode: { type: String },
    city: { type: String },
    district: { type: String },
    state: { type: String },
    coordinates: { lat: Number, lng: Number }
  },
  
  // Loan history reference
  loanApplications: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LoanApplication' }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Patient', patientSchema);
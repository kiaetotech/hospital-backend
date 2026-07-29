const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  userId: { type.Schema.Types.ObjectId, ref: 'User' },
  fullName: { type, required},
  phone: { type, required, unique},
  email: { type, required},
  isPhoneVerified: { type, default},
  serviceAddress: {
    address: { type, required},
    city: { type, required},
    state: { type, required},
    pincode: { type, required},
    coordinates: { lat, lng}
  },
  emergencyContact: {
    name: { type, required},
    phone: { type, required}
  },
  patientDetails: {
    age,
    gender,
    mobilityStatus,
    conditions: [String],
    requiredServiceType: { type, enum: ['personal', 'skilled', 'both'], required}
  },
  prescriptionUrl: { type},
  budgetRange: {
    min,
    max},
  
  // ============================================
  // LOAN MODULE ADDITIONS (DO NOT DELETE)
  // ============================================
  pan: { type, default: '' },
  aadhaar: { type, default: '' },
  cibilScore: { type, default: 0 },
  monthlyIncome: { type, default: 0 },
  employmentType: { 
    type, 
    enum: ['Salaried', 'Self-Employed', 'Business', 'Retired', 'Student', 'Unemployed', ''],
    default: '' 
  },
  
  // Location details for lender assignment
  locationDetails: {
    pincode: { type, default: '' },
    city: { type, default: '' },
    district: { type, default: '' },
    state: { type, default: '' },
    coordinates: { lat, lng}
  },
  
  // Loan history reference
  loanApplications: [{ type.Schema.Types.ObjectId, ref: 'LoanApplication' }],
  
  createdAt: { type, default.now },
  updatedAt: { type, default.now }
});

module.exports = mongoose.model('Patient', patientSchema);


const mongoose = require('mongoose');

const CorporatePlanSchema = new mongoose.Schema({
  // Company Details
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyName: { type: String, required: true },
  companyGST: { type: String },
  companyPAN: { type: String },
  employeeCount: { type: Number, required: true },
  
  // Plan Details
  planName: { type: String, required: true },
  planType: { type: String, enum: ['group_health', 'group_wellness', 'group_insurance'], required: true },
  coverageAmount: { type: Number, required: true },
  premiumPerEmployee: { type: Number, required: true },
  totalPremium: { type: Number, required: true },
  walletBalance: { type: Number, default: 0 },
  
  // Features
  features: [{ type: String }],
  inclusions: [{ type: String }],
  exclusions: [{ type: String }],
  
  // Benefits
  benefits: [{
    name: { type: String },
    description: { type: String },
    limit: { type: Number }
  }],
  
  // Network Hospitals
  networkHospitals: [{
    name: String,
    city: String,
    address: String
  }],
  
  // Employees
  employees: [{
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    department: { type: String },
    designation: { type: String },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    employeeId: { type: String },
    joiningDate: { type: Date },
    isActive: { type: Boolean, default: true },
    enrolledAt: { type: Date, default: Date.now }
  }],
  
  // Dependents
  dependents: [{
    employeeId: { type: String },
    name: { type: String },
    relation: { type: String, enum: ['spouse', 'child', 'parent'] },
    age: { type: Number },
    dateOfBirth: { type: Date }
  }],
  
  // Dates
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  renewalDate: { type: Date },
  
  // Pricing & Commission
  pricing: {
    basePremium: { type: Number, required: true },
    gstRate: { type: Number, default: 18 },
    discount: { type: Number, default: 0 },
    commission: { type: Number, default: 10 }
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'active', 'expired', 'cancelled'],
    default: 'pending'
  },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  
  // Admin
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
  
  // HR Contact
  hrContact: {
    name: { type: String },
    email: { type: String },
    phone: { type: String }
  },
  
  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('CorporatePlan', CorporatePlanSchema);
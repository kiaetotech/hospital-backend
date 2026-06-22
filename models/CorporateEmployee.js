const mongoose = require('mongoose');

const CorporateEmployeeSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'CorporatePlan', required: true },
  
  // Employee Details
  employeeId: { type: String, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  department: { type: String },
  designation: { type: String },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  joiningDate: { type: Date },
  
  // Address
  address: {
    line1: String,
    city: String,
    state: String,
    pincode: String
  },
  
  // Dependents
  dependents: [{
    name: String,
    relation: { type: String, enum: ['spouse', 'child', 'parent'] },
    age: Number,
    dateOfBirth: Date
  }],
  
  // Coverage
  coverageAmount: { type: Number },
  premiumAmount: { type: Number },
  
  // Status
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  
  // Claims
  claims: [{
    claimId: String,
    amount: Number,
    date: Date,
    status: { type: String, enum: ['pending', 'approved', 'settled', 'rejected'] },
    description: String
  }],
  
  // Audit
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Auto-generate employee ID
CorporateEmployeeSchema.pre('save', function(next) {
  if (!this.employeeId) {
    const prefix = 'EMP';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.employeeId = `${prefix}${timestamp}${random}`;
  }
  next();
});

module.exports = mongoose.model('CorporateEmployee', CorporateEmployeeSchema);
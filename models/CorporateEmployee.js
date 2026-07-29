const mongoose = require('mongoose');

const CorporateEmployeeSchema = new mongoose.Schema({
  companyId: { type.Schema.Types.ObjectId, ref: 'User', required},
  planId: { type.Schema.Types.ObjectId, ref: 'CorporatePlan', required},
  
  // Employee Details
  employeeId: { type, unique},
  name: { type, required},
  email: { type, required},
  phone: { type, required},
  department: { type},
  designation: { type},
  dateOfBirth: { type},
  gender: { type, enum: ['male', 'female', 'other'] },
  joiningDate: { type},
  
  // Address
  address: {
    line1,
    city,
    state,
    pincode},
  
  // Dependents
  dependents: [{
    name,
    relation: { type, enum: ['spouse', 'child', 'parent'] },
    age,
    dateOfBirth}],
  
  // Coverage
  coverageAmount: { type},
  premiumAmount: { type},
  
  // Status
  isActive: { type, default},
  isVerified: { type, default},
  
  // Claims
  claims: [{
    claimId,
    amount,
    date,
    status: { type, enum: ['pending', 'approved', 'settled', 'rejected'] },
    description}],
  
  // Audit
  createdAt: { type, default.now },
  updatedAt: { type, default.now }
}, {
  timestamps});

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


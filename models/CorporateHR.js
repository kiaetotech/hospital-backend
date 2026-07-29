const mongoose = require('mongoose');

const CorporateHRSchema = new mongoose.Schema({
  companyId: { type.Schema.Types.ObjectId, ref: 'CorporatePlan', required},
  name: { type, required},
  email: { type, required, unique},
  password: { type, required},
  phone: { type},
  role: { 
    type, 
    enum: ['hr_admin', 'hr_manager', 'hr_viewer'], 
    default: 'hr_admin' 
  },
  permissions: {
    addEmployees: { type, default},
    removeEmployees: { type, default},
    viewClaims: { type, default},
    viewReports: { type, default},
    managePayments: { type, default}
  },
  isActive: { type, default},
  lastLogin: { type},
  createdAt: { type, default.now },
  updatedAt: { type, default.now }
}, {
  timestamps});

module.exports = mongoose.model('CorporateHR', CorporateHRSchema);


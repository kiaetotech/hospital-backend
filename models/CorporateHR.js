const mongoose = require('mongoose');

const CorporateHRSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'CorporatePlan', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  role: { 
    type: String, 
    enum: ['hr_admin', 'hr_manager', 'hr_viewer'], 
    default: 'hr_admin' 
  },
  permissions: {
    addEmployees: { type: Boolean, default: true },
    removeEmployees: { type: Boolean, default: true },
    viewClaims: { type: Boolean, default: true },
    viewReports: { type: Boolean, default: true },
    managePayments: { type: Boolean, default: true }
  },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('CorporateHR', CorporateHRSchema);
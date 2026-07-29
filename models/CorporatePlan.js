const mongoose = require('mongoose');

const CorporatePlanSchema = new mongoose.Schema({
  // Company Details
  companyId: { type.Schema.Types.ObjectId, ref: 'User', required, default},
  companyName: { type, required},
  companyGST: { type},
  companyPAN: { type},
  companyType: { type, enum: ['startup', 'sme', 'enterprise', 'mnc'], default: 'sme' },
  employeeCount: { type, required},
  industryType: { type},
  website: { type},
  
  // Plan Details
  planName: { type, required},
  planType: { type, enum: ['group_health', 'group_wellness', 'group_insurance', 'custom', 'hybrid'], required},
  coverageAmount: { type, required},
  premiumPerEmployee: { type, required},
  totalPremium: { type, required},
  walletBalance: { type, default: 0 },
  billingCycle: { type, enum: ['monthly', 'quarterly', 'half_yearly', 'yearly'], default: 'yearly' },
  
  // Services Included (8 categories)
  servicesEnabled: [{
    type,
    enum: ['hospitals', 'onlineDoctor', 'diagnostics', 'ambulance', 'caregivers', 'mentalHealth', 'ayurveda', 'homeopathy']
  }],
  
  // Service-specific coverage
  coverageDetails: {
    hospitals: { percentage, maxAmount},
    onlineDoctor: { percentage, maxAmount},
    diagnostics: { percentage, maxAmount},
    ambulance: { percentage, maxAmount},
    caregivers: { percentage, maxAmount},
    mentalHealth: { percentage, maxAmount},
    ayurveda: { percentage, maxAmount},
    homeopathy: { percentage, maxAmount}
  },
  
  // Features
  features: [{ type}],
  inclusions: [{ type}],
  exclusions: [{ type}],
  
  // Benefits
  benefits: [{
    name: { type},
    description: { type},
    limit: { type}
  }],
  
  // Network Providers
  networkHospitals: [{
    name,
    city,
    address,
    contactPhone,
    isPreferred: { type, default}
  }],
  
  preferredLabs: [{
    name,
    city,
    contactPhone}],
  
  // Employees
  employees: [{
    name: { type, required},
    email: { type, required},
    phone: { type, required},
    department: { type},
    designation: { type},
    dateOfBirth: { type},
    gender: { type, enum: ['male', 'female', 'other'] },
    employeeId: { type},
    joiningDate: { type},
    isActive: { type, default},
    walletBalance: { type, default: 0 },
    benefitsUsed: { type, default: 0 },
    benefitsLimit: { type, default: 0 },
    enrolledAt: { type, default.now }
  }],
  
  // Dependents
  dependents: [{
    employeeId: { type},
    name: { type},
    relation: { type, enum: ['spouse', 'child', 'parent', 'sibling'] },
    age: { type},
    gender: { type},
    dateOfBirth: { type},
    isActive: { type, default}
  }],
  
  // Dates
  startDate: { type, required},
  endDate: { type, required},
  renewalDate: { type},
  coolingPeriod: { type, default: 30 },
  
  // Pricing & Commission
  pricing: {
    basePremium: { type, required, default: 0 },
    gstRate: { type, default: 18 },
    discount: { type, default: 0 },
    bulkDiscount: { type, default: 0 },
    commission: { type, default: 10 },
    platformFee: { type, default: 2 },
    setupFee: { type, default: 0 },
    minWalletTopup: { type, default: 50000 }
  },
  
  // Payment Details
  paymentTerms: { type, enum: ['prepaid', 'postpaid', 'hybrid'], default: 'prepaid' },
  creditLimit: { type, default: 0 },
  paymentDueDays: { type, default: 30 },
  
  // Documents
  documents: [{
    type: { type},
    name: { type},
    url: { type},
    uploadedAt: { type, default.now }
  }],
  
  // Status
  status: {
    type,
    enum: ['draft', 'pending', 'active', 'suspended', 'expired', 'cancelled'],
    default: 'pending'
  },
  isActive: { type, default},
  isVerified: { type, default},
  verificationNotes: { type},
  
  // Admin
  verifiedBy: { type.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type},
  approvedBy: { type},
  
  // HR Contact
  hrContact: {
    name: { type},
    email: { type},
    phone: { type},
    designation: { type}
  },
  
  // Notifications
  notifications: [{
    type: { type, enum: ['renewal', 'wallet_low', 'employee_added', 'claim', 'payment'] },
    message: { type},
    sentAt: { type, default.now },
    isRead: { type, default}
  }],
  
  // Activity Log
  activityLog: [{
    action: { type},
    performedBy: { type},
    details: { type},
    timestamp: { type, default.now }
  }],
  
  // Audit
  createdBy: { type.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type, default.now },
  updatedAt: { type, default.now }
}, {
  timestamps});

// Indexes
CorporatePlanSchema.index({ companyName: 1, planType: 1 });
CorporatePlanSchema.index({ status: 1, isActive: 1 });
CorporatePlanSchema.index({ 'servicesEnabled': 1 });
CorporatePlanSchema.index({ 'employees.employeeId': 1 });

// Auto-generate companyId if not provided
CorporatePlanSchema.pre('save', function(next) {
  if (!this.companyId) {
    this.companyId = this._id;
  }
  if (!this.planName) {
    this.planName = `${this.companyName} - ${this.planType}`;
  }
  next();
});

module.exports = mongoose.model('CorporatePlan', CorporatePlanSchema);


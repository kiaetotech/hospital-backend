const mongoose = require('mongoose');

const CorporatePlanSchema = new mongoose.Schema({
  // Company Details
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null },
  companyName: { type: String, required: true },
  companyGST: { type: String },
  companyPAN: { type: String },
  companyType: { type: String, enum: ['startup', 'sme', 'enterprise', 'mnc'], default: 'sme' },
  employeeCount: { type: Number, required: true },
  industryType: { type: String },
  website: { type: String },
  
  // Plan Details
  planName: { type: String, required: true },
  planType: { type: String, enum: ['group_health', 'group_wellness', 'group_insurance', 'custom', 'hybrid'], required: true },
  coverageAmount: { type: Number, required: true },
  premiumPerEmployee: { type: Number, required: true },
  totalPremium: { type: Number, required: true },
  walletBalance: { type: Number, default: 0 },
  billingCycle: { type: String, enum: ['monthly', 'quarterly', 'half_yearly', 'yearly'], default: 'yearly' },
  
  // Services Included (8 categories)
  servicesEnabled: [{
    type: String,
    enum: ['hospitals', 'onlineDoctor', 'diagnostics', 'ambulance', 'caregivers', 'mentalHealth', 'ayurveda', 'homeopathy']
  }],
  
  // Service-specific coverage
  coverageDetails: {
    hospitals: { percentage: Number, maxAmount: Number },
    onlineDoctor: { percentage: Number, maxAmount: Number },
    diagnostics: { percentage: Number, maxAmount: Number },
    ambulance: { percentage: Number, maxAmount: Number },
    caregivers: { percentage: Number, maxAmount: Number },
    mentalHealth: { percentage: Number, maxAmount: Number },
    ayurveda: { percentage: Number, maxAmount: Number },
    homeopathy: { percentage: Number, maxAmount: Number }
  },
  
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
  
  // Network Providers
  networkHospitals: [{
    name: String,
    city: String,
    address: String,
    contactPhone: String,
    isPreferred: { type: Boolean, default: false }
  }],
  
  preferredLabs: [{
    name: String,
    city: String,
    contactPhone: String
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
    walletBalance: { type: Number, default: 0 },
    benefitsUsed: { type: Number, default: 0 },
    benefitsLimit: { type: Number, default: 0 },
    enrolledAt: { type: Date, default: Date.now }
  }],
  
  // Dependents
  dependents: [{
    employeeId: { type: String },
    name: { type: String },
    relation: { type: String, enum: ['spouse', 'child', 'parent', 'sibling'] },
    age: { type: Number },
    gender: { type: String },
    dateOfBirth: { type: Date },
    isActive: { type: Boolean, default: true }
  }],
  
  // Dates
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  renewalDate: { type: Date },
  coolingPeriod: { type: Number, default: 30 },
  
  // Pricing & Commission
  pricing: {
    basePremium: { type: Number, required: false, default: 0 },
    gstRate: { type: Number, default: 18 },
    discount: { type: Number, default: 0 },
    bulkDiscount: { type: Number, default: 0 },
    commission: { type: Number, default: 10 },
    platformFee: { type: Number, default: 2 },
    setupFee: { type: Number, default: 0 },
    minWalletTopup: { type: Number, default: 50000 }
  },
  
  // Payment Details
  paymentTerms: { type: String, enum: ['prepaid', 'postpaid', 'hybrid'], default: 'prepaid' },
  creditLimit: { type: Number, default: 0 },
  paymentDueDays: { type: Number, default: 30 },
  
  // Documents
  documents: [{
    type: { type: String },
    name: { type: String },
    url: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'pending', 'active', 'suspended', 'expired', 'cancelled'],
    default: 'pending'
  },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  verificationNotes: { type: String },
  
  // Admin
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
  approvedBy: { type: String },
  
  // HR Contact
  hrContact: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    designation: { type: String }
  },
  
  // Notifications
  notifications: [{
    type: { type: String, enum: ['renewal', 'wallet_low', 'employee_added', 'claim', 'payment'] },
    message: { type: String },
    sentAt: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false }
  }],
  
  // Activity Log
  activityLog: [{
    action: { type: String },
    performedBy: { type: String },
    details: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

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
const mongoose = require('mongoose');

const InsuranceCompanySchema = new mongoose.Schema({
  // Basic Information
  companyName: { type: String, required: true },
  legalName: { type: String, required: true },
  registrationNumber: { type: String, required: true, unique: true },
  irdaRegistration: { type: String, required: true, unique: true },
  gstNumber: { type: String, required: true },
  panNumber: { type: String, required: true },
  
  // Contact Details
  email: { type: String, required: true },
  phone: { type: String, required: true },
  website: { type: String },
  address: {
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' }
  },
  
  // Bank Details (For Settlements)
  bankDetails: {
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true },
    accountHolderName: { type: String, required: true },
    bankName: { type: String, required: true },
    branchName: { type: String }
  },
  
  // Documents
  documents: [{
    type: { 
      type: String, 
      enum: ['irda_certificate', 'gst_certificate', 'pan_card', 'bank_proof', 'registration_certificate']
    },
    url: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date }
  }],
  
  // Commission Settings
  commissionSettings: {
    defaultRate: { type: Number, default: 15 }, // Platform commission %
    settlementTerms: { 
      type: String, 
      enum: ['immediate', 'weekly', 'biweekly', 'monthly'],
      default: 'weekly'
    },
    settlementDay: { type: Number, default: 1 }, // Day of week/month
    minimumPayout: { type: Number, default: 1000 }
  },
  
  // Plan Management
  planApprovalRequired: { type: Boolean, default: true },
  autoApprovePlans: { type: Boolean, default: false },
  
  // Status
  status: {
    type: String,
    enum: ['pending_verification', 'verified', 'active', 'suspended', 'inactive'],
    default: 'pending_verification'
  },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  verifiedAt: { type: Date },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // API Integration
  apiConfig: {
    baseUrl: { type: String },
    apiKey: { type: String },
    apiSecret: { type: String },
    webhookUrl: { type: String },
    isActive: { type: Boolean, default: false }
  },
  
  // Branding
  logo: { type: String },
  bannerImage: { type: String },
  brandColor: { type: String, default: '#2563eb' },
  brandName: { type: String },
  
  // Metadata
  description: { type: String },
  foundedYear: { type: Number },
  numberOfEmployees: { type: Number },
  claimSettlementRatio: { type: Number, default: 0 }, // Percentage
  
  // Analytics
  totalPlans: { type: Number, default: 0 },
  totalPolicies: { type: Number, default: 0 },
  totalCustomers: { type: Number, default: 0 },
  totalCommission: { type: Number, default: 0 },
  
  // Audit
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// Indexes
InsuranceCompanySchema.index({ registrationNumber: 1 });
InsuranceCompanySchema.index({ irdaRegistration: 1 });
InsuranceCompanySchema.index({ email: 1 });
InsuranceCompanySchema.index({ status: 1 });
InsuranceCompanySchema.index({ isActive: 1 });
InsuranceCompanySchema.index({ 'bankDetails.ifscCode': 1 });

// Methods
InsuranceCompanySchema.methods.verify = function(adminId) {
  this.isVerified = true;
  this.verifiedAt = new Date();
  this.verifiedBy = adminId;
  this.status = 'verified';
  return this.save();
};

InsuranceCompanySchema.methods.activate = function() {
  this.isActive = true;
  this.status = 'active';
  return this.save();
};

InsuranceCompanySchema.methods.deactivate = function() {
  this.isActive = false;
  this.status = 'inactive';
  return this.save();
};

InsuranceCompanySchema.methods.suspend = function(reason) {
  this.isActive = false;
  this.status = 'suspended';
  this.suspensionReason = reason;
  return this.save();
};

InsuranceCompanySchema.methods.getCommissionRate = function(planType) {
  // Can have different rates for different plan types
  if (this.commissionSettings && this.commissionSettings[`${planType}Rate`]) {
    return this.commissionSettings[`${planType}Rate`];
  }
  return this.commissionSettings?.defaultRate || 15;
};

module.exports = mongoose.model('InsuranceCompany', InsuranceCompanySchema);
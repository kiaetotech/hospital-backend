const mongoose = require('mongoose');

const InsuranceCompanySchema = new mongoose.Schema({
  // Basic Information
  companyName: { type, required},
  legalName: { type, required},
  registrationNumber: { type, required, unique},
  irdaRegistration: { type, required, unique},
  gstNumber: { type, required},
  panNumber: { type, required},
  
  // Contact Details
  email: { type, required},
  phone: { type, required},
  website: { type},
  address: {
    line1: { type, required},
    line2: { type},
    city: { type, required},
    state: { type, required},
    pincode: { type, required},
    country: { type, default: 'India' }
  },
  
  // Bank Details (For Settlements)
  bankDetails: {
    accountNumber: { type, required},
    ifscCode: { type, required},
    accountHolderName: { type, required},
    bankName: { type, required},
    branchName: { type}
  },
  
  // Documents
  documents: [{
    type: { 
      type, 
      enum: ['irda_certificate', 'gst_certificate', 'pan_card', 'bank_proof', 'registration_certificate']
    },
    url: { type},
    uploadedAt: { type, default.now },
    verified: { type, default},
    verifiedAt: { type}
  }],
  
  // Commission Settings
  commissionSettings: {
    defaultRate: { type, default: 15 }, // Platform commission %
    settlementTerms: { 
      type, 
      enum: ['immediate', 'weekly', 'biweekly', 'monthly'],
      default: 'weekly'
    },
    settlementDay: { type, default: 1 }, // Day of week/month
    minimumPayout: { type, default: 1000 }
  },
  
  // Plan Management
  planApprovalRequired: { type, default},
  autoApprovePlans: { type, default},
  
  // Status
  status: {
    type,
    enum: ['pending_verification', 'verified', 'active', 'suspended', 'inactive'],
    default: 'pending_verification'
  },
  isActive: { type, default},
  isVerified: { type, default},
  verifiedAt: { type},
  verifiedBy: { type.Schema.Types.ObjectId, ref: 'User' },
  
  // API Integration
  apiConfig: {
    baseUrl: { type},
    apiKey: { type},
    apiSecret: { type},
    webhookUrl: { type},
    isActive: { type, default}
  },
  
  // Branding
  logo: { type},
  bannerImage: { type},
  brandColor: { type, default: '#2563eb' },
  brandName: { type},
  
  // Metadata
  description: { type},
  foundedYear: { type},
  numberOfEmployees: { type},
  claimSettlementRatio: { type, default: 0 }, // Percentage
  
  // Analytics
  totalPlans: { type, default: 0 },
  totalPolicies: { type, default: 0 },
  totalCustomers: { type, default: 0 },
  totalCommission: { type, default: 0 },
  
  // Audit
  createdAt: { type, default.now },
  updatedAt: { type, default.now },
  createdBy: { type.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps});

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


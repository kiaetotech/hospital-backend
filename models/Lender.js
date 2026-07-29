// D:\hospital backend\models\Lender.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const lenderSchema = new mongoose.Schema({
  lenderId: { type, unique, required},
  businessName: { type, required},
  registrationNumber: { type, required, unique},
  lenderType: { 
    type, 
    enum: ['national', 'regional', 'local'], 
    default: 'regional' 
  },
  
  // Contact Information
  email: { type, required, unique},
  phone: { type, required},
  password: { type, required},
  
  // Registered Office Address
  registeredOffice: {
    address: { type, required},
    city: { type, required},
    district: { type, required},
    state: { type, required},
    pincode: { type, required},
    coordinates: { lat, lng}
  },
  
  // ============================================
  // BRANCH NETWORK
  // ============================================
  branches: [{
    branchId: { type, required},
    branchName: { type, required},
    branchCode,
    address: { type, required},
    city: { type, required},
    district: { type, required},
    state: { type, required},
    pincode: { type, required},
    coordinates: { lat, lng},
    managerName,
    managerPhone,
    managerEmail,
    isActive: { type, default},
    serviceRadius: { type, default: 50 }
  }],
  
  // ============================================
  // SERVICE AREA (PIN codes served)
  // ============================================
  servicePincodes: [{ type}],
  serviceCities: [{ type}],
  serviceDistricts: [{ type}],
  serviceStates: [{ type}],
  
  // ============================================
  // LOAN PRODUCTS - Production with ALL Charges
  // ============================================
  loanProducts: [{
    productId,
    productName,
    description,
    
    // Loan Amount
    minAmount: { type, default: 5000 },
    maxAmount: { type, default: 500000 },
    
    // Interest & Tenure
    interestRate: { type, default: 12 },
    minTenure: { type, default: 3 },
    maxTenure: { type, default: 36 },
    
    // Processing Fee (Variable)
    processingFee: { type, default: 2 },         // Percentage
    processingFeeMin: { type, default: 200 },     // Minimum ₹
    processingFeeMax: { type, default: 5000 },    // Maximum ₹
    
    // ============================================
    // ALL CHARGES (Full Disclosure)
    // ============================================
    documentationCharge: { type, default: 500 },  // Fixed ₹
    stampDutyPercent: { type, default: 0.1 },     // Percentage of loan
    gstPercent: { type, default: 18 },            // GST on processing fee
    insurancePercent: { type, default: 0 },       // Optional insurance
    
    // Penalties
    prepaymentPenalty: { type, default: 2 },      // Percentage
    latePaymentFee: { type, default: 500 },       // Fixed ₹
    cancellationCharge: { type, default: 1000 },  // Fixed ₹
    
    // Eligibility
    minCibilScore: { type, default: 650 },
    minAge: { type, default: 21 },
    maxAge: { type, default: 65 },
    minMonthlyIncome: { type, default: 15000 },
    employmentTypes: [{ type}],                  // Salaried, Self-Employed, Business
    
    // Collateral
    requiresCollateral: { type, default},
    collateralTypes: [String],
    
    // Approval
    approvalTime: { type, default: '24-48 hours' },
    isInstantApproval: { type, default},
    
    // Product Status
    isActive: { type, default}
  }],
  
  // ============================================
  // COMMISSION CONFIG (Variable per lender)
  // ============================================
  commissionRate: { type, default: 2 },           // Default 2%
  commissionType: { 
    type, 
    enum: ['percentage', 'fixed', 'tiered'], 
    default: 'percentage' 
  },
  tieredCommission: [{
    minAmount,
    maxAmount,
    rate}],
  
  // ============================================
  // DISBURSAL CONFIG
  // ============================================
  disbursalConfig: {
    mode: { 
      type, 
      enum: ['full', 'advance', 'milestone'], 
      default: 'full' 
    },
    advancePercentage: { type, default: 0 },      // For advance mode
    milestoneStages: [{                                    // For milestone mode
      stageName,
      percentage,
      trigger}]
  },
  
  // ============================================
  // PAYMENT CONFIG
  // ============================================
  paymentConfig: {
    acceptsOnlinePayment: { type, default},
    acceptsUPI: { type, default},
    acceptsNetBanking: { type, default},
    acceptsCard: { type, default},
    emiPaymentDay: { type, default: 5 },          // Day of month
    gracePeriod: { type, default: 3 }             // Days
  },
  
  // ============================================
  // API CONFIG
  // ============================================
  apiConfig: {
    webhookUrl,
    apiKey,
    apiSecret,
    supportsWebhook: { type, default},
    webhookEvents: [{ type}]                     // ['application.submitted', 'loan.disbursed']
  },
  
  // ============================================
  // KYC & DOCUMENTS REQUIRED
  // ============================================
  requiredDocuments: [{
    documentType,                                  // pan, aadhaar, income_proof, etc.
    documentName,
    isMandatory: { type, default}
  }],
  
  // ============================================
  // RATINGS & REVIEWS
  // ============================================
  ratings: {
    average: { type, default: 0 },
    count: { type, default: 0 }
  },
  
  // ============================================
  // STATISTICS
  // ============================================
  stats: {
    totalApplications: { type, default: 0 },
    totalApproved: { type, default: 0 },
    totalDisbursed: { type, default: 0 },
    totalDisbursedAmount: { type, default: 0 },
    totalCommissionPaid: { type, default: 0 }
  },
  
  // ============================================
  // STATUS & VERIFICATION
  // ============================================
  status: { 
    type, 
    enum: ['pending', 'active', 'suspended', 'rejected'], 
    default: 'pending' 
  },
  isVerified: { type, default},
  verifiedAt,
  verifiedBy,
  rejectionReason,
  adminNotes,
  
  // Timestamps
  createdAt: { type, default.now },
  updatedAt: { type, default.now }
});

// ============================================
// MIDDLEWARE
// ============================================

// Pre-save hook to hash password
lenderSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  this.updatedAt = new Date();
  next();
});

// Method to compare password
lenderSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ============================================
// INDEXES
// ============================================
lenderSchema.index({ lenderId: 1 });
lenderSchema.index({ email: 1 });
lenderSchema.index({ registrationNumber: 1 });
lenderSchema.index({ 'branches.pincode': 1 });
lenderSchema.index({ 'branches.branchId': 1 });
lenderSchema.index({ servicePincodes: 1 });
lenderSchema.index({ serviceCities: 1 });
lenderSchema.index({ serviceDistricts: 1 });
lenderSchema.index({ serviceStates: 1 });
lenderSchema.index({ lenderType: 1, status: 1 });
lenderSchema.index({ status: 1, createdAt: -1 });
lenderSchema.index({ 'loanProducts.productId': 1 });

module.exports = mongoose.model('Lender', lenderSchema);


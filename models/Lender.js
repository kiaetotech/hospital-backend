// D:\hospital backend\models\Lender.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const lenderSchema = new mongoose.Schema({
  lenderId: { type: String, unique: true, required: true },
  businessName: { type: String, required: true },
  registrationNumber: { type: String, required: true, unique: true },
  lenderType: { 
    type: String, 
    enum: ['national', 'regional', 'local'], 
    default: 'regional' 
  },
  
  // Contact Information
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  
  // Registered Office Address
  registeredOffice: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    coordinates: { lat: Number, lng: Number }
  },
  
  // ============================================
  // BRANCH NETWORK
  // ============================================
  branches: [{
    branchId: { type: String, required: true },
    branchName: { type: String, required: true },
    branchCode: String,
    address: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    coordinates: { lat: Number, lng: Number },
    managerName: String,
    managerPhone: String,
    managerEmail: String,
    isActive: { type: Boolean, default: true },
    serviceRadius: { type: Number, default: 50 }
  }],
  
  // ============================================
  // SERVICE AREA (PIN codes served)
  // ============================================
  servicePincodes: [{ type: String }],
  serviceCities: [{ type: String }],
  serviceDistricts: [{ type: String }],
  serviceStates: [{ type: String }],
  
  // ============================================
  // LOAN PRODUCTS - Production with ALL Charges
  // ============================================
  loanProducts: [{
    productId: String,
    productName: String,
    description: String,
    
    // Loan Amount
    minAmount: { type: Number, default: 5000 },
    maxAmount: { type: Number, default: 500000 },
    
    // Interest & Tenure
    interestRate: { type: Number, default: 12 },
    minTenure: { type: Number, default: 3 },
    maxTenure: { type: Number, default: 36 },
    
    // Processing Fee (Variable)
    processingFee: { type: Number, default: 2 },         // Percentage
    processingFeeMin: { type: Number, default: 200 },     // Minimum ₹
    processingFeeMax: { type: Number, default: 5000 },    // Maximum ₹
    
    // ============================================
    // ALL CHARGES (Full Disclosure)
    // ============================================
    documentationCharge: { type: Number, default: 500 },  // Fixed ₹
    stampDutyPercent: { type: Number, default: 0.1 },     // Percentage of loan
    gstPercent: { type: Number, default: 18 },            // GST on processing fee
    insurancePercent: { type: Number, default: 0 },       // Optional insurance
    
    // Penalties
    prepaymentPenalty: { type: Number, default: 2 },      // Percentage
    latePaymentFee: { type: Number, default: 500 },       // Fixed ₹
    cancellationCharge: { type: Number, default: 1000 },  // Fixed ₹
    
    // Eligibility
    minCibilScore: { type: Number, default: 650 },
    minAge: { type: Number, default: 21 },
    maxAge: { type: Number, default: 65 },
    minMonthlyIncome: { type: Number, default: 15000 },
    employmentTypes: [{ type: String }],                  // Salaried, Self-Employed, Business
    
    // Collateral
    requiresCollateral: { type: Boolean, default: false },
    collateralTypes: [String],
    
    // Approval
    approvalTime: { type: String, default: '24-48 hours' },
    isInstantApproval: { type: Boolean, default: false },
    
    // Product Status
    isActive: { type: Boolean, default: true }
  }],
  
  // ============================================
  // COMMISSION CONFIG (Variable per lender)
  // ============================================
  commissionRate: { type: Number, default: 2 },           // Default 2%
  commissionType: { 
    type: String, 
    enum: ['percentage', 'fixed', 'tiered'], 
    default: 'percentage' 
  },
  tieredCommission: [{
    minAmount: Number,
    maxAmount: Number,
    rate: Number
  }],
  
  // ============================================
  // DISBURSAL CONFIG
  // ============================================
  disbursalConfig: {
    mode: { 
      type: String, 
      enum: ['full', 'advance', 'milestone'], 
      default: 'full' 
    },
    advancePercentage: { type: Number, default: 0 },      // For advance mode
    milestoneStages: [{                                    // For milestone mode
      stageName: String,
      percentage: Number,
      trigger: String
    }]
  },
  
  // ============================================
  // PAYMENT CONFIG
  // ============================================
  paymentConfig: {
    acceptsOnlinePayment: { type: Boolean, default: true },
    acceptsUPI: { type: Boolean, default: true },
    acceptsNetBanking: { type: Boolean, default: true },
    acceptsCard: { type: Boolean, default: true },
    emiPaymentDay: { type: Number, default: 5 },          // Day of month
    gracePeriod: { type: Number, default: 3 }             // Days
  },
  
  // ============================================
  // API CONFIG
  // ============================================
  apiConfig: {
    webhookUrl: String,
    apiKey: String,
    apiSecret: String,
    supportsWebhook: { type: Boolean, default: false },
    webhookEvents: [{ type: String }]                     // ['application.submitted', 'loan.disbursed']
  },
  
  // ============================================
  // KYC & DOCUMENTS REQUIRED
  // ============================================
  requiredDocuments: [{
    documentType: String,                                  // pan, aadhaar, income_proof, etc.
    documentName: String,
    isMandatory: { type: Boolean, default: true }
  }],
  
  // ============================================
  // RATINGS & REVIEWS
  // ============================================
  ratings: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  
  // ============================================
  // STATISTICS
  // ============================================
  stats: {
    totalApplications: { type: Number, default: 0 },
    totalApproved: { type: Number, default: 0 },
    totalDisbursed: { type: Number, default: 0 },
    totalDisbursedAmount: { type: Number, default: 0 },
    totalCommissionPaid: { type: Number, default: 0 }
  },
  
  // ============================================
  // STATUS & VERIFICATION
  // ============================================
  status: { 
    type: String, 
    enum: ['pending', 'active', 'suspended', 'rejected'], 
    default: 'pending' 
  },
  isVerified: { type: Boolean, default: false },
  verifiedAt: Date,
  verifiedBy: String,
  rejectionReason: String,
  adminNotes: String,
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
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
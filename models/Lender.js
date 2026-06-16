const mongoose = require('mongoose');

const lenderSchema = new mongoose.Schema({
  lenderId: { type: String, unique: true, required: true },
  businessName: { type: String, required: true },
  registrationNumber: { type: String, required: true, unique: true },
  lenderType: { type: String, enum: ['national', 'regional', 'local'], default: 'regional' },
  
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
  // BRANCH NETWORK (Key for location-based assignment)
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
    serviceRadius: { type: Number, default: 50 } // KM radius this branch serves
  }],
  
  // ============================================
  // SERVICE AREA (PIN codes served)
  // ============================================
  servicePincodes: [{ type: String }], // List of PIN codes served
  serviceCities: [{ type: String }],
  serviceDistricts: [{ type: String }],
  serviceStates: [{ type: String }],
  
  // ============================================
  // LOAN PRODUCTS
  // ============================================
  loanProducts: [{
    productId: String,
    productName: String,
    minAmount: Number,
    maxAmount: Number,
    interestRate: Number,
    minTenure: Number,
    maxTenure: Number,
    processingFee: Number,
    minCibilScore: Number,
    requiresCollateral: Boolean,
    collateralTypes: [String],
    approvalTime: String,
    description: String
  }],
  
  // ============================================
  // COMMISSION & API CONFIG
  // ============================================
  commissionRate: { type: Number, default: 2 },
  apiConfig: {
    webhookUrl: String,
    apiKey: String,
    apiSecret: String,
    supportsWebhook: { type: Boolean, default: false }
  },
  
  // ============================================
  // STATUS
  // ============================================
  status: { type: String, enum: ['pending', 'active', 'suspended', 'rejected'], default: 'pending' },
  verifiedAt: Date,
  verifiedBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for location-based queries
lenderSchema.index({ 'branches.pincode': 1 });
lenderSchema.index({ servicePincodes: 1 });
lenderSchema.index({ lenderType: 1, status: 1 });

module.exports = mongoose.model('Lender', lenderSchema);
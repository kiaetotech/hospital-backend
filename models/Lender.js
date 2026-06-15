const mongoose = require('mongoose');

const lenderSchema = new mongoose.Schema({
  lenderId: { type: String, unique: true, required: true },
  businessName: { type: String, required: true },
  registrationNumber: { type: String, required: true, unique: true },
  lenderType: { type: String, enum: ['national', 'regional', 'local'], default: 'regional' },
  
  // Contact
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  
  // Address
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  
  // Service Areas (PIN codes this lender serves)
  servicePincodes: [{ type: String }],
  serviceCities: [{ type: String }],
  serviceStates: [{ type: String }],
  
  // Loan Products
  loanProducts: [{
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
  
  // Commission agreed with platform
  commissionRate: { type: Number, default: 2 }, // percentage
  
  // API Configuration for webhooks
  apiConfig: {
    webhookUrl: String,
    apiKey: String,
    apiSecret: String
  },
  
  // Status
  status: { type: String, enum: ['pending', 'active', 'suspended', 'rejected'], default: 'pending' },
  verifiedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Lender', lenderSchema);
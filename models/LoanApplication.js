const mongoose = require('mongoose');

const loanApplicationSchema = new mongoose.Schema({
  applicationId: { type: String, unique: true, required: true },
  patientId: { type: String, required: true },
  lenderId: { type: String, required: true },
  
  // Patient Details (snapshot at application time)
  patientDetails: {
    fullName: String,
    phone: String,
    email: String,
    pan: String,
    aadhaar: String,
    address: String,
    pincode: String
  },
  
  // Treatment Details
  treatmentType: String,
  hospitalName: String,
  hospitalAddress: String,
  estimatedAmount: Number,  // From tentative bill
  finalBillAmount: Number,   // After treatment
  
  // Loan Details
  sanctionedAmount: Number,  // Lender approved amount
  disbursedAmount: Number,    // Actual amount paid to hospital
  tenure: Number,
  emi: Number,
  interestRate: Number,
  
  // Documents (URLs from cloud storage)
  documents: {
    tentativeEstimate: String,
    finalBill: String,
    panCard: String,
    aadhaarCard: String,
    salarySlip: String,
    bankStatement: String
  },
  
  // Collateral (if secured loan)
  collateral: {
    type: String,
    value: Number,
    description: String,
    documentUrl: String
  },
  
  // Status Tracking
  status: { 
    type: String, 
    enum: ['draft', 'submitted', 'document_pending', 'under_review', 'approved', 'rejected', 'disbursed', 'completed'],
    default: 'draft'
  },
  
  statusHistory: [{
    status: String,
    note: String,
    updatedBy: String,  // 'patient', 'lender', 'system'
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Lender Requests
  lenderRequests: [{
    requestId: String,
    requestType: String,  // 'document', 'information'
    description: String,
    requestedAt: Date,
    respondedAt: Date,
    response: String,
    status: { type: String, enum: ['pending', 'responded'], default: 'pending' }
  }],
  
  // Commission
  platformCommission: Number,  // Amount earned by platform
  commissionPaid: { type: Boolean, default: false },
  
  // Timelines
  submittedAt: Date,
  approvedAt: Date,
  rejectedAt: Date,
  disbursedAt: Date,
  completedAt: Date,
  
  // External reference from lender's system
  externalReferenceId: String
});

module.exports = mongoose.model('LoanApplication', loanApplicationSchema);
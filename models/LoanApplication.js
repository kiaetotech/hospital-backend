const mongoose = require('mongoose');

const loanApplicationSchema = new mongoose.Schema({
  applicationId: { type: String, unique: true, required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  lenderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lender', required: true },
  
  // ============================================
  // ASSIGNED BRANCH (Location-based assignment)
  // ============================================
  assignedBranchId: { type: String }, // Which branch of lender is handling this
  assignedBranchName: { type: String },
  assignedBranchAddress: { type: String },
  assignedBranchPincode: { type: String },
  assignedBranchManager: { type: String },
  assignmentReason: { type: String }, // 'pincode_match', 'nearest_branch', 'district_match', 'state_match'
  
  // Patient Location (for assignment tracking)
  patientLocation: {
    pincode: { type: String, required: true },
    city: String,
    district: String,
    state: String,
    coordinates: { lat: Number, lng: Number }
  },
  
  // Patient Details (snapshot)
  patientDetails: {
    fullName: String,
    phone: String,
    email: String,
    pan: String,
    aadhaar: String,
    address: String,
    pincode: String,
    city: String,
    district: String,
    state: String
  },
  
  // Treatment Details
  treatmentType: String,
  hospitalName: String,
  hospitalAddress: String,
  estimatedAmount: Number,
  finalBillAmount: Number,
  
  // Loan Details
  sanctionedAmount: Number,
  disbursedAmount: Number,
  patientLiability: Number, // If final bill > sanctioned, patient pays this
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
  
  // ============================================
  // STATUS TRACKING
  // ============================================
  status: { 
    type: String, 
    enum: ['draft', 'submitted', 'document_pending', 'under_review', 'approved', 'rejected', 'pending_disbursal', 'disbursed', 'completed'],
    default: 'draft'
  },
  
  statusHistory: [{
    status: String,
    note: String,
    updatedBy: String,
    updatedByRole: String,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Lender Communication
  lenderRequests: [{
    requestId: String,
    requestType: String,
    description: String,
    requestedAt: Date,
    respondedAt: Date,
    response: String,
    status: { type: String, enum: ['pending', 'responded'], default: 'pending' }
  }],
  
  // Financials
  platformCommission: Number,
  commissionPaid: { type: Boolean, default: false },
  commissionPaidAt: Date,
  
  // Timelines
  submittedAt: Date,
  assignedAt: Date,
  approvedAt: Date,
  rejectedAt: Date,
  disbursedAt: Date,
  
  // External reference
  externalReferenceId: String,
  lastSyncAt: Date
});

// Indexes for efficient queries
loanApplicationSchema.index({ patientId: 1 });
loanApplicationSchema.index({ lenderId: 1 });
loanApplicationSchema.index({ assignedBranchId: 1 });
loanApplicationSchema.index({ status: 1 });
loanApplicationSchema.index({ 'patientLocation.pincode': 1 });
loanApplicationSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('LoanApplication', loanApplicationSchema);
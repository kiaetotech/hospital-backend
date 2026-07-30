const mongoose = require('mongoose');

const loanApplicationSchema = new mongoose.Schema({
  applicationId: { type: String, unique: true, required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  lenderId: { type: String, required: true },
  
  // ============================================
  // ASSIGNED BRANCH (Location-based assignment)
  // ============================================
  assignedBranchId: { type: String, default: '' },
  assignedBranchName: { type: String, default: '' },
  assignedBranchAddress: { type: String, default: '' },
  assignedBranchPincode: { type: String, default: '' },
  assignedBranchManager: { type: String, default: '' },
  assignmentReason: { type: String, default: '' },
  
  // Patient Location (for assignment tracking)
  patientLocation: {
    pincode: { type: String, default: '' },
    city: { type: String, default: '' },
    district: { type: String, default: '' },
    state: { type: String, default: '' },
    coordinates: { lat: Number, lng: Number }
  },
  
  // Patient Details (snapshot)
  patientDetails: {
    fullName: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    pan: { type: String, default: '' },
    aadhaar: { type: String, default: '' },
    address: { type: String, default: '' },
    pincode: { type: String, default: '' },
    city: { type: String, default: '' },
    district: { type: String, default: '' },
    state: { type: String, default: '' }
  },
  
  // Treatment Details
  treatmentType: { type: String, default: '' },
  hospitalName: { type: String, default: '' },
  hospitalAddress: { type: String, default: '' },
  estimatedAmount: { type: Number, default: 0 },
  finalBillAmount: { type: Number, default: 0 },
  
  // Loan Details
  sanctionedAmount: { type: Number, default: 0 },
  disbursedAmount: { type: Number, default: 0 },
  patientLiability: { type: Number, default: 0 },
  tenure: { type: Number, default: 0 },
  emi: { type: Number, default: 0 },
  interestRate: { type: Number, default: 0 },
  
  // Documents (URLs from cloud storage)
  documents: {
    tentativeEstimate: { type: String, default: '' },
    finalBill: { type: String, default: '' },
    panCard: { type: String, default: '' },
    aadhaarCard: { type: String, default: '' },
    salarySlip: { type: String, default: '' },
    bankStatement: { type: String, default: '' }
  },
  
  // Collateral (if secured loan)
  collateral: {
    type: { type: String, default: '' },
    value: { type: String, default: '' },
    description: { type: String, default: '' },
    documentUrl: { type: String, default: '' }
  },
  
  // ============================================
  // STATUS TRACKING
  // ============================================
  status: { 
    type: String, 
    enum: ['draft', 'submitted', 'document_pending', 'under_review', 'approved', 'rejected', 'pending_disbursal', 'disbursed', 'completed'],
    default: 'submitted'
  },
  
  statusHistory: [{
    status: { type: String, default: '' },
    note: { type: String, default: '' },
    updatedBy: { type: String, default: '' },
    updatedByRole: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Lender Communication
  lenderRequests: [{
    requestId: { type: String, default: '' },
    requestType: { type: String, default: '' },
    description: { type: String, default: '' },
    requestedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date },
    response: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'responded'], default: 'pending' }
  }],
  
  // Financials
  platformCommission: { type: Number, default: 0 },
  commissionPaid: { type: Boolean, default: false },
  commissionPaidAt: { type: Date },
  
  // Timelines
  submittedAt: { type: Date, default: Date.now },
  assignedAt: { type: Date },
  approvedAt: { type: Date },
  rejectedAt: { type: Date },
  disbursedAt: { type: Date },
  
  // External reference
  externalReferenceId: { type: String, default: '' },
  lastSyncAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
loanApplicationSchema.index({ patientId: 1 });
loanApplicationSchema.index({ lenderId: 1 });
loanApplicationSchema.index({ assignedBranchId: 1 });
loanApplicationSchema.index({ status: 1 });
loanApplicationSchema.index({ 'patientLocation.pincode': 1 });
loanApplicationSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('LoanApplication', loanApplicationSchema);
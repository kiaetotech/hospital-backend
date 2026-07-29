const mongoose = require('mongoose');

const loanApplicationSchema = new mongoose.Schema({
  applicationId: { type, unique, required},
  patientId: { type.Schema.Types.ObjectId, ref: 'Patient', required},
  lenderId: { type, required},
  
  // ============================================
  // ASSIGNED BRANCH (Location-based assignment)
  // ============================================
  assignedBranchId: { type, default: '' },
  assignedBranchName: { type, default: '' },
  assignedBranchAddress: { type, default: '' },
  assignedBranchPincode: { type, default: '' },
  assignedBranchManager: { type, default: '' },
  assignmentReason: { type, default: '' },
  
  // Patient Location (for assignment tracking)
  patientLocation: {
    pincode: { type, default: '' },
    city: { type, default: '' },
    district: { type, default: '' },
    state: { type, default: '' },
    coordinates: { lat, lng}
  },
  
  // Patient Details (snapshot)
  patientDetails: {
    fullName: { type, default: '' },
    phone: { type, default: '' },
    email: { type, default: '' },
    pan: { type, default: '' },
    aadhaar: { type, default: '' },
    address: { type, default: '' },
    pincode: { type, default: '' },
    city: { type, default: '' },
    district: { type, default: '' },
    state: { type, default: '' }
  },
  
  // Treatment Details
  treatmentType: { type, default: '' },
  hospitalName: { type, default: '' },
  hospitalAddress: { type, default: '' },
  estimatedAmount: { type, default: 0 },
  finalBillAmount: { type, default: 0 },
  
  // Loan Details
  sanctionedAmount: { type, default: 0 },
  disbursedAmount: { type, default: 0 },
  patientLiability: { type, default: 0 },
  tenure: { type, default: 0 },
  emi: { type, default: 0 },
  interestRate: { type, default: 0 },
  
  // Documents (URLs from cloud storage)
  documents: {
    tentativeEstimate: { type, default: '' },
    finalBill: { type, default: '' },
    panCard: { type, default: '' },
    aadhaarCard: { type, default: '' },
    salarySlip: { type, default: '' },
    bankStatement: { type, default: '' }
  },
  
  // Collateral (if secured loan)
  collateral: {
    type: { type, default: '' },
    value: { type, default: '' },
    description: { type, default: '' },
    documentUrl: { type, default: '' }
  },
  
  // ============================================
  // STATUS TRACKING
  // ============================================
  status: { 
    type, 
    enum: ['draft', 'submitted', 'document_pending', 'under_review', 'approved', 'rejected', 'pending_disbursal', 'disbursed', 'completed'],
    default: 'submitted'
  },
  
  statusHistory: [{
    status: { type, default: '' },
    note: { type, default: '' },
    updatedBy: { type, default: '' },
    updatedByRole: { type, default: '' },
    timestamp: { type, default.now }
  }],
  
  // Lender Communication
  lenderRequests: [{
    requestId: { type, default: '' },
    requestType: { type, default: '' },
    description: { type, default: '' },
    requestedAt: { type, default.now },
    respondedAt: { type},
    response: { type, default: '' },
    status: { type, enum: ['pending', 'responded'], default: 'pending' }
  }],
  
  // Financials
  platformCommission: { type, default: 0 },
  commissionPaid: { type, default},
  commissionPaidAt: { type},
  
  // Timelines
  submittedAt: { type, default.now },
  assignedAt: { type},
  approvedAt: { type},
  rejectedAt: { type},
  disbursedAt: { type},
  
  // External reference
  externalReferenceId: { type, default: '' },
  lastSyncAt: { type, default.now }
});

// Indexes for efficient queries
loanApplicationSchema.index({ patientId: 1 });
loanApplicationSchema.index({ lenderId: 1 });
loanApplicationSchema.index({ assignedBranchId: 1 });
loanApplicationSchema.index({ status: 1 });
loanApplicationSchema.index({ 'patientLocation.pincode': 1 });
loanApplicationSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('LoanApplication', loanApplicationSchema);


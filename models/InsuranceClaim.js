const mongoose = require('mongoose');

const InsuranceClaimSchema = new mongoose.Schema({
  // References
  policyId: { 
    type.Schema.Types.ObjectId, 
    ref: 'InsurancePolicy', 
    required},
  bookingId: { 
    type.Schema.Types.ObjectId, 
    ref: 'Booking' 
  },
  companyId: { 
    type.Schema.Types.ObjectId, 
    ref: 'InsuranceCompany', 
    required},
  userId: { 
    type.Schema.Types.ObjectId, 
    ref: 'User', 
    required},
  
  // Claim Details
  claimNumber: { type, unique},
  claimType: {
    type,
    enum: ['cashless', 'reimbursement'],
    required},
  amount: { type, required},
  approvedAmount: { type, default: 0 },
  description: { type, required},
  
  // Hospital Details
  hospitalName: { type, required},
  hospitalAddress: { type},
  hospitalCity: { type},
  hospitalPincode: { type},
  admissionDate: { type, required},
  dischargeDate: { type},
  diagnosis: { type},
  treatment: { type},
  
  // Documents
  documents: [{
    name: { type},
    url: { type},
    type: { 
      type, 
      enum: ['medical_bill', 'discharge_summary', 'prescription', 'lab_report', 'other']
    },
    uploadedAt: { type, default.now }
  }],
  
  // Status Tracking
  status: {
    type,
    enum: [
      'submitted', 
      'document_uploaded', 
      'under_review', 
      'pending_verification',
      'approved', 
      'rejected', 
      'settled', 
      'partially_settled',
      'cancelled'
    ],
    default: 'submitted'
  },
  
  // Timeline
  timeline: [{
    status: { type},
    date: { type, default.now },
    note: { type},
    performedBy: { type.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  // Approvals
  approvedBy: { type.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type},
  rejectedReason: { type},
  rejectedAt: { type},
  
  // Settlement
  settlementAmount: { type},
  settlementDate: { type},
  settlementReference: { type},
  settlementMode: {
    type,
    enum: ['bank_transfer', 'cheque', 'online'],
    default: 'bank_transfer'
  },
  
  // Insurer Communication
  insurerClaimId: { type},
  insurerResponse: { type.Schema.Types.Mixed },
  insurerCommunication: [{
    date: { type, default.now },
    message: { type},
    from: { type},
    direction: { type, enum: ['incoming', 'outgoing'] }
  }],
  
  // Grievance
  isGrievance: { type, default},
  grievanceRaisedAt: { type},
  grievanceResolvedAt: { type},
  
  // Escalation
  escalationLevel: {
    type,
    enum: ['normal', 'escalated', 'critical'],
    default: 'normal'
  },
  
  // Audit
  createdAt: { type, default.now },
  updatedAt: { type, default.now },
  submittedBy: { type.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps});

// Auto-generate claim number
InsuranceClaimSchema.pre('save', function(next) {
  if (!this.claimNumber) {
    const prefix = 'CLM';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.claimNumber = `${prefix}${timestamp}${random}`;
  }
  next();
});

// Indexes
InsuranceClaimSchema.index({ claimNumber: 1 });
InsuranceClaimSchema.index({ policyId: 1 });
InsuranceClaimSchema.index({ userId: 1 });
InsuranceClaimSchema.index({ companyId: 1 });
InsuranceClaimSchema.index({ status: 1 });
InsuranceClaimSchema.index({ 'timeline.date': -1 });

// Methods
InsuranceClaimSchema.methods.addTimeline = function(status, note, performedBy) {
  this.timeline.push({
    status|| this.status,
    dateDate(),
    note|| '',
    performedBy});
  return this.save();
};

InsuranceClaimSchema.methods.updateStatus = function(status, note, performedBy) {
  this.status = status;
  this.updatedAt = new Date();
  return this.addTimeline(status, note, performedBy);
};

InsuranceClaimSchema.methods.approve = function(approvedAmount, performedBy) {
  this.status = 'approved';
  this.approvedAmount = approvedAmount || this.amount;
  this.approvedBy = performedBy;
  this.approvedAt = new Date();
  this.updatedAt = new Date();
  return this.addTimeline('approved', `Approved for ₹${this.approvedAmount}`, performedBy);
};

InsuranceClaimSchema.methods.reject = function(reason, performedBy) {
  this.status = 'rejected';
  this.rejectedReason = reason;
  this.rejectedAt = new Date();
  this.updatedAt = new Date();
  return this.addTimeline('rejected', reason, performedBy);
};

InsuranceClaimSchema.methods.settle = function(settlementAmount, reference, performedBy) {
  this.status = 'settled';
  this.settlementAmount = settlementAmount || this.approvedAmount;
  this.settlementDate = new Date();
  this.settlementReference = reference;
  this.updatedAt = new Date();
  return this.addTimeline('settled', `Settled for ₹${this.settlementAmount}`, performedBy);
};

module.exports = mongoose.model('InsuranceClaim', InsuranceClaimSchema);


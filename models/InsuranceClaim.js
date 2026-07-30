const mongoose = require('mongoose');

const InsuranceClaimSchema = new mongoose.Schema({
  // References
  policyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'InsurancePolicy', 
    required: true 
  },
  bookingId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Booking' 
  },
  companyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'InsuranceCompany', 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Claim Details
  claimNumber: { type: String, unique: true },
  claimType: {
    type: String,
    enum: ['cashless', 'reimbursement'],
    required: true
  },
  amount: { type: Number, required: true },
  approvedAmount: { type: Number, default: 0 },
  description: { type: String, required: true },
  
  // Hospital Details
  hospitalName: { type: String, required: true },
  hospitalAddress: { type: String },
  hospitalCity: { type: String },
  hospitalPincode: { type: String },
  admissionDate: { type: Date, required: true },
  dischargeDate: { type: Date },
  diagnosis: { type: String },
  treatment: { type: String },
  
  // Documents
  documents: [{
    name: { type: String },
    url: { type: String },
    type: { 
      type: String, 
      enum: ['medical_bill', 'discharge_summary', 'prescription', 'lab_report', 'other']
    },
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // Status Tracking
  status: {
    type: String,
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
    status: { type: String },
    date: { type: Date, default: Date.now },
    note: { type: String },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  // Approvals
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  rejectedReason: { type: String },
  rejectedAt: { type: Date },
  
  // Settlement
  settlementAmount: { type: Number },
  settlementDate: { type: Date },
  settlementReference: { type: String },
  settlementMode: {
    type: String,
    enum: ['bank_transfer', 'cheque', 'online'],
    default: 'bank_transfer'
  },
  
  // Insurer Communication
  insurerClaimId: { type: String },
  insurerResponse: { type: mongoose.Schema.Types.Mixed },
  insurerCommunication: [{
    date: { type: Date, default: Date.now },
    message: { type: String },
    from: { type: String },
    direction: { type: String, enum: ['incoming', 'outgoing'] }
  }],
  
  // Grievance
  isGrievance: { type: Boolean, default: false },
  grievanceRaisedAt: { type: Date },
  grievanceResolvedAt: { type: Date },
  
  // Escalation
  escalationLevel: {
    type: String,
    enum: ['normal', 'escalated', 'critical'],
    default: 'normal'
  },
  
  // Audit
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

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
    status: status || this.status,
    date: new Date(),
    note: note || '',
    performedBy: performedBy
  });
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
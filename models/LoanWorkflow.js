// D:\hospital backend\models\LoanWorkflow.js
// ============================================
// LOAN WORKFLOW MODEL
// ============================================
// Sub-documents capturing the full lifecycle of a loan application:
//   - offers[]         — lender offers (versioned, expiring)
//   - agreements[]     — eSign records
//   - disbursements[]  — real money movement records
//   - mandates[]       — eNACH / UPI Autopay
//
// One document per LoanApplication, linked by applicationId.
// All sub-documents are append-only (never modified after creation).
// Status changes tracked in LoanApplication.statusHistory.
// ============================================

const mongoose = require('mongoose');

// ============================================
// OFFER SUB-SCHEMA
// ============================================
const offerSchema = new mongoose.Schema({
  offerId: { type: String, required: true },
  version: { type: Number, default: 1 },

  // Offer terms
  sanctionedAmount: { type: Number, required: true, min: 0 },
  interestRate: { type: Number, required: true, min: 0, max: 100 },
  tenureMonths: { type: Number, required: true, min: 1 },
  emi: { type: Number, required: true, min: 0 },
  processingFee: { type: Number, default: 0, min: 0 },
  totalPayable: { type: Number, default: 0, min: 0 },

  // Validity
  validUntil: { type: Date, required: true },
  issuedAt: { type: Date, default: Date.now },

  // Lifecycle
  status: {
    type: String,
    enum: ['issued', 'accepted', 'declined', 'expired', 'withdrawn', 'superseded'],
    default: 'issued',
  },
  acceptedAt: { type: Date, default: null },
  declinedAt: { type: Date, default: null },
  declineReason: { type: String, default: '' },
  expiredAt: { type: Date, default: null },
  withdrawnAt: { type: Date, default: null },
  withdrawalReason: { type: String, default: '' },
  supersededBy: { type: String, default: null }, // offerId of the newer version

  // Audit
  issuedBy: { type: String, default: 'system' },
  issuedByRole: { type: String, default: 'system' },
  notes: { type: String, default: '' },
}, { _id: true });

// ============================================
// AGREEMENT SUB-SCHEMA
// ============================================
const agreementSchema = new mongoose.Schema({
  agreementId: { type: String, required: true },
  offerId: { type: String, required: true },

  // Signing
  status: {
    type: String,
    enum: ['pending', 'initiated', 'signed', 'rejected', 'expired', 'cancelled'],
    default: 'pending',
  },
  initiatedAt: { type: Date, default: null },
  signedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },

  // eSign provider details
  esignProvider: {
    type: String,
    enum: ['digio', 'leegality', 'nsdl', 'manual', 'none'],
    default: 'none',
  },
  esignReferenceId: { type: String, default: '' }, // Provider's reference ID
  esignDocumentUrl: { type: String, default: '' }, // Signed PDF URL
  esignCertificateUrl: { type: String, default: '' }, // Digital signature cert

  // Evidence
  signedByLender: { type: Boolean, default: false },
  signedByPatient: { type: Boolean, default: false },
  lenderSignatory: { type: String, default: '' },
  patientSignatory: { type: String, default: '' },

  // Audit
  initiatedBy: { type: String, default: 'system' },
  cancelledReason: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { _id: true });

// ============================================
// DISBURSEMENT SUB-SCHEMA
// ============================================
const disbursementSchema = new mongoose.Schema({
  disbursementId: { type: String, required: true },
  agreementId: { type: String, required: true },

  // Amount
  amount: { type: Number, required: true, min: 0 },
  patientLiability: { type: Number, default: 0, min: 0 }, // Amount patient pays directly

  // Bank details
  mode: {
    type: String,
    enum: ['neft', 'rtgs', 'imps', 'upi', 'bank_transfer', 'cheque'],
    required: true,
  },
  utrNumber: { type: String, required: true, index: true },
  bankReference: { type: String, default: '' },

  // Destination
  beneficiaryType: {
    type: String,
    enum: ['hospital', 'patient', 'provider'],
    default: 'hospital',
  },
  beneficiaryName: { type: String, required: true },
  beneficiaryAccount: { type: String, default: '' },
  beneficiaryIfsc: { type: String, default: '' },

  // Lifecycle
  status: {
    type: String,
    enum: ['initiated', 'confirmed', 'failed', 'reconciled', 'reversed'],
    default: 'initiated',
  },
  initiatedAt: { type: Date, default: Date.now },
  confirmedAt: { type: Date, default: null },
  reconciledAt: { type: Date, default: null },
  failureReason: { type: String, default: '' },
  reversalReason: { type: String, default: '' },

  // Evidence
  bankStatementUrl: { type: String, default: '' },
  transactionId: { type: String, default: '' }, // Internal Transaction row ref

  // Audit
  initiatedBy: { type: String, default: 'system' },
  initiatedByRole: { type: String, default: 'system' },
  reconciledBy: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { _id: true });

// ============================================
// MANDATE SUB-SCHEMA
// ============================================
const mandateSchema = new mongoose.Schema({
  mandateId: { type: String, required: true },
  disbursementId: { type: String, required: true },

  // Mandate type
  type: {
    type: String,
    enum: ['enach', 'upi_autopay', 'nach_debit', 'ecs'],
    required: true,
  },

  // Bank details
  accountHolderName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  ifsc: { type: String, required: true },
  bankName: { type: String, default: '' },

  // Mandate terms
  maxAmount: { type: Number, required: true, min: 0 }, // Max debit per cycle
  frequency: {
    type: String,
    enum: ['monthly', 'quarterly', 'half_yearly', 'yearly'],
    default: 'monthly',
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },

  // Provider
  provider: {
    type: String,
    enum: ['razorpay', 'cashfree', 'billdesk', 'npci', 'manual'],
    default: 'manual',
  },
  providerMandateId: { type: String, default: '' }, // UMRN for eNACH
  providerSubscriptionId: { type: String, default: '' },

  // Lifecycle
  status: {
    type: String,
    enum: ['pending', 'active', 'paused', 'cancelled', 'expired', 'failed'],
    default: 'pending',
  },
  activatedAt: { type: Date, default: null },
  pausedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelReason: { type: String, default: '' },

  lastDebitAt: { type: Date, default: null },
  lastDebitAmount: { type: Number, default: 0 },
  totalDebited: { type: Number, default: 0 },

  // Audit
  createdBy: { type: String, default: 'system' },
  notes: { type: String, default: '' },
}, { _id: true });

// ============================================
// MAIN SCHEMA
// ============================================
const loanWorkflowSchema = new mongoose.Schema({
  applicationId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  lenderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lender',
    required: true,
    index: true,
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true,
  },

  // Sub-documents (all append-only)
  offers: [offerSchema],
  agreements: [agreementSchema],
  disbursements: [disbursementSchema],
  mandates: [mandateSchema],

  // Convenience pointers
  currentOfferId: { type: String, default: null },
  currentAgreementId: { type: String, default: null },
  currentDisbursementId: { type: String, default: null },
  currentMandateId: { type: String, default: null },

  // Audit
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: false,
});

// ============================================
// INDEXES
// ============================================
loanWorkflowSchema.index({ applicationId: 1 }, { unique: true });
loanWorkflowSchema.index({ lenderId: 1, createdAt: -1 });
loanWorkflowSchema.index({ patientId: 1, createdAt: -1 });
loanWorkflowSchema.index({ 'disbursements.utrNumber': 1 });
loanWorkflowSchema.index({ 'mandates.providerMandateId': 1 });
loanWorkflowSchema.index({ 'offers.status': 1 });
loanWorkflowSchema.index({ 'agreements.status': 1 });
loanWorkflowSchema.index({ 'disbursements.status': 1 });
loanWorkflowSchema.index({ 'mandates.status': 1 });

// ============================================
// METHODS
// ============================================

// Add an offer (auto-versions previous active offer to 'superseded')
loanWorkflowSchema.methods.addOffer = function (offerData) {
  // Supersede any existing active offer
  this.offers.forEach((o) => {
    if (o.status === 'issued') {
      o.status = 'superseded';
      o.supersededBy = offerData.offerId;
    }
  });

  // Compute version number
  const version = this.offers.length + 1;
  const offer = {
    ...offerData,
    version,
    issuedAt: new Date(),
    status: 'issued',
  };
  this.offers.push(offer);
  this.currentOfferId = offer.offerId;
  this.updatedAt = new Date();
  return offer;
};

// Add an agreement
loanWorkflowSchema.methods.addAgreement = function (agreementData) {
  const agreement = {
    ...agreementData,
    status: 'pending',
  };
  this.agreements.push(agreement);
  this.currentAgreementId = agreement.agreementId;
  this.updatedAt = new Date();
  return agreement;
};

// Add a disbursement
loanWorkflowSchema.methods.addDisbursement = function (disbursementData) {
  const disbursement = {
    ...disbursementData,
    initiatedAt: new Date(),
    status: 'initiated',
  };
  this.disbursements.push(disbursement);
  this.currentDisbursementId = disbursement.disbursementId;
  this.updatedAt = new Date();
  return disbursement;
};

// Add a mandate
loanWorkflowSchema.methods.addMandate = function (mandateData) {
  const mandate = {
    ...mandateData,
    status: 'pending',
  };
  this.mandates.push(mandate);
  this.currentMandateId = mandate.mandateId;
  this.updatedAt = new Date();
  return mandate;
};

// Find active offer
loanWorkflowSchema.methods.getActiveOffer = function () {
  return this.offers.find((o) => o.status === 'issued');
};

// Find signed agreement
loanWorkflowSchema.methods.getSignedAgreement = function () {
  return this.agreements.find((a) => a.status === 'signed');
};

// Find latest disbursement
loanWorkflowSchema.methods.getLatestDisbursement = function () {
  if (this.disbursements.length === 0) return null;
  return this.disbursements[this.disbursements.length - 1];
};

// Find active mandate
loanWorkflowSchema.methods.getActiveMandate = function () {
  return this.mandates.find((m) => m.status === 'active');
};

// ============================================
// STATICS
// ============================================

// Get or create workflow for application
loanWorkflowSchema.statics.getOrCreate = async function (applicationId, lenderId, patientId) {
  let workflow = await this.findOne({ applicationId });
  if (!workflow) {
    workflow = await this.create({
      applicationId,
      lenderId,
      patientId,
      offers: [],
      agreements: [],
      disbursements: [],
      mandates: [],
    });
  }
  return workflow;
};

// Find by application ID
loanWorkflowSchema.statics.findByApplication = function (applicationId) {
  return this.findOne({ applicationId });
};

// ============================================
// PRE-SAVE
// ============================================
loanWorkflowSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('LoanWorkflow', loanWorkflowSchema);
// D:\hospital backend\models\InsuranceMarketplace.js
// ============================================
// INSURANCE MARKETPLACE MODELS
// Contains: InsuranceProposal, InsuranceClaimEvent,
//           InsurancePreAuth, InsuranceAddon
// ============================================

const mongoose = require('mongoose');

// ============================================
// 1. InsuranceAddon — global catalog
// ============================================
const InsuranceAddonSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },   // 'maternity', 'opd'
  name: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '' },
  category: {
    type: String,
    enum: ['coverage', 'protection', 'wellness'],
    default: 'coverage',
  },
  defaultPrice: { type: Number, default: 0 },
  applicablePlanCategories: { type: [String], default: [] },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

InsuranceAddonSchema.index({ isActive: 1 });

// ============================================
// 2. InsuranceProposal — apply stepper draft
// ============================================
const MemberSchema = new mongoose.Schema({
  relation: {
    type: String,
    enum: ['self', 'spouse', 'child', 'parent', 'parent_in_law'],
    required: true,
  },
  name: { type: String, required: true },
  dob: { type: Date, required: true },
  age: { type: Number, required: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  preExisting: { type: [String], default: [] },
  height: { type: Number },
  weight: { type: Number },
  smoker: { type: Boolean, default: false },
}, { _id: true });

const PersonalSchema = new mongoose.Schema({
  fullName: String,
  dob: Date,
  gender: { type: String, enum: ['male', 'female', 'other'] },
  mobile: String,
  email: String,
  address: String,
  city: String,
  state: String,
  pincode: String,
  panNumber: String,
}, { _id: false });

const MedicalSchema = new mongoose.Schema({
  conditions: { type: [String], default: [] },
  otherCondition: String,
  hospitalizedLast4Years: { type: Boolean, default: false },
  hospitalizationDetails: String,
  currentMedications: { type: Boolean, default: false },
  medicationDetails: String,
  consentGiven: { type: Boolean, default: false },
}, { _id: false });

const NomineeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  relationship: { type: String, required: true },
  dob: Date,
  share: { type: Number, default: 100 },
  phone: String,
}, { _id: false });

const PremiumSchema = new mongoose.Schema({
  base: { type: Number, default: 0 },
  addons: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  monthly: { type: Number, default: 0 },
  breakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const UnderwritingSchema = new mongoose.Schema({
  decision: {
    type: String,
    enum: ['auto_approve', 'refer', 'decline', null],
    default: null,
  },
  reasons: { type: [String], default: [] },
  notes: String,
  decidedAt: Date,
}, { _id: false });

const PaymentSchema = new mongoose.Schema({
  orderId: String,
  paymentId: String,
  amount: Number,
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
  },
  paidAt: Date,
}, { _id: false });

const InsuranceProposalSchema = new mongoose.Schema({
  proposalNumber: { type: String, unique: true, index: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsurancePlan',
    required: true,
  },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // matches existing convention

  status: {
    type: String,
    enum: [
      'draft', 'submitted', 'underwriting', 'approved', 'referred',
      'rejected', 'payment_pending', 'converted', 'abandoned',
    ],
    default: 'draft',
    index: true,
  },
  currentStep: { type: Number, default: 1 },

  personal: { type: PersonalSchema, default: () => ({}) },
  members: { type: [MemberSchema], default: [] },
  medical: { type: MedicalSchema, default: () => ({}) },
  nominee: { type: NomineeSchema, default: null },

  sumInsured: { type: Number, default: 0 },
  selectedAddons: [{ type: String }],
  deductible: { type: Number, default: 0 },

  premium: { type: PremiumSchema, default: () => ({}) },
  couponCode: String,

  underwriting: { type: UnderwritingSchema, default: () => ({}) },
  payment: { type: PaymentSchema, default: () => ({}) },

  convertedPolicyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsurancePolicy',
  },

  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
}, { timestamps: true });

InsuranceProposalSchema.index({ userId: 1, status: 1 });
InsuranceProposalSchema.index({ expiresAt: 1 });

InsuranceProposalSchema.pre('save', function (next) {
  if (!this.proposalNumber) {
    this.proposalNumber = 'PROP-' + Date.now().toString(36).toUpperCase() +
      '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }
  next();
});

// ============================================
// 3. InsuranceClaimEvent — claim timeline
// ============================================
const InsuranceClaimEventSchema = new mongoose.Schema({
  claimId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsuranceClaim',
    required: true,
    index: true,
  },
  policyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsurancePolicy',
    index: true,
  },
  eventType: {
    type: String,
    enum: [
      'submitted', 'docs_requested', 'docs_uploaded', 'docs_verified',
      'under_assessment', 'query_raised', 'query_responded',
      'approved', 'partially_approved', 'rejected',
      'settled', 'appeal_filed', 'appeal_decided', 'closed',
    ],
    required: true,
  },
  actor: {
    type: String,
    enum: ['patient', 'insurer', 'hospital', 'admin', 'system'],
    required: true,
  },
  actorId: { type: mongoose.Schema.Types.ObjectId },
  message: { type: String, default: '' },
  amount: Number,
  attachments: [{
    url: String,
    label: String,
    uploadedAt: { type: Date, default: Date.now },
  }],
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

InsuranceClaimEventSchema.index({ claimId: 1, createdAt: 1 });

// ============================================
// 4. InsurancePreAuth — cashless pre-authorization
// ============================================
const InsurancePreAuthSchema = new mongoose.Schema({
  preAuthNumber: { type: String, unique: true, index: true },
  claimId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsuranceClaim' },
  policyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsurancePolicy',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // matches existing convention — insurer login is a User
    required: true,
  },

  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
  hospitalName: String,
  hospitalAddress: String,

  admissionDate: { type: Date, required: true },
  admissionType: {
    type: String,
    enum: ['planned', 'emergency'],
    default: 'planned',
  },
  diagnosis: String,
  treatment: String,
  estimatedCost: { type: Number, required: true },
  requestedAmount: { type: Number, required: true },

  documents: [{
    label: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
  }],

  status: {
    type: String,
    enum: [
      'draft', 'submitted', 'under_review', 'query_raised',
      'approved', 'partially_approved', 'rejected', 'expired',
    ],
    default: 'draft',
    index: true,
  },

  approvedAmount: Number,
  rejectionReason: String,
  queryMessage: String,
  queryResponse: String,

  submittedAt: Date,
  decidedAt: Date,
  validUntil: Date,
  insurerNotes: String,
}, { timestamps: true });

InsurancePreAuthSchema.pre('save', function (next) {
  if (!this.preAuthNumber) {
    this.preAuthNumber = 'PA-' + Date.now().toString(36).toUpperCase() +
      '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
  }
  next();
});

// ============================================
// EXPORTS
// ============================================
module.exports = {
  InsuranceAddon: mongoose.model('InsuranceAddon', InsuranceAddonSchema),
  InsuranceProposal: mongoose.model('InsuranceProposal', InsuranceProposalSchema),
  InsuranceClaimEvent: mongoose.model('InsuranceClaimEvent', InsuranceClaimEventSchema),
  InsurancePreAuth: mongoose.model('InsurancePreAuth', InsurancePreAuthSchema),
};
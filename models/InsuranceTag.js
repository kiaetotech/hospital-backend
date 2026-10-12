// D:\hospital backend\models\InsuranceTag.js
// ============================================
// INSURANCE TAG — ALL MODELS IN ONE FILE
// ============================================
// Exports: InsuranceAddon, InsuranceNetworkHospital,
//          InsuranceEndorsement, InsuranceClaimAppeal,
//          InsuranceComplaint, AIAuditLog
// ============================================

const mongoose = require('mongoose');
const crypto = require('crypto');

// ============================================
// 1. INSURANCE ADDON (§6)
// ============================================

const InsuranceAddonSchema = new mongoose.Schema({
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePlan', required: true, index: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  price: { type: Number, required: true, min: 0 },
  priceType: { type: String, enum: ['flat', 'percentage'], default: 'flat' },
  coverageLimit: { type: Number, min: 0 },
  coverageDescription: { type: String, trim: true },
  eligibility: {
    minAge: { type: Number, default: 18 },
    maxAge: { type: Number, default: 100 },
    gender: { type: String, enum: ['male', 'female', 'any'], default: 'any' },
    requiresPEDDeclaration: { type: Boolean, default: false },
    requiresMaternity: { type: Boolean, default: false }
  },
  displayOrder: { type: Number, default: 0 },
  icon: { type: String },
  isActive: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

InsuranceAddonSchema.index({ planId: 1, code: 1 }, { unique: true });
InsuranceAddonSchema.index({ planId: 1, isActive: 1, displayOrder: 1 });
InsuranceAddonSchema.statics.getByPlan = function (planId) {
  return this.find({ planId, isActive: true }).sort({ displayOrder: 1 });
};
InsuranceAddonSchema.statics.findByCode = function (planId, code) {
  return this.findOne({ planId, code: code.toUpperCase(), isActive: true });
};

// ============================================
// 2. INSURANCE NETWORK HOSPITAL (§7)
// ============================================

const InsuranceNetworkHospitalSchema = new mongoose.Schema({
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePlan', required: true, index: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsuranceCompany', required: true, index: true },
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
  name: { type: String, required: true, trim: true, index: true },
  address: { type: String, trim: true },
  city: { type: String, trim: true, index: true },
  state: { type: String, trim: true },
  pincode: { type: String, trim: true, index: true },
  location: { lat: Number, lng: Number },
  phone: { type: String, trim: true },
  emergency: { type: Boolean, default: false, index: true },
  cashless: { type: Boolean, default: true, index: true },
  twentyFourSeven: { type: Boolean, default: false, index: true },
  specialties: [{ type: String, trim: true, lowercase: true }],
  rating: { type: Number, default: 0, min: 0, max: 5 },
  empanelmentDate: { type: Date },
  isActive: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

InsuranceNetworkHospitalSchema.index({ planId: 1, pincode: 1, isActive: 1 });
InsuranceNetworkHospitalSchema.index({ planId: 1, city: 1, isActive: 1 });
InsuranceNetworkHospitalSchema.index({ specialties: 1, isActive: 1 });
InsuranceNetworkHospitalSchema.statics.findByPincode = function (planId, pincode) {
  return this.find({ planId, pincode, isActive: true });
};
InsuranceNetworkHospitalSchema.statics.findByCity = function (planId, city) {
  return this.find({ planId, city: new RegExp('^' + city + '$', 'i'), isActive: true });
};

// ============================================
// 3. INSURANCE ENDORSEMENT (§16)
// ============================================

const InsuranceEndorsementSchema = new mongoose.Schema({
  policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePolicy', required: true, index: true },
  userId: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['add_member', 'remove_member', 'change_nominee', 'change_address', 'change_phone',
           'change_email', 'port_policy', 'change_plan', 'increase_sum_insured'],
    required: true
  },
  requestData: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
  additionalPremium: { type: Number, default: 0 },
  refundAmount: { type: Number, default: 0 },
  requestedAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String },
  aiPrecheck: {
    status: String, confidence: Number, message: String, model: String
  }
}, { timestamps: true });

InsuranceEndorsementSchema.index({ policyId: 1, status: 1 });
InsuranceEndorsementSchema.index({ userId: 1, createdAt: -1 });

// ============================================
// 4. INSURANCE CLAIM APPEAL (§21)
// ============================================

const InsuranceClaimAppealSchema = new mongoose.Schema({
  claimId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsuranceClaim', required: true, index: true },
  userId: { type: String, required: true, index: true },
  reason: { type: String, required: true },
  documents: [{
    name: String, url: String, type: String, uploadedAt: { type: Date, default: Date.now }
  }],
  originalDecision: {
    status: String, approvedAmount: Number, rejectionReason: String, decidedAt: Date
  },
  requestedAmount: { type: Number },
  status: { type: String, enum: ['submitted', 'under_review', 'approved', 'rejected'], default: 'submitted', index: true },
  aiDraft: {
    draftText: String,
    citations: [{ type: String, reference: String, relevance: String }],
    confidence: Number,
    model: String
  },
  newDecision: {
    status: String, approvedAmount: Number, reason: String, decidedAt: Date,
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date }
}, { timestamps: true });

InsuranceClaimAppealSchema.index({ claimId: 1, status: 1 });

// ============================================
// 5. INSURANCE COMPLAINT (§22)
// ============================================

const InsuranceComplaintSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePolicy' },
  claimId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsuranceClaim' },
  complaintNumber: { type: String, unique: true, index: true },
  category: {
    type: String,
    enum: ['claim_delay', 'policy_service', 'mis_selling', 'premium_dispute', 'other'],
    required: true
  },
  subject: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  attachments: [{
    name: String, url: String, type: String, uploadedAt: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'escalated', 'closed'], default: 'open', index: true },
  priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
  assignedTo: {
    type: String,
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsuranceCompany' },
    userId: String
  },
  sla: { responseBy: Date, resolutionBy: Date, breached: { type: Boolean, default: false } },
  responses: [{
    from: { type: String, enum: ['user', 'insurer', 'platform'] },
    userId: String,
    message: String,
    attachments: [{ name: String, url: String, type: String }],
    at: { type: Date, default: Date.now }
  }],
  escalation: {
    escalatedAt: Date, escalatedTo: String, escalationText: String, resolvedAt: Date
  }
}, { timestamps: true });

InsuranceComplaintSchema.index({ userId: 1, createdAt: -1 });
InsuranceComplaintSchema.index({ status: 1, priority: 1 });
InsuranceComplaintSchema.pre('save', function (next) {
  if (!this.complaintNumber) {
    const ts = Date.now().toString().slice(-8);
    const rand = crypto.randomInt(0, 1000).toString().padStart(3, '0');
    this.complaintNumber = `SUP${ts}${rand}`;
  }
  next();
});

// ============================================
// 6. AI AUDIT LOG (platform-wide)
// ============================================

const AIAuditLogSchema = new mongoose.Schema({
  tag: { type: String, required: true, index: true },
  feature: { type: String, required: true, index: true },
  agentName: { type: String },
  userId: { type: String, index: true },
  resourceType: { type: String },
  resourceId: { type: mongoose.Schema.Types.ObjectId },
  input: { summary: String, hash: String, tokensEstimate: Number },
  output: { summary: String, structured: mongoose.Schema.Types.Mixed, hash: String, tokensEstimate: Number },
  model: String,
  provider: String,
  promptVersion: String,
  confidence: Number,
  latencyMs: Number,
  costEstimate: { type: Number, default: 0 },
  fallback: { type: Boolean, default: false },
  fallbackReason: String,
  error: String
}, { timestamps: true });

AIAuditLogSchema.index({ tag: 1, feature: 1, createdAt: -1 });
AIAuditLogSchema.index({ userId: 1, createdAt: -1 });
AIAuditLogSchema.index({ resourceType: 1, resourceId: 1 });
AIAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

// ============================================
// EXPORTS
// ============================================
// ============================================
// 7. INSURANCE AD CAMPAIGN
// ============================================

const InsuranceCampaignSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsuranceCompany',
    required: true,
    index: true
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  type: {
    type: String,
    enum: ['sponsored_plan', 'featured_company', 'search_boost', 'banner', 'lead_form', 'push_notification'],
    required: true
  },

  // Targeting
  planIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePlan' }],
  targetAudience: {
    ageMin: Number,
    ageMax: Number,
    gender: { type: String, enum: ['male', 'female', 'any'], default: 'any' },
    cities: [{ type: String, lowercase: true }],
    pincodes: [{ type: String }],
    planTypes: [{ type: String }],
    incomeMin: Number,
    incomeMax: Number
  },

  // Placement
  placements: [{
    type: String,
    enum: ['homepage', 'search_results', 'plan_detail', 'comparison', 'checkout']
  }],

  // Billing
  billingModel: {
    type: String,
    enum: ['cpc', 'cpm', 'cpl', 'fixed'],
    required: true
  },
  rateCard: {
    cpc: { type: Number, default: 0 },
    cpm: { type: Number, default: 0 },
    cpl: { type: Number, default: 0 },
    fixedAmount: { type: Number, default: 0 },
    period: { type: String, enum: ['daily', 'weekly', 'monthly'] }
  },

  // Budget
  budget: {
    total: { type: Number, default: 0 },
    daily: { type: Number, default: 0 },
    spent: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' }
  },

  // Schedule
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, default: null },

  // Targeting rules
  maxImpressionsPerUser: { type: Number, default: 3 },
  excludeConvertedUsers: { type: Boolean, default: true },

  // Creative
  creative: {
    headline: String,
    subheadline: String,
    ctaText: String,
    imageUrl: String,
    bgColor: String,
    badgeText: { type: String, default: 'Sponsored' }
  },

  // Status
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'active', 'paused', 'exhausted', 'rejected', 'expired'],
    default: 'draft',
    index: true
  },
  rejectionReason: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },

  // Aggregated metrics
  metrics: {
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    leads: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    spend: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },
    cpl: { type: Number, default: 0 },
    cpa: { type: Number, default: 0 },
    roi: { type: Number, default: 0 }
  },

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

InsuranceCampaignSchema.index({ companyId: 1, status: 1 });
InsuranceCampaignSchema.index({ status: 1, placements: 1, startDate: 1, endDate: 1 });

// ============================================
// 8. INSURANCE AD EVENT (impression/click/lead tracking)
// ============================================

const InsuranceAdEventSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsuranceCampaign',
    required: true,
    index: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsuranceCompany',
    required: true,
    index: true
  },
  eventType: {
    type: String,
    enum: ['impression', 'click', 'lead', 'conversion'],
    required: true,
    index: true
  },

  // Context
  userId: { type: String, index: true },
  sessionId: { type: String },
  placement: { type: String },
  pageUrl: { type: String },

  // Cost
  cost: { type: Number, default: 0 },

  // Metadata
  deviceType: { type: String, enum: ['mobile', 'desktop', 'tablet', 'unknown'], default: 'unknown' },
  ip: { type: String },
  userAgent: { type: String }
}, { timestamps: true });

InsuranceAdEventSchema.index({ campaignId: 1, createdAt: -1 });
InsuranceAdEventSchema.index({ companyId: 1, eventType: 1, createdAt: -1 });
// Auto-delete after 90 days
InsuranceAdEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = {
  InsuranceAddon: mongoose.models.InsuranceAddon || mongoose.model('InsuranceAddon', InsuranceAddonSchema),
  InsuranceNetworkHospital: mongoose.models.InsuranceNetworkHospital || mongoose.model('InsuranceNetworkHospital', InsuranceNetworkHospitalSchema),
  InsuranceEndorsement: mongoose.models.InsuranceEndorsement || mongoose.model('InsuranceEndorsement', InsuranceEndorsementSchema),
  InsuranceClaimAppeal: mongoose.models.InsuranceClaimAppeal || mongoose.model('InsuranceClaimAppeal', InsuranceClaimAppealSchema),
  InsuranceComplaint: mongoose.models.InsuranceComplaint || mongoose.model('InsuranceComplaint', InsuranceComplaintSchema),
  AIAuditLog: mongoose.models.AIAuditLog || mongoose.model('AIAuditLog', AIAuditLogSchema),
  InsuranceCampaign: mongoose.models.InsuranceCampaign || mongoose.model('InsuranceCampaign', InsuranceCampaignSchema),
  InsuranceAdEvent: mongoose.models.InsuranceAdEvent || mongoose.model('InsuranceAdEvent', InsuranceAdEventSchema)
};
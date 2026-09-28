const mongoose = require('mongoose');

// ============================================
// TDS CONFIGURATION MODEL
// ============================================
// Admin-controlled TDS (Tax Deducted at Source) rules.
// Default: NO rules → TDS = 0% → no deduction at payout.
// Admin adds rules when compliance requires.
// ============================================

const tdsConfigSchema = new mongoose.Schema({
  configId: { type: String, unique: true, required: true },
  configName: { type: String, required: true },
  description: { type: String },

  // --------------------------------------------
  // SCOPE — same pattern as CommissionConfig
  // --------------------------------------------
  scopeType: {
    type: String,
    enum: ['global', 'state', 'city', 'provider'],
    default: 'global',
    index: true
  },
  scopeValue: { type: String, index: true },
  scopeState: { type: String },

  providerSpecific: { type: Boolean, default: false },
  providerId: { type: String },
  providerType: { type: String },   // 'ayurveda_doctor', 'wellness_center', etc.

  // --------------------------------------------
  // SERVICE TYPE — matches CommissionConfig enum
  // --------------------------------------------
  serviceType: {
    type: String,
    enum: [
      // All existing CommissionConfig service types
      'hospital_opd',
      'hospital_admission',
      'ambulance',
      'ambulance_emergency',
      'ambulance_scheduled',
      'labtest',
      'health_package',
      'caregiver',
      'ayurveda_consultation',
      'ayurveda_panchakarma',
      'ayurveda_online_doctor',
      'ayurveda_wellness_center',
      'ayurveda_home_therapy',
      'ayurveda_medicine',
      'ayurveda_product',
      'ayurveda_corporate',
      'homeopathy_consult',
      'homeopathy_medicine',
      'insurance',
      'online_consult',
      'mental_health',
      'health_emi',
      'corporate_health',
      // Meta
      'all'
    ],
    required: true
  },

  // --------------------------------------------
  // TDS RULE
  // --------------------------------------------
  section: {
    type: String,
    enum: ['194J', '194C', '194H', '194-O', '206AA', 'none'],
    default: '194-O'   // e-commerce operator — most likely for a marketplace
  },

  ratePercent: {
    type: Number,
    default: 0,        // ← DEFAULT 0 = NO TDS
    min: 0,
    max: 100
  },

  // Below this FY-cumulative payout, no TDS is deducted
  thresholdPerFY: {
    type: Number,
    default: 0         // ← 0 = no threshold = always apply (if rate > 0)
  },

  // --------------------------------------------
  // STATUS & AUDIT
  // --------------------------------------------
  isActive: { type: Boolean, default: true, index: true },
  isDefault: { type: Boolean, default: false },
  priority: { type: Number, default: 0 },

  effectiveFrom: { type: Date, required: true },
  effectiveUntil: { type: Date, default: null },

  createdBy: { type: String },
  updatedBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  version: { type: Number, default: 1 },
  previousVersionId: { type: String },

  // Which govt notification this reflects (audit)
  notificationRef: { type: String },
  changeReason: { type: String },
  adminNotes: { type: String }
});

// Indexes
tdsConfigSchema.index({ serviceType: 1, isActive: 1 });
tdsConfigSchema.index({ providerId: 1, serviceType: 1 });
tdsConfigSchema.index({ scopeType: 1, scopeValue: 1, serviceType: 1, isActive: 1 });
tdsConfigSchema.index({ effectiveFrom: 1, effectiveUntil: 1 });
tdsConfigSchema.index({ priority: -1 });

// Virtuals
tdsConfigSchema.virtual('isEffective').get(function () {
  const now = new Date();
  return this.isActive &&
    now >= this.effectiveFrom &&
    (!this.effectiveUntil || now <= this.effectiveUntil);
});

// --------------------------------------------
// Static: resolve — priority-aware
// Same order as CommissionConfig: provider > city > state > global
// --------------------------------------------
tdsConfigSchema.statics.resolve = async function ({
  serviceType,
  providerId = null,
  city = null,
  state = null
}) {
  const now = new Date();
  const candidates = await this.find({
    serviceType,
    isActive: true,
    effectiveFrom: { $lte: now },
    $or: [
      { effectiveUntil: null },
      { effectiveUntil: { $gte: now } }
    ],
    $or: [
      { scopeType: 'provider', providerId: String(providerId) },
      { scopeType: 'city', scopeValue: city },
      { scopeType: 'state', scopeValue: state },
      { scopeType: 'global' },
      { scopeType: { $exists: false } }
    ]
  }).sort({ priority: -1, effectiveFrom: -1 });

  const order = { provider: 4, city: 3, state: 2, global: 1 };
  candidates.sort((a, b) => {
    const ao = order[a.scopeType] || 0;
    const bo = order[b.scopeType] || 0;
    if (ao !== bo) return bo - ao;
    return (b.priority || 0) - (a.priority || 0);
  });

  return candidates[0] || null;
};

// --------------------------------------------
// Static: getEffectiveRate — with threshold check
// Returns { ratePercent, section, thresholdPerFY, configId }
// --------------------------------------------
tdsConfigSchema.statics.getEffectiveRate = async function ({
  serviceType,
  providerId,
  city,
  state
}) {
  const config = await this.resolve({ serviceType, providerId, city, state });
  if (!config) {
    return { ratePercent: 0, section: 'none', thresholdPerFY: 0, configId: null };
  }
  return {
    ratePercent: config.ratePercent,
    section: config.section,
    thresholdPerFY: config.thresholdPerFY,
    configId: config._id,
    configVersion: config.version
  };
};

// Pre-save
tdsConfigSchema.pre('save', function (next) {
  if (!this.configId) {
    this.configId = 'TDS_' + this.serviceType.toUpperCase() + '_' + Date.now();
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('TdsConfig', tdsConfigSchema);
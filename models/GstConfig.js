const mongoose = require('mongoose');

// ============================================
// GST CONFIGURATION MODEL
// ============================================
// Admin-controlled GST rates per service type.
// GST Council changes rates periodically — admin
// updates via UI, no deploy needed.
// ============================================

const gstConfigSchema = new mongoose.Schema({
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

  // --------------------------------------------
  // SERVICE TYPE — same enum as TdsConfig
  // --------------------------------------------
  serviceType: {
    type: String,
    enum: [
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
      'platform_commission',   // GST on YOUR revenue
      'all'
    ],
    required: true,
    index: true
  },

  // --------------------------------------------
  // GST RULE
  // --------------------------------------------
  ratePercent: {
    type: Number,
    default: 18,
    min: 0,
    max: 28
  },

  // HSN (goods) or SAC (services) code for invoices
  hsnSacCode: { type: String, default: '' },

  // Who bears the GST
  chargeTo: {
    type: String,
    enum: ['patient', 'platform', 'provider'],
    default: 'patient'
  },

  // Exempt services (some healthcare is exempt)
  isExempt: { type: Boolean, default: false },
  exemptionReason: { type: String, default: '' },

  // Reverse charge (rare)
  reverseCharge: { type: Boolean, default: false },

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

  // Which CBIC notification this reflects
  notificationRef: { type: String },
  changeReason: { type: String },
  adminNotes: { type: String }
});

// Indexes
gstConfigSchema.index({ serviceType: 1, isActive: 1 });
gstConfigSchema.index({ scopeType: 1, scopeValue: 1, serviceType: 1, isActive: 1 });
gstConfigSchema.index({ effectiveFrom: 1, effectiveUntil: 1 });
gstConfigSchema.index({ priority: -1 });

// Virtuals
gstConfigSchema.virtual('isEffective').get(function () {
  const now = new Date();
  return this.isActive &&
    now >= this.effectiveFrom &&
    (!this.effectiveUntil || now <= this.effectiveUntil);
});

// --------------------------------------------
// Static: resolve — priority-aware
// --------------------------------------------
gstConfigSchema.statics.resolve = async function ({
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
      { scopeType: 'provider', scopeValue: String(providerId) },
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

// Pre-save
gstConfigSchema.pre('save', function (next) {
  if (!this.configId) {
    this.configId = 'GST_' + this.serviceType.toUpperCase() + '_' + Date.now();
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('GstConfig', gstConfigSchema);
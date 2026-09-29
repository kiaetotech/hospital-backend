// D:\hospital backend\services\pricingService.js
// Single source of truth for pricing.
// Reads from CommissionConfig DB model. NO hardcoded values.
// Supports scope: global / state / city / provider.

const CommissionConfig = require('../models/CommissionConfig');

const BOOKING_TYPE_MAP = {
  // AYURVEDA (existing — do not touch)
  doctor_consultation: {
    serviceType: 'ayurveda_consultation',
    platformFeeKey: 'consultation',
    rateKey: 'consultationRate',
  },
  wellness_program: {
    serviceType: 'ayurveda_wellness_center',
    platformFeeKey: 'wellnessCenter',
    rateKey: 'wellnessCenterRate',
  },
  panchakarma_package: {
    serviceType: 'ayurveda_panchakarma',
    platformFeeKey: 'panchakarma',
    rateKey: 'panchakarmaRate',
  },
  home_therapy: {
    serviceType: 'ayurveda_home_therapy',
    platformFeeKey: 'homeTherapy',
    rateKey: 'consultationRate',
  },
  medicine_order: {
    serviceType: 'ayurveda_medicine',
    platformFeeKey: 'medicine',
    rateKey: 'medicineRate',
  },

  // HOSPITALS (new)
  hospital_opd: {
    serviceType: 'hospital_opd',
    platformFeeKey: 'opd',
    rateKey: 'opdRate',
  },
  hospital_admission: {
    serviceType: 'hospital_admission',
    platformFeeKey: 'admission',
    rateKey: 'admissionRate',
  },

  // AMBULANCE (new)
  ambulance: {
    serviceType: 'ambulance',
    platformFeeKey: 'ambulance',
    rateKey: 'ambulanceRate',
  },
  ambulance_emergency: {
    serviceType: 'ambulance_emergency',
    platformFeeKey: 'emergency',
    rateKey: 'emergencyRate',
  },
    ambulance_scheduled: {
    serviceType: 'ambulance_scheduled',
    platformFeeKey: 'scheduled',
    rateKey: 'scheduledRate',
  },

  // HOMEOPATHY (new)
  homeopathy_consult: {
    serviceType: 'homeopathy_consultation',
    platformFeeKey: 'consultation',
    rateKey: 'consultationRate',
  },
  homeopathy_medicine: {
    serviceType: 'homeopathy_medicine',
    platformFeeKey: 'medicine',
    rateKey: 'medicineRate',
  },
  naturopathy_center: {
    serviceType: 'naturopathy_center',
    platformFeeKey: 'centerVisit',
    rateKey: 'centerVisitRate',
  },
};

// ────────────────────────────────────────────────
// Resolve config — scope-aware, with fallback
// ────────────────────────────────────────────────
async function resolveConfig(bookingType, context = {}) {
  const mapping = BOOKING_TYPE_MAP[bookingType];
  if (!mapping) throw new Error(`Unknown booking type: ${bookingType}`);

  // Try scope-aware resolution first
  if (context.providerId || context.city || context.state) {
    const scoped = await CommissionConfig.resolve({
      serviceType: mapping.serviceType,
      providerId: context.providerId || null,
      city: context.city || null,
      state: context.state || null
    });
    if (scoped) return { config: scoped, mapping };
  }

  // Fall back to global default
  const config = await CommissionConfig.getActiveConfig(mapping.serviceType);
  if (!config) {
    throw new Error(
      `No pricing config for "${bookingType}". ` +
      `Admin must configure "${mapping.serviceType}" in Admin → Fee Settings.`
    );
  }

  return { config, mapping };
}

// ────────────────────────────────────────────────
// Calculate pricing
// ────────────────────────────────────────────────
async function calculatePricing({
  bookingType,
  amount,
  discountAmount = 0,
  providerId = null,
  providerModel = null,
  city = null,
  state = null
}) {
  if (!bookingType) throw new Error('bookingType is required');
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error('amount must be a non-negative number');
  }

  const { config, mapping } = await resolveConfig(bookingType, {
    providerId, city, state, providerModel
  });

  const ayurveda = config.ayurvedaSpecific || {};

  const platformFee =
    config.platformFee?.[bookingType] ??
    ayurveda.platformFees?.[mapping.platformFeeKey];

  if (platformFee == null) {
    throw new Error(`Platform fee not configured for "${bookingType}".`);
  }

  const gstPercentage =
    ayurveda.gstPercentage ??
    config.gstConfig?.gstPercentage;
  if (gstPercentage == null) {
    throw new Error('GST percentage not configured.');
  }

  // Support percentage + fixed + hybrid
  let commissionPercentage = 0;
  let commissionFixedAmount = 0;
  let commissionType = config.commissionType || 'percentage';

  if (commissionType === 'fixed') {
    commissionFixedAmount = config.fixedAmount || 0;
  } else if (commissionType === 'hybrid') {
    commissionPercentage = config.hybridConfig?.percentage || config.percentageRate || 0;
    commissionFixedAmount = config.hybridConfig?.fixedAmount || 0;
    } else {
    // Priority: explicit percentageRate wins over inherited ayurvedaSpecific default
    commissionPercentage =
      config.percentageRate ??
      ayurveda[mapping.rateKey] ??
      20;
  }

  const discountedFee = Math.max(0, amount - discountAmount);
  const gstAmount = Math.round((discountedFee + platformFee) * gstPercentage / 100);
  const total = discountedFee + platformFee + gstAmount;

  let platformCommission;
  if (commissionType === 'fixed') {
    platformCommission = commissionFixedAmount;
  } else if (commissionType === 'hybrid') {
    platformCommission = Math.round(discountedFee * commissionPercentage / 100) + commissionFixedAmount;
    if (config.hybridConfig?.capAmount) {
      platformCommission = Math.min(platformCommission, config.hybridConfig.capAmount);
    }
    if (config.hybridConfig?.floorAmount) {
      platformCommission = Math.max(platformCommission, config.hybridConfig.floorAmount);
    }
  } else {
    platformCommission = Math.round(discountedFee * commissionPercentage / 100);
  }

  const providerEarning = discountedFee - platformCommission;

  return {
    bookingType,
    baseAmount: amount,
    discountAmount,
    discountedFee,
    platformFee,
    gstPercentage,
    gstAmount,
    total,
    commissionPercentage,
    platformCommission,
    providerEarning,
    configVersion: config.version,
    configId: config.configId,
    configScope: `${config.scopeType || 'global'}:${config.scopeValue || 'all'}`,
    configUpdatedAt: config.updatedAt,
  };
}

async function getConfigForAdmin() {
  const serviceTypes = [
    'ayurveda_consultation',
    'ayurveda_panchakarma',
    'ayurveda_wellness_center',
    'ayurveda_home_therapy',
    'ayurveda_medicine',
  ];
  const configs = {};
  for (const st of serviceTypes) {
    configs[st] = await CommissionConfig.getActiveConfig(st);
  }
  return configs;
}

module.exports = {
  calculatePricing,
  getConfigForAdmin,
  BOOKING_TYPE_MAP,
  resolveConfig,
};
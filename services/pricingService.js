// D:\hospital backend\services\pricingService.js
// Single source of truth for all Ayurveda pricing.
// Reads from CommissionConfig DB model. NO hardcoded values.
// Admin configures via Admin Panel → Fee Config.

const CommissionConfig = require('../models/CommissionConfig');

// ────────────────────────────────────────────────
// Map booking type → (serviceType, ayurvedaSpecific.platformFees key, rate key)
// ────────────────────────────────────────────────
const BOOKING_TYPE_MAP = {
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
    rateKey: 'consultationRate', // reuse consultation rate
  },
  medicine_order: {
    serviceType: 'ayurveda_medicine',
    platformFeeKey: 'medicine',
    rateKey: 'medicineRate',
  },
};

// ────────────────────────────────────────────────
// GET ACTIVE CONFIG — throws if not configured
// ────────────────────────────────────────────────
async function getAyurvedaConfig(bookingType) {
  const mapping = BOOKING_TYPE_MAP[bookingType];
  if (!mapping) {
    throw new Error(`Unknown booking type: ${bookingType}`);
  }

  const config = await CommissionConfig.getActiveConfig(mapping.serviceType);

  if (!config) {
    throw new Error(
      `No pricing config for "${bookingType}". ` +
      `Admin must configure "${mapping.serviceType}" in Admin → Fee Settings.`
    );
  }

  if (!config.ayurvedaSpecific) {
    throw new Error(
      `Config for "${bookingType}" is missing ayurvedaSpecific block. ` +
      'Please update in Admin → Fee Settings.'
    );
  }

  return { config, mapping };
}

// ────────────────────────────────────────────────
// MAIN: Calculate pricing from live config
// ────────────────────────────────────────────────
async function calculatePricing({ bookingType, amount, discountAmount = 0 }) {
  if (!bookingType) throw new Error('bookingType is required');
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error('amount must be a non-negative number');
  }

  const { config, mapping } = await getAyurvedaConfig(bookingType);
  const ayurveda = config.ayurvedaSpecific;

  // Platform fee — from config, no fallback
  const platformFee = ayurveda.platformFees?.[mapping.platformFeeKey];
  if (platformFee == null) {
    throw new Error(
      `Platform fee not configured for "${bookingType}". ` +
      'Please set it in Admin → Fee Settings.'
    );
  }

  // GST — from config, no fallback
  const gstPercentage = ayurveda.gstPercentage;
  if (gstPercentage == null) {
    throw new Error(
      'GST percentage not configured. Please set it in Admin → Fee Settings.'
    );
  }

  // Commission rate — from config, no fallback
  const commissionPercentage = ayurveda[mapping.rateKey];
  if (commissionPercentage == null) {
    throw new Error(
      `Commission rate not configured for "${bookingType}". ` +
      'Please set it in Admin → Fee Settings.'
    );
  }

  const discountedFee = Math.max(0, amount - discountAmount);
  const gstAmount = Math.round((discountedFee + platformFee) * gstPercentage / 100);
  const total = discountedFee + platformFee + gstAmount;
  const platformCommission = Math.round(discountedFee * commissionPercentage / 100);
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
    configUpdatedAt: config.updatedAt,
  };
}

// ────────────────────────────────────────────────
// GET: Current config for admin UI
// ────────────────────────────────────────────────
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
  getAyurvedaConfig,
  getConfigForAdmin,
  BOOKING_TYPE_MAP,
};
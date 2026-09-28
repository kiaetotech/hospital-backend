const TdsConfig = require('../models/TdsConfig');
const Payout = require('../models/Payout');
const mongoose = require('mongoose');

// ============================================
// TDS SERVICE
// ============================================
// Calculates TDS for provider payouts.
// Default behavior: no rules → 0% deduction.
// ============================================

// FY in India = April 1 to March 31
function getCurrentFY() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    start: new Date(year, 3, 1),        // April 1
    end: new Date(year + 1, 2, 31, 23, 59, 59, 999)  // March 31
  };
}

// Cumulative paid to a provider in current FY
async function getCumulativeFY(providerId) {
  const { start, end } = getCurrentFY();
  const result = await Payout.aggregate([
    {
      $match: {
        providerId: mongoose.Types.ObjectId.isValid(providerId)
          ? new mongoose.Types.ObjectId(providerId)
          : providerId,
        status: { $in: ['approved', 'paid'] },
        createdAt: { $gte: start, $lte: end }
      }
    },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  return result[0]?.total || 0;
}

// --------------------------------------------
// Calculate TDS for a pending payout
// --------------------------------------------
async function calculate({
  serviceType,
  providerType,
  providerId,
  payoutAmount,
  city = null,
  state = null
}) {
  // Find matching TDS rule
  const config = await TdsConfig.resolve({
    serviceType,
    providerId,
    city,
    state
  });

  // No rule = no deduction
  if (!config || config.ratePercent === 0) {
    return {
      tds: 0,
      section: config?.section || 'none',
      ratePercent: 0,
      thresholdCrossed: false,
      configId: config?._id || null,
      configVersion: config?.version || null,
      reason: config ? 'Configured at 0%' : 'No TDS rule configured',
      cumulativeBefore: null,
      cumulativeAfter: null
    };
  }

  const cumulativeBefore = await getCumulativeFY(providerId);
  const cumulativeAfter = cumulativeBefore + payoutAmount;
  const threshold = config.thresholdPerFY || 0;

  // Below threshold → no deduction
  if (threshold > 0 && cumulativeAfter <= threshold) {
    return {
      tds: 0,
      section: config.section,
      ratePercent: config.ratePercent,
      thresholdCrossed: false,
      configId: config._id,
      configVersion: config.version,
      reason: `Below FY threshold (₹${cumulativeAfter}/₹${threshold})`,
      cumulativeBefore,
      cumulativeAfter
    };
  }

  // Compute taxable amount
  // If crossing threshold this payout, only part above threshold is taxed
  let taxableAmount = payoutAmount;
  if (threshold > 0 && cumulativeBefore < threshold) {
    taxableAmount = cumulativeAfter - threshold;
  }

  const tds = Math.round((taxableAmount * config.ratePercent / 100) * 100) / 100;

  return {
    tds,
    section: config.section,
    ratePercent: config.ratePercent,
    thresholdCrossed: true,
    configId: config._id,
    configVersion: config.version,
    taxableAmount,
    reason: `§${config.section} @ ${config.ratePercent}% on ₹${taxableAmount}`,
    cumulativeBefore,
    cumulativeAfter
  };
}

// --------------------------------------------
// Preview (for admin UI — no threshold context)
// --------------------------------------------
async function preview({ serviceType, providerId, city, state, payoutAmount = 10000 }) {
  return calculate({
    serviceType,
    providerId: providerId || '000000000000000000000000',
    payoutAmount,
    city,
    state
  });
}

module.exports = {
  calculate,
  preview,
  getCumulativeFY,
  getCurrentFY
};
// D:\hospital backend\services\insurancePremiumEngine.js
// ============================================
// INSURANCE PREMIUM CALCULATION ENGINE
// Production-grade pricing logic
// ============================================

/**
 * Compute the base premium from the plan's pricing grid.
 * Grid is age × sum insured matrix, stored as:
 *   { ageBands: [{ageMin, ageMax}], sumInsuredTiers: [...], prices: {"18_25_500000": 4500} }
 *
 * @param {Object} plan - InsurancePlan document
 * @param {Number} age - Customer age
 * @param {Number} sumInsured - Chosen sum insured
 * @returns {Number} - base premium ₹, or 0 if no matching cell
 */
function getBaseFromGrid(plan, age, sumInsured) {
  const grid = plan?.pricingGrid;
  if (!grid || !Array.isArray(grid.ageBands) || !Array.isArray(grid.sumInsuredTiers)) {
    return 0;
  }

  // Find matching age band
  const band = grid.ageBands.find((b) => age >= b.ageMin && age <= b.ageMax);
  if (!band) return 0;

  // Nearest sum insured tier if exact match not found
  let si = sumInsured;
  if (!grid.sumInsuredTiers.includes(si)) {
    // Find closest tier
    si = grid.sumInsuredTiers.reduce((closest, tier) => {
      return Math.abs(tier - sumInsured) < Math.abs(closest - sumInsured) ? tier : closest;
    }, grid.sumInsuredTiers[0]);
  }

  const key = `${band.ageMin}_${band.ageMax}_${si}`;
  const price = grid.prices instanceof Map ? grid.prices.get(key) : grid.prices?.[key];
  return Number(price) || 0;
}

/**
 * Apply habit loadings (smoker, alcohol, tobacco surcharges).
 * Returns the total loading amount in ₹.
 */
function getHabitLoading(plan, habits, basePremium) {
  const loadings = plan?.habitLoadings;
  if (!loadings) return 0;

  let total = 0;
  const { smoker, alcohol, tobacco, nonSmokerDiscount } = loadings;

  if (habits?.smoker && smoker > 0) {
    total += basePremium * (smoker / 100);
  }
  if (habits?.alcohol && alcohol > 0) {
    total += basePremium * (alcohol / 100);
  }
  if (habits?.tobacco && tobacco > 0) {
    total += basePremium * (tobacco / 100);
  }
  if (!habits?.smoker && !habits?.tobacco && nonSmokerDiscount > 0) {
    total -= basePremium * (nonSmokerDiscount / 100);
  }

  return Math.round(total);
}

/**
 * Apply BMI loading based on customer's BMI.
 * Returns loading amount in ₹.
 */
function getBmiLoading(plan, bmi, basePremium) {
  const bmiLoadings = plan?.bmiLoadings;
  if (!bmiLoadings || !Array.isArray(bmiLoadings) || bmiLoadings.length === 0) return 0;
  if (!bmi || bmi <= 0) return 0;

  const band = bmiLoadings.find((b) => bmi >= b.minBMI && bmi < b.maxBMI);
  if (!band || !band.loadingPercent) return 0;

  return Math.round(basePremium * (band.loadingPercent / 100));
}

/**
 * Apply pre-existing disease loadings.
 * Returns loading amount in ₹.
 */
function getPedLoading(plan, pedConditions, basePremium) {
  const pedLoadings = plan?.pedLoadings;
  if (!pedLoadings || !Array.isArray(pedLoadings) || pedLoadings.length === 0) return 0;
  if (!Array.isArray(pedConditions) || pedConditions.length === 0) return 0;

  let total = 0;
  for (const cond of pedConditions) {
    const loading = pedLoadings.find((p) => p.condition?.toLowerCase() === cond?.toLowerCase());
    if (loading && !loading.rejected && loading.loadingPercent > 0) {
      total += basePremium * (loading.loadingPercent / 100);
    }
  }

  return Math.round(total);
}

/**
 * Check if any selected PED condition is in the "rejected" list.
 * If yes, customer cannot be insured under this plan.
 */
function isRejectedByPed(plan, pedConditions) {
  const pedLoadings = plan?.pedLoadings;
  if (!pedLoadings || !Array.isArray(pedConditions)) return false;

  for (const cond of pedConditions) {
    const loading = pedLoadings.find((p) => p.condition?.toLowerCase() === cond?.toLowerCase());
    if (loading && loading.rejected) return true;
  }
  return false;
}

/**
 * Compute cost of selected riders.
 */
function getRidersCost(plan, selectedRiderCodes) {
  const riders = plan?.riders;
  if (!riders || !Array.isArray(riders) || !Array.isArray(selectedRiderCodes)) return 0;

  let total = 0;
  for (const code of selectedRiderCodes) {
    const rider = riders.find((r) => r.code === code);
    if (rider && rider.price > 0) total += Number(rider.price);
  }
  return total;
}

/**
 * Apply tenure discount.
 * Returns discount amount in ₹ (negative).
 */
function getTenureDiscount(plan, tenureYears, basePremium) {
  const discounts = plan?.tenureDiscounts;
  if (!discounts || !Array.isArray(discounts) || discounts.length === 0) return 0;

  const match = discounts.find((d) => d.years === tenureYears);
  if (!match || match.discountPercent <= 0) return 0;

  return -Math.round(basePremium * (match.discountPercent / 100));
}

/**
 * Apply zone multiplier.
 * Returns multiplier value (default 1.0).
 */
function getZoneMultiplier(plan, zone) {
  const zones = plan?.zoneMultipliers;
  if (!zones || !Array.isArray(zones) || zones.length === 0) return 1.0;

  const match = zones.find((z) => z.zone?.toLowerCase() === zone?.toLowerCase());
  return match ? Number(match.multiplier) || 1.0 : 1.0;
}

/**
 * Apply family structure multiplier (for Family Floater plans).
 * Returns multiplier value (default 1.0).
 */
function getFamilyMultiplier(plan, membersCount) {
  if (!membersCount || membersCount <= 1) return 1.0;

  // If plan defines familyStructures explicitly, use that
  const structures = plan?.familyStructures;
  if (Array.isArray(structures) && structures.length > 0) {
    const match = structures.find((s) => s.memberCount === membersCount);
    if (match) return Number(match.multiplier) || 1.0;
  }

  // Fallback: standard multiplier curve
  const multipliers = { 1: 1.0, 2: 1.7, 3: 2.1, 4: 2.4, 5: 2.7, 6: 3.0 };
  return multipliers[membersCount] || 3.0;
}

/**
 * Apply co-pay discount.
 * Returns price impact amount in ₹ (negative = discount).
 */
function getCoPayImpact(plan, coPayPercent, basePremium) {
  const options = plan?.coPayOptions;
  if (!options || !Array.isArray(options) || options.length === 0) return 0;

  const match = options.find((o) => o.percent === coPayPercent);
  if (!match || !match.priceImpact) return 0;

  return Math.round(basePremium * (match.priceImpact / 100));
}

/**
 * Apply deductible discount.
 * Returns price impact amount in ₹ (negative = discount).
 */
function getDeductibleImpact(plan, deductibleAmount, basePremium) {
  const options = plan?.deductibleOptions;
  if (!options || !Array.isArray(options) || options.length === 0) return 0;

  const match = options.find((o) => o.amount === deductibleAmount);
  if (!match || !match.priceImpact) return 0;

  return Math.round(basePremium * (match.priceImpact / 100));
}

/**
 * MAIN ENTRY POINT: Calculate total premium for a customer.
 *
 * @param {Object} options
 * @param {Object} options.plan - InsurancePlan document
 * @param {Number} options.age - Primary insured age
 * @param {Number} options.sumInsured - Chosen sum insured
 * @param {Array}  options.members - For family plans: [{age, relation, smoker, bmi, pedConditions}]
 * @param {Object} options.habits - {smoker, alcohol, tobacco}
 * @param {Number} options.bmi
 * @param {Array}  options.pedConditions - e.g. ['diabetes', 'hypertension']
 * @param {Number} options.tenureYears - 1, 2, or 3
 * @param {String} options.zone - 'metro', 'tier1', etc.
 * @param {Number} options.coPayPercent - 0, 10, 20
 * @param {Number} options.deductibleAmount
 * @param {Array}  options.selectedRiders - ['maternity', 'opd']
 *
 * @returns {Object} Premium breakdown with all components
 */
function calculatePremium(options) {
  const {
    plan,
    age,
    sumInsured,
    members = [],
    habits = {},
    bmi = 0,
    pedConditions = [],
    tenureYears = 1,
    zone = 'tier1',
    coPayPercent = 0,
    deductibleAmount = 0,
    selectedRiders = [],
  } = options;

  if (!plan) throw new Error('Plan is required');

  // Rejection check — customer cannot be insured
  if (isRejectedByPed(plan, pedConditions)) {
    return {
      success: false,
      rejected: true,
      reason: 'Customer has a condition that disqualifies them from this plan',
    };
  }

  // Step 1: base premium from grid
  const basePremium = getBaseFromGrid(plan, age, sumInsured);
  if (basePremium === 0) {
    return {
      success: false,
      reason: 'No pricing available for this age / sum insured combination',
    };
  }

  // Step 2: calculate each component
  const habitLoading = getHabitLoading(plan, habits, basePremium);
  const bmiLoading = getBmiLoading(plan, bmi, basePremium);
  const pedLoading = getPedLoading(plan, pedConditions, basePremium);
  const ridersCost = getRidersCost(plan, selectedRiders);
  const tenureDiscount = getTenureDiscount(plan, tenureYears, basePremium);
  const coPayImpact = getCoPayImpact(plan, coPayPercent, basePremium);
  const deductibleImpact = getDeductibleImpact(plan, deductibleAmount, basePremium);
  const zoneMultiplier = getZoneMultiplier(plan, zone);
  const familyMultiplier = getFamilyMultiplier(plan, members.length || 1);

  // Step 3: subtotal before zone/family multipliers
  const loadingsTotal = habitLoading + bmiLoading + pedLoading;
  const subtotalBeforeMultipliers = basePremium + loadingsTotal;

  // Step 4: apply zone + family multipliers
  const subtotal = subtotalBeforeMultipliers * zoneMultiplier * familyMultiplier;

  // Step 5: apply discounts
  const subtotalWithDiscounts = subtotal + tenureDiscount + coPayImpact + deductibleImpact;

  // Step 6: add riders
  const grossPremium = Math.round(subtotalWithDiscounts + ridersCost);

  // Step 7: GST (18% on premium)
  const gstRate = 18;
  const gstAmount = Math.round(grossPremium * (gstRate / 100));
  const totalPremium = grossPremium + gstAmount;

  // Step 8: monthly EMI equivalent (for 12 months)
  const monthlyPremium = Math.round(totalPremium / 12);

  return {
    success: true,
    breakdown: {
      basePremium,
      habitLoading,
      bmiLoading,
      pedLoading,
      ridersCost,
      tenureDiscount,
      coPayImpact,
      deductibleImpact,
      zoneMultiplier,
      familyMultiplier,
      loadingsTotal,
    },
    grossPremium,
    gstRate,
    gstAmount,
    totalPremium,
    monthlyPremium,
    tenureYears,
    sumInsured,
    age,
    zone,
    selectedRiders,
    pedConditions,
  };
}

/**
 * Get premium for a specific sum insured tier (used by listing pages).
 * Returns just the total, not the full breakdown.
 */
function getPremiumForTier(plan, age, sumInsured) {
  try {
    const result = calculatePremium({
      plan,
      age,
      sumInsured,
      members: [],
      habits: {},
      bmi: 0,
      pedConditions: [],
      tenureYears: 1,
      zone: 'tier1',
      coPayPercent: 0,
      deductibleAmount: 0,
      selectedRiders: [],
    });
    return result.success ? result.totalPremium : null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  calculatePremium,
  getPremiumForTier,
  getBaseFromGrid,
  getHabitLoading,
  getBmiLoading,
  getPedLoading,
  getRidersCost,
  getTenureDiscount,
  getZoneMultiplier,
  getFamilyMultiplier,
  getCoPayImpact,
  getDeductibleImpact,
  isRejectedByPed,
};
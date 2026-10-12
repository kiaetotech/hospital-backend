// D:\hospital backend\services\insurancePremiumEngine.js
// ============================================
// INSURANCE PREMIUM ENGINE
// Deterministic premium calculation.
// ============================================

const GST_RATE = 0.18;

/**
 * Calculate premium for a proposal.
 */
function calculatePremium(input) {
  const {
    plan,
    members = [],
    sumInsured,
    addonCodes = [],
    deductible = 0,
    discountPct = 0,
  } = input;

  if (!plan) throw new Error('plan required');
  if (!Array.isArray(members) || members.length === 0) {
    throw new Error('at least one member required');
  }
  if (!sumInsured || sumInsured <= 0) {
    throw new Error('sumInsured required');
  }

  const breakdown = {
    base: 0,
    memberCountLoading: 0,
    sumInsuredFactor: 1,
    deductibleDiscount: 0,
    addonLines: [],
  };

  // 1) Sum insured factor — normalized to plan base cover
  const planBaseCover = (plan.coverage && plan.coverage.sumInsured) || 500000;
  const siFactor = sumInsured / planBaseCover;
  breakdown.sumInsuredFactor = siFactor;

  // 2) Base premium per member with age loading
  const baseRatePerMember = plan.basePremium || 15000;
  let memberBase = 0;

  for (const m of members) {
    const age = Number(m.age) || 30;
    let loading = 1.0;

    if (age < 18) loading = 0.6;
    else if (age < 30) loading = 1.0;
    else if (age < 40) loading = 1.15;
    else if (age < 50) loading = 1.4;
    else if (age < 60) loading = 1.8;
    else if (age < 70) loading = 2.3;
    else loading = 3.0;

    if (Array.isArray(m.preExisting) && m.preExisting.length > 0) {
      loading += 0.15 * m.preExisting.length;
    }
    if (m.smoker) loading += 0.20;

    memberBase += baseRatePerMember * loading;
  }

  // Family floater discount: 2+ members get 10% off
  const memberCountLoading = members.length > 1 ? -0.10 * memberBase : 0;
  breakdown.memberCountLoading = Math.round(memberCountLoading);
  memberBase = memberBase + memberCountLoading;

  // Apply sum insured factor
  const baseWithSI = memberBase * siFactor;

  // 3) Deductible discount (₹10k deductible → ~5% off, capped at 20%)
  const deductibleDiscount = Math.min(0.20, (deductible / 100000) * 0.5) * baseWithSI;
  breakdown.deductibleDiscount = Math.round(deductibleDiscount);

  const base = Math.max(500, baseWithSI - deductibleDiscount);
  breakdown.base = Math.round(base);

  // 4) Add-ons
  let addonsTotal = 0;
  const addonMap = new Map(
    (plan.addons || []).map((a) => [a.code, a])
  );

  for (const code of addonCodes) {
    const addon = addonMap.get(code);
    if (!addon) continue;
    const price = Number(addon.price) || 0;
    addonsTotal += price;
    breakdown.addonLines.push({
      code,
      name: addon.name,
      price,
    });
  }

  // 5) Discount (coupon or promo)
  const subtotal = base + addonsTotal;
  const discount = Math.round(subtotal * (discountPct / 100));

  // 6) GST on (subtotal - discount)
  const taxable = subtotal - discount;
  const gst = Math.round(taxable * GST_RATE);

  const total = Math.round(taxable + gst);
  const monthly = Math.round(total / 12);

  return {
    base: Math.round(base),
    addons: Math.round(addonsTotal),
    discount,
    gst,
    total,
    monthly,
    breakdown,
  };
}

/**
 * Renewal premium = fresh premium + 8% inflation.
 */
function calculateRenewalPremium(params) {
  const { previousPremium } = params;
  const fresh = calculatePremium(params);
  const inflation = 0.08;
  const total = Math.round(fresh.total * (1 + inflation));
  const gst = Math.round(total - total / (1 + GST_RATE));

  return {
    ...fresh,
    total,
    monthly: Math.round(total / 12),
    gst,
    renewalInflationPct: inflation * 100,
    previousPremium: previousPremium || 0,
  };
}

module.exports = {
  calculatePremium,
  calculateRenewalPremium,
  GST_RATE,
};
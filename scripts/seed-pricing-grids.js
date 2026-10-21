// D:\hospital backend\scripts\seed-pricing-grids.js
// ============================================
// Populate pricingGrid for legacy plans using basePremium as reference
// Realistic Indian health insurance pricing matrix
// ============================================

require('dotenv').config();
const mongoose = require('mongoose');
const InsurancePlan = require('../models/InsurancePlan');

const DB_URI = process.env.DB_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/hospital_db';

// Age curve — young cheap, middle 1x, seniors expensive
const AGE_BANDS = [
  { ageMin: 18, ageMax: 25, multiplier: 0.85 },
  { ageMin: 26, ageMax: 35, multiplier: 1.00 },
  { ageMin: 36, ageMax: 45, multiplier: 1.30 },
  { ageMin: 46, ageMax: 55, multiplier: 1.80 },
  { ageMin: 56, ageMax: 65, multiplier: 2.50 },
];

// Sum insured tiers — volume discount (bigger SI = lower ratio)
const SI_TIERS = [
  { si: 500000, multiplier: 0.60 },
  { si: 1000000, multiplier: 1.00 },
  { si: 2500000, multiplier: 1.80 },
  { si: 5000000, multiplier: 3.00 },
  { si: 10000000, multiplier: 5.50 },
];

function roundPremium(v) { return Math.round(v / 100) * 100; }

async function run() {
  console.log('🔌 Connecting to MongoDB:', DB_URI.replace(/:[^@]+@/, ':***@'));
  await mongoose.connect(DB_URI);
  console.log('✅ Connected\n');

  const plans = await InsurancePlan.find({});
  console.log(`📋 Found ${plans.length} plans\n`);

  let updated = 0, skipped = 0;

  for (const plan of plans) {
    // Skip if already populated
    if (plan.pricingGrid?.ageBands?.length > 0 && Object.keys(plan.pricingGrid?.prices || {}).length > 0) {
      console.log(`⏭️  Skip "${plan.planName}" — already populated`);
      skipped++;
      continue;
    }

    const base = plan.basePremium || 10000;
    if (base <= 0) {
      console.log(`⏭️  Skip "${plan.planName}" — invalid basePremium`);
      skipped++;
      continue;
    }

    const prices = {};
    for (const age of AGE_BANDS) {
      for (const si of SI_TIERS) {
        const key = `${age.ageMin}_${age.ageMax}_${si.si}`;
        prices[key] = roundPremium(base * age.multiplier * si.multiplier);
      }
    }

    plan.pricingGrid = {
      ageBands: AGE_BANDS.map(b => ({ ageMin: b.ageMin, ageMax: b.ageMax, label: `${b.ageMin}-${b.ageMax}` })),
      sumInsuredTiers: SI_TIERS.map(t => t.si),
      prices,
    };

    await plan.save();
    console.log(`✅ Updated "${plan.planName}" (base ₹${base}) — 25 cells populated`);
    updated++;
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`✅ Done — Updated: ${updated}, Skipped: ${skipped}`);
  console.log('═══════════════════════════════════════');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => { console.error('❌ Failed:', err.message); process.exit(1); });
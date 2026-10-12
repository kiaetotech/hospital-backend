// D:\hospital backend\scripts\cleanup-and-normalize-plans.js
// ============================================
// INSURANCE PLAN CLEANUP + NORMALIZATION
//
// Run modes:
//   node scripts/cleanup-and-normalize-plans.js --dry-run    (preview only)
//   node scripts/cleanup-and-normalize-plans.js              (apply)
//
// What it does:
//   1. Deletes orphan plans (companyId is null/missing)
//   2. Deletes orphan addons that reference deleted plans
//   3. Backfills new P2.0 schema fields on surviving plans
//
// Idempotent — safe to run multiple times.
// ============================================

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load .env manually
try {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [rawKey, ...valueParts] = trimmed.split('=');
      const key = rawKey && rawKey.trim();
      if (key && valueParts.length > 0 && process.env[key] === undefined) {
        let value = valueParts.join('=').trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    }
  }
} catch (err) {
  console.warn('No .env file found, using process.env');
}

const DB_URI = process.env.DB_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/hospital_db';
const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  console.log('============================================');
  console.log('INSURANCE PLAN CLEANUP + NORMALIZATION');
  console.log('Mode:', DRY_RUN ? 'DRY RUN (no changes)' : 'APPLY');
  console.log('============================================\n');

  await mongoose.connect(DB_URI);
  console.log('✅ MongoDB connected\n');

  const InsurancePlan = require('../models/InsurancePlan');
  const { InsuranceAddon } = require('../models/InsuranceMarketplace');

  // ==========================================
  // STEP 1 — Find orphan plans
  // ==========================================
  const orphanPlans = await InsurancePlan.find({
    $or: [
      { companyId: null },
      { companyId: { $exists: false } },
    ],
  }).select('_id planName basePremium').lean();

  console.log(`STEP 1 — Orphan plans (companyId missing): ${orphanPlans.length}`);
  for (const p of orphanPlans) {
    console.log(`   • ${p.planName} (${p._id}) — ₹${p.basePremium}`);
  }

  if (orphanPlans.length > 0 && !DRY_RUN) {
    const ids = orphanPlans.map((p) => p._id);
    const delResult = await InsurancePlan.deleteMany({ _id: { $in: ids } });
    console.log(`   🗑  Deleted ${delResult.deletedCount} orphan plans\n`);
  } else if (orphanPlans.length > 0) {
    console.log('   [dry-run] Would delete these plans\n');
  } else {
    console.log('   ✅ No orphan plans\n');
  }

  // ==========================================
  // STEP 2 — Find orphan addons
  // ==========================================
  const survivingPlanIds = await InsurancePlan.distinct('_id');
  const orphanAddons = await InsuranceAddon.find({
    $or: [
      { planId: { $exists: false } },
      { planId: null },
      { planId: { $nin: survivingPlanIds } },
    ],
  }).select('_id planId code').lean();

  console.log(`STEP 2 — Orphan addons (planId missing or dangling): ${orphanAddons.length}`);

  if (orphanAddons.length > 0 && !DRY_RUN) {
    const ids = orphanAddons.map((a) => a._id);
    const delResult = await InsuranceAddon.deleteMany({ _id: { $in: ids } });
    console.log(`   🗑  Deleted ${delResult.deletedCount} orphan addons\n`);
  } else if (orphanAddons.length > 0) {
    console.log('   [dry-run] Would delete these addons\n');
  } else {
    console.log('   ✅ No orphan addons\n');
  }

  // ==========================================
  // STEP 3 — Normalize surviving plans
  // ==========================================
  const survivingPlans = await InsurancePlan.find({}).lean();
  console.log(`STEP 3 — Normalizing ${survivingPlans.length} surviving plans`);
  console.log('   (backfilling coverage / waitingPeriods / benefits / ncb / planCategory)\n');

  let updated = 0;

  for (const plan of survivingPlans) {
    const updates = {};

    // --- coverage.sumInsured ---
    if (!plan.coverage || !plan.coverage.sumInsured) {
      const si = plan.sumInsured && typeof plan.sumInsured === 'object'
        ? plan.sumInsured.default
        : (typeof plan.sumInsured === 'number' ? plan.sumInsured : null);
      if (si) updates['coverage.sumInsured'] = si;
    }

    // --- coverage.roomRent ---
    if (!plan.coverage || !plan.coverage.roomRent) {
      const rr = plan.roomRentLimit;
      if (rr) {
        const map = {
          'no_limit': 'No Limit',
          'single': 'Single Private',
          'single_private': 'Single Private',
          'twin_sharing': 'Twin Sharing',
          'shared': 'Twin Sharing',
          '1%_si': '1% SI',
          '2%_si': '2% SI',
        };
        updates['coverage.roomRent'] = map[rr] || rr;
      }
    }

    // --- coverage.icu ---
    if (!plan.coverage || plan.coverage.icu === undefined) {
      updates['coverage.icu'] = plan.icuCoverage ? 'No Limit' : 'Covered';
    }

    // --- coverage.pre/post hospitalization ---
    if (!plan.coverage || plan.coverage.preHospitalization === undefined) {
      if (plan.preHospitalizationDays != null) updates['coverage.preHospitalization'] = plan.preHospitalizationDays;
    }
    if (!plan.coverage || plan.coverage.postHospitalization === undefined) {
      if (plan.postHospitalizationDays != null) updates['coverage.postHospitalization'] = plan.postHospitalizationDays;
    }

    // --- coverage.dayCare ---
    if (!plan.coverage || plan.coverage.dayCare === undefined) {
      if (plan.daycareCoverage != null) updates['coverage.dayCare'] = plan.daycareCoverage;
    }

    // --- coverage.ambulance ---
    if (!plan.coverage || plan.coverage.ambulance === undefined) {
      if (plan.ambulanceCoverage != null) updates['coverage.ambulance'] = plan.ambulanceCoverage;
    }

    // --- coverage.domiciliary ---
    if (!plan.coverage || plan.coverage.domiciliary === undefined) {
      if (plan.domiciliaryCoverage != null) updates['coverage.domiciliary'] = plan.domiciliaryCoverage;
    }

    // --- waitingPeriods.preExisting (months → days) ---
    if (!plan.waitingPeriods || plan.waitingPeriods.preExisting === undefined || plan.waitingPeriods.preExisting === 1095) {
      if (plan.preExistingWaiting != null && plan.preExistingWaiting > 0) {
        // preExistingWaiting is in months (24 → 730 days)
        updates['waitingPeriods.preExisting'] = plan.preExistingWaiting * 30;
      }
    }

    // --- waitingPeriods.initial default 30 days ---
    if (!plan.waitingPeriods || plan.waitingPeriods.initial === undefined) {
      updates['waitingPeriods.initial'] = 30;
    }

    // --- waitingPeriods.specificDiseases default 730 days ---
    if (!plan.waitingPeriods || plan.waitingPeriods.specificDiseases === undefined) {
      updates['waitingPeriods.specificDiseases'] = 730;
    }

    // --- benefits from features ---
    if (!plan.benefits || plan.benefits.length === 0) {
      if (Array.isArray(plan.features) && plan.features.length > 0) {
        const b = plan.features
          .filter((f) => f && f.included !== false && f.title)
          .map((f) => f.title);
        if (b.length > 0) updates['benefits'] = b;
      }
    }

    // --- ncb defaults ---
    if (!plan.ncb || !plan.ncb.percentage) {
      // Look for NCB in features
      let ncbPct = 50;
      if (Array.isArray(plan.features)) {
        const ncbFeature = plan.features.find((f) =>
          f && f.category === 'ncb' && f.title
        );
        if (ncbFeature) {
          const m = String(ncbFeature.title).match(/(\d+)/);
          if (m) ncbPct = parseInt(m[1], 10);
        }
      }
      updates['ncb.percentage'] = ncbPct;
      updates['ncb.applicable'] = true;
      updates['ncb.maxPercentage'] = 100;
    }

    // --- networkHospitalCount ---
    if (plan.networkHospitalCount === undefined || plan.networkHospitalCount === 0) {
      if (plan.totalNetworkHospitals != null) {
        updates['networkHospitalCount'] = plan.totalNetworkHospitals;
      }
    }

    // --- planCategory from planType ---
    if (!plan.planCategory || plan.planCategory === 'individual') {
      const pt = String(plan.planType || '').toLowerCase();
      let cat = 'individual';
      if (pt.includes('family') || pt.includes('floater')) cat = 'family_floater';
      else if (pt.includes('senior')) cat = 'senior';
      else if (pt.includes('maternity')) cat = 'maternity';
      else if (pt.includes('critical')) cat = 'critical';
      else if (pt.includes('topup') || pt.includes('top-up')) cat = 'topup';
      updates['planCategory'] = cat;
    }

    // --- minAge / maxAge from minEntryAge / maxEntryAge ---
    if (plan.minAge === undefined && plan.minEntryAge != null) {
      updates['minAge'] = plan.minEntryAge;
    }
    if (plan.maxAge === undefined && plan.maxEntryAge != null) {
      updates['maxAge'] = plan.maxEntryAge;
    }

    // --- apply updates ---
    if (Object.keys(updates).length > 0) {
      if (DRY_RUN) {
        console.log(`   [dry-run] ${plan.planName} → ${Object.keys(updates).length} field updates`);
        console.log(`             ${JSON.stringify(updates)}`);
      } else {
        const $set = {};
        for (const [k, v] of Object.entries(updates)) $set[k] = v;
        await InsurancePlan.updateOne({ _id: plan._id }, { $set });
        updated++;
        console.log(`   ✅ ${plan.planName} → ${Object.keys(updates).length} fields updated`);
      }
    } else {
      console.log(`   ⏭  ${plan.planName} — nothing to update`);
    }
  }

  console.log(`\n============================================`);
  console.log('SUMMARY');
  console.log('============================================');
  console.log(`Orphan plans found:    ${orphanPlans.length}`);
  console.log(`Orphan addons found:   ${orphanAddons.length}`);
  console.log(`Plans normalized:      ${updated}`);
  console.log(`Mode:                  ${DRY_RUN ? 'DRY RUN — no changes were made' : 'APPLIED'}`);
  console.log('============================================\n');

  await mongoose.disconnect();
  console.log('✅ Done');
}

run().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
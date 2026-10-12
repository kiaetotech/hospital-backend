// D:\hospital backend\scripts\purge-insurance-test-data.js
// ============================================
//   node scripts/purge-insurance-test-data.js --dry-run   (preview)
//   node scripts/purge-insurance-test-data.js             (apply)
// ============================================

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

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
  console.log('PURGE INSURANCE TEST DATA');
  console.log('Mode:', DRY_RUN ? 'DRY RUN (no changes)' : 'APPLY');
  console.log('============================================\n');

  await mongoose.connect(DB_URI);
  console.log('✅ MongoDB connected\n');

  const InsurancePlan = require('../models/InsurancePlan');
  const InsurancePolicy = require('../models/InsurancePolicy');
  const InsuranceClaim = require('../models/InsuranceClaim');
  const { InsuranceAddon, InsuranceProposal, InsurancePreAuth } = require('../models/InsuranceMarketplace');

  const orphanPlanQuery = { $or: [{ companyId: null }, { companyId: { $exists: false } }] };
  const orphanPlans = await InsurancePlan.find(orphanPlanQuery).select('_id planName basePremium planType').lean();

  console.log(`STEP 1 — Orphan plans: ${orphanPlans.length}`);
  for (const p of orphanPlans) console.log(`   • ${p.planName} (${p._id}) — ₹${p.basePremium}`);
  console.log('');

  const orphanPolicies = await InsurancePolicy.find(orphanPlanQuery).select('_id policyNumber status').lean();
  console.log(`STEP 2 — Orphan policies: ${orphanPolicies.length}\n`);

  const survivingPlanIds = await InsurancePlan.distinct('_id', { companyId: { $ne: null, $exists: true } });
  const orphanAddonQuery = { $or: [{ planId: { $exists: false } }, { planId: null }, { planId: { $nin: survivingPlanIds } }] };
  const orphanAddons = await InsuranceAddon.find(orphanAddonQuery).select('_id code planId').lean();

  console.log(`STEP 3 — Orphan addons: ${orphanAddons.length}`);
  for (const a of orphanAddons) console.log(`   • ${a.code} (${a._id})`);
  console.log('');

  const orphanProposals = await InsuranceProposal.find({ $or: [{ planId: { $nin: survivingPlanIds } }, { planId: null }] })
    .select('_id proposalNumber status').lean();
  console.log(`STEP 4 — Orphan proposals: ${orphanProposals.length}\n`);

  const orphanPolicyIds = orphanPolicies.map((p) => p._id);
  const orphanClaims = await InsuranceClaim.find({
    $or: [
      { policyId: { $in: orphanPolicyIds } },
      { companyId: null },
      { companyId: { $exists: false } },
    ],
  }).select('_id claimNumber amount status').lean();

  console.log(`STEP 5 — Orphan claims: ${orphanClaims.length}`);
  for (const c of orphanClaims) console.log(`   • ${c.claimNumber} (${c._id}) — ₹${c.amount}`);
  console.log('');

  const orphanPreAuths = await InsurancePreAuth.find({
    $or: [
      { policyId: { $in: orphanPolicyIds } },
      { companyId: null },
      { companyId: { $exists: false } },
    ],
  }).select('_id preAuthNumber status').lean();

  console.log(`STEP 6 — Orphan pre-auths: ${orphanPreAuths.length}\n`);

  const totalToDelete =
    orphanPlans.length + orphanPolicies.length + orphanAddons.length +
    orphanProposals.length + orphanClaims.length + orphanPreAuths.length;

  console.log('============================================');
  console.log('SUMMARY');
  console.log('============================================');
  console.log(`Plans:      ${orphanPlans.length}`);
  console.log(`Policies:   ${orphanPolicies.length}`);
  console.log(`Addons:     ${orphanAddons.length}`);
  console.log(`Proposals:  ${orphanProposals.length}`);
  console.log(`Claims:     ${orphanClaims.length}`);
  console.log(`Pre-auths:  ${orphanPreAuths.length}`);
  console.log(`─────────────────────`);
  console.log(`TOTAL:      ${totalToDelete}`);
  console.log(`Mode:       ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log('============================================\n');

  if (!DRY_RUN && totalToDelete > 0) {
    console.log('Applying deletions...\n');
    if (orphanPreAuths.length > 0) {
      const r = await InsurancePreAuth.deleteMany({ _id: { $in: orphanPreAuths.map((x) => x._id) } });
      console.log(`   🗑  Deleted ${r.deletedCount} pre-auths`);
    }
    if (orphanClaims.length > 0) {
      const r = await InsuranceClaim.deleteMany({ _id: { $in: orphanClaims.map((x) => x._id) } });
      console.log(`   🗑  Deleted ${r.deletedCount} claims`);
    }
    if (orphanProposals.length > 0) {
      const r = await InsuranceProposal.deleteMany({ _id: { $in: orphanProposals.map((x) => x._id) } });
      console.log(`   🗑  Deleted ${r.deletedCount} proposals`);
    }
    if (orphanAddons.length > 0) {
      const r = await InsuranceAddon.deleteMany({ _id: { $in: orphanAddons.map((x) => x._id) } });
      console.log(`   🗑  Deleted ${r.deletedCount} addons`);
    }
    if (orphanPolicies.length > 0) {
      const r = await InsurancePolicy.deleteMany({ _id: { $in: orphanPolicies.map((x) => x._id) } });
      console.log(`   🗑  Deleted ${r.deletedCount} policies`);
    }
    if (orphanPlans.length > 0) {
      const r = await InsurancePlan.deleteMany({ _id: { $in: orphanPlans.map((x) => x._id) } });
      console.log(`   🗑  Deleted ${r.deletedCount} plans`);
    }
    console.log('\n✅ Purge complete');
  } else if (DRY_RUN) {
    console.log('Run without --dry-run to apply.');
  } else {
    console.log('✅ Nothing to delete.');
  }

  await mongoose.disconnect();
  console.log('\n✅ Done');
}

run().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
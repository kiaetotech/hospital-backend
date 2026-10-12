// D:\hospital backend\scripts\setup-insurance-tag.js
// ============================================
// ONE-COMMAND SETUP FOR INSURANCE TAG
// Run: node scripts/setup-insurance-tag.js
// ============================================
// 1. Runs companyId migration (User → InsuranceCompany)
// 2. Runs claims source-of-truth migration (optional — skips if none)
// 3. Runs insurance seed (companies, plans, addons, hospitals)
// ============================================

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function run(cmd, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`▶ ${label}`);
  console.log(`${'='.repeat(60)}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    return true;
  } catch (err) {
    console.error(`✗ Failed: ${label}`);
    return false;
  }
}

function fileExists(p) {
  return fs.existsSync(path.resolve(__dirname, '..', p));
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  INSURANCE TAG — ONE-COMMAND SETUP                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // ---- STEP 1: CompanyId migration ----
  if (fileExists('scripts/migrate-insurance-companyid.js')) {
    const ok = run(
      'node scripts/migrate-insurance-companyid.js',
      'STEP 1/3 — Migrating companyId (User → InsuranceCompany)'
    );
    if (!ok) {
      console.error('\n⚠ CompanyId migration failed. Insurance tag may not work correctly.');
      console.error('  You can retry later with: node scripts/migrate-insurance-companyid.js');
    }
  } else {
    console.log('\nℹ scripts/migrate-insurance-companyid.js not found — skipping (no existing plans to migrate)');
  }

  // ---- STEP 2: Claims source of truth migration ----
  if (fileExists('scripts/migrate-claims-source-of-truth.js')) {
    run(
      'node scripts/migrate-claims-source-of-truth.js',
      'STEP 2/3 — Migrating embedded claims → InsuranceClaim collection'
    );
  } else {
    console.log('\nℹ scripts/migrate-claims-source-of-truth.js not found — skipping');
  }

  // ---- STEP 3: Seed data ----
  if (fileExists('seed/insuranceSeed.js')) {
    const ok = run(
      'node seed/insuranceSeed.js',
      'STEP 3/3 — Seeding insurance data (companies, plans, addons, hospitals)'
    );
    if (!ok) {
      console.error('\n⚠ Seeding failed. Retry with: node seed/insuranceSeed.js');
    }
  } else {
    console.error('\n✗ seed/insuranceSeed.js not found. Cannot seed sample data.');
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  SETUP COMPLETE                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\nNEXT STEPS:');
  console.log('  1. Verify data in MongoDB:');
  console.log('     db.insurancecompanies.countDocuments()  → should be 3');
  console.log('     db.insuranceplans.countDocuments()      → should be 6');
  console.log('     db.insuranceaddons.countDocuments()     → should be 12');
  console.log('     db.insurancenetworkhospitals.countDocuments() → should be hundreds');
  console.log('  2. Mount routes in server.js (see docs/INSTALL.md)');
  console.log('  3. Restart server: node server.js');
  console.log('  4. Test: curl http://localhost:PORT/api/insurance/stats\n');
}

main().catch(err => {
  console.error('Setup error:', err);
  process.exit(1);
});
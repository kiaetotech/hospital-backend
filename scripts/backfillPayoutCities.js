/**
 * Backfill Payout City Snapshot
 * Usage:
 *   node scripts/backfillPayoutCities.js --dry-run   # Preview only
 *   node scripts/backfillPayoutCities.js             # Execute
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Payout = require('../models/Payout');
require('../models/AyurvedaDoctor');
require('../models/WellnessCenter');
const { buildPayoutSnapshotFields } = require('../services/providerSnapshotService');

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_ARG = process.argv.find(a => a.startsWith('--batch='));
const BATCH_SIZE = BATCH_ARG ? parseInt(BATCH_ARG.split('=')[1]) : 50;

async function backfill() {
  console.log('═══════════════════════════════════════════');
  console.log('  PAYOUT CITY BACKFILL');
  console.log('═══════════════════════════════════════════');
  console.log(`Mode:       ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log('═══════════════════════════════════════════\n');

  const query = {
    $or: [
      { providerCity: { $exists: false } },
      { providerCity: null },
      { providerCity: '' },
      { providerCity: 'Unknown' }
    ]
  };

  const total = await Payout.countDocuments(query);
  console.log(`Found ${total} payouts needing backfill.\n`);

  if (total === 0) {
    console.log('Nothing to do. Exiting.');
    return;
  }

  let processed = 0;
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  while (true) {
    const batch = await Payout.find(query).limit(BATCH_SIZE);
    if (batch.length === 0) break;

    console.log(`\nProcessing batch of ${batch.length} (${processed}/${total})`);

    for (const payout of batch) {
      processed++;
      try {
        const snapshotFields = await buildPayoutSnapshotFields(
          payout.providerType,
          payout.providerId,
          payout.providerName
        );

        if (snapshotFields.providerSnapshot.name === 'Unknown Provider' &&
            snapshotFields.providerCity === 'Unknown') {
          skipped++;
          console.log(`   SKIP ${payout.payoutId} - provider not found (${payout.providerType})`);
          continue;
        }

        if (DRY_RUN) {
          console.log(`   DRY  ${payout.payoutId} -> ${snapshotFields.providerCity}`);
          succeeded++;
          continue;
        }

        payout.providerName = snapshotFields.providerName;
        payout.providerCity = snapshotFields.providerCity;
        payout.providerSnapshot = snapshotFields.providerSnapshot;
        await payout.save();

        succeeded++;
        console.log(`   OK   ${payout.payoutId} -> ${snapshotFields.providerCity}`);
      } catch (error) {
        failed++;
        errors.push({ payoutId: payout.payoutId, error: error.message });
        console.error(`   FAIL ${payout.payoutId} - ${error.message}`);
      }
    }

    if (DRY_RUN) break;
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════');
  console.log(`  Processed:  ${processed}`);
  console.log(`  Succeeded:  ${succeeded}`);
  console.log(`  Skipped:    ${skipped}`);
  console.log(`  Failed:     ${failed}`);
  console.log('═══════════════════════════════════════════\n');

  if (errors.length > 0) {
    console.log('Errors:');
    errors.slice(0, 10).forEach(e => console.log(`  ${e.payoutId}: ${e.error}`));
  }

  if (DRY_RUN) {
    console.log('DRY RUN complete. Run without --dry-run to apply.');
  } else {
    console.log('Backfill complete.');
  }
}

(async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) throw new Error('MONGO_URI not set in environment');

    await mongoose.connect(mongoUri);
    console.log('MongoDB connected\n');

    await backfill();

    await mongoose.disconnect();
    console.log('Disconnected.');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
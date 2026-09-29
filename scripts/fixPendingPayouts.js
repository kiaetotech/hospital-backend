// ONE-TIME: Reset tdsDeducted to 0 and netAmount to amount for pending payouts
// Usage: node scripts/fixPendingPayouts.js

require('dotenv').config();
const mongoose = require('mongoose');
const Payout = require('../models/Payout');

const MONGO_URI = process.env.DB_URI || process.env.MONGODB_URI || process.env.MONGO_URI;

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Only fix payouts that are still pending/requested and have TDS > 0
    const pending = await Payout.find({
      status: { $in: ['pending', 'requested'] },
      tdsDeducted: { $gt: 0 }
    });

    console.log(`Found ${pending.length} payout(s) to fix:\n`);

    for (const p of pending) {
      const oldTds = p.tdsDeducted;
      const oldNet = p.netAmount;

      p.tdsDeducted = 0;
      p.netAmount = p.amount;
      p.tdsNote = 'Phase 1 policy: no TDS deduction';
      // Keep tdsSection as 'none', tdsConfigId as null

      await p.save();

      console.log(`✓ ${p.payoutId}`);
      console.log(`   Amount:        ₹${p.amount}`);
      console.log(`   Old TDS:       ₹${oldTds}`);
      console.log(`   New TDS:       ₹0`);
      console.log(`   Old Net:       ₹${oldNet}`);
      console.log(`   New Net:       ₹${p.netAmount}`);
      console.log('');
    }

    console.log(`Done. Fixed ${pending.length} payout(s).`);
    process.exit(0);
  } catch (err) {
    console.error('Fix failed:', err);
    process.exit(1);
  }
})();
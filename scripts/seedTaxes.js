// One-time seed script — safe to re-run (idempotent)
// Usage: node scripts/seedTaxes.js

require('dotenv').config();
const mongoose = require('mongoose');
const GstConfig = require('../models/GstConfig');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const serviceTypes = [
  'hospital_opd', 'hospital_admission', 'ambulance', 'ambulance_emergency',
  'ambulance_scheduled', 'labtest', 'health_package', 'caregiver',
  'ayurveda_consultation', 'ayurveda_panchakarma', 'ayurveda_online_doctor',
  'ayurveda_wellness_center', 'ayurveda_home_therapy', 'ayurveda_medicine',
  'ayurveda_product', 'ayurveda_corporate', 'homeopathy_consult',
  'homeopathy_medicine', 'insurance', 'online_consult', 'mental_health',
  'health_emi', 'corporate_health', 'platform_commission'
];

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    let created = 0, exists = 0, errors = 0;

    for (const st of serviceTypes) {
      try {
        const existing = await GstConfig.findOne({ serviceType: st, isActive: true });
        if (existing) { exists++; continue; }

        await GstConfig.create({
          configId: `GST_${st.toUpperCase()}_SEED_${Date.now()}`,
          configName: `${st} — default 18%`,
          serviceType: st,
          ratePercent: 18,
          chargeTo: st === 'platform_commission' ? 'provider' : 'patient',
          scopeType: 'global',
          effectiveFrom: new Date(),
          isActive: true,
          isDefault: true,
          createdBy: 'seed',
          changeReason: 'Initial seed'
        });
        created++;
        console.log(`✓ ${st}`);
      } catch (e) {
        errors++;
        console.log(`✗ ${st}: ${e.message}`);
      }
    }

    console.log(`\nDone. Created: ${created}, Existed: ${exists}, Errors: ${errors}`);
    console.log('TDS rules: NONE seeded (default = 0% deduction). Add when compliance requires.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
})();
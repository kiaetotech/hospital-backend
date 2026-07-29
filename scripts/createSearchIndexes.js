// Run oncescripts/createSearchIndexes.js
require('dotenv').config();
const mongoose = require('mongoose');

const DB_URI = process.env.DB_URI || process.env.MONGODB_URI;

async function createIndexes() {
  await mongoose.connect(DB_URI);
  console.log('✅ Connected to MongoDB');
  
  const db = mongoose.connection.db;
  
  // Regular indexes for regex search (not text indexes)
  const indexes = [
    { col: 'hospitals', field: { name: 1, city: 1 }, options: {} },
    { col: 'hospitals', field: { specialization: 1 }, options: {} },
    { col: 'doctors', field: { name: 1, specialization: 1 }, options: {} },
    { col: 'onlinedoctors', field: { name: 1, specialization: 1 }, options: {} },
    { col: 'ayurvedadoctors', field: { name: 1 }, options: {} },
    { col: 'homeopathydoctors', field: { name: 1 }, options: {} },
    { col: 'mentalhealththerapists', field: { name: 1 }, options: {} },
    { col: 'caregivers', field: { name: 1, serviceType: 1 }, options: {} },
    { col: 'testmasters', field: { testName: 1, category: 1 }, options: {} },
    { col: 'diagnosticsproviders', field: { name: 1 }, options: {} },
    { col: 'wellnesscenters', field: { name: 1 }, options: {} },
    { col: 'naturopathycenters', field: { name: 1 }, options: {} },
    { col: 'insurances', field: { planName: 1 }, options: {} },
    { col: 'ambulances', field: { providerName: 1 }, options: {} },
    { col: 'pharmacies', field: { name: 1 }, options: {} }
  ];

  for (const idx of indexes) {
    try {
      await db.collection(idx.col).createIndex(idx.field, idx.options);
      console.log(`✅ Index created: ${idx.col}`);
    } catch (err) {
      console.error(`❌ Failed: ${idx.col} - ${err.message}`);
    }
  }
  
  console.log('✅ All indexes processed');
  await mongoose.disconnect();
}

createIndexes().catch(console.error);


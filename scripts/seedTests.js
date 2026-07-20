require('dotenv').config();
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');

const DB_URI = process.env.DB_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/hospital_db';

async function seed() {
  await mongoose.connect(DB_URI);
  console.log('✅ MongoDB connected');

  const db = mongoose.connection.db;
  const collection = db.collection('testmasters');
  
  const filePath = path.join(__dirname, '..', 'data', 'diagnostic_tests_master.xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  console.log(`📄 ${rows.length} rows found`);

  // Delete existing tests
  await collection.deleteMany({});
  console.log('🗑️ Old tests deleted');

  // Insert all
  const docs = rows.map((row, index) => ({
    test_id: index + 1,
    test_name: row['test_name'] || row['Test Name'] || '',
    test_short_name: row['test_short_name'] || row['Short Name'] || '',
    major_category: row['main_category'] || row['major_category'] || row['Category'] || '',
    major_category_name: row['main_category'] || row['major_category'] || row['Category'] || '',
    sub_category: row['sub_category'] || row['Sub Category'] || '',
    common_or_unique: row['common_unique'] || 'Common',
    search_keywords: row['search_keywords'] || row['Keywords'] || '',
    sample_type: row['sample_type'] || 'Blood',
    is_active: true,
    home_collection_possible: true,
    turnaround_time_default_hours: 24
  }));

  await collection.insertMany(docs);
  console.log(`✅ ${docs.length} tests seeded`);

  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
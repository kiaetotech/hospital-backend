const mongoose = require('mongoose');

const DB_URI = 'mongodb+srv://kiaetotech:YOUR_PASSWORD@cluster0.4vjxrfm.mongodb.net/';

async function test() {
  try {
    await mongoose.connect(DB_URI, { dbName: 'hospital_db' });
    console.log('✅ Connected successfully!');
    console.log('Database name:', mongoose.connection.db.databaseName);
    process.exit(0);
  } catch (error) {
    console.error('Connection failed:', error.message);
    process.exit(1);
  }
}

test();
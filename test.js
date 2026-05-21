require('dotenv').config();
const mongoose = require('mongoose');

console.log('DB_URI:', process.env.DB_URI);

mongoose.connect(process.env.DB_URI)
  .then(() => {
    console.log('✅ Connected!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const CustomPackage = require('../models/CustomPackage');
const router = express.Router();

const upload = multer({ storage.memoryStorage() });

// Get all packages
router.get('/', async (req, res) => {
  try {
    const packages = await CustomPackage.find({ isActive}).sort({ createdAt: -1 });
    res.json(packages);
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// Upload packages via Excel
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    let count = 0;
    for (const row of data) {
      const tests = [];
      let totalAmount = 0;
      
      for (let i = 1; i <= 10; i++) {
        if (row[`test${i}`]) {
          const testPrice = row[`price${i}`] || 0;
          tests.push({
            testName[`test${i}`],
            price,
            category[`category${i}`] || 'General'
          });
          totalAmount += testPrice;
        }
      }
      
      const discountedAmount = totalAmount - (totalAmount * (row.discountPercent || 0) / 100);
      
      await CustomPackage.findOneAndUpdate(
        { packageName.packageName },
        {
          packageName.packageName,
          description.description || '',
          tests,
          totalAmount,
          discountedAmount,
          discountPercent.discountPercent || 0,
          popular.popular === 'Yes',
          isActive},
        { upsert}
      );
      count++;
    }
    
    res.json({ success, count, message: `${count} packages uploaded` });
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

module.exports = router;


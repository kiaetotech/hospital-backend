const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const CustomPackage = require('../models/CustomPackage');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// Get all packages
router.get('/', async (req, res) => {
  try {
    const packages = await CustomPackage.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(packages);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
            testName: row[`test${i}`],
            price: testPrice,
            category: row[`category${i}`] || 'General'
          });
          totalAmount += testPrice;
        }
      }
      
      const discountedAmount = totalAmount - (totalAmount * (row.discountPercent || 0) / 100);
      
      await CustomPackage.findOneAndUpdate(
        { packageName: row.packageName },
        {
          packageName: row.packageName,
          description: row.description || '',
          tests,
          totalAmount,
          discountedAmount: discountedAmount,
          discountPercent: row.discountPercent || 0,
          popular: row.popular === 'Yes',
          isActive: true
        },
        { upsert: true }
      );
      count++;
    }
    
    res.json({ success: true, count, message: `${count} packages uploaded` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
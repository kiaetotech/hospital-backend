const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const Test = require('D:/hospital-backend/models/Test');
const ProviderPrice = require('D:/hospital-backend/models/ProviderPrice');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/tests', upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    let count = 0;
    for (const row of data) {
      await Test.findOneAndUpdate(
        { testName: row.testName },
        {
          testName: row.testName,
          category: row.category || 'Uncategorized',
          subCategory: row.subCategory || '',
          description: row.description || ''
        },
        { upsert: true }
      );
      count++;
    }
    res.json({ success: true, count, message: `${count} tests uploaded` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/prices', upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    let count = 0;
    for (const row of data) {
      await ProviderPrice.findOneAndUpdate(
        { providerName: row.providerName, testName: row.testName },
        {
          providerName: row.providerName,
          testName: row.testName,
          price: row.price,
          discountedPrice: row.discountedPrice || row.price,
          homeCollectionAvailable: row.homeCollectionAvailable === 'Yes',
          reportTimeHours: row.reportTimeHours || 24,
          city: row.city || 'All',
          rating: row.rating || 4.0
        },
        { upsert: true }
      );
      count++;
    }
    res.json({ success: true, count, message: `${count} prices uploaded` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
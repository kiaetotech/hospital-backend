const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const TestMaster = require('../models/TestMaster');
const TestPricing = require('../models/TestPricing');
const Hospital = require('../models/Hospital');
const { authenticateHospital } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// Download package template
router.get('/template', authenticateHospital, async (req, res) => {
  try {
    const template = [{
      'Package Name': 'Full Body Checkup',
      'Test Names (comma separated)': 'Hemoglobin, Hematocrit, Total Cholesterol, HDL Cholesterol, Fasting Blood Glucose',
      'Package Price (₹)': 999,
      'Discount %': 40
    }];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(template);
    xlsx.utils.book_append_sheet(wb, ws, 'Packages');
    
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=package_template.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upload packages via Excel
router.post('/upload', authenticateHospital, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an Excel file' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'Excel file is empty' });
    }

    const hospital = await Hospital.findById(req.user._id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    let packagesAdded = 0;
    let errors = [];

    for (const row of rows) {
      const packageName = row['Package Name'];
      const testNamesStr = row['Test Names (comma separated)'] || '';
      const packagePrice = parseFloat(row['Package Price (₹)']) || 0;
      const discount = parseFloat(row['Discount %']) || 0;

      if (!packageName || !testNamesStr) {
        errors.push(`Skipped: "${packageName || 'unnamed'}" - missing name or tests`);
        continue;
      }

      const testNames = testNamesStr.split(',').map(t => t.trim()).filter(Boolean);
      
      // Find test IDs from master
      const tests = await TestMaster.find({ 
        test_name: { $in: testNames.map(n => new RegExp('^' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')) }
      }).select('_id test_name').lean();

      const foundNames = tests.map(t => t.test_name);
      const notFound = testNames.filter(n => !foundNames.some(f => f.toLowerCase() === n.toLowerCase()));

      const individualTotal = await TestPricing.aggregate([
        { $match: { provider_id: req.user._id, test_id: { $in: tests.map(t => t._id) } } },
        { $group: { _id: null, total: { $sum: '$discounted_price' } } }
      ]);

      const originalPrice = individualTotal[0]?.total || packagePrice;

      hospital.pricing.health_packages.push({
        name: packageName,
        original_price: originalPrice,
        discounted_price: packagePrice,
        includes: tests.map(t => t._id),
        includes_names: foundNames,
        discount_percentage: discount,
        not_found: notFound
      });

      packagesAdded++;
    }

    await hospital.save();

    res.json({
      success: true,
      message: `${packagesAdded} packages created`,
      packagesAdded,
      errors
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get hospital's packages
router.get('/my-packages', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id).select('pricing.health_packages');
    res.json({ success: true, data: hospital?.pricing?.health_packages || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete a package
router.delete('/:packageId', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    hospital.pricing.health_packages.pull(req.params.packageId);
    await hospital.save();
    res.json({ success: true, message: 'Package removed' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
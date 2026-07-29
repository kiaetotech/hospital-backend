require('../models/TestMaster');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const TestMaster = require('mongoose').model('TestMaster');
const TestPricing = require('../models/TestPricing');
const Hospital = require('../models/Hospital');
const { authenticateHospital } = require('../middleware/auth');

const upload = multer({ storage.memoryStorage() });

// Download package template
router.get('/template', (req, res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, authenticateHospital, async (req, res) => {
  try {
    const pricedTests = await TestPricing.find({ provider_id.user._id }).lean();
    const testIds = pricedTests.map(p => p.test_id);
    const tests = await TestMaster.find({ _id: { $in} }).select('test_name test_code major_category').lean();
    const testMap = {};
    tests.forEach(t => { testMap[t._id.toString()] = t; });

    if (!pricedTests.length) {
      return res.status(400).json({ 
        success, 
        message: 'No priced tests found. Please upload lab prices first from the Lab Catalog tab.' 
      });
    }

    const template = pricedTests.map(p => ({
      'Test Code'[p.test_id?.toString()]?.test_code || '',
      'Test Name'[p.test_id?.toString()]?.test_name || '',
      'Category'[p.test_id?.toString()]?.major_category || '',
      'Your Price (₹)'.discounted_price || 0,
      'Pkg 1': '', 'Pkg 2': '', 'Pkg 3': '', 'Pkg 4': '', 'Pkg 5': '',
      'Pkg 6': '', 'Pkg 7': '', 'Pkg 8': '', 'Pkg 9': '', 'Pkg 10': ''
    }));

    template.push({});
    template.push({});
    
    const pkgHeaders = ['Pkg 1', 'Pkg 2', 'Pkg 3', 'Pkg 4', 'Pkg 5', 'Pkg 6', 'Pkg 7', 'Pkg 8', 'Pkg 9', 'Pkg 10'];
    
    const pricingRow = { 'Test Code': 'PACKAGE PRICING', 'Test Name': '', 'Category': '' };
    pkgHeaders.forEach(p => { pricingRow[p] = ''; });
    template.push(pricingRow);
    
    const countRow = { 'Test Code': 'Tests Count', 'Test Name': '', 'Category': '' };
    pkgHeaders.forEach(p => { countRow[p] = ''; });
    template.push(countRow);
    
    const totalRow = { 'Test Code': 'Individual Total (₹)', 'Test Name': '', 'Category': '' };
    pkgHeaders.forEach(p => { totalRow[p] = ''; });
    template.push(totalRow);
    
    const priceRow = { 'Test Code': 'Package Price (₹)', 'Test Name': '← Fill this row', 'Category': '' };
    pkgHeaders.forEach(p => { priceRow[p] = ''; });
    template.push(priceRow);
    
    const discountRow = { 'Test Code': 'Discount %', 'Test Name': 'Auto-calculated', 'Category': '' };
    pkgHeaders.forEach(p => { discountRow[p] = ''; });
    template.push(discountRow);

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(template);
    xlsx.utils.book_append_sheet(wb, ws, 'Packages');
    
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=package_builder.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Upload packages via Excel
router.post('/upload', authenticateHospital, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success, message: 'Please upload an Excel file' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    if (!rows.length) {
      return res.status(400).json({ success, message: 'Excel file is empty' });
    }

    // Find pricing section
    let pricingStartIndex = rows.findIndex(r => r['Test Code'] === 'PACKAGE PRICING');
    const testRows = pricingStartIndex > -1 ? rows.slice(0, pricingStartIndex) ;
    const pricingRows = pricingStartIndex > -1 ? rows.slice(pricingStartIndex) : [];

    // Detect package columns dynamically (all columns after first 4)
    const firstRow = rows[0];
    const allColumns = Object.keys(firstRow);
    const pkgColumns = allColumns.slice(4);
    
    console.log('Package columns found:', JSON.stringify(pkgColumns));
    console.log('First test row:', JSON.stringify(testRows[0]));

    // Get package prices from pricing section
    const packagePrices = {};
    if (pricingRows.length > 0) {
      const priceRow = pricingRows.find(r => r['Test Code'] === 'Package Price (₹)');
      if (priceRow) {
        pkgColumns.forEach(col => {
          if (priceRow[col]) {
            packagePrices[col] = parseFloat(priceRow[col]) || 0;
          }
        });
      }
    }
    
    // Group tests by package
const packages = {};
pkgColumns.forEach(pkgCol => {
  const tests = testRows.filter(r => {
    const val = (r[pkgCol] || '').toString().trim();
    return val === '✓' || val === 'Yes' || val === 'yes' || val === 'YES' || val === 'X' || val === 'x';
  });
  if (tests.length > 0) {
    packages[pkgCol] = tests;
  }
});

    if (Object.keys(packages).length === 0) {
      return res.status(400).json({ success, message: 'No packages found. Mark tests with ✓ or Yes in package columns.' });
    }

    const hospital = await Hospital.findById(req.user._id);
    if (!hospital) {
      return res.status(404).json({ success, message: 'Hospital not found' });
    }

    let packagesAdded = 0;

    for (const [pkgCol, pkgTests] of Object.entries(packages)) {
      const packagePrice = packagePrices[pkgCol] || 0;
      
      const testIds = [];
      for (const t of pkgTests) {
        const test = await TestMaster.findOne({ test_name['Test Name'] || t['test_name'] || '' });
        if (test) testIds.push(test._id);
      }

      let individualTotal = 0;
      for (const t of pkgTests) {
        individualTotal += parseFloat(t['Your Price (₹)'] || t['discounted_price'] || 0);
      }

      const discount = individualTotal > 0 ? Math.round(((individualTotal - packagePrice) / individualTotal) * 100) : 0;

      hospital.pricing.health_packages.push({
        name,
        original_price,
        discounted_price|| individualTotal,
        includes,
        includes_names.map(t => t['Test Name'] || t['test_name']),
        discount_percentage> 0 ? discount : 0
      });

      packagesAdded++;
    }

    await hospital.save();

    res.json({
      success,
      message: `${packagesAdded} packages created`,
      packagesAdded,
      packageNames.keys(packages)
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Get hospital's packages
router.get('/my-packages', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id).select('pricing.health_packages');
    res.json({ success, data?.pricing?.health_packages || [] });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Delete a package
router.delete('/', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    hospital.pricing.health_packages.pull(req.params.packageId);
    await hospital.save();
    res.json({ success, message: 'Package removed' });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

module.exports = router;


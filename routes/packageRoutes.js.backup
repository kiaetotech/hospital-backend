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
router.get('/template', (req, res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, authenticateHospital, async (req, res) => {
  try {
    // Get all priced tests for this hospital
    const pricedTests = await TestPricing.find({ provider_id: req.user._id })
      .populate('test_id', 'test_name test_code major_category')
      .lean();

    if (!pricedTests.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'No priced tests found. Please upload lab prices first from the Lab Catalog tab.' 
      });
    }

    // Build template with 10 package columns
    const template = pricedTests.map(p => {
      const row = {
        'Test Code': p.test_id?.test_code || '',
        'Test Name': p.test_id?.test_name || '',
        'Category': p.test_id?.major_category || '',
        'Your Price (₹)': p.discounted_price || 0,
        'Pkg 1': '',
        'Pkg 2': '',
        'Pkg 3': '',
        'Pkg 4': '',
        'Pkg 5': '',
        'Pkg 6': '',
        'Pkg 7': '',
        'Pkg 8': '',
        'Pkg 9': '',
        'Pkg 10': ''
      };
      return row;
    });

    // Add empty rows for spacing
    template.push({});
    template.push({});
    
    // Add package pricing section
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

    // Find pricing section
    let pricingStartIndex = rows.findIndex(r => r['Test Code'] === 'PACKAGE PRICING');
    const testRows = pricingStartIndex > -1 ? rows.slice(0, pricingStartIndex) : rows;
    const pricingRows = pricingStartIndex > -1 ? rows.slice(pricingStartIndex) : [];

    // Get package prices from pricing section
    const packagePrices = {};
    if (pricingRows.length > 0) {
      const priceRow = pricingRows.find(r => r['Test Code'] === 'Package Price (₹)');
      if (priceRow) {
        Object.keys(priceRow).forEach(key => {
          if (key.startsWith('Pkg') && priceRow[key]) {
            packagePrices[key] = parseFloat(priceRow[key]) || 0;
          }
        });
      }
    }

    // Find package columns (Pkg 1 to Pkg 10) that have data
    const pkgColumns = ['Pkg 1', 'Pkg 2', 'Pkg 3', 'Pkg 4', 'Pkg 5', 'Pkg 6', 'Pkg 7', 'Pkg 8', 'Pkg 9', 'Pkg 10'];
    
    // Group tests by package
    const packages = {};
    pkgColumns.forEach(pkgCol => {
      const tests = testRows.filter(r => r[pkgCol] === '✓' || r[pkgCol] === 'Yes' || r[pkgCol] === 'yes' || r[pkgCol] === 'YES');
      if (tests.length > 0) {
        packages[pkgCol] = tests;
      }
    });

    if (Object.keys(packages).length === 0) {
      return res.status(400).json({ success: false, message: 'No packages found. Mark tests with ✓ in package columns.' });
    }

    const hospital = await Hospital.findById(req.user._id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    let packagesAdded = 0;

    for (const [pkgCol, pkgTests] of Object.entries(packages)) {
      const packagePrice = packagePrices[pkgCol] || 0;
      
      // Find test IDs
      const testIds = [];
      for (const t of pkgTests) {
        const test = await TestMaster.findOne({ 
          test_name: t['Test Name'] || t['test_name'] || '' 
        });
        if (test) testIds.push(test._id);
      }

      // Calculate individual total
      let individualTotal = 0;
      for (const t of pkgTests) {
        individualTotal += parseFloat(t['Your Price (₹)'] || t['discounted_price'] || 0);
      }

      const discount = individualTotal > 0 ? Math.round(((individualTotal - packagePrice) / individualTotal) * 100) : 0;

      hospital.pricing.health_packages.push({
        name: pkgCol,
        original_price: individualTotal,
        discounted_price: packagePrice || individualTotal,
        includes: testIds,
        includes_names: pkgTests.map(t => t['Test Name'] || t['test_name']),
        discount_percentage: discount > 0 ? discount : 0
      });

      packagesAdded++;
    }

    await hospital.save();

    res.json({
      success: true,
      message: `${packagesAdded} packages created`,
      packagesAdded,
      packageNames: Object.keys(packages)
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

module.exports = router;// force  

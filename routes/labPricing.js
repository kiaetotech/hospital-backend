const express = require('express');
const router = express.Router();
const TestMaster = require('../models/TestMaster');
const TestPricing = require('../models/TestPricing');
const { authenticateHospital } = require('../middleware/auth');
const multer = require('multer');
const xlsx = require('xlsx');
const upload = multer({ storage: multer.memoryStorage() });

// Search tests
router.get('/search', authenticateHospital, async (req, res) => {
  try {
    const { q, category, page = 1, limit = 50 } = req.query;
    const query = { is_active: true };
    
    if (q) {
  query.$or = [
    { test_name: { $regex: q, $options: 'i' } },
    { search_keywords: { $regex: q, $options: 'i' } },
    { major_category: { $regex: q, $options: 'i' } },
    { sub_category: { $regex: q, $options: 'i' } },
    { sub_sub_category: { $regex: q, $options: 'i' } },
    { test_code: { $regex: q, $options: 'i' } }
  ];
}
    if (category && category !== 'All') {
      query.major_category = category;
    }

    const total = await TestMaster.countDocuments(query);
    const tests = await TestMaster.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // Get existing prices for this hospital
    const testIds = tests.map(t => t._id);
    const prices = await TestPricing.find({
      provider_id: req.user._id,
      test_id: { $in: testIds }
    }).lean();

    const priceMap = {};
    prices.forEach(p => { priceMap[p.test_id.toString()] = p; });

    const results = tests.map(t => ({
      ...t,
      hospital_price: priceMap[t._id.toString()]?.discounted_price || '',
      hospital_mrp: priceMap[t._id.toString()]?.mrp || '',
      hospital_home_collection: priceMap[t._id.toString()]?.home_collection_available || false
    }));

    res.json({
      success: true,
      data: results,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Save single test price
router.post('/price', authenticateHospital, async (req, res) => {
  try {
    const { test_id, mrp, discounted_price, home_collection_available } = req.body;
    
    await TestPricing.findOneAndUpdate(
      { provider_id: req.user._id, test_id },
      {
        provider_id: req.user._id,
        test_id,
        mrp: mrp || discounted_price,
        discounted_price: discounted_price || mrp,
        home_collection_available: home_collection_available || false,
        updated_at: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Price saved' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Bulk save prices
router.post('/bulk-price', authenticateHospital, async (req, res) => {
  try {
    const { prices } = req.body; // [{ test_id, mrp, discounted_price }]
    
    const operations = prices.map(p => ({
      updateOne: {
        filter: { provider_id: req.user._id, test_id: p.test_id },
        update: {
          provider_id: req.user._id,
          test_id: p.test_id,
          mrp: p.mrp || p.discounted_price,
          discounted_price: p.discounted_price || p.mrp,
          home_collection_available: p.home_collection || false,
          updated_at: new Date()
        },
        upsert: true
      }
    }));

    await TestPricing.bulkWrite(operations);
    res.json({ success: true, message: `${prices.length} prices saved` });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get hospital's priced tests
router.get('/my-prices', authenticateHospital, async (req, res) => {
  try {
    const prices = await TestPricing.find({ provider_id: req.user._id })
      .populate('test_id', 'test_name major_category sub_category')
      .lean();
    res.json({ success: true, data: prices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await TestMaster.distinct('major_category', { is_active: true });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upload lab prices via Excel
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

    let matched = 0;
    let unmatched = 0;
    const prices = [];

    for (const row of rows) {
      const testName = row['test_name'] || row['Test Name'] || row['Test'] || '';
      if (!testName) continue;

      const test = await TestMaster.findOne({ 
        test_name: { $regex: new RegExp('^' + testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
      });

      if (test) {
        prices.push({
          provider_id: req.user._id,
          test_id: test._id,
          mrp: parseFloat(row['MRP'] || row['mrp'] || row['Price'] || 0) || 0,
          discounted_price: parseFloat(row['Discounted Price'] || row['discounted_price'] || row['Price'] || 0) || 0,
          home_collection_available: row['Home Collection'] === 'Yes' || row['home_collection'] === true,
          updated_at: new Date()
        });
        matched++;
      } else {
        unmatched++;
      }
    }

    if (prices.length > 0) {
      const operations = prices.map(p => ({
        updateOne: {
          filter: { provider_id: p.provider_id, test_id: p.test_id },
          update: { $set: p },
          upsert: true
        }
      }));
      await TestPricing.bulkWrite(operations);
    }

    res.json({
      success: true,
      message: `${matched} tests priced, ${unmatched} not matched`,
      matched,
      unmatched
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Download lab price template
router.get('/template', (req, res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, authenticateHospital, async (req, res) => {
  try {
    const tests = await TestMaster.find({ is_active: true })
      .select('test_name major_category sub_category')
      .sort({ major_category: 1, sub_category: 1, test_name: 1 })
      .lean();
    
    const template = tests.map(t => ({
      'Test Name': t.test_name,
      'Category': t.major_category,
      'Sub Category': t.sub_category || '',
      'MRP': '',
      'Discounted Price': '',
      'Home Collection (Yes/No)': ''
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(template);
    xlsx.utils.book_append_sheet(wb, ws, 'Lab Prices');
    
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=lab_price_template.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
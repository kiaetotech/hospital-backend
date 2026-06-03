const express = require('express');
const router = express.Router();
const TestMaster = require('../models/TestMaster');
const LabTestCategory = require('../models/LabTestCategory');
const DiagnosticsProvider = require('../models/DiagnosticsProvider');
const TestPricing = require('../models/TestPricing');
const HealthPackage = require('../models/HealthPackage');

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

// GET /api/diagnostics/categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await LabTestCategory.find({ is_active: true }).sort('display_order');
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/diagnostics/tests
router.get('/tests', async (req, res) => {
  try {
    const { search, category, city, page = 1, limit = 20 } = req.query;
    let query = { is_active: true };
    
    if (search) {
      query.$or = [
        { test_name: { $regex: search, $options: 'i' } },
        { test_short_name: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) query.major_category = category;
    
    let tests = await TestMaster.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const testsWithPricing = await Promise.all(tests.map(async (test) => {
      let pricingQuery = { test_id: test._id, is_active: true };
      
      if (city) {
        const providers = await DiagnosticsProvider.find({ city: { $regex: new RegExp(city, 'i') }, is_active: true });
        const providerIds = providers.map(p => p._id);
        pricingQuery.provider_id = { $in: providerIds };
      }
      
      const pricing = await TestPricing.find(pricingQuery);
      const minPrice = pricing.length > 0 ? Math.min(...pricing.map(p => p.discounted_price)) : 0;
      
      return {
        ...test.toObject(),
        min_price: minPrice,
        provider_count: pricing.length
      };
    }));
    
    res.json({ success: true, data: testsWithPricing });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/diagnostics/tests/:testId/providers
router.get('/tests/:testId/providers', async (req, res) => {
  try {
    const { testId } = req.params;
    const test = await TestMaster.findById(testId);
    if (!test) return res.status(404).json({ success: false });
    
    let pricing = await TestPricing.find({ test_id: testId, is_active: true })
      .populate('provider_id', 'provider_name rating total_reviews city location is_home_collection_available');
    
    res.json({ success: true, test: test.toObject(), providers: pricing });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/diagnostics/compare-package
router.post('/compare-package', async (req, res) => {
  try {
    const { testIds } = req.body;
    
    const tests = await TestMaster.find({ _id: { $in: testIds } });
    const pricing = await TestPricing.find({ test_id: { $in: testIds }, is_active: true })
      .populate('provider_id', 'provider_name rating total_reviews');
    
    const providerMap = new Map();
    for (const p of pricing) {
      const providerId = p.provider_id._id.toString();
      if (!providerMap.has(providerId)) {
        providerMap.set(providerId, {
          provider_name: p.provider_id.provider_name,
          rating: p.provider_id.rating,
          total_reviews: p.provider_id.total_reviews,
          total_price: 0,
          individual_prices: {},
          tests_found: []
        });
      }
      const entry = providerMap.get(providerId);
      entry.total_price += p.discounted_price;
      entry.individual_prices[p.test_id] = p.discounted_price;
      entry.tests_found.push(p.test_id.toString());
    }
    
    const testIdStrings = testIds.map(id => id.toString());
    const completeProviders = Array.from(providerMap.values())
      .filter(p => testIdStrings.every(tid => p.tests_found.includes(tid)));
    
    res.json({ success: true, tests, providers: completeProviders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
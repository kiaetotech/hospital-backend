const express = require('express');
const router = express.Router();
const TestMaster = require('../models/TestMaster');
const LabTestCategory = require('../models/LabTestCategory');
const DiagnosticsProvider = require('../models/DiagnosticsProvider');
const TestPricing = require('../models/TestPricing');
const HealthPackage = require('../models/HealthPackage');

// Helper function for distance calculation
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

// GET /api/diagnostics/categories - Get all test categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await LabTestCategory.find({ is_active: true }).sort('display_order');
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/diagnostics/tests - Search tests
router.get('/tests', async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, city, page = 1, limit = 20 } = req.query;
    let query = { is_active: true };
    
    if (search) {
      query.$or = [
        { test_name: { $regex: search, $options: 'i' } },
        { test_short_name: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) query.major_category = category;
    
    const tests = await TestMaster.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const testsWithPricing = await Promise.all(tests.map(async (test) => {
      const pricing = await TestPricing.find({ test_id: test._id, is_active: true });
      const minPrice = pricing.length > 0 ? Math.min(...pricing.map(p => p.discounted_price)) : 0;
      return {
        ...test.toObject(),
        min_price: minPrice,
        provider_count: pricing.length
      };
    }));
    
    const total = await TestMaster.countDocuments(query);
    
    res.json({
      success: true,
      data: testsWithPricing,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/diagnostics/tests/:testId/providers - Get all providers offering a specific test
router.get('/tests/:testId/providers', async (req, res) => {
  try {
    const { testId } = req.params;
    const { lat, lng } = req.query;
    
    const test = await TestMaster.findById(testId);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }
    
    let pricing = await TestPricing.find({ test_id: testId, is_active: true })
      .populate('provider_id', 'provider_name rating total_reviews city location is_nabl_accredited is_home_collection_available');
    
    if (lat && lng) {
      pricing = pricing.map(p => {
        const provider = p.provider_id;
        if (provider.location && provider.location.lat) {
          const distance = calculateDistance(lat, lng, provider.location.lat, provider.location.lng);
          return { ...p.toObject(), distance: distance.toFixed(1) };
        }
        return { ...p.toObject(), distance: null };
      });
      pricing.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    }
    
    res.json({ success: true, test: test.toObject(), providers: pricing });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/diagnostics/compare - Compare multiple tests/packages
router.post('/compare', async (req, res) => {
  try {
    const { type, ids } = req.body;
    let items = [];
    
    if (type === 'tests') {
      const tests = await TestMaster.find({ _id: { $in: ids }, is_active: true });
      for (const test of tests) {
        const pricing = await TestPricing.find({ test_id: test._id, is_active: true });
        const minPrice = pricing.length > 0 ? Math.min(...pricing.map(p => p.discounted_price)) : 0;
        items.push({
          ...test.toObject(),
          min_price: minPrice,
          discounted_price: Math.round(minPrice * 0.9)
        });
      }
    } else {
      items = await HealthPackage.find({ _id: { $in: ids }, is_active: true });
    }
    
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/diagnostics/compare-package - Compare multiple tests across labs
router.post('/compare-package', async (req, res) => {
  try {
    const { testIds, lat, lng } = req.body;
    
    const tests = await TestMaster.find({ _id: { $in: testIds } });
    const pricing = await TestPricing.find({ test_id: { $in: testIds }, is_active: true })
      .populate('provider_id', 'provider_name rating total_reviews city location is_home_collection_available');
    
    const providerMap = new Map();
    for (const p of pricing) {
      const providerId = p.provider_id._id.toString();
      if (!providerMap.has(providerId)) {
        providerMap.set(providerId, {
          provider_id: providerId,
          provider_name: p.provider_id.provider_name,
          rating: p.provider_id.rating,
          total_reviews: p.provider_id.total_reviews,
          location: p.provider_id.location,
          home_collection: p.provider_id.is_home_collection_available || false,
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
    let completeProviders = Array.from(providerMap.values())
      .filter(p => testIdStrings.every(tid => p.tests_found.includes(tid)));
    
    if (lat && lng) {
      completeProviders = completeProviders.map(p => {
        if (p.location && p.location.lat) {
          const distance = calculateDistance(lat, lng, p.location.lat, p.location.lng);
          return { ...p, distance: distance.toFixed(1) };
        }
        return { ...p, distance: null };
      });
    }
    
    const cheapest = [...completeProviders].sort((a, b) => a.total_price - b.total_price)[0];
    const highestRated = [...completeProviders].sort((a, b) => b.rating - a.rating)[0];
    
    res.json({
      success: true,
      tests: tests.map(t => ({ id: t._id, name: t.test_name })),
      providers: completeProviders,
      cheapest: cheapest ? { provider_name: cheapest.provider_name, total_price: cheapest.total_price, rating: cheapest.rating } : null,
      highest_rated: highestRated ? { provider_name: highestRated.provider_name, total_price: highestRated.total_price, rating: highestRated.rating } : null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const TestMaster = require('../models/TestMaster');
const LabTestCategory = require('../models/LabTestCategory');
const DiagnosticsProvider = require('../models/DiagnosticsProvider');
const TestPricing = require('../models/TestPricing');
const HealthPackage = require('../models/HealthPackage');
const PackageTest = require('../models/PackageTest');

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
    const { q, category, minPrice, maxPrice, city, homeCollection, page = 1, limit = 20 } = req.query;
    let query = { is_active: true };
    
    if (q) {
      query.$or = [
        { test_name: { $regex: q, $options: 'i' } },
        { test_short_name: { $regex: q, $options: 'i' } },
        { search_keywords: { $regex: q, $options: 'i' } }
      ];
    }
    if (category) query.major_category = category;
    
    const tests = await TestMaster.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    // Get pricing for each test (simplified)
    const testsWithPricing = await Promise.all(tests.map(async (test) => {
      const pricing = await TestPricing.find({ test_id: test._id, is_active: true })
        .populate('provider_id', 'provider_name rating city location')
        .sort('discounted_price');
      
      const minPrice = pricing.length > 0 ? Math.min(...pricing.map(p => p.discounted_price)) : null;
      
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

// GET /api/diagnostics/tests/:id/providers - Compare test across providers
router.get('/tests/:id/providers', async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng, maxDistance = 10 } = req.query;
    
    const test = await TestMaster.findById(id);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
    
    let pricingQuery = { test_id: id, is_active: true };
    let providers = await TestPricing.find(pricingQuery)
      .populate('provider_id', 'provider_name rating total_reviews city location is_nabl_accredited is_iso_accredited is_home_collection_available');
    
    // Calculate distance if location provided
    if (lat && lng) {
      providers = providers.map(p => {
        const provider = p.provider_id;
        if (provider.location && provider.location.lat) {
          const distance = calculateDistance(lat, lng, provider.location.lat, provider.location.lng);
          return { ...p.toObject(), distance: distance.toFixed(1) };
        }
        return { ...p.toObject(), distance: null };
      });
      providers = providers.filter(p => !p.distance || p.distance <= maxDistance);
      providers.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    }
    
    res.json({ success: true, test: test.toObject(), providers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/diagnostics/packages - Get health packages
router.get('/packages', async (req, res) => {
  try {
    const { q, city, minPrice, maxPrice, page = 1, limit = 20 } = req.query;
    let query = { is_active: true };
    
    if (q) query.package_name = { $regex: q, $options: 'i' };
    
    const packages = await HealthPackage.find(query)
      .populate('provider_id', 'provider_name rating city')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await HealthPackage.countDocuments(query);
    
    res.json({
      success: true,
      data: packages,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/diagnostics/compare-custom-package - Build custom package
router.post('/compare-custom-package', async (req, res) => {
  try {
    const { test_ids, city, latitude, longitude, filters = {}, sort_by = 'total_price' } = req.body;
    
    // Get all tests
    const tests = await TestMaster.find({ _id: { $in: test_ids }, is_active: true });
    
    // Find providers offering all selected tests
    const testPricing = await TestPricing.find({ test_id: { $in: test_ids }, is_active: true })
      .populate('provider_id');
    
    // Group by provider
    const providerMap = new Map();
    for (const pricing of testPricing) {
      const providerId = pricing.provider_id._id.toString();
      if (!providerMap.has(providerId)) {
        providerMap.set(providerId, {
          provider: pricing.provider_id,
          tests: [],
          total_price: 0,
          individual_prices: {}
        });
      }
      const entry = providerMap.get(providerId);
      entry.tests.push(pricing.test_id);
      entry.total_price += pricing.discounted_price;
      entry.individual_prices[pricing.test_id] = pricing.discounted_price;
    }
    
    // Filter providers that offer all tests
    const completeProviders = Array.from(providerMap.values())
      .filter(p => p.tests.length === test_ids.length);
    
    // Calculate distance if location provided
    if (latitude && longitude) {
      for (const p of completeProviders) {
        if (p.provider.location && p.provider.location.lat) {
          const distance = calculateDistance(latitude, longitude, p.provider.location.lat, p.provider.location.lng);
          p.distance = distance.toFixed(1);
        }
      }
    }
    
    // Apply filters
    let results = completeProviders;
    if (filters.max_price) {
      results = results.filter(p => p.total_price <= filters.max_price);
    }
    if (filters.min_rating) {
      results = results.filter(p => p.provider.rating >= filters.min_rating);
    }
    if (filters.home_collection_only) {
      results = results.filter(p => p.provider.is_home_collection_available);
    }
    if (filters.max_distance_km && latitude && longitude) {
      results = results.filter(p => p.distance <= filters.max_distance_km);
    }
    
    // Sort results
    if (sort_by === 'total_price') results.sort((a, b) => a.total_price - b.total_price);
    if (sort_by === 'rating') results.sort((a, b) => b.provider.rating - a.provider.rating);
    if (sort_by === 'distance') results.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    
    const cheapest = results[0];
    const highestRated = [...results].sort((a, b) => b.provider.rating - a.provider.rating)[0];
    const fastestReport = [...results].sort((a, b) => {
      const reportA = a.provider.report_time_hours || 24;
      const reportB = b.provider.report_time_hours || 24;
      return reportA - reportB;
    })[0];
    
    res.json({
      success: true,
      results,
      summary: {
        cheapest,
        highest_rated: highestRated,
        fastest_report: fastestReport,
        total_providers: results.length
      },
      tests: tests.map(t => ({ id: t._id, name: t.test_name }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
// POST /api/diagnostics/compare - Compare multiple tests/packages
router.post('/compare', async (req, res) => {
  try {
    const { type, ids } = req.body;
    let items = [];
    
    if (type === 'tests') {
      items = await TestMaster.find({ _id: { $in: ids }, is_active: true });
      // Add pricing info
      items = await Promise.all(items.map(async (item) => {
        const pricing = await TestPricing.find({ test_id: item._id, is_active: true });
        const minPrice = pricing.length > 0 ? Math.min(...pricing.map(p => p.discounted_price)) : item.price;
        return {
          ...item.toObject(),
          min_price: minPrice,
          discounted_price: Math.round(minPrice * 0.9)
        };
      }));
    } else {
      items = await HealthPackage.find({ _id: { $in: ids }, is_active: true });
    }
    
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
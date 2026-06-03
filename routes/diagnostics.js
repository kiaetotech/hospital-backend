const express = require('express');
const router = express.Router();
const TestMaster = require('../models/TestMaster');
const DiagnosticsProvider = require('../models/DiagnosticsProvider');
const TestPricing = require('../models/TestPricing');

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

router.get('/tests', async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    let query = { is_active: true };
    if (search) query.test_name = { $regex: search, $options: 'i' };
    const tests = await TestMaster.find(query).limit(parseInt(limit)).skip((parseInt(page)-1)*parseInt(limit));
    const total = await TestMaster.countDocuments(query);
    res.json({ success: true, data: tests, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/tests/:testId/providers', async (req, res) => {
  try {
    const { testId } = req.params;
    const { lat, lng } = req.query;
    const pricing = await TestPricing.find({ test_id: testId, is_active: true }).populate('provider_id', 'provider_name rating total_reviews city location home_collection_available');
    let providers = pricing.map(p => ({ provider_id: p.provider_id, discounted_price: p.discounted_price, original_price: p.mrp, home_collection_available: p.provider_id?.home_collection_available || false, distance: null }));
    if (lat && lng) {
      providers = providers.map(p => {
        if (p.provider_id?.location?.lat) {
          const distance = calculateDistance(parseFloat(lat), parseFloat(lng), p.provider_id.location.lat, p.provider_id.location.lng);
          return { ...p, distance: distance.toFixed(1) };
        }
        return p;
      });
    }
    res.json({ success: true, providers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/compare-package', async (req, res) => {
  try {
    const { testIds, lat, lng } = req.body;
    if (!testIds || testIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No test IDs provided' });
    }
    const tests = await TestMaster.find({ _id: { $in: testIds } });
    const pricing = await TestPricing.find({ test_id: { $in: testIds }, is_active: true }).populate('provider_id', 'provider_name rating total_reviews city location home_collection_available');
    const providerMap = new Map();
    for (const p of pricing) {
      const providerId = p.provider_id._id.toString();
      if (!providerMap.has(providerId)) {
        providerMap.set(providerId, { provider_name: p.provider_id.provider_name, rating: p.provider_id.rating, total_reviews: p.provider_id.total_reviews, home_collection: p.provider_id?.home_collection_available || false, location: p.provider_id.location, total_price: 0, individual_prices: {}, tests_found: [] });
      }
      const entry = providerMap.get(providerId);
      entry.total_price += p.discounted_price;
      entry.individual_prices[p.test_id.toString()] = p.discounted_price;
      entry.tests_found.push(p.test_id.toString());
    }
    const testIdStrings = testIds.map(id => id.toString());
    let completeProviders = Array.from(providerMap.values()).filter(p => testIdStrings.every(tid => p.tests_found.includes(tid)));
    if (lat && lng) {
      completeProviders = completeProviders.map(p => {
        if (p.location?.lat) {
          const distance = calculateDistance(lat, lng, p.location.lat, p.location.lng);
          return { ...p, distance: distance.toFixed(1) };
        }
        return { ...p, distance: null };
      });
      completeProviders.sort((a, b) => {
        if (a.total_price !== b.total_price) return a.total_price - b.total_price;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return parseFloat(a.distance) - parseFloat(b.distance);
      });
    } else {
      completeProviders.sort((a, b) => a.total_price - b.total_price);
    }
    const cheapest = completeProviders.length > 0 ? { provider_name: completeProviders[0].provider_name, total_price: completeProviders[0].total_price } : null;
    res.json({ success: true, tests, providers: completeProviders, cheapest });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await TestMaster.distinct('major_category_name');
    res.json({ success: true, categories: categories.filter(c => c) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// ============================================
// SEED DATA - One click to add sample data
// Visit this URL once: /api/diagnostics/seed
// ============================================
router.get('/seed', async (req, res) => {
  try {
    // 1. Create sample tests
    const tests = await TestMaster.insertMany([
      { test_name: 'Complete Blood Count (CBC)', major_category_name: 'Hematology', is_active: true, price: 499, min_price: 399 },
      { test_name: 'Blood Sugar (Fasting)', major_category_name: 'Diabetes', is_active: true, price: 199, min_price: 149 },
      { test_name: 'Lipid Profile', major_category_name: 'Cardiology', is_active: true, price: 799, min_price: 599 },
      { test_name: 'Liver Function Test (LFT)', major_category_name: 'Hepatology', is_active: true, price: 699, min_price: 549 },
      { test_name: 'Thyroid Profile (T3, T4, TSH)', major_category_name: 'Endocrinology', is_active: true, price: 599, min_price: 449 },
      { test_name: 'Vitamin D', major_category_name: 'Nutrition', is_active: true, price: 1299, min_price: 999 },
      { test_name: 'HbA1c', major_category_name: 'Diabetes', is_active: true, price: 399, min_price: 299 },
      { test_name: 'Urine Routine', major_category_name: 'Urinalysis', is_active: true, price: 149, min_price: 99 }
    ]);
    
    // 2. Create sample labs/providers
    const providers = await DiagnosticsProvider.insertMany([
      { provider_name: 'Dr. Lal PathLabs', rating: 4.7, total_reviews: 12500, city: 'Delhi', location: { lat: 28.6139, lng: 77.2090 }, is_home_collection_available: true, is_active: true },
      { provider_name: 'SRL Diagnostics', rating: 4.5, total_reviews: 8900, city: 'Delhi', location: { lat: 28.7041, lng: 77.1025 }, is_home_collection_available: true, is_active: true },
      { provider_name: 'Thyrocare', rating: 4.6, total_reviews: 15000, city: 'Mumbai', location: { lat: 19.0760, lng: 72.8777 }, is_home_collection_available: true, is_active: true },
      { provider_name: 'Metropolis Healthcare', rating: 4.4, total_reviews: 7200, city: 'Mumbai', location: { lat: 19.0760, lng: 72.8777 }, is_home_collection_available: true, is_active: true },
      { provider_name: 'Medall Healthcare', rating: 4.3, total_reviews: 3400, city: 'Chennai', location: { lat: 13.0827, lng: 80.2707 }, is_home_collection_available: false, is_active: true }
    ]);
    
    // 3. Create pricing (link tests to labs with prices)
    const pricingData = [];
    
    // For each provider, add prices for each test
    for (const provider of providers) {
      for (const test of tests) {
        const discount = 0.2 + Math.random() * 0.3; // 20-50% discount
        const discounted = Math.round(test.price * (1 - discount));
        pricingData.push({
          provider_id: provider._id,
          test_id: test._id,
          mrp: test.price,
          discounted_price: discounted,
          discount_percentage: Math.round(discount * 100),
          home_collection_available: provider.is_home_collection_available,
          home_collection_fee: provider.is_home_collection_available ? 0 : 99,
          report_time_hours: 24 + Math.floor(Math.random() * 24),
          is_active: true
        });
      }
    }
    
    await TestPricing.insertMany(pricingData);
    
    res.json({
      success: true,
      message: '✅ Sample data added successfully!',
      data: {
        tests: tests.length,
        providers: providers.length,
        pricings: pricingData.length
      }
    });
    
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
module.exports = router;
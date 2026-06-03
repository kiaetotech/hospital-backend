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

// ============================================
// GET /api/diagnostics/tests
// ============================================
router.get('/tests', async (req, res) => {
  try {
    const { search, page = 1, limit = 100 } = req.query;
    let query = {};
    
    // Remove the is_active filter temporarily
    // query = { is_active: true };
    
    if (search) {
      query.test_name = { $regex: search, $options: 'i' };
    }
    
    const tests = await TestMaster.find(query)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await TestMaster.countDocuments(query);
    
    res.json({
      success: true,
      data: tests,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    console.error('Error in /tests:', error);
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
// SEED DATA - Complete data from your Excel
// Visit this URL once: /api/diagnostics/seed
// ============================================
router.get('/seed', async (req, res) => {
  try {
    // Clear existing data
    await TestMaster.deleteMany({});
    await DiagnosticsProvider.deleteMany({});
    await TestPricing.deleteMany({});
    
    // ==================== TESTS (with boolean values) ====================
    const tests = await TestMaster.insertMany([
      { test_id: 1001, test_name: 'Complete Blood Count', test_short_name: 'CBC', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Hematology', requires_fasting: false, sample_type: 'Blood', turnaround_time_default_hours: 4, home_collection_possible: true, is_active: true },
      { test_id: 1002, test_name: 'Liver Function Test', test_short_name: 'LFT', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Biochemistry', requires_fasting: true, sample_type: 'Blood', turnaround_time_default_hours: 6, home_collection_possible: true, is_active: true },
      { test_id: 1003, test_name: 'Thyroid Profile', test_short_name: 'TSH', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Hormones', requires_fasting: false, sample_type: 'Blood', turnaround_time_default_hours: 8, home_collection_possible: true, is_active: true },
      { test_id: 1004, test_name: 'Vitamin D', test_short_name: 'Vitamin D', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Vitamins', requires_fasting: false, sample_type: 'Blood', turnaround_time_default_hours: 24, home_collection_possible: true, is_active: true },
      { test_id: 1005, test_name: 'Lipid Profile', test_short_name: 'Lipid', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Biochemistry', requires_fasting: true, sample_type: 'Blood', turnaround_time_default_hours: 6, home_collection_possible: true, is_active: true },
      { test_id: 1006, test_name: 'Kidney Function Test', test_short_name: 'RFT', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Biochemistry', requires_fasting: true, sample_type: 'Blood', turnaround_time_default_hours: 6, home_collection_possible: true, is_active: true },
      { test_id: 1007, test_name: 'Blood Sugar Fasting', test_short_name: 'BSF', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Diabetes', requires_fasting: true, sample_type: 'Blood', turnaround_time_default_hours: 4, home_collection_possible: true, is_active: true },
      { test_id: 1008, test_name: 'Blood Sugar Post Meal', test_short_name: 'PPBS', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Diabetes', requires_fasting: false, sample_type: 'Blood', turnaround_time_default_hours: 4, home_collection_possible: true, is_active: true },
      { test_id: 1009, test_name: 'HB1Ac', test_short_name: 'HB1Ac', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Diabetes', requires_fasting: false, sample_type: 'Blood', turnaround_time_default_hours: 8, home_collection_possible: true, is_active: true },
      { test_id: 1010, test_name: 'Urine Routine', test_short_name: 'Urine Routine', major_category: 'URN', major_category_name: 'Urine Tests', sub_category: 'Routine', requires_fasting: false, sample_type: 'Urine', turnaround_time_default_hours: 4, home_collection_possible: true, is_active: true },
      { test_id: 1011, test_name: 'Urine Culture', test_short_name: 'Urine Culture', major_category: 'URN', major_category_name: 'Urine Tests', sub_category: 'Culture', requires_fasting: false, sample_type: 'Urine', turnaround_time_default_hours: 48, home_collection_possible: true, is_active: true },
      { test_id: 2001, test_name: 'Chest X-Ray', test_short_name: 'X-Ray Chest', major_category: 'IMG', major_category_name: 'Medical Imaging', sub_category: 'X-Ray', requires_fasting: false, sample_type: 'Other', turnaround_time_default_hours: 2, home_collection_possible: false, is_active: true },
      { test_id: 2002, test_name: 'ECG', test_short_name: 'ECG', major_category: 'CRD', major_category_name: 'Cardiac Diagnostics', sub_category: 'ECG', requires_fasting: false, sample_type: 'Other', turnaround_time_default_hours: 1, home_collection_possible: true, is_active: true },
      { test_id: 2003, test_name: '2D Echo', test_short_name: 'Echo', major_category: 'CRD', major_category_name: 'Cardiac Diagnostics', sub_category: 'Ultrasound', requires_fasting: false, sample_type: 'Other', turnaround_time_default_hours: 2, home_collection_possible: false, is_active: true }
    ]);
    
    // ==================== PROVIDERS ====================
    const providers = await DiagnosticsProvider.insertMany([
      { provider_id: 1, provider_name: 'ABC Diagnostics', provider_type: 'Lab', city: 'Mumbai', rating: 4.5, is_nabl_accredited: true, is_home_collection_available: true, is_active: true },
      { provider_id: 2, provider_name: 'City Hospital Lab', provider_type: 'Hospital', city: 'Mumbai', rating: 4.3, is_nabl_accredited: false, is_home_collection_available: false, is_active: true },
      { provider_id: 3, provider_name: 'HealthCare Diagnostics', provider_type: 'Lab', city: 'Mumbai', rating: 4.7, is_nabl_accredited: true, is_home_collection_available: true, is_active: true },
      { provider_id: 4, provider_name: 'Metropolis Healthcare', provider_type: 'Lab', city: 'Delhi', rating: 4.6, is_nabl_accredited: true, is_home_collection_available: true, is_active: true },
      { provider_id: 5, provider_name: 'Dr Lal PathLabs', provider_type: 'Lab', city: 'Delhi', rating: 4.8, is_nabl_accredited: true, is_home_collection_available: true, is_active: true },
      { provider_id: 6, provider_name: 'Apollo Diagnostic', provider_type: 'Lab', city: 'Bangalore', rating: 4.9, is_nabl_accredited: true, is_home_collection_available: true, is_active: true }
    ]);
    
    // Create maps for lookup
    const providerMap = {};
    providers.forEach(p => { providerMap[p.provider_name] = p; });
    
    const testMap = {};
    tests.forEach(t => { testMap[t.test_id] = t; });
    
    // ==================== PRICING ====================
    const pricingData = [];
    
    const excelPricing = [
      { test_id: 1001, provider_name: 'ABC Diagnostics', mrp: 399, discounted_price: 199, home_collection: true, report_time_hours: 4 },
      { test_id: 1002, provider_name: 'ABC Diagnostics', mrp: 499, discounted_price: 299, home_collection: true, report_time_hours: 6 },
      { test_id: 1003, provider_name: 'ABC Diagnostics', mrp: 599, discounted_price: 399, home_collection: true, report_time_hours: 8 },
      { test_id: 1004, provider_name: 'ABC Diagnostics', mrp: 999, discounted_price: 699, home_collection: true, report_time_hours: 24 },
      { test_id: 1005, provider_name: 'ABC Diagnostics', mrp: 499, discounted_price: 299, home_collection: true, report_time_hours: 6 },
      { test_id: 1006, provider_name: 'City Hospital Lab', mrp: 350, discounted_price: 199, home_collection: false, report_time_hours: 6 },
      { test_id: 1007, provider_name: 'City Hospital Lab', mrp: 450, discounted_price: 299, home_collection: false, report_time_hours: 8 },
      { test_id: 1001, provider_name: 'HealthCare Diagnostics', mrp: 450, discounted_price: 249, home_collection: true, report_time_hours: 3 },
      { test_id: 1002, provider_name: 'HealthCare Diagnostics', mrp: 550, discounted_price: 349, home_collection: true, report_time_hours: 5 },
      { test_id: 1003, provider_name: 'HealthCare Diagnostics', mrp: 650, discounted_price: 449, home_collection: true, report_time_hours: 6 },
      { test_id: 1001, provider_name: 'Metropolis Healthcare', mrp: 400, discounted_price: 199, home_collection: true, report_time_hours: 4 },
      { test_id: 1001, provider_name: 'Dr Lal PathLabs', mrp: 380, discounted_price: 189, home_collection: true, report_time_hours: 4 },
      { test_id: 1001, provider_name: 'Apollo Diagnostic', mrp: 420, discounted_price: 209, home_collection: true, report_time_hours: 3 }
    ];
    
    for (const p of excelPricing) {
      const provider = providerMap[p.provider_name];
      const test = testMap[p.test_id];
      
      if (provider && test) {
        pricingData.push({
          provider_id: provider._id,
          test_id: test._id,
          mrp: p.mrp,
          discounted_price: p.discounted_price,
          discount_percentage: Math.round(((p.mrp - p.discounted_price) / p.mrp) * 100),
          home_collection_available: p.home_collection,
          report_time_hours: p.report_time_hours,
          is_active: true
        });
      }
    }
    
    await TestPricing.insertMany(pricingData);
    
    res.json({
      success: true,
      message: '✅ Complete data imported from Excel!',
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
// ============================================
// ONE-CLICK IMPORT - Complete Excel Data
// Visit: /api/diagnostics/import-all
// ============================================
router.get('/import-all', async (req, res) => {
  try {
    // Clear existing data
    await TestMaster.deleteMany({});
    await DiagnosticsProvider.deleteMany({});
    await TestPricing.deleteMany({});

    // ========== 1. IMPORT TESTS ==========
    const tests = await TestMaster.insertMany([
      { test_id: 1001, test_name: 'Complete Blood Count', test_short_name: 'CBC', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Hematology', requires_fasting: false, sample_type: 'Blood', turnaround_time_default_hours: 4, home_collection_possible: true, is_active: true },
      { test_id: 1002, test_name: 'Liver Function Test', test_short_name: 'LFT', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Biochemistry', requires_fasting: true, sample_type: 'Blood', turnaround_time_default_hours: 6, home_collection_possible: true, is_active: true },
      { test_id: 1003, test_name: 'Thyroid Profile', test_short_name: 'TSH', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Hormones', requires_fasting: false, sample_type: 'Blood', turnaround_time_default_hours: 8, home_collection_possible: true, is_active: true },
      { test_id: 1004, test_name: 'Vitamin D', test_short_name: 'Vitamin D', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Vitamins', requires_fasting: false, sample_type: 'Blood', turnaround_time_default_hours: 24, home_collection_possible: true, is_active: true },
      { test_id: 1005, test_name: 'Lipid Profile', test_short_name: 'Lipid', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Biochemistry', requires_fasting: true, sample_type: 'Blood', turnaround_time_default_hours: 6, home_collection_possible: true, is_active: true },
      { test_id: 1006, test_name: 'Kidney Function Test', test_short_name: 'RFT', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Biochemistry', requires_fasting: true, sample_type: 'Blood', turnaround_time_default_hours: 6, home_collection_possible: true, is_active: true },
      { test_id: 1007, test_name: 'Blood Sugar Fasting', test_short_name: 'BSF', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Diabetes', requires_fasting: true, sample_type: 'Blood', turnaround_time_default_hours: 4, home_collection_possible: true, is_active: true },
      { test_id: 1008, test_name: 'Blood Sugar Post Meal', test_short_name: 'PPBS', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Diabetes', requires_fasting: false, sample_type: 'Blood', turnaround_time_default_hours: 4, home_collection_possible: true, is_active: true },
      { test_id: 1009, test_name: 'HB1Ac', test_short_name: 'HB1Ac', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Diabetes', requires_fasting: false, sample_type: 'Blood', turnaround_time_default_hours: 8, home_collection_possible: true, is_active: true },
      { test_id: 1010, test_name: 'Urine Routine', test_short_name: 'Urine Routine', major_category: 'URN', major_category_name: 'Urine Tests', sub_category: 'Routine', requires_fasting: false, sample_type: 'Urine', turnaround_time_default_hours: 4, home_collection_possible: true, is_active: true },
      { test_id: 1011, test_name: 'Urine Culture', test_short_name: 'Urine Culture', major_category: 'URN', major_category_name: 'Urine Tests', sub_category: 'Culture', requires_fasting: false, sample_type: 'Urine', turnaround_time_default_hours: 48, home_collection_possible: true, is_active: true },
      { test_id: 1012, test_name: 'Stool Routine', test_short_name: 'Stool Routine', major_category: 'STL', major_category_name: 'Stool Tests', sub_category: 'Routine', requires_fasting: false, sample_type: 'Stool', turnaround_time_default_hours: 4, home_collection_possible: true, is_active: true },
      { test_id: 1013, test_name: 'Stool Occult Blood', test_short_name: 'Occult Blood', major_category: 'STL', major_category_name: 'Stool Tests', sub_category: 'Screening', requires_fasting: false, sample_type: 'Stool', turnaround_time_default_hours: 4, home_collection_possible: true, is_active: true },
      { test_id: 2001, test_name: 'Chest X-Ray', test_short_name: 'X-Ray Chest', major_category: 'IMG', major_category_name: 'Medical Imaging', sub_category: 'X-Ray', requires_fasting: false, sample_type: 'Other', turnaround_time_default_hours: 2, home_collection_possible: false, is_active: true },
      { test_id: 2002, test_name: 'ECG', test_short_name: 'ECG', major_category: 'CRD', major_category_name: 'Cardiac Diagnostics', sub_category: 'ECG', requires_fasting: false, sample_type: 'Other', turnaround_time_default_hours: 1, home_collection_possible: true, is_active: true },
      { test_id: 2003, test_name: '2D Echo', test_short_name: 'Echo', major_category: 'CRD', major_category_name: 'Cardiac Diagnostics', sub_category: 'Ultrasound', requires_fasting: false, sample_type: 'Other', turnaround_time_default_hours: 2, home_collection_possible: false, is_active: true },
      { test_id: 2004, test_name: 'TMT', test_short_name: 'TMT', major_category: 'CRD', major_category_name: 'Cardiac Diagnostics', sub_category: 'Stress Test', requires_fasting: false, sample_type: 'Other', turnaround_time_default_hours: 3, home_collection_possible: false, is_active: true }
    ]);

    // ========== 2. IMPORT PROVIDERS ==========
    const providers = await DiagnosticsProvider.insertMany([
      { provider_id: 1, provider_name: 'ABC Diagnostics', provider_type: 'Lab', city: 'Mumbai', rating: 4.5, total_reviews: 1250, is_nabl_accredited: true, is_home_collection_available: true, is_active: true, location: { lat: 19.0760, lng: 72.8777 } },
      { provider_id: 2, provider_name: 'City Hospital Lab', provider_type: 'Hospital', city: 'Mumbai', rating: 4.3, total_reviews: 890, is_nabl_accredited: false, is_home_collection_available: false, is_active: true, location: { lat: 19.0760, lng: 72.8777 } },
      { provider_id: 3, provider_name: 'HealthCare Diagnostics', provider_type: 'Lab', city: 'Mumbai', rating: 4.7, total_reviews: 2100, is_nabl_accredited: true, is_home_collection_available: true, is_active: true, location: { lat: 19.0760, lng: 72.8777 } },
      { provider_id: 4, provider_name: 'Metropolis Healthcare', provider_type: 'Lab', city: 'Delhi', rating: 4.6, total_reviews: 1800, is_nabl_accredited: true, is_home_collection_available: true, is_active: true, location: { lat: 28.6139, lng: 77.2090 } },
      { provider_id: 5, provider_name: 'Dr Lal PathLabs', provider_type: 'Lab', city: 'Delhi', rating: 4.8, total_reviews: 3200, is_nabl_accredited: true, is_home_collection_available: true, is_active: true, location: { lat: 28.6139, lng: 77.2090 } },
      { provider_id: 6, provider_name: 'Apollo Diagnostic', provider_type: 'Lab', city: 'Bangalore', rating: 4.9, total_reviews: 2800, is_nabl_accredited: true, is_home_collection_available: true, is_active: true, location: { lat: 12.9716, lng: 77.5946 } }
    ]);

    // Create maps for lookup
    const testMap = {};
    tests.forEach(t => { testMap[t.test_id] = t; });

    const providerMap = {};
    providers.forEach(p => { providerMap[p.provider_name] = p; });

    // ========== 3. IMPORT PRICING ==========
    const pricingData = [
      { test_id: 1001, provider_name: 'ABC Diagnostics', mrp: 399, discounted_price: 199, home_collection: true, report_time_hours: 4 },
      { test_id: 1002, provider_name: 'ABC Diagnostics', mrp: 499, discounted_price: 299, home_collection: true, report_time_hours: 6 },
      { test_id: 1003, provider_name: 'ABC Diagnostics', mrp: 599, discounted_price: 399, home_collection: true, report_time_hours: 8 },
      { test_id: 1004, provider_name: 'ABC Diagnostics', mrp: 999, discounted_price: 699, home_collection: true, report_time_hours: 24 },
      { test_id: 1005, provider_name: 'ABC Diagnostics', mrp: 499, discounted_price: 299, home_collection: true, report_time_hours: 6 },
      { test_id: 1006, provider_name: 'City Hospital Lab', mrp: 350, discounted_price: 199, home_collection: false, report_time_hours: 6 },
      { test_id: 1007, provider_name: 'City Hospital Lab', mrp: 450, discounted_price: 299, home_collection: false, report_time_hours: 8 },
      { test_id: 1001, provider_name: 'HealthCare Diagnostics', mrp: 450, discounted_price: 249, home_collection: true, report_time_hours: 3 },
      { test_id: 1002, provider_name: 'HealthCare Diagnostics', mrp: 550, discounted_price: 349, home_collection: true, report_time_hours: 5 },
      { test_id: 1003, provider_name: 'HealthCare Diagnostics', mrp: 650, discounted_price: 449, home_collection: true, report_time_hours: 6 },
      { test_id: 1001, provider_name: 'Metropolis Healthcare', mrp: 400, discounted_price: 199, home_collection: true, report_time_hours: 4 },
      { test_id: 1001, provider_name: 'Dr Lal PathLabs', mrp: 380, discounted_price: 189, home_collection: true, report_time_hours: 4 },
      { test_id: 1001, provider_name: 'Apollo Diagnostic', mrp: 420, discounted_price: 209, home_collection: true, report_time_hours: 3 }
    ];

    const pricings = [];
    for (const p of pricingData) {
      const test = testMap[p.test_id];
      const provider = providerMap[p.provider_name];
      if (test && provider) {
        pricings.push({
          test_id: test._id,
          provider_id: provider._id,
          mrp: p.mrp,
          discounted_price: p.discounted_price,
          discount_percentage: Math.round(((p.mrp - p.discounted_price) / p.mrp) * 100),
          home_collection_available: p.home_collection,
          report_time_hours: p.report_time_hours,
          is_active: true
        });
      }
    }

    await TestPricing.insertMany(pricings);

    res.json({
      success: true,
      message: '✅ Complete Excel data imported successfully!',
      data: {
        tests: tests.length,
        providers: providers.length,
        pricings: pricings.length
      }
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
// ============================================
// CREATE MASTER CATALOG - All tests from your list
// Visit: /api/diagnostics/create-master-catalog
// ============================================
router.get('/create-master-catalog', async (req, res) => {
  try {
    // Clear existing tests
    await TestMaster.deleteMany({});

    const allTests = [];

    // ========== 1. BLD — Blood Tests ==========
    const bloodTests = [
      // Hematology
      { test_name: 'Complete Blood Count', test_short_name: 'CBC', sub_category: 'Hematology', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'Hemoglobin', test_short_name: 'Hb', sub_category: 'Hematology', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'White Blood Cell Count', test_short_name: 'WBC', sub_category: 'Hematology', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'Platelet Count', test_short_name: 'Platelets', sub_category: 'Hematology', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'ESR', test_short_name: 'ESR', sub_category: 'Hematology', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'CRP', test_short_name: 'CRP', sub_category: 'Hematology', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'Peripheral Smear', test_short_name: 'Peripheral Smear', sub_category: 'Hematology', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'Hb Electrophoresis', test_short_name: 'Hb Electrophoresis', sub_category: 'Hematology', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 24 },
      { test_name: 'Reticulocyte Count', test_short_name: 'Reticulocyte', sub_category: 'Hematology', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      // Coagulation
      { test_name: 'PT/INR', test_short_name: 'PT/INR', sub_category: 'Coagulation', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'aPTT', test_short_name: 'aPTT', sub_category: 'Coagulation', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'D-Dimer', test_short_name: 'D-Dimer', sub_category: 'Coagulation', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'Fibrinogen', test_short_name: 'Fibrinogen', sub_category: 'Coagulation', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      // Biochemistry
      { test_name: 'Glucose Fasting', test_short_name: 'Fasting Sugar', sub_category: 'Biochemistry', requires_fasting: true, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'HbA1c', test_short_name: 'HbA1c', sub_category: 'Biochemistry', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'Liver Function Test', test_short_name: 'LFT', sub_category: 'Biochemistry', requires_fasting: true, sample_type: 'Blood', turnaround_time_hours: 6 },
      { test_name: 'Kidney Function Test', test_short_name: 'RFT', sub_category: 'Biochemistry', requires_fasting: true, sample_type: 'Blood', turnaround_time_hours: 6 },
      { test_name: 'Electrolytes', test_short_name: 'Electrolytes', sub_category: 'Biochemistry', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'Calcium', test_short_name: 'Calcium', sub_category: 'Biochemistry', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'Magnesium', test_short_name: 'Magnesium', sub_category: 'Biochemistry', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'Phosphate', test_short_name: 'Phosphate', sub_category: 'Biochemistry', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'Uric Acid', test_short_name: 'Uric Acid', sub_category: 'Biochemistry', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'Lipid Profile', test_short_name: 'Lipid Profile', sub_category: 'Biochemistry', requires_fasting: true, sample_type: 'Blood', turnaround_time_hours: 6 },
      { test_name: 'Amylase', test_short_name: 'Amylase', sub_category: 'Biochemistry', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'Lipase', test_short_name: 'Lipase', sub_category: 'Biochemistry', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'LDH', test_short_name: 'LDH', sub_category: 'Biochemistry', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'Troponin', test_short_name: 'Troponin', sub_category: 'Biochemistry', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 2 },
      { test_name: 'CK-MB', test_short_name: 'CK-MB', sub_category: 'Biochemistry', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      // Iron studies
      { test_name: 'Serum Iron', test_short_name: 'Serum Iron', sub_category: 'Iron studies', requires_fasting: true, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'TIBC', test_short_name: 'TIBC', sub_category: 'Iron studies', requires_fasting: true, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'Ferritin', test_short_name: 'Ferritin', sub_category: 'Iron studies', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'Transferrin Saturation', test_short_name: 'Transferrin Sat', sub_category: 'Iron studies', requires_fasting: true, sample_type: 'Blood', turnaround_time_hours: 8 },
      // Vitamins
      { test_name: 'Vitamin B12', test_short_name: 'B12', sub_category: 'Vitamins', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 24 },
      { test_name: 'Vitamin D', test_short_name: 'Vitamin D', sub_category: 'Vitamins', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 24 },
      { test_name: 'Folate', test_short_name: 'Folate', sub_category: 'Vitamins', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 24 },
      // Hormones
      { test_name: 'TSH', test_short_name: 'TSH', sub_category: 'Hormones', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'T3', test_short_name: 'T3', sub_category: 'Hormones', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'T4', test_short_name: 'T4', sub_category: 'Hormones', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'Cortisol', test_short_name: 'Cortisol', sub_category: 'Hormones', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'Prolactin', test_short_name: 'Prolactin', sub_category: 'Hormones', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'LH', test_short_name: 'LH', sub_category: 'Hormones', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'FSH', test_short_name: 'FSH', sub_category: 'Hormones', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'Estradiol', test_short_name: 'Estradiol', sub_category: 'Hormones', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'Progesterone', test_short_name: 'Progesterone', sub_category: 'Hormones', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'Testosterone', test_short_name: 'Testosterone', sub_category: 'Hormones', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'PTH', test_short_name: 'PTH', sub_category: 'Hormones', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'Insulin', test_short_name: 'Insulin', sub_category: 'Hormones', requires_fasting: true, sample_type: 'Blood', turnaround_time_hours: 8 },
      // Tumor markers
      { test_name: 'AFP', test_short_name: 'AFP', sub_category: 'Tumor markers', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 24 },
      { test_name: 'CEA', test_short_name: 'CEA', sub_category: 'Tumor markers', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 24 },
      { test_name: 'CA-125', test_short_name: 'CA-125', sub_category: 'Tumor markers', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 24 },
      { test_name: 'CA 19-9', test_short_name: 'CA 19-9', sub_category: 'Tumor markers', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 24 },
      { test_name: 'PSA', test_short_name: 'PSA', sub_category: 'Tumor markers', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 24 },
      // Serology/Immunology
      { test_name: 'HIV Test', test_short_name: 'HIV', sub_category: 'Serology/Immunology', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'HBsAg', test_short_name: 'HBsAg', sub_category: 'Serology/Immunology', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'Anti-HCV', test_short_name: 'Anti-HCV', sub_category: 'Serology/Immunology', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'Dengue Test', test_short_name: 'Dengue', sub_category: 'Serology/Immunology', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'Malaria Test', test_short_name: 'Malaria', sub_category: 'Serology/Immunology', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 4 },
      { test_name: 'Rheumatoid Factor', test_short_name: 'RF', sub_category: 'Serology/Immunology', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 8 },
      { test_name: 'ANA', test_short_name: 'ANA', sub_category: 'Serology/Immunology', requires_fasting: false, sample_type: 'Blood', turnaround_time_hours: 24 }
    ];

    // Add tests with BLD category
    let testId = 10000;
    bloodTests.forEach(test => {
      testId++;
      allTests.push({
        test_id: testId,
        test_name: test.test_name,
        test_short_name: test.test_short_name,
        major_category: 'BLD',
        major_category_name: 'Blood Tests',
        sub_category: test.sub_category,
        requires_fasting: test.requires_fasting,
        sample_type: test.sample_type,
        turnaround_time_default_hours: test.turnaround_time_hours,
        home_collection_possible: true,
        is_active: true
      });
    });

    // ========== Add more categories here ==========
    // IMG, CRD, URN, STL, NEU, PFT, END, CSF, CYT, GEN, MIC, SPL

    // Insert all tests into database
    await TestMaster.insertMany(allTests);

    res.json({
      success: true,
      message: 'Master catalog created successfully!',
      data: {
        totalTests: allTests.length,
        categories: ['BLD', 'IMG', 'CRD', 'URN', 'STL', 'NEU', 'PFT', 'END', 'CSF', 'CYT', 'GEN', 'MIC', 'SPL']
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
module.exports = router;
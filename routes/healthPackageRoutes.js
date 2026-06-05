const express = require('express');
const router = express.Router();
const HealthPackage = require('../models/HealthPackage');
const HealthPackageBooking = require('../models/HealthPackageBooking');
const HealthPackageReview = require('../models/HealthPackageReview');
const DiagnosticsProvider = require('../models/DiagnosticsProvider');

// Helper: Calculate distance
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// ==================== SEED ENDPOINT ====================
router.get('/seed', async (req, res) => {
  try {
    const provider = await DiagnosticsProvider.findOne();
    if (!provider) {
      return res.status(404).json({ status: 'error', message: 'No provider found' });
    }

    const samplePackages = [
      {
        package_id: 1001,
        provider_id: provider._id,
        package_name: "Full Body Checkup",
        package_description: "Complete health checkup with 65+ tests",
        tests_included_text: "CBC, LFT, KFT, Lipid Profile, Thyroid, HbA1c, Vitamin D",
        mrp: 2500,
        discounted_price: 1299,
        home_collection_available: true,
        report_time_hours: 24,
        gender: "Unisex",
        is_popular: true,
        is_active: true
      },
      {
        package_id: 1002,
        provider_id: provider._id,
        package_name: "Cardiac Care Package",
        package_description: "Heart health checkup with lipid profile and ECG",
        tests_included_text: "Lipid Profile, ECG, Troponin, CRP",
        mrp: 1800,
        discounted_price: 999,
        home_collection_available: true,
        report_time_hours: 12,
        gender: "Unisex",
        is_popular: true,
        is_active: true
      },
      {
        package_id: 1003,
        provider_id: provider._id,
        package_name: "Diabetes Profile",
        package_description: "Complete diabetes screening",
        tests_included_text: "HbA1c, Glucose Fasting, Insulin, Microalbumin",
        mrp: 1200,
        discounted_price: 699,
        home_collection_available: true,
        report_time_hours: 8,
        gender: "Unisex",
        is_popular: true,
        is_active: true
      }
    ];
    
    for (const pkg of samplePackages) {
      await HealthPackage.findOneAndUpdate(
        { package_name: pkg.package_name },
        pkg,
        { upsert: true, new: true }
      );
    }
    
    const totalPackages = await HealthPackage.countDocuments();
    res.json({ status: 'success', message: `Added packages. Total: ${totalPackages}` });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==================== PATIENT APIS ====================

// GET /api/health-packages - Get all packages
router.get('/', async (req, res) => {
  try {
    const packages = await HealthPackage.find({ is_active: true })
      .populate('provider_id', 'provider_name rating location is_home_collection_available')
      .sort({ is_popular: -1, display_order: 1 });
    
    res.json({ status: 'success', packages, total: packages.length });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/health-packages/search - Search packages
router.get('/search', async (req, res) => {
  try {
    const { query, min_price, max_price, home_collection, sort_by, page = 1, limit = 20 } = req.query;
    let filter = { is_active: true };

    if (query) {
      filter.$or = [
        { package_name: { $regex: query, $options: 'i' } },
        { package_description: { $regex: query, $options: 'i' } }
      ];
    }
    
    if (min_price || max_price) {
      filter.discounted_price = {};
      if (min_price) filter.discounted_price.$gte = parseFloat(min_price);
      if (max_price) filter.discounted_price.$lte = parseFloat(max_price);
    }
    
    if (home_collection === 'true') filter.home_collection_available = true;

    let packages = await HealthPackage.find(filter)
      .populate('provider_id', 'provider_name rating location')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    if (sort_by === 'price_low_to_high') {
      packages.sort((a, b) => a.discounted_price - b.discounted_price);
    } else if (sort_by === 'price_high_to_low') {
      packages.sort((a, b) => b.discounted_price - a.discounted_price);
    }

    res.json({ status: 'success', packages, total: packages.length });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/health-packages/popular - Get popular packages
router.get('/popular', async (req, res) => {
  try {
    const packages = await HealthPackage.find({ is_active: true, is_popular: true })
      .populate('provider_id', 'provider_name rating')
      .limit(8);
    res.json({ status: 'success', packages });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/health-packages/:id - Get package details
router.get('/:id', async (req, res) => {
  try {
    const pkg = await HealthPackage.findById(req.params.id)
      .populate('provider_id', 'provider_name rating location');
    if (!pkg) return res.status(404).json({ status: 'error', message: 'Package not found' });

    const testsList = pkg.tests_included_text ? pkg.tests_included_text.split(',').map(t => t.trim()) : [];
    res.json({ status: 'success', package: pkg, tests_list: testsList });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/health-packages/compare - Compare packages
router.post('/compare', async (req, res) => {
  try {
    const { package_ids } = req.body;
    const packages = await HealthPackage.find({ _id: { $in: package_ids }, is_active: true })
      .populate('provider_id', 'provider_name rating');

    const comparisonData = packages.map(pkg => ({
      package_id: pkg._id,
      package_name: pkg.package_name,
      provider_name: pkg.provider_id?.provider_name,
      provider_rating: pkg.provider_id?.rating,
      tests_count: pkg.tests_included_text ? pkg.tests_included_text.split(',').length : 0,
      mrp: pkg.mrp,
      discounted_price: pkg.discounted_price,
      home_collection_available: pkg.home_collection_available,
      report_time_hours: pkg.report_time_hours,
      gender: pkg.gender,
      is_popular: pkg.is_popular
    }));

    comparisonData.sort((a, b) => a.discounted_price - b.discounted_price);
    res.json({ status: 'success', packages: comparisonData });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/health-packages/:id/book - Book a package
router.post('/:id/book', async (req, res) => {
  try {
    const pkg = await HealthPackage.findById(req.params.id);
    if (!pkg) return res.status(404).json({ status: 'error', message: 'Package not found' });

    const { patient_name, patient_phone, appointment_date } = req.body;
    const booking_reference = 'HP' + Date.now();

    const booking = new HealthPackageBooking({
      package_id: pkg._id,
      provider_id: pkg.provider_id,
      booking_reference,
      patient_name,
      patient_phone,
      appointment_date,
      total_amount: pkg.mrp,
      discount_applied: pkg.mrp - pkg.discounted_price,
      final_amount: pkg.discounted_price,
      payment_status: 'pending',
      booking_status: 'confirmed'
    });

    await booking.save();
    res.json({ status: 'success', message: 'Booking created', booking_reference });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/health-packages/:id/review - Submit review
router.post('/:id/review', async (req, res) => {
  try {
    const { rating, review_text } = req.body;
    const pkg = await HealthPackage.findById(req.params.id);
    if (!pkg) return res.status(404).json({ status: 'error', message: 'Package not found' });

    const review = new HealthPackageReview({
      package_id: pkg._id,
      provider_id: pkg.provider_id,
      rating,
      review_text
    });

    await review.save();
    res.json({ status: 'success', message: 'Review submitted' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==================== PROVIDER APIS ====================

// GET /api/provider/health-packages
router.get('/provider/health-packages', async (req, res) => {
  try {
    const { provider_id } = req.query;
    const packages = await HealthPackage.find({ provider_id }).sort('-createdAt');
    res.json({ status: 'success', packages });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/provider/health-packages
router.post('/provider/health-packages', async (req, res) => {
  try {
    const packageData = req.body;
    packageData.package_id = Date.now();
    if (packageData.mrp && packageData.discounted_price) {
      packageData.discount_percentage = Math.round(((packageData.mrp - packageData.discounted_price) / packageData.mrp) * 100);
    }
    const newPackage = new HealthPackage(packageData);
    await newPackage.save();
    res.json({ status: 'success', package: newPackage });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
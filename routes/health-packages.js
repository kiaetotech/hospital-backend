const express = require('express');
const router = express.Router();
const HealthPackage = require('../models/HealthPackage');
const PackageTest = require('../models/PackageTest');
const PackageBooking = require('../models/PackageBooking');
const PackageReview = require('../models/PackageReview');
const TestMaster = require('../models/TestMaster');
const DiagnosticsProvider = require('../models/DiagnosticsProvider');

// Helper: Calculate distance using Haversine formula
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

// ==================== PATIENT FACING APIs ====================

// GET /api/packages/search - Search packages with filters
router.get('/search', async (req, res) => {
  try {
    const {
      query, city, latitude, longitude, package_type, min_price, max_price,
      min_rating, home_collection, max_report_time_hours, gender, age,
      requires_fasting, sort_by, page = 1, limit = 20
    } = req.query;

    let filter = { is_active: true, is_approved: true };

    if (query) {
      filter.$or = [
        { package_name: { $regex: query, $options: 'i' } },
        { package_description: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ];
    }

    if (city) filter.city = { $regex: city, $options: 'i' };
    if (package_type) filter.package_type = package_type;
    
    if (min_price || max_price) {
      filter.discounted_price = {};
      if (min_price) filter.discounted_price.$gte = parseFloat(min_price);
      if (max_price) filter.discounted_price.$lte = parseFloat(max_price);
    }
    
    if (home_collection === 'true') filter.home_collection_available = true;
    if (max_report_time_hours) filter.report_time_hours = { $lte: parseInt(max_report_time_hours) };
    if (gender && gender !== 'unisex') filter.gender = { $in: [gender, 'unisex'] };
    if (age) {
      filter.min_age = { $lte: parseInt(age) };
      filter.max_age = { $gte: parseInt(age) };
    }
    if (requires_fasting === 'true') filter.requires_fasting = true;

    let packages = await HealthPackage.find(filter)
      .populate('provider_id', 'provider_name rating total_reviews city location is_nabl_accredited')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    for (let pkg of packages) {
      const testCount = await PackageTest.countDocuments({ package_id: pkg._id });
      pkg.total_tests_count = testCount;
      
      const reviews = await PackageReview.aggregate([
        { $match: { package_id: pkg._id } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]);
      pkg.average_rating = reviews[0]?.avg || 0;
      pkg.total_reviews_count = reviews[0]?.count || 0;

      const packageTests = await PackageTest.find({ package_id: pkg._id })
        .populate('test_id', 'test_name')
        .limit(6);
      pkg.tests_short_list = packageTests.map(pt => pt.test_id?.test_name).filter(Boolean);
    }

    if (sort_by === 'price_low_to_high') {
      packages.sort((a, b) => a.discounted_price - b.discounted_price);
    } else if (sort_by === 'price_high_to_low') {
      packages.sort((a, b) => b.discounted_price - a.discounted_price);
    } else if (sort_by === 'rating') {
      packages.sort((a, b) => b.average_rating - a.average_rating);
    }

    if (latitude && longitude) {
      for (let pkg of packages) {
        if (pkg.provider_id?.location?.lat) {
          pkg.distance_km = calculateDistance(
            parseFloat(latitude), parseFloat(longitude),
            pkg.provider_id.location.lat, pkg.provider_id.location.lng
          ).toFixed(1);
        }
      }
      if (sort_by === 'distance') {
        packages.sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999));
      }
    }

    const total = await HealthPackage.countDocuments(filter);

    res.json({
      status: 'success',
      total,
      page: parseInt(page),
      total_pages: Math.ceil(total / limit),
      packages
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/packages/:package_id - Get package details
router.get('/:package_id', async (req, res) => {
  try {
    const pkg = await HealthPackage.findById(req.params.package_id)
      .populate('provider_id', 'provider_name rating total_reviews city location is_nabl_accredited address phone email');

    if (!pkg) {
      return res.status(404).json({ status: 'error', message: 'Package not found' });
    }

    const packageTests = await PackageTest.find({ package_id: pkg._id })
      .populate('test_id', 'test_name test_short_name major_category_name sub_category')
      .sort('display_order');

    const testsByCategory = {};
    for (const pt of packageTests) {
      const category = pt.test_id?.major_category_name || 'Other';
      if (!testsByCategory[category]) testsByCategory[category] = [];
      testsByCategory[category].push(pt.test_id);
    }

    const reviews = await PackageReview.find({ package_id: pkg._id })
      .populate('user_id', 'name')
      .sort('-created_at')
      .limit(20);

    res.json({
      status: 'success',
      package: pkg,
      tests_by_category: testsByCategory,
      total_tests: packageTests.length,
      reviews
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/packages/compare - Compare multiple packages
router.post('/compare', async (req, res) => {
  try {
    const { package_ids, latitude, longitude } = req.body;

    const packages = await HealthPackage.find({ _id: { $in: package_ids }, is_active: true })
      .populate('provider_id', 'provider_name rating total_reviews city location is_nabl_accredited');

    const comparisonData = [];

    for (const pkg of packages) {
      const testCount = await PackageTest.countDocuments({ package_id: pkg._id });
      const reviews = await PackageReview.aggregate([
        { $match: { package_id: pkg._id } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]);

      let distance = null;
      if (latitude && longitude && pkg.provider_id?.location?.lat) {
        distance = calculateDistance(
          parseFloat(latitude), parseFloat(longitude),
          pkg.provider_id.location.lat, pkg.provider_id.location.lng
        ).toFixed(1);
      }

      comparisonData.push({
        package_id: pkg._id,
        package_name: pkg.package_name,
        package_type: pkg.package_type,
        provider: pkg.provider_id,
        tests_count: testCount,
        mrp: pkg.mrp,
        discounted_price: pkg.discounted_price,
        discount_percentage: pkg.discount_percentage,
        home_collection_available: pkg.home_collection_available,
        report_time_hours: pkg.report_time_hours,
        requires_fasting: pkg.requires_fasting,
        fasting_hours: pkg.fasting_hours,
        gender: pkg.gender,
        rating: reviews[0]?.avg || 0,
        total_reviews: reviews[0]?.count || 0,
        distance_km: distance
      });
    }

    comparisonData.sort((a, b) => a.discounted_price - b.discounted_price);
    res.json({ status: 'success', packages: comparisonData });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/packages/nearby - Packages from nearby labs
router.get('/nearby', async (req, res) => {
  try {
    const { latitude, longitude, radius = 10, limit = 20 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ status: 'error', message: 'Latitude and longitude required' });
    }

    const providers = await DiagnosticsProvider.find({
      'location.lat': { $exists: true },
      is_active: true
    });

    const nearbyProviders = [];
    for (const provider of providers) {
      const distance = calculateDistance(
        parseFloat(latitude), parseFloat(longitude),
        provider.location.lat, provider.location.lng
      );
      if (distance <= parseFloat(radius)) {
        nearbyProviders.push(provider._id);
      }
    }

    const packages = await HealthPackage.find({
      provider_id: { $in: nearbyProviders },
      is_active: true,
      is_approved: true
    })
      .populate('provider_id', 'provider_name rating location')
      .limit(parseInt(limit));

    res.json({ status: 'success', packages });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/packages/:package_id/book - Book a package
router.post('/:package_id/book', async (req, res) => {
  try {
    const pkg = await HealthPackage.findById(req.params.package_id);
    if (!pkg) {
      return res.status(404).json({ status: 'error', message: 'Package not found' });
    }

    const {
      patient_name, patient_age, patient_gender, patient_phone, patient_email,
      appointment_date, appointment_time_slot, home_collection_requested, home_address
    } = req.body;

    const booking_reference = 'PKG' + Date.now() + Math.floor(Math.random() * 1000);

    const booking = new PackageBooking({
      booking_id: Date.now(),
      package_id: pkg._id,
      provider_id: pkg.provider_id,
      booking_reference,
      patient_name,
      patient_age,
      patient_gender,
      patient_phone,
      patient_email,
      appointment_date,
      appointment_time_slot,
      home_collection_requested: home_collection_requested || false,
      home_address,
      total_amount: pkg.mrp,
      discount_applied: pkg.mrp - pkg.discounted_price,
      final_amount: pkg.discounted_price,
      payment_status: 'pending',
      booking_status: 'confirmed'
    });

    await booking.save();

    res.json({
      status: 'success',
      message: 'Booking created successfully',
      booking_reference,
      booking_id: booking._id,
      final_amount: pkg.discounted_price
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/packages/:package_id/review - Submit review
router.post('/:package_id/review', async (req, res) => {
  try {
    const { rating, review_text, user_id, booking_id } = req.body;
    const pkg = await HealthPackage.findById(req.params.package_id);

    if (!pkg) {
      return res.status(404).json({ status: 'error', message: 'Package not found' });
    }

    const review = new PackageReview({
      package_id: pkg._id,
      provider_id: pkg.provider_id,
      user_id,
      booking_id,
      rating,
      review_text,
      is_verified_purchase: !!booking_id
    });

    await review.save();
    res.json({ status: 'success', message: 'Review submitted successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/packages/suggest - Smart suggestions
router.get('/suggest', async (req, res) => {
  try {
    const { age, gender, symptoms } = req.query;
    let filter = { is_active: true, is_approved: true };

    if (age) {
      filter.min_age = { $lte: parseInt(age) };
      filter.max_age = { $gte: parseInt(age) };
    }
    if (gender) filter.gender = { $in: [gender, 'unisex'] };

    let packages = await HealthPackage.find(filter)
      .populate('provider_id', 'provider_name rating')
      .limit(10);

    res.json({ status: 'success', packages });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==================== PROVIDER FACING APIs ====================

// POST /api/provider/packages/bulk-upload
router.post('/provider/packages/bulk-upload', async (req, res) => {
  try {
    const { packages, provider_id } = req.body;
    const results = { success: [], failed: [] };

    for (const pkgData of packages) {
      try {
        const testNames = pkgData.tests_included.split(',').map(t => t.trim());
        const testIds = [];

        for (const testName of testNames) {
          const test = await TestMaster.findOne({ test_name: { $regex: new RegExp(`^${testName}$`, 'i') } });
          if (test) testIds.push(test._id);
        }

        const slug = pkgData.package_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        const newPackage = new HealthPackage({
          package_id: Date.now(),
          provider_id,
          package_name: pkgData.package_name,
          package_slug: slug,
          package_description: pkgData.description,
          package_type: pkgData.package_type,
          tests_included_text: pkgData.tests_included,
          total_tests_count: testIds.length,
          mrp: pkgData.mrp,
          discounted_price: pkgData.discounted_price,
          home_collection_available: pkgData.home_collection === 'Yes',
          report_time_hours: pkgData.report_time_hours,
          requires_fasting: pkgData.requires_fasting === 'Yes',
          fasting_hours: pkgData.fasting_hours || 0,
          gender: pkgData.gender || 'unisex',
          min_age: pkgData.min_age || 0,
          max_age: pkgData.max_age || 100,
          tags: pkgData.tags ? pkgData.tags.split(',') : [],
          city: pkgData.city,
          is_approved: false
        });

        await newPackage.save();

        for (let i = 0; i < testIds.length; i++) {
          const packageTest = new PackageTest({
            package_id: newPackage._id,
            test_id: testIds[i],
            display_order: i
          });
          await packageTest.save();
        }

        results.success.push({ package_name: pkgData.package_name });
      } catch (err) {
        results.failed.push({ package_name: pkgData.package_name, error: err.message });
      }
    }

    res.json({ status: 'success', results });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/provider/packages - List packages for a provider
router.get('/provider/packages', async (req, res) => {
  try {
    const { provider_id } = req.query;
    const packages = await HealthPackage.find({ provider_id }).sort('-created_at');
    res.json({ status: 'success', packages });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==================== ADMIN FACING APIs ====================

// GET /api/admin/packages/pending
router.get('/admin/packages/pending', async (req, res) => {
  try {
    const packages = await HealthPackage.find({ is_approved: false })
      .populate('provider_id', 'provider_name')
      .sort('-created_at');
    res.json({ status: 'success', packages });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// PUT /api/admin/packages/:package_id/approve
router.put('/admin/packages/:package_id/approve', async (req, res) => {
  try {
    const { approve } = req.body;
    const pkg = await HealthPackage.findById(req.params.package_id);
    if (!pkg) {
      return res.status(404).json({ status: 'error', message: 'Package not found' });
    }
    pkg.is_approved = approve === true;
    await pkg.save();
    res.json({ status: 'success', message: approve ? 'Package approved' : 'Package rejected' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/admin/packages/stats
router.get('/admin/packages/stats', async (req, res) => {
  try {
    const totalPackages = await HealthPackage.countDocuments();
    const pendingApprovals = await HealthPackage.countDocuments({ is_approved: false });
    const activePackages = await HealthPackage.countDocuments({ is_active: true, is_approved: true });
    const totalBookings = await PackageBooking.countDocuments();
    const totalRevenue = await PackageBooking.aggregate([
      { $match: { payment_status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$final_amount' } } }
    ]);

    res.json({
      status: 'success',
      stats: {
        total_packages: totalPackages,
        pending_approvals: pendingApprovals,
        active_packages: activePackages,
        total_bookings: totalBookings,
        total_revenue: totalRevenue[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
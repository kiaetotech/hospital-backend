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
// ==================== ADDITIONAL PATIENT APIS ====================

// GET /api/health-packages/nearby - Packages from nearby labs
router.get('/nearby', async (req, res) => {
  try {
    const { latitude, longitude, radius = 10, limit = 20 } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ status: 'error', message: 'Latitude and longitude required' });
    }

    // Get all providers with location
    const providers = await DiagnosticsProvider.find({
      'location.lat': { $exists: true },
      is_active: true
    });

    // Calculate distance and find nearby providers
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

    // Get packages from nearby providers
    const packages = await HealthPackage.find({
      provider_id: { $in: nearbyProviders },
      is_active: true,
      is_approved: true
    })
      .populate('provider_id', 'provider_name rating location city')
      .limit(parseInt(limit));

    res.json({ status: 'success', packages, count: packages.length });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/health-packages/by-type/:type - Filter by package type
router.get('/by-type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const packages = await HealthPackage.find({ 
      package_type: type, 
      is_active: true, 
      is_approved: true 
    })
      .populate('provider_id', 'provider_name rating')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await HealthPackage.countDocuments({ package_type: type, is_active: true, is_approved: true });
    
    res.json({ status: 'success', packages, total, page: parseInt(page) });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/health-packages/compare-custom - Compare custom test list against packages
router.post('/compare-custom', async (req, res) => {
  try {
    const { testNames, latitude, longitude } = req.body;
    
    if (!testNames || testNames.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No tests provided' });
    }

    // Find packages that contain most of these tests
    const packages = await HealthPackage.find({ is_active: true, is_approved: true })
      .populate('provider_id', 'provider_name rating location');
    
    const comparisonResults = [];
    for (const pkg of packages) {
      const packageTests = pkg.tests_included_text ? pkg.tests_included_text.split(',').map(t => t.trim().toLowerCase()) : [];
      const matchedTests = testNames.filter(test => 
        packageTests.some(pt => pt.includes(test.toLowerCase()))
      );
      const matchPercentage = (matchedTests.length / testNames.length) * 100;
      
      if (matchPercentage > 0) {
        let distance = null;
        if (latitude && longitude && pkg.provider_id?.location?.lat) {
          distance = calculateDistance(
            parseFloat(latitude), parseFloat(longitude),
            pkg.provider_id.location.lat, pkg.provider_id.location.lng
          ).toFixed(1);
        }
        
        comparisonResults.push({
          package: pkg,
          match_percentage: matchPercentage,
          matched_tests: matchedTests.length,
          total_tests: testNames.length,
          distance_km: distance
        });
      }
    }
    
    // Sort by match percentage (highest first)
    comparisonResults.sort((a, b) => b.match_percentage - a.match_percentage);
    
    res.json({ status: 'success', results: comparisonResults });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/bookings/:booking_id - Get booking status
router.get('/bookings/:booking_id', async (req, res) => {
  try {
    const booking = await HealthPackageBooking.findById(req.params.booking_id)
      .populate('package_id', 'package_name')
      .populate('provider_id', 'provider_name');
    
    if (!booking) {
      return res.status(404).json({ status: 'error', message: 'Booking not found' });
    }
    
    res.json({ status: 'success', booking });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/health-packages/suggest - Smart suggestions based on age/gender/symptoms
router.get('/suggest', async (req, res) => {
  try {
    const { age, gender, symptoms } = req.query;
    let filter = { is_active: true, is_approved: true };
    
    // Age-based suggestions
    if (age) {
      const ageNum = parseInt(age);
      if (ageNum < 18) filter.package_type = 'child';
      else if (ageNum >= 60) filter.package_type = 'senior';
      else filter.package_type = { $in: ['basic', 'executive', 'fullbody'] };
    }
    
    // Gender-based suggestions
    if (gender && gender === 'female') {
      filter.package_type = { $in: ['women', filter.package_type] };
    } else if (gender === 'male') {
      filter.package_type = { $in: ['men', filter.package_type] };
    }
    
    let packages = await HealthPackage.find(filter)
      .populate('provider_id', 'provider_name rating')
      .limit(10);
    
    // Symptom-based matching (if symptoms provided)
    if (symptoms) {
      const symptomKeywords = symptoms.toLowerCase().split(',');
      for (let pkg of packages) {
        let score = 0;
        const packageText = (pkg.package_name + ' ' + pkg.package_description + ' ' + pkg.tests_included_text).toLowerCase();
        for (const keyword of symptomKeywords) {
          if (packageText.includes(keyword.trim())) score += 10;
        }
        pkg.relevance_score = score;
      }
      packages.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
    }
    
    res.json({ status: 'success', suggestions: packages });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==================== PROVIDER APIS ====================

// POST /api/provider/health-packages/bulk-upload - Excel/CSV upload
router.post('/provider/health-packages/bulk-upload', async (req, res) => {
  try {
    const { packages, provider_id } = req.body;
    const results = { success: [], failed: [] };
    
    for (const pkgData of packages) {
      try {
        const slug = pkgData.package_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
        const newPackage = new HealthPackage({
          package_id: Date.now(),
          provider_id,
          package_name: pkgData.package_name,
          package_slug: slug,
          package_description: pkgData.description,
          package_type: pkgData.package_type || 'basic',
          tests_included_text: pkgData.tests_included,
          mrp: pkgData.mrp,
          discounted_price: pkgData.discounted_price,
          discount_percentage: Math.round(((pkgData.mrp - pkgData.discounted_price) / pkgData.mrp) * 100),
          home_collection_available: pkgData.home_collection === 'Yes',
          report_time_hours: pkgData.report_time_hours || 48,
          requires_fasting: pkgData.requires_fasting === 'Yes',
          fasting_hours: pkgData.fasting_hours || 0,
          gender: pkgData.gender || 'unisex',
          min_age: pkgData.min_age || 0,
          max_age: pkgData.max_age || 100,
          tags: pkgData.tags ? pkgData.tags.split(',') : [],
          city: pkgData.city,
          is_active: true,
          is_approved: false
        });
        
        await newPackage.save();
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

// GET /api/provider/health-packages/:id/bookings - View bookings for a package
router.get('/provider/health-packages/:id/bookings', async (req, res) => {
  try {
    const bookings = await HealthPackageBooking.find({ package_id: req.params.id })
      .sort('-created_at');
    
    res.json({ status: 'success', bookings, count: bookings.length });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// PUT /api/provider/bookings/:booking_id/status - Update booking status
router.put('/provider/bookings/:booking_id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await HealthPackageBooking.findByIdAndUpdate(
      req.params.booking_id,
      { booking_status: status, updated_at: Date.now() },
      { new: true }
    );
    
    if (!booking) {
      return res.status(404).json({ status: 'error', message: 'Booking not found' });
    }
    
    res.json({ status: 'success', booking });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==================== ADMIN APIS ====================

// GET /api/admin/health-packages/pending - Pending approval packages
router.get('/admin/health-packages/pending', async (req, res) => {
  try {
    const packages = await HealthPackage.find({ is_approved: false, is_active: true })
      .populate('provider_id', 'provider_name')
      .sort('-createdAt');
    
    res.json({ status: 'success', packages, count: packages.length });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// PUT /api/admin/health-packages/:id/approve - Approve/reject package
router.put('/admin/health-packages/:id/approve', async (req, res) => {
  try {
    const { approve, comments } = req.body;
    const pkg = await HealthPackage.findById(req.params.id);
    
    if (!pkg) {
      return res.status(404).json({ status: 'error', message: 'Package not found' });
    }
    
    pkg.is_approved = approve === true;
    if (comments) pkg.admin_comments = comments;
    await pkg.save();
    
    res.json({ 
      status: 'success', 
      message: approve ? 'Package approved successfully' : 'Package rejected',
      package: pkg
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/admin/health-packages/stats - Analytics dashboard
router.get('/admin/health-packages/stats', async (req, res) => {
  try {
    const totalPackages = await HealthPackage.countDocuments();
    const pendingApprovals = await HealthPackage.countDocuments({ is_approved: false, is_active: true });
    const approvedPackages = await HealthPackage.countDocuments({ is_approved: true, is_active: true });
    const totalBookings = await HealthPackageBooking.countDocuments();
    const completedBookings = await HealthPackageBooking.countDocuments({ booking_status: 'completed' });
    
    // Revenue stats
    const revenue = await HealthPackageBooking.aggregate([
      { $match: { payment_status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$final_amount' } } }
    ]);
    
    // Bookings by package type
    const bookingsByType = await HealthPackageBooking.aggregate([
      { $lookup: { from: 'healthpackages', localField: 'package_id', foreignField: '_id', as: 'package' } },
      { $unwind: '$package' },
      { $group: { _id: '$package.package_type', count: { $sum: 1 } } }
    ]);
    
    res.json({
      status: 'success',
      stats: {
        total_packages: totalPackages,
        pending_approvals: pendingApprovals,
        approved_packages: approvedPackages,
        total_bookings: totalBookings,
        completed_bookings: completedBookings,
        total_revenue: revenue[0]?.total || 0,
        bookings_by_type: bookingsByType
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
module.exports = router;
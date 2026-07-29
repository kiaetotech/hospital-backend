const express = require('express');
const router = express.Router();
const HealthPackage = require('../models/HealthPackage');
const HealthPackageBooking = require('../models/HealthPackageBooking');
const HealthPackageReview = require('../models/HealthPackageReview');
const DiagnosticsProvider = require('../models/DiagnosticsProvider');

// Helperdistance
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
        provider_id._id,
        package_name: "Full Body Checkup",
        package_description: "Complete health checkup with 65+ tests",
        tests_included_text: "CBC, LFT, KFT, Lipid Profile, Thyroid, HbA1c, Vitamin D",
        mrp: 2500,
        discounted_price: 1299,
        home_collection_available,
        report_time_hours: 24,
        gender: "Unisex",
        package_type: "fullbody",
        is_popular,
        is_active},
      {
        package_id: 1002,
        provider_id._id,
        package_name: "Cardiac Care Package",
        package_description: "Heart health checkup with lipid profile and ECG",
        tests_included_text: "Lipid Profile, ECG, Troponin, CRP",
        mrp: 1800,
        discounted_price: 999,
        home_collection_available,
        report_time_hours: 12,
        gender: "Unisex",
        package_type: "cardiac",
        is_popular,
        is_active},
      {
        package_id: 1003,
        provider_id._id,
        package_name: "Diabetes Profile",
        package_description: "Complete diabetes screening",
        tests_included_text: "HbA1c, Glucose Fasting, Insulin, Microalbumin",
        mrp: 1200,
        discounted_price: 699,
        home_collection_available,
        report_time_hours: 8,
        gender: "Unisex",
        package_type: "diabetes",
        is_popular,
        is_active},
      {
        package_id: 1004,
        provider_id._id,
        package_name: "Liver Profile",
        package_description: "Complete liver function tests",
        tests_included_text: "LFT, PT/INR, AFP",
        mrp: 1500,
        discounted_price: 799,
        home_collection_available,
        report_time_hours: 8,
        gender: "Unisex",
        package_type: "basic",
        is_popular,
        is_active}
    ];
    
    for (const pkg of samplePackages) {
      await HealthPackage.findOneAndUpdate(
        { package_name.package_name },
        pkg,
        { upsert, new}
      );
    }
    
    const totalPackages = await HealthPackage.countDocuments();
    res.json({ status: 'success', message: `Added packages. Total: ${totalPackages}` });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// ==================== TYPE ROUTES (MUST BE BEFORE /) ====================

// GET /api/health-packages/types - Get all package types
router.get('/types', async (req, res) => {
  try {
    const types = await HealthPackage.distinct('package_type');
    res.json({ status: 'success', types.filter(t => t) });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// GET /api/health-packages/fix-types - Fix existing package types
router.get('/fix-types', async (req, res) => {
  try {
    const packages = await HealthPackage.find({});
    let updated = 0;
    
    for (let pkg of packages) {
      let newType = null;
      const name = pkg.package_name.toLowerCase();
      
      if (name.includes('full body')) newType = 'fullbody';
      else if (name.includes('cardiac')) newType = 'cardiac';
      else if (name.includes('diabetes')) newType = 'diabetes';
      else if (name.includes('liver')) newType = 'basic';
      else newType = 'basic';
      
      if (newType && pkg.package_type !== newType) {
        pkg.package_type = newType;
        await pkg.save();
        updated++;
      }
    }
    
    res.json({ status: 'success', message: `Updated ${updated} packages with proper types` });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// GET /api/health-packages/by-type/- Filter by package type
router.get('/by-type/', async (req, res) => {
  try {
    const { type } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const packages = await HealthPackage.find({ 
      package_type, 
      is_active})
      .populate('provider_id', 'provider_name rating')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await HealthPackage.countDocuments({ package_type, is_active});
    
    res.json({ status: 'success', packages, total, page(page) });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// ==================== PATIENT APIS ====================

// GET /api/health-packages - Get all packages
router.get('/', async (req, res) => {
  try {
    const packages = await HealthPackage.find({ is_active})
      .populate('provider_id', 'provider_name rating location is_home_collection_available')
      .sort({ is_popular: -1, display_order: 1 });
    
    res.json({ status: 'success', packages, total.length });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// GET /api/health-packages/search - Search packages
router.get('/search', async (req, res) => {
  try {
    const { query, min_price, max_price, home_collection, sort_by, page = 1, limit = 20 } = req.query;
    let filter = { is_active};

    if (query) {
      filter.$or = [
        { package_name: { $regex, $options: 'i' } },
        { package_description: { $regex, $options: 'i' } }
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

    res.json({ status: 'success', packages, total.length });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// GET /api/health-packages/popular - Get popular packages
router.get('/popular', async (req, res) => {
  try {
    const packages = await HealthPackage.find({ is_active, is_popular})
      .populate('provider_id', 'provider_name rating')
      .limit(8);
    res.json({ status: 'success', packages });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// GET /api/health-packages/nearby - Packages from nearby labs
router.get('/nearby', async (req, res) => {
  try {
    const { latitude, longitude, radius = 10, limit = 20 } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ status: 'error', message: 'Latitude and longitude required' });
    }

    const providers = await DiagnosticsProvider.find({
      'location.lat': { $exists},
      is_active});

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
      provider_id: { $in},
      is_active})
      .populate('provider_id', 'provider_name rating location city')
      .limit(parseInt(limit));

    res.json({ status: 'success', packages, count.length });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// GET /api/health-packages/- Get package details (MUST BE LAST)
router.get('/', async (req, res) => {
  try {
    const pkg = await HealthPackage.findById(req.params.id)
      .populate('provider_id', 'provider_name rating location');
    if (!pkg) return res.status(404).json({ status: 'error', message: 'Package not found' });

    const testsList = pkg.tests_included_text ? pkg.tests_included_text.split(',').map(t => t.trim()) : [];
    res.json({ status: 'success', package, tests_list});
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// POST /api/health-packages/compare - Compare packages
router.post('/compare', async (req, res) => {
  try {
    const { package_ids } = req.body;
    const packages = await HealthPackage.find({ _id: { $in_ids }, is_active})
      .populate('provider_id', 'provider_name rating');

    const comparisonData = packages.map(pkg => ({
      package_id._id,
      package_name.package_name,
      provider_name.provider_id?.provider_name,
      provider_rating.provider_id?.rating,
      tests_count.tests_included_text ? pkg.tests_included_text.split(',').length : 0,
      mrp.mrp,
      discounted_price.discounted_price,
      home_collection_available.home_collection_available,
      report_time_hours.report_time_hours,
      gender.gender,
      package_type.package_type,
      is_popular.is_popular
    }));

    comparisonData.sort((a, b) => a.discounted_price - b.discounted_price);
    res.json({ status: 'success', packages});
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// POST /api/health-packages/compare-custom - Compare custom test list against packages
router.post('/compare-custom', async (req, res) => {
  try {
    const { testNames, latitude, longitude } = req.body;
    
    if (!testNames || testNames.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No tests provided' });
    }

    const packages = await HealthPackage.find({ is_active})
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
          package,
          match_percentage,
          matched_tests.length,
          total_tests.length,
          distance_km});
      }
    }
    
    comparisonResults.sort((a, b) => b.match_percentage - a.match_percentage);
    res.json({ status: 'success', results});
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// POST /api/health-packages//book - Book a package
router.post('//book', async (req, res) => {
  try {
    const pkg = await HealthPackage.findById(req.params.id);
    if (!pkg) return res.status(404).json({ status: 'error', message: 'Package not found' });

    const { patient_name, patient_phone, appointment_date } = req.body;
    const booking_reference = 'HP' + Date.now();

    const booking = new HealthPackageBooking({
      package_id._id,
      provider_id.provider_id,
      booking_reference,
      patient_name,
      patient_phone,
      appointment_date,
      total_amount.mrp,
      discount_applied.mrp - pkg.discounted_price,
      final_amount.discounted_price,
      payment_status: 'pending',
      booking_status: 'confirmed'
    });

    await booking.save();
    res.json({ status: 'success', message: 'Booking created', booking_reference });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// GET /api/bookings/_id - Get booking status
router.get('/bookings/_id', async (req, res) => {
  try {
    const booking = await HealthPackageBooking.findById(req.params.booking_id)
      .populate('package_id', 'package_name')
      .populate('provider_id', 'provider_name');
    
    if (!booking) {
      return res.status(404).json({ status: 'error', message: 'Booking not found' });
    }
    
    res.json({ status: 'success', booking });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// POST /api/health-packages//review - Submit review
router.post('//review', async (req, res) => {
  try {
    const { rating, review_text } = req.body;
    const pkg = await HealthPackage.findById(req.params.id);
    if (!pkg) return res.status(404).json({ status: 'error', message: 'Package not found' });

    const review = new HealthPackageReview({
      package_id._id,
      provider_id.provider_id,
      rating,
      review_text
    });

    await review.save();
    res.json({ status: 'success', message: 'Review submitted' });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// GET /api/health-packages/suggest - Smart suggestions based on age/gender/symptoms
router.get('/suggest', async (req, res) => {
  try {
    const { age, gender, symptoms } = req.query;
    let filter = { is_active};
    
    if (age) {
      const ageNum = parseInt(age);
      if (ageNum < 18) filter.package_type = 'child';
      else if (ageNum >= 60) filter.package_type = 'senior';
      else filter.package_type = { $in: ['basic', 'executive', 'fullbody'] };
    }
    
    if (gender && gender === 'female') {
      filter.package_type = { $in: ['women', filter.package_type] };
    } else if (gender === 'male') {
      filter.package_type = { $in: ['men', filter.package_type] };
    }
    
    let packages = await HealthPackage.find(filter)
      .populate('provider_id', 'provider_name rating')
      .limit(10);
    
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
    
    res.json({ status: 'success', suggestions});
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
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
    res.status(500).json({ status: 'error', message.message });
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
    res.json({ status: 'success', package});
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// PUT /api/provider/health-packages/- Update package
router.put('/provider/health-packages/', async (req, res) => {
  try {
    const updateData = req.body;
    if (updateData.mrp && updateData.discounted_price) {
      updateData.discount_percentage = Math.round(((updateData.mrp - updateData.discounted_price) / updateData.mrp) * 100);
    }
    const pkg = await HealthPackage.findByIdAndUpdate(req.params.id, updateData, { new});
    res.json({ status: 'success', package});
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// DELETE /api/provider/health-packages/- Disable package
router.delete('/provider/health-packages/', async (req, res) => {
  try {
    await HealthPackage.findByIdAndUpdate(req.params.id, { is_active});
    res.json({ status: 'success', message: 'Package disabled' });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// POST /api/provider/health-packages/bulk-upload - Excel/CSV upload
router.post('/provider/health-packages/bulk-upload', async (req, res) => {
  try {
    const { packages, provider_id } = req.body;
    const results = { success: [], failed: [] };
    
    for (const pkgData of packages) {
      try {
        const newPackage = new HealthPackage({
          package_id.now(),
          provider_id,
          package_name.package_name,
          package_description.description,
          package_type.package_type || 'basic',
          tests_included_text.tests_included,
          mrp.mrp,
          discounted_price.discounted_price,
          home_collection_available.home_collection === 'Yes',
          report_time_hours.report_time_hours || 48,
          gender.gender || 'unisex',
          tags.tags ? pkgData.tags.split(',') : [],
          city.city,
          is_active,
          is_approved});
        
        await newPackage.save();
        results.success.push({ package_name.package_name });
      } catch (err) {
        results.failed.push({ package_name.package_name, error.message });
      }
    }
    
    res.json({ status: 'success', results });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// GET /api/provider/health-packages//bookings - View bookings for a package
router.get('/provider/health-packages//bookings', async (req, res) => {
  try {
    const bookings = await HealthPackageBooking.find({ package_id.params.id })
      .sort('-created_at');
    
    res.json({ status: 'success', bookings, count.length });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// PUT /api/provider/bookings/_id/status - Update booking status
router.put('/provider/bookings/_id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await HealthPackageBooking.findByIdAndUpdate(
      req.params.booking_id,
      { booking_status, updated_at.now() },
      { new}
    );
    
    if (!booking) {
      return res.status(404).json({ status: 'error', message: 'Booking not found' });
    }
    
    res.json({ status: 'success', booking });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// ==================== ADMIN APIS ====================

// GET /api/admin/health-packages/pending - Pending approval packages
router.get('/admin/health-packages/pending', async (req, res) => {
  try {
    const packages = await HealthPackage.find({ is_approved, is_active})
      .populate('provider_id', 'provider_name')
      .sort('-createdAt');
    
    res.json({ status: 'success', packages, count.length });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// PUT /api/admin/health-packages//approve - Approve/reject package
router.put('/admin/health-packages//approve', async (req, res) => {
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
      message? 'Package approved successfully' : 'Package rejected',
      package});
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

// GET /api/admin/health-packages/stats - Analytics dashboard
router.get('/admin/health-packages/stats', async (req, res) => {
  try {
    const totalPackages = await HealthPackage.countDocuments();
    const pendingApprovals = await HealthPackage.countDocuments({ is_approved, is_active});
    const approvedPackages = await HealthPackage.countDocuments({ is_approved, is_active});
    const totalBookings = await HealthPackageBooking.countDocuments();
    const completedBookings = await HealthPackageBooking.countDocuments({ booking_status: 'completed' });
    
    const revenue = await HealthPackageBooking.aggregate([
      { $match: { payment_status: 'completed' } },
      { $group: { _id, total: { $sum: '$final_amount' } } }
    ]);
    
    const bookingsByType = await HealthPackageBooking.aggregate([
      { $lookup: { from: 'healthpackages', localField: 'package_id', foreignField: '_id', as: 'package' } },
      { $unwind: '$package' },
      { $group: { _id: '$package.package_type', count: { $sum: 1 } } }
    ]);
    
    res.json({
      status: 'success',
      stats: {
        total_packages,
        pending_approvals,
        approved_packages,
        total_bookings,
        completed_bookings,
        total_revenue[0]?.total || 0,
        bookings_by_type}
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message.message });
  }
});

module.exports = router;


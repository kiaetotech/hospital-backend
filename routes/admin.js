const express = require('express');
const jwt = require('jsonwebtoken');
const Provider = require('../models/Provider');
const Hospital = require('../models/Hospital');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const router = express.Router();

// ============================================
// 🆕 CORS PREFLIGHT FOR LOGIN
// ============================================
router.options('/login', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://hospital-frontend-kiaeto.vercel.app');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// ============================================
// ✅ ADMIN LOGIN - Email/Password
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success, message: 'Email and password required' });
    }

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@healthcarehub.com';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ success, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: 'admin', email_EMAIL, role: 'admin', isAdmin},
      process.env.JWT_SECRET || 'hospital_platform_secret_key_2024',
      { expiresIn: '7d' }
    );

    res.json({
      success,
      token,
      message: 'Admin login successful',
      admin: { email_EMAIL, role: 'admin', name: 'Admin' }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// EXISTING PROVIDER ROUTES (PRESERVED)
// ============================================

// Get all unverified providers
router.get('/providers/pending', async (req, res) => {
  try {
    const providers = await Provider.find({ isVerified}).select('-password');
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// Get all providers
router.get('/providers', async (req, res) => {
  try {
    const providers = await Provider.find().select('-password').sort({ createdAt: -1 });
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// Verify a provider
router.put('/providers//verify', async (req, res) => {
  try {
    const { adminName, adminNote } = req.body;
    const provider = await Provider.findByIdAndUpdate(
      req.params.id,
      { 
        isVerified, 
        verifiedAtDate(),
        verifiedBy|| 'Admin',
        adminNote|| ''
      },
      { new}
    ).select('-password');
    res.json({ success, provider });
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// Reject/Delete a provider
router.delete('/providers/', async (req, res) => {
  try {
    await Provider.findByIdAndDelete(req.params.id);
    res.json({ success});
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// Get provider stats
router.get('/stats', async (req, res) => {
  try {
    const total = await Provider.countDocuments();
    const verified = await Provider.countDocuments({ isVerified});
    const pending = await Provider.countDocuments({ isVerified});
    res.json({ total, verified, pending });
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// ============================================
// HOSPITAL MANAGEMENT
// ============================================

// Get all hospitals (with filters)
router.get('/hospitals', async (req, res) => {
  try {
    const { status, subscription, search, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status === 'pending') query.is_verified = false;
    else if (status === 'verified') query.is_verified = true;
    if (subscription) query.subscription_plan = subscription;
    if (search) {
      query.$or = [
        { name: { $regex, $options: 'i' } },
        { 'contact.email': { $regex, $options: 'i' } },
        { 'contact.phone': { $regex, $options: 'i' } },
        { 'address.city': { $regex, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [hospitals, total] = await Promise.all([
      Hospital.find(query)
        .select('-password')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Hospital.countDocuments(query)
    ]);

    res.json({
      success,
      data,
      pagination: {
        currentPage(page),
        totalPages.ceil(total / parseInt(limit)),
        totalHospitals}
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Get single hospital details
router.get('/hospitals/', async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id)
      .select('-password')
      .lean();
    
    if (!hospital) {
      return res.status(404).json({ success, message: 'Hospital not found' });
    }

    const [bookingCount, revenueData] = await Promise.all([
      Booking.countDocuments({ hospitalId._id }),
      Transaction.aggregate([
        { $match: { hospitalId._id.toString(), status: { $in: ['completed', 'captured'] } } },
        { $group: { _id, total: { $sum: '$netAmount' }, commission: { $sum: '$platformCommission' } } }
      ])
    ]);

    res.json({
      success,
      data: {
        ...hospital,
        stats: {
          totalBookings,
          totalRevenue[0]?.total || 0,
          totalCommission[0]?.commission || 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Verify/Approve hospital
router.put('/hospitals//verify', async (req, res) => {
  try {
    const { adminNote, subscriptionPlan } = req.body;
    
    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      {
        is_verified,
        verification_dateDate(),
        admin_note|| '',
        subscription_plan|| 'free',
        is_active},
      { new}
    ).select('-password');

    if (!hospital) {
      return res.status(404).json({ success, message: 'Hospital not found' });
    }

    res.json({
      success,
      message: 'Hospital approved successfully',
      data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Reject hospital
router.put('/hospitals//reject', async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    
    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      {
        is_verified,
        is_active,
        rejection_reason|| 'Not meeting requirements',
        rejected_atDate()
      },
      { new}
    ).select('-password');

    if (!hospital) {
      return res.status(404).json({ success, message: 'Hospital not found' });
    }

    res.json({
      success,
      message: 'Hospital rejected',
      data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Update hospital subscription
router.put('/hospitals//subscription', async (req, res) => {
  try {
    const { subscriptionPlan } = req.body;
    
    const validPlans = ['free', 'silver', 'gold', 'platinum'];
    if (!validPlans.includes(subscriptionPlan)) {
      return res.status(400).json({ success, message: 'Invalid subscription plan' });
    }

    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      { subscription_plan},
      { new}
    ).select('-password');

    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Toggle hospital active status
router.put('/hospitals//toggle-status', async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      return res.status(404).json({ success, message: 'Hospital not found' });
    }

    hospital.is_active = !hospital.is_active;
    await hospital.save();

    res.json({
      success,
      message: `Hospital ${hospital.is_active ? 'activated' : 'deactivated'}`,
      data: { is_active.is_active }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Hospital stats overview
router.get('/hospitals-stats', async (req, res) => {
  try {
    const [
      totalHospitals,
      verifiedHospitals,
      pendingHospitals,
      activeHospitals,
      subscriptionBreakdown
    ] = await Promise.all([
      Hospital.countDocuments(),
      Hospital.countDocuments({ is_verified}),
      Hospital.countDocuments({ is_verified}),
      Hospital.countDocuments({ is_active}),
      Hospital.aggregate([
        { $group: { _id: '$subscription_plan', count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      success,
      data: {
        totalHospitals,
        verifiedHospitals,
        pendingHospitals,
        activeHospitals,
        subscriptionBreakdown.reduce((acc, curr) => {
          acc[curr._id || 'free'] = curr.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// BOOKING MANAGEMENT
// ============================================

router.get('/bookings', async (req, res) => {
  try {
    const { status, type, search, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (type) query.bookingType = type;
    if (search) {
      query.$or = [
        { bookingId: { $regex, $options: 'i' } },
        { patientName: { $regex, $options: 'i' } },
        { patientPhone: { $regex, $options: 'i' } },
        { hospitalName: { $regex, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [bookings, total] = await Promise.all([
      Booking.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Booking.countDocuments(query)
    ]);

    res.json({
      success,
      data,
      pagination: { currentPage(page), totalPages.ceil(total / parseInt(limit)), totalBookings}
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// REVENUE & COMMISSION
// ============================================

router.get('/revenue', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchQuery = { status: { $in: ['completed', 'captured'] } };
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const revenueData = await Transaction.aggregate([
      { $match},
      { $group: { _id: '$bookingType', totalRevenue: { $sum: '$netAmount' }, totalCommission: { $sum: '$platformCommission' }, totalBookings: { $sum: 1 }, avgAmount: { $avg: '$netAmount' } } },
      { $sort: { totalRevenue: -1 } }
    ]);

    const summary = await Transaction.aggregate([
      { $match},
      { $group: { _id, totalRevenue: { $sum: '$netAmount' }, totalCommission: { $sum: '$platformCommission' }, totalBookings: { $sum: 1 } } }
    ]);

    res.json({
      success,
      data: { summary[0] || { totalRevenue: 0, totalCommission: 0, totalBookings: 0 }, breakdown}
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Daily revenue chart data
router.get('/revenue/daily', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailyRevenue = await Transaction.aggregate([
      { $match: { status: { $in: ['completed', 'captured'] }, createdAt: { $gte} } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$netAmount' }, commission: { $sum: '$platformCommission' }, bookings: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// DASHBOARD OVERVIEW
// ============================================

router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalHospitals,
      totalBookings,
      totalUsers,
      revenueSummary,
      pendingVerifications,
      recentBookings
    ] = await Promise.all([
      Hospital.countDocuments(),
      Booking.countDocuments(),
      User.countDocuments({ role: 'patient' }),
      Transaction.aggregate([
        { $match: { status: { $in: ['completed', 'captured'] } } },
        { $group: { _id, total: { $sum: '$netAmount' }, commission: { $sum: '$platformCommission' } } }
      ]),
      Hospital.countDocuments({ is_verified}),
      Booking.find().sort({ createdAt: -1 }).limit(10).lean()
    ]);

    res.json({
      success,
      data: {
        totalHospitals,
        totalBookings,
        totalUsers,
        totalRevenue[0]?.total || 0,
        totalCommission[0]?.commission || 0,
        pendingVerifications,
        recentBookings
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// PATIENT/USER MANAGEMENT
// ============================================

router.get('/users', async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex, $options: 'i' } },
        { email: { $regex, $options: 'i' } },
        { phone: { $regex, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [users, total] = await Promise.all([
      User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      User.countDocuments(query)
    ]);

    res.json({
      success,
      data,
      pagination: { currentPage(page), totalPages.ceil(total / parseInt(limit)), totalUsers}
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

module.exports = router;


const express = require('express');
const jwt = require('jsonwebtoken');
const Provider = require('../models/Provider');
const Hospital = require('../models/Hospital');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// ============================================
// ✅ ADMIN LOGIN - Generates JWT Token
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { adminKey } = req.body;

    const validAdminKey = process.env.ADMIN_KEY || 'admin_secret_key_2024';
    
    if (adminKey !== validAdminKey) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid admin key' 
      });
    }

    const token = jwt.sign(
      { 
        role: 'admin', 
        isAdmin: true,
        type: 'admin'
      },
      process.env.JWT_SECRET || 'hospital_platform_secret_key_2024',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token: token,
      message: 'Admin login successful',
      admin: {
        role: 'admin',
        name: 'Admin'
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ============================================
// EXISTING PROVIDER ROUTES (PRESERVED)
// ============================================

// Get all unverified providers
router.get('/providers/pending', async (req, res) => {
  try {
    const providers = await Provider.find({ isVerified: false }).select('-password');
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all providers
router.get('/providers', async (req, res) => {
  try {
    const providers = await Provider.find().select('-password').sort({ createdAt: -1 });
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify a provider
router.put('/providers/:id/verify', async (req, res) => {
  try {
    const { adminName, adminNote } = req.body;
    const provider = await Provider.findByIdAndUpdate(
      req.params.id,
      { 
        isVerified: true, 
        verifiedAt: new Date(),
        verifiedBy: adminName || 'Admin',
        adminNote: adminNote || ''
      },
      { new: true }
    ).select('-password');
    res.json({ success: true, provider });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject/Delete a provider
router.delete('/providers/:id', async (req, res) => {
  try {
    await Provider.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get provider stats
router.get('/stats', async (req, res) => {
  try {
    const total = await Provider.countDocuments();
    const verified = await Provider.countDocuments({ isVerified: true });
    const pending = await Provider.countDocuments({ isVerified: false });
    res.json({ total, verified, pending });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 🆕 HOSPITAL MANAGEMENT (NEW)
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
        { name: { $regex: search, $options: 'i' } },
        { 'contact.email': { $regex: search, $options: 'i' } },
        { 'contact.phone': { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } }
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
      success: true,
      data: hospitals,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalHospitals: total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single hospital details
router.get('/hospitals/:id', async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id)
      .select('-password')
      .lean();
    
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    // Get stats
    const [bookingCount, revenueData] = await Promise.all([
      Booking.countDocuments({ hospitalId: hospital._id }),
      Transaction.aggregate([
        { $match: { hospitalId: hospital._id.toString(), status: { $in: ['completed', 'captured'] } } },
        { $group: { _id: null, total: { $sum: '$netAmount' }, commission: { $sum: '$platformCommission' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        ...hospital,
        stats: {
          totalBookings: bookingCount,
          totalRevenue: revenueData[0]?.total || 0,
          totalCommission: revenueData[0]?.commission || 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🆕 Verify/Approve hospital
router.put('/hospitals/:id/verify', async (req, res) => {
  try {
    const { adminNote, subscriptionPlan } = req.body;
    
    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      {
        is_verified: true,
        verification_date: new Date(),
        admin_note: adminNote || '',
        subscription_plan: subscriptionPlan || 'free',
        is_active: true
      },
      { new: true }
    ).select('-password');

    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    // Send approval email
    try {
      const { sendHospitalApprovalEmail } = require('../utils/notifications');
      await sendHospitalApprovalEmail(hospital, 'approved', adminNote);
    } catch (emailError) {
      console.error('Approval email error:', emailError.message);
    }

    res.json({
      success: true,
      message: 'Hospital approved successfully',
      data: hospital
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🆕 Reject hospital
router.put('/hospitals/:id/reject', async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    
    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      {
        is_verified: false,
        is_active: false,
        rejection_reason: rejectionReason || 'Not meeting requirements',
        rejected_at: new Date()
      },
      { new: true }
    ).select('-password');

    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    // Send rejection email
    try {
      const { sendHospitalApprovalEmail } = require('../utils/notifications');
      await sendHospitalApprovalEmail(hospital, 'rejected', rejectionReason);
    } catch (emailError) {
      console.error('Rejection email error:', emailError.message);
    }

    res.json({
      success: true,
      message: 'Hospital rejected',
      data: hospital
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🆕 Update hospital subscription
router.put('/hospitals/:id/subscription', async (req, res) => {
  try {
    const { subscriptionPlan } = req.body;
    
    const validPlans = ['free', 'silver', 'gold', 'platinum'];
    if (!validPlans.includes(subscriptionPlan)) {
      return res.status(400).json({ success: false, message: 'Invalid subscription plan' });
    }

    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      { subscription_plan: subscriptionPlan },
      { new: true }
    ).select('-password');

    res.json({ success: true, data: hospital });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🆕 Toggle hospital active status
router.put('/hospitals/:id/toggle-status', async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    hospital.is_active = !hospital.is_active;
    await hospital.save();

    res.json({
      success: true,
      message: `Hospital ${hospital.is_active ? 'activated' : 'deactivated'}`,
      data: { is_active: hospital.is_active }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 HOSPITAL STATS & ANALYTICS (NEW)
// ============================================

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
      Hospital.countDocuments({ is_verified: true }),
      Hospital.countDocuments({ is_verified: false }),
      Hospital.countDocuments({ is_active: true }),
      Hospital.aggregate([
        { $group: { _id: '$subscription_plan', count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalHospitals,
        verifiedHospitals,
        pendingHospitals,
        activeHospitals,
        subscriptionBreakdown: subscriptionBreakdown.reduce((acc, curr) => {
          acc[curr._id || 'free'] = curr.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 BOOKING MANAGEMENT (NEW)
// ============================================

// Get all bookings (admin view)
router.get('/bookings', async (req, res) => {
  try {
    const { status, type, search, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (type) query.bookingType = type;
    if (search) {
      query.$or = [
        { bookingId: { $regex: search, $options: 'i' } },
        { patientName: { $regex: search, $options: 'i' } },
        { patientPhone: { $regex: search, $options: 'i' } },
        { hospitalName: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Booking.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: bookings,
      pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)), totalBookings: total }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 REVENUE & COMMISSION (NEW)
// ============================================

// Revenue overview
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
      { $match: matchQuery },
      {
        $group: {
          _id: '$bookingType',
          totalRevenue: { $sum: '$netAmount' },
          totalCommission: { $sum: '$platformCommission' },
          totalBookings: { $sum: 1 },
          avgAmount: { $avg: '$netAmount' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    const summary = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$netAmount' },
          totalCommission: { $sum: '$platformCommission' },
          totalBookings: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: summary[0] || { totalRevenue: 0, totalCommission: 0, totalBookings: 0 },
        breakdown: revenueData
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Daily revenue chart data
router.get('/revenue/daily', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailyRevenue = await Transaction.aggregate([
      {
        $match: {
          status: { $in: ['completed', 'captured'] },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$netAmount' },
          commission: { $sum: '$platformCommission' },
          bookings: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ success: true, data: dailyRevenue });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 DASHBOARD OVERVIEW (NEW)
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
        { $group: { _id: null, total: { $sum: '$netAmount' }, commission: { $sum: '$platformCommission' } } }
      ]),
      Hospital.countDocuments({ is_verified: false }),
      Booking.find().sort({ createdAt: -1 }).limit(10).lean()
    ]);

    res.json({
      success: true,
      data: {
        totalHospitals,
        totalBookings,
        totalUsers,
        totalRevenue: revenueSummary[0]?.total || 0,
        totalCommission: revenueSummary[0]?.commission || 0,
        pendingVerifications,
        recentBookings
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 PATIENT/USER MANAGEMENT (NEW)
// ============================================

router.get('/users', async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [users, total] = await Promise.all([
      User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      User.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)), totalUsers: total }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// COMMISSION CONFIG MANAGEMENT (ADMIN)
// ============================================

// Get all commission configs
router.get('/commission-configs', async (req, res) => {
  try {
    const CommissionConfig = require('../models/CommissionConfig');
    const configs = await CommissionConfig.find({}).sort({ serviceType: 1, version: -1 });
    res.json({ success: true, data: configs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get active config for service type
router.get('/commission-config/:serviceType', async (req, res) => {
  try {
    const CommissionConfig = require('../models/CommissionConfig');
    const config = await CommissionConfig.getActiveConfig(req.params.serviceType);
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create commission config
router.post('/commission-config', async (req, res) => {
  try {
    const CommissionConfig = require('../models/CommissionConfig');
    const config = new CommissionConfig({
      ...req.body,
      effectiveFrom: req.body.effectiveFrom || new Date()
    });
    await config.save();
    res.status(201).json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update commission config
router.put('/commission-config/:configId', async (req, res) => {
  try {
    const CommissionConfig = require('../models/CommissionConfig');
    const config = await CommissionConfig.findOneAndUpdate(
      { configId: req.params.configId },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const Settlement = require('../models/Settlement');

// Get all settlements (admin)
router.get('/settlements', authenticateAdmin, async (req, res) => {
  try {
    const settlements = await Settlement.find().sort({ createdAt: -1 }).populate('providerId', 'name phone');
    res.json({ success: true, data: settlements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve/settle a settlement
router.put('/settlements/:id/settle', authenticateAdmin, async (req, res) => {
  try {
    const { transactionId, notes } = req.body;
    const settlement = await Settlement.findById(req.params.id);
    if (!settlement) return res.status(404).json({ success: false, message: 'Settlement not found' });
    
    settlement.status = 'settled';
    settlement.settledAt = new Date();
    settlement.transactionId = transactionId || '';
    settlement.notes = notes || '';
    await settlement.save();
    
    res.json({ success: true, message: 'Settlement marked as settled', data: settlement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 AMBULANCE MANAGEMENT (ADMIN)
// ============================================

// Get all ambulance fleets (admin view)
router.get('/ambulance', authenticateAdmin, async (req, res) => {
  try {
    const AmbulanceFleet = require('../models/AmbulanceFleet');
    const ambulances = await AmbulanceFleet.find()
      .select('providerName city state status vehicles drivers')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, data: ambulances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 ADMIN OVERVIEW STATS
// ============================================

// Get comprehensive admin overview stats
router.get('/overview', authenticateAdmin, async (req, res) => {
  try {
    const AmbulanceFleet = require('../models/AmbulanceFleet');
    
    const [
      totalUsers,
      totalHospitals,
      totalAmbulances,
      totalBookings,
      revenueSummary,
      pendingHospitals,
      pendingAmbulances
    ] = await Promise.all([
      User.countDocuments(),
      Hospital.countDocuments(),
      AmbulanceFleet.countDocuments(),
      Booking.countDocuments(),
      Transaction.aggregate([
        { $match: { status: { $in: ['completed', 'captured'] } } },
        { $group: { _id: null, total: { $sum: '$netAmount' }, commission: { $sum: '$platformCommission' } } }
      ]),
      Hospital.countDocuments({ is_verified: false }),
      AmbulanceFleet.countDocuments({ status: 'pending' })
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalHospitals,
        totalAmbulances,
        totalBookings,
        totalRevenue: revenueSummary[0]?.total || 0,
        totalCommission: revenueSummary[0]?.commission || 0,
        pendingHospitals,
        pendingAmbulances
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 AMBULANCE SETTLEMENT MANAGEMENT (ADMIN)
// ============================================

// Get all ambulance settlements with filters
router.get('/settlements/ambulance', authenticateAdmin, async (req, res) => {
  try {
    const { status, providerId, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (providerId) query.providerId = providerId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [settlements, total] = await Promise.all([
      Settlement.find(query)
        .populate('providerId', 'name providerName phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Settlement.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: settlements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get settlement details
router.get('/settlements/:id', authenticateAdmin, async (req, res) => {
  try {
    const settlement = await Settlement.findById(req.params.id)
      .populate('providerId', 'name providerName phone email')
      .lean();
    
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }

    res.json({ success: true, data: settlement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reject settlement request
router.put('/settlements/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const settlement = await Settlement.findById(req.params.id);
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }
    
    if (settlement.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending settlements can be rejected' });
    }

    settlement.status = 'rejected';
    settlement.rejectionReason = reason || 'Rejected by admin';
    settlement.rejectedAt = new Date();
    await settlement.save();

    res.json({ success: true, message: 'Settlement rejected', data: settlement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 PATIENT COMPLAINTS MANAGEMENT (ADMIN)
// ============================================

// Get all complaints
router.get('/complaints', authenticateAdmin, async (req, res) => {
  try {
    const Complaint = require('../models/Complaint');
    const { status, type, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (type) query.complaintType = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [complaints, total] = await Promise.all([
      Complaint.find(query)
        .populate('userId', 'name email phone')
        .populate('bookingId', 'bookingId bookingType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Complaint.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: complaints,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update complaint status
router.put('/complaints/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const Complaint = require('../models/Complaint');
    const { status, resolutionNote } = req.body;
    
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    complaint.status = status;
    if (status === 'resolved') {
      complaint.resolvedAt = new Date();
      complaint.resolutionNote = resolutionNote || '';
    }
    if (status === 'in_progress') {
      complaint.inProgressAt = new Date();
    }
    await complaint.save();

    res.json({ success: true, message: `Complaint ${status}`, data: complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 CANCELLATION POLICY MANAGEMENT (ADMIN)
// ============================================

// Get cancellation policy
router.get('/cancellation-policy', authenticateAdmin, async (req, res) => {
  try {
    const CancellationPolicy = require('../models/CancellationPolicy');
    const policy = await CancellationPolicy.findOne({ isActive: true });
    res.json({ success: true, data: policy || { policyRules: [], isActive: false } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update cancellation policy
router.put('/cancellation-policy', authenticateAdmin, async (req, res) => {
  try {
    const CancellationPolicy = require('../models/CancellationPolicy');
    const { policyRules, isActive } = req.body;
    
    let policy = await CancellationPolicy.findOne({ isActive: true });
    
    if (policy) {
      policy.policyRules = policyRules || policy.policyRules;
      policy.isActive = isActive !== undefined ? isActive : policy.isActive;
      policy.updatedAt = new Date();
      await policy.save();
    } else {
      policy = new CancellationPolicy({
        policyRules: policyRules || [],
        isActive: isActive !== undefined ? isActive : true
      });
      await policy.save();
    }

    res.json({ success: true, message: 'Cancellation policy updated', data: policy });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 TRANSACTION MANAGEMENT (ADMIN)
// ============================================

// Get all transactions with filters
router.get('/transactions', authenticateAdmin, async (req, res) => {
  try {
    const { status, bookingType, paymentMethod, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (bookingType) query.bookingType = bookingType;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Transaction.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get transaction details
router.get('/transactions/:id', authenticateAdmin, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).lean();
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    res.json({ success: true, data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Refund transaction
router.post('/transactions/:id/refund', authenticateAdmin, async (req, res) => {
  try {
    const { reason, refundAmount } = req.body;
    
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.status === 'refunded') {
      return res.status(400).json({ success: false, message: 'Transaction already refunded' });
    }

    // Call Razorpay refund
    const razorpayService = require('../services/razorpayService');
    const refundResult = await razorpayService.createRefund({
      paymentId: transaction.razorpayPaymentId,
      amount: refundAmount || transaction.amount,
      notes: { reason: reason || 'Admin refund' }
    });

    transaction.status = 'refunded';
    transaction.refundDetails = {
      refundId: refundResult.id,
      refundAmount: refundResult.amount,
      reason: reason || 'Admin refund',
      refundedAt: new Date()
    };
    await transaction.save();

    res.json({ success: true, message: 'Refund processed', data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 BOOKING DETAILS (ADMIN)
// ============================================

// Get single booking details
router.get('/bookings/:id', authenticateAdmin, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).lean();
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cancel booking (admin override)
router.put('/bookings/:id/cancel', authenticateAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Booking cannot be cancelled' });
    }

    booking.status = 'cancelled';
    booking.cancellation = {
      cancelledAt: new Date(),
      reason: reason || 'Cancelled by admin',
      cancelledBy: 'admin',
      refundAmount: booking.finalAmount,
      refundPercentage: 100,
      refundStatus: 'pending'
    };
    await booking.save();

    res.json({ success: true, message: 'Booking cancelled by admin', data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
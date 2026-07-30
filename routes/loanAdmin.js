const express = require('express');
const router = express.Router();
const Lender = require('../models/Lender');
const LoanApplication = require('../models/LoanApplication');
const Patient = require('../models/Patient');

// Simple admin authentication (in production, use proper admin auth)
const isAdmin = (req, res, next) => {
  const adminKey = req.header('X-Admin-Key');
  const validKey = process.env.ADMIN_KEY || 'admin_secret_key_2024';
  
  if (!adminKey || adminKey !== validKey) {
    return res.status(401).json({ error: 'Admin access denied' });
  }
  next();
};

// ============================================
// LENDER MANAGEMENT
// ============================================

// Get all pending lender registrations
router.get('/lenders/pending', isAdmin, async (req, res) => {
  try {
    const lenders = await Lender.find({ status: 'pending' }).select('-password -apiConfig.apiSecret');
    res.json(lenders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Get all lenders (with filters)
router.get('/lenders', isAdmin, async (req, res) => {
  try {
    const { status, lenderType } = req.query;
    const query = {};
    if (status) query.status = status;
    if (lenderType) query.lenderType = lenderType;
    
    const lenders = await Lender.find(query).select('-password -apiConfig.apiSecret').sort({ createdAt: -1 });
    res.json(lenders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Get single lender details
router.get('/lenders/:lenderId', isAdmin, async (req, res) => {
  try {
    const lender = await Lender.findOne({ lenderId: req.params.lenderId }).select('-password');
    if (!lender) {
      return res.status(404).json({ error: 'Lender not found' });
    }
    res.json(lender);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Verify/Approve lender
router.put('/lenders/:lenderId/verify', isAdmin, async (req, res) => {
  try {
    const { lenderId } = req.params;
    const { status, commissionRate, adminNote } = req.body;
    
    const lender = await Lender.findOne({ lenderId });
    if (!lender) {
      return res.status(404).json({ error: 'Lender not found' });
    }
    
    lender.status = status || 'active';
    if (commissionRate) lender.commissionRate = commissionRate;
    lender.verifiedAt = new Date();
    lender.updatedAt = new Date();
    lender.adminNote = adminNote || '';
    
    await lender.save();
    
    res.json({ success: true, message: `Lender ${status}`, lender: lender.toObject({ getters: true, transform: (doc, ret) => { delete ret.password; return ret; } }) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Suspend lender
router.put('/lenders/:lenderId/suspend', isAdmin, async (req, res) => {
  try {
    const { lenderId } = req.params;
    const { reason } = req.body;
    
    const lender = await Lender.findOne({ lenderId });
    if (!lender) {
      return res.status(404).json({ error: 'Lender not found' });
    }
    
    lender.status = 'suspended';
    lender.suspensionReason = reason;
    lender.updatedAt = new Date();
    await lender.save();
    
    res.json({ success: true, message: 'Lender suspended' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LOAN APPLICATION MANAGEMENT
// ============================================

// Get all loan applications (platform-wide)
router.get('/applications', isAdmin, async (req, res) => {
  try {
    const { status, lenderId, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (lenderId) query.lenderId = lenderId;
    if (startDate && endDate) {
      query.submittedAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    
    const applications = await LoanApplication.find(query)
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('lenderId', 'businessName lenderId');
    
    const total = await LoanApplication.countDocuments(query);
    
    res.json({
      applications,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Get single application details
router.get('/applications/:applicationId', isAdmin, async (req, res) => {
  try {
    const application = await LoanApplication.findOne({ applicationId: req.params.applicationId })
      .populate('lenderId', 'businessName lenderId email phone');
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    res.json(application);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PLATFORM REPORTS
// ============================================

// Platform-wide reports
router.get('/reports', isAdmin, async (req, res) => {
  try {
    const { period, startDate, endDate, lenderId } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.submittedAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (period) {
      const now = new Date();
      if (period === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dateFilter.submittedAt = { $gte: today };
      } else if (period === 'week') {
        const weekAgo = new Date(now.setDate(now.getDate() - 7));
        dateFilter.submittedAt = { $gte: weekAgo };
      } else if (period === 'month') {
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
        dateFilter.submittedAt = { $gte: monthAgo };
      } else if (period === 'year') {
        const yearAgo = new Date(now.setFullYear(now.getFullYear() - 1));
        dateFilter.submittedAt = { $gte: yearAgo };
      }
    }
    
    const query = { ...dateFilter };
    if (lenderId) query.lenderId = lenderId;
    
    const applications = await LoanApplication.find(query);
    
    const totalApplications = applications.length;
    const totalApproved = applications.filter(a => a.status === 'approved').length;
    const totalDisbursed = applications.filter(a => a.status === 'disbursed').length;
    const totalRejected = applications.filter(a => a.status === 'rejected').length;
    const totalCancelled = applications.filter(a => a.status === 'cancelled').length;
    
    const totalDisbursedAmount = applications
      .filter(a => a.status === 'disbursed')
      .reduce((sum, a) => sum + (a.disbursedAmount || 0), 0);
    
    const totalCommission = applications
      .filter(a => a.status === 'disbursed')
      .reduce((sum, a) => sum + (a.platformCommission || 0), 0);
    
    const commissionPaid = applications
      .filter(a => a.commissionPaid === true)
      .reduce((sum, a) => sum + (a.platformCommission || 0), 0);
    
    const commissionPending = totalCommission - commissionPaid;
    
    // Lender-wise breakdown
    const lenderStats = {};
    for (const app of applications) {
      const lenderIdKey = app.lenderId?.toString() || 'unknown';
      if (!lenderStats[lenderIdKey]) {
        lenderStats[lenderIdKey] = { 
          lenderName: app.lenderId?.businessName || 'Unknown',
          count: 0, 
          disbursedAmount: 0, 
          commission: 0 
        };
      }
      lenderStats[lenderIdKey].count++;
      if (app.status === 'disbursed') {
        lenderStats[lenderIdKey].disbursedAmount += app.disbursedAmount || 0;
        lenderStats[lenderIdKey].commission += app.platformCommission || 0;
      }
    }
    
    res.json({
      period: { startDate, endDate, period },
      summary: {
        totalApplications,
        totalApproved,
        totalDisbursed,
        totalRejected,
        totalCancelled,
        totalDisbursedAmount,
        totalCommission,
        commissionPaid,
        commissionPending
      },
      lenderWise: Object.values(lenderStats)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Commission report
router.get('/reports/commission', isAdmin, async (req, res) => {
  try {
    const { startDate, endDate, lenderId } = req.query;
    
    const query = { status: 'disbursed' };
    if (startDate && endDate) {
      query.disbursedAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (lenderId) query.lenderId = lenderId;
    
    const disbursedLoans = await LoanApplication.find(query).populate('lenderId', 'businessName commissionRate');
    
    const totalCommission = disbursedLoans.reduce((sum, loan) => sum + (loan.platformCommission || 0), 0);
    const paidCommission = disbursedLoans.filter(l => l.commissionPaid).reduce((sum, loan) => sum + (loan.platformCommission || 0), 0);
    const pendingCommission = totalCommission - paidCommission;
    
    const lenderCommissionMap = {};
    for (const loan of disbursedLoans) {
      const lenderName = loan.lenderId?.businessName || 'Unknown';
      if (!lenderCommissionMap[lenderName]) {
        lenderCommissionMap[lenderName] = {
          lenderName,
          totalLoans: 0,
          totalAmount: 0,
          commission: 0,
          commissionPaid: 0,
          commissionPending: 0
        };
      }
      lenderCommissionMap[lenderName].totalLoans++;
      lenderCommissionMap[lenderName].totalAmount += loan.disbursedAmount || 0;
      lenderCommissionMap[lenderName].commission += loan.platformCommission || 0;
      if (loan.commissionPaid) {
        lenderCommissionMap[lenderName].commissionPaid += loan.platformCommission || 0;
      } else {
        lenderCommissionMap[lenderName].commissionPending += loan.platformCommission || 0;
      }
    }
    
    res.json({
      summary: {
        totalDisbursedLoans: disbursedLoans.length,
        totalDisbursedAmount: disbursedLoans.reduce((sum, l) => sum + (l.disbursedAmount || 0), 0),
        totalCommission,
        paidCommission,
        pendingCommission
      },
      lenderWise: Object.values(lenderCommissionMap)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Mark commission as paid
router.put('/commission/pay', isAdmin, async (req, res) => {
  try {
    const { applicationIds } = req.body;
    
    const result = await LoanApplication.updateMany(
      { applicationId: { $in: applicationIds }, commissionPaid: false },
      { commissionPaid: true, commissionPaidAt: new Date() }
    );
    
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PATIENT MANAGEMENT
// ============================================

// Get all patients
router.get('/patients', isAdmin, async (req, res) => {
  try {
    const patients = await Patient.find().sort({ createdAt: -1 });
    res.json(patients);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Get single patient with their loan applications
router.get('/patients/:patientId', isAdmin, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    const applications = await LoanApplication.find({ patientId: patient._id });
    
    res.json({ patient, applications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DASHBOARD STATS
// ============================================

// Admin dashboard stats
router.get('/dashboard', isAdmin, async (req, res) => {
  try {
    const totalPatients = await Patient.countDocuments();
    const totalLenders = await Lender.countDocuments();
    const activeLenders = await Lender.countDocuments({ status: 'active' });
    const pendingLenders = await Lender.countDocuments({ status: 'pending' });
    
    const totalApplications = await LoanApplication.countDocuments();
    const totalDisbursed = await LoanApplication.countDocuments({ status: 'disbursed' });
    
    const disbursedLoans = await LoanApplication.find({ status: 'disbursed' });
    const totalDisbursedAmount = disbursedLoans.reduce((sum, loan) => sum + (loan.disbursedAmount || 0), 0);
    const totalCommission = disbursedLoans.reduce((sum, loan) => sum + (loan.platformCommission || 0), 0);
    
    res.json({
      patients: { total: totalPatients },
      lenders: { total: totalLenders, active: activeLenders, pending: pendingLenders },
      loans: { totalApplications, totalDisbursed, totalDisbursedAmount, totalCommission }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
// D:\hospital backend\routes\adminLender.js
const express = require('express');
const router = express.Router();
const Lender = require('../models/Lender');
const LoanApplication = require('../models/LoanApplication');
const { isAdmin } = require('../middleware/lenderAuth');

// ============================================
// ADMIN - GET PENDING LENDERS
// ============================================

router.get('/pending', isAdmin, async (req, res) => {
  try {
    const pendingLenders = await Lender.find({ status: 'pending' })
      .select('-password -apiConfig.apiSecret')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: pendingLenders.length,
      lenders: pendingLenders
    });
  } catch (error) {
    console.error('Error fetching pending lenders:', error);
    res.status(500).json({ error: 'Failed to fetch pending lenders' });
  }
});

// ============================================
// ADMIN - GET ALL LENDERS (with filters)
// ============================================

router.get('/', isAdmin, async (req, res) => {
  try {
    const { status, lenderType, search, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (lenderType) query.lenderType = lenderType;
    if (search) {
      query.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    const lenders = await Lender.find(query)
      .select('-password -apiConfig.apiSecret')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Lender.countDocuments(query);
    
    res.json({
      success: true,
      lenders,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching lenders:', error);
    res.status(500).json({ error: 'Failed to fetch lenders' });
  }
});

// ============================================
// ADMIN - GET SINGLE LENDER DETAILS
// ============================================

router.get('/:lenderId', isAdmin, async (req, res) => {
  try {
    const lender = await Lender.findOne({ lenderId: req.params.lenderId })
      .select('-password -apiConfig.apiSecret');
    
    if (!lender) {
      return res.status(404).json({ error: 'Lender not found' });
    }
    
    // Get application stats for this lender
    const applicationStats = await LoanApplication.aggregate([
      { $match: { lenderId: lender._id } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }}
    ]);
    
    res.json({
      success: true,
      lender,
      stats: applicationStats
    });
  } catch (error) {
    console.error('Error fetching lender:', error);
    res.status(500).json({ error: 'Failed to fetch lender' });
  }
});

// ============================================
// ADMIN - VERIFY LENDER (Approve/Reject)
// ============================================

router.put('/:lenderId/verify', isAdmin, async (req, res) => {
  try {
    const { lenderId } = req.params;
    const { status, commissionRate, adminNote, apiKey, apiSecret } = req.body;
    
    if (!status || !['active', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be active or rejected' });
    }
    
    const lender = await Lender.findOne({ lenderId });
    if (!lender) {
      return res.status(404).json({ error: 'Lender not found' });
    }
    
    // If rejecting, require a reason
    if (status === 'rejected' && !req.body.rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason required' });
    }
    
    lender.status = status;
    if (commissionRate) lender.commissionRate = commissionRate;
    if (apiKey) lender.apiConfig.apiKey = apiKey;
    if (apiSecret) lender.apiConfig.apiSecret = apiSecret;
    lender.verifiedAt = new Date();
    lender.verifiedBy = req.user?.email || 'Admin';
    lender.adminNote = adminNote || '';
    if (status === 'rejected') {
      lender.rejectionReason = req.body.rejectionReason;
    }
    lender.updatedAt = new Date();
    
    await lender.save();
    
    // In production, send email notification to lender
    console.log(`📧 Lender ${lenderId} ${status} by admin`);
    
    res.json({
      success: true,
      message: `Lender ${status} successfully`,
      lender: lender.toObject({ 
        getters: true, 
        transform: (doc, ret) => { 
          delete ret.password; 
          delete ret.apiConfig?.apiSecret;
          return ret; 
        } 
      })
    });
  } catch (error) {
    console.error('Error verifying lender:', error);
    res.status(500).json({ error: 'Failed to verify lender' });
  }
});

// ============================================
// ADMIN - SUSPEND LENDER
// ============================================

router.put('/:lenderId/suspend', isAdmin, async (req, res) => {
  try {
    const { lenderId } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: 'Suspension reason required' });
    }
    
    const lender = await Lender.findOne({ lenderId });
    if (!lender) {
      return res.status(404).json({ error: 'Lender not found' });
    }
    
    lender.status = 'suspended';
    lender.suspensionReason = reason;
    lender.updatedAt = new Date();
    await lender.save();
    
    res.json({
      success: true,
      message: 'Lender suspended successfully',
      lender: lender.toObject({ 
        getters: true, 
        transform: (doc, ret) => { 
          delete ret.password; 
          return ret; 
        } 
      })
    });
  } catch (error) {
    console.error('Error suspending lender:', error);
    res.status(500).json({ error: 'Failed to suspend lender' });
  }
});

// ============================================
// ADMIN - DELETE/REJECT LENDER
// ============================================

router.delete('/:lenderId', isAdmin, async (req, res) => {
  try {
    const { lenderId } = req.params;
    const lender = await Lender.findOne({ lenderId });
    
    if (!lender) {
      return res.status(404).json({ error: 'Lender not found' });
    }
    
    // Check if lender has active applications
    const activeApplications = await LoanApplication.countDocuments({
      lenderId: lender._id,
      status: { $in: ['submitted', 'under_review', 'approved'] }
    });
    
    if (activeApplications > 0) {
      return res.status(400).json({ 
        error: `Cannot delete lender with ${activeApplications} active applications. Suspend instead.` 
      });
    }
    
    await lender.deleteOne();
    
    res.json({
      success: true,
      message: 'Lender deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting lender:', error);
    res.status(500).json({ error: 'Failed to delete lender' });
  }
});

// ============================================
// ADMIN - GET LENDER DASHBOARD STATS
// ============================================

router.get('/stats/overview', isAdmin, async (req, res) => {
  try {
    const totalLenders = await Lender.countDocuments();
    const pendingLenders = await Lender.countDocuments({ status: 'pending' });
    const activeLenders = await Lender.countDocuments({ status: 'active' });
    const suspendedLenders = await Lender.countDocuments({ status: 'suspended' });
    
    // Get commission stats
    const disbursedLoans = await LoanApplication.find({ status: 'disbursed' });
    const totalCommission = disbursedLoans.reduce((sum, loan) => sum + (loan.platformCommission || 0), 0);
    const paidCommission = disbursedLoans
      .filter(loan => loan.commissionPaid)
      .reduce((sum, loan) => sum + (loan.platformCommission || 0), 0);
    const pendingCommission = totalCommission - paidCommission;
    
    res.json({
      success: true,
      stats: {
        lenders: {
          total: totalLenders,
          pending: pendingLenders,
          active: activeLenders,
          suspended: suspendedLenders
        },
        commission: {
          total: totalCommission,
          paid: paidCommission,
          pending: pendingCommission
        }
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const payoutService = require('../services/payoutService');
const Payout = require('../models/Payout');

// ============================================
// AUTH MIDDLEWARE
// ============================================
const authenticateUser = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Please login to continue' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// ============================================
// GET PROVIDER EARNINGS
// ============================================
router.get('/earnings/:providerType/:providerId', authenticateUser, async (req, res) => {
  try {
    const { providerType, providerId } = req.params;

    // Verify ownership
    if (req.user.id !== providerId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const earnings = await payoutService.getProviderEarnings(providerType, providerId);

    res.json({ success: true, data: earnings });

  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to get earnings' });
  }
});

// ============================================
// REQUEST SETTLEMENT
// ============================================
router.post('/request', authenticateUser, async (req, res) => {
  try {
    const { providerType, providerId } = req.body;

    // Verify ownership
    if (req.user.id !== providerId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const settlement = await payoutService.requestSettlement(providerType, providerId);

    res.json({
      success: true,
      message: 'Settlement requested successfully',
      data: settlement
    });

  } catch (error) {
    console.error('Request settlement error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to request settlement' });
  }
});

// ============================================
// GET SETTLEMENT HISTORY
// ============================================
router.get('/history/:providerType/:providerId', authenticateUser, async (req, res) => {
  try {
    const { providerType, providerId } = req.params;

    // Verify ownership
    if (req.user.id !== providerId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const history = await payoutService.getSettlementHistory(providerType, providerId);

    res.json({ success: true, data: history });

  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, message: 'Failed to get settlement history' });
  }
});

// ============================================
// GET PENDING PAYOUTS (ADMIN)
// ============================================
router.get('/admin/pending', authenticateUser, async (req, res) => {
  try {
    // Check if admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const pending = await payoutService.getPendingPayouts();

    res.json({ success: true, data: pending });

  } catch (error) {
    console.error('Get pending error:', error);
    res.status(500).json({ success: false, message: 'Failed to get pending payouts' });
  }
});

// ============================================
// APPROVE PAYOUT (ADMIN)
// ============================================
router.put('/admin/approve/:payoutId', authenticateUser, async (req, res) => {
  try {
    // Check if admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { transactionId, note } = req.body;

    const payout = await payoutService.approvePayout(req.params.payoutId, transactionId, note);

    res.json({
      success: true,
      message: 'Payout approved successfully',
      data: payout
    });

  } catch (error) {
    console.error('Approve payout error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to approve payout' });
  }
});

// ============================================
// REJECT PAYOUT (ADMIN)
// ============================================
router.put('/admin/reject/:payoutId', authenticateUser, async (req, res) => {
  try {
    // Check if admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { reason } = req.body;

    const payout = await payoutService.rejectPayout(req.params.payoutId, reason);

    res.json({
      success: true,
      message: 'Payout rejected successfully',
      data: payout
    });

  } catch (error) {
    console.error('Reject payout error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to reject payout' });
  }
});

module.exports = router;
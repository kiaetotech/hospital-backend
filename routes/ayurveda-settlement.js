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
// HELPER: Get canonical user ID from JWT
// ============================================
const getUserIdFromToken = (user) => {
  return String(user.id || user._id || user.userId || '');
};

// ============================================
// HELPER: Check if provider ID matches authenticated user
// ============================================
const isOwner = (req, providerId) => {
  const userId = getUserIdFromToken(req.user);
  return userId === String(providerId);
};

// ============================================
// GET PROVIDER EARNINGS
// ============================================
router.get('/earnings/:providerType/:providerId', authenticateUser, async (req, res) => {
  try {
    const { providerType, providerId } = req.params;

    if (!isOwner(req, providerId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only view your own earnings' 
      });
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

    if (!isOwner(req, providerId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only request settlements for yourself' 
      });
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

    if (!isOwner(req, providerId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only view your own settlement history' 
      });
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
// ============================================
// GET PENDING PAYOUTS (ADMIN)
// ============================================
router.get('/admin/pending', async (req, res) => {
  // Accept either admin token OR admin key
  const adminKey = req.headers['x-admin-key'];
  const authHeader = req.headers.authorization;
  
  let isAuthorized = false;

  // Check admin key
  if (adminKey && adminKey === process.env.ADMIN_KEY) {
    isAuthorized = true;
  }

  // Check admin token
  if (!isAuthorized && authHeader) {
    try {
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
      if (decoded.role === 'admin') {
        isAuthorized = true;
      }
    } catch (e) {
      // Invalid token
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const pending = await payoutService.getPendingPayouts();
    res.json({ success: true, data: pending });
  } catch (error) {
    console.error('Get pending error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to get pending payouts' });
  }
});

// ============================================
// APPROVE PAYOUT (ADMIN)
// ============================================
router.put('/admin/approve/:payoutId', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  let isAuthorized = adminKey && adminKey === process.env.ADMIN_KEY;

  if (!isAuthorized) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
        if (decoded.role === 'admin') isAuthorized = true;
      } catch (e) {}
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
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
router.put('/admin/reject/:payoutId', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  let isAuthorized = adminKey && adminKey === process.env.ADMIN_KEY;

  if (!isAuthorized) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
        if (decoded.role === 'admin') isAuthorized = true;
      } catch (e) {}
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const { reason } = req.body;

    const payout = await payoutService.rejectPayout(req.params.payoutId, reason);
    
    res.json({
      success: true,
      message: 'Payout rejected successfully',
      data: payout
    });
  } catch (error) {
    console.error('Reject payout error:', error.message);
    res.status(400).json({ success: false, message: error.message || 'Failed to reject payout' });
  }
});

// ============================================
// ADMIN: ALL SETTLEMENTS (with filters + pagination)
// ============================================
router.get('/admin/all', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  let isAuthorized = adminKey && adminKey === process.env.ADMIN_KEY;

  if (!isAuthorized) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
        if (decoded.role === 'admin') isAuthorized = true;
      } catch (e) {}
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const { status, providerType, search, page = 1, limit = 50 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (providerType) query.providerType = providerType;
    if (search) {
      query.$or = [
        { providerName: { $regex: search, $options: 'i' } },
        { providerId: { $regex: search, $options: 'i' } },
        { payoutId: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [settlements, total] = await Promise.all([
      Payout.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Payout.countDocuments(query)
    ]);

    // Aggregate stats
    const stats = await Payout.aggregate([
      { $match: {} },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalNetAmount: { $sum: '$netAmount' }
        }
      }
    ]);

    const statsSummary = {
      requested: { count: 0, amount: 0 },
      approved: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 }
    };
    stats.forEach(s => {
      if (statsSummary[s._id]) {
        statsSummary[s._id] = { count: s.count, amount: s.totalAmount };
      }
    });

    res.json({
      success: true,
      data: settlements,
      stats: statsSummary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin all settlements error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch settlements' });
  }
});

// ============================================
// ADMIN: PROVIDERS AWAITING PAYOUT (aggregated view)
// ============================================
router.get('/admin/providers', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  let isAuthorized = adminKey && adminKey === process.env.ADMIN_KEY;

  if (!isAuthorized) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
        if (decoded.role === 'admin') isAuthorized = true;
      } catch (e) {}
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    // Group by provider — shows pending payouts per provider
    const providers = await Payout.aggregate([
      { $match: { status: 'requested' } },
      {
        $group: {
          _id: { providerId: '$providerId', providerType: '$providerType' },
          providerName: { $first: '$providerName' },
          providerType: { $first: '$providerType' },
          totalPayouts: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalNetAmount: { $sum: '$netAmount' },
          oldestRequest: { $min: '$createdAt' },
          payoutIds: { $push: '$payoutId' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.json({
      success: true,
      data: providers,
      total: providers.length
    });
  } catch (error) {
    console.error('Admin providers error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch providers' });
  }
});

// ============================================
// ADMIN: BULK APPROVE
// ============================================
router.put('/admin/bulk-approve', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  let isAuthorized = adminKey && adminKey === process.env.ADMIN_KEY;

  if (!isAuthorized) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
        if (decoded.role === 'admin') isAuthorized = true;
      } catch (e) {}
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const { payoutIds, transactionId, note } = req.body;

    if (!Array.isArray(payoutIds) || payoutIds.length === 0) {
      return res.status(400).json({ success: false, message: 'payoutIds array required' });
    }

    const results = [];
    for (const payoutId of payoutIds) {
      try {
        const payout = await payoutService.approvePayout(payoutId, transactionId, note);
        results.push({ payoutId, success: true });
      } catch (e) {
        results.push({ payoutId, success: false, error: e.message });
      }
    }

    res.json({
      success: true,
      message: `Processed ${payoutIds.length} payouts`,
      data: results
    });
  } catch (error) {
    console.error('Bulk approve error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to bulk approve' });
  }
});

// ============================================
// ADMIN: EXPORT SETTLEMENTS CSV
// ============================================
router.get('/admin/export', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const { status, providerType } = req.query;
    const query = {};
    if (status) query.status = status;
    if (providerType) query.providerType = providerType;

    const settlements = await Payout.find(query).sort({ createdAt: -1 }).lean();

    // Build CSV
    const headers = ['Payout ID', 'Provider Type', 'Provider Name', 'Amount', 'TDS', 'Net Amount', 'Status', 'Requested At', 'Paid At'];
    const rows = settlements.map(s => [
      s.payoutId,
      s.providerType,
      s.providerName,
      s.amount,
      s.tdsDeducted || 0,
      s.netAmount,
      s.status,
      new Date(s.createdAt).toISOString(),
      s.paidAt ? new Date(s.paidAt).toISOString() : ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ayurveda-settlements-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to export' });
  }
});
module.exports = router;
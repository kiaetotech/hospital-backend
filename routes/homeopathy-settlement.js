// D:\hospital backend\routes\homeopathy-settlement.js
const express = require('express');
const router = express.Router();
const homeopathyPayoutService = require('../services/homeopathyPayoutService');
const Payout = require('../models/Payout');
const mongoose = require('mongoose');

// Homeopathy-scoped provider types
const HOMEOPATHY_PROVIDER_TYPES = [
  'homeopathy_doctor',
  'naturopathy_center',
  'pharmacy',
  // aliases
  'doctor',
  'center'
];

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && adminKey === process.env.ADMIN_KEY) return next();

  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin') return next();
    } catch (e) {}
  }
  return res.status(401).json({ success: false, message: 'Admin authentication required' });
};

// ============================================
// HELPERS
// ============================================
const getUserIdFromToken = (user) => {
  if (!user) return '';
  // Try every known key the JWT might use
  const candidates = [user.id, user._id, user.userId, user.doctorId, user.providerId];
  for (const c of candidates) {
    if (c) return String(c);
  }
  return '';
};

const isOwner = (req, providerId) => {
  if (!req.user || !providerId) return false;

  const userId = getUserIdFromToken(req.user);
  const target = String(providerId);

  if (userId && userId === target) return true;
  if (req.user.role === 'admin') return true;
  if (['homeopathy_doctor', 'doctor', 'ayurveda_doctor'].includes(req.user.role)) return true;

  return false;
};

const buildPayoutMatch = (query = {}) => {
  const { status, providerType, from, to } = query;
  const match = {};

  if (status) {
    match.status = status;
  } else {
    match.status = { $in: ['requested', 'approved', 'paid', 'pending', 'processing'] };
  }

  if (providerType) {
    match.providerType = providerType;
  } else {
    match.providerType = { $in: HOMEOPATHY_PROVIDER_TYPES };
  }

  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      match.createdAt.$lte = toDate;
    }
  }

  return match;
};

// ============================================
// PROVIDER: GET EARNINGS
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

    const earnings = await homeopathyPayoutService.getProviderEarnings(providerType, providerId);
    res.json({ success: true, data: earnings });

  } catch (error) {
    console.error('Homeopathy get earnings error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to get earnings' });
  }
});

// ============================================
// PROVIDER: REQUEST SETTLEMENT
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

    const settlement = await homeopathyPayoutService.requestSettlement(providerType, providerId);

    res.json({
      success: true,
      message: 'Settlement requested successfully',
      data: settlement
    });

  } catch (error) {
    console.error('Homeopathy request settlement error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to request settlement' });
  }
});

// ============================================
// PROVIDER: GET SETTLEMENT HISTORY
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

    const history = await homeopathyPayoutService.getSettlementHistory(providerType, providerId);
    res.json({ success: true, data: history });

  } catch (error) {
    console.error('Homeopathy get history error:', error);
    res.status(500).json({ success: false, message: 'Failed to get settlement history' });
  }
});

// ============================================
// ADMIN: GET PENDING PAYOUTS
// ============================================
router.get('/admin/pending', requireAdmin, async (req, res) => {
  try {
    const pending = await homeopathyPayoutService.getPendingPayouts();
    res.json({ success: true, data: pending });
  } catch (error) {
    console.error('Homeopathy get pending error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to get pending payouts' });
  }
});

// ============================================
// ADMIN: APPROVE PAYOUT
// ============================================
router.put('/admin/approve/:payoutId', requireAdmin, async (req, res) => {
  try {
    const { transactionId, note } = req.body;
    const payout = await homeopathyPayoutService.approvePayout(req.params.payoutId, transactionId, note);

    res.json({
      success: true,
      message: 'Payout approved successfully',
      data: payout
    });

  } catch (error) {
    console.error('Homeopathy approve payout error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to approve payout' });
  }
});

// ============================================
// ADMIN: REJECT PAYOUT
// ============================================
router.put('/admin/reject/:payoutId', requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const payout = await homeopathyPayoutService.rejectPayout(req.params.payoutId, reason);

    res.json({
      success: true,
      message: 'Payout rejected successfully',
      data: payout
    });
  } catch (error) {
    console.error('Homeopathy reject payout error:', error.message);
    res.status(400).json({ success: false, message: error.message || 'Failed to reject payout' });
  }
});

// ============================================
// ADMIN: ALL SETTLEMENTS
// ============================================
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const { status, providerType, search, page = 1, limit = 50 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (providerType) query.providerType = providerType;
    else query.providerType = { $in: HOMEOPATHY_PROVIDER_TYPES };
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

    const stats = await Payout.aggregate([
      { $match: { providerType: { $in: HOMEOPATHY_PROVIDER_TYPES } } },
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
    console.error('Homeopathy admin all settlements error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch settlements' });
  }
});

// ============================================
// ADMIN: PROVIDERS AWAITING PAYOUT
// ============================================
router.get('/admin/providers', requireAdmin, async (req, res) => {
  try {
    const providers = await Payout.aggregate([
      {
        $match: {
          status: 'requested',
          providerType: { $in: HOMEOPATHY_PROVIDER_TYPES }
        }
      },
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

    res.json({ success: true, data: providers, total: providers.length });
  } catch (error) {
    console.error('Homeopathy admin providers error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch providers' });
  }
});

// ============================================
// ADMIN: BULK APPROVE
// ============================================
router.put('/admin/bulk-approve', requireAdmin, async (req, res) => {
  try {
    const { payoutIds, transactionId, note } = req.body;

    if (!Array.isArray(payoutIds) || payoutIds.length === 0) {
      return res.status(400).json({ success: false, message: 'payoutIds array required' });
    }

    const results = [];
    for (const payoutId of payoutIds) {
      try {
        await homeopathyPayoutService.approvePayout(payoutId, transactionId, note);
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
    console.error('Homeopathy bulk approve error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to bulk approve' });
  }
});

// ============================================
// ADMIN: EXPORT CSV
// ============================================
router.get('/admin/export', requireAdmin, async (req, res) => {
  try {
    const { status, providerType } = req.query;
    const query = {};
    if (status) query.status = status;
    if (providerType) query.providerType = providerType;
    else query.providerType = { $in: HOMEOPATHY_PROVIDER_TYPES };

    const settlements = await Payout.find(query).sort({ createdAt: -1 }).lean();

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
    res.setHeader('Content-Disposition', `attachment; filename="homeopathy-settlements-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Homeopathy export error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to export' });
  }
});

// ============================================
// ADMIN: SETTLEMENTS BY CITY
// ============================================
router.get('/admin/by-city', requireAdmin, async (req, res) => {
  try {
    const match = buildPayoutMatch(req.query);

    const [cities, totals] = await Promise.all([
      Payout.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$providerCity',
            providerCount: { $addToSet: '$providerId' },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalTds: { $sum: { $ifNull: ['$tdsDeducted', 0] } },
            totalNetAmount: { $sum: '$netAmount' }
          }
        },
        {
          $project: {
            _id: 0,
            city: { $ifNull: ['$_id', 'Unknown'] },
            providerCount: { $size: '$providerCount' },
            count: 1,
            totalAmount: { $round: ['$totalAmount', 2] },
            totalTds: { $round: ['$totalTds', 2] },
            totalNetAmount: { $round: ['$totalNetAmount', 2] }
          }
        },
        { $sort: { totalAmount: -1 } }
      ]),
      Payout.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalNetAmount: { $sum: '$netAmount' },
            count: { $sum: 1 }
          }
        },
        { $project: { _id: 0 } }
      ])
    ]);

    res.json({
      success: true,
      data: cities,
      totals: totals[0] || { totalAmount: 0, totalNetAmount: 0, count: 0 }
    });
  } catch (error) {
    console.error('[homeopathy.settlements.byCity]', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch city breakdown' });
  }
});

// ============================================
// ADMIN: SETTLEMENTS BY DATE
// ============================================
router.get('/admin/by-date', requireAdmin, async (req, res) => {
  try {
    const { groupBy = 'day' } = req.query;

    const allowedFormats = {
      day: { format: '%Y-%m-%d', tz: 'Asia/Kolkata' },
      week: { format: '%G-W%V', tz: 'Asia/Kolkata' },
      month: { format: '%Y-%m', tz: 'Asia/Kolkata' },
      year: { format: '%Y', tz: 'Asia/Kolkata' }
    };

    if (!allowedFormats[groupBy]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid groupBy. Use: day | week | month | year'
      });
    }

    const { format, tz } = allowedFormats[groupBy];
    const match = buildPayoutMatch(req.query);

    const [dates, totals] = await Promise.all([
      Payout.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format, date: '$createdAt', timezone: tz } },
            providerCount: { $addToSet: '$providerId' },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalTds: { $sum: { $ifNull: ['$tdsDeducted', 0] } },
            totalNetAmount: { $sum: '$netAmount' }
          }
        },
        {
          $project: {
            _id: 0,
            period: '$_id',
            providerCount: { $size: '$providerCount' },
            count: 1,
            totalAmount: { $round: ['$totalAmount', 2] },
            totalTds: { $round: ['$totalTds', 2] },
            totalNetAmount: { $round: ['$totalNetAmount', 2] }
          }
        },
        { $sort: { period: -1 } }
      ]),
      Payout.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalTds: { $sum: { $ifNull: ['$tdsDeducted', 0] } },
            totalNetAmount: { $sum: '$netAmount' }
          }
        },
        { $project: { _id: 0 } }
      ])
    ]);

    res.json({
      success: true,
      data: dates,
      totals: totals[0] || { count: 0, totalAmount: 0, totalTds: 0, totalNetAmount: 0 }
    });
  } catch (error) {
    console.error('[homeopathy.settlements.byDate]', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch date breakdown' });
  }
});

// ============================================
// ADMIN: SUMMARY STATS
// ============================================
router.get('/admin/summary', requireAdmin, async (req, res) => {
  try {
    const match = buildPayoutMatch(req.query);

    const stats = await Payout.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalPayouts: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalTds: { $sum: { $ifNull: ['$tdsDeducted', 0] } },
          totalNetAmount: { $sum: '$netAmount' },
          uniqueProviders: { $addToSet: '$providerId' },
          uniqueCities: { $addToSet: '$providerCity' }
        }
      },
      {
        $project: {
          _id: 0,
          totalPayouts: 1,
          totalAmount: { $round: ['$totalAmount', 2] },
          totalTds: { $round: ['$totalTds', 2] },
          totalNetAmount: { $round: ['$totalNetAmount', 2] },
          uniqueProviderCount: { $size: '$uniqueProviders' },
          uniqueCityCount: { $size: '$uniqueCities' }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        totalPayouts: 0,
        totalAmount: 0,
        totalTds: 0,
        totalNetAmount: 0,
        uniqueProviderCount: 0,
        uniqueCityCount: 0
      }
    });
  } catch (error) {
    console.error('[homeopathy.settlements.summary]', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch summary' });
  }
});

module.exports = router;
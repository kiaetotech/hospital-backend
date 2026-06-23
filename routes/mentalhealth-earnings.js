const express = require('express');
const router = express.Router();
const MentalHealthBooking = require('../models/MentalHealthBooking');
const TherapistWallet = require('../models/TherapistWallet');
const TherapistPayout = require('../models/TherapistPayout');
const CommissionRule = require('../models/CommissionRule');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// EARNINGS DASHBOARD
// ============================================

// Get therapist earnings overview
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const therapistId = req.user.therapistId || req.user._id;
    
    // Get wallet summary
    const wallet = await TherapistWallet.getSummary(therapistId);
    
    // Get booking stats
    const bookingStats = await MentalHealthBooking.aggregate([
      { $match: { therapistId, paymentStatus: 'paid' } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          totalRevenue: { $sum: '$patientAmount' },
          totalCommission: { $sum: '$platformCommission' },
          totalEarnings: { $sum: '$therapistEarnings' }
        }
      }
    ]);
    
    // Get payout summary
    const payoutSummary = await TherapistPayout.getSummary(therapistId);
    
    // Get monthly earnings
    const monthlyEarnings = await MentalHealthBooking.aggregate([
      {
        $match: {
          therapistId,
          paymentStatus: 'paid',
          completedAt: { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$completedAt' },
            month: { $month: '$completedAt' }
          },
          earnings: { $sum: '$therapistEarnings' },
          sessions: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);
    
    // Format monthly data
    const monthlyData = monthlyEarnings.map(item => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      earnings: item.earnings,
      sessions: item.sessions
    }));
    
    res.json({
      success: true,
      data: {
        wallet: {
          balance: wallet.balance,
          pendingBalance: wallet.pendingBalance,
          totalEarned: wallet.totalEarned,
          totalWithdrawn: wallet.totalWithdrawn,
          availableBalance: wallet.availableBalance
        },
        bookings: {
          totalSessions: bookingStats[0]?.totalSessions || 0,
          totalRevenue: bookingStats[0]?.totalRevenue || 0,
          totalCommission: bookingStats[0]?.totalCommission || 0,
          totalEarnings: bookingStats[0]?.totalEarnings || 0
        },
        payouts: payoutSummary,
        monthlyEarnings: monthlyData,
        nextPayoutDate: wallet.nextPayoutDate,
        lastPayoutDate: wallet.lastPayoutDate
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get commission breakdown
router.get('/commission/breakdown', authenticateToken, async (req, res) => {
  try {
    const therapistId = req.user.therapistId || req.user._id;
    const { period = 'all' } = req.query;
    
    let dateFilter = {};
    if (period === 'month') {
      dateFilter = {
        createdAt: { $gte: new Date(new Date().setDate(1)) }
      };
    } else if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    }
    
    const bookings = await MentalHealthBooking.find({
      therapistId,
      paymentStatus: 'paid',
      ...dateFilter
    }).sort({ createdAt: -1 });
    
    // Calculate totals
    let totalPatientAmount = 0;
    let totalCommission = 0;
    let totalTherapistEarnings = 0;
    
    const commissionBreakdown = bookings.map(booking => ({
      bookingId: booking._id,
      date: booking.createdAt,
      patientAmount: booking.patientAmount,
      commission: booking.platformCommission,
      commissionRate: booking.commissionRate,
      therapistEarnings: booking.therapistEarnings
    }));
    
    bookings.forEach(b => {
      totalPatientAmount += b.patientAmount;
      totalCommission += b.platformCommission;
      totalTherapistEarnings += b.therapistEarnings;
    });
    
    res.json({
      success: true,
      data: {
        summary: {
          totalPatientAmount,
          totalCommission,
          totalTherapistEarnings,
          totalSessions: bookings.length,
          averageCommissionRate: bookings.length > 0
            ? (totalCommission / totalPatientAmount * 100).toFixed(2)
            : 0
        },
        breakdown: commissionBreakdown,
        bookings: bookings.map(b => ({
          id: b._id,
          date: b.createdAt,
          amount: b.patientAmount,
          commission: b.platformCommission,
          rate: b.commissionRate,
          earnings: b.therapistEarnings,
          paymentStatus: b.paymentStatus
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get earnings report (for export)
router.get('/report', authenticateToken, async (req, res) => {
  try {
    const therapistId = req.user.therapistId || req.user._id;
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate) dateFilter.createdAt = { $gte: new Date(startDate) };
    if (endDate) {
      dateFilter.createdAt = {
        ...dateFilter.createdAt,
        $lte: new Date(endDate)
      };
    }
    
    const bookings = await MentalHealthBooking.find({
      therapistId,
      paymentStatus: 'paid',
      ...dateFilter
    }).populate('patientId', 'name email phone')
      .sort({ createdAt: -1 });
    
    // Generate report data
    const reportData = bookings.map(b => ({
      bookingId: b._id,
      patientName: b.patientId?.name || 'Unknown',
      patientEmail: b.patientId?.email || '',
      date: b.createdAt,
      amount: b.patientAmount,
      commission: b.platformCommission,
      earnings: b.therapistEarnings,
      paymentStatus: b.paymentStatus,
      payoutStatus: b.payoutStatus
    }));
    
    // Calculate totals
    const totals = bookings.reduce((acc, b) => {
      acc.totalAmount += b.patientAmount;
      acc.totalCommission += b.platformCommission;
      acc.totalEarnings += b.therapistEarnings;
      return acc;
    }, { totalAmount: 0, totalCommission: 0, totalEarnings: 0 });
    
    res.json({
      success: true,
      data: {
        summary: {
          period: { startDate, endDate },
          totalSessions: bookings.length,
          ...totals
        },
        report: reportData
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export report as CSV
router.get('/report/export', authenticateToken, async (req, res) => {
  try {
    const therapistId = req.user.therapistId || req.user._id;
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate) dateFilter.createdAt = { $gte: new Date(startDate) };
    if (endDate) {
      dateFilter.createdAt = {
        ...dateFilter.createdAt,
        $lte: new Date(endDate)
      };
    }
    
    const bookings = await MentalHealthBooking.find({
      therapistId,
      paymentStatus: 'paid',
      ...dateFilter
    }).populate('patientId', 'name email')
      .sort({ createdAt: -1 });
    
    // Generate CSV
    const headers = ['Booking ID', 'Patient Name', 'Patient Email', 'Date', 'Amount', 'Commission', 'Earnings', 'Payment Status'];
    const rows = bookings.map(b => [
      b._id,
      b.patientId?.name || 'Unknown',
      b.patientId?.email || '',
      b.createdAt.toISOString().split('T')[0],
      b.patientAmount,
      b.platformCommission,
      b.therapistEarnings,
      b.paymentStatus
    ]);
    
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.join(',') + '\n';
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=earnings_report.csv');
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
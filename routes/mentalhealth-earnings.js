const express = require('express');
const router = express.Router();
const MentalHealthBooking = require('../models/MentalHealthBooking');
const TherapistWallet = require('../models/TherapistWallet');
const TherapistPayout = require('../models/TherapistPayout');
const CommissionRule = require('../models/CommissionRule');

// ============================================
// HELPERToken
// ============================================
const verifyToken = (req) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    throw new Error('Access denied. Please login first.');
  }
  
  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token.');
  }
};

// ============================================
// EARNINGS DASHBOARD
// ============================================

// Get therapist earnings overview
router.get('/overview', async (req, res) => {
  try {
    const decoded = verifyToken(req);
    const therapistId = decoded.id || decoded._id;
    
    // Get wallet summary
    const wallet = await TherapistWallet.getSummary(therapistId);
    
    // Get booking stats
    const bookingStats = await MentalHealthBooking.aggregate([
      { $match: { therapistId, paymentStatus: 'paid' } },
      {
        $group: {
          _id,
          totalSessions: { $sum: 1 },
          totalRevenue: { $sum: '$patientAmount' },
          totalCommission: { $sum: '$platformCommission' },
          totalEarnings: { $sum: '$therapistEarning' }
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
          scheduledDate: { $exists}
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$scheduledDate' },
            month: { $month: '$scheduledDate' }
          },
          earnings: { $sum: '$therapistEarning' },
          sessions: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);
    
    // Format monthly data
    const monthlyData = monthlyEarnings.map(item => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      earnings.earnings || 0,
      sessions.sessions || 0
    }));
    
    res.json({
      success,
      data: {
        wallet: {
          balance.balance || 0,
          pendingBalance.pendingBalance || 0,
          totalEarned.totalEarned || 0,
          totalWithdrawn.totalWithdrawn || 0,
          availableBalance.availableBalance || 0
        },
        bookings: {
          totalSessions[0]?.totalSessions || 0,
          totalRevenue[0]?.totalRevenue || 0,
          totalCommission[0]?.totalCommission || 0,
          totalEarnings[0]?.totalEarnings || 0
        },
        payouts|| { totalPaid: 0, totalPending: 0, totalFailed: 0, count: 0, pendingCount: 0 },
        monthlyEarnings,
        nextPayoutDate,
        lastPayoutDate}
    });
  } catch (error) {
    if (error.message === 'Access denied. Please login first.' || error.message === 'Invalid or expired token.') {
      return res.status(401).json({ error.message });
    }
    console.error('Error in /overview:', error);
    res.status(500).json({ error.message });
  }
});

// Get commission breakdown
router.get('/commission/breakdown', async (req, res) => {
  try {
    const decoded = verifyToken(req);
    const therapistId = decoded.id || decoded._id;
    const { period = 'all' } = req.query;
    
    let dateFilter = {};
    if (period === 'month') {
      dateFilter = {
        scheduledDate: { $gteDate(new Date().setDate(1)) }
      };
    } else if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { scheduledDate: { $gte} };
    }
    
    const bookings = await MentalHealthBooking.find({
      therapistId,
      paymentStatus: 'paid',
      ...dateFilter
    }).sort({ scheduledDate: -1 });
    
    // Calculate totals
    let totalPatientAmount = 0;
    let totalCommission = 0;
    let totalTherapistEarnings = 0;
    
    bookings.forEach(b => {
      totalPatientAmount += b.patientAmount || 0;
      totalCommission += b.platformCommission || 0;
      totalTherapistEarnings += b.therapistEarning || 0;
    });
    
    res.json({
      success,
      data: {
        summary: {
          totalPatientAmount,
          totalCommission,
          totalTherapistEarnings,
          totalSessions.length,
          averageCommissionRate.length > 0 && totalPatientAmount > 0
            ? ((totalCommission / totalPatientAmount) * 100).toFixed(2)
            : 0
        },
        bookings.map(b => ({
          id._id,
          date.scheduledDate,
          amount.patientAmount || 0,
          commission.platformCommission || 0,
          rate.commissionRate || 0,
          earnings.therapistEarning || 0,
          paymentStatus.paymentStatus
        }))
      }
    });
  } catch (error) {
    if (error.message === 'Access denied. Please login first.' || error.message === 'Invalid or expired token.') {
      return res.status(401).json({ error.message });
    }
    console.error('Error in /commission/breakdown:', error);
    res.status(500).json({ error.message });
  }
});

// Get earnings report (for export)
router.get('/report', async (req, res) => {
  try {
    const decoded = verifyToken(req);
    const therapistId = decoded.id || decoded._id;
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate) dateFilter.scheduledDate = { $gteDate(startDate) };
    if (endDate) {
      dateFilter.scheduledDate = {
        ...dateFilter.scheduledDate,
        $lteDate(endDate)
      };
    }
    
    const bookings = await MentalHealthBooking.find({
      therapistId,
      paymentStatus: 'paid',
      ...dateFilter
    }).populate('patientId', 'name email phone')
      .sort({ scheduledDate: -1 });
    
    // Generate report data
    const reportData = bookings.map(b => ({
      bookingId._id,
      patientName.patientId?.name || 'Unknown',
      patientEmail.patientId?.email || '',
      date.scheduledDate,
      amount.patientAmount || 0,
      commission.platformCommission || 0,
      earnings.therapistEarning || 0,
      paymentStatus.paymentStatus,
      payoutStatus.payoutStatus
    }));
    
    // Calculate totals
    const totals = bookings.reduce((acc, b) => {
      acc.totalAmount += b.patientAmount || 0;
      acc.totalCommission += b.platformCommission || 0;
      acc.totalEarnings += b.therapistEarning || 0;
      return acc;
    }, { totalAmount: 0, totalCommission: 0, totalEarnings: 0 });
    
    res.json({
      success,
      data: {
        summary: {
          period: { startDate, endDate },
          totalSessions.length,
          ...totals
        },
        report}
    });
  } catch (error) {
    if (error.message === 'Access denied. Please login first.' || error.message === 'Invalid or expired token.') {
      return res.status(401).json({ error.message });
    }
    console.error('Error in /report:', error);
    res.status(500).json({ error.message });
  }
});

// Export report as CSV
router.get('/report/export', async (req, res) => {
  try {
    const decoded = verifyToken(req);
    const therapistId = decoded.id || decoded._id;
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate) dateFilter.scheduledDate = { $gteDate(startDate) };
    if (endDate) {
      dateFilter.scheduledDate = {
        ...dateFilter.scheduledDate,
        $lteDate(endDate)
      };
    }
    
    const bookings = await MentalHealthBooking.find({
      therapistId,
      paymentStatus: 'paid',
      ...dateFilter
    }).populate('patientId', 'name email')
      .sort({ scheduledDate: -1 });
    
    // Generate CSV
    const headers = ['Booking ID', 'Patient Name', 'Patient Email', 'Date', 'Amount', 'Commission', 'Earnings', 'Payment Status'];
    const rows = bookings.map(b => [
      b._id,
      b.patientId?.name || 'Unknown',
      b.patientId?.email || '',
      b.scheduledDate ? new Date(b.scheduledDate).toISOString().split('T')[0] : '',
      b.patientAmount || 0,
      b.platformCommission || 0,
      b.therapistEarning || 0,
      b.paymentStatus || 'unknown'
    ]);
    
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.join(',') + '\n';
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=earnings_report.csv');
    res.send(csvContent);
  } catch (error) {
    if (error.message === 'Access denied. Please login first.' || error.message === 'Invalid or expired token.') {
      return res.status(401).json({ error.message });
    }
    console.error('Error in /report/export:', error);
    res.status(500).json({ error.message });
  }
});

module.exports = router;


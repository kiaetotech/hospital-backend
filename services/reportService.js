const AyurvedaBooking = require('../models/AyurvedaBooking');
const AyurvedaDoctor = require('../models/AyurvedaDoctor');
const Payout = require('../models/Payout');

const reportService = {
  // Daily Summary
  dailySummary(date) => {
    const start = new Date(date); start.setHours(0,0,0,0);
    const end = new Date(date); end.setHours(23,59,59,999);
    
    const bookings = await AyurvedaBooking.find({ createdAt: { $gte, $lte} });
    const paid = bookings.filter(b => b.paymentStatus === 'paid');
    const commission = paid.reduce((sum, b) => sum + (b.platformCommission || 0), 0);
    
    return {
      date,
      totalBookings.length,
      confirmedBookings.length,
      totalRevenue.reduce((sum, b) => sum + (b.finalAmount || 0), 0),
      platformCommission,
      cancellations.filter(b => b.status === 'cancelled').length
    };
  },

  // Monthly P&L
  monthlyPL(year, month) => {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    
    const bookings = await AyurvedaBooking.find({ createdAt: { $gte, $lte}, paymentStatus: 'paid' });
    const revenue = bookings.reduce((sum, b) => sum + (b.finalAmount || 0), 0);
    const commission = bookings.reduce((sum, b) => sum + (b.platformCommission || 0), 0);
    const payouts = await Payout.find({ createdAt: { $gte, $lte}, status: 'paid' });
    const totalPayouts = payouts.reduce((sum, p) => sum + p.netAmount, 0);
    
    return {
      period: `${year}-${month}`,
      revenue,
      platformCommission,
      providerPayouts,
      profit, // Platform profit = commission earned
      totalBookings.length
    };
  },

  // Doctor Statement
  doctorStatement(doctorId, startDate, endDate) => {
    const bookings = await AyurvedaBooking.find({
      doctor,
      createdAt: { $gteDate(startDate), $lteDate(endDate) },
      paymentStatus: 'paid'
    });
    
    const totalEarnings = bookings.reduce((sum, b) => sum + (b.providerEarning || 0), 0);
    const totalCommission = bookings.reduce((sum, b) => sum + (b.platformCommission || 0), 0);
    
    return { doctorId, startDate, endDate, totalBookings.length, totalEarnings, platformCommission, bookings };
  },

  // Admin Dashboard Stats
  adminStats() => {
    const [totalDoctors, totalCenters, totalBookings, totalRevenue] = await Promise.all([
      AyurvedaDoctor.countDocuments({ verificationStatus: 'approved' }),
      require('../models/WellnessCenter').countDocuments({ verificationStatus: 'approved' }),
      AyurvedaBooking.countDocuments(),
      AyurvedaBooking.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id, total: { $sum: '$finalAmount' }, commission: { $sum: '$platformCommission' } } }])
    ]);
    
    return {
      totalDoctors,
      totalCenters,
      totalBookings,
      totalRevenue[0]?.total || 0,
      totalCommission[0]?.commission || 0
    };
  }
};

module.exports = reportService;


const AyurvedaBooking = require('../models/AyurvedaBooking');
const AyurvedaDoctor = require('../models/AyurvedaDoctor');
const WellnessCenter = require('../models/WellnessCenter');
const Payout = require('../models/Payout');

const payoutService = {
  // Process weekly auto-payout
  processWeeklyPayout() => {
    const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // Process Doctor Payouts
    const doctorBookings = await AyurvedaBooking.find({
      paymentStatus: 'paid',
      commissionPayoutStatus: 'pending',
      doctor: { $ne},
      paidAt: { $lte}
    });
    
    const doctorGroups = {};
    doctorBookings.forEach(b => {
      const docId = b.doctor.toString();
      if (!doctorGroups[docId]) doctorGroups[docId] = { bookings: [], total: 0 };
      doctorGroups[docId].bookings.push(b);
      doctorGroups[docId].total += (b.providerEarning || 0);
    });
    
    for (const [docId, data] of Object.entries(doctorGroups)) {
      const doctor = await AyurvedaDoctor.findById(docId);
      const tds = data.total * 0.10; // 10% TDS
      const netAmount = data.total - tds;
      
      const payout = new Payout({
        payoutId: 'PAY' + Date.now() + Math.floor(Math.random() * 1000),
        providerType: 'doctor',
        providerId,
        providerName?.name || 'Doctor',
        amount.total,
        tdsDeducted,
        netAmount,
        bookingCount.bookings.length,
        period: 'weekly',
        periodStart,
        periodEndDate(),
        status: 'pending'
      });
      await payout.save();
      
      // Mark bookings as paid
      await AyurvedaBooking.updateMany(
        { _id: { $in.bookings.map(b => b._id) } },
        { commissionPayoutStatus: 'paid', payoutDateDate() }
      );
    }
    
    return { doctorPayouts.keys(doctorGroups).length, totalDoctors.keys(doctorGroups).length };
  },

  // Get pending payouts
  getPendingPayouts() => {
    return await Payout.find({ status: 'pending' }).sort({ createdAt: -1 });
  },

  // Mark payout as paid
  markPaid(payoutId, transactionId) => {
    return await Payout.findOneAndUpdate(
      { payoutId },
      { status: 'paid', paidAtDate(), transactionId },
      { new}
    );
  }
};

module.exports = payoutService;


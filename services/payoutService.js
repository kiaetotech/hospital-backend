const AyurvedaBooking = require('../models/AyurvedaBooking');
const AyurvedaDoctor = require('../models/AyurvedaDoctor');
const WellnessCenter = require('../models/WellnessCenter');
const Payout = require('../models/Payout');

const payoutService = {
  // Process weekly auto-payout
  processWeeklyPayout: async () => {
    const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // Process Doctor Payouts
    const doctorBookings = await AyurvedaBooking.find({
      paymentStatus: 'paid',
      commissionPayoutStatus: 'pending',
      doctor: { $ne: null },
      paidAt: { $lte: oneWeekAgo }
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
        providerId: docId,
        providerName: doctor?.name || 'Doctor',
        amount: data.total,
        tdsDeducted: tds,
        netAmount,
        bookingCount: data.bookings.length,
        period: 'weekly',
        periodStart: oneWeekAgo,
        periodEnd: new Date(),
        status: 'pending'
      });
      await payout.save();
      
      // Mark bookings as paid
      await AyurvedaBooking.updateMany(
        { _id: { $in: data.bookings.map(b => b._id) } },
        { commissionPayoutStatus: 'paid', payoutDate: new Date() }
      );
    }
    
    return { doctorPayouts: Object.keys(doctorGroups).length, totalDoctors: Object.keys(doctorGroups).length };
  },

  // Get pending payouts
  getPendingPayouts: async () => {
    return await Payout.find({ status: 'pending' }).sort({ createdAt: -1 });
  },

  // Mark payout as paid
  markPaid: async (payoutId, transactionId) => {
    return await Payout.findOneAndUpdate(
      { payoutId },
      { status: 'paid', paidAt: new Date(), transactionId },
      { new: true }
    );
  }
};

module.exports = payoutService;
const AyurvedaBooking = require('../models/AyurvedaBooking');
const AyurvedaDoctor = require('../models/AyurvedaDoctor');
const WellnessCenter = require('../models/WellnessCenter');
const Payout = require('../models/Payout');

const payoutService = {
  // ============================================
  // PROCESS WEEKLY AUTO-PAYOUT (DOCTORS)
  // ============================================
  processWeeklyPayout: async () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const result = {
      doctorPayouts: 0,
      centerPayouts: 0,
      totalPayoutAmount: 0
    };
    
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
      if (!doctor) continue;
      
      const tds = data.total * 0.10; // 10% TDS
      const netAmount = data.total - tds;
      
      const payout = new Payout({
        payoutId: 'PAY' + Date.now() + Math.floor(Math.random() * 1000),
        providerType: 'ayurveda_doctor',
        providerId: docId,
        providerName: doctor.name || 'Doctor',
        amount: data.total,
        tdsDeducted: tds,
        netAmount,
        bookingCount: data.bookings.length,
        period: 'weekly',
        periodStart: oneWeekAgo,
        periodEnd: new Date(),
        status: 'pending',
        bookingIds: data.bookings.map(b => b._id)
      });
      await payout.save();
      
      await AyurvedaBooking.updateMany(
        { _id: { $in: data.bookings.map(b => b._id) } },
        { 
          commissionPayoutStatus: 'processing', 
          payoutDate: new Date(),
          settlementId: payout.payoutId
        }
      );
      
      result.doctorPayouts += 1;
      result.totalPayoutAmount += netAmount;
    }
    
    // Process Center Payouts
    const centerBookings = await AyurvedaBooking.find({
      paymentStatus: 'paid',
      commissionPayoutStatus: 'pending',
      center: { $ne: null },
      paidAt: { $lte: oneWeekAgo }
    });
    
    const centerGroups = {};
    centerBookings.forEach(b => {
      const centerId = b.center.toString();
      if (!centerGroups[centerId]) centerGroups[centerId] = { bookings: [], total: 0 };
      centerGroups[centerId].bookings.push(b);
      centerGroups[centerId].total += (b.providerEarning || 0);
    });
    
    for (const [centerId, data] of Object.entries(centerGroups)) {
      const center = await WellnessCenter.findById(centerId);
      if (!center) continue;
      
      const tds = data.total * 0.10; // 10% TDS
      const netAmount = data.total - tds;
      
      const payout = new Payout({
        payoutId: 'PAY' + Date.now() + Math.floor(Math.random() * 1000),
        providerType: 'wellness_center',
        providerId: centerId,
        providerName: center.name || 'Center',
        amount: data.total,
        tdsDeducted: tds,
        netAmount,
        bookingCount: data.bookings.length,
        period: 'weekly',
        periodStart: oneWeekAgo,
        periodEnd: new Date(),
        status: 'pending',
        bookingIds: data.bookings.map(b => b._id)
      });
      await payout.save();
      
      await AyurvedaBooking.updateMany(
        { _id: { $in: data.bookings.map(b => b._id) } },
        { 
          commissionPayoutStatus: 'processing', 
          payoutDate: new Date(),
          settlementId: payout.payoutId
        }
      );
      
      result.centerPayouts += 1;
      result.totalPayoutAmount += netAmount;
    }
    
    return result;
  },

  // ============================================
  // GET PROVIDER EARNINGS
  // ============================================
  getProviderEarnings: async (providerType, providerId) => {
    const query = {
      paymentStatus: 'paid',
      commissionPayoutStatus: { $in: ['pending', 'processing'] }
    };
    
    if (providerType === 'ayurveda_doctor') {
      query.doctor = providerId;
    } else if (providerType === 'wellness_center') {
      query.center = providerId;
    } else {
      throw new Error('Invalid provider type');
    }
    
    const bookings = await AyurvedaBooking.find(query)
      .select('bookingId finalAmount platformCommission providerEarning paidAt type')
      .sort({ paidAt: -1 });
    
    const totalEarnings = bookings.reduce((sum, b) => sum + (b.providerEarning || 0), 0);
    const totalCommission = bookings.reduce((sum, b) => sum + (b.platformCommission || 0), 0);
    const pendingPayout = bookings
      .filter(b => b.commissionPayoutStatus === 'pending')
      .reduce((sum, b) => sum + (b.providerEarning || 0), 0);
    
    return {
      providerType,
      providerId,
      totalBookings: bookings.length,
      totalEarnings,
      totalCommission,
      pendingPayout,
      bookings
    };
  },

  // ============================================
  // REQUEST MANUAL SETTLEMENT
  // ============================================
  requestSettlement: async (providerType, providerId) => {
    const query = {
      paymentStatus: 'paid',
      commissionPayoutStatus: 'pending'
    };
    
    if (providerType === 'ayurveda_doctor') {
      query.doctor = providerId;
    } else if (providerType === 'wellness_center') {
      query.center = providerId;
    } else {
      throw new Error('Invalid provider type');
    }
    
    const bookings = await AyurvedaBooking.find(query);
    
    if (bookings.length === 0) {
      throw new Error('No pending earnings to settle');
    }
    
    const totalAmount = bookings.reduce((sum, b) => sum + (b.providerEarning || 0), 0);
    const tds = totalAmount * 0.10;
    const netAmount = totalAmount - tds;
    
    let providerName = '';
    if (providerType === 'ayurveda_doctor') {
      const doctor = await AyurvedaDoctor.findById(providerId);
      providerName = doctor?.name || 'Doctor';
    } else {
      const center = await WellnessCenter.findById(providerId);
      providerName = center?.name || 'Center';
    }
    
    const payout = new Payout({
      payoutId: 'PAY' + Date.now() + Math.floor(Math.random() * 1000),
      providerType,
      providerId,
      providerName,
      amount: totalAmount,
      tdsDeducted: tds,
      netAmount,
      bookingCount: bookings.length,
      period: 'manual',
      periodStart: new Date(),
      periodEnd: new Date(),
      status: 'requested',
      bookingIds: bookings.map(b => b._id)
    });
    
    await payout.save();
    
    await AyurvedaBooking.updateMany(
      { _id: { $in: bookings.map(b => b._id) } },
      { 
        commissionPayoutStatus: 'processing',
        settlementRequestedAt: new Date(),
        settlementId: payout.payoutId
      }
    );
    
    return payout;
  },

  // ============================================
  // GET SETTLEMENT HISTORY
  // ============================================
  getSettlementHistory: async (providerType, providerId) => {
    const payouts = await Payout.find({
      providerType,
      providerId
    }).sort({ createdAt: -1 });
    
    return payouts;
  },

  // ============================================
  // GET PENDING PAYOUTS (ADMIN)
  // ============================================
  getPendingPayouts: async () => {
    return await Payout.find({ 
      status: { $in: ['pending', 'requested'] } 
    }).sort({ createdAt: -1 });
  },

  // ============================================
  // APPROVE PAYOUT (ADMIN)
  // ============================================
  approvePayout: async (payoutId, transactionId, adminNote) => {
    const payout = await Payout.findOneAndUpdate(
      { payoutId },
      { 
        status: 'approved',
        transactionId,
        adminNote,
        approvedAt: new Date()
      },
      { new: true }
    );
    
    if (!payout) {
      throw new Error('Payout not found');
    }
    
    // Mark bookings as paid
    if (payout.bookingIds && payout.bookingIds.length > 0) {
      await AyurvedaBooking.updateMany(
        { _id: { $in: payout.bookingIds } },
        { 
          commissionPayoutStatus: 'paid',
          payoutDate: new Date(),
          payoutTransactionId: transactionId,
          settledToProvider: true,
          settledAt: new Date()
        }
      );
    }
    
    return payout;
  },

  // ============================================
  // MARK PAYOUT AS PAID
  // ============================================
  markPaid: async (payoutId, transactionId) => {
    const payout = await Payout.findOneAndUpdate(
      { payoutId },
      { 
        status: 'paid', 
        paidAt: new Date(), 
        transactionId 
      },
      { new: true }
    );
    
    if (!payout) {
      throw new Error('Payout not found');
    }
    
    if (payout.bookingIds && payout.bookingIds.length > 0) {
      await AyurvedaBooking.updateMany(
        { _id: { $in: payout.bookingIds } },
        { 
          commissionPayoutStatus: 'paid',
          payoutDate: new Date(),
          payoutTransactionId: transactionId,
          settledToProvider: true,
          settledAt: new Date()
        }
      );
    }
    
    return payout;
  },

  // ============================================
  // REJECT PAYOUT (ADMIN)
  // ============================================
  rejectPayout: async (payoutId, reason) => {
    const payout = await Payout.findOneAndUpdate(
      { payoutId },
      { 
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date()
      },
      { new: true }
    );
    
    if (!payout) {
      throw new Error('Payout not found');
    }
    
    // Revert bookings to pending
    if (payout.bookingIds && payout.bookingIds.length > 0) {
      await AyurvedaBooking.updateMany(
        { _id: { $in: payout.bookingIds } },
        { 
          commissionPayoutStatus: 'pending',
          settlementId: null,
          settlementRequestedAt: null
        }
      );
    }
    
    return payout;
  }
};

module.exports = payoutService;
// D:\hospital backend\services\homeopathyPayoutService.js
const HomeopathyBooking = require('../models/HomeopathyBooking');
const HomeopathyDoctor = require('../models/HomeopathyDoctor');
const NaturopathyCenter = require('../models/NaturopathyCenter');
const Pharmacy = require('../models/Pharmacy');
const Payout = require('../models/Payout');
const { buildPayoutSnapshotFields } = require('./providerSnapshotService');
const tdsService = require('./tdsService');

const payoutService = {
  // ============================================
  // PROCESS WEEKLY AUTO-PAYOUT (DOCTORS + CENTERS + PHARMACIES)
  // ============================================
  processWeeklyPayout: async () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const result = {
      doctorPayouts: 0,
      centerPayouts: 0,
      pharmacyPayouts: 0,
      totalPayoutAmount: 0
    };

    // ─────────── DOCTOR PAYOUTS ───────────
    const doctorBookings = await HomeopathyBooking.find({
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
      const doctor = await HomeopathyDoctor.findById(docId);
      if (!doctor) continue;

      const tdsResult = await tdsService.calculate({
        serviceType: 'homeopathy_consultation',
        providerType: 'homeopathy_doctor',
        providerId: docId,
        payoutAmount: data.total,
        city: doctor.address?.city || null,
        state: doctor.address?.state || null
      });
      const tds = tdsResult.tds;
      const netAmount = data.total - tds;

      const snapshotFields = await buildPayoutSnapshotFields(
        'homeopathy_doctor',
        docId,
        doctor.name || 'Doctor'
      );

      const payout = new Payout({
        payoutId: 'PAY' + Date.now() + Math.floor(Math.random() * 1000),
        providerType: 'homeopathy_doctor',
        providerId: docId,
        amount: data.total,
        tdsDeducted: tds,
        netAmount,
        commissionDeducted: data.bookings.reduce(
          (sum, b) => sum + (b.platformCommission || 0), 0
        ),
        tdsSection: tdsResult.section,
        tdsConfigId: tdsResult.configId,
        tdsNote: tdsResult.reason,
        bookingCount: data.bookings.length,
        period: 'weekly',
        periodStart: oneWeekAgo,
        periodEnd: new Date(),
        status: 'pending',
        bookingIds: data.bookings.map(b => b._id),
        ...snapshotFields
      });
      await payout.save();

      await HomeopathyBooking.updateMany(
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

    // ─────────── CENTER PAYOUTS ───────────
    const centerBookings = await HomeopathyBooking.find({
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
      const center = await NaturopathyCenter.findById(centerId);
      if (!center) continue;

      const tdsResult = await tdsService.calculate({
        serviceType: 'naturopathy_center',
        providerType: 'naturopathy_center',
        providerId: centerId,
        payoutAmount: data.total,
        city: center.address?.city || null,
        state: center.address?.state || null
      });
      const tds = tdsResult.tds;
      const netAmount = data.total - tds;

      const snapshotFields = await buildPayoutSnapshotFields(
        'naturopathy_center',
        centerId,
        center.name || 'Center'
      );

      const payout = new Payout({
        payoutId: 'PAY' + Date.now() + Math.floor(Math.random() * 1000),
        providerType: 'naturopathy_center',
        providerId: centerId,
        amount: data.total,
        tdsDeducted: tds,
        netAmount,
        commissionDeducted: data.bookings.reduce(
          (sum, b) => sum + (b.platformCommission || 0), 0
        ),
        tdsSection: tdsResult.section,
        tdsConfigId: tdsResult.configId,
        tdsNote: tdsResult.reason,
        bookingCount: data.bookings.length,
        period: 'weekly',
        periodStart: oneWeekAgo,
        periodEnd: new Date(),
        status: 'pending',
        bookingIds: data.bookings.map(b => b._id),
        ...snapshotFields
      });
      await payout.save();

      await HomeopathyBooking.updateMany(
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

    // ─────────── PHARMACY PAYOUTS ───────────
    const pharmacyBookings = await HomeopathyBooking.find({
      paymentStatus: 'paid',
      commissionPayoutStatus: 'pending',
      pharmacy: { $ne: null },
      paidAt: { $lte: oneWeekAgo }
    });

    const pharmacyGroups = {};
    pharmacyBookings.forEach(b => {
      const pharmId = b.pharmacy.toString();
      if (!pharmacyGroups[pharmId]) pharmacyGroups[pharmId] = { bookings: [], total: 0 };
      pharmacyGroups[pharmId].bookings.push(b);
      pharmacyGroups[pharmId].total += (b.providerEarning || 0);
    });

    for (const [pharmId, data] of Object.entries(pharmacyGroups)) {
      const pharmacy = await Pharmacy.findById(pharmId);
      if (!pharmacy) continue;

      const tdsResult = await tdsService.calculate({
        serviceType: 'homeopathy_medicine',
        providerType: 'pharmacy',
        providerId: pharmId,
        payoutAmount: data.total,
        city: pharmacy.address?.city || null,
        state: pharmacy.address?.state || null
      });
      const tds = tdsResult.tds;
      const netAmount = data.total - tds;

      const snapshotFields = await buildPayoutSnapshotFields(
        'pharmacy',
        pharmId,
        pharmacy.businessName || 'Pharmacy'
      );

      const payout = new Payout({
        payoutId: 'PAY' + Date.now() + Math.floor(Math.random() * 1000),
        providerType: 'pharmacy',
        providerId: pharmId,
        amount: data.total,
        tdsDeducted: tds,
        netAmount,
        commissionDeducted: data.bookings.reduce(
          (sum, b) => sum + (b.platformCommission || 0), 0
        ),
        tdsSection: tdsResult.section,
        tdsConfigId: tdsResult.configId,
        tdsNote: tdsResult.reason,
        bookingCount: data.bookings.length,
        period: 'weekly',
        periodStart: oneWeekAgo,
        periodEnd: new Date(),
        status: 'pending',
        bookingIds: data.bookings.map(b => b._id),
        ...snapshotFields
      });
      await payout.save();

      await HomeopathyBooking.updateMany(
        { _id: { $in: data.bookings.map(b => b._id) } },
        {
          commissionPayoutStatus: 'processing',
          payoutDate: new Date(),
          settlementId: payout.payoutId
        }
      );

      result.pharmacyPayouts += 1;
      result.totalPayoutAmount += netAmount;
    }

    return result;
  },

  // ============================================
  // GET PROVIDER EARNINGS
  // ============================================
  getProviderEarnings: async (providerType, providerId) => {
    const baseQuery = { paymentStatus: 'paid' };

    if (providerType === 'homeopathy_doctor' || providerType === 'doctor') {
      baseQuery.doctor = providerId;
    } else if (providerType === 'naturopathy_center' || providerType === 'center') {
      baseQuery.center = providerId;
    } else if (providerType === 'pharmacy') {
      baseQuery.pharmacy = providerId;
    } else {
      throw new Error('Invalid provider type');
    }

    const bookings = await HomeopathyBooking.find(baseQuery)
      .select('bookingId finalAmount platformCommission providerEarning paidAt type paymentStatus status commissionPayoutStatus')
      .sort({ paidAt: -1 })
      .lean();

    const earningStatuses = ['completed', 'no_show', 'in_progress', 'confirmed'];

    const earningBookings = bookings.filter(b =>
      earningStatuses.includes(b.status) ||
      b.status === 'pending'
    );

    const totalEarnings = earningBookings.reduce(
      (sum, b) => sum + (b.providerEarning || 0), 0
    );
    const totalCommission = earningBookings.reduce(
      (sum, b) => sum + (b.platformCommission || 0), 0
    );

    const pendingPayout = bookings
      .filter(b =>
        b.commissionPayoutStatus !== 'paid' &&
        earningStatuses.includes(b.status)
      )
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

    if (providerType === 'homeopathy_doctor') {
      query.doctor = providerId;
    } else if (providerType === 'naturopathy_center') {
      query.center = providerId;
    } else if (providerType === 'pharmacy') {
      query.pharmacy = providerId;
    } else {
      throw new Error('Invalid provider type');
    }

    const bookings = await HomeopathyBooking.find(query);

    if (bookings.length === 0) {
      throw new Error('No pending earnings to settle');
    }

    const totalAmount = bookings.reduce((sum, b) => sum + (b.providerEarning || 0), 0);

    let serviceType = 'homeopathy_consultation';
    if (providerType === 'naturopathy_center') serviceType = 'naturopathy_center';
    else if (providerType === 'pharmacy') serviceType = 'homeopathy_medicine';

    const tdsResult = await tdsService.calculate({
      serviceType,
      providerType,
      providerId,
      payoutAmount: totalAmount
    });
    const tds = tdsResult.tds;
    const netAmount = totalAmount - tds;

    const snapshotFields = await buildPayoutSnapshotFields(providerType, providerId);

    const payout = new Payout({
      payoutId: 'PAY' + Date.now() + Math.floor(Math.random() * 1000),
      providerType,
      providerId,
      amount: totalAmount,
      tdsDeducted: tds,
      netAmount,
      commissionDeducted: bookings.reduce(
        (sum, b) => sum + (b.platformCommission || 0), 0
      ),
      tdsSection: tdsResult.section,
      tdsConfigId: tdsResult.configId,
      tdsNote: tdsResult.reason,
      bookingCount: bookings.length,
      period: 'manual',
      periodStart: new Date(),
      periodEnd: new Date(),
      status: 'requested',
      bookingIds: bookings.map(b => b._id),
      ...snapshotFields
    });

    await payout.save();

    await HomeopathyBooking.updateMany(
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
      status: { $in: ['pending', 'requested'] },
      providerType: { $in: ['homeopathy_doctor', 'naturopathy_center', 'pharmacy'] }
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

    if (payout.bookingIds && payout.bookingIds.length > 0) {
      await HomeopathyBooking.updateMany(
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
      await HomeopathyBooking.updateMany(
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

    if (payout.bookingIds && payout.bookingIds.length > 0) {
      await HomeopathyBooking.updateMany(
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
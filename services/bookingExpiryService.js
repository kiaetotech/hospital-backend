// D:\hospital backend\services\bookingExpiryService.js
// Auto-mark no-show for paid but unattended bookings (all tags)

const AyurvedaBooking = require('../models/AyurvedaBooking');
const WellnessCenter = require('../models/WellnessCenter');

const NO_SHOW_GRACE_HOURS = 2;
const BATCH_LIMIT = 200;

async function markAyurvedaNoShow() {
  const cutoffTime = new Date(Date.now() - NO_SHOW_GRACE_HOURS * 60 * 60 * 1000);
  const stale = await AyurvedaBooking.find({
    status: 'confirmed',
    paymentStatus: 'paid',
    bookingDate: { $lt: cutoffTime }
  }).limit(BATCH_LIMIT);

  let processed = 0, failed = 0;
  const details = [];

  for (const booking of stale) {
    try {
      const wasActiveBooking =
        booking.type === 'panchakarma_package' &&
        booking.center &&
        booking.package?.packageId;

      booking.status = 'no_show';
      booking.noShowAt = new Date();
      booking.noShowReason = `Auto-marked no-show after ${NO_SHOW_GRACE_HOURS}h grace period`;
      booking.cancellationReason = 'Auto no-show — patient did not attend';
      booking.statusHistory = booking.statusHistory || [];
      booking.statusHistory.push({
        status: 'no_show',
        timestamp: new Date(),
        note: 'Auto-marked as no-show by system',
        updatedBy: 'system'
      });
      await booking.save();

      if (wasActiveBooking) {
        try {
          await WellnessCenter.updateOne(
            { _id: booking.center, 'packages._id': booking.package.packageId },
            { $inc: { 'packages.$.currentBookings': -1 } }
          );
        } catch (e) { console.warn('[no-show] counter:', e.message); }
      }

      try {
        const smsService = require('../services/smsService');
        if (booking.patient?.phone) {
          await smsService.sendSMS(
            booking.patient.phone,
            `Your appointment on ${new Date(booking.bookingDate).toLocaleDateString()} was missed. Booking ${booking.bookingId} marked no-show. No refund applicable. - KiaetoCare`
          );
        }
      } catch (e) { /* SMS failures are non-fatal */ }

      processed++;
      details.push({ bookingId: booking.bookingId, action: 'marked_no_show', providerEarning: booking.providerEarning });
    } catch (err) {
      failed++;
      details.push({ bookingId: booking.bookingId, action: 'failed', error: err.message });
    }
  }
  return { tag: 'ayurveda', processed, failed, details };
}

async function markGenericBookingNoShow() {
  try {
    const Booking = require('../models/Booking');
    const cutoffTime = new Date(Date.now() - NO_SHOW_GRACE_HOURS * 60 * 60 * 1000);

    // Booking model uses `appointmentDate` or `bookingDate` depending on setup — try both
    const stale = await Booking.find({
      status: 'confirmed',
      paymentStatus: 'paid',
      $or: [
        { appointmentDate: { $lt: cutoffTime } },
        { bookingDate: { $lt: cutoffTime } }
      ]
    }).limit(BATCH_LIMIT);

    let processed = 0, failed = 0;
    for (const booking of stale) {
      try {
        booking.status = 'no_show';
        booking.noShowAt = new Date();
        booking.noShowReason = `Auto-marked after ${NO_SHOW_GRACE_HOURS}h grace`;
        booking.statusHistory = booking.statusHistory || [];
        booking.statusHistory.push({
          status: 'no_show',
          timestamp: new Date(),
          note: 'Auto-marked no-show by system',
          updatedBy: 'system'
        });
        await booking.save();
        processed++;
      } catch (err) {
        failed++;
      }
    }
    return { tag: 'generic', processed, failed };
  } catch (e) {
    return { tag: 'generic', processed: 0, failed: 0, error: e.message };
  }
}

async function processExpiredBookings() {
  const startTime = Date.now();
  const results = [];

  results.push(await markAyurvedaNoShow());
  results.push(await markGenericBookingNoShow());

  const totalProcessed = results.reduce((s, r) => s + r.processed, 0);
  const totalFailed = results.reduce((s, r) => s + r.failed, 0);
  const duration = Date.now() - startTime;

  console.log(`[no-show cron] ${totalProcessed} processed, ${totalFailed} failed in ${duration}ms`);

  return {
    success: true,
    processed: totalProcessed,
    failed: totalFailed,
    duration,
    breakdown: results
  };
}

module.exports = { processExpiredBookings, NO_SHOW_GRACE_HOURS };
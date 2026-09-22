/**
 * Booking Expiry Service
 * 
 * Runs on a schedule. Automatically marks lapsed bookings as no-show.
 * 
 * Rules:
 * - Booking date + 2 hours past
 * - Status is 'confirmed' (patient never cancelled, provider never completed)
 * - Payment is 'paid'
 * → Mark as no_show
 * → Decrement package counter
 * → Provider keeps earning
 * → Patient gets no refund
 * 
 * Runs every 15 minutes.
 */

const AyurvedaBooking = require('../models/AyurvedaBooking');
const WellnessCenter = require('../models/WellnessCenter');
const smsService = require('../services/smsService');

// Grace period after booking date before auto-marking no-show
const NO_SHOW_GRACE_HOURS = 2;

async function processExpiredBookings() {
  const startTime = Date.now();
  const cutoffTime = new Date(Date.now() - NO_SHOW_GRACE_HOURS * 60 * 60 * 1000);

  let processed = 0;
  let failed = 0;
  const details = [];

  try {
    // Find bookings that are past grace period but still confirmed
    const staleBookings = await AyurvedaBooking.find({
      status: 'confirmed',
      paymentStatus: 'paid',
      bookingDate: { $lt: cutoffTime }
    }).limit(200); // Batch limit — safe for large volumes

    console.log(`[bookingExpiry] Found ${staleBookings.length} stale bookings to process`);

    for (const booking of staleBookings) {
      try {
        const wasActiveBooking = 
          booking.type === 'panchakarma_package' &&
          booking.center &&
          booking.package?.packageId;

        // Update booking
        booking.status = 'no_show';
        booking.noShowAt = new Date();
        booking.noShowReason = `Auto-marked no-show after ${NO_SHOW_GRACE_HOURS}h grace period`;
        booking.cancellationReason = 'Auto no-show — patient did not attend';

        booking.statusHistory = booking.statusHistory || [];
        booking.statusHistory.push({
          status: 'no_show',
          timestamp: new Date(),
          note: `Auto-marked as no-show by system after grace period`,
          updatedBy: 'system'
        });

        await booking.save();

        // Decrement package counter
        if (wasActiveBooking) {
          try {
            await WellnessCenter.updateOne(
              {
                _id: booking.center,
                'packages._id': booking.package.packageId
              },
              { $inc: { 'packages.$.currentBookings': -1 } }
            );
          } catch (decErr) {
            console.error(`[bookingExpiry] Counter decrement failed for ${booking.bookingId}:`, decErr.message);
          }
        }

        // Notify patient (informational — no refund)
        try {
          if (booking.patient?.phone) {
            await smsService.sendSMS(
              booking.patient.phone,
              `Your appointment on ${new Date(booking.bookingDate).toLocaleDateString()} was missed. Booking ${booking.bookingId} has been marked as no-show. No refund applicable per policy. - KiaetoCare`
            );
          }
        } catch (smsErr) {
          console.warn(`[bookingExpiry] SMS failed for ${booking.bookingId}:`, smsErr.message);
        }

        processed++;
        details.push({
          bookingId: booking.bookingId,
          action: 'marked_no_show',
          providerEarning: booking.providerEarning
        });

      } catch (err) {
        failed++;
        console.error(`[bookingExpiry] Failed for ${booking.bookingId}:`, err.message);
        details.push({
          bookingId: booking.bookingId,
          action: 'failed',
          error: err.message
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[bookingExpiry] Complete in ${duration}ms — processed: ${processed}, failed: ${failed}`);

    return {
      success: true,
      processed,
      failed,
      duration,
      details
    };

  } catch (error) {
    console.error('[bookingExpiry] Fatal error:', error.message);
    return {
      success: false,
      error: error.message,
      processed,
      failed
    };
  }
}

module.exports = {
  processExpiredBookings,
  NO_SHOW_GRACE_HOURS
};
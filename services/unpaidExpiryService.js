// D:\hospital backend\services\unpaidExpiryService.js
// Cancel unpaid bookings after 30 min for ALL tags

const EXPIRY_MINUTES = 30;
const BATCH_LIMIT = 200;

async function releaseRedisLock(booking, prefix) {
  try {
    const redis = global.redisClient;
    if (!redis || redis.status !== 'ready') return false;

    const dateRaw = booking.bookingDate || booking.scheduledDate || booking.startDate || booking.appointmentDate;
    const slot = booking.slotTime || booking.appointmentTime;
    if (!dateRaw || !slot) return false;

    const dateStr = new Date(dateRaw).toISOString().split('T')[0];
    const providerKey = (booking.doctor || booking.center || booking.provider || booking.hospital)?.toString() || 'default';
    const lockKey = `slot-lock:${prefix}:${providerKey}:${dateStr}:${slot}`;

    await redis.del(lockKey);
    return true;
  } catch (err) {
    return false;
  }
}

async function decrementPackageCounter(booking) {
  if (booking.type !== 'panchakarma_package' && booking.type !== 'health_package') return false;
  try {
    const WellnessCenter = require('../models/WellnessCenter');
    if (booking.center && booking.package?.packageId) {
      await WellnessCenter.updateOne(
        { _id: booking.center, 'packages._id': booking.package.packageId },
        { $inc: { 'packages.$.currentBookings': -1 } }
      );
      return true;
    }
  } catch (err) { /* non-fatal */ }
  return false;
}

async function processModel({ Model, label, redisPrefix }) {
  const cutoff = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000);

  const stale = await Model.find({
    paymentStatus: { $in: ['pending', 'initiated'] },
    status: 'pending',
    createdAt: { $lt: cutoff }
  }).limit(BATCH_LIMIT);

  if (stale.length === 0) return { label, processed: 0, released: 0, counters: 0 };

  let released = 0, counters = 0;

  for (const booking of stale) {
    try {
      booking.status = 'cancelled';
      booking.cancelledAt = new Date();
      booking.cancellationReason = `Payment not completed within ${EXPIRY_MINUTES} minutes`;
      booking.paymentStatus = 'expired';
      booking.statusHistory = booking.statusHistory || [];
      booking.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date(),
        note: `Auto-cancelled: unpaid > ${EXPIRY_MINUTES} min`,
        updatedBy: 'system'
      });
      await booking.save();

      if (await releaseRedisLock(booking, redisPrefix)) released++;
      if (await decrementPackageCounter(booking)) counters++;

      console.log(`[unpaid-expiry:${label}] Cancelled ${booking.bookingId || booking._id}`);
    } catch (err) {
      console.error(`[unpaid-expiry:${label}] Failed ${booking.bookingId}:`, err.message);
    }
  }

  return { label, processed: stale.length, released, counters };
}

async function processUnpaidBookings() {
  const results = [];

  // Generic Booking (hospital/ambulance/lab/caregiver/online consult)
  try {
    const Booking = require('../models/Booking');
    results.push(await processModel({ Model: Booking, label: 'Booking', redisPrefix: 'booking' }));
  } catch (e) { console.warn('[unpaid] Booking missing:', e.message); }

  // AyurvedaBooking
  try {
    const AyurvedaBooking = require('../models/AyurvedaBooking');
    results.push(await processModel({ Model: AyurvedaBooking, label: 'Ayurveda', redisPrefix: 'ayurveda' }));
  } catch (e) { console.warn('[unpaid] AyurvedaBooking missing:', e.message); }

  // MentalHealthBooking
  try {
    const MH = require('../models/MentalHealthBooking');
    results.push(await processModel({ Model: MH, label: 'MentalHealth', redisPrefix: 'mentalhealth' }));
  } catch (e) { /* skip if missing */ }

  // DiagnosticsBooking
  try {
    const DB = require('../models/DiagnosticsBooking');
    results.push(await processModel({ Model: DB, label: 'Diagnostics', redisPrefix: 'diagnostics' }));
  } catch (e) { /* skip if missing */ }

  // CaregiverBooking
  try {
    const CB = require('../models/CaregiverBooking');
    results.push(await processModel({ Model: CB, label: 'Caregiver', redisPrefix: 'caregiver' }));
  } catch (e) { /* skip if missing */ }

  // HomeopathyBooking
  try {
    const HB = require('../models/HomeopathyBooking');
    results.push(await processModel({ Model: HB, label: 'Homeopathy', redisPrefix: 'homeopathy' }));
  } catch (e) { /* skip if missing */ }

  const totalProcessed = results.reduce((s, r) => s + r.processed, 0);
  const totalReleased = results.reduce((s, r) => s + r.released, 0);
  const totalCounters = results.reduce((s, r) => s + r.counters, 0);

  if (totalProcessed > 0) {
    console.log(`[unpaid-expiry] Cancelled ${totalProcessed} bookings (released ${totalReleased} slots, restored ${totalCounters} counters)`);
  }

  return {
    totalProcessed,
    totalReleased,
    totalCounters,
    breakdown: results.filter(r => r.processed > 0)
  };
}

module.exports = { processUnpaidBookings, EXPIRY_MINUTES };
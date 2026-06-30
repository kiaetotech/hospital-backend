const HospitalStatus = require('../models/HospitalStatus');
const Hospital = require('../models/Hospital');
const smsService = require('./smsService');
const notificationService = require('./notificationService');

// Status emoji mapping
const STATUS_EMOJI = {
  accepting: '🟢',
  limited: '🟡',
  full: '🔴',
  unknown: '❓'
};

// ============================================
// SEND WHATSAPP STATUS REQUEST TO HOSPITAL
// ============================================

const sendStatusRequest = async (hospitalId) => {
  try {
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital || !hospital.phone) return { success: false, error: 'Hospital not found' };

    const message = `🏥 *${hospital.name}* - Status Update\n\n` +
      `Tap your current patient acceptance status:\n\n` +
      `🟢 *ACCEPTING*\n` +
      `🟡 *LIMITED*\n` +
      `🔴 *FULL*\n\n` +
      `_Reply with just the emoji or word_`;

    await smsService.sendWhatsApp(hospital.phone, message);

    await HospitalStatus.updateOne(
      { hospitalId },
      { lastWhatsappSent: new Date() },
      { upsert: true }
    );

    return { success: true, message: 'Status request sent' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============================================
// PROCESS HOSPITAL WHATSAPP REPLY
// ============================================

const processStatusReply = async (hospitalPhone, replyText) => {
  try {
    // Find hospital by phone
    const hospital = await Hospital.findOne({ phone: hospitalPhone });
    if (!hospital) return { success: false, error: 'Hospital not found' };

    // Parse reply
    let status = 'unknown';
    const reply = replyText.trim().toLowerCase();

    if (reply.includes('🟢') || reply.includes('accepting') || reply === '1' || reply === 'yes') {
      status = 'accepting';
    } else if (reply.includes('🟡') || reply.includes('limited') || reply === '2' || reply === 'maybe') {
      status = 'limited';
    } else if (reply.includes('🔴') || reply.includes('full') || reply === '3' || reply === 'no') {
      status = 'full';
    }

    await HospitalStatus.updateOne(
      { hospitalId: hospital._id },
      {
        status,
        updatedAt: new Date(),
        updatedVia: 'whatsapp',
        lastResponseReceived: new Date(),
        $inc: { responseCount: 1, streakCount: 1 }
      },
      { upsert: true }
    );

    // Send confirmation
    const emoji = STATUS_EMOJI[status];
    await smsService.sendWhatsApp(hospitalPhone, 
      `${emoji} Status updated to *${status.toUpperCase()}*\nUpdated: ${new Date().toLocaleTimeString('en-IN')}\nThank you!`
    );

    return { success: true, status, hospitalId: hospital._id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============================================
// AUTO-SEND STATUS REQUESTS AT SCHEDULED TIMES
// ============================================

const sendScheduledRequests = async () => {
  const now = new Date();
  const hour = now.getHours();

  // Send at 8 AM, 2 PM, 8 PM
  if (hour === 8 || hour === 14 || hour === 20) {
    const hospitals = await Hospital.find({ isVerified: true, isActive: true });
    
    let sent = 0;
    for (const hospital of hospitals) {
      const existing = await HospitalStatus.findOne({ hospitalId: hospital._id });
      
      // Skip if updated in last 3 hours
      if (existing && existing.updatedAt > new Date(now - 3 * 60 * 60 * 1000)) {
        continue;
      }

      await sendStatusRequest(hospital._id);
      sent++;
      // Rate limit: 1 message per second
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`📱 Sent ${sent} hospital status requests`);
    return { success: true, sent };
  }
  return { success: true, sent: 0, message: 'Not scheduled time' };
};

// ============================================
// AUTO-EXPIRE STALE STATUS
// ============================================

const expireStaleStatuses = async () => {
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

  const result = await HospitalStatus.updateMany(
    {
      updatedAt: { $lt: fourHoursAgo },
      status: { $ne: 'unknown' },
      updatedVia: { $ne: 'booking' }
    },
    {
      $set: { status: 'unknown' },
      $inc: { streakCount: -1 }
    }
  );

  if (result.modifiedCount > 0) {
    console.log(`⚠️ Expired ${result.modifiedCount} stale hospital statuses`);
  }
  return { success: true, expired: result.modifiedCount };
};

// ============================================
// GET HOSPITAL STATUS (FOR CARD DISPLAY)
// ============================================

const getHospitalStatus = async (hospitalId) => {
  const status = await HospitalStatus.findOne({ hospitalId });
  
  if (!status) {
    return { status: 'unknown', updatedAt: null, isStale: true };
  }

  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const isStale = status.updatedAt < fourHoursAgo && status.updatedVia !== 'booking';

  return {
    status: isStale ? 'unknown' : status.status,
    updatedAt: status.updatedAt,
    updatedVia: status.updatedVia,
    isStale,
    emoji: STATUS_EMOJI[isStale ? 'unknown' : status.status],
    label: isStale ? 'Status Unverified' : status.status.toUpperCase()
  };
};

// ============================================
// GET BULK STATUSES (FOR SEARCH RESULTS)
// ============================================

const getBulkStatuses = async (hospitalIds) => {
  const statuses = await HospitalStatus.find({
    hospitalId: { $in: hospitalIds }
  });

  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

  const statusMap = {};
  hospitalIds.forEach(id => {
    const found = statuses.find(s => s.hospitalId.toString() === id.toString());
    const isStale = !found || found.updatedAt < fourHoursAgo;
    statusMap[id] = {
      status: isStale ? 'unknown' : found.status,
      updatedAt: found?.updatedAt || null,
      isStale
    };
  });

  return statusMap;
};

// ============================================
// AUTO-UPDATE FROM BOOKINGS (₹0)
// ============================================

const updateFromBooking = async (hospitalId, bookingType) => {
  try {
    // When admission booked → hospital is accepting
    if (bookingType === 'admission') {
      await HospitalStatus.updateOne(
        { hospitalId },
        {
          status: 'accepting',
          updatedAt: new Date(),
          updatedVia: 'booking'
        },
        { upsert: true }
      );
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendStatusRequest,
  processStatusReply,
  sendScheduledRequests,
  expireStaleStatuses,
  getHospitalStatus,
  getBulkStatuses,
  updateFromBooking,
  STATUS_EMOJI
};
// ============================================
// SMART FOLLOW-UP SCHEDULER SERVICE
// ============================================
// Auto-sends follow-up reminders to patients
// Run via cron job or setInterval
// ============================================

const OnlineDoctor = require('../models/OnlineDoctor');
const Booking = require('../models/Booking');
const notificationService = require('./notificationService');
const smsService = require('./smsService');

// Configuration
const CONFIG = {
  // Days after consultation to send first reminder
  firstReminderDays: 2,
  // Days after consultation to send second reminder
  secondReminderDays: 4,
  // Days after consultation to send final reminder
  finalReminderDays: 6,
  // Follow-up window closes after these many days
  followUpWindowDays: 7,
  // Batch size for processing
  batchSize: 50
};

/**
 * Main scheduler function — call this every hour or daily
 */
const processFollowUpReminders = async () => {
  console.log('🔄 [Scheduler] Starting follow-up reminder check...');
  const now = new Date();
  let remindersSent = 0;
  let errors = 0;

  try {
    // ============================================
    // FIRST REMINDER: Day 2 after consultation
    // ============================================
    const firstReminderDate = new Date(now);
    firstReminderDate.setDate(firstReminderDate.getDate() - CONFIG.firstReminderDays);
    
    const firstReminderStart = new Date(firstReminderDate);
    firstReminderStart.setHours(0, 0, 0, 0);
    const firstReminderEnd = new Date(firstReminderDate);
    firstReminderEnd.setHours(23, 59, 59, 999);

    const firstReminderConsults = await Booking.find({
      bookingType: 'online_consult',
      status: 'completed',
      completedAt: { $gte: firstReminderStart, $lte: firstReminderEnd },
      followUpReminders: { $not: { $elemMatch: { type: 'first' } } }
    }).limit(CONFIG.batchSize);

    for (const consult of firstReminderConsults) {
      try {
        await sendReminder(consult, 'first');
        remindersSent++;
      } catch (err) {
        console.error(`Error sending first reminder for booking ${consult._id}:`, err.message);
        errors++;
      }
    }

    // ============================================
    // SECOND REMINDER: Day 4 after consultation
    // ============================================
    const secondReminderDate = new Date(now);
    secondReminderDate.setDate(secondReminderDate.getDate() - CONFIG.secondReminderDays);
    
    const secondReminderStart = new Date(secondReminderDate);
    secondReminderStart.setHours(0, 0, 0, 0);
    const secondReminderEnd = new Date(secondReminderDate);
    secondReminderEnd.setHours(23, 59, 59, 999);

    const secondReminderConsults = await Booking.find({
      bookingType: 'online_consult',
      status: 'completed',
      completedAt: { $gte: secondReminderStart, $lte: secondReminderEnd },
      followUpReminders: { $elemMatch: { type: 'first' } },
      followUpReminders: { $not: { $elemMatch: { type: 'second' } } },
      // Only remind if patient hasn't booked follow-up yet
      $or: [
        { followUpBooked: { $exists: false } },
        { followUpBooked: false }
      ]
    }).limit(CONFIG.batchSize);

    for (const consult of secondReminderConsults) {
      try {
        await sendReminder(consult, 'second');
        remindersSent++;
      } catch (err) {
        console.error(`Error sending second reminder for booking ${consult._id}:`, err.message);
        errors++;
      }
    }

    // ============================================
    // FINAL REMINDER: Day 6 after consultation
    // ============================================
    const finalReminderDate = new Date(now);
    finalReminderDate.setDate(finalReminderDate.getDate() - CONFIG.finalReminderDays);
    
    const finalReminderStart = new Date(finalReminderDate);
    finalReminderStart.setHours(0, 0, 0, 0);
    const finalReminderEnd = new Date(finalReminderDate);
    finalReminderEnd.setHours(23, 59, 59, 999);

    const finalReminderConsults = await Booking.find({
      bookingType: 'online_consult',
      status: 'completed',
      completedAt: { $gte: finalReminderStart, $lte: finalReminderEnd },
      followUpReminders: { $elemMatch: { type: 'second' } },
      followUpReminders: { $not: { $elemMatch: { type: 'final' } } },
      $or: [
        { followUpBooked: { $exists: false } },
        { followUpBooked: false }
      ]
    }).limit(CONFIG.batchSize);

    for (const consult of finalReminderConsults) {
      try {
        await sendReminder(consult, 'final');
        remindersSent++;
      } catch (err) {
        console.error(`Error sending final reminder for booking ${consult._id}:`, err.message);
        errors++;
      }
    }

    console.log(`✅ [Scheduler] Done. Sent: ${remindersSent}, Errors: ${errors}`);
    
    return {
      success: true,
      remindersSent,
      errors,
      timestamp: now
    };

  } catch (error) {
    console.error('❌ [Scheduler] Error:', error);
    return {
      success: false,
      error: error.message,
      timestamp: now
    };
  }
};

/**
 * Send reminder notification to patient
 */
const sendReminder = async (consult, reminderType) => {
  const doctor = await OnlineDoctor.findById(consult.doctorId);
  if (!doctor) throw new Error('Doctor not found');

  const patientPhone = consult.patientPhone;
  const patientName = consult.patientName || 'Patient';
  const doctorName = doctor.name;
  const followUpFee = doctor.followUpFee || doctor.consultationFee;
  const frontendUrl = process.env.FRONTEND_URL || 'https://hospital-frontend-kiaeto.vercel.app';
  const bookingUrl = `${frontendUrl}/online-doctor/book/${doctor._id}`;

  let message = '';
  let reminderData = { type: reminderType, sentAt: new Date() };

  switch (reminderType) {
    case 'first':
      message = `Hi ${patientName}, Dr. ${doctorName} hopes you're feeling better! How are you doing? Book a follow-up at ₹${followUpFee}: ${bookingUrl}`;
      reminderData.label = 'First follow-up reminder';
      break;

    case 'second':
      message = `Reminder: Dr. ${doctorName} recommends a follow-up check. Don't miss your recovery check. Follow-up at ₹${followUpFee}: ${bookingUrl}`;
      reminderData.label = 'Second follow-up reminder';
      break;

    case 'final':
      message = `Last chance! Dr. ${doctorName}'s follow-up window closes tomorrow. Book now at ₹${followUpFee}: ${bookingUrl}`;
      reminderData.label = 'Final follow-up reminder';
      break;

    default:
      message = `Dr. ${doctorName} recommends a follow-up consultation. Book now: ${bookingUrl}`;
      reminderData.label = 'Follow-up reminder';
  }

  // Send SMS
  if (patientPhone) {
    try {
      await smsService.send({
        to: patientPhone,
        message
      });
      reminderData.smsSent = true;
    } catch (err) {
      console.error('SMS failed:', err.message);
      reminderData.smsSent = false;
    }
  }

  // Send in-app notification
  try {
    await notificationService.create({
      userId: consult.userId,
      type: 'follow_up_reminder',
      title: `Follow-up with Dr. ${doctorName}`,
      message,
      data: {
        bookingId: consult._id,
        doctorId: doctor._id,
        reminderType,
        bookingUrl
      }
    });
    reminderData.notificationSent = true;
  } catch (err) {
    console.error('Notification failed:', err.message);
    reminderData.notificationSent = false;
  }

  // Update booking with reminder record
  await Booking.findByIdAndUpdate(consult._id, {
    $push: { followUpReminders: reminderData }
  });
};

/**
 * Mark follow-up as booked
 */
const markFollowUpBooked = async (bookingId) => {
  await Booking.findByIdAndUpdate(bookingId, {
    followUpBooked: true,
    followUpBookedAt: new Date()
  });
};

/**
 * Manual trigger — for admin/testing
 */
const triggerManualReminder = async (bookingId) => {
  const consult = await Booking.findById(bookingId);
  if (!consult) throw new Error('Booking not found');
  
  await sendReminder(consult, 'manual');
  return { success: true, message: 'Reminder sent manually' };
};

/**
 * Get reminder stats
 */
const getReminderStats = async () => {
  const totalCompleted = await Booking.countDocuments({
    bookingType: 'online_consult',
    status: 'completed'
  });

  const withFollowUp = await Booking.countDocuments({
    bookingType: 'online_consult',
    status: 'completed',
    followUpBooked: true
  });

  const remindedCount = await Booking.countDocuments({
    bookingType: 'online_consult',
    status: 'completed',
    followUpReminders: { $exists: true, $not: { $size: 0 } }
  });

  return {
    totalCompletedConsults: totalCompleted,
    followUpsBooked: withFollowUp,
    followUpRate: totalCompleted > 0 ? Math.round((withFollowUp / totalCompleted) * 100) : 0,
    remindersSent: remindedCount
  };
};

module.exports = {
  processFollowUpReminders,
  sendReminder,
  markFollowUpBooked,
  triggerManualReminder,
  getReminderStats,
  CONFIG
};
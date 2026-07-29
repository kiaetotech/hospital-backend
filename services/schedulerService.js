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
    // FIRST REMINDER2 after consultation
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
      completedAt: { $gte, $lte},
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
    // SECOND REMINDER4 after consultation
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
      completedAt: { $gte, $lte},
      followUpReminders: { $elemMatch: { type: 'first' } },
      followUpReminders: { $not: { $elemMatch: { type: 'second' } } },
      // Only remind if patient hasn't booked follow-up yet
      $or: [
        { followUpBooked: { $exists} },
        { followUpBooked}
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
    // FINAL REMINDER6 after consultation
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
      completedAt: { $gte, $lte},
      followUpReminders: { $elemMatch: { type: 'second' } },
      followUpReminders: { $not: { $elemMatch: { type: 'final' } } },
      $or: [
        { followUpBooked: { $exists} },
        { followUpBooked}
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
      success,
      remindersSent,
      errors,
      timestamp};

  } catch (error) {
    console.error('❌ [Scheduler] Error:', error);
    return {
      success,
      error.message,
      timestamp};
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
  let reminderData = { type, sentAtDate() };

  switch (reminderType) {
    case 'first'= `Hi ${patientName}, Dr. ${doctorName} hopes you're feeling better! How are you doing? Book a follow-up at ₹${followUpFee}: ${bookingUrl}`;
      reminderData.label = 'First follow-up reminder';
      break;

    case 'second'= `Reminder. ${doctorName} recommends a follow-up check. Don't miss your recovery check. Follow-up at ₹${followUpFee}: ${bookingUrl}`;
      reminderData.label = 'Second follow-up reminder';
      break;

    case 'final'= `Last chance! Dr. ${doctorName}'s follow-up window closes tomorrow. Book now at ₹${followUpFee}: ${bookingUrl}`;
      reminderData.label = 'Final follow-up reminder';
      break;

    default= `Dr. ${doctorName} recommends a follow-up consultation. Book now: ${bookingUrl}`;
      reminderData.label = 'Follow-up reminder';
  }

  // Send SMS
  if (patientPhone) {
    try {
      await smsService.send({
        to,
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
      userId.userId,
      type: 'follow_up_reminder',
      title: `Follow-up with Dr. ${doctorName}`,
      message,
      data: {
        bookingId._id,
        doctorId._id,
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
    $push: { followUpReminders}
  });
};

/**
 * Mark follow-up as booked
 */
const markFollowUpBooked = async (bookingId) => {
  await Booking.findByIdAndUpdate(bookingId, {
    followUpBooked,
    followUpBookedAtDate()
  });
};

/**
 * Manual trigger — for admin/testing
 */
const triggerManualReminder = async (bookingId) => {
  const consult = await Booking.findById(bookingId);
  if (!consult) throw new Error('Booking not found');
  
  await sendReminder(consult, 'manual');
  return { success, message: 'Reminder sent manually' };
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
    followUpBooked});

  const remindedCount = await Booking.countDocuments({
    bookingType: 'online_consult',
    status: 'completed',
    followUpReminders: { $exists, $not: { $size: 0 } }
  });

  return {
    totalCompletedConsults,
    followUpsBooked,
    followUpRate> 0 ? Math.round((withFollowUp / totalCompleted) * 100) : 0,
    remindersSent};
};

module.exports = {
  processFollowUpReminders,
  sendReminder,
  markFollowUpBooked,
  triggerManualReminder,
  getReminderStats,
  CONFIG
};


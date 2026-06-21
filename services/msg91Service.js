const axios = require('axios');
// const twilio = require('twilio');  // COMMENTED OUT - Not needed in console mode

const PROVIDER = process.env.SMS_PROVIDER || 'console';
const NODE_ENV = process.env.NODE_ENV || 'development';

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_SENDER_ID = process.env.MSG91_SENDER_ID || 'KIAETO';
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;
const MSG91_FLOW_ID = process.env.MSG91_FLOW_ID;

const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_SENDER_ID = process.env.GUPSHUP_SENDER_ID || 'KIAETO';

// Twilio config (disabled - only used if you set up Twilio)
// const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
// const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
// const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// let twilioClient = null;
// if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
//   twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
// }

const otpStore = new Map();

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const saveOTP = (mobile, otp) => {
  otpStore.set(mobile, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    maxAttempts: 5
  });
  setTimeout(() => otpStore.delete(mobile), 10 * 60 * 1000);
};

const verifyOTP = (mobile, otp) => {
  const record = otpStore.get(mobile);
  if (!record) {
    return { valid: false, reason: 'OTP expired or not found' };
  }
  if (record.expiresAt < Date.now()) {
    otpStore.delete(mobile);
    return { valid: false, reason: 'OTP expired' };
  }
  if (record.attempts >= record.maxAttempts) {
    otpStore.delete(mobile);
    return { valid: false, reason: 'Too many failed attempts' };
  }
  if (record.otp === otp) {
    otpStore.delete(mobile);
    return { valid: true };
  }
  record.attempts += 1;
  return { valid: false, reason: 'Invalid OTP', attemptsLeft: record.maxAttempts - record.attempts };
};

const sendViaMSG91 = async (to, message) => {
  try {
    const response = await axios.post(
      'https://api.msg91.com/api/v5/flow/',
      {
        sender: MSG91_SENDER_ID,
        mobiles: to,
        template_id: MSG91_TEMPLATE_ID,
        flow_id: MSG91_FLOW_ID,
        var: message
      },
      {
        headers: {
          'authkey': MSG91_AUTH_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    return { success: true, provider: 'MSG91', sid: response.data?.request_id };
  } catch (error) {
    console.error('MSG91 Error:', error.response?.data || error.message);
    throw error;
  }
};

const sendViaGupshup = async (to, message) => {
  try {
    const response = await axios.post(
      'https://api.gupshup.io/wa/api/v1/msg',
      {
        channel: 'SMS',
        source: GUPSHUP_SENDER_ID,
        destination: to,
        message: message,
        messageType: 'TEXT'
      },
      {
        headers: {
          'apikey': GUPSHUP_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return { success: true, provider: 'Gupshup', sid: response.data?.messageId };
  } catch (error) {
    console.error('Gupshup Error:', error.response?.data || error.message);
    throw error;
  }
};

// Twilio is disabled - only used as fallback if configured
const sendViaTwilio = async (to, message) => {
  console.log(`📱 [TWILIO DISABLED] To: ${to}, Message: ${message}`);
  return { success: true, fallback: true, provider: 'twilio_disabled' };
};

const sendSMS = async (to, message) => {
  if (NODE_ENV === 'development' && !process.env.SMS_PROVIDER) {
    console.log(`📱 [DEV] To: ${to}, Message: ${message}`);
    return { success: true, fallback: true, provider: 'console' };
  }

  const provider = PROVIDER.toLowerCase();

  try {
    switch (provider) {
      case 'msg91':
        return await sendViaMSG91(to, message);
      case 'gupshup':
        return await sendViaGupshup(to, message);
      case 'twilio':
        return await sendViaTwilio(to, message);
      default:
        console.log(`📱 [FALLBACK] To: ${to}, Message: ${message}`);
        return { success: true, fallback: true, provider: 'console' };
    }
  } catch (error) {
    console.error(`SMS failed via ${provider}:`, error.message);
    return { success: false, error: error.message };
  }
};

const sendOTP = async (mobile, messagePrefix = 'Your KiaetoCare OTP is') => {
  const otp = generateOTP();
  saveOTP(mobile, otp);
  const message = `${messagePrefix} ${otp}. Valid for 10 minutes. - KiaetoCare`;
  const result = await sendSMS(mobile, message);
  return {
    ...result,
    otp,
    expiresIn: '10 minutes'
  };
};

// ============================================
// 🆕 AYURVEDA NOTIFICATION METHODS
// ============================================

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hospital-frontend-kiaeto.vercel.app';

// Patient: Booking confirmation
const sendBookingConfirmation = async (phone, bookingData) => {
  const message = `Booking Confirmed! Dr. ${bookingData.doctorName}, Date: ${new Date(bookingData.date).toLocaleDateString('en-IN')}, Time: ${bookingData.time}. ID: ${bookingData.bookingId}. - Ayurveda Wellness Hub`;
  return await sendSMS(phone, message);
};

// Patient: Payment received
const sendPaymentConfirmation = async (phone, amount, bookingId) => {
  const message = `Payment of Rs.${amount} received for booking ${bookingId}. Your consultation is confirmed. - Ayurveda Wellness Hub`;
  return await sendSMS(phone, message);
};

// Doctor: New booking alert
const sendDoctorNewBookingAlert = async (phone, patientName, date, time) => {
  const message = `New Booking! Patient: ${patientName}, Date: ${new Date(date).toLocaleDateString('en-IN')}, Time: ${time}. Check dashboard. - Ayurveda Wellness Hub`;
  return await sendSMS(phone, message);
};

// Doctor/Center: Verification approved
const sendVerificationApproved = async (phone, name) => {
  const message = `Congratulations ${name}! Your profile has been verified and is now live on Ayurveda Wellness Hub. Start receiving patients!`;
  return await sendSMS(phone, message);
};

// Doctor/Center: Verification rejected
const sendVerificationRejected = async (phone, reason) => {
  const message = `Your verification was not approved. Reason: ${reason || 'Documents incomplete'}. Please re-submit. - Ayurveda Wellness Hub`;
  return await sendSMS(phone, message);
};

// Center: New package booking
const sendCenterBookingAlert = async (phone, patientName, packageName, date) => {
  const message = `New Panchakarma Booking! Patient: ${patientName}, Package: ${packageName}, Date: ${new Date(date).toLocaleDateString('en-IN')}. - Ayurveda Wellness Hub`;
  return await sendSMS(phone, message);
};

// Patient: Booking reminder (1 hour before)
const sendBookingReminder = async (phone, doctorName, time) => {
  const message = `Reminder: Your consultation with Dr. ${doctorName} is at ${time} today. Please be on time. - Ayurveda Wellness Hub`;
  return await sendSMS(phone, message);
};

// Patient: Review request (after consultation)
const sendReviewRequest = async (phone, bookingId, doctorName) => {
  const message = `How was your consultation with Dr. ${doctorName}? Share feedback: ${FRONTEND_URL}/ayurveda/review/${bookingId}`;
  return await sendSMS(phone, message);
};

// Doctor/Center: Payout processed
const sendPayoutNotification = async (phone, amount) => {
  const message = `Your payout of Rs.${amount} has been processed. Will be credited within 2-3 business days. - Ayurveda Wellness Hub`;
  return await sendSMS(phone, message);
};

// Patient: Prescription ready
const sendPrescriptionReady = async (phone, doctorName) => {
  const message = `Your e-prescription from Dr. ${doctorName} is ready. View it in My Bookings. - Ayurveda Wellness Hub`;
  return await sendSMS(phone, message);
};

// Welcome message for new doctor/center registration
const sendWelcomeRegistration = async (phone, name, type) => {
  const message = `Welcome ${name}! Your ${type} registration is submitted. We will verify your documents within 24-48 hours. - Ayurveda Wellness Hub`;
  return await sendSMS(phone, message);
};

module.exports = {
  // Existing exports (DO NOT DELETE)
  sendSMS,
  sendOTP,
  generateOTP,
  saveOTP,
  verifyOTP,
  otpStore,
  
  // 🆕 Ayurveda notification exports
  sendBookingConfirmation,
  sendPaymentConfirmation,
  sendDoctorNewBookingAlert,
  sendVerificationApproved,
  sendVerificationRejected,
  sendCenterBookingAlert,
  sendBookingReminder,
  sendReviewRequest,
  sendPayoutNotification,
  sendPrescriptionReady,
  sendWelcomeRegistration
};
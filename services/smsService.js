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

// ============================================
// YOUR EXISTING OTP STORE (PRESERVED)
// ============================================

const otpStore = new Map();

// ============================================
// YOUR EXISTING FUNCTIONS (PRESERVED)
// ============================================

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

// ============================================
// YOUR EXISTING SMS PROVIDER FUNCTIONS (PRESERVED)
// ============================================

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

// ============================================
// YOUR EXISTING sendSMS FUNCTION (PRESERVED)
// ============================================

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

// ============================================
// YOUR EXISTING sendOTP FUNCTION (PRESERVED)
// ============================================

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
// NEW FUNCTIONS FOR INSURANCE (ADDED)
// ============================================

/**
 * Send OTP with type-specific message
 * @param {string} mobile - Phone number
 * @param {string} type - OTP type (insurance_application, login, registration, etc.)
 * @param {string} customMessage - Optional custom message
 * @returns {Promise<Object>}
 */
const sendOTPWithType = async (mobile, type = 'verification', customMessage = null) => {
  const otp = generateOTP();
  saveOTP(mobile, otp);

  // OTP message templates for different types
  const templates = {
    login: 'Your login OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    registration: 'Your registration OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    password_reset: 'Your password reset OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    verification: 'Your verification OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    two_factor: 'Your 2FA OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    
    // Healthcare Services
    hospital_booking: 'Your hospital booking OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    ambulance_booking: 'Your ambulance booking OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    labtest_booking: 'Your lab test booking OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    caregiver_booking: 'Your caregiver booking OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    ayurveda_consultation: 'Your Ayurveda consultation OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    homeopathy_consult: 'Your Homeopathy consultation OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    
    // Insurance
    insurance_application: 'Your insurance application OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    insurance_claim: 'Your insurance claim OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    policy_issue: 'Your policy issue OTP is {otp}. Valid for 10 minutes. - KiaetoCare'
  };

  // Get template message or use custom message
  let message = customMessage || templates[type] || templates.verification;
  message = message.replace('{otp}', otp);

  const result = await sendSMS(mobile, message);
  return {
    ...result,
    otp,
    type,
    expiresIn: '10 minutes'
  };
};

/**
 * Send Insurance-specific SMS notifications
 * @param {string} mobile - Phone number
 * @param {string} template - Template name
 * @param {Object} data - Data to replace in template
 * @returns {Promise<Object>}
 */
const sendInsuranceSMS = async (mobile, template, data = {}) => {
  const templates = {
    policy_issued: 'Your insurance policy {policyNumber} has been issued. Premium: ₹{premium}. Valid till {endDate}. - KiaetoCare',
    policy_cancelled: 'Your insurance policy {policyNumber} has been cancelled. Refund: ₹{refundAmount}. - KiaetoCare',
    policy_expiring: 'Reminder: Your policy {policyNumber} expires on {endDate}. Renew now to continue coverage. - KiaetoCare',
    claim_approved: 'Your claim {claimId} has been approved for ₹{amount}. - KiaetoCare',
    claim_rejected: 'Your claim {claimId} has been rejected. Reason: {reason}. - KiaetoCare',
    claim_submitted: 'Your claim {claimId} for ₹{amount} has been submitted successfully. - KiaetoCare',
    payment_confirmation: 'Payment of ₹{amount} received for policy {policyNumber}. Policy is now active. - KiaetoCare',
    renewal_reminder: '⏰ Reminder: Your policy {policyNumber} is expiring on {endDate}. Renew now to avoid coverage gap. - KiaetoCare',
    welcome: 'Welcome to KiaetoCare Insurance! Your policy {policyNumber} is active. Need help? Call us anytime. - KiaetoCare',
    document_uploaded: 'Your insurance document for policy {policyNumber} has been uploaded successfully. - KiaetoCare',
    settlement_completed: 'Settlement of ₹{amount} for policy {policyNumber} has been completed. - KiaetoCare'
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  // Replace placeholders with data
  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

/**
 * Send Hospital-specific SMS notifications
 * @param {string} mobile - Phone number
 * @param {string} template - Template name
 * @param {Object} data - Data to replace in template
 * @returns {Promise<Object>}
 */
const sendHospitalSMS = async (mobile, template, data = {}) => {
  const templates = {
    booking_confirmed: 'Your hospital booking at {hospitalName} is confirmed for {date}. ID: {bookingId}. - KiaetoCare',
    booking_reminder: 'Reminder: Your appointment at {hospitalName} is tomorrow at {time}. - KiaetoCare',
    admission_confirmed: 'Admission confirmed at {hospitalName} for {patientName}. Room: {roomType}. - KiaetoCare',
    discharge_completed: 'Discharge completed at {hospitalName}. Total: ₹{amount}. - KiaetoCare',
    emergency_alert: '🚨 Emergency assistance dispatched to {location}. Ambulance arriving in {eta} minutes. - KiaetoCare'
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

/**
 * Send Lab Test-specific SMS notifications
 * @param {string} mobile - Phone number
 * @param {string} template - Template name
 * @param {Object} data - Data to replace in template
 * @returns {Promise<Object>}
 */
const sendLabTestSMS = async (mobile, template, data = {}) => {
  const templates = {
    booking_confirmed: 'Your lab test booking at {labName} is confirmed for {date}. ID: {bookingId}. - KiaetoCare',
    sample_collected: 'Sample collected for {testName}. Expected report by {reportDate}. - KiaetoCare',
    report_ready: '✅ Your {testName} report is ready. View it on your dashboard. - KiaetoCare',
    home_collection_scheduled: 'Home sample collection scheduled for {date} at {address}. - KiaetoCare'
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

/**
 * Send Ambulance-specific SMS notifications
 * @param {string} mobile - Phone number
 * @param {string} template - Template name
 * @param {Object} data - Data to replace in template
 * @returns {Promise<Object>}
 */
const sendAmbulanceSMS = async (mobile, template, data = {}) => {
  const templates = {
    booking_confirmed: '🚑 Ambulance booked successfully. ID: {bookingId}. Estimated arrival: {eta} minutes. - KiaetoCare',
    en_route: '🚑 Ambulance is en route to {pickupAddress}. ETA: {eta} minutes. - KiaetoCare',
    arrived: '🚑 Ambulance has arrived at {pickupAddress}. - KiaetoCare',
    reached_hospital: '🚑 Ambulance has reached {hospitalName}. Patient is being admitted. - KiaetoCare'
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

/**
 * Send Caregiver-specific SMS notifications
 * @param {string} mobile - Phone number
 * @param {string} template - Template name
 * @param {Object} data - Data to replace in template
 * @returns {Promise<Object>}
 */
const sendCaregiverSMS = async (mobile, template, data = {}) => {
  const templates = {
    booking_confirmed: 'Caregiver {caregiverName} booked for {date}. ID: {bookingId}. - KiaetoCare',
    assigned: 'Caregiver {caregiverName} has been assigned to you. Contact: {phone}. - KiaetoCare',
    visit_reminder: 'Reminder: Caregiver visit scheduled today at {time}. - KiaetoCare'
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

/**
 * Send Ayurveda-specific SMS notifications
 * @param {string} mobile - Phone number
 * @param {string} template - Template name
 * @param {Object} data - Data to replace in template
 * @returns {Promise<Object>}
 */
const sendAyurvedaSMS = async (mobile, template, data = {}) => {
  const templates = {
    consultation_booked: 'Ayurveda consultation with Dr. {doctorName} booked for {date}. ID: {bookingId}. - KiaetoCare',
    prakriti_result: '🌿 Your Prakriti analysis is ready! Check your dashboard for details. - KiaetoCare',
    panchakarma_booked: 'Panchakarma package booked at {centerName} for {date}. - KiaetoCare',
    prescription_ready: '📜 Your Ayurveda prescription is ready. View it on your dashboard. - KiaetoCare'
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

/**
 * Send Homeopathy-specific SMS notifications
 * @param {string} mobile - Phone number
 * @param {string} template - Template name
 * @param {Object} data - Data to replace in template
 * @returns {Promise<Object>}
 */
const sendHomeopathySMS = async (mobile, template, data = {}) => {
  const templates = {
    consultation_booked: 'Homeopathy consultation with Dr. {doctorName} booked for {date}. ID: {bookingId}. - KiaetoCare',
    medicine_ready: '💊 Your homeopathy medicine is ready for delivery. Order: {orderId}. - KiaetoCare',
    prescription_ready: '📜 Your homeopathy prescription is ready. View it on your dashboard. - KiaetoCare',
    medicine_delivered: '📦 Your homeopathy medicine has been delivered. - KiaetoCare'
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

/**
 * Send Booking Confirmation SMS (Generic)
 * @param {string} mobile - Phone number
 * @param {string} serviceType - Type of service
 * @param {Object} data - Booking data
 * @returns {Promise<Object>}
 */
const sendBookingSMS = async (mobile, serviceType, data = {}) => {
  const templates = {
    hospital: 'Your {hospitalName} booking is confirmed for {date}. ID: {bookingId}. - KiaetoCare',
    ambulance: '🚑 Ambulance booked. ID: {bookingId}. ETA: {eta} min. - KiaetoCare',
    labtest: 'Lab test booking confirmed at {labName} for {date}. ID: {bookingId}. - KiaetoCare',
    caregiver: 'Caregiver {caregiverName} booked for {date}. ID: {bookingId}. - KiaetoCare',
    ayurveda: 'Ayurveda consultation booked with Dr. {doctorName} on {date}. ID: {bookingId}. - KiaetoCare',
    homeopathy: 'Homeopathy consultation booked with Dr. {doctorName} on {date}. ID: {bookingId}. - KiaetoCare',
    insurance: 'Insurance application received. Policy: {policyNumber}. Premium: ₹{premium}. - KiaetoCare'
  };

  let message = templates[serviceType];
  if (!message) {
    message = 'Your booking is confirmed. ID: {bookingId}. - KiaetoCare';
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

// ============================================
// UNIFIED SMS DISPATCHER (NEW)
// ============================================

/**
 * Unified SMS dispatcher - handles all types of SMS
 * @param {string} mobile - Phone number
 * @param {string} category - Category (insurance, hospital, labtest, etc.)
 * @param {string} template - Template name
 * @param {Object} data - Data to replace
 * @returns {Promise<Object>}
 */
const sendSMSTemplate = async (mobile, category, template, data = {}) => {
  const categoryMap = {
    insurance: sendInsuranceSMS,
    hospital: sendHospitalSMS,
    labtest: sendLabTestSMS,
    ambulance: sendAmbulanceSMS,
    caregiver: sendCaregiverSMS,
    ayurveda: sendAyurvedaSMS,
    homeopathy: sendHomeopathySMS,
    booking: sendBookingSMS
  };

  const sender = categoryMap[category] || sendSMS;
  
  if (typeof sender === 'function') {
    // If it's a category-specific function
    if (categoryMap[category]) {
      return sender(mobile, template, data);
    }
  }

  // Fallback to generic SMS
  const message = `${template}: ${JSON.stringify(data)} - KiaetoCare`;
  return sendSMS(mobile, message);
};

// ============================================
// EXPORTS (PRESERVED + NEW)
// ============================================

module.exports = {
  // Existing exports (PRESERVED)
  sendSMS,
  sendOTP,
  generateOTP,
  saveOTP,
  verifyOTP,
  otpStore,
  
  // New exports (ADDED)
  sendOTPWithType,
  sendInsuranceSMS,
  sendHospitalSMS,
  sendLabTestSMS,
  sendAmbulanceSMS,
  sendCaregiverSMS,
  sendAyurvedaSMS,
  sendHomeopathySMS,
  sendBookingSMS,
  sendSMSTemplate
};
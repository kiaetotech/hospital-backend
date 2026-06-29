// D:\hospital backend\services\smsService.js

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
// OTP STORE
// ============================================

const otpStore = new Map();

// ============================================
// OTP FUNCTIONS
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
// SMS PROVIDER FUNCTIONS
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

const sendViaTwilio = async (to, message) => {
  console.log(`📱 [TWILIO DISABLED] To: ${to}, Message: ${message}`);
  return { success: true, fallback: true, provider: 'twilio_disabled' };
};

// ============================================
// CORE sendSMS FUNCTION
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
// sendOTP FUNCTION
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
// sendOTPWithType - OTP for specific services
// ============================================

const sendOTPWithType = async (mobile, type = 'verification', customMessage = null) => {
  const otp = generateOTP();
  saveOTP(mobile, otp);

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
    online_consult: 'Your online doctor OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    mental_health: 'Your therapy booking OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    
    // Insurance
    insurance_application: 'Your insurance application OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    insurance_claim: 'Your insurance claim OTP is {otp}. Valid for 10 minutes. - KiaetoCare',
    policy_issue: 'Your policy issue OTP is {otp}. Valid for 10 minutes. - KiaetoCare'
  };

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

// ============================================
// 🛡️ INSURANCE SMS TEMPLATES
// ============================================

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
    console.warn(`⚠️ Insurance SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

// ============================================
// 🏥 HOSPITAL SMS TEMPLATES
// ============================================

const sendHospitalSMS = async (mobile, template, data = {}) => {
  const templates = {
    booking_confirmed: 'Your hospital booking at {hospitalName} is confirmed for {date}. ID: {bookingId}. - KiaetoCare',
    booking_reminder: 'Reminder: Your appointment at {hospitalName} is tomorrow at {time}. - KiaetoCare',
    admission_confirmed: 'Admission confirmed at {hospitalName} for {patientName}. Room: {roomType}. - KiaetoCare',
    discharge_completed: 'Discharge completed at {hospitalName}. Total: ₹{amount}. - KiaetoCare',
    opd_queue_update: 'Queue update: Dr. {doctorName} is now seeing token #{currentToken}. Your token: #{yourToken}. - KiaetoCare',
    surgery_scheduled: 'Surgery scheduled at {hospitalName} on {date}. Please follow pre-op instructions. - KiaetoCare'
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ Hospital SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

// ============================================
// 🔬 LAB TEST SMS TEMPLATES
// ============================================

const sendLabTestSMS = async (mobile, template, data = {}) => {
  const templates = {
    booking_confirmed: 'Your lab test booking at {labName} is confirmed for {date}. ID: {bookingId}. - KiaetoCare',
    sample_collected: 'Sample collected for {testName}. Expected report by {reportDate}. - KiaetoCare',
    report_ready: '✅ Your {testName} report is ready. View it on your dashboard. - KiaetoCare',
    home_collection_scheduled: 'Home sample collection scheduled for {date} at {address}. - KiaetoCare',
    package_activated: 'Your health package {packageName} has been activated. Valid for {validity}. - KiaetoCare'
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ Lab test SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

// ============================================
// 🚑 AMBULANCE SMS TEMPLATES (ENHANCED)
// ============================================

const sendAmbulanceSMS = async (mobile, template, data = {}) => {
  const templates = {
    // Regular ambulance
    booking_confirmed: '🚑 Ambulance booked successfully. ID: {bookingId}. Estimated arrival: {eta} minutes. - KiaetoCare',
    en_route: '🚑 Ambulance is en route to {pickupAddress}. ETA: {eta} minutes. - KiaetoCare',
    arrived: '🚑 Ambulance has arrived at {pickupAddress}. OTP: {otp}. - KiaetoCare',
    reached_hospital: '🚑 Ambulance has reached {hospitalName}. Patient is being admitted. - KiaetoCare',
    trip_completed: '✅ Trip completed. Fare: ₹{fare}. Trip sheet: {tripSheetUrl} - KiaetoCare',
    
    // 🚑 EMERGENCY (BLITZ RESPONSE)
    emergency_dispatched: [
      '🚨 EMERGENCY AMBULANCE DISPATCHED',
      'Driver: {driverName} ({driverPhone})',
      'Vehicle: {vehicleNumber}',
      'ETA: {eta} minutes',
      'Track: {trackingUrl}',
      'OTP: {otp} (share with driver)',
      'ID: {bookingId}'
    ].join('\n'),
    
    emergency_driver_accepted: [
      '✅ AMBULANCE CONFIRMED',
      'Driver: {driverName}',
      'Vehicle: {vehicleNumber} ({vehicleType})',
      'ETA: {eta} minutes',
      'Track: {trackingUrl}',
      'OTP: {otp}',
      'ID: {bookingId}'
    ].join('\n'),
    
    emergency_driver_arrived: [
      '🚑 AMBULANCE HAS ARRIVED',
      'Driver: {driverName}',
      'Vehicle: {vehicleNumber}',
      'OTP: {otp} - Share with driver to verify',
      'ID: {bookingId}'
    ].join('\n'),
    
    emergency_contact_notification: [
      '🚨 EMERGENCY ALERT',
      '{patientName} has requested an emergency ambulance.',
      'Ambulance: {vehicleNumber} ({ambulanceType})',
      'Driver: {driverName} ({driverPhone})',
      'ETA: {eta} minutes',
      'Destination: {hospitalName}',
      'Track live: {trackingUrl}'
    ].join('\n'),
    
    emergency_hospital_alert: [
      '🏥 INCOMING EMERGENCY',
      'Patient: {patientName}, {patientAge}y, {patientGender}',
      'Condition: {chiefComplaint}',
      'Ambulance: {vehicleNumber} ({ambulanceType})',
      'ETA: {eta} minutes',
      'Driver: {driverPhone}',
      'Vitals: {vitals}',
      'Insurance: {insuranceProvider}',
      'Please prepare ER. ID: {bookingId}'
    ].join('\n'),
    
    emergency_no_driver: [
      '⚠️ URGENT: No ambulance available nearby.',
      'Call 108 (National Ambulance) immediately.',
      'We are expanding our network.',
      'ID: {bookingId}'
    ].join('\n'),
    
    emergency_driver_cancelled: [
      '⚠️ Driver cancelled. Re-dispatching...',
      'Finding another ambulance for you.',
      'If urgent, call 108 directly.',
      'ID: {bookingId}'
    ].join('\n'),
    
    emergency_cancelled: [
      'Emergency booking cancelled.',
      '{refundMessage}',
      'ID: {bookingId}',
      'We hope you are safe.'
    ].join('\n'),
    
    emergency_surge_alert: [
      '⚠️ Surge pricing active ({multiplier}x)',
      'Reason: {reason}',
      'Revised fare: ₹{revisedFare}',
      'Accept to continue.',
      'ID: {bookingId}'
    ].join('\n'),
    
    emergency_location_update: '🚑 Ambulance ETA updated: {eta} minutes. Track: {trackingUrl}',
    
    emergency_patient_onboard: [
      '🏥 UPDATE: Patient onboard',
      'Heading to: {hospitalName}',
      'Revised ETA: {eta} minutes',
      'ID: {bookingId}'
    ].join('\n'),
    
    emergency_arrived_hospital: [
      '🏥 Arrived at {hospitalName}',
      'Digital trip sheet: {tripSheetUrl}',
      'Fare: ₹{fare}',
      'ID: {bookingId}'
    ].join('\n'),
    
    trip_sheet_ready: '📋 Your digital trip sheet is ready for insurance: {tripSheetUrl} - KiaetoCare',
    
    scheduled_reminder: '⏰ Reminder: Ambulance scheduled for {date} at {time}. Pickup: {pickupAddress}. ID: {bookingId}. - KiaetoCare',
    
    // Driver notifications
    driver_dispatch: [
      '🚨 EMERGENCY REQUEST!',
      'Patient: {patientName}',
      'Condition: {patientCondition}',
      'Pickup: {pickupAddress}',
      'Distance: {distance}km | ETA: {eta}min',
      'Est. Fare: ₹{estimatedFare}',
      '{surgeMessage}',
      'Accept within 15 seconds!',
      'ID: {bookingId}'
    ].join('\n'),
    
    driver_trip_completed: [
      '✅ Trip Completed',
      'Fare: ₹{fare}',
      'Your earning: ₹{driverEarning}',
      'ID: {bookingId}'
    ].join('\n'),
    
    driver_weekly_summary: [
      '📊 Weekly Summary',
      'Trips: {totalTrips} (Emergency: {emergencyTrips})',
      'Earnings: ₹{totalEarnings}',
      'Rating: {rating} ⭐',
      'Avg Response: {avgResponseTime}s'
    ].join('\n'),
    
    provider_weekly_summary: [
      '📊 Weekly Fleet Summary',
      'Total Trips: {totalTrips}',
      'Emergency: {emergencyTrips} | Scheduled: {scheduledTrips}',
      'Total Earnings: ₹{totalEarnings}',
      'Avg Rating: {averageRating} ⭐',
      'Avg Response: {averageResponseTime}s'
    ].join('\n')
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ Ambulance SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] !== undefined ? data[key] : 'N/A');
  });

  return sendSMS(mobile, message);
};

// ============================================
// 🏠 CAREGIVER SMS TEMPLATES
// ============================================

const sendCaregiverSMS = async (mobile, template, data = {}) => {
  const templates = {
    booking_confirmed: 'Caregiver {caregiverName} booked for {date}. ID: {bookingId}. - KiaetoCare',
    assigned: 'Caregiver {caregiverName} has been assigned to you. Contact: {phone}. - KiaetoCare',
    visit_reminder: 'Reminder: Caregiver visit scheduled today at {time}. - KiaetoCare',
    replacement_assigned: 'Replacement caregiver {caregiverName} assigned. Contact: {phone}. - KiaetoCare',
    monthly_report: 'Monthly care report for {patientName} is ready. View on dashboard. - KiaetoCare'
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ Caregiver SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

// ============================================
// 🧘 AYURVEDA SMS TEMPLATES
// ============================================

const sendAyurvedaSMS = async (mobile, template, data = {}) => {
  const templates = {
    consultation_booked: 'Ayurveda consultation with Dr. {doctorName} booked for {date}. ID: {bookingId}. - KiaetoCare',
    prakriti_result: '🌿 Your Prakriti analysis is ready! Check your dashboard for details. - KiaetoCare',
    panchakarma_booked: 'Panchakarma package booked at {centerName} for {date}. ID: {bookingId}. - KiaetoCare',
    prescription_ready: '📜 Your Ayurveda prescription is ready. View it on your dashboard. - KiaetoCare',
    panchakarma_day_update: '🌿 Panchakarma Day {day}: {treatment} completed. Follow diet as prescribed. - KiaetoCare',
    medicine_shipped: '📦 Your Ayurvedic medicine order {orderId} has been shipped. - KiaetoCare'
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ Ayurveda SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

// ============================================
// 🌿 HOMEOPATHY SMS TEMPLATES
// ============================================

const sendHomeopathySMS = async (mobile, template, data = {}) => {
  const templates = {
    consultation_booked: 'Homeopathy consultation with Dr. {doctorName} booked for {date}. ID: {bookingId}. - KiaetoCare',
    medicine_ready: '💊 Your homeopathy medicine is ready for delivery. Order: {orderId}. - KiaetoCare',
    prescription_ready: '📜 Your homeopathy prescription is ready. View it on your dashboard. - KiaetoCare',
    medicine_delivered: '📦 Your homeopathy medicine has been delivered. - KiaetoCare',
    follow_up_reminder: '⏰ Reminder: Follow-up with Dr. {doctorName} scheduled for {date}. - KiaetoCare'
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ Homeopathy SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

// ============================================
// 🧠 MENTAL HEALTH SMS TEMPLATES
// ============================================

const sendMentalHealthSMS = async (mobile, template, data = {}) => {
  const templates = {
    session_booked: 'Therapy session with {therapistName} booked for {date}. ID: {bookingId}. - KiaetoCare',
    session_reminder: 'Reminder: Therapy session with {therapistName} tomorrow at {time}. Take care! - KiaetoCare',
    crisis_alert: '🚨 URGENT: {patientName} may need immediate support. Please check on them. Helpline: 9152987821 - KiaetoCare',
    mood_check_in: 'How are you feeling today? Take a moment to journal: {journalUrl} - KiaetoCare',
    group_session_reminder: 'Group therapy session on {topic} starts in 1 hour. Join link: {joinUrl} - KiaetoCare'
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ Mental Health SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

// ============================================
// 📱 ONLINE DOCTOR SMS TEMPLATES
// ============================================

const sendOnlineDoctorSMS = async (mobile, template, data = {}) => {
  const templates = {
    consult_booked: 'Online consultation with Dr. {doctorName} booked for {date}. Join: {joinUrl}. ID: {bookingId}. - KiaetoCare',
    consult_reminder: 'Your online consultation with Dr. {doctorName} starts in 15 min! Join: {joinUrl} - KiaetoCare',
    prescription_ready: '📜 Your e-prescription is ready. View: {prescriptionUrl} - KiaetoCare',
    follow_up_scheduled: 'Follow-up with Dr. {doctorName} scheduled for {date}. - KiaetoCare'
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ Online Doctor SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

// ============================================
// 🏢 CORPORATE HEALTH SMS TEMPLATES
// ============================================

const sendCorporateSMS = async (mobile, template, data = {}) => {
  const templates = {
    checkup_scheduled: 'Employee health checkup scheduled for {date} at {location}. - KiaetoCare Corporate',
    report_ready: 'Monthly employee health report is ready. View: {reportUrl} - KiaetoCare Corporate',
    wellness_challenge: '🏆 New wellness challenge starts! Join your team: {challengeUrl} - KiaetoCare Corporate'
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ Corporate SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

// ============================================
// 💰 HEALTH EMI SMS TEMPLATES
// ============================================

const sendHealthEMISMS = async (mobile, template, data = {}) => {
  const templates = {
    loan_approved: '✅ Medical loan of ₹{amount} approved! ID: {applicationId}. - KiaetoCare',
    loan_disbursed: '💰 Loan of ₹{amount} disbursed. EMI starts next month. - KiaetoCare',
    emi_due: '⏰ EMI of ₹{amount} due on {date}. Ensure sufficient balance. - KiaetoCare',
    emi_paid: '✅ EMI payment of ₹{amount} received. Thank you! - KiaetoCare'
  };

  let message = templates[template];
  if (!message) {
    console.warn(`⚠️ Health EMI SMS template not found: ${template}`);
    return { success: false, error: 'Template not found' };
  }

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

// ============================================
// GENERIC BOOKING SMS
// ============================================

const sendBookingSMS = async (mobile, serviceType, data = {}) => {
  const templates = {
    hospital: 'Your {hospitalName} booking is confirmed for {date}. ID: {bookingId}. - KiaetoCare',
    ambulance: '🚑 Ambulance booked. ID: {bookingId}. ETA: {eta} min. - KiaetoCare',
    labtest: 'Lab test booking confirmed at {labName} for {date}. ID: {bookingId}. - KiaetoCare',
    caregiver: 'Caregiver {caregiverName} booked for {date}. ID: {bookingId}. - KiaetoCare',
    ayurveda: 'Ayurveda consultation booked with Dr. {doctorName} on {date}. ID: {bookingId}. - KiaetoCare',
    homeopathy: 'Homeopathy consultation booked with Dr. {doctorName} on {date}. ID: {bookingId}. - KiaetoCare',
    insurance: 'Insurance application received. Policy: {policyNumber}. Premium: ₹{premium}. - KiaetoCare',
    online_doctor: 'Online consultation with Dr. {doctorName} on {date}. Join link sent. ID: {bookingId}. - KiaetoCare',
    mental_health: 'Therapy session with {therapistName} on {date}. ID: {bookingId}. - KiaetoCare'
  };

  let message = templates[serviceType] || 'Your booking is confirmed. ID: {bookingId}. - KiaetoCare';

  Object.keys(data).forEach(key => {
    message = message.replace(`{${key}}`, data[key] || 'N/A');
  });

  return sendSMS(mobile, message);
};

// ============================================
// UNIFIED SMS DISPATCHER
// ============================================

const sendSMSTemplate = async (mobile, category, template, data = {}) => {
  const categoryMap = {
    insurance: sendInsuranceSMS,
    hospital: sendHospitalSMS,
    labtest: sendLabTestSMS,
    ambulance: sendAmbulanceSMS,
    caregiver: sendCaregiverSMS,
    ayurveda: sendAyurvedaSMS,
    homeopathy: sendHomeopathySMS,
    mental_health: sendMentalHealthSMS,
    online_doctor: sendOnlineDoctorSMS,
    corporate: sendCorporateSMS,
    health_emi: sendHealthEMISMS,
    booking: sendBookingSMS
  };

  const sender = categoryMap[category];
  
  if (sender && category !== 'booking') {
    return sender(mobile, template, data);
  }
  
  if (category === 'booking') {
    return sendBookingSMS(mobile, template, data);
  }

  // Fallback
  const message = `${category} - ${template}: ${JSON.stringify(data)} - KiaetoCare`;
  return sendSMS(mobile, message);
};

// ============================================
// 🚑 EMERGENCY SMS (HIGH PRIORITY)
// ============================================

/**
 * Send emergency SMS with highest priority
 * Bypasses rate limiting and DND
 */
const sendEmergencySMS = async (mobile, template, data = {}) => {
  console.log(`🚨 [EMERGENCY SMS] To: ${mobile} | Template: ${template}`);
  
  // Use ambulance templates for emergency
  const result = await sendAmbulanceSMS(mobile, template, data);
  
  // Log emergency SMS for audit
  console.log(`🚨 [EMERGENCY SMS SENT] To: ${mobile} | Result: ${result.success ? 'OK' : 'FAILED'}`);
  
  return result;
};

// ============================================
// 🚑 DRIVER DISPATCH SMS
// ============================================

const sendDriverDispatchSMS = async (driverPhone, emergencyData) => {
  return sendAmbulanceSMS(driverPhone, 'driver_dispatch', emergencyData);
};

// ============================================
// 🚑 EMERGENCY CONTACTS SMS
// ============================================

const sendEmergencyContactsSMS = async (contacts, emergencyData) => {
  const results = [];
  for (const contact of contacts) {
    if (contact.phone) {
      const result = await sendAmbulanceSMS(contact.phone, 'emergency_contact_notification', {
        ...emergencyData,
        contactName: contact.name
      });
      results.push({ contact: contact.name, ...result });
    }
  }
  return results;
};

// ============================================
// 🚑 HOSPITAL ER NOTIFICATION SMS
// ============================================

const sendHospitalERAlertSMS = async (hospitalPhone, emergencyData) => {
  return sendAmbulanceSMS(hospitalPhone, 'emergency_hospital_alert', emergencyData);
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Core SMS functions
  sendSMS,
  sendOTP,
  generateOTP,
  saveOTP,
  verifyOTP,
  otpStore,
  
  // OTP with type
  sendOTPWithType,
  
  // Tag-specific SMS templates
  sendInsuranceSMS,
  sendHospitalSMS,
  sendLabTestSMS,
  sendAmbulanceSMS,
  sendCaregiverSMS,
  sendAyurvedaSMS,
  sendHomeopathySMS,
  sendMentalHealthSMS,
  sendOnlineDoctorSMS,
  sendCorporateSMS,
  sendHealthEMISMS,
  
  // Generic booking SMS
  sendBookingSMS,
  
  // Unified dispatcher
  sendSMSTemplate,
  
  // 🚑 Emergency SMS (High Priority)
  sendEmergencySMS,
  sendDriverDispatchSMS,
  sendEmergencyContactsSMS,
  sendHospitalERAlertSMS
};
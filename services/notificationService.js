// D:\hospital backend\services\notificationService.js

// ============================================
// NOTIFICATION SERVICE - For ALL 11 Tags
// ============================================

/**
 * Handles all notifications, Email, Push, WhatsApp
 * Supports ALL 11 Tags with specialized templates
 * 
 * Tags, Ambulance, Insurance, Homeopathy,
 *       Ayurveda, Caregivers, Health EMI, Corporate Health,
 *       Diagnostics, Mental Health, Online Doctor
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hospital-frontend-kiaeto.vercel.app';

const notificationService = {
  // ============================================
  // CORE SEND METHODS
  // ============================================

  sendSMS(phone, message, priority = 'normal') => {
    // Integrate with MSG91, Twilio, or other SMS provider
    // priority: 'normal' | 'high' | 'emergency'
    console.log(`[SMS][${priority.toUpperCase()}] To: ${phone} | Message: ${message}`);
    return { success, provider: 'console', priority };
  },

  sendEmail(email, subject, html) => {
    // Integrate with SendGrid, Nodemailer, etc.
    console.log(`[EMAIL] To: ${email} | Subject: ${subject}`);
    return { success, provider: 'console' };
  },

  sendPushNotification(userId, title, body, data = {}) => {
    // Integrate with Firebase Cloud Messaging (FCM)
    console.log(`[PUSH] User: ${userId} | Title: ${title} | Body: ${body}`);
    return { success, provider: 'console' };
  },

  sendWhatsApp(phone, message) => {
    // Integrate with WhatsApp Business API
    console.log(`[WHATSAPP] To: ${phone} | Message: ${message}`);
    return { success, provider: 'console' };
  },

  // ============================================
  // 🆕 BULK NOTIFICATION
  // ============================================

  sendBulk(notifications) => {
    // Send multiple notifications in parallel
    const results = await Promise.allSettled(
      notifications.map(n => {
        if (n.type === 'sms') return notificationService.sendSMS(n.to, n.message, n.priority);
        if (n.type === 'email') return notificationService.sendEmail(n.to, n.subject, n.html);
        if (n.type === 'push') return notificationService.sendPushNotification(n.to, n.title, n.body, n.data);
        if (n.type === 'whatsapp') return notificationService.sendWhatsApp(n.to, n.message);
      })
    );
    return results;
  },

  // ============================================
  // 🚨 EMERGENCY HELPERS
  // ============================================

  _isEmergency: (booking) => {
    return booking.bookingType === 'ambulance_emergency' || 
           booking.emergencyType === 'blitz' ||
           booking.emergencyType === 'emergency';
  },

  _getPatientPhone: (booking) => {
    return booking.patientPhone || booking.patient?.phone || '';
  },

  _getPatientEmail: (booking) => {
    return booking.patientEmail || booking.patient?.email || '';
  },

  _getPatientName: (booking) => {
    return booking.patientName || booking.patient?.name || 'Patient';
  },

  // ============================================
  // 📋 BOOKING CONFIRMATION (ALL TAGS)
  // ============================================

  bookingConfirmed(booking) => {
    const isEmergency = notificationService._isEmergency(booking);
    const patientName = notificationService._getPatientName(booking);
    const phone = notificationService._getPatientPhone(booking);
    const email = notificationService._getPatientEmail(booking);
    const bookingId = booking.bookingId || 'N/A';
    const date = booking.bookingDate || booking.date || new Date();
    const formattedDate = new Date(date).toLocaleDateString('en-IN', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    let patientMsg = '';
    let emailSubject = '';
    let emailHtml = '';

    // ============================================
    // 🚑 AMBULANCE EMERGENCY CONFIRMATION
    // ============================================
    if (isEmergency) {
      const driverName = booking.driverName || 'Driver';
      const driverPhone = booking.driverPhone || '';
      const vehicleNumber = booking.vehicleNumber || '';
      const eta = booking.digitalTripSheet?.duration || '5';
      const trackingUrl = booking.trackingUrl || `${FRONTEND_URL}/ambulance/tracking/${bookingId}`;
      const tripOtp = booking.tripOtp || '';

      patientMsg = [
        `🚑 AMBULANCE DISPATCHED`,
        `Driver: ${driverName} (${driverPhone})`,
        `Vehicle: ${vehicleNumber}`,
        `ETA: ${eta} minutes`,
        `Track: ${trackingUrl}`,
        `OTP: ${tripOtp} (share with driver)`,
        `Booking ID: ${bookingId}`
      ].join('\n');

      emailSubject = '🚑 Ambulance Dispatched - HealthCare Hub';
      emailHtml = `
        <div style="background:#fff3f3;padding:20px;border-left:5px solid #e53935;">
          <h2 style="color:#e53935;">🚑 Ambulance Dispatched</h2>
          <p><strong>Driver:</strong> ${driverName} (${driverPhone})</p>
          <p><strong>Vehicle:</strong> ${vehicleNumber}</p>
          <p><strong>ETA:</strong> ${eta} minutes</p>
          <p><strong>OTP:</strong> <span style="font-size:24px;font-weight;color:#e53935;">${tripOtp}</span></p>
          <p><a href="${trackingUrl}" style="background:#e53935;color;padding:10px 20px;text-decoration;border-radius:5px;">Track Live Location</a></p>
          <p><small>Booking ID: ${bookingId}</small></p>
        </div>
      `;
    }
    // ============================================
    // 🏥 HOSPITAL OPD/ADMISSION CONFIRMATION
    // ============================================
    else if (booking.bookingType === 'opd' || booking.bookingType === 'admission') {
      const hospitalName = booking.hospitalName || 'Hospital';
      const doctorName = booking.doctorName || 'Doctor';
      const timeSlot = booking.timeSlot || booking.time || 'Scheduled';
      
      patientMsg = `Your ${booking.bookingType === 'admission' ? 'admission' : 'OPD appointment'} at ${hospitalName} with Dr. ${doctorName} is confirmed for ${formattedDate} at ${timeSlot}. Booking ID: ${bookingId}`;
      emailSubject = `Booking Confirmed - ${hospitalName}`;
      emailHtml = `<h2>Booking Confirmed!</h2><p>${patientMsg}</p>`;
    }
    // ============================================
    // 🔬 DIAGNOSTICS CONFIRMATION
    // ============================================
    else if (booking.bookingType === 'labtest' || booking.bookingType === 'health_package') {
      const providerName = booking.providerName || 'Diagnostic Center';
      const tests = booking.tests?.join(', ') || 'Tests';
      
      patientMsg = `Your ${booking.bookingType === 'health_package' ? 'health package' : 'lab test'} (${tests}) at ${providerName} is confirmed for ${formattedDate}. Booking ID: ${bookingId}`;
      emailSubject = `Test Booking Confirmed - ${providerName}`;
      emailHtml = `<h2>Test Booking Confirmed!</h2><p>${patientMsg}</p>`;
    }
    // ============================================
    // 🛡️ INSURANCE CONFIRMATION
    // ============================================
    else if (booking.bookingType === 'insurance') {
      const companyName = booking.insuranceCompanyName || 'Insurance Provider';
      const planName = booking.insurancePlanName || 'Health Plan';
      const policyNumber = booking.policyNumber || '';
      
      patientMsg = `Your ${planName} policy from ${companyName} has been issued. Policy No: ${policyNumber}. Booking ID: ${bookingId}`;
      emailSubject = `Policy Issued - ${companyName}`;
      emailHtml = `<h2>Policy Issued!</h2><p>${patientMsg}</p>`;
    }
    // ============================================
    // 🧘 AYURVEDA / 🌿 HOMEOPATHY CONFIRMATION
    // ============================================
    else if (booking.bookingType === 'ayurveda_consultation' || booking.bookingType === 'homeopathy_consult') {
      const doctorName = booking.doctorName || 'Doctor';
      const type = booking.bookingType === 'ayurveda_consultation' ? 'Ayurveda' : 'Homeopathy';
      
      patientMsg = `Your ${type} consultation with Dr. ${doctorName} is confirmed on ${formattedDate} at ${booking.timeSlot || booking.time || 'Scheduled'}. Booking ID: ${bookingId}`;
      emailSubject = `${type} Consultation Confirmed`;
      emailHtml = `<h2>${type} Consultation Confirmed!</h2><p>${patientMsg}</p>`;
    }
    // ============================================
    // 🧠 MENTAL HEALTH CONFIRMATION
    // ============================================
    else if (booking.bookingType === 'mental_health') {
      const therapistName = booking.doctorName || booking.therapistName || 'Therapist';
      
      patientMsg = `Your therapy session with ${therapistName} is confirmed for ${formattedDate}. Booking ID: ${bookingId}`;
      emailSubject = `Therapy Session Confirmed`;
      emailHtml = `<h2>Therapy Session Confirmed!</h2><p>${patientMsg}</p>`;
    }
    // ============================================
    // 📱 ONLINE DOCTOR CONFIRMATION
    // ============================================
    else if (booking.bookingType === 'online_consult') {
      const doctorName = booking.doctorName || 'Doctor';
      const videoLink = booking.videoLink || `${FRONTEND_URL}/online-doctor/consult/${bookingId}`;
      
      patientMsg = `Your online consultation with Dr. ${doctorName} is confirmed for ${formattedDate}. Join here: ${videoLink}. Booking ID: ${bookingId}`;
      emailSubject = `Online Consultation Confirmed`;
      emailHtml = `<h2>Online Consultation Confirmed!</h2><p>${patientMsg}</p><p><a href="${videoLink}">Join Consultation</a></p>`;
    }
    // ============================================
    // 🏠 CAREGIVER CONFIRMATION
    // ============================================
    else if (booking.bookingType === 'caregiver') {
      const caregiverName = booking.caregiverName || 'Caregiver';
      
      patientMsg = `Your caregiver ${caregiverName} has been assigned. Service starts ${formattedDate}. Booking ID: ${bookingId}`;
      emailSubject = `Caregiver Assigned`;
      emailHtml = `<h2>Caregiver Assigned!</h2><p>${patientMsg}</p>`;
    }
    // ============================================
    // 🚑 AMBULANCE SCHEDULED CONFIRMATION
    // ============================================
    else if (booking.bookingType === 'ambulance') {
      patientMsg = `Your ambulance has been scheduled for ${formattedDate}. Pickup: ${booking.pickupAddress || 'Your location'}. Booking ID: ${bookingId}`;
      emailSubject = `Ambulance Scheduled - HealthCare Hub`;
      emailHtml = `<h2>Ambulance Scheduled!</h2><p>${patientMsg}</p>`;
    }
    // ============================================
    // 💰 HEALTH EMI / 🏢 CORPORATE / OTHER
    // ============================================
    else {
      patientMsg = `Your booking (${booking.bookingType || 'service'}) is confirmed for ${formattedDate}. Booking ID: ${bookingId}`;
      emailSubject = `Booking Confirmed - HealthCare Hub`;
      emailHtml = `<h2>Booking Confirmed!</h2><p>${patientMsg}</p>`;
    }

    // Send notifications
    const notifications = [];
    
    if (phone) {
      notifications.push(
        notificationService.sendSMS(phone, patientMsg, isEmergency ? 'emergency' : 'normal')
      );
    }
    
    if (email) {
      notifications.push(
        notificationService.sendEmail(email, emailSubject, emailHtml)
      );
    }

    await Promise.allSettled(notifications);
    return { success, type: 'booking_confirmed', isEmergency };
  },

  // ============================================
  // 👨‍⚕️ PROVIDER NEW BOOKING ALERT (ALL TAGS)
  // ============================================

  providerNewBooking(providerPhone, booking) => {
    const isEmergency = notificationService._isEmergency(booking);
    const patientName = notificationService._getPatientName(booking);
    const bookingId = booking.bookingId || 'N/A';
    const date = booking.bookingDate || booking.date || new Date();
    const formattedDate = new Date(date).toLocaleDateString('en-IN');
    
    let msg = '';
    
    if (isEmergency) {
      msg = `🚨 EMERGENCY BOOKING! Patient: ${patientName}. Pickup: ${booking.pickupAddress || 'GPS location'}. Accept immediately! Booking ID: ${bookingId}`;
    } else {
      msg = `New booking! Patient: ${patientName} on ${formattedDate} at ${booking.timeSlot || booking.time || 'Scheduled'}. Booking ID: ${bookingId}`;
    }
    
    return await notificationService.sendSMS(providerPhone, msg, isEmergency ? 'emergency' : 'high');
  },

  // ============================================
  // 👨‍⚕️ DOCTOR NEW BOOKING (ALIAS)
  // ============================================

  doctorNewBooking(doctorPhone, booking) => {
    return await notificationService.providerNewBooking(doctorPhone, booking);
  },

  // ============================================
  // 💰 PAYMENT RECEIVED (ALL TAGS)
  // ============================================

  paymentReceived(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const email = notificationService._getPatientEmail(booking);
    const isEmergency = notificationService._isEmergency(booking);
    const amount = booking.finalAmount || 0;
    const bookingId = booking.bookingId || 'N/A';

    const msg = `Payment of ₹${amount} received for booking ${bookingId}. Thank you for choosing HealthCare Hub!`;
    const subject = 'Payment Confirmed - HealthCare Hub';
    const html = `<h2>Payment Confirmed!</h2><p>${msg}</p>`;

    const notifications = [];
    if (phone) notifications.push(notificationService.sendSMS(phone, msg));
    if (email) notifications.push(notificationService.sendEmail(email, subject, html));
    
    await Promise.allSettled(notifications);
    return { success, type: 'payment_received' };
  },

  // ============================================
  // 💵 PAYOUT PROCESSED (ALL TAGS)
  // ============================================

  payoutProcessed(providerPhone, amount, providerName = 'Provider') => {
    const msg = `Your payout of ₹${amount} has been processed and will be credited to your bank account within 2-3 business days. - HealthCare Hub`;
    return await notificationService.sendSMS(providerPhone, msg);
  },

  // ============================================
  // ⭐ REVIEW REQUEST (ALL TAGS)
  // ============================================

  requestReview(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const bookingId = booking.bookingId || 'N/A';
    const doctorName = booking.doctorName || 'provider';
    const bookingType = booking.bookingType || 'service';
    
    let reviewPath = 'review';
    if (bookingType === 'ayurveda_consultation') reviewPath = 'ayurveda/review';
    else if (bookingType === 'mental_health') reviewPath = 'mental-health/review';
    else if (bookingType === 'online_consult') reviewPath = 'online-doctor/review';
    
    const reviewUrl = `${FRONTEND_URL}/${reviewPath}/${bookingId}`;
    const msg = `How was your experience with ${doctorName}? Share your feedback: ${reviewUrl}`;
    
    return await notificationService.sendSMS(phone, msg);
  },

  // ============================================
  // 🔔 APPOINTMENT REMINDER (ALL TAGS)
  // ============================================

  appointmentReminder(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const email = notificationService._getPatientEmail(booking);
    const patientName = notificationService._getPatientName(booking);
    const date = booking.appointmentDate || booking.date || new Date();
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
      weekday: 'long', month: 'long', day: 'numeric'
    });
    const time = booking.timeSlot || booking.time || 'Scheduled time';

    const msg = `Reminderappointment is tomorrow, ${formattedDate} at ${time}. Booking ID: ${booking.bookingId || 'N/A'}`;
    const subject = 'Appointment Reminder - HealthCare Hub';
    const html = `<h2>Appointment Reminder</h2><p>Hi ${patientName},</p><p>${msg}</p>`;

    const notifications = [];
    if (phone) notifications.push(notificationService.sendSMS(phone, msg, 'high'));
    if (email) notifications.push(notificationService.sendEmail(email, subject, html));
    
    await Promise.allSettled(notifications);
    return { success};
  },

  // ============================================
  // ❌ CANCELLATION NOTICE (ALL TAGS)
  // ============================================

  bookingCancelled(booking, cancelledBy = 'patient') => {
    const phone = notificationService._getPatientPhone(booking);
    const email = notificationService._getPatientEmail(booking);
    const bookingId = booking.bookingId || 'N/A';
    const refundAmount = booking.cancellation?.refundAmount || booking.refundAmount || 0;

    const msg = `Your booking ${bookingId} has been cancelled. Refund: ₹${refundAmount} (if applicable). For help, contact support.`;
    const subject = 'Booking Cancelled - HealthCare Hub';
    const html = `<h2>Booking Cancelled</h2><p>${msg}</p>`;

    const notifications = [];
    if (phone) notifications.push(notificationService.sendSMS(phone, msg));
    if (email) notifications.push(notificationService.sendEmail(email, subject, html));
    
    await Promise.allSettled(notifications);
    return { success};
  },

  // ============================================
  // 📊 REPORT READY (DIAGNOSTICS)
  // ============================================

  reportReady(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const email = notificationService._getPatientEmail(booking);
    const bookingId = booking.bookingId || 'N/A';
    const reportUrl = `${FRONTEND_URL}/diagnostics/report/${bookingId}`;

    const msg = `Your test reports are ready! View them here: ${reportUrl}. Booking ID: ${bookingId}`;
    const subject = 'Test Reports Ready - HealthCare Hub';
    const html = `<h2>Your Reports Are Ready!</h2><p><a href="${reportUrl}">View Reports</a></p>`;

    const notifications = [];
    if (phone) notifications.push(notificationService.sendSMS(phone, msg));
    if (email) notifications.push(notificationService.sendEmail(email, subject, html));
    
    await Promise.allSettled(notifications);
    return { success};
  },

  // ============================================
  // 📦 MEDICINE SHIPPED (HOMEOPATHY PHARMACY)
  // ============================================

  medicineShipped(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const trackingNumber = booking.trackingNumber || 'N/A';
    const bookingId = booking.bookingId || 'N/A';

    const msg = `Your medicine order ${bookingId} has been shipped! Tracking: ${trackingNumber}.`;
    return await notificationService.sendSMS(phone, msg);
  },

  // ============================================
  // 📦 MEDICINE DELIVERED (HOMEOPATHY PHARMACY)
  // ============================================

  medicineDelivered(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const bookingId = booking.bookingId || 'N/A';

    const msg = `Your medicine order ${bookingId} has been delivered. We hope you feel better soon!`;
    return await notificationService.sendSMS(phone, msg);
  },

  // ============================================
  // 🛡️ POLICY ISSUED (INSURANCE)
  // ============================================

  policyIssued(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const email = notificationService._getPatientEmail(booking);
    const policyNumber = booking.policyNumber || 'N/A';
    const companyName = booking.insuranceCompanyName || 'Insurance Provider';

    const msg = `Your health insurance policy ${policyNumber} from ${companyName} has been issued. View details in your account.`;
    const subject = 'Policy Issued - HealthCare Hub';
    const html = `<h2>Policy Issued!</h2><p>${msg}</p>`;

    const notifications = [];
    if (phone) notifications.push(notificationService.sendSMS(phone, msg));
    if (email) notifications.push(notificationService.sendEmail(email, subject, html));
    
    await Promise.allSettled(notifications);
    return { success};
  },

  // ============================================
  // 🛡️ POLICY RENEWAL REMINDER (INSURANCE)
  // ============================================

  policyRenewalReminder(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const policyNumber = booking.policyNumber || 'N/A';
    const renewalDate = booking.policyRenewalDate || booking.policyEndDate || new Date();
    const formattedDate = new Date(renewalDate).toLocaleDateString('en-IN');

    const msg = `Your health policy ${policyNumber} expires on ${formattedDate}. Renew now to avoid break in coverage.`;
    return await notificationService.sendSMS(phone, msg, 'high');
  },

  // ============================================
  // 🧠 THERAPY SESSION REMINDER (MENTAL HEALTH)
  // ============================================

  therapySessionReminder(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const therapistName = booking.doctorName || booking.therapistName || 'Therapist';
    const date = booking.appointmentDate || new Date();
    const formattedDate = new Date(date).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
    const time = booking.timeSlot || booking.time || 'Scheduled';

    const msg = `Remindertherapy session with ${therapistName} is tomorrow, ${formattedDate} at ${time}. Take care!`;
    return await notificationService.sendSMS(phone, msg, 'high');
  },

  // ============================================
  // 🧠 CRISIS ALERT (MENTAL HEALTH)
  // ============================================

  crisisAlert(booking, crisisContact) => {
    const phone = crisisContact?.phone || '';
    const patientName = notificationService._getPatientName(booking);
    
    const msg = `URGENT: ${patientName} may need immediate support. Please check on them. Crisis helpline: 9152987821`;
    return await notificationService.sendSMS(phone, msg, 'emergency');
  },

  // ============================================
  // 📱 ONLINE CONSULT REMINDER
  // ============================================

  onlineConsultReminder(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const doctorName = booking.doctorName || 'Doctor';
    const videoLink = booking.videoLink || `${FRONTEND_URL}/online-doctor/consult/${booking.bookingId}`;
    const time = booking.timeSlot || booking.time || 'Scheduled';

    const msg = `Your online consultation with Dr. ${doctorName} starts in 15 minutes! Join here: ${videoLink}`;
    return await notificationService.sendSMS(phone, msg, 'high');
  },

  // ============================================
  // 🏢 CORPORATE HEALTH REPORT (CORPORATE)
  // ============================================

  corporateReportReady(hrPhone, hrEmail, corporateName, reportUrl) => {
    const msg = `Monthly employee health report for ${corporateName} is ready. View: ${reportUrl}`;
    const subject = `Employee Health Report - ${corporateName}`;
    const html = `<h2>Monthly Health Report Ready</h2><p>${msg}</p>`;

    const notifications = [];
    if (hrPhone) notifications.push(notificationService.sendSMS(hrPhone, msg));
    if (hrEmail) notifications.push(notificationService.sendEmail(hrEmail, subject, html));
    
    await Promise.allSettled(notifications);
    return { success};
  },

  // ============================================
  // 💰 LOAN APPROVED (HEALTH EMI)
  // ============================================

  loanApproved(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const loanAmount = booking.loanAmount || booking.amount || 0;
    const bookingId = booking.bookingId || 'N/A';

    const msg = `Your medical loan of ₹${loanAmount} has been approved! Booking ID: ${bookingId}. Funds will be disbursed shortly.`;
    return await notificationService.sendSMS(phone, msg);
  },

  // ============================================
  // 💰 LOAN DISBURSED (HEALTH EMI)
  // ============================================

  loanDisbursed(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const amount = booking.disbursedAmount || booking.amount || 0;
    const bookingId = booking.bookingId || 'N/A';

    const msg = `Your medical loan of ₹${amount} has been disbursed. Booking ID: ${bookingId}. EMI starts next month.`;
    return await notificationService.sendSMS(phone, msg);
  },

  // ============================================
  // 🔔 GENERAL PUSH NOTIFICATION
  // ============================================

  sendPushToUser(userId, title, body, data = {}) => {
    return await notificationService.sendPushNotification(userId, title, body, data);
  },

  // ============================================
  // 🚑 =========================================
  // AMBULANCE BLITZ RESPONSE - EMERGENCY NOTIFICATIONS
  // 🚑 =========================================
  // ============================================

  // ============================================
  // 🚑 EMERGENCY ALERT TO DRIVER
  // ============================================

  sendDriverEmergencyAlert(driverPhone, emergencyData) => {
    const {
      bookingId,
      patientName,
      patientCondition,
      pickupAddress,
      distance,
      eta,
      estimatedFare,
      surgeMultiplier
    } = emergencyData;

    let msg = [
      `🚨 EMERGENCY REQUEST!`,
      `Patient: ${patientName || 'Unknown'}`,
      `Condition: ${patientCondition || 'Not specified'}`,
      `Pickup: ${pickupAddress || 'GPS location'}`,
      `Distance: ${distance || '?'} km | ETA: ${eta || '?'} min`,
      `Est. Fare: ₹${estimatedFare || '?'}`,
      surgeMultiplier > 1 ? `⚠️ Surge: ${surgeMultiplier}x` : '',
      `Accept within 15 seconds!`,
      `Booking ID: ${bookingId}`
    ].filter(Boolean).join('\n');

    // Send with emergency priority (bypasses DND, loud alert)
    return await notificationService.sendSMS(driverPhone, msg, 'emergency');
  },

  // ============================================
  // 🚑 DRIVER ACCEPTED - NOTIFY PATIENT
  // ============================================

  sendDriverAcceptedAlert(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const email = notificationService._getPatientEmail(booking);
    const driverName = booking.driverName || 'Driver';
    const driverPhone = booking.driverPhone || '';
    const vehicleNumber = booking.vehicleNumber || '';
    const vehicleType = booking.ambulanceType || booking.vehicleType || 'Ambulance';
    const eta = booking.digitalTripSheet?.duration || '5';
    const trackingUrl = booking.trackingUrl || `${FRONTEND_URL}/ambulance/tracking/${booking.bookingId}`;
    const tripOtp = booking.tripOtp || '';

    const msg = [
      `✅ Ambulance Confirmed!`,
      `Driver: ${driverName} (${driverPhone})`,
      `Vehicle: ${vehicleNumber} (${vehicleType})`,
      `ETA: ${eta} minutes`,
      `Track: ${trackingUrl}`,
      `OTP: ${tripOtp}`,
      `Booking: ${booking.bookingId || ''}`
    ].join('\n');

    const subject = '🚑 Ambulance Confirmed - HealthCare Hub';
    const html = `
      <div style="background:#e8f5e9;padding:20px;border-left:5px solid #4caf50;">
        <h2 style="color:#2e7d32;">🚑 Ambulance Confirmed</h2>
        <p><strong>Driver:</strong> ${driverName}</p>
        <p><strong>Vehicle:</strong> ${vehicleNumber} (${vehicleType})</p>
        <p><strong>ETA:</strong> ${eta} minutes</p>
        <p><strong>OTP:</strong> <span style="font-size:24px;font-weight;">${tripOtp}</span></p>
        <p><a href="${trackingUrl}" style="background:#4caf50;color;padding:10px 20px;text-decoration;border-radius:5px;">Track Live</a></p>
      </div>
    `;

    const notifications = [];
    if (phone) notifications.push(notificationService.sendSMS(phone, msg, 'emergency'));
    if (email) notifications.push(notificationService.sendEmail(email, subject, html));
    
    await Promise.allSettled(notifications);
    return { success, type: 'driver_accepted' };
  },

  // ============================================
  // 🚑 EMERGENCY CONTACTS SMS
  // ============================================

  sendEmergencyContactSMS(contactPhone, contactName, emergencyData) => {
    const {
      patientName,
      ambulanceType,
      vehicleNumber,
      driverName,
      driverPhone,
      eta,
      trackingUrl,
      hospitalName
    } = emergencyData;

    const msg = [
      `🚨 EMERGENCY ALERT`,
      `${patientName || 'Someone'} has requested an emergency ambulance.`,
      ``,
      `🚑 Ambulance: ${vehicleNumber || 'Assigned'} (${ambulanceType || 'Emergency'})`,
      `👨‍⚕️ Driver: ${driverName || 'On the way'} (${driverPhone || ''})`,
      `⏱️ ETA: ${eta || '5'} minutes`,
      `🏥 Destination: ${hospitalName || 'Nearest hospital'}`,
      ``,
      `📍 Track live: ${trackingUrl || FRONTEND_URL}`,
      ``,
      `For assistance, call the driver directly.`
    ].join('\n');

    return await notificationService.sendSMS(contactPhone, msg, 'emergency');
  },

  // ============================================
  // 🚑 HOSPITAL ER NOTIFICATION
  // ============================================

  sendHospitalERNotification(hospitalPhone, hospitalEmail, emergencyData) => {
    const {
      bookingId,
      patientName,
      patientAge,
      patientGender,
      chiefComplaint,
      patientCondition,
      ambulanceType,
      vehicleNumber,
      eta,
      driverPhone,
      vitals,
      insuranceProvider,
      insurancePolicyNumber
    } = emergencyData;

    const msg = [
      `🏥 INCOMING EMERGENCY PATIENT`,
      `Patient: ${patientName || 'Unknown'}, ${patientAge || '?'}y, ${patientGender || '?'}`,
      `Condition: ${chiefComplaint || patientCondition || 'Not specified'}`,
      `Ambulance: ${vehicleNumber || 'En route'} (${ambulanceType || 'Emergency'})`,
      `ETA: ${eta || '5'} minutes`,
      `Driver Contact: ${driverPhone || 'N/A'}`,
      vitals ? `Vitals:${vitals.bloodPressure || '?'} | SpO2:${vitals.spo2 || '?'}%` : '',
      insuranceProvider ? `Insurance: ${insuranceProvider} (${insurancePolicyNumber || 'N/A'})` : '',
      `Booking ID: ${bookingId || 'N/A'}`,
      ``,
      `Please prepare emergency department.`
    ].filter(Boolean).join('\n');

    const subject = `🚨 INCOMING EMERGENCY - ${patientName || 'Patient'} - ETA ${eta || '5'} min`;
    const html = `
      <div style="background:#fff3e0;padding:20px;border-left:5px solid #ff6f00;">
        <h2 style="color:#e65100;">🚨 Incoming Emergency Patient</h2>
        <p><strong>Patient:</strong> ${patientName || 'Unknown'}, ${patientAge || '?'}y, ${patientGender || '?'}</p>
        <p><strong>Condition:</strong> ${chiefComplaint || 'Not specified'}</p>
        <p><strong>Ambulance:</strong> ${vehicleNumber || 'En route'} (${ambulanceType || 'Emergency'})</p>
        <p><strong>ETA:</strong> <span style="font-size:24px;color:#e65100;">${eta || '5'} minutes</span></p>
        ${vitals ? `<p><strong>Vitals:</strong> BP: ${vitals.bloodPressure || '?'} | SpO2: ${vitals.spo2 || '?'}%</p>` : ''}
        ${insuranceProvider ? `<p><strong>Insurance:</strong> ${insuranceProvider} (${insurancePolicyNumber || 'N/A'})</p>` : ''}
        <p><strong>Action Required:</strong> Prepare emergency department immediately.</p>
      </div>
    `;

    const notifications = [];
    if (hospitalPhone) notifications.push(notificationService.sendSMS(hospitalPhone, msg, 'emergency'));
    if (hospitalEmail) notifications.push(notificationService.sendEmail(hospitalEmail, subject, html));
    
    await Promise.allSettled(notifications);
    return { success, type: 'hospital_notified' };
  },

  // ============================================
  // 🚑 DRIVER LOCATION UPDATE (TO PATIENT)
  // ============================================

  sendDriverLocationUpdate(booking, newEta) => {
    const phone = notificationService._getPatientPhone(booking);
    const msg = `🚑 Ambulance updateis now ${newEta} minutes. Track live: ${booking.trackingUrl || FRONTEND_URL}`;
    
    return await notificationService.sendSMS(phone, msg, 'high');
  },

  // ============================================
  // 🚑 DRIVER ARRIVED AT PICKUP
  // ============================================

  sendDriverArrivedAlert(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const driverName = booking.driverName || 'Driver';
    const vehicleNumber = booking.vehicleNumber || '';
    const tripOtp = booking.tripOtp || '';

    const msg = [
      `🚑 Ambulance has arrived!`,
      `Driver: ${driverName}`,
      `Vehicle: ${vehicleNumber}`,
      `OTP: ${tripOtp} - Share with driver to verify`,
    ].join('\n');

    return await notificationService.sendSMS(phone, msg, 'emergency');
  },

  // ============================================
  // 🚑 PATIENT ONBOARD - NOTIFY HOSPITAL
  // ============================================

  sendPatientOnboardAlert(booking) => {
    const hospitalPhone = booking.hospitalDestination?.phone || '';
    const hospitalEmail = booking.hospitalDestination?.email || '';
    const eta = booking.digitalTripSheet?.duration || '10';
    const patientName = notificationService._getPatientName(booking);

    const msg = `🏥 UPDATE: ${patientName} is onboard and heading to your facility. Revised ETA: ${eta} minutes.`;
    const subject = `Patient Onboard - ETA ${eta} minutes`;

    const notifications = [];
    if (hospitalPhone) notifications.push(notificationService.sendSMS(hospitalPhone, msg, 'high'));
    if (hospitalEmail) notifications.push(notificationService.sendEmail(hospitalEmail, subject, msg));
    
    await Promise.allSettled(notifications);
    return { success};
  },

  // ============================================
  // 🚑 ARRIVED AT HOSPITAL
  // ============================================

  sendArrivedHospitalAlert(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const email = notificationService._getPatientEmail(booking);
    const hospitalName = booking.hospitalDestination?.hospitalName || 'Hospital';
    const tripSheetUrl = `${FRONTEND_URL}/ambulance/trip-sheet/${booking.bookingId}`;

    const msg = `🏥 Arrived at ${hospitalName}. Your digital trip sheet will be available at: ${tripSheetUrl}`;
    const subject = `Arrived at ${hospitalName} - HealthCare Hub`;
    const html = `<h2>Arrived at Hospital</h2><p>${msg}</p><p><a href="${tripSheetUrl}">View Trip Sheet</a></p>`;

    const notifications = [];
    if (phone) notifications.push(notificationService.sendSMS(phone, msg));
    if (email) notifications.push(notificationService.sendEmail(email, subject, html));
    
    await Promise.allSettled(notifications);
    return { success};
  },

  // ============================================
  // 🚑 TRIP COMPLETED
  // ============================================

  sendTripCompletedAlert(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const email = notificationService._getPatientEmail(booking);
    const fareBreakdown = booking.fareBreakdown || {};
    const tripSheetUrl = `${FRONTEND_URL}/ambulance/trip-sheet/${booking.bookingId}`;
    const bookingId = booking.bookingId || 'N/A';

    const msg = [
      `✅ Trip Completed`,
      `Fare: ₹${fareBreakdown.total || booking.finalAmount || '?'}`,
      `Trip Sheet: ${tripSheetUrl}`,
      `Booking ID: ${bookingId}`,
      `Thank you for using HealthCare Hub!`
    ].join('\n');

    const subject = 'Trip Completed - HealthCare Hub';
    const html = `
      <div style="background:#e8f5e9;padding:20px;">
        <h2>✅ Trip Completed</h2>
        <p><strong>Fare:</strong> ₹${fareBreakdown.total || booking.finalAmount || '?'}</p>
        <p><a href="${tripSheetUrl}">Download Digital Trip Sheet (for insurance)</a></p>
        <p>Thank you for trusting HealthCare Hub in your emergency.</p>
      </div>
    `;

    const notifications = [];
    if (phone) notifications.push(notificationService.sendSMS(phone, msg));
    if (email) notifications.push(notificationService.sendEmail(email, subject, html));
    
    await Promise.allSettled(notifications);
    return { success};
  },

  // ============================================
  // 🚑 NO DRIVER FOUND - FALLBACK ALERT
  // ============================================

  sendNoDriverFoundAlert(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    
    const msg = [
      `⚠️ URGENTambulance available nearby.`,
      `We recommend calling 108 (National Ambulance) immediately.`,
      `We are expanding our network. Sorry for the inconvenience.`,
      `Booking ID: ${booking.bookingId || 'N/A'}`
    ].join('\n');

    return await notificationService.sendSMS(phone, msg, 'emergency');
  },

  // ============================================
  // 🚑 DRIVER CANCELLED - RE-DISPATCHING
  // ============================================

  sendDriverCancelledAlert(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    
    const msg = [
      `⚠️ Driver cancelled. Re-dispatching...`,
      `We are finding another ambulance for you.`,
      `If urgent, call 108 directly.`,
      `Booking ID: ${booking.bookingId || 'N/A'}`
    ].join('\n');

    return await notificationService.sendSMS(phone, msg, 'emergency');
  },

  // ============================================
  // 🚑 EMERGENCY CANCELLED BY PATIENT
  // ============================================

  sendEmergencyCancelledAlert(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const refundAmount = booking.emergencyCancellation?.refundAmount || 0;

    const msg = [
      `Emergency booking cancelled.`,
      refundAmount > 0 ? `Refund: ₹${refundAmount} will be processed.` : '',
      `Booking ID: ${booking.bookingId || 'N/A'}`,
      `We hope you are safe. Contact support if needed.`
    ].filter(Boolean).join('\n');

    return await notificationService.sendSMS(phone, msg);
  },

  // ============================================
  // 🚑 TRIP SHEET READY
  // ============================================

  sendTripSheetReadyAlert(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const email = notificationService._getPatientEmail(booking);
    const tripSheetUrl = `${FRONTEND_URL}/ambulance/trip-sheet/${booking.bookingId}`;

    const msg = `Your digital trip sheet is ready for insurance claims: ${tripSheetUrl}`;
    const subject = 'Trip Sheet Ready - HealthCare Hub';
    const html = `<h2>Trip Sheet Ready</h2><p>${msg}</p><p><a href="${tripSheetUrl}">Download Trip Sheet</a></p>`;

    const notifications = [];
    if (phone) notifications.push(notificationService.sendSMS(phone, msg));
    if (email) notifications.push(notificationService.sendEmail(email, subject, html));
    
    await Promise.allSettled(notifications);
    return { success};
  },

  // ============================================
  // 🚑 SURGE PRICING ALERT
  // ============================================

  sendSurgePricingAlert(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const surgeMultiplier = booking.surgeMultiplier || 1.5;
    const reason = booking.surgeReason || 'High demand';

    const msg = `⚠️ Surge pricing active (${surgeMultiplier}x) due to ${reason}. Fare estimate updated. Accept to continue.`;
    return await notificationService.sendSMS(phone, msg, 'high');
  },

  // ============================================
  // 🚑 SCHEDULED AMBULANCE REMINDER
  // ============================================

  scheduledAmbulanceReminder(booking) => {
    const phone = notificationService._getPatientPhone(booking);
    const date = booking.appointmentDate || booking.scheduledDate || new Date();
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
      weekday: 'long', month: 'long', day: 'numeric'
    });
    const time = booking.timeSlot || booking.time || 'Scheduled';
    const pickupAddress = booking.pickupAddress || 'Your location';

    const msg = `Reminderscheduled ambulance will arrive at ${pickupAddress} on ${formattedDate} at ${time}. Booking ID: ${booking.bookingId || ''}`;
    return await notificationService.sendSMS(phone, msg, 'high');
  },

  // ============================================
  // 🚑 AMBULANCE PROVIDER WEEKLY SUMMARY
  // ============================================

  sendProviderWeeklySummary(providerPhone, providerName, stats) => {
    const {
      totalTrips,
      emergencyTrips,
      scheduledTrips,
      totalEarnings,
      averageRating,
      averageResponseTime
    } = stats;

    const msg = [
      `📊 Weekly Summary - ${providerName}`,
      `Total Trips: ${totalTrips || 0}`,
      `Emergency: ${emergencyTrips || 0} | Scheduled: ${scheduledTrips || 0}`,
      `Earnings: ₹${totalEarnings || 0}`,
      `Rating: ${averageRating || 'N/A'} ⭐`,
      `Avg Response: ${averageResponseTime || 'N/A'} seconds`,
      ``,
      `View detailed report on your dashboard.`
    ].join('\n');

    return await notificationService.sendSMS(providerPhone, msg);
  },

  // ============================================
  // 🚑 DRIVER DAILY EARNINGS SUMMARY
  // ============================================

  sendDriverDailySummary(driverPhone, driverName, stats) => {
    const { trips, earnings, rating } = stats;

    const msg = [
      `📊 Today's Summary - ${driverName}`,
      `Trips: ${trips || 0}`,
      `Earnings: ₹${earnings || 0}`,
      `Rating: ${rating || 'N/A'} ⭐`,
      `Great work today! 💪`
    ].join('\n');

    return await notificationService.sendSMS(driverPhone, msg);
  }
};

module.exports = notificationService;


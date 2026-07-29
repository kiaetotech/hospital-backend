const nodemailer = require('nodemailer');

// ============================================
// EMAIL CONFIGURATION
// ============================================

const transporter = nodemailer.createTransport({
  service.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user.env.EMAIL_USER || 'your_email@gmail.com',
    pass.env.EMAIL_PASS || 'your_app_password'
  }
});

// ============================================
// COMMON STYLES
// ============================================

const emailStyles = `
  <style>
    .email-container { font-family, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .email-header { background-gradient(135deg, #10b981, #059669); padding: 30px; text-align; color; }
    .email-header h1 { margin: 0; font-size: 24px; }
    .email-header .icon { font-size: 48px; margin-bottom: 10px; }
    .email-body { padding: 30px; }
    .email-body p { color: #374151; line-height: 1.6; margin: 10px 0; }
    .info-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px; margin: 20px 0; }
    .info-box table { width: 100%; border-collapse; }
    .info-box td { padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .info-box td-child { color: #6b7280; width: 40%; }
    .info-box td-child { color: #1f2937; font-weight: 600; }
    .amount-box { background: #eff6ff; border: 2px solid #3b82f6; border-radius: 10px; padding: 15px; text-align; margin: 20px 0; }
    .amount-box .amount { font-size: 32px; font-weight; color: #3b82f6; }
    .amount-box .label { font-size: 14px; color: #6b7280; }
    .status-badge { display-block; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight; }
    .status-confirmed { background: #d1fae5; color: #065f46; }
    .status-cancelled { background: #fee2e2; color: #991b1b; }
    .status-refunded { background: #fef3c7; color: #92400e; }
    .cta-button { display-block; background: #10b981; color; padding: 14px 30px; border-radius: 8px; text-decoration; font-weight; font-size: 16px; margin: 20px 0; }
    .cta-button-red { background: #ef4444; }
    .email-footer { background: #f9fafb; padding: 20px; text-align; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
    .divider { border-top: 1px solid #e5e7eb; margin: 20px 0; }
    .highlight { color: #10b981; font-weight; }
    .warning { background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 15px; margin: 15px 0; font-size: 14px; }
  </style>
`;

// ============================================
// HELPERCURRENCY
// ============================================

const formatCurrency = (amount) => {
  return `₹${(amount || 0).toLocaleString('en-IN')}`;
};

// ============================================
// HELPERDATE
// ============================================

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// ============================================
// HELPERBOOKING TYPE ICON & LABEL
// ============================================

const getBookingTypeInfo = (bookingType) => {
  const types = {
    'opd': { icon: '🏥', label: 'OPD Consultation', color: '#10b981' },
    'admission': { icon: '🏨', label: 'Hospital Admission', color: '#3b82f6' },
    'ambulance': { icon: '🚑', label: 'Ambulance Service', color: '#ef4444' },
    'labtest': { icon: '🔬', label: 'Lab Test', color: '#8b5cf6' },
    'health_package': { icon: '📦', label: 'Health Package', color: '#f59e0b' },
    'caregiver': { icon: '🏠', label: 'Caregiver Service', color: '#ec4899' },
    'ayurveda_consultation': { icon: '🧘', label: 'Ayurveda Consultation', color: '#f97316' },
    'ayurveda_panchakarma': { icon: '🍃', label: 'Panchakarma Treatment', color: '#84cc16' },
    'homeopathy_consult': { icon: '🌿', label: 'Homeopathy Consultation', color: '#14b8a6' },
    'homeopathy_medicine': { icon: '💊', label: 'Homeopathy Medicine', color: '#6366f1' },
    'insurance': { icon: '🛡️', label: 'Insurance Policy', color: '#0ea5e9' }
  };
  return types[bookingType] || { icon: '📋', label: 'Booking', color: '#6b7280' };
};

// ============================================
// HELPERBOOKING INFO TABLE
// ============================================

const buildBookingInfoRows = (booking) => {
  const typeInfo = getBookingTypeInfo(booking.bookingType);
  let rows = `
    <tr><td>Booking ID</td><td>${booking.bookingId}</td></tr>
    <tr><td>Booking Type</td><td>${typeInfo.icon} ${typeInfo.label}</td></tr>
    <tr><td>Patient Name</td><td>${booking.patientName}</td></tr>
    <tr><td>Patient Phone</td><td>${booking.patientPhone}</td></tr>
    <tr><td>Status</td><td><span class="status-badge status-confirmed">✅ Confirmed</span></td></tr>
  `;

  // Hospital/OPD specific
  if (booking.bookingType === 'opd' || booking.bookingType === 'admission') {
    if (booking.hospitalName) rows += `<tr><td>Hospital</td><td>${booking.hospitalName}</td></tr>`;
    if (booking.doctorName) rows += `<tr><td>Doctor</td><td>${booking.doctorName}</td></tr>`;
    if (booking.doctorSpecialization) rows += `<tr><td>Specialization</td><td>${booking.doctorSpecialization}</td></tr>`;
    if (booking.timeSlot) rows += `<tr><td>Time Slot</td><td>${booking.timeSlot}</td></tr>`;
    if (booking.consultationFee) rows += `<tr><td>Consultation Fee</td><td>${formatCurrency(booking.consultationFee)}</td></tr>`;
  }

  // Admission specific
  if (booking.bookingType === 'admission') {
    if (booking.roomType) rows += `<tr><td>Room Type</td><td>${booking.roomType}</td></tr>`;
    if (booking.numberOfDays) rows += `<tr><td>Duration</td><td>${booking.numberOfDays} day(s)</td></tr>`;
    if (booking.guardianName) rows += `<tr><td>Guardian</td><td>${booking.guardianName} (${booking.guardianPhone || 'N/A'})</td></tr>`;
  }

  // Ambulance specific
  if (booking.bookingType === 'ambulance') {
    if (booking.ambulanceType) rows += `<tr><td>Ambulance Type</td><td>${booking.ambulanceType}</td></tr>`;
    if (booking.pickupAddress) rows += `<tr><td>Pickup</td><td>${booking.pickupAddress}</td></tr>`;
    if (booking.dropAddress) rows += `<tr><td>Drop</td><td>${booking.dropAddress}</td></tr>`;
  }

  // Lab test specific
  if (booking.bookingType === 'labtest') {
    if (booking.providerName) rows += `<tr><td>Provider</td><td>${booking.providerName}</td></tr>`;
    if (booking.tests?.length > 0) rows += `<tr><td>Tests</td><td>${booking.tests.join(', ')}</td></tr>`;
    if (booking.homeCollectionRequested) rows += `<tr><td>Home Collection</td><td>✅ Yes - ${booking.homeAddress || ''}</td></tr>`;
  }

  // Caregiver specific
  if (booking.bookingType === 'caregiver') {
    if (booking.providerName) rows += `<tr><td>Caregiver</td><td>${booking.providerName}</td></tr>`;
  }

  // Ayurveda specific
  if (booking.bookingType === 'ayurveda_consultation') {
    if (booking.doctorName) rows += `<tr><td>Doctor</td><td>${booking.doctorName}</td></tr>`;
    if (booking.consultationType) rows += `<tr><td>Consultation</td><td>${booking.consultationType}</td></tr>`;
  }

  // Homeopathy specific
  if (booking.bookingType === 'homeopathy_consult') {
    if (booking.doctorName) rows += `<tr><td>Doctor</td><td>${booking.doctorName}</td></tr>`;
  }

  if (booking.bookingType === 'homeopathy_medicine') {
    if (booking.medicines?.length > 0) {
      const medList = booking.medicines.map(m => `${m.name} (${m.potency || ''}) x${m.quantity}`).join(', ');
      rows += `<tr><td>Medicines</td><td>${medList}</td></tr>`;
    }
    if (booking.deliveryAddress) rows += `<tr><td>Delivery To</td><td>${booking.deliveryAddress}</td></tr>`;
  }

  // Insurance specific
  if (booking.bookingType === 'insurance') {
    if (booking.insurancePlanName) rows += `<tr><td>Plan</td><td>${booking.insurancePlanName}</td></tr>`;
    if (booking.insuranceCompanyName) rows += `<tr><td>Company</td><td>${booking.insuranceCompanyName}</td></tr>`;
    if (booking.policyNumber) rows += `<tr><td>Policy Number</td><td>${booking.policyNumber}</td></tr>`;
    if (booking.sumInsured) rows += `<tr><td>Sum Insured</td><td>${formatCurrency(booking.sumInsured)}</td></tr>`;
  }

  // Common fields
  if (booking.appointmentDate) rows += `<tr><td>Date</td><td>${formatDate(booking.appointmentDate)}</td></tr>`;
  
  return rows;
};

// ============================================
// 🆕 SEND BOOKING CONFIRMATION EMAIL (ALL TYPES)
// ============================================

const sendBookingEmail = async (booking) => {
  try {
    if (!booking.patientEmail) {
      console.log('No email provided, skipping email notification');
      return;
    }

    const typeInfo = getBookingTypeInfo(booking.bookingType);
    const infoRows = buildBookingInfoRows(booking);
    const amount = booking.finalAmount || booking.totalAmount || 0;
    const discount = booking.discount || booking.discountAmount || 0;

    let discountSection = '';
    if (discount > 0) {
      discountSection = `
        <div class="info-box" style="background: #fef3c7; border-color: #fde68a;">
          <p style="color: #92400e;">🎉 You saved ${formatCurrency(discount)} on this booking!</p>
        </div>
      `;
    }

    let homeCollectionSection = '';
    if (booking.homeCollectionRequested && booking.homeAddress) {
      homeCollectionSection = `
        <div class="warning">
          🏠 <strong>Home Collection:</strong> Our technician will visit your address on ${formatDate(booking.appointmentDate)}.<br>
          <strong>Address:</strong> ${booking.homeAddress}
        </div>
      `;
    }

    let admissionSection = '';
    if (booking.bookingType === 'admission') {
      admissionSection = `
        <div class="warning">
          📋 <strong>Important:</strong> Please carry valid ID proof and medical records.<br>
          💰 Remaining amount of ${formatCurrency(booking.remainingAmount || 0)} to be paid at hospital.
        </div>
      `;
    }

    const mailOptions = {
      from: `"HealthCare Hub" <${process.env.EMAIL_USER || 'noreply@healthcarehub.com'}>`,
      to.patientEmail,
      subject: `✅ Booking Confirmed - ${booking.bookingId} | ${typeInfo.label}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>${emailStyles}</head>
        <body>
          <div class="email-container">
            <div class="email-header">
              <div class="icon">${typeInfo.icon}</div>
              <h1>Booking Confirmed!</h1>
              <p>Your ${typeInfo.label} has been booked successfully.</p>
            </div>
            <div class="email-body">
              <p>Dear <strong>${booking.patientName}</strong>,</p>
              <p>Great news! Your <span class="highlight">${typeInfo.label}</span> has been confirmed. Here are the details:</p>
              
              ${discountSection}
              
              <div class="info-box">
                <table>${infoRows}</table>
              </div>

              ${homeCollectionSection}
              ${admissionSection}

              <div class="amount-box">
                <div class="label">Total Amount Paid</div>
                <div class="amount">${formatCurrency(amount)}</div>
                ${booking.advanceAmount > 0 ? `<div class="label" style="margin-top:5px;">(Advance: ${formatCurrency(booking.advanceAmount)} | Balance: ${formatCurrency(booking.remainingAmount || 0)})</div>` : ''}
              </div>

              ${booking.bookingType === 'homeopathy_medicine' && booking.deliveryOTP ? `
                <div class="warning">
                  🔐 <strong>Delivery OTP:</strong> <span style="font-size:24px;font-weight;letter-spacing:3px;">${booking.deliveryOTP}</span><br>
                  <small>Share this OTP only at the time of delivery.</small>
                </div>
              ` : ''}

              <p>If you have any questions, please contact our support team.</p>
              <p>Thank you for choosing <strong>HealthCare Hub</strong>! 🙏</p>
            </div>
            <div class="email-footer">
              <p>HealthCare Hub - India's Most Trusted Healthcare Marketplace</p>
              <p>📞 +91-XXXXXXXXXX | ✉️ support@healthcarehub.com</p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Booking confirmation email sent to ${booking.patientEmail} (${booking.bookingType})`);
    return true;
  } catch (error) {
    console.error('❌ Email error:', error.message);
    return false;
  }
};

// ============================================
// 🆕 SEND CANCELLATION EMAIL (ALL TYPES)
// ============================================

const sendCancellationEmail = async (booking) => {
  try {
    if (!booking.patientEmail) return;

    const typeInfo = getBookingTypeInfo(booking.bookingType);
    const refundAmount = booking.cancellation?.refundAmount || 0;
    const refundPercentage = booking.cancellation?.refundPercentage || 0;
    const cancellationFee = booking.cancellation?.cancellationFee || 0;

    let refundSection = '';
    if (refundAmount > 0) {
      refundSection = `
        <div class="info-box" style="background: #eff6ff; border-color: #3b82f6;">
          <h3 style="color: #3b82f6; margin-top:0;">💳 Refund Information</h3>
          <table>
            <tr><td>Refund Amount</td><td style="color:#3b82f6;font-size:18px;">${formatCurrency(refundAmount)}</td></tr>
            <tr><td>Refund Percentage</td><td>${refundPercentage}%</td></tr>
            <tr><td>Cancellation Fee</td><td>${formatCurrency(cancellationFee)}</td></tr>
            <tr><td>Refund Status</td><td><span class="status-badge status-refunded">🔄 Processing</span></td></tr>
          </table>
          <p style="font-size:12px;color:#6b7280;margin-top:10px;">Refund will be credited to your original payment method within 5-7 business days.</p>
        </div>
      `;
    } else {
      refundSection = `
        <div class="info-box" style="background: #fef2f2; border-color: #fecaca;">
          <p style="color:#991b1b;">⚠️ No refund applicable as per cancellation policy (cancelled within 2 hours of appointment).</p>
        </div>
      `;
    }

    const mailOptions = {
      from: `"HealthCare Hub" <${process.env.EMAIL_USER || 'noreply@healthcarehub.com'}>`,
      to.patientEmail,
      subject: `❌ Booking Cancelled - ${booking.bookingId} | ${typeInfo.label}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>${emailStyles}</head>
        <body>
          <div class="email-container">
            <div class="email-header" style="background-gradient(135deg, #ef4444, #dc2626);">
              <div class="icon">❌</div>
              <h1>Booking Cancelled</h1>
              <p>Your ${typeInfo.label} has been cancelled.</p>
            </div>
            <div class="email-body">
              <p>Dear <strong>${booking.patientName}</strong>,</p>
              <p>Your booking has been cancelled as requested.</p>
              
              <div class="info-box">
                <table>
                  <tr><td>Booking ID</td><td>${booking.bookingId}</td></tr>
                  <tr><td>Booking Type</td><td>${typeInfo.icon} ${typeInfo.label}</td></tr>
                  <tr><td>Status</td><td><span class="status-badge status-cancelled">❌ Cancelled</span></td></tr>
                  ${booking.cancellation?.reason ? `<tr><td>Reason</td><td>${booking.cancellation.reason}</td></tr>` : ''}
                  <tr><td>Cancelled On</td><td>${formatDate(booking.cancellation?.cancelledAt || new Date())}</td></tr>
                </table>
              </div>

              ${refundSection}

              <a href="${process.env.FRONTEND_URL || 'https://hospital-frontend-kiaeto.vercel.app'}/hospitals" class="cta-button">Book Again</a>
              
              <p>We hope to serve you again soon!</p>
            </div>
            <div class="email-footer">
              <p>HealthCare Hub - India's Most Trusted Healthcare Marketplace</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Cancellation email sent to ${booking.patientEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Cancellation email error:', error.message);
    return false;
  }
};

// ============================================
// 🆕 SEND REFUND PROCESSED EMAIL
// ============================================

const sendRefundEmail = async (booking) => {
  try {
    if (!booking.patientEmail) return;

    const refundAmount = booking.refundAmount || booking.cancellation?.refundAmount || 0;

    const mailOptions = {
      from: `"HealthCare Hub" <${process.env.EMAIL_USER || 'noreply@healthcarehub.com'}>`,
      to.patientEmail,
      subject: `💰 Refund Processed - ${booking.bookingId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>${emailStyles}</head>
        <body>
          <div class="email-container">
            <div class="email-header" style="background-gradient(135deg, #f59e0b, #d97706);">
              <div class="icon">💰</div>
              <h1>Refund Processed!</h1>
              <p>Your refund has been initiated successfully.</p>
            </div>
            <div class="email-body">
              <p>Dear <strong>${booking.patientName}</strong>,</p>
              
              <div class="amount-box">
                <div class="label">Refund Amount</div>
                <div class="amount">${formatCurrency(refundAmount)}</div>
              </div>

              <div class="info-box">
                <table>
                  <tr><td>Booking ID</td><td>${booking.bookingId}</td></tr>
                  <tr><td>Refund ID</td><td>${booking.refundId || 'N/A'}</td></tr>
                  <tr><td>Refund Status</td><td><span class="status-badge status-confirmed">✅ Processed</span></td></tr>
                  <tr><td>Processed On</td><td>${formatDate(booking.refundedAt || new Date())}</td></tr>
                </table>
              </div>

              <p style="font-size:14px;color:#6b7280;">The amount will be credited to your original payment method within 5-7 business days.</p>
            </div>
            <div class="email-footer">
              <p>HealthCare Hub - India's Most Trusted Healthcare Marketplace</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Refund email sent to ${booking.patientEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Refund email error:', error.message);
    return false;
  }
};

// ============================================
// 🆕 SEND APPOINTMENT REMINDER EMAIL
// ============================================

const sendReminderEmail = async (booking) => {
  try {
    if (!booking.patientEmail) return;

    const typeInfo = getBookingTypeInfo(booking.bookingType);

    const mailOptions = {
      from: `"HealthCare Hub" <${process.env.EMAIL_USER || 'noreply@healthcarehub.com'}>`,
      to.patientEmail,
      subject: `⏰ Reminder${typeInfo.label} is tomorrow!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>${emailStyles}</head>
        <body>
          <div class="email-container">
            <div class="email-header" style="background-gradient(135deg, #3b82f6, #2563eb);">
              <div class="icon">⏰</div>
              <h1>Appointment Reminder</h1>
              <p>Your ${typeInfo.label} is scheduled for tomorrow.</p>
            </div>
            <div class="email-body">
              <p>Dear <strong>${booking.patientName}</strong>,</p>
              <p>This is a friendly reminder about your upcoming appointment:</p>
              
              <div class="info-box">
                <table>
                  ${buildBookingInfoRows(booking)}
                </table>
              </div>

              <div class="warning">
                📌 <strong>Please Note:</strong><br>
                • Arrive 15 minutes before your scheduled time<br>
                • Carry valid ID proof<br>
                • Bring any previous medical records if available
              </div>
            </div>
            <div class="email-footer">
              <p>HealthCare Hub - India's Most Trusted Healthcare Marketplace</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Reminder email sent to ${booking.patientEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Reminder email error:', error.message);
    return false;
  }
};

// ============================================
// 🆕 SEND HOSPITAL APPROVAL EMAIL
// ============================================

const sendHospitalApprovalEmail = async (hospital, status, remarks = '') => {
  try {
    if (!hospital.contact?.email) return;

    const isApproved = status === 'approved';
    
    const mailOptions = {
      from: `"HealthCare Hub" <${process.env.EMAIL_USER || 'noreply@healthcarehub.com'}>`,
      to.contact.email,
      subject? `🎉 Hospital Approved! - ${hospital.name}` : `⚠️ Hospital Verification Update - ${hospital.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>${emailStyles}</head>
        <body>
          <div class="email-container">
            <div class="email-header" style="background-gradient(135deg, ${isApproved ? '#10b981, #059669' : '#f59e0b, #d97706'});">
              <div class="icon">${isApproved ? '🎉' : '⚠️'}</div>
              <h1>${isApproved ? 'Hospital Approved!' : 'Verification Update'}</h1>
              <p>${hospital.name}</p>
            </div>
            <div class="email-body">
              <p>Dear Hospital Admin,</p>
              
              <div class="info-box" style="background: ${isApproved ? '#f0fdf4' : '#fef3c7'}; border-color: ${isApproved ? '#bbf7d0' : '#fde68a'};">
                <table>
                  <tr><td>Hospital</td><td>${hospital.name}</td></tr>
                  <tr><td>Status</td><td><span class="status-badge ${isApproved ? 'status-confirmed' : 'status-refunded'}">${isApproved ? '✅ Approved' : '⏳ Action Required'}</span></td></tr>
                  ${remarks ? `<tr><td>Remarks</td><td>${remarks}</td></tr>` : ''}
                </table>
              </div>

              ${isApproved ? `
                <p>Your hospital is now live on our platform! Patients can now:</p>
                <ul>
                  <li>🔍 Find your hospital in search results</li>
                  <li>📋 Book OPD appointments</li>
                  <li>🏥 Book admissions</li>
                </ul>
                <a href="${process.env.FRONTEND_URL || 'https://hospital-frontend-kiaeto.vercel.app'}/hospital/dashboard" class="cta-button">Go to Dashboard</a>
              ` : `
                <p>Please login to your dashboard and complete the pending requirements.</p>
                <a href="${process.env.FRONTEND_URL || 'https://hospital-frontend-kiaeto.vercel.app'}/hospital/login" class="cta-button cta-button-red">Complete Verification</a>
              `}
            </div>
            <div class="email-footer">
              <p>HealthCare Hub - India's Most Trusted Healthcare Marketplace</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Hospital approval email sent to ${hospital.contact.email}`);
    return true;
  } catch (error) {
    console.error('❌ Hospital approval email error:', error.message);
    return false;
  }
};

// ============================================
// 🆕 SEND OTP EMAIL
// ============================================

const sendOTPEmail = async (email, otp, purpose = 'verification') => {
  try {
    if (!email) return;

    const mailOptions = {
      from: `"HealthCare Hub" <${process.env.EMAIL_USER || 'noreply@healthcarehub.com'}>`,
      to,
      subject: `🔐 Your OTP for ${purpose}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>${emailStyles}</head>
        <body>
          <div class="email-container">
            <div class="email-header">
              <div class="icon">🔐</div>
              <h1>Verification OTP</h1>
              <p>Use this OTP to complete your ${purpose}.</p>
            </div>
            <div class="email-body" style="text-align;">
              <div class="amount-box">
                <div class="label">Your OTP</div>
                <div class="amount" style="letter-spacing: 8px;">${otp}</div>
              </div>
              <p style="color:#6b7280;font-size:14px;">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
              <p style="color:#ef4444;font-size:12px;">If you didn't request this, please ignore this email.</p>
            </div>
            <div class="email-footer">
              <p>HealthCare Hub - India's Most Trusted Healthcare Marketplace</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ OTP email error:', error.message);
    return false;
  }
};

// ============================================
// SEND SMS (via Twilio)
// ============================================

const sendBookingSMS = async (booking) => {
  try {
    const typeInfo = getBookingTypeInfo(booking.bookingType);
    const message = `✅ ${typeInfo.label} Confirmed!\nID: ${booking.bookingId}\nDate: ${formatDate(booking.appointmentDate)}\nAmount: ${formatCurrency(booking.finalAmount || booking.totalAmount || 0)}\n- HealthCare Hub`;

    // Twilio integration
    if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
      await client.messages.create({
        body,
        to: `+91${booking.patientPhone}`,
        from.env.TWILIO_PHONE_NUMBER
      });
      console.log(`✅ SMS sent to ${booking.patientPhone}`);
    } else {
      console.log(`📱 SMS (simulated) to ${booking.patientPhone}: ${message}`);
    }
    return true;
  } catch (error) {
    console.error('❌ SMS error:', error.message);
    return false;
  }
};

// ============================================
// 🆕 SEND CANCELLATION SMS
// ============================================

const sendCancellationSMS = async (booking) => {
  try {
    const refundAmount = booking.cancellation?.refundAmount || 0;
    const message = `❌ Booking Cancelled\nID: ${booking.bookingId}\nRefund: ${formatCurrency(refundAmount)}\n- HealthCare Hub`;

    if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
      const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
      await client.messages.create({
        body,
        to: `+91${booking.patientPhone}`,
        from.env.TWILIO_PHONE_NUMBER
      });
      console.log(`✅ Cancellation SMS sent to ${booking.patientPhone}`);
    } else {
      console.log(`📱 Cancellation SMS (simulated): ${message}`);
    }
    return true;
  } catch (error) {
    console.error('❌ Cancellation SMS error:', error.message);
    return false;
  }
};

// ============================================
// 🆕 SEND REMINDER SMS
// ============================================

const sendReminderSMS = async (booking) => {
  try {
    const typeInfo = getBookingTypeInfo(booking.bookingType);
    const message = `⏰ Reminder${typeInfo.label} is tomorrow!\nID: ${booking.bookingId}\n- HealthCare Hub`;

    if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
      const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
      await client.messages.create({
        body,
        to: `+91${booking.patientPhone}`,
        from.env.TWILIO_PHONE_NUMBER
      });
      console.log(`✅ Reminder SMS sent to ${booking.patientPhone}`);
    } else {
      console.log(`📱 Reminder SMS (simulated): ${message}`);
    }
    return true;
  } catch (error) {
    console.error('❌ Reminder SMS error:', error.message);
    return false;
  }
};

// ============================================
// 🆕 SEND WHATSAPP MESSAGE (via Twilio)
// ============================================

const sendWhatsAppMessage = async (phone, message) => {
  try {
    if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER) {
      const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
      await client.messages.create({
        body,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:+91${phone}`
      });
      console.log(`✅ WhatsApp sent to ${phone}`);
    } else {
      console.log(`💬 WhatsApp (simulated) to ${phone}: ${message}`);
    }
    return true;
  } catch (error) {
    console.error('❌ WhatsApp error:', error.message);
    return false;
  }
};

// ============================================
// 🆕 SEND HOSPITAL BED UPDATE REMINDER (WhatsApp)
// ============================================

const sendBedUpdateReminder = async (hospital) => {
  try {
    if (!hospital.contact?.phone) return;
    
    const message = `🏥 ${hospital.name}update your bed status.\n\nReplyBEDS [total] AVL [available] ICU [icu_beds] VENT [ventilators] ER [OPEN/CLOSED]\n\nExampleBEDS 350 AVL 45 ICU 12 VENT 5 ER OPEN`;
    
    return await sendWhatsAppMessage(hospital.contact.phone, message);
  } catch (error) {
    console.error('❌ Bed update reminder error:', error.message);
    return false;
  }
};

// ============================================
// 🆕 SEND GENERIC EMAIL
// ============================================

const sendGenericEmail = async (to, subject, htmlContent) => {
  try {
    if (!to) return false;
    
    const mailOptions = {
      from: `"HealthCare Hub" <${process.env.EMAIL_USER || 'noreply@healthcarehub.com'}>`,
      to,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>${emailStyles}</head>
        <body>
          <div class="email-container">
            <div class="email-body">${htmlContent}</div>
            <div class="email-footer">
              <p>HealthCare Hub - India's Most Trusted Healthcare Marketplace</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Generic email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('❌ Generic email error:', error.message);
    return false;
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Email functions
  sendBookingEmail,
  sendCancellationEmail,
  sendRefundEmail,
  sendReminderEmail,
  sendHospitalApprovalEmail,
  sendOTPEmail,
  sendGenericEmail,
  
  // SMS functions
  sendBookingSMS,
  sendCancellationSMS,
  sendReminderSMS,
  
  // WhatsApp functions
  sendWhatsAppMessage,
  sendBedUpdateReminder,
  
  // Helpers
  getBookingTypeInfo,
  formatCurrency,
  formatDate
};


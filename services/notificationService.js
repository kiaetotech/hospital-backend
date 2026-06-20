const notificationService = {
  sendSMS: async (phone, message) => {
    // Integrate with MSG91, Twilio, or other SMS provider
    console.log(`[SMS] To: ${phone} | Message: ${message}`);
    return { success: true, provider: 'console' };
  },

  sendEmail: async (email, subject, html) => {
    // Integrate with SendGrid, Nodemailer, etc.
    console.log(`[EMAIL] To: ${email} | Subject: ${subject}`);
    return { success: true, provider: 'console' };
  },

  // Booking confirmation
  bookingConfirmed: async (booking) => {
    const patientMsg = `Your appointment with Dr. ${booking.doctorName || 'Doctor'} is confirmed on ${new Date(booking.bookingDate || booking.date).toLocaleDateString()} at ${booking.slotTime || booking.time}. Booking ID: ${booking.bookingId}`;
    
    await notificationService.sendSMS(booking.patient?.phone || booking.patientPhone, patientMsg);
    
    if (booking.patient?.email || booking.patientEmail) {
      await notificationService.sendEmail(booking.patient?.email || booking.patientEmail, 'Booking Confirmed - Ayurveda Wellness Hub', `<h2>Booking Confirmed!</h2><p>${patientMsg}</p>`);
    }
  },

  // Doctor new booking alert
  doctorNewBooking: async (doctorPhone, booking) => {
    const msg = `New booking! Patient: ${booking.patientName} on ${new Date(booking.date).toLocaleDateString()} at ${booking.time}. Booking ID: ${booking.bookingId}`;
    await notificationService.sendSMS(doctorPhone, msg);
  },

  // Payment received
  paymentReceived: async (booking) => {
    const msg = `Payment of ₹${booking.finalAmount} received for booking ${booking.bookingId}. Thank you!`;
    await notificationService.sendSMS(booking.patientPhone, msg);
  },

  // Payout processed
  payoutProcessed: async (providerPhone, amount) => {
    const msg = `Your payout of ₹${amount} has been processed and will be credited to your bank account.`;
    await notificationService.sendSMS(providerPhone, msg);
  },

  // Review request
  requestReview: async (booking) => {
    const msg = `How was your consultation with Dr. ${booking.doctorName}? Share your feedback: ${process.env.FRONTEND_URL || 'https://hospital-frontend-kiaeto.vercel.app'}/ayurveda/review/${booking.bookingId}`;
    await notificationService.sendSMS(booking.patientPhone, msg);
  }
};

module.exports = notificationService;
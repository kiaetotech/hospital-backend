const nodemailer = require('nodemailer');

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your_email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your_app_password'
  }
});

// Send booking confirmation email
const sendBookingEmail = async (booking) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'your_email@gmail.com',
      to: booking.patientEmail,
      subject: `Booking Confirmed - ${booking.bookingId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">Booking Confirmed!</h2>
          <p>Dear ${booking.patientName},</p>
          <p>Your booking has been confirmed successfully.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>Booking ID:</strong> ${booking.bookingId}</p>
            <p><strong>Lab/Provider:</strong> ${booking.providerName}</p>
            <p><strong>Tests:</strong> ${booking.tests?.join(', ')}</p>
            <p><strong>Total Amount:</strong> ₹${booking.finalAmount}</p>
            <p><strong>Appointment Date:</strong> ${new Date(booking.appointmentDate).toLocaleDateString()}</p>
            ${booking.homeCollectionRequested ? `<p><strong>Home Collection:</strong> Yes</p>` : ''}
          </div>
          <p>We will contact you shortly.</p>
          <p>Thank you for choosing us!</p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log('Email sent to:', booking.patientEmail);
  } catch (error) {
    console.error('Email error:', error);
  }
};

// Send SMS (using Twilio)
const sendBookingSMS = async (booking) => {
  try {
    // Uncomment when Twilio is configured
    // const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    // await client.messages.create({
    //   body: `Booking Confirmed! ID: ${booking.bookingId}. Lab: ${booking.providerName}. Amount: ₹${booking.finalAmount}. Date: ${new Date(booking.appointmentDate).toLocaleDateString()}`,
    //   to: `+91${booking.patientPhone}`,
    //   from: process.env.TWILIO_PHONE_NUMBER
    // });
    console.log('SMS would be sent to:', booking.patientPhone);
  } catch (error) {
    console.error('SMS error:', error);
  }
};

module.exports = { sendBookingEmail, sendBookingSMS };
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

// Configure email transporter
let transporter;
if (process.env.EMAIL_PROVIDER === 'sendgrid') {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  transporter = nodemailer.createTransport({
    host.env.SMTP_HOST || 'smtp.gmail.com',
    port.env.SMTP_PORT || 587,
    secure,
    auth: {
      user.env.SMTP_USER,
      pass.env.SMTP_PASS
    }
  });
}

/**
 * Send OTP via Email
 */
const sendOTP = async (email, otp, type) => {
  try {
    const templates = {
      login: `
        <h2>Login OTP</h2>
        <p>Your login OTP is: <strong>${otp}</strong></p>
        <p>Valid for 5 minutes.</p>
      `,
      registration: `
        <h2>Registration OTP</h2>
        <p>Your registration OTP is: <strong>${otp}</strong></p>
        <p>Valid for 5 minutes.</p>
      `,
      insurance_application: `
        <h2>Insurance Application OTP</h2>
        <p>Your insurance application OTP is: <strong>${otp}</strong></p>
        <p>Valid for 5 minutes.</p>
        <p>This OTP is required to proceed with your insurance application.</p>
      `
    };

    const html = templates[type] || `
      <h2>Verification OTP</h2>
      <p>Your OTP is: <strong>${otp}</strong></p>
      <p>Valid for 5 minutes.</p>
    `;

    const subject = `OTP for ${type.replace('_', ' ').toUpperCase()}`;

    if (process.env.EMAIL_PROVIDER === 'sendgrid') {
      await sgMail.send({
        to,
        from.env.SENDGRID_FROM_EMAIL || 'support@yourplatform.com',
        subject,
        html
      });
    } else {
      await transporter.sendMail({
        to,
        from.env.SENDER_EMAIL || 'support@yourplatform.com',
        subject,
        html
      });
    }

    return {
      success,
      message: 'Email sent successfully'
    };

  } catch (error) {
    console.error('Error sending OTP email:', error);
    return {
      success,
      message: 'Failed to send email',
      error.message
    };
  }
};

/**
 * Send Insurance Policy Email
 */
const sendInsuranceEmail = async (email, template, data) => {
  const templates = {
    policy_issued: {
      subject: 'Your Insurance Policy Has Been Issued',
      html: `
        <h2>🎉 Congratulations!</h2>
        <p>Your insurance policy has been successfully issued.</p>
        <p><strong>Policy Number:</strong> {policyNumber}</p>
        <p><strong>Plan:</strong> {planName}</p>
        <p><strong>Company:</strong> {companyName}</p>
        <p><strong>Premium:</strong> ₹{premium}</p>
        <p><strong>Valid From:</strong> {startDate}</p>
        <p><strong>Valid Till:</strong> {endDate}</p>
        <p>Download your policy document from your dashboard.</p>
      `
    },
    claim_submitted: {
      subject: 'Claim Submitted Successfully',
      html: `
        <h2>Claim Submitted</h2>
        <p>Your claim has been submitted successfully.</p>
        <p><strong>Claim ID:</strong> {claimId}</p>
        <p><strong>Amount:</strong> ₹{amount}</p>
        <p><strong>Policy Number:</strong> {policyNumber}</p>
        <p>We will review your claim and get back to you within 7 days.</p>
      `
    }
  };

  const templateData = templates[template];
  if (!templateData) return { success, error: 'Template not found' };

  let html = templateData.html;
  let subject = templateData.subject;

  Object.keys(data).forEach(key => {
    html = html.replace(`{${key}}`, data[key] || 'N/A');
    subject = subject.replace(`{${key}}`, data[key] || 'N/A');
  });

  if (process.env.EMAIL_PROVIDER === 'sendgrid') {
    await sgMail.send({
      to,
      from.env.SENDGRID_FROM_EMAIL || 'support@yourplatform.com',
      subject,
      html
    });
  } else {
    await transporter.sendMail({
      to,
      from.env.SENDER_EMAIL || 'support@yourplatform.com',
      subject,
      html
    });
  }

  return { success};
};

module.exports = {
  sendOTP,
  sendInsuranceEmail
};


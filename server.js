require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// JWT Authentication for Lab Agencies
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'hospital_platform_secret_key_2024';

// Authentication middleware for lab agencies
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please login first.' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
};

// Make available globally
global.authenticateToken = authenticateToken;
global.JWT_SECRET = JWT_SECRET;

// ============================================
// LOAN MODULE - AUTHENTICATION MIDDLEWARE
// ============================================
const authenticatePatient = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please login first.' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    if (user.role !== 'patient') {
      return res.status(403).json({ error: 'Patient access required.' });
    }
    req.user = user;
    next();
  });
};

const authenticateLender = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please login first.' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    if (user.role !== 'lender') {
      return res.status(403).json({ error: 'Lender access required.' });
    }
    req.user = user;
    next();
  });
};

global.authenticatePatient = authenticatePatient;
global.authenticateLender = authenticateLender;

// ============================================
// EXISTING ROUTES (PRESERVED)
// ============================================
const hospitalRoutes = require('./routes/hospitals');
const authRoutes = require('./routes/auth');
const caregiverRoutes = require('./routes/caregivers');
const diagnosticsRoutes = require('./routes/diagnostics'); 
const diagnosticsUploadRoutes = require('./routes/diagnostics-upload');
const ambulanceRoutes = require('./routes/ambulance');
const healthPackageRoutes = require('./routes/healthPackageRoutes');
const testRoutes = require('./routes/tests');
const uploadRoutes = require('./routes/upload');
const providerAuthRoutes = require('./routes/providerAuth');
const bookingRoutes = require('./routes/bookings');
const razorpayRoutes = require('./routes/payment');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');
const bookingStatusRoutes = require('./routes/booking-status');
const customPackageRoutes = require('./routes/custom-packages');
const lenderAuthRoutes = require('./routes/lenderAuth');
const adminLenderRoutes = require('./routes/adminLender');

// ============================================
// LENDER ROUTES (PRESERVED)
// ============================================
const lenderRoutes = require('./routes/lender');

// ============================================
// LOAN MODULE ROUTES (PRESERVED)
// ============================================
const loanPatientRoutes = require('./routes/loanPatient');
const loanLenderRoutes = require('./routes/loanLender');
const loanAdminRoutes = require('./routes/loanAdmin');
const loanWebhookRoutes = require('./routes/loanWebhook');

// ============================================
// PAYMENT MODULE ROUTES (PRESERVED)
// ============================================
const webhookRoutes = require('./routes/webhooks');

// ============================================
// AYURVEDA MODULE ROUTES (PRESERVED)
// ============================================
const ayurvedaRoutes = require('./routes/ayurveda-advanced');
const ayurvedaCenterRoutes = require('./routes/ayurveda-centers');
const ayurvedaPrescriptionRoutes = require('./routes/ayurveda-prescriptions');
const ayurvedaReportRoutes = require('./routes/ayurveda-reports');

// ============================================
// HOMEOPATHY MODULE ROUTES (PRESERVED)
// ============================================
const homeopathyRoutes = require('./routes/homeopathy');

// ============================================
// INSURANCE MODULE ROUTES (PRESERVED)
// ============================================
const insuranceRoutes = require('./routes/insurance');
const insuranceAdminRoutes = require('./routes/insurance-admin');

// ============================================
// OTP MODULE ROUTES (PRESERVED)
// ============================================
const otpRoutes = require('./routes/otp');

// ============================================
// CORPORATE MODULE ROUTES (PRESERVED)
// ============================================
const corporateRoutes = require('./routes/corporate');

// ============================================
// 🆕 MENTAL HEALTH MODULE ROUTES (ADDED)
// ============================================
const mentalHealthRoutes = require('./routes/mentalhealth');
const mentalHealthTherapistRoutes = require('./routes/mentalhealth-therapist');
const mentalHealthAdminRoutes = require('./routes/mentalhealth-admin');

// ============================================
// USE EXISTING ROUTES (PRESERVED)
// ============================================
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/caregivers', caregiverRoutes);
app.use('/api/diagnostics', diagnosticsRoutes); 
app.use('/api/diagnostics/upload', diagnosticsUploadRoutes);
app.use('/api/ambulance', ambulanceRoutes);
app.use('/api/health-packages', healthPackageRoutes);
app.use('/api/provider', healthPackageRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/provider-auth', providerAuthRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payment', razorpayRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/booking-status', bookingStatusRoutes);
app.use('/api/custom-packages', customPackageRoutes);
app.use('/api/lender/auth', lenderAuthRoutes);
app.use('/api/admin/lenders', adminLenderRoutes);

// ============================================
// LENDER ROUTES (PRESERVED)
// ============================================
app.use('/api/lender', lenderRoutes);

// ============================================
// LOAN ROUTES (PRESERVED)
// ============================================
app.use('/api/loan/patient', loanPatientRoutes);
app.use('/api/loan/lender', loanLenderRoutes);
app.use('/api/loan/admin', loanAdminRoutes);
app.use('/api/loan/webhook', loanWebhookRoutes);

// ============================================
// PAYMENT ROUTES (PRESERVED)
// ============================================
app.use('/api/webhooks', webhookRoutes);

// ============================================
// AYURVEDA ROUTES (PRESERVED)
// ============================================
app.use('/api/ayurveda', ayurvedaRoutes);
app.use('/api/ayurveda-centers', ayurvedaCenterRoutes);
app.use('/api/ayurveda/prescriptions', ayurvedaPrescriptionRoutes);
app.use('/api/ayurveda/reports', ayurvedaReportRoutes);
app.use('/api/ayurveda/payments', razorpayRoutes);

// ============================================
// HOMEOPATHY ROUTES (PRESERVED)
// ============================================
app.use('/api/homeopathy', homeopathyRoutes);

// ============================================
// INSURANCE ROUTES (PRESERVED)
// ============================================
app.use('/api/insurance', insuranceRoutes);
app.use('/api/insurance-admin', insuranceAdminRoutes);

// ============================================
// OTP ROUTES (PRESERVED)
// ============================================
app.use('/api/otp', otpRoutes);

// ============================================
// CORPORATE ROUTES (PRESERVED)
// ============================================
app.use('/api/corporate', corporateRoutes);

// ============================================
// 🆕 MENTAL HEALTH ROUTES (ADDED)
// ============================================
app.use('/api/mentalhealth', mentalHealthRoutes);
app.use('/api/mentalhealth/therapist', mentalHealthTherapistRoutes);
app.use('/api/mentalhealth/admin', mentalHealthAdminRoutes);

// ============================================
// HEALTH CHECK (PRESERVED)
// ============================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API is working' });
});

// ============================================
// INSURANCE HEALTH CHECK (PRESERVED)
// ============================================
app.get('/api/insurance/health', (req, res) => {
  res.json({
    success: true,
    module: 'Insurance',
    status: 'active',
    endpoints: {
      plans: '/api/insurance/plans',
      apply: '/api/insurance/apply',
      policies: '/api/insurance/my-policies',
      claims: '/api/insurance/claims',
      admin: '/api/insurance-admin'
    }
  });
});

// ============================================
// OTP HEALTH CHECK (PRESERVED)
// ============================================
app.get('/api/otp/health', (req, res) => {
  res.json({
    success: true,
    module: 'OTP',
    status: 'active',
    endpoints: {
      send: '/api/otp/send',
      verify: '/api/otp/verify',
      resend: '/api/otp/resend',
      status: '/api/otp/status'
    }
  });
});

// ============================================
// 🆕 MENTAL HEALTH HEALTH CHECK (ADDED)
// ============================================
app.get('/api/mentalhealth/health', (req, res) => {
  res.json({
    success: true,
    module: 'Mental Health',
    status: 'active',
    endpoints: {
      therapists: '/api/mentalhealth/therapists',
      booking: '/api/mentalhealth/book',
      screening: '/api/mentalhealth/screening',
      crisis: '/api/mentalhealth/crisis',
      admin: '/api/mentalhealth/admin'
    }
  });
});

// ============================================
// ERROR HANDLING (PRESERVED)
// ============================================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ============================================
// MONGODB CONNECTION (PRESERVED)
// ============================================
const DB_URI = process.env.DB_URI || 'mongodb://localhost:27017/hospital_db';
mongoose.connect(DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ============================================
// SERVER START (PRESERVED + UPDATED)
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📋 Loan modules available at /api/loan/*`);
  console.log(`💳 Payment routes available at /api/payment/*`);
  console.log(`🔗 Webhook routes available at /api/webhooks/*`);
  console.log(`🧘 Ayurveda module available at /api/ayurveda/*`);
  console.log(`🌿 Homeopathy module available at /api/homeopathy/*`);
  console.log(`🛡️ Insurance module available at /api/insurance/*`);
  console.log(`🛡️ Insurance Admin available at /api/insurance-admin/*`);
  console.log(`📱 OTP module available at /api/otp/*`);
  console.log(`🏢 Corporate module available at /api/corporate/*`);
  console.log(`🧠 Mental Health module available at /api/mentalhealth/*`);
  console.log(`🧠 Mental Health Therapist at /api/mentalhealth/therapist/*`);
  console.log(`🧠 Mental Health Admin at /api/mentalhealth/admin/*`);
  console.log(`✅ All modules loaded successfully!`);
});

// ============================================
// UNHANDLED REJECTION HANDLER (PRESERVED)
// ============================================
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

// ============================================
// UNCAUGHT EXCEPTION HANDLER (PRESERVED)
// ============================================
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});
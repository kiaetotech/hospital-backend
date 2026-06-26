require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const app = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Rate limiting for search endpoints
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: { success: false, message: 'Too many requests, please try again later.' }
});

// ============================================
// JWT AUTHENTICATION
// ============================================
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
// EXISTING ROUTES (ALL PRESERVED)
// ============================================
const hospitalRoutes = require('./routes/hospitals');
const hospitalProviderRoutes = require('./routes/hospitalProvider');
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
const corporateBillingRoutes = require('./routes/corporate-billing');

// ============================================
// MENTAL HEALTH MODULE ROUTES (PRESERVED)
// ============================================
const mentalHealthRoutes = require('./routes/mentalhealth');
const mentalHealthTherapistRoutes = require('./routes/mentalhealth-therapist');
const mentalHealthAdminRoutes = require('./routes/mentalhealth-admin');
const mentalHealthPayoutRoutes = require('./routes/mentalhealth-payout');
const mentalHealthEarningsRoutes = require('./routes/mentalhealth-earnings');

// ============================================
// 🆕 ONLINE DOCTOR MODULE ROUTES (NEW - 1 LINE)
// ============================================
const onlineDoctorRoutes = require('./routes/onlineDoctor');

// ============================================
// ROUTE MOUNTING - NO CONFLICTS
// ============================================

// 🏥 Hospital Routes
app.use('/api/hospitals', searchLimiter, hospitalRoutes);
app.use('/api/hospitals/provider', hospitalProviderRoutes);

// 🔐 Auth
app.use('/api/auth', authRoutes);
app.use('/api/provider-auth', providerAuthRoutes);

// 🏠 Caregivers
app.use('/api/caregivers', caregiverRoutes);

// 🔬 Diagnostics
app.use('/api/diagnostics', diagnosticsRoutes); 
app.use('/api/diagnostics/upload', diagnosticsUploadRoutes);

// 🚑 Ambulance
app.use('/api/ambulance', ambulanceRoutes);

// 📦 Health Packages
app.use('/api/health-packages', healthPackageRoutes);
app.use('/api/provider', healthPackageRoutes);

// 🧪 Tests
app.use('/api/tests', testRoutes);

// 📤 Upload
app.use('/api/upload', uploadRoutes);

// 📋 Bookings
app.use('/api/bookings', bookingRoutes);
app.use('/api/booking-status', bookingStatusRoutes);
app.use('/api/custom-packages', customPackageRoutes);

// 💳 Payment
app.use('/api/payment', razorpayRoutes);
app.use('/api/webhooks', webhookRoutes);

// ⭐ Reviews
app.use('/api/reviews', reviewRoutes);

// 🔧 Admin
app.use('/api/admin', adminRoutes);

// 💰 Lender
app.use('/api/lender/auth', lenderAuthRoutes);
app.use('/api/lender', lenderRoutes);
app.use('/api/admin/lenders', adminLenderRoutes);

// 💵 Loan Module
app.use('/api/loan/patient', loanPatientRoutes);
app.use('/api/loan/lender', loanLenderRoutes);
app.use('/api/loan/admin', loanAdminRoutes);
app.use('/api/loan/webhook', loanWebhookRoutes);

// 🧘 Ayurveda
app.use('/api/ayurveda', ayurvedaRoutes);
app.use('/api/ayurveda-centers', ayurvedaCenterRoutes);
app.use('/api/ayurveda/prescriptions', ayurvedaPrescriptionRoutes);
app.use('/api/ayurveda/reports', ayurvedaReportRoutes);
app.use('/api/ayurveda/payments', razorpayRoutes);

// 🌿 Homeopathy
app.use('/api/homeopathy', homeopathyRoutes);

// 🛡️ Insurance
app.use('/api/insurance', insuranceRoutes);
app.use('/api/insurance-admin', insuranceAdminRoutes);

// 📱 OTP
app.use('/api/otp', otpRoutes);

// 🏢 Corporate
app.use('/api/corporate', corporateRoutes);
app.use('/api/corporate/billing', corporateBillingRoutes);

// 🧠 Mental Health
app.use('/api/mentalhealth', mentalHealthRoutes);
app.use('/api/mentalhealth/therapist', mentalHealthTherapistRoutes);
app.use('/api/mentalhealth/admin', mentalHealthAdminRoutes);
app.use('/api/mentalhealth/payout', mentalHealthPayoutRoutes);
app.use('/api/mentalhealth/earnings', mentalHealthEarningsRoutes);

// 📱 Online Doctor (NEW - 1 LINE)
app.use('/api/online-doctor', searchLimiter, onlineDoctorRoutes);

// ============================================
// HEALTH CHECKS
// ============================================

// Root health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API is working' });
});

// Hospital Module Health Check
app.get('/api/hospitals/health', (req, res) => {
  res.json({
    success: true,
    module: 'Hospitals',
    status: 'active',
    version: '2.0',
    features: {
      public: {
        search: '/api/hospitals/search',
        details: '/api/hospitals/:id',
        whatsappUpdate: '/api/hospitals/whatsapp-update'
      },
      provider: {
        register: '/api/hospitals/provider/register',
        login: '/api/hospitals/provider/login',
        profile: '/api/hospitals/provider/profile',
        doctors: '/api/hospitals/provider/doctors',
        beds: '/api/hospitals/provider/bed-status',
        bookings: '/api/hospitals/provider/bookings',
        prescriptions: '/api/hospitals/provider/prescriptions',
        analytics: '/api/hospitals/provider/analytics',
        excelUpload: '/api/hospitals/provider/upload-doctors',
        template: '/api/hospitals/provider/template/download',
        schemes: '/api/hospitals/provider/schemes',
        insurance: '/api/hospitals/provider/insurance',
        facilities: '/api/hospitals/provider/facilities',
        packages: '/api/hospitals/provider/packages',
        offers: '/api/hospitals/provider/offers'
      },
      filters: {
        scheme: '/api/hospitals/search?scheme=ayushman',
        insurance: '/api/hospitals/search?insurance=star',
        cashless: '/api/hospitals/search?cashless=true',
        emergency: '/api/hospitals/search?emergency=true',
        bedsAvailable: '/api/hospitals/search?beds_available=true',
        rating: '/api/hospitals/search?min_rating=4.5',
        geospatial: '/api/hospitals/search?lat=19.07&lng=72.83&radius=50'
      }
    }
  });
});

// Insurance Health Check
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

// OTP Health Check
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

// Mental Health Health Check
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

// 🆕 Online Doctor Health Check (NEW)
app.get('/api/online-doctor/health', (req, res) => {
  res.json({
    success: true,
    module: 'Online Doctor',
    status: 'active',
    endpoints: {
      search: '/api/online-doctor/search',
      doctor: '/api/online-doctor/doctor/:id',
      book: '/api/online-doctor/book',
      register: '/api/online-doctor/doctor/register',
      login: '/api/online-doctor/doctor/login',
      dashboard: '/api/online-doctor/doctor/dashboard'
    }
  });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.originalUrl} not found` 
  });
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({ success: false, message: 'Duplicate entry found' });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }
  
  res.status(err.status || 500).json({ 
    success: false, 
    message: err.message || 'Internal server error' 
  });
});

// ============================================
// MONGODB CONNECTION
// ============================================
const DB_URI = process.env.DB_URI || 'mongodb://localhost:27017/hospital_db';
mongoose.connect(DB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ============================================
// SERVER START
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('═'.repeat(55));
  console.log('🚀 HealthCare Hub Server Started');
  console.log('═'.repeat(55));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('─'.repeat(55));
  console.log('📦 Modules Loaded:');
  console.log('─'.repeat(55));
  console.log('🏥  Hospitals        → /api/hospitals/*');
  console.log('🏥  Hospital Provider → /api/hospitals/provider/*');
  console.log('🚑  Ambulance         → /api/ambulance/*');
  console.log('🏠  Caregivers        → /api/caregivers/*');
  console.log('🔬  Diagnostics       → /api/diagnostics/*');
  console.log('🧘  Ayurveda          → /api/ayurveda/*');
  console.log('🌿  Homeopathy        → /api/homeopathy/*');
  console.log('🛡️  Insurance         → /api/insurance/*');
  console.log('🛡️  Insurance Admin   → /api/insurance-admin/*');
  console.log('🏢  Corporate         → /api/corporate/*');
  console.log('🧠  Mental Health     → /api/mentalhealth/*');
  console.log('📱  Online Doctor     → /api/online-doctor/*');
  console.log('💰  Loans             → /api/loan/*');
  console.log('💰  Lenders           → /api/lender/*');
  console.log('💳  Payments          → /api/payment/*');
  console.log('📋  Bookings          → /api/bookings/*');
  console.log('⭐  Reviews           → /api/reviews/*');
  console.log('📱  OTP               → /api/otp/*');
  console.log('🔧  Admin             → /api/admin/*');
  console.log('─'.repeat(55));
  console.log('✅ All modules loaded successfully!');
  console.log('═'.repeat(55));
});

// ============================================
// PROCESS HANDLERS
// ============================================
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err.message);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});
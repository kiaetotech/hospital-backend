require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');

const app = express();
const server = http.createServer(app);

// ============================================
// CORS CONFIGURATION (FIXED)
// ============================================
const allowedOrigins = [
  'https://hospital-frontend-kiaeto.vercel.app',
  'https://hospital-frontend-zeta-rosy.vercel.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for Railway
app.set('trust proxy', 1);

// ============================================
// REDIS CONNECTION (For Location Cache & Rate Limiting)
// ============================================

let redis = null;
try {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 10) {
        console.warn('⚠️ Redis: Max retries reached. Running without cache.');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true
  });

  redis.on('connect', () => console.log('📍 Redis connected'));
  redis.on('ready', () => console.log('📍 Redis: Ready'));
  redis.on('error', (err) => console.warn('⚠️ Redis error:', err.message));

  redis.connect().catch(() => {
    console.warn('⚠️ Redis connection failed - continuing without Redis');
    redis = null;
  });
} catch (error) {
  console.warn('⚠️ Redis not configured - running without cache');
}

global.redisClient = redis;

// ============================================
// SOCKET.IO SETUP
// ============================================

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Initialize WebSocket handlers
const { initializeSocket, getConnectionStats } = require('./socket/ambulanceSocket');
initializeSocket(io);

// Make io available globally (for use in routes/services)
global.io = io;

// ============================================
// REQUEST LOGGING
// ============================================
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Rate limiting for search endpoints
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

// ============================================
// JWT AUTHENTICATION
// ============================================
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'hospital_platform_secret_key_2024';

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

global.authenticateToken = authenticateToken;
global.JWT_SECRET = JWT_SECRET;

// ============================================
// AUTH MIDDLEWARES (All Tags)
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
// CRON JOBS
// ============================================

// Check for stuck ambulance bookings every 2 minutes
const dispatchService = require('./services/ambulanceDispatchService');
setInterval(async () => {
  try {
    const result = await dispatchService.checkStuckBookings();
    if (result.checked > 0) {
      console.log(`🔍 Stuck booking check: ${result.checked} checked`);
    }
  } catch (error) {
    console.error('Stuck booking check error:', error.message);
  }
}, 2 * 60 * 1000);

// Hospital status: Send scheduled WhatsApp requests every hour
const hospitalStatusService = require('./services/hospitalStatusService');
setInterval(async () => {
  try {
    await hospitalStatusService.sendScheduledRequests();
  } catch (error) {
    console.error('Hospital status request error:', error.message);
  }
}, 60 * 60 * 1000);

// Hospital status: Expire stale statuses every 30 minutes
setInterval(async () => {
  try {
    await hospitalStatusService.expireStaleStatuses();
  } catch (error) {
    console.error('Status expiry error:', error.message);
  }
}, 30 * 60 * 1000);

// Clean up stale Redis data every 15 minutes
if (redis) {
  setInterval(async () => {
    try {
      const locationCache = require('./services/locationCacheService');
      const stats = await locationCache.getServiceStats();
      console.log('📍 Location stats:', JSON.stringify(stats));
    } catch (error) {
      // Silently fail - not critical
    }
  }, 15 * 60 * 1000);
}

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
const lenderRoutes = require('./routes/lender');

// Loan Module
const loanPatientRoutes = require('./routes/loanPatient');
const loanLenderRoutes = require('./routes/loanLender');
const loanAdminRoutes = require('./routes/loanAdmin');
const loanWebhookRoutes = require('./routes/loanWebhook');

// Payment Module
const webhookRoutes = require('./routes/webhooks');

// Ayurveda Module
const ayurvedaRoutes = require('./routes/ayurveda-advanced');
const ayurvedaCenterRoutes = require('./routes/ayurveda-centers');
const ayurvedaPrescriptionRoutes = require('./routes/ayurveda-prescriptions');
const ayurvedaReportRoutes = require('./routes/ayurveda-reports');

// Homeopathy Module
const homeopathyRoutes = require('./routes/homeopathy');

// Insurance Module
const insuranceRoutes = require('./routes/insurance');
const insuranceAdminRoutes = require('./routes/insurance-admin');

// OTP Module
const otpRoutes = require('./routes/otp');

// Corporate Module
const corporateRoutes = require('./routes/corporate');
const corporateBillingRoutes = require('./routes/corporate-billing');
const corporateHubRoutes = require('./routes/corporateHub');

// Mental Health Module
const mentalHealthRoutes = require('./routes/mentalhealth');
const mentalHealthTherapistRoutes = require('./routes/mentalhealth-therapist');
const mentalHealthAdminRoutes = require('./routes/mentalhealth-admin');
const mentalHealthPayoutRoutes = require('./routes/mentalhealth-payout');
const mentalHealthEarningsRoutes = require('./routes/mentalhealth-earnings');

// Online Doctor Module
const onlineDoctorRoutes = require('./routes/onlineDoctor');

// 🆕 Hospital Status Module
const hospitalStatusRoutes = require('./routes/hospitalStatus');

// 🔍 Global Search Module
const globalSearchRoutes = require('./routes/globalSearch');
const employeePortalRoutes = require('./routes/employeePortal');

// ============================================
// ROUTE MOUNTING - ALL PRESERVED + NEW
// ============================================

// 🏥 Hospital Routes
app.use('/api/hospitals', searchLimiter, hospitalRoutes);
app.use('/api/hospitals/provider', hospitalProviderRoutes);
app.use('/api/hospital-status', hospitalStatusRoutes);  // 🆕

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
app.use('/api/corporate-hub', corporateHubRoutes);

// 🧠 Mental Health
app.use('/api/mentalhealth', mentalHealthRoutes);
app.use('/api/mentalhealth/therapist', mentalHealthTherapistRoutes);
app.use('/api/mentalhealth/admin', mentalHealthAdminRoutes);
app.use('/api/mentalhealth/payout', mentalHealthPayoutRoutes);
app.use('/api/mentalhealth/earnings', mentalHealthEarningsRoutes);

// 📱 Online Doctor
app.use('/api/online-doctor', searchLimiter, onlineDoctorRoutes);

// 🔍 Global Search (Cross-tag)
app.use('/api/search', searchLimiter, globalSearchRoutes);
app.use('/api/employee', employeePortalRoutes);

// ============================================
// WEBSOCKET HEALTH ENDPOINT
// ============================================

app.get('/api/ws/health', (req, res) => {
  const stats = getConnectionStats();
  res.json({
    success: true,
    websocket: {
      status: 'active',
      connections: stats,
      uptime: process.uptime()
    }
  });
});

// WebSocket stats for admin
app.get('/api/ws/stats', (req, res) => {
  const stats = getConnectionStats();
  res.json({
    success: true,
    data: {
      onlineDrivers: stats.drivers,
      onlineCaregivers: stats.caregivers,
      onlinePhlebotomists: stats.phlebotomists,
      trackingPatients: stats.patients,
      connectedHospitals: stats.hospitals,
      activeAdmins: stats.admins,
      totalConnections: stats.drivers + stats.caregivers + stats.phlebotomists + stats.patients + stats.hospitals + stats.admins,
      timestamp: stats.timestamp
    }
  });
});

// ============================================
// HEALTH CHECKS (ALL PRESERVED + NEW)
// ============================================

// Root health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis: redis ? 'connected' : 'unavailable',
    websocket: 'active',
    environment: process.env.NODE_ENV || 'development'
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

// 🆕 Hospital Status Health Check
app.get('/api/hospital-status/health', (req, res) => {
  res.json({
    success: true,
    module: 'Hospital Status (Green Light System)',
    status: 'active',
    version: '1.0',
    features: {
      statusUpdate: 'WhatsApp tap - Hospital updates status in 1 second',
      autoRequest: 'System sends status request at 8AM, 2PM, 8PM',
      autoExpire: 'Status auto-expires after 4 hours of no update',
      webhook: 'POST /api/hospital-status/webhook/whatsapp',
      bulk: 'POST /api/hospital-status/bulk'
    }
  });
});

// Ambulance Health Check
app.get('/api/ambulance/health', (req, res) => {
  res.json({
    success: true,
    module: 'Ambulance Blitz Response',
    status: 'active',
    version: '3.0',
    features: {
      emergency: {
        dispatch: 'POST /api/ambulance/emergency-dispatch',
        accept: 'POST /api/ambulance/accept-emergency/:id',
        tracking: 'GET /api/ambulance/active-emergency/:id',
        cancel: 'POST /api/ambulance/cancel-emergency/:id'
      },
      trip: {
        start: 'POST /api/ambulance/trip-start/:id',
        onboard: 'POST /api/ambulance/patient-onboard/:id',
        arrive: 'POST /api/ambulance/arrived-hospital/:id',
        complete: 'POST /api/ambulance/trip-complete/:id'
      },
      location: {
        update: 'POST /api/ambulance/update-location',
        nearby: 'GET /api/ambulance/nearby-ambulances',
        surge: 'GET /api/ambulance/surge-check'
      },
      scheduled: {
        book: 'POST /api/ambulance/schedule-transport',
        list: 'GET /api/ambulance/scheduled-bookings'
      },
      driver: {
        dashboard: 'GET /api/ambulance/driver/dashboard',
        toggle: 'POST /api/ambulance/driver/toggle-availability',
        history: 'GET /api/ambulance/driver/trip-history'
      },
      provider: {
        dashboard: 'GET /api/ambulance/provider/dashboard'
      },
      realtime: {
        websocket: 'ws://server/socket.io',
        stats: 'GET /api/ws/stats'
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

// Online Doctor Health Check
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

// Comprehensive System Health
app.get('/api/system/health', async (req, res) => {
  const healthData = {
    success: true,
    server: {
      status: 'running',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      port: PORT,
      memory: process.memoryUsage()
    },
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      host: mongoose.connection.host || 'N/A'
    },
    redis: {
      status: redis ? 'connected' : 'unavailable'
    },
    websocket: {
      status: 'active',
      connections: getConnectionStats()
    },
    modules: {
      hospitals: 'active',
      hospitalStatus: 'active',
      ambulance: 'active',
      caregivers: 'active',
      diagnostics: 'active',
      ayurveda: 'active',
      homeopathy: 'active',
      insurance: 'active',
      corporate: 'active',
      mentalHealth: 'active',
      onlineDoctor: 'active',
      loans: 'active',
      payments: 'active',
      otp: 'active'
    },
    timestamp: new Date().toISOString()
  };

  res.json(healthData);
});

// Global Search Health Check
app.get('/api/search/health', (req, res) => {
  res.json({
    success: true,
    module: 'Global Search',
    status: 'active',
    version: '1.0',
    features: {
      crossTag: 'Searches across all 11 tags simultaneously',
      models: ['Hospitals', 'Doctors', 'OnlineDoctors', 'Ayurveda', 'Homeopathy', 
               'MentalHealth', 'Caregivers', 'LabTests', 'Diagnostics', 'Ambulance', 
               'Insurance', 'Pharmacy', 'WellnessCenters', 'Naturopathy'],
      endpoints: {
        search: 'GET /api/search?q=keyword&limit=20',
        quick: 'GET /api/search/quick?q=keyword'
      },
      features: {
        fullText: 'MongoDB text indexes',
        regex: 'Fallback regex search',
        grouping: 'Results grouped by service tag',
        debounce: '300ms frontend debounce',
        public: 'No authentication required'
      }
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
  
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }
  
  if (err.code === 11000) {
    return res.status(400).json({ success: false, message: 'Duplicate entry found' });
  }
  
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
const DB_URI = process.env.DB_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/hospital_db';
mongoose.connect(DB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    // Force reload all models
    Object.keys(mongoose.models).forEach(modelName => {
      delete mongoose.models[modelName];
    });
  })

// ============================================
// SERVER START (Using http server for Socket.IO)
// ============================================
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log('═'.repeat(55));
  console.log('🚀 HealthCare Hub Server Started');
  console.log('═'.repeat(55));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 WebSocket: ${io ? 'Active' : 'Disabled'}`);
  console.log(`📍 Redis: ${redis ? 'Connected' : 'Unavailable'}`);
  console.log('─'.repeat(55));
  console.log('📦 Modules Loaded:');
  console.log('─'.repeat(55));
  console.log('🏥  Hospitals            → /api/hospitals/*');
  console.log('🏥  Hospital Provider     → /api/hospitals/provider/*');
  console.log('🏥  Hospital Status       → /api/hospital-status/*');
  console.log('🚑  Ambulance (v3.0)      → /api/ambulance/*');
  console.log('🏠  Caregivers            → /api/caregivers/*');
  console.log('🔬  Diagnostics           → /api/diagnostics/*');
  console.log('🧘  Ayurveda              → /api/ayurveda/*');
  console.log('🌿  Homeopathy            → /api/homeopathy/*');
  console.log('🛡️  Insurance             → /api/insurance/*');
  console.log('🛡️  Insurance Admin       → /api/insurance-admin/*');
  console.log('🏢  Corporate             → /api/corporate/*');
  console.log('🧠  Mental Health         → /api/mentalhealth/*');
  console.log('📱  Online Doctor         → /api/online-doctor/*');
  console.log('💰  Loans                 → /api/loan/*');
  console.log('💰  Lenders               → /api/lender/*');
  console.log('💳  Payments              → /api/payment/*');
  console.log('📋  Bookings              → /api/bookings/*');
  console.log('⭐  Reviews               → /api/reviews/*');
  console.log('📱  OTP                   → /api/otp/*');
  console.log('🔧  Admin                 → /api/admin/*');
  console.log('🔍  Global Search         → /api/search/*');
  console.log('👨‍💼 Employee Portal       → /api/employee/*');
  console.log('─'.repeat(55));
  console.log('🆕 New Feature: Hospital Green Light System');
  console.log('   🟢 Accepting  🟡 Limited  🔴 Full  ❓ Unknown');
  console.log('   📱 WhatsApp tap update (1 second, free)');
  console.log('   ⏰ Auto-request at 8AM, 2PM, 8PM');
  console.log('   🕐 Auto-expire after 4 hours');
  console.log('─'.repeat(55));
  console.log('🔌 Real-time Features:');
  console.log('   🚑 Driver Tracking (5s updates)');
  console.log('   🏠 Caregiver Tracking (2min updates)');
  console.log('   🔬 Phlebotomist Tracking');
  console.log('   🏥 Hospital Bed Updates');
  console.log('   👨‍💼 Admin Live Monitoring');
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
  if (redis) redis.disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received. Shutting down gracefully...');
  if (redis) redis.disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 
 
// nuclear rebuild 
// trigger 
// force  

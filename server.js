// ============================================
// ENVIRONMENT CONFIGURATION (No dotenv)
// ============================================

// Load .env manually without dotenv
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  }
  console.log('✅ .env loaded manually from:', envPath);
} catch (err) {
  console.warn('⚠️ No .env file found, using environment variables');
}

console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing');

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
// CORS CONFIGURATION
// ============================================
const allowedOrigins = [
  'https://hospital-frontend-kiaeto.vercel.app',
  'https://hospital-frontend-zeta-rosy.vercel.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: function(origin, callback) {
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
  maxAge: 86400
}));

app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.set('trust proxy', 1);

// ============================================
// REDIS CONNECTION
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

// Initialize WebSocket handlers (with fallback)
let initializeSocket = () => {};
let getConnectionStats = () => ({});

try {
  const socketModule = require('./socket/ambulanceSocket');
  initializeSocket = socketModule.initializeSocket || (() => {});
  getConnectionStats = socketModule.getConnectionStats || (() => ({}));
  console.log('✅ Ambulance socket loaded successfully');
} catch (e) {
  console.warn('⚠️ Ambulance socket not available:', e.message);
}

if (typeof initializeSocket === 'function') {
  initializeSocket(io);
}

global.io = io;

// ============================================
// REQUEST LOGGING
// ============================================
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

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
// AUTH MIDDLEWARES
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
// CRON JOBS WITH FALLBACKS
// ============================================

// Load ambulance dispatch service with fallback
let dispatchService = {};
try {
  dispatchService = require('./services/ambulanceDispatchService');
  console.log('✅ Ambulance dispatch service loaded');
} catch (e) {
  console.warn('⚠️ Ambulance dispatch service not available:', e.message);
  dispatchService = {
    checkStuckBookings: async () => ({ checked: 0 })
  };
}

setInterval(async () => {
  try {
    if (dispatchService.checkStuckBookings) {
      const result = await dispatchService.checkStuckBookings();
      if (result.checked > 0) {
        console.log(`🔍 Stuck booking check: ${result.checked} checked`);
      }
    }
  } catch (error) {
    console.error('Stuck booking check error:', error.message);
  }
}, 2 * 60 * 1000);

// Load hospital status service with fallback
let hospitalStatusService = {};
try {
  hospitalStatusService = require('./services/hospitalStatusService');
  console.log('✅ Hospital status service loaded');
} catch (e) {
  console.warn('⚠️ Hospital status service not available:', e.message);
  hospitalStatusService = {
    sendScheduledRequests: async () => {},
    expireStaleStatuses: async () => {}
  };
}

setInterval(async () => {
  try {
    if (hospitalStatusService.sendScheduledRequests) {
      await hospitalStatusService.sendScheduledRequests();
    }
  } catch (error) {
    console.error('Hospital status request error:', error.message);
  }
}, 60 * 60 * 1000);

setInterval(async () => {
  try {
    if (hospitalStatusService.expireStaleStatuses) {
      await hospitalStatusService.expireStaleStatuses();
    }
  } catch (error) {
    console.error('Status expiry error:', error.message);
  }
}, 30 * 60 * 1000);

if (redis) {
  setInterval(async () => {
    try {
      const locationCache = require('./services/locationCacheService');
      const stats = await locationCache.getServiceStats();
      console.log('📍 Location stats:', JSON.stringify(stats));
    } catch (error) {}
  }, 15 * 60 * 1000);
}

// ============================================
// MODELS WITH FALLBACK
// ============================================
try {
  require('./models/TestMaster');
} catch (e) {
  console.warn('⚠️ TestMaster model not available:', e.message);
}

try {
  require('./models/TestPricing');
} catch (e) {
  console.warn('⚠️ TestPricing model not available:', e.message);
}

// ============================================
// ROUTES (ALL PRESERVED WITH FALLBACKS)
// ============================================

let hospitalRoutes, hospitalProviderRoutes, labPricingRoutes, packageRoutes, authRoutes, caregiverRoutes, diagnosticsRoutes, diagnosticsUploadRoutes, ambulanceRoutes, healthPackageRoutes, testRoutes, uploadRoutes, providerAuthRoutes, bookingRoutes, razorpayRoutes, reviewRoutes, adminRoutes, bookingStatusRoutes, customPackageRoutes, lenderAuthRoutes, adminLenderRoutes, lenderRoutes, loanPatientRoutes, loanLenderRoutes, loanAdminRoutes, loanWebhookRoutes, webhookRoutes, ayurvedaRoutes, ayurvedaCenterRoutes, ayurvedaPrescriptionRoutes, ayurvedaReportRoutes, homeopathyRoutes, insuranceRoutes, insuranceAdminRoutes, otpRoutes, corporateRoutes, corporateBillingRoutes, corporateHubRoutes, mentalHealthRoutes, mentalHealthTherapistRoutes, mentalHealthAdminRoutes, mentalHealthPayoutRoutes, mentalHealthEarningsRoutes, onlineDoctorRoutes, hospitalStatusRoutes, globalSearchRoutes, employeePortalRoutes;

try { hospitalRoutes = require('./routes/hospitals'); } catch(e) { console.warn('⚠️ hospitals route missing'); hospitalRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { hospitalProviderRoutes = require('./routes/hospitalProvider'); } catch(e) { console.warn('⚠️ hospitalProvider route missing'); hospitalProviderRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { labPricingRoutes = require('./routes/labPricing'); } catch(e) { console.warn('⚠️ labPricing route missing'); labPricingRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { packageRoutes = require('./routes/packageRoutes'); } catch(e) { console.warn('⚠️ packageRoutes route missing'); packageRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { authRoutes = require('./routes/auth'); } catch(e) { console.warn('⚠️ auth route missing'); authRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { caregiverRoutes = require('./routes/caregivers'); } catch(e) { console.warn('⚠️ caregivers route missing'); caregiverRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { diagnosticsRoutes = require('./routes/diagnostics'); } catch(e) { console.warn('⚠️ diagnostics route missing'); diagnosticsRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { diagnosticsUploadRoutes = require('./routes/diagnostics-upload'); } catch(e) { console.warn('⚠️ diagnostics-upload route missing'); diagnosticsUploadRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { ambulanceRoutes = require('./routes/ambulance'); } catch(e) { console.warn('⚠️ ambulance route missing: ' + e.message); ambulanceRoutes = (req,res) => res.status(404).json({error:'Route not available', details: e.message}); }
try { healthPackageRoutes = require('./routes/healthPackageRoutes'); } catch(e) { console.warn('⚠️ healthPackageRoutes route missing'); healthPackageRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { testRoutes = require('./routes/tests'); } catch(e) { console.warn('⚠️ tests route missing'); testRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { uploadRoutes = require('./routes/upload'); } catch(e) { console.warn('⚠️ upload route missing'); uploadRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { providerAuthRoutes = require('./routes/providerAuth'); } catch(e) { console.warn('⚠️ providerAuth route missing'); providerAuthRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { bookingRoutes = require('./routes/bookings'); } catch(e) { console.warn('⚠️ bookings route missing: ' + e.message); bookingRoutes = (req,res) => res.status(404).json({error:'Route not available', details: e.message}); }
try { razorpayRoutes = require('./routes/payment'); } catch(e) { console.warn('⚠️ payment route missing'); razorpayRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { reviewRoutes = require('./routes/reviews'); } catch(e) { console.warn('⚠️ reviews route missing: ' + e.message); reviewRoutes = (req,res) => res.status(404).json({error:'Route not available', details: e.message}); }
try { adminRoutes = require('./routes/admin'); } catch(e) { console.warn('⚠️ admin route missing'); adminRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { bookingStatusRoutes = require('./routes/booking-status'); } catch(e) { console.warn('⚠️ booking-status route missing'); bookingStatusRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { customPackageRoutes = require('./routes/custom-packages'); } catch(e) { console.warn('⚠️ custom-packages route missing'); customPackageRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { lenderAuthRoutes = require('./routes/lenderAuth'); } catch(e) { console.warn('⚠️ lenderAuth route missing'); lenderAuthRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { adminLenderRoutes = require('./routes/adminLender'); } catch(e) { console.warn('⚠️ adminLender route missing'); adminLenderRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { lenderRoutes = require('./routes/lender'); } catch(e) { console.warn('⚠️ lender route missing'); lenderRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { loanPatientRoutes = require('./routes/loanPatient'); } catch(e) { console.warn('⚠️ loanPatient route missing'); loanPatientRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { loanLenderRoutes = require('./routes/loanLender'); } catch(e) { console.warn('⚠️ loanLender route missing'); loanLenderRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { loanAdminRoutes = require('./routes/loanAdmin'); } catch(e) { console.warn('⚠️ loanAdmin route missing'); loanAdminRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { loanWebhookRoutes = require('./routes/loanWebhook'); } catch(e) { console.warn('⚠️ loanWebhook route missing'); loanWebhookRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { webhookRoutes = require('./routes/webhooks'); } catch(e) { console.warn('⚠️ webhooks route missing'); webhookRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { ayurvedaRoutes = require('./routes/ayurveda-advanced'); } catch(e) { console.warn('⚠️ ayurveda-advanced route missing'); ayurvedaRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { ayurvedaCenterRoutes = require('./routes/ayurveda-centers'); } catch(e) { console.warn('⚠️ ayurveda-centers route missing'); ayurvedaCenterRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { ayurvedaPrescriptionRoutes = require('./routes/ayurveda-prescriptions'); } catch(e) { console.warn('⚠️ ayurveda-prescriptions route missing'); ayurvedaPrescriptionRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { ayurvedaReportRoutes = require('./routes/ayurveda-reports'); } catch(e) { console.warn('⚠️ ayurveda-reports route missing'); ayurvedaReportRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { homeopathyRoutes = require('./routes/homeopathy'); } catch(e) { console.warn('⚠️ homeopathy route missing'); homeopathyRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { insuranceRoutes = require('./routes/insurance'); } catch(e) { console.warn('⚠️ insurance route missing'); insuranceRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { insuranceAdminRoutes = require('./routes/insurance-admin'); } catch(e) { console.warn('⚠️ insurance-admin route missing'); insuranceAdminRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { otpRoutes = require('./routes/otp'); } catch(e) { console.warn('⚠️ otp route missing'); otpRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { corporateRoutes = require('./routes/corporate'); } catch(e) { console.warn('⚠️ corporate route missing'); corporateRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { corporateBillingRoutes = require('./routes/corporate-billing'); } catch(e) { console.warn('⚠️ corporate-billing route missing'); corporateBillingRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { corporateHubRoutes = require('./routes/corporateHub'); } catch(e) { console.warn('⚠️ corporateHub route missing'); corporateHubRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { mentalHealthRoutes = require('./routes/mentalhealth'); } catch(e) { console.warn('⚠️ mentalhealth route missing'); mentalHealthRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { mentalHealthTherapistRoutes = require('./routes/mentalhealth-therapist'); } catch(e) { console.warn('⚠️ mentalhealth-therapist route missing'); mentalHealthTherapistRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { mentalHealthAdminRoutes = require('./routes/mentalhealth-admin'); } catch(e) { console.warn('⚠️ mentalhealth-admin route missing'); mentalHealthAdminRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { mentalHealthPayoutRoutes = require('./routes/mentalhealth-payout'); } catch(e) { console.warn('⚠️ mentalhealth-payout route missing'); mentalHealthPayoutRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { mentalHealthEarningsRoutes = require('./routes/mentalhealth-earnings'); } catch(e) { console.warn('⚠️ mentalhealth-earnings route missing'); mentalHealthEarningsRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { onlineDoctorRoutes = require('./routes/onlineDoctor'); } catch(e) { console.warn('⚠️ onlineDoctor route missing'); onlineDoctorRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { hospitalStatusRoutes = require('./routes/hospitalStatus'); } catch(e) { console.warn('⚠️ hospitalStatus route missing'); hospitalStatusRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { globalSearchRoutes = require('./routes/globalSearch'); } catch(e) { console.warn('⚠️ globalSearch route missing'); globalSearchRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }
try { employeePortalRoutes = require('./routes/employeePortal'); } catch(e) { console.warn('⚠️ employeePortal route missing'); employeePortalRoutes = (req,res) => res.status(404).json({error:'Route not available'}); }

// ============================================
// AI ROUTER (18 Agents)
// ============================================
// Import AI services (.js files)
const { AIRouter } = require('./ai-core/router/AIRouter.js');
const { ProviderManager } = require('./ai-core/providers/ProviderManager.js');
const { CapabilityRegistry } = require('./ai-core/router/CapabilityRegistry.js');
const { Orchestrator } = require('./ai-core/router/Orchestrator.js');
const { HealthManager } = require('./ai-core/monitoring/HealthManager.js');
const { BudgetManager } = require('./ai-core/monitoring/BudgetManager.js');

// Initialize AI services
const budgetManager = new BudgetManager();
const providerManager = new ProviderManager(budgetManager);
const healthManager = new HealthManager();
const capabilityRegistry = new CapabilityRegistry();
const orchestrator = new Orchestrator(capabilityRegistry, providerManager);
const router = new AIRouter(capabilityRegistry, orchestrator, providerManager, healthManager);

// Import ALL Agents (.js files)
const HospitalAgent = require('./ai-core/agents/business/HospitalAgent.js').HospitalAgent;
const TestingAgent = require('./ai-core/agents/intelligence/TestingAgent.js').TestingAgent;
const DoctorAgent = require('./ai-core/agents/business/DoctorAgent.js').DoctorAgent;
const DiagnosticsAgent = require('./ai-core/agents/business/DiagnosticsAgent.js').DiagnosticsAgent;
const AmbulanceAgent = require('./ai-core/agents/business/AmbulanceAgent.js').AmbulanceAgent;
const InsuranceAgent = require('./ai-core/agents/business/InsuranceAgent.js').InsuranceAgent;
const CaregiverAgent = require('./ai-core/agents/business/CaregiverAgent.js').CaregiverAgent;
const WellnessAgent = require('./ai-core/agents/business/WellnessAgent.js').WellnessAgent;
const FinanceAgent = require('./ai-core/agents/operations/FinanceAgent.js').FinanceAgent;
const CRMAgent = require('./ai-core/agents/operations/CRMAgent.js').CRMAgent;
const MarketingAgent = require('./ai-core/agents/operations/MarketingAgent.js').MarketingAgent;
const SupportAgent = require('./ai-core/agents/operations/SupportAgent.js').SupportAgent;
const AnalyticsAgent = require('./ai-core/agents/operations/AnalyticsAgent.js').AnalyticsAgent;
const CorporateHealthAgent = require('./ai-core/agents/operations/CorporateHealthAgent.js').CorporateHealthAgent;
const SearchIntelligenceAgent = require('./ai-core/agents/intelligence/SearchIntelligenceAgent.js').SearchIntelligenceAgent;
const RecommendationAgent = require('./ai-core/agents/intelligence/RecommendationAgent.js').RecommendationAgent;
const WorkflowAgent = require('./ai-core/agents/intelligence/WorkflowAgent.js').WorkflowAgent;
const MemoryAgent = require('./ai-core/agents/intelligence/MemoryAgent.js').MemoryAgent;
const NotificationAgent = require('./ai-core/agents/intelligence/NotificationAgent.js').NotificationAgent;
const CEOAgent = require('./ai-core/agents/executive/CEOAgent.js').CEOAgent;
const StrategyAgent = require('./ai-core/agents/executive/StrategyAgent.js').StrategyAgent;
const FixerAgent = require('./ai-core/agents/intelligence/FixerAgent.js').FixerAgent;

// Register all 18 agents with the registry
const hospitalAgent = new HospitalAgent(providerManager);
capabilityRegistry.register(hospitalAgent.getRegistration());

const doctorAgent = new DoctorAgent(providerManager);
capabilityRegistry.register(doctorAgent.getRegistration());

const diagnosticsAgent = new DiagnosticsAgent(providerManager);
capabilityRegistry.register(diagnosticsAgent.getRegistration());

const ambulanceAgent = new AmbulanceAgent(providerManager);
capabilityRegistry.register(ambulanceAgent.getRegistration());

const insuranceAgent = new InsuranceAgent(providerManager);
capabilityRegistry.register(insuranceAgent.getRegistration());

const caregiverAgent = new CaregiverAgent(providerManager);
capabilityRegistry.register(caregiverAgent.getRegistration());

const wellnessAgent = new WellnessAgent(providerManager);
capabilityRegistry.register(wellnessAgent.getRegistration());

const financeAgent = new FinanceAgent(providerManager);
capabilityRegistry.register(financeAgent.getRegistration());

const crmAgent = new CRMAgent(providerManager);
capabilityRegistry.register(crmAgent.getRegistration());

const marketingAgent = new MarketingAgent(providerManager);
capabilityRegistry.register(marketingAgent.getRegistration());

const supportAgent = new SupportAgent(providerManager);
capabilityRegistry.register(supportAgent.getRegistration());

const analyticsAgent = new AnalyticsAgent(providerManager);
capabilityRegistry.register(analyticsAgent.getRegistration());

const corporateAgent = new CorporateHealthAgent(providerManager);
capabilityRegistry.register(corporateAgent.getRegistration());

const searchAgent = new SearchIntelligenceAgent(providerManager);
capabilityRegistry.register(searchAgent.getRegistration());

const recommendationAgent = new RecommendationAgent(providerManager);
capabilityRegistry.register(recommendationAgent.getRegistration());

const workflowAgent = new WorkflowAgent(providerManager);
capabilityRegistry.register(workflowAgent.getRegistration());

const memoryAgent = new MemoryAgent(providerManager);
capabilityRegistry.register(memoryAgent.getRegistration());

const notificationAgent = new NotificationAgent(providerManager);
capabilityRegistry.register(notificationAgent.getRegistration());

const ceoAgent = new CEOAgent(providerManager, capabilityRegistry);
capabilityRegistry.register(ceoAgent.getRegistration());

const strategyAgent = new StrategyAgent(providerManager);
capabilityRegistry.register(strategyAgent.getRegistration());

const testingAgent = new TestingAgent(providerManager);
capabilityRegistry.register(testingAgent);

const fixerAgent = new FixerAgent(providerManager);
capabilityRegistry.register(fixerAgent);

console.log('🤖 AI Router initialized with 18 agents');

// ============================================
// AI ROUTES
// ============================================

// Route all AI requests through the router
app.post('/api/ai/route', async (req, res) => {
  try {
    const { task, payload, critical = false } = req.body;
    
    if (!task) {
      return res.status(400).json({ 
        success: false, 
        error: 'Task is required' 
      });
    }
    
    const request = {
      id: `req-${Date.now()}`,
      task,
      payload: payload || {},
      critical,
      timeout: 30000,
      maxRetries: 3
    };
    
    const response = await router.route(request);
    
    res.json({
      success: response.success,
      data: response.data,
      error: response.error,
      sourceAgent: response.sourceAgent,
      processingTime: response.processingTime,
      providerUsed: response.providerUsed
    });
    
  } catch (error) {
    console.error('AI Route Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'AI processing failed'
    });
  }
});

// Get all registered agents
app.get('/api/ai/agents', (req, res) => {
  const agents = capabilityRegistry.getAllAgents().map(agent => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    status: agent.status,
    capabilities: agent.capabilities.map(c => c.name),
    currentTask: agent.currentTask,
    lastActive: agent.lastActive
  }));
  
  res.json({
    success: true,
    count: agents.length,
    agents
  });
});

// Direct test route
app.post('/api/ai/test', async (req, res) => {
  try {
    const result = await testingAgent.execute(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ai/fix', async (req, res) => {
  // Respond immediately, run fix in background
  res.json({ success: true, message: 'Auto-fix started in background. Check /api/ai/health for progress.' });
  
  setTimeout(async () => {
    try {
      await fixerAgent.execute(req.body);
      console.log('✅ Auto-fix completed');
    } catch (e) {
      console.error('Auto-fix error:', e.message);
    }
  }, 1000);
});

// Get agent by ID
app.get('/api/ai/agents/:agentId', (req, res) => {
  const { agentId } = req.params;
  const agent = capabilityRegistry.getAgent(agentId);
  
  if (!agent) {
    return res.status(404).json({
      success: false,
      error: 'Agent not found'
    });
  }
  
  res.json({
    success: true,
    agent
  });
});

// Get AI system health
app.get('/api/ai/health', (req, res) => {
  const health = healthManager.getHealthReport();
  const budget = budgetManager.getCurrentSpend();
  const agents = capabilityRegistry.getAllAgents().map(a => ({
    id: a.id,
    name: a.name,
    status: a.status
  }));
  
  res.json({
    success: true,
    health,
    budget,
    agents: {
      total: agents.length,
      online: agents.filter(a => a.status === 'online').length,
      busy: agents.filter(a => a.status === 'busy').length,
      idle: agents.filter(a => a.status === 'idle').length,
      offline: agents.filter(a => a.status === 'offline').length
    }
  });
});

// Get AI system cost
app.get('/api/ai/cost', (req, res) => {
  const budget = budgetManager.getCurrentSpend();
  const usagePercent = budgetManager.getUsagePercentage();
  
  res.json({
    success: true,
    budget,
    usagePercent,
    isExhausted: usagePercent >= 100
  });
});

// Debug route - test all route loading
app.get('/api/debug/routes', (req, res) => {
  const results = {};
  const routeFiles = ['ambulance', 'bookings', 'reviews'];
  routeFiles.forEach(file => {
    try {
      delete require.cache[require.resolve('./routes/' + file)];
      require('./routes/' + file);
      results[file] = 'OK';
    } catch(e) {
      results[file] = e.message;
    }
  });
    // Test all ambulance route dependencies
  const allDeps = [
    './models/Booking', './models/User', './models/Transaction', 
    './models/EmergencyContact', './middleware/auth',
    './services/ambulanceDispatchService', './services/locationCacheService',
    './services/commissionService', './services/notificationService',
    './services/smsService'
  ];
  allDeps.forEach(dep => {
    try {
      require(dep);
      results['dep: ' + dep] = 'OK';
    } catch(e) {
      results['dep: ' + dep] = e.message;
    }
  });
  res.json({ success: true, results });
});

console.log('🤖 AI Routes loaded:');
console.log('   📡 POST /api/ai/route        - Process AI request');
console.log('   📋 GET  /api/ai/agents       - List all agents');
console.log('   📋 GET  /api/ai/agents/:id   - Get agent details');
console.log('   🩺 GET  /api/ai/health       - AI system health');
console.log('   💰 GET  /api/ai/cost         - AI cost tracking');
console.log('   🐛 GET  /api/debug/routes    - Debug route loading');
// ============================================
// ROUTE MOUNTING
// ============================================
app.use('/api/hospitals/provider', hospitalProviderRoutes);
app.use('/api/lab-pricing', labPricingRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/hospitals', searchLimiter, hospitalRoutes);
app.use('/api/hospital-status', hospitalStatusRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/provider-auth', providerAuthRoutes);
app.use('/api/caregivers', caregiverRoutes);
app.use('/api/diagnostics', diagnosticsRoutes);
app.use('/api/diagnostics/upload', diagnosticsUploadRoutes);
app.use('/api/ambulance', ambulanceRoutes);
app.use('/api/health-packages', healthPackageRoutes);
app.use('/api/provider', healthPackageRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/booking-status', bookingStatusRoutes);
app.use('/api/custom-packages', customPackageRoutes);
app.use('/api/payment', razorpayRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/lender/auth', lenderAuthRoutes);
app.use('/api/lender', lenderRoutes);
app.use('/api/admin/lenders', adminLenderRoutes);
app.use('/api/loan/patient', loanPatientRoutes);
app.use('/api/loan/lender', loanLenderRoutes);
app.use('/api/loan/admin', loanAdminRoutes);
app.use('/api/loan/webhook', loanWebhookRoutes);
app.use('/api/ayurveda', ayurvedaRoutes);
app.use('/api/ayurveda-centers', ayurvedaCenterRoutes);
app.use('/api/ayurveda/prescriptions', ayurvedaPrescriptionRoutes);
app.use('/api/ayurveda/reports', ayurvedaReportRoutes);
app.use('/api/ayurveda/payments', razorpayRoutes);
app.use('/api/homeopathy', homeopathyRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/insurance-admin', insuranceAdminRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/corporate', corporateRoutes);
app.use('/api/corporate/billing', corporateBillingRoutes);
app.use('/api/corporate-hub', corporateHubRoutes);
app.use('/api/mentalhealth', mentalHealthRoutes);
app.use('/api/mentalhealth/therapist', mentalHealthTherapistRoutes);
app.use('/api/mentalhealth/admin', mentalHealthAdminRoutes);
app.use('/api/mentalhealth/payout', mentalHealthPayoutRoutes);
app.use('/api/mentalhealth/earnings', mentalHealthEarningsRoutes);
app.use('/api/online-doctor', searchLimiter, onlineDoctorRoutes);
app.use('/api/search', searchLimiter, globalSearchRoutes);
app.use('/api/employee', employeePortalRoutes);

// ============================================
// TEST ROUTES
// ============================================

app.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Server is working!',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      mongodb: 'connected',
      redis: 'connected'
    }
  });
});

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

app.get('/api/ws/stats', (req, res) => {
  const stats = getConnectionStats();
  res.json({
    success: true,
    data: {
      onlineDrivers: stats.drivers || 0,
      onlineCaregivers: stats.caregivers || 0,
      onlinePhlebotomists: stats.phlebotomists || 0,
      trackingPatients: stats.patients || 0,
      connectedHospitals: stats.hospitals || 0,
      activeAdmins: stats.admins || 0,
      totalConnections: (stats.drivers || 0) + (stats.caregivers || 0) + (stats.phlebotomists || 0) + (stats.patients || 0) + (stats.hospitals || 0) + (stats.admins || 0),
      timestamp: stats.timestamp || new Date().toISOString()
    }
  });
});

// ============================================
// HEALTH CHECKS (ALL PRESERVED)
// ============================================

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

app.get('/api/seed-tests', async (req, res) => {
  try {
    const xlsx = require('xlsx');
    const path = require('path');
    const db = mongoose.connection.db;
    const collection = db.collection('testmasters');
    
    const filePath = path.join(__dirname, 'data', 'diagnostic_tests_master.xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    await collection.deleteMany({});
    
    const docs = rows.map((row, index) => ({
      test_id: index + 1,
      test_code: row['test_code'] || '',
      test_name: row['test_name'] || '',
      major_category: row['main_category'] || '',
      major_category_name: row['main_category'] || '',
      sub_category: row['sub_category'] || '',
      sub_sub_category: row['sub_sub_category'] || '',
      common_or_unique: row['common_unique'] || 'Common',
      search_keywords: row['search_keywords'] || '',
      is_active: true,
      home_collection_possible: true,
      turnaround_time_default_hours: 24
    }));

    await collection.insertMany(docs);
    await collection.createIndex({ test_name: 'text', search_keywords: 'text', major_category: 'text', sub_category: 'text' });
    
    res.json({ success: true, count: docs.length, message: 'Seeded with test_code and all fields' });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
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
    Object.keys(mongoose.models).forEach(modelName => {
      delete mongoose.models[modelName];
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
  });

// ============================================
// SERVER START
// ============================================
const PORT = process.env.PORT || 5001;
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

// D:\hospital backend\middleware\emergencyRateLimiter.js

// ============================================
// EMERGENCY RATE LIMITER MIDDLEWARE
// ============================================

/**
 * Special rate limiter for emergency endpoints
 * More permissive than regular rate limiter but
 * prevents abuse while ensuring genuine emergencies go through
 */

const rateLimit = require('express-rate-limit');

// ============================================
// RATE LIMIT CONFIGURATIONS
// ============================================

const RATE_LIMIT_CONFIGS = {
  // 🚑 Emergency ambulance dispatch
  ambulanceEmergency: {
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: {
      success: false,
      error: 'Too many emergency requests. If this is a genuine emergency, please call 108 directly.',
      code: 'EMERGENCY_RATE_LIMIT'
    },
    standardHeaders: true,
    legacyHeaders: false
  },

  // 🚑 Driver accept emergency
  driverAccept: {
    windowMs: 10 * 1000,
    max: 3,
    message: {
      success: false,
      error: 'Too many accept attempts. Please wait.',
      code: 'DRIVER_RATE_LIMIT'
    }
  },

  // 🧠 Mental health crisis alert
  mentalHealthCrisis: {
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: {
      success: false,
      error: 'Crisis alert limit reached. Please call crisis helpline: 9152987821',
      code: 'CRISIS_RATE_LIMIT'
    }
  },

  // 🏥 Hospital emergency admission
  hospitalEmergency: {
    windowMs: 1 * 60 * 1000,
    max: 15,
    message: {
      success: false,
      error: 'Too many requests. Please try again shortly.',
      code: 'HOSPITAL_RATE_LIMIT'
    }
  },

  // 🏠 Caregiver emergency
  caregiverEmergency: {
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: {
      success: false,
      error: 'Emergency alert limit reached. Please call emergency services.',
      code: 'CAREGIVER_RATE_LIMIT'
    }
  },

  // 📍 Location update
  locationUpdate: {
    windowMs: 10 * 1000,
    max: 50,
    message: {
      success: false,
      error: 'Location update rate exceeded.',
      code: 'LOCATION_RATE_LIMIT'
    }
  },

  // 🔄 General API
  general: {
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: {
      success: false,
      error: 'Too many requests. Please slow down.',
      code: 'GENERAL_RATE_LIMIT'
    }
  }
};

// ============================================
// CREATE RATE LIMITERS
// ============================================

const createLimiter = (config) => {
  const options = {
    ...config,
    handler: (req, res) => {
      console.warn(`⚠️ Rate limit hit: ${config.message.code} - IP: ${req.ip} - Path: ${req.path}`);
      res.status(429).json({
        success: false,
        ...config.message,
        retryAfter: Math.ceil(config.windowMs / 1000)
      });
    },
    skip: (req) => {
      // Skip for whitelisted IPs
      const whitelistedIPs = (process.env.RATE_LIMIT_WHITELIST || '').split(',');
      if (whitelistedIPs.includes(req.ip)) {
        return true;
      }
      return false;
    }
  };

  return rateLimit(options);
};

// ============================================
// EXPORTED MIDDLEWARE
// ============================================

const emergencyRateLimiter = {
  ambulanceEmergency: createLimiter(RATE_LIMIT_CONFIGS.ambulanceEmergency),
  driverAccept: createLimiter(RATE_LIMIT_CONFIGS.driverAccept),
  mentalHealthCrisis: createLimiter(RATE_LIMIT_CONFIGS.mentalHealthCrisis),
  hospitalEmergency: createLimiter(RATE_LIMIT_CONFIGS.hospitalEmergency),
  caregiverEmergency: createLimiter(RATE_LIMIT_CONFIGS.caregiverEmergency),
  locationUpdate: createLimiter(RATE_LIMIT_CONFIGS.locationUpdate),
  general: createLimiter(RATE_LIMIT_CONFIGS.general)
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  emergencyRateLimiter,
  RATE_LIMIT_CONFIGS
};
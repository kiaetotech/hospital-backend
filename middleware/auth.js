const jwt = require('jsonwebtoken');

// ============================================
// ✅ AUTHENTICATE TOKEN (JWT Verification)
// ============================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success,
      message: 'Invalid or expired token.'
    });
  }
};

// ============================================
// GENERAL AUTHENTICATION (Alias)
// ============================================
const authenticate = authenticateToken;

// ============================================
// PATIENT-ONLY AUTHENTICATION
// ============================================
const authenticatePatient = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ success, message: 'Patient access required.' });
    }
    next();
  });
};

// ============================================
// 🆕 PROVIDER AUTHENTICATION (Any provider role)
// ============================================
const authenticateProvider = (req, res, next) => {
  authenticateToken(req, res, () => {
    const providerRoles = [
      'hospital', 'ambulance', 'ambulance_provider', 'ambulance_driver',
      'caregiver', 'diagnostics', 'lender', 'insurance_company', 'insurance_agent',
      'ayurveda_doctor', 'ayurveda_center', 'homeopathy_doctor', 'homeopathy_center',
      'mental_health_therapist', 'pharmacy', 'corporate_hr', 'online_doctor'
    ];
    
    if (!providerRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success, 
        message: 'Provider access required.' 
      });
    }
    next();
  });
};

// ============================================
// 🆕 ROLE-BASED AUTHORIZATION (Dynamic)
// ============================================
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    authenticateToken(req, res, () => {
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success,
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
        });
      }
      next();
    });
  };
};

// ============================================
// 🆕 HOSPITAL-ONLY AUTHENTICATION
// ============================================
const authenticateHospital = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'hospital') {
      return res.status(403).json({ 
        success, 
        message: 'Hospital access required.' 
      });
    }
    next();
  });
};

// ============================================
// 🆕 AMBULANCE-ONLY AUTHENTICATION
// ============================================
const authenticateAmbulance = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'ambulance' && req.user.role !== 'ambulance_provider' && req.user.role !== 'ambulance_driver') {
      return res.status(403).json({ 
        success, 
        message: 'Ambulance provider access required.' 
      });
    }
    next();
  });
};

// ============================================
// 🆕 AMBULANCE PROVIDER AUTHENTICATION
// ============================================
const authenticateAmbulanceProvider = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'ambulance_provider') {
      return res.status(403).json({ 
        success, 
        message: 'Ambulance fleet owner access required.' 
      });
    }
    next();
  });
};

// ============================================
// 🆕 AMBULANCE DRIVER AUTHENTICATION
// ============================================
const authenticateAmbulanceDriver = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'ambulance_driver') {
      return res.status(403).json({ 
        success, 
        message: 'Ambulance driver access required.' 
      });
    }
    next();
  });
};

// ============================================
// 🆕 CAREGIVER-ONLY AUTHENTICATION
// ============================================
const authenticateCaregiver = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'caregiver') {
      return res.status(403).json({ 
        success, 
        message: 'Caregiver access required.' 
      });
    }
    next();
  });
};

// ============================================
// 🆕 DIAGNOSTICS-ONLY AUTHENTICATION
// ============================================
const authenticateDiagnostics = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'diagnostics') {
      return res.status(403).json({ 
        success, 
        message: 'Diagnostics provider access required.' 
      });
    }
    next();
  });
};

// ============================================
// LENDER-ONLY AUTHENTICATION (PRESERVED)
// ============================================
const authenticateLender = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'lender') {
      return res.status(403).json({ success, message: 'Lender access required.' });
    }
    next();
  });
};

// ============================================
// ADMIN AUTHENTICATION (API Key) (PRESERVED)
// ============================================
const isAdmin = (req, res, next) => {
  const adminKey = req.header('X-Admin-Key');
  const validKey = process.env.ADMIN_KEY || 'admin_secret_key_2024';

  if (!adminKey || adminKey !== validKey) {
    return res.status(401).json({ success, message: 'Admin access denied' });
  }
  next();
};

// ============================================
// 🆕 ADMIN AUTHENTICATION (JWT-based)
// ============================================
const authenticateAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success, 
        message: 'Admin access required.' 
      });
    }
    next();
  });
};

// ============================================
// 🆕 SUPER ADMIN ONLY
// ============================================
const authenticateSuperAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'admin' || req.user.adminLevel !== 'super') {
      return res.status(403).json({ 
        success, 
        message: 'Super admin access required.' 
      });
    }
    next();
  });
};

// ============================================
// INSURANCE COMPANY AUTHENTICATION (PRESERVED)
// ============================================
const authenticateInsuranceCompany = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'insurance_company') {
      return res.status(403).json({ success, message: 'Insurance company access required.' });
    }
    next();
  });
};

// ============================================
// INSURANCE AGENT AUTHENTICATION (PRESERVED)
// ============================================
const authenticateInsuranceAgent = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'insurance_agent') {
      return res.status(403).json({ success, message: 'Insurance agent access required.' });
    }
    next();
  });
};

// ============================================
// 🆕 INSURANCE-RELATED (Company OR Agent)
// ============================================
const authenticateInsurance = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'insurance_company' && req.user.role !== 'insurance_agent') {
      return res.status(403).json({ 
        success, 
        message: 'Insurance access required.' 
      });
    }
    next();
  });
};

// ============================================
// 🆕 AYURVEDA DOCTOR AUTHENTICATION
// ============================================
const authenticateAyurvedaDoctor = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'ayurveda_doctor') {
      return res.status(403).json({ 
        success, 
        message: 'Ayurveda doctor access required.' 
      });
    }
    next();
  });
};

// ============================================
// 🆕 AYURVEDA CENTER AUTHENTICATION
// ============================================
const authenticateAyurvedaCenter = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'ayurveda_center') {
      return res.status(403).json({ 
        success, 
        message: 'Ayurveda center access required.' 
      });
    }
    next();
  });
};

// ============================================
// 🆕 HOMEOPATHY DOCTOR AUTHENTICATION
// ============================================
const authenticateHomeopathyDoctor = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'homeopathy_doctor') {
      return res.status(403).json({ 
        success, 
        message: 'Homeopathy doctor access required.' 
      });
    }
    next();
  });
};

// ============================================
// 🆕 HOMEOPATHY CENTER/PHARMACY AUTHENTICATION
// ============================================
const authenticateHomeopathyCenter = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'homeopathy_center' && req.user.role !== 'pharmacy') {
      return res.status(403).json({ 
        success, 
        message: 'Homeopathy center/pharmacy access required.' 
      });
    }
    next();
  });
};

// ============================================
// 🆕 MENTAL HEALTH THERAPIST AUTHENTICATION
// ============================================
const authenticateTherapist = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'mental_health_therapist') {
      return res.status(403).json({ 
        success, 
        message: 'Therapist access required.' 
      });
    }
    next();
  });
};

// ============================================
// 🆕 ONLINE DOCTOR AUTHENTICATION
// ============================================
const authenticateOnlineDoctor = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'online_doctor') {
      return res.status(403).json({ 
        success, 
        message: 'Online doctor access required.' 
      });
    }
    next();
  });
};

// ============================================
// 🆕 CORPORATE HR AUTHENTICATION
// ============================================
const authenticateCorporateHR = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'corporate_hr') {
      return res.status(403).json({ 
        success, 
        message: 'Corporate HR access required.' 
      });
    }
    next();
  });
};

// ============================================
// PHONE VERIFICATION (PRESERVED)
// ============================================
const isPhoneVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success, message: 'Authentication required.' });
  }

  if (!req.user.phoneVerified) {
    return res.status(403).json({
      success,
      message: 'Phone verification required.',
      requiresVerification});
  }
  next();
};

// ============================================
// 🆕 HOSPITAL VERIFICATION CHECK
// ============================================
const isHospitalVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success, message: 'Authentication required.' });
  }

  if (req.user.role !== 'hospital') {
    return res.status(403).json({ success, message: 'Hospital access required.' });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      success,
      message: 'Hospital verification pending. Please wait for admin approval.',
      requiresVerification});
  }
  next();
};

// ============================================
// 🆕 AMBULANCE PROVIDER VERIFICATION CHECK
// ============================================
const isAmbulanceVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success, message: 'Authentication required.' });
  }

  if (!req.user.isVerified || req.user.ambulanceVerificationStatus !== 'verified') {
    return res.status(403).json({
      success,
      message: 'Ambulance provider verification pending. Please wait for admin approval.',
      requiresVerification});
  }
  next();
};

// ============================================
// 🆕 SUBSCRIPTION CHECK
// ============================================
const checkSubscription = (requiredPlans) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success, message: 'Authentication required.' });
    }

    const userPlan = req.user.subscriptionPlan || 'free';
    
    if (requiredPlans && !requiredPlans.includes(userPlan)) {
      return res.status(403).json({
        success,
        message: `This feature requires ${requiredPlans.join(' or ')} subscription.`,
        currentPlan,
        upgradeRequired});
    }
    next();
  };
};

// ============================================
// 🆕 OWNERSHIP CHECK (Provider can only modify own data)
// ============================================
const checkOwnership = (model) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id || req.params.hospitalId || req.params.bookingId;
      
      if (!resourceId) {
        return next();
      }

      const resource = await model.findById(resourceId);
      
      if (!resource) {
        return res.status(404).json({ success, message: 'Resource not found.' });
      }

      const ownerField = resource.userId || resource.providerId || resource.ownerId || resource.driverId;
      
      if (ownerField && ownerField.toString() !== (req.user._id || req.user.userId)?.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ 
          success, 
          message: 'You can only modify your own resources.' 
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      return res.status(500).json({ success, message: 'Ownership check failed.' });
    }
  };
};

// ============================================
// 🆕 EMERGENCY TOKEN BYPASS (For ambulance)
// ============================================
const emergencyTokenBypass = (req, res, next) => {
  const emergencyToken = req.headers['x-emergency-token'] || req.query.emergencyToken;
  
  if (emergencyToken) {
    try {
      const decoded = jwt.verify(emergencyToken, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
      
      // Emergency tokens are short-lived (5 minutes)
      if (decoded.type === 'emergency' && decoded.exp > Date.now() / 1000) {
        req.user = decoded;
        req.isEmergencyToken = true;
        return next();
      }
    } catch (error) {
      // Token invalid, fall through to normal auth
    }
  }
  
  // No valid emergency token, require normal auth
  authenticateToken(req, res, next);
};

// ============================================
// 🆕 WEBSOCKET AUTHENTICATION
// ============================================
const authenticateWebSocket = (socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  
  if (!token) {
    // Allow guest tracking without token
    const trackingId = socket.handshake.query.trackingId;
    if (trackingId) {
      socket.userType = 'guest';
      socket.trackingId = trackingId;
      return next();
    }
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    socket.userId = decoded.userId || decoded.id;
    socket.userType = decoded.role;
    socket.userRole = decoded.role;
    next();
  } catch (error) {
    return next(new Error('Authentication failed'));
  }
};

// ============================================
// 🆕 RATE LIMIT BYPASS FOR EMERGENCIES
// ============================================
const emergencyRateLimitBypass = (req, res, next) => {
  // Check if this is a verified emergency request
  const isEmergencyEndpoint = req.path.includes('emergency-dispatch') || 
                              req.path.includes('crisis-alert') ||
                              req.path.includes('emergency-admission');
  
  if (isEmergencyEndpoint) {
    // Emergency requests get a special header
    req.emergencyRequest = true;
    
    // Less strict rate limiting for emergencies
    // The emergencyRateLimiter middleware handles this separately
  }
  
  next();
};

// ============================================
// 🆕 DEVICE VERIFICATION (For driver app)
// ============================================
const verifyDevice = (req, res, next) => {
  const deviceId = req.headers['x-device-id'];
  
  if (!deviceId) {
    // Not required for all routes, just note it
    req.deviceVerified = false;
    return next();
  }

  // In productiondevice is registered to this user
  // For now, just attach to request
  req.deviceId = deviceId;
  req.deviceVerified = true;
  
  next();
};

// ============================================
// 🆕 ACTIVE SESSION CHECK
// ============================================
const checkActiveSession = async (req, res, next) => {
  authenticateToken(req, res, async () => {
    try {
      // Check if user account is active and not blocked
      if (req.user.isBlocked) {
        return res.status(403).json({
          success,
          message: 'Your account has been suspended. Please contact support.',
          reason.user.blockedReason || 'Account suspended'
        });
      }

      if (!req.user.isActive) {
        return res.status(403).json({
          success,
          message: 'Your account is inactive. Please contact support.'
        });
      }

      // Update last active timestamp (in production, update in DB)
      req.user.lastActive = new Date();
      
      next();
    } catch (error) {
      return res.status(500).json({ success, message: 'Session check failed.' });
    }
  });
};

// ============================================
// 🆕 KYC VERIFICATION CHECK
// ============================================
const requireKYC = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success, message: 'Authentication required.' });
  }

  if (req.user.kycStatus !== 'verified') {
    return res.status(403).json({
      success,
      message: 'KYC verification required to access this feature.',
      kycStatus.user.kycStatus,
      requiresKYC});
  }
  next();
};

// ============================================
// 🆕 TWO-FACTOR AUTH CHECK
// ============================================
const require2FA = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success, message: 'Authentication required.' });
  }

  if (req.user.twoFactorEnabled && !req.headers['x-2fa-code']) {
    return res.status(403).json({
      success,
      message: 'Two-factor authentication code required.',
      requires2FA});
  }

  // In production2FA code here
  
  next();
};

// ============================================
// 🆕 COMBINED AUTH MIDDLEWARE (Common patterns)
// ============================================

// Full authentication+ Active Session + Phone Verified
const authenticateFull = [
  authenticateToken,
  checkActiveSession,
  isPhoneVerified
];

// Provider full auth+ Active + Phone + KYC
const authenticateProviderFull = [
  authenticateToken,
  checkActiveSession,
  isPhoneVerified,
  requireKYC
];

// Emergency authOR Emergency Token
const authenticateEmergency = [
  emergencyTokenBypass,
  emergencyRateLimitBypass
];

// Driver auth+ Device + Active
const authenticateDriverFull = [
  authenticateToken,
  verifyDevice,
  checkActiveSession
];

// ============================================
// EXPORTS (ALL PRESERVED + NEW)
// ============================================
module.exports = {
  // ──────────────────────────────────────────
  // Original exports (PRESERVED)
  // ──────────────────────────────────────────
  authenticateToken,
  authenticate,
  authenticatePatient,
  authenticateLender,
  isAdmin,
  authenticateInsuranceCompany,
  authenticateInsuranceAgent,
  isPhoneVerified,

  // ──────────────────────────────────────────
  // Provider authentication
  // ──────────────────────────────────────────
  authenticateProvider,
  authorizeRoles,
  
  // ──────────────────────────────────────────
  // Tag-specific authentication
  // ──────────────────────────────────────────
  authenticateHospital,
  authenticateAmbulance,
  authenticateAmbulanceProvider,
  authenticateAmbulanceDriver,
  authenticateCaregiver,
  authenticateDiagnostics,
  authenticateAdmin,
  authenticateSuperAdmin,
  authenticateInsurance,
  authenticateAyurvedaDoctor,
  authenticateAyurvedaCenter,
  authenticateHomeopathyDoctor,
  authenticateHomeopathyCenter,
  authenticateTherapist,
  authenticateOnlineDoctor,
  authenticateCorporateHR,

  // ──────────────────────────────────────────
  // Verification checks
  // ──────────────────────────────────────────
  isHospitalVerified,
  isAmbulanceVerified,
  requireKYC,
  require2FA,
  checkActiveSession,
  verifyDevice,

  // ──────────────────────────────────────────
  // Subscription & Ownership
  // ──────────────────────────────────────────
  checkSubscription,
  checkOwnership,

  // ──────────────────────────────────────────
  // Emergency & WebSocket
  // ──────────────────────────────────────────
  emergencyTokenBypass,
  emergencyRateLimitBypass,
  authenticateWebSocket,

  // ──────────────────────────────────────────
  // Combined middleware chains
  // ──────────────────────────────────────────
  authenticateFull,
  authenticateProviderFull,
  authenticateEmergency,
  authenticateDriverFull
};


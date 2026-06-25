const jwt = require('jsonwebtoken');

// ============================================
// ✅ AUTHENTICATE TOKEN (JWT Verification)
// ============================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
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
      return res.status(403).json({ success: false, message: 'Patient access required.' });
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
      'hospital', 'ambulance', 'caregiver', 'diagnostics',
      'lender', 'insurance_company', 'ayurveda_doctor',
      'ayurveda_center', 'homeopathy_doctor', 'homeopathy_center',
      'mental_health_therapist', 'pharmacy', 'corporate_hr'
    ];
    
    if (!providerRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
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
          success: false,
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
        success: false, 
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
    if (req.user.role !== 'ambulance') {
      return res.status(403).json({ 
        success: false, 
        message: 'Ambulance provider access required.' 
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
        success: false, 
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
        success: false, 
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
      return res.status(403).json({ success: false, message: 'Lender access required.' });
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
    return res.status(401).json({ success: false, message: 'Admin access denied' });
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
        success: false, 
        message: 'Admin access required.' 
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
      return res.status(403).json({ success: false, message: 'Insurance company access required.' });
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
      return res.status(403).json({ success: false, message: 'Insurance agent access required.' });
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
        success: false, 
        message: 'Ayurveda doctor access required.' 
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
        success: false, 
        message: 'Homeopathy doctor access required.' 
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
        success: false, 
        message: 'Therapist access required.' 
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
        success: false, 
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
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  if (!req.user.phoneVerified) {
    return res.status(403).json({
      success: false,
      message: 'Phone verification required.',
      requiresVerification: true
    });
  }
  next();
};

// ============================================
// 🆕 HOSPITAL VERIFICATION CHECK
// ============================================
const isHospitalVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  if (req.user.role !== 'hospital') {
    return res.status(403).json({ success: false, message: 'Hospital access required.' });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Hospital verification pending. Please wait for admin approval.',
      requiresVerification: true
    });
  }
  next();
};

// ============================================
// 🆕 SUBSCRIPTION CHECK
// ============================================
const checkSubscription = (requiredPlans) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const userPlan = req.user.subscriptionPlan || 'free';
    
    if (requiredPlans && !requiredPlans.includes(userPlan)) {
      return res.status(403).json({
        success: false,
        message: `This feature requires ${requiredPlans.join(' or ')} subscription.`,
        currentPlan: userPlan,
        upgradeRequired: true
      });
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
      const resourceId = req.params.id || req.params.hospitalId;
      
      if (!resourceId) {
        return next(); // No ID to check, proceed
      }

      const resource = await model.findById(resourceId);
      
      if (!resource) {
        return res.status(404).json({ success: false, message: 'Resource not found.' });
      }

      // Check if user owns this resource
      const ownerField = resource.userId || resource.providerId || resource.ownerId;
      
      if (ownerField && ownerField.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ 
          success: false, 
          message: 'You can only modify your own resources.' 
        });
      }

      req.resource = resource; // Attach resource to request
      next();
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Ownership check failed.' });
    }
  };
};

// ============================================
// EXPORTS (PRESERVED + NEW)
// ============================================
module.exports = {
  // Original exports (PRESERVED)
  authenticateToken,
  authenticate,
  authenticatePatient,
  authenticateLender,
  isAdmin,
  authenticateInsuranceCompany,
  authenticateInsuranceAgent,
  isPhoneVerified,

  // 🆕 New exports (ADDED)
  authenticateProvider,
  authorizeRoles,
  authenticateHospital,
  authenticateAmbulance,
  authenticateCaregiver,
  authenticateDiagnostics,
  authenticateAdmin,
  authenticateAyurvedaDoctor,
  authenticateHomeopathyDoctor,
  authenticateTherapist,
  authenticateCorporateHR,
  isHospitalVerified,
  checkSubscription,
  checkOwnership
};
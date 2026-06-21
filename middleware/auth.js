const jwt = require('jsonwebtoken');

// ============================================
// YOUR EXISTING MIDDLEWARE (PRESERVED)
// ============================================

// General authentication - verifies token only
const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

// Patient-only authentication
const authenticatePatient = (req, res, next) => {
  authenticate(req, res, () => {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Patient access required.' });
    }
    next();
  });
};

// Lender-only authentication
const authenticateLender = (req, res, next) => {
  authenticate(req, res, () => {
    if (req.user.role !== 'lender') {
      return res.status(403).json({ success: false, message: 'Lender access required.' });
    }
    next();
  });
};

// Admin authentication (using API key)
const isAdmin = (req, res, next) => {
  const adminKey = req.header('X-Admin-Key');
  const validKey = process.env.ADMIN_KEY || 'admin_secret_key_2024';
  
  if (!adminKey || adminKey !== validKey) {
    return res.status(401).json({ success: false, message: 'Admin access denied' });
  }
  next();
};

// ============================================
// NEW ROLE-BASED AUTHENTICATION (ADDED)
// ============================================

// Caregiver-only authentication
const authenticateCaregiver = (req, res, next) => {
  authenticate(req, res, () => {
    if (req.user.role !== 'caregiver') {
      return res.status(403).json({ success: false, message: 'Caregiver access required.' });
    }
    next();
  });
};

// Insurance Company-only authentication
const authenticateInsuranceCompany = (req, res, next) => {
  authenticate(req, res, () => {
    if (req.user.role !== 'insurance_company') {
      return res.status(403).json({ success: false, message: 'Insurance company access required.' });
    }
    next();
  });
};

// Insurance Agent-only authentication
const authenticateInsuranceAgent = (req, res, next) => {
  authenticate(req, res, () => {
    if (req.user.role !== 'insurance_agent') {
      return res.status(403).json({ success: false, message: 'Insurance agent access required.' });
    }
    next();
  });
};

// Corporate HR-only authentication
const authenticateCorporateHR = (req, res, next) => {
  authenticate(req, res, () => {
    if (req.user.role !== 'corporate_hr') {
      return res.status(403).json({ success: false, message: 'Corporate HR access required.' });
    }
    next();
  });
};

// ============================================
// VERIFICATION-BASED MIDDLEWARE (ADDED)
// ============================================

// Check if phone is verified
const isPhoneVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  
  if (!req.user.phoneVerified) {
    return res.status(403).json({ 
      success: false, 
      message: 'Phone verification required.',
      requiresVerification: true,
      verificationType: 'phone'
    });
  }
  next();
};

// Check if email is verified
const isEmailVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  
  if (!req.user.emailVerified) {
    return res.status(403).json({ 
      success: false, 
      message: 'Email verification required.',
      requiresVerification: true,
      verificationType: 'email'
    });
  }
  next();
};

// Check if fully verified (phone + email)
const isFullyVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  
  if (!req.user.phoneVerified || !req.user.emailVerified) {
    return res.status(403).json({ 
      success: false, 
      message: 'Full verification required. Please verify your phone and email.',
      requiresVerification: true,
      phoneVerified: req.user.phoneVerified || false,
      emailVerified: req.user.emailVerified || false
    });
  }
  next();
};

// Check if KYC is completed
const isKYCVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  
  if (req.user.kycStatus !== 'verified') {
    return res.status(403).json({ 
      success: false, 
      message: 'KYC verification required.',
      kycStatus: req.user.kycStatus || 'pending'
    });
  }
  next();
};

// ============================================
// INSURANCE-SPECIFIC MIDDLEWARE (ADDED)
// ============================================

// Check if user is an insurance company and verified
const isVerifiedInsuranceCompany = (req, res, next) => {
  authenticateInsuranceCompany(req, res, () => {
    if (!req.user.isVerified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Insurance company not verified. Please complete verification process.',
        requiresVerification: true
      });
    }
    if (req.user.kycStatus !== 'verified') {
      return res.status(403).json({ 
        success: false, 
        message: 'KYC verification required for insurance company.',
        kycStatus: req.user.kycStatus
      });
    }
    next();
  });
};

// Check if user can sell insurance (company or agent)
const canSellInsurance = (req, res, next) => {
  authenticate(req, res, () => {
    const { role, isVerified, kycStatus, agentLicenseNumber } = req.user;
    
    if (role === 'insurance_company') {
      if (!isVerified || kycStatus !== 'verified') {
        return res.status(403).json({ 
          success: false, 
          message: 'Insurance company not fully verified. Please complete verification.',
          requiresVerification: true
        });
      }
      next();
    } else if (role === 'insurance_agent') {
      if (!isVerified || !agentLicenseNumber) {
        return res.status(403).json({ 
          success: false, 
          message: 'Insurance agent not verified. Please complete verification.',
          requiresVerification: true
        });
      }
      next();
    } else {
      return res.status(403).json({ 
        success: false, 
        message: 'Insurance selling privileges required. Only insurance companies and agents can sell policies.'
      });
    }
  });
};

// ============================================
// ADMIN ROLES (ADDED)
// ============================================

// Admin authentication using token role check (Alternative to API key)
const authenticateAdmin = (req, res, next) => {
  authenticate(req, res, () => {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }
    next();
  });
};

// Super Admin only
const authenticateSuperAdmin = (req, res, next) => {
  authenticate(req, res, () => {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super admin access required.' });
    }
    next();
  });
};

// ============================================
// INSURANCE ADMIN (ADDED)
// ============================================

// Combined admin check (API key OR token)
const isInsuranceAdmin = (req, res, next) => {
  // First try API key
  const adminKey = req.header('X-Admin-Key');
  const validKey = process.env.ADMIN_KEY || 'admin_secret_key_2024';
  
  if (adminKey && adminKey === validKey) {
    req.adminType = 'api_key';
    return next();
  }
  
  // Then try token-based admin
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin' || decoded.role === 'super_admin') {
        req.user = decoded;
        req.adminType = 'token';
        return next();
      }
    } catch (error) {
      // Invalid token, continue to error
    }
  }
  
  return res.status(401).json({ 
    success: false, 
    message: 'Admin access denied. Valid admin credentials required.' 
  });
};

// ============================================
// RATE LIMIT MIDDLEWARE (ADDED)
// ============================================

// Simple rate limiter for OTP and sensitive routes
const rateLimitStore = new Map();

const rateLimit = (key, maxRequests = 5, windowMinutes = 1) => {
  return (req, res, next) => {
    const identifier = key || req.ip || req.user?.id || req.body?.phone || req.body?.email;
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;
    
    if (!rateLimitStore.has(identifier)) {
      rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs });
      return next();
    }
    
    const record = rateLimitStore.get(identifier);
    
    if (now > record.resetAt) {
      record.count = 1;
      record.resetAt = now + windowMs;
      return next();
    }
    
    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: `Too many requests. Please try again in ${Math.ceil((record.resetAt - now) / 1000)} seconds.`,
        retryAfter: Math.ceil((record.resetAt - now) / 1000)
      });
    }
    
    record.count += 1;
    next();
  };
};

// ============================================
// EXPORTS (PRESERVED + NEW)
// ============================================

module.exports = { 
  // Existing exports (PRESERVED)
  authenticate, 
  authenticatePatient, 
  authenticateLender, 
  isAdmin,
  
  // New role-based exports (ADDED)
  authenticateCaregiver,
  authenticateInsuranceCompany,
  authenticateInsuranceAgent,
  authenticateCorporateHR,
  
  // New verification exports (ADDED)
  isPhoneVerified,
  isEmailVerified,
  isFullyVerified,
  isKYCVerified,
  
  // New insurance exports (ADDED)
  isVerifiedInsuranceCompany,
  canSellInsurance,
  
  // New admin exports (ADDED)
  authenticateAdmin,
  authenticateSuperAdmin,
  isInsuranceAdmin,
  
  // Rate limiter (ADDED)
  rateLimit,
  rateLimitStore
};
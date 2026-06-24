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
// LENDER-ONLY AUTHENTICATION
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
// ADMIN AUTHENTICATION (API Key)
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
// INSURANCE COMPANY AUTHENTICATION
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
// INSURANCE AGENT AUTHENTICATION
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
// PHONE VERIFICATION
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
// EXPORTS
// ============================================
module.exports = {
  authenticateToken,
  authenticate,
  authenticatePatient,
  authenticateLender,
  isAdmin,
  authenticateInsuranceCompany,
  authenticateInsuranceAgent,
  isPhoneVerified
};
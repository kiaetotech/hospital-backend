const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // ... middleware logic
};

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
// ADD THESE FOR INSURANCE MODULE (Optional)
// ============================================

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

// Phone verification middleware
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
// UPDATE EXPORTS (Add new ones)
// ============================================

module.exports = { 
  authenticate, 
  authenticatePatient, 
  authenticateLender, 
  isAdmin,
  authenticateInsuranceCompany,   // ADD THIS
  authenticateInsuranceAgent,     // ADD THIS
  isPhoneVerified                 // ADD THIS
};

module.exports = { 
  authenticate, 
  authenticatePatient, 
  authenticateLender, 
  isAdmin 
};
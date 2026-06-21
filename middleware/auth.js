const jwt = require('jsonwebtoken');

// ============================================
// GENERAL AUTHENTICATION - verifies token only
// ============================================
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// ============================================
// PATIENT-ONLY AUTHENTICATION
// ============================================
const authenticatePatient = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.role !== 'patient') {
      return res.status(403).json({
        success: false,
        message: 'Patient access required.'
      });
    }
    next();
  });
};

// ============================================
// LENDER-ONLY AUTHENTICATION
// ============================================
const authenticateLender = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.role !== 'lender') {
      return res.status(403).json({
        success: false,
        message: 'Lender access required.'
      });
    }
    next();
  });
};

// ============================================
// ADMIN AUTHENTICATION (using API key)
// ============================================
const isAdmin = (req, res, next) => {
  const adminKey = req.header('X-Admin-Key');
  const validKey = process.env.ADMIN_KEY || 'admin_secret_key_2024';

  if (!adminKey || adminKey !== validKey) {
    return res.status(401).json({
      success: false,
      message: 'Admin access denied'
    });
  }
  next();
};

// ============================================
// EXPORTS - SINGLE FUNCTION AND OBJECT
// ============================================

// ✅ CORRECT: Export auth as the main function
module.exports = auth;

// ✅ ALSO CORRECT: If you need both, use this:
// module.exports = {
//   auth,
//   authenticatePatient,
//   authenticateLender,
//   isAdmin
// };
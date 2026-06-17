const jwt = require('jsonwebtoken');

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

module.exports = { 
  authenticate, 
  authenticatePatient, 
  authenticateLender, 
  isAdmin 
};
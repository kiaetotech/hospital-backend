const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Lender = require('../models/Lender');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital_platform_secret_key_2024';

// ============================================
// HELPER FUNCTIONS
// ============================================

const generateLenderId = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `LDR_${timestamp}_${random}`;
};

const generateApiKey = () => {
  return 'LDR_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 8);
};

const generateApiSecret = () => {
  return Math.random().toString(36).substring(2, 30);
};

// ============================================
// INLINE AUTH FUNCTION
// ============================================

const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

// ============================================
// LENDER SELF-REGISTRATION
// ============================================

router.post('/register', async (req, res) => {
  try {
    const {
      businessName,
      registrationNumber,
      email,
      phone,
      password,
      registeredOffice,
      branches,
      lenderType,
      servicePincodes,
      serviceCities,
      serviceDistricts,
      serviceStates,
      loanProducts,
      commissionRate
    } = req.body;

    if (!businessName || !registrationNumber || !email || !phone || !password || !registeredOffice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await Lender.findOne({ 
      $or: [{ email }, { registrationNumber }] 
    });
    if (existing) {
      return res.status(400).json({ 
        error: 'Lender already registered with this email or registration number' 
      });
    }

    const lenderId = generateLenderId();
    const apiKey = generateApiKey();
    const apiSecret = generateApiSecret();

    const branchesWithIds = branches?.map((branch, index) => ({
      ...branch,
      branchId: `BR_${lenderId}_${index + 1}`,
      isActive})) || [];

    const lender = new Lender({
      lenderId,
      businessName,
      registrationNumber,
      email,
      phone,
      password,
      registeredOffice,
      branches,
      lenderType|| 'regional',
      servicePincodes|| [],
      serviceCities|| [],
      serviceDistricts|| [],
      serviceStates|| [],
      loanProducts|| [],
      commissionRate|| 2,
      apiConfig: {
        apiKey,
        apiSecret,
        webhookUrl: '',
        supportsWebhook},
      status: 'pending',
      createdAtDate()
    });

    await lender.save();

    console.log(`📧 New lender registration: ${businessName} (${lenderId})`);

    res.status(201).json({
      success,
      lenderId,
      apiKey,
      apiSecret,
      message: 'Registration submitted for admin approval. You will receive email once verified.',
      status: 'pending'
    });
  } catch (error) {
    console.error('Lender registration error:', error);
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
});

// ============================================
// LENDER LOGIN
// ============================================

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const lender = await Lender.findOne({ email });
    if (!lender) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await lender.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (lender.status !== 'active') {
      return res.status(403).json({ 
        error: `Account is ${lender.status}. Please contact support.` 
      });
    }

    const token = jwt.sign(
      { 
        id._id, 
        lenderId.lenderId, 
        email.email, 
        role: 'lender' 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success,
      token,
      lender: {
        lenderId.lenderId,
        businessName.businessName,
        email.email,
        phone.phone,
        status.status,
        commissionRate.commissionRate,
        branches.branches,
        loanProducts.loanProducts
      }
    });
  } catch (error) {
    console.error('Lender login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================
// GET LENDER PROFILE (Using inline auth)
// ============================================

router.get('/profile', authenticate, async (req, res) => {
  try {
    const lender = await Lender.findOne({ lenderId.user.lenderId })
      .select('-password -apiConfig.apiSecret');
    if (!lender) {
      return res.status(404).json({ error: 'Lender not found' });
    }
    res.json(lender);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ============================================
// UPDATE LENDER PROFILE (Using inline auth)
// ============================================

router.put('/profile', authenticate, async (req, res) => {
  try {
    const { 
      servicePincodes, 
      serviceCities, 
      serviceDistricts, 
      serviceStates, 
      loanProducts, 
      webhookUrl,
      branches
    } = req.body;

    const lender = await Lender.findOne({ lenderId.user.lenderId });
    if (!lender) {
      return res.status(404).json({ error: 'Lender not found' });
    }

    if (servicePincodes) lender.servicePincodes = servicePincodes;
    if (serviceCities) lender.serviceCities = serviceCities;
    if (serviceDistricts) lender.serviceDistricts = serviceDistricts;
    if (serviceStates) lender.serviceStates = serviceStates;
    if (loanProducts) lender.loanProducts = loanProducts;
    if (webhookUrl) lender.apiConfig.webhookUrl = webhookUrl;
    if (branches) lender.branches = branches;

    lender.updatedAt = new Date();
    await lender.save();

    res.json({ 
      success, 
      message: 'Profile updated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;


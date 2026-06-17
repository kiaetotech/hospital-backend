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
      isActive: true
    })) || [];

    const lender = new Lender({
      lenderId,
      businessName,
      registrationNumber,
      email,
      phone,
      password,
      registeredOffice,
      branches: branchesWithIds,
      lenderType: lenderType || 'regional',
      servicePincodes: servicePincodes || [],
      serviceCities: serviceCities || [],
      serviceDistricts: serviceDistricts || [],
      serviceStates: serviceStates || [],
      loanProducts: loanProducts || [],
      commissionRate: commissionRate || 2,
      apiConfig: {
        apiKey,
        apiSecret,
        webhookUrl: '',
        supportsWebhook: false
      },
      status: 'pending',
      createdAt: new Date()
    });

    await lender.save();

    console.log(`📧 New lender registration: ${businessName} (${lenderId})`);

    res.status(201).json({
      success: true,
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
        id: lender._id, 
        lenderId: lender.lenderId, 
        email: lender.email, 
        role: 'lender' 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      lender: {
        lenderId: lender.lenderId,
        businessName: lender.businessName,
        email: lender.email,
        phone: lender.phone,
        status: lender.status,
        commissionRate: lender.commissionRate,
        branches: lender.branches,
        loanProducts: lender.loanProducts
      }
    });
  } catch (error) {
    console.error('Lender login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================
// GET LENDER PROFILE (No auth - uses token from header)
// ============================================

router.get('/profile', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Access denied' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const lender = await Lender.findOne({ lenderId: decoded.lenderId })
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
// UPDATE LENDER PROFILE (No auth - uses token from header)
// ============================================

router.put('/profile', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Access denied' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const { 
      servicePincodes, 
      serviceCities, 
      serviceDistricts, 
      serviceStates, 
      loanProducts, 
      webhookUrl,
      branches
    } = req.body;

    const lender = await Lender.findOne({ lenderId: decoded.lenderId });
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
      success: true, 
      message: 'Profile updated successfully',
      lender: lender.toObject({ 
        getters: true, 
        transform: (doc, ret) => { 
          delete ret.password; 
          delete ret.apiConfig?.apiSecret;
          return ret; 
        } 
      })
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
const express = require('express');
const jwt = require('jsonwebtoken');
const Provider = require('../models/Provider');
const router = express.Router();

// ============================================
// ✅ ADMIN LOGIN - Generates JWT Token
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { adminKey } = req.body;

    // Check admin key
    const validAdminKey = process.env.ADMIN_KEY || 'admin_secret_key_2024';
    
    if (adminKey !== validAdminKey) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid admin key' 
      });
    }

    // Generate JWT token for admin
    const token = jwt.sign(
      { 
        role: 'admin', 
        isAdmin: true,
        type: 'admin'
      },
      process.env.JWT_SECRET || 'hospital_platform_secret_key_2024',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token: token,
      message: 'Admin login successful',
      admin: {
        role: 'admin',
        name: 'Admin'
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ============================================
// EXISTING PROVIDER ROUTES (PRESERVED)
// ============================================

// Get all unverified providers
router.get('/providers/pending', async (req, res) => {
  try {
    const providers = await Provider.find({ isVerified: false }).select('-password');
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all providers
router.get('/providers', async (req, res) => {
  try {
    const providers = await Provider.find().select('-password').sort({ createdAt: -1 });
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify a provider
router.put('/providers/:id/verify', async (req, res) => {
  try {
    const { adminName, adminNote } = req.body;
    const provider = await Provider.findByIdAndUpdate(
      req.params.id,
      { 
        isVerified: true, 
        verifiedAt: new Date(),
        verifiedBy: adminName || 'Admin',
        adminNote: adminNote || ''
      },
      { new: true }
    ).select('-password');
    res.json({ success: true, provider });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject/Delete a provider
router.delete('/providers/:id', async (req, res) => {
  try {
    await Provider.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get provider stats
router.get('/stats', async (req, res) => {
  try {
    const total = await Provider.countDocuments();
    const verified = await Provider.countDocuments({ isVerified: true });
    const pending = await Provider.countDocuments({ isVerified: false });
    res.json({ total, verified, pending });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
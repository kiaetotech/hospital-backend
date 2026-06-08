const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Provider = require('../models/Provider');  // ← CHANGED THIS LINE
const router = express.Router();

// Agency Registration
router.post('/register', async (req, res) => {
  try {
    const { providerName, email, password, phone, city } = req.body;
    
    const existingProvider = await Provider.findOne({ $or: [{ email }, { providerName }] });
    if (existingProvider) {
      return res.status(400).json({ error: 'Provider already exists with this email or name' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const provider = new Provider({
      providerName,
      email,
      password: hashedPassword,
      phone,
      city,
      isVerified: false
    });
    
    await provider.save();
    
    const token = jwt.sign({ id: provider._id, providerName, email }, global.JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      success: true,
      token,
      provider: {
        id: provider._id,
        providerName: provider.providerName,
        email: provider.email,
        isVerified: provider.isVerified
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agency Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const provider = await Provider.findOne({ email });
    if (!provider) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const validPassword = await bcrypt.compare(password, provider.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const token = jwt.sign({ id: provider._id, providerName: provider.providerName, email }, global.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      token,
      provider: {
        id: provider._id,
        providerName: provider.providerName,
        email: provider.email,
        phone: provider.phone,
        city: provider.city,
        rating: provider.rating,
        isVerified: provider.isVerified
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get profile
router.get('/profile', global.authenticateToken, async (req, res) => {
  try {
    const provider = await Provider.findById(req.user.id).select('-password');
    res.json(provider);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all providers (for admin)
router.get('/providers', async (req, res) => {
  try {
    const providers = await Provider.find().select('-password');
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
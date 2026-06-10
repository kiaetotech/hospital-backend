const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Provider = require('../models/Provider');
const ProviderPrice = require('../models/ProviderPrice');
const Review = require('../models/Review');
const router = express.Router();

// Agency Registration
router.post('/register', async (req, res) => {
  try {
    const { providerName, email, password, phone, city, address, pincode, latitude, longitude } = req.body;
    
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
      address,
      pincode,
      latitude,
      longitude,
      isVerified: false,  // Admin approval required
      isActive: true,
      rating: 0,
      createdAt: new Date()
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
        isVerified: provider.isVerified,
        rating: provider.rating
      },
      message: 'Registration successful. Waiting for admin approval.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agency Login (only if verified)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const provider = await Provider.findOne({ email });
    if (!provider) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check if provider is verified
    if (!provider.isVerified) {
      return res.status(403).json({ error: 'Your account is pending admin approval. Please wait.' });
    }
    
    const validPassword = await bcrypt.compare(password, provider.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Update rating from reviews
    const reviews = await Review.find({ providerId: provider._id });
    if (reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      provider.rating = parseFloat(avgRating.toFixed(1));
      await provider.save();
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
        address: provider.address,
        latitude: provider.latitude,
        longitude: provider.longitude,
        rating: provider.rating,
        isVerified: provider.isVerified
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get profile (with updated rating)
router.get('/profile', global.authenticateToken, async (req, res) => {
  try {
    const provider = await Provider.findById(req.user.id).select('-password');
    
    // Update rating from reviews
    const reviews = await Review.find({ providerId: provider._id });
    if (reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      provider.rating = parseFloat(avgRating.toFixed(1));
      await provider.save();
    }
    
    res.json(provider);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update provider profile (address, location)
router.put('/profile', global.authenticateToken, async (req, res) => {
  try {
    const { address, city, pincode, latitude, longitude, phone } = req.body;
    
    const updateData = {};
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (pincode !== undefined) updateData.pincode = pincode;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (phone !== undefined) updateData.phone = phone;
    updateData.updatedAt = new Date();
    
    const provider = await Provider.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    ).select('-password');
    
    // Also update all price entries with new address/location
    if (address || latitude || longitude || city) {
      await ProviderPrice.updateMany(
        { providerId: req.user.id },
        { 
          address: address || provider.address,
          latitude: latitude || provider.latitude,
          longitude: longitude || provider.longitude,
          city: city || provider.city
        }
      );
    }
    
    res.json({ success: true, provider });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all providers (for admin) - includes unverified
router.get('/providers', async (req, res) => {
  try {
    const providers = await Provider.find().select('-password').sort({ createdAt: -1 });
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get only verified providers (for public)
router.get('/verified', async (req, res) => {
  try {
    const providers = await Provider.find({ isVerified: true, isActive: true }).select('-password');
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get provider by ID with rating
router.get('/:id', async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id).select('-password');
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    
    const reviews = await Review.find({ providerId: provider._id }).sort({ createdAt: -1 });
    const avgRating = reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0;
    
    res.json({
      ...provider.toObject(),
      averageRating: parseFloat(avgRating.toFixed(1)),
      totalReviews: reviews.length,
      reviews
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
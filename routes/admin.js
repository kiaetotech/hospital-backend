const express = require('express');
const Provider = require('../models/Provider');
const router = express.Router();

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
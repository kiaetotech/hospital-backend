const express = require('express');
const Provider = require('../models/Provider');
const router = express.Router();

// Get all unverified providers
router.get('/providers/pending', async (req, res) => {
  try {
    const providers = await Provider.find({ isVerified}).select('-password');
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// Verify a provider
router.put('/providers//verify', async (req, res) => {
  try {
    const { adminName, adminNote } = req.body;
    const provider = await Provider.findByIdAndUpdate(
      req.params.id,
      { 
        isVerified, 
        verifiedAtDate(),
        verifiedBy,
        adminNote},
      { new}
    ).select('-password');
    res.json({ success, provider });
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// Reject a provider
router.delete('/providers/', async (req, res) => {
  try {
    await Provider.findByIdAndDelete(req.params.id);
    res.json({ success});
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

module.exports = router;


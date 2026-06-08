const express = require('express');
const Test = require('../models/Test');
const ProviderPrice = require('../models/ProviderPrice');
const router = express.Router();

router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim() === '') {
    return res.json([]);
  }
  try {
    const tests = await Test.find({
      testName: { $regex: q, $options: 'i' }
    }).limit(30);
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/compare', async (req, res) => {
  const { testNames, city } = req.body;
  try {
    const prices = await ProviderPrice.find({
      testName: { $in: testNames },
      isActive: true,
      city: { $in: [city, 'All'] }
    });
    res.json(prices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
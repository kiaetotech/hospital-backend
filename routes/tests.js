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
    const query = {
      testName: { $in: testNames },
      isActive: true
    };
    
    if (city && city !== 'All') {
      query.city = { $in: [city, 'All'] };
    }
    
    const prices = await ProviderPrice.find(query).sort({ price: 1 });
    
    // Group by provider
    const groupedByProvider = {};
    prices.forEach(price => {
      if (!groupedByProvider[price.providerName]) {
        groupedByProvider[price.providerName] = {
          providerName: price.providerName,
          rating: price.rating || 4.0,
          city: price.city,
          homeCollectionAvailable: price.homeCollectionAvailable,
          reportTimeHours: price.reportTimeHours,
          prices: {},
          totalPrice: 0
        };
      }
      groupedByProvider[price.providerName].prices[price.testName] = {
        price: price.price,
        discountedPrice: price.discountedPrice || price.price
      };
      groupedByProvider[price.providerName].totalPrice += (price.discountedPrice || price.price);
    });
    
    const result = Object.values(groupedByProvider).sort((a, b) => a.totalPrice - b.totalPrice);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
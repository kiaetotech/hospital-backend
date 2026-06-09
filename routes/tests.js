const express = require('express');
const Test = require('../models/Test');
const ProviderPrice = require('../models/ProviderPrice');
const router = express.Router();

// Search tests
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim() === '') {
    return res.json([]);
  }
  try {
    const tests = await Test.find({
      testName: { $regex: q, $options: 'i' }
    }).limit(50);
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all tests
router.get('/all', async (req, res) => {
  try {
    const tests = await Test.find({ isActive: true }).sort({ testName: 1 });
    res.json({ tests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Compare prices with filters
router.post('/compare', async (req, res) => {
  const { 
    testNames, 
    city, 
    minRating, 
    maxPrice, 
    homeCollectionOnly,
    maxDistance,
    userLat,
    userLng
  } = req.body;
  
  try {
    let query = {
      testName: { $in: testNames },
      isActive: true
    };
    
    // City filter
    if (city && city !== 'All' && city !== '') {
      query.city = { $in: [city, 'All'] };
    }
    
    // Rating filter
    if (minRating && minRating !== '') {
      query.rating = { $gte: parseFloat(minRating) };
    }
    
    // Home collection filter
    if (homeCollectionOnly === true) {
      query.homeCollectionAvailable = true;
    }
    
    let prices = await ProviderPrice.find(query);
    
    // Price filter (using discounted price)
    if (maxPrice && maxPrice !== '') {
      prices = prices.filter(p => (p.discountedPrice || p.price) <= parseFloat(maxPrice));
    }
    
    // Group by provider
    const groupedByProvider = {};
    prices.forEach(price => {
      if (!groupedByProvider[price.providerName]) {
        groupedByProvider[price.providerName] = {
          providerName: price.providerName,
          rating: price.rating || 4.0,
          city: price.city || 'All',
          homeCollectionAvailable: price.homeCollectionAvailable || false,
          reportTimeHours: price.reportTimeHours || 24,
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
    
    // Convert to array and sort by total price (cheapest first)
    let result = Object.values(groupedByProvider);
    result.sort((a, b) => a.totalPrice - b.totalPrice);
    
    res.json(result);
  } catch (error) {
    console.error('Compare error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get prices for a specific test
router.get('/prices/:testName', async (req, res) => {
  try {
    const prices = await ProviderPrice.find({
      testName: { $regex: req.params.testName, $options: 'i' },
      isActive: true
    }).sort({ price: 1 });
    res.json(prices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
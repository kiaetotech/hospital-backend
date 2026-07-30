const express = require('express');
const Test = require('../models/Test');
const ProviderPrice = require('../models/ProviderPrice');
const router = express.Router();

// Haversine formula to calculate distance between two coordinates (in km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

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

// Compare prices with filters (including distance)
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
    
    // Group by provider and calculate distance
    const groupedByProvider = {};
    for (const price of prices) {
      if (!groupedByProvider[price.providerName]) {
        // Calculate distance if user location and provider location are available
        let distance = null;
        let distanceKm = null;
        
        if (userLat && userLng && price.latitude && price.longitude) {
          distanceKm = calculateDistance(userLat, userLng, price.latitude, price.longitude);
          distance = distanceKm ? `${distanceKm.toFixed(1)} km` : 'Not available';
        } else {
          distance = 'Location not available';
        }
        
        groupedByProvider[price.providerName] = {
          providerName: price.providerName,
          rating: price.rating || 4.0,
          city: price.city || 'All',
          address: price.address || 'Address not provided',
          distance: distance,
          distanceKm: distanceKm,
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
    }
    
    // Convert to array
    let result = Object.values(groupedByProvider);
    
    // Filter by max distance
    if (maxDistance && maxDistance !== '' && userLat && userLng) {
      result = result.filter(provider => {
        if (provider.distanceKm === null) return false;
        return provider.distanceKm <= parseFloat(maxDistance);
      });
    }
    
    // Sort by total price (cheapest first)
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
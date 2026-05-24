const express = require('express');
const router = express.Router();
const Hospital = require('../models/Hospital');

// Helper function for distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return parseFloat((R * c).toFixed(1));
}

// Regular search (by city, disease)
router.get('/search', async (req, res) => {
  try {
    const { city, disease } = req.query;
    let query = {};
    
    if (city) {
      query['address.city'] = { $regex: new RegExp(city, 'i') };
    }
    if (disease) {
      query.diseases_treated = { $in: [new RegExp(disease, 'i')] };
    }
    
    const hospitals = await Hospital.find(query).limit(20);
    res.json({ success: true, data: hospitals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Emergency search (by disease/symptom, with location)
router.get('/emergency-search', async (req, res) => {
  try {
    const { disease, lat, lng, sortBy = 'emergency' } = req.query;
    
    let query = {};
    if (disease) {
      query.diseases_treated = { $in: [new RegExp(disease, 'i')] };
    }
    
    let hospitals = await Hospital.find(query);
    
    // Add distance if location provided
    if (lat && lng) {
      hospitals = hospitals.map(h => ({
        ...h.toObject(),
        distance: calculateDistance(parseFloat(lat), parseFloat(lng), h.location?.lat, h.location?.lng)
      }));
    }
    
    // Sort based on emergency priority
    if (sortBy === 'emergency') {
      hospitals.sort((a, b) => {
        let scoreA = 0, scoreB = 0;
        if (a.has24x7ER) scoreA += 40;
        if (b.has24x7ER) scoreB += 40;
        if (a.beds?.icu_available > 0) scoreA += 20;
        if (b.beds?.icu_available > 0) scoreB += 20;
        if (a.ratings?.average) scoreA += a.ratings.average * 5;
        if (b.ratings?.average) scoreB += b.ratings.average * 5;
        if (a.distance) scoreA -= a.distance / 2;
        if (b.distance) scoreB -= b.distance / 2;
        return scoreB - scoreA;
      });
    } else if (sortBy === 'distance' && lat && lng) {
      hospitals.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    } else if (sortBy === 'rating') {
      hospitals.sort((a, b) => (b.ratings?.average || 0) - (a.ratings?.average || 0));
    }
    
    res.json({ success: true, data: hospitals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single hospital by ID
router.get('/:id', async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }
    res.json({ success: true, data: hospital });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
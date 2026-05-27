const express = require('express');
const router = express.Router();
const Hospital = require('../models/Hospital');

// Calculate distance between two coordinates (in km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return parseFloat((R * c).toFixed(1));
}

// GET /api/hospitals/search - Search hospitals
router.get('/search', async (req, res) => {
  try {
    const { q, city, page = 1, limit = 10, lat, lng } = req.query;
    
    let query = {};
    
    // Search by disease/symptom/city/hospital name
    if (q && q.trim() !== '') {
      const searchRegex = new RegExp(q, 'i');
      query.$or = [
        { diseases_treated: { $in: [searchRegex] } },
        { specialties: { $in: [searchRegex] } },
        { name: searchRegex },
        { 'address.city': searchRegex }
      ];
    }
    
    // City filter (if provided separately)
    if (city && city.trim() !== '') {
      query['address.city'] = { $regex: new RegExp(city, 'i') };
    }
    
    // Get total count for pagination
    const total = await Hospital.countDocuments(query);
    
    // Fetch hospitals from MongoDB
    let hospitals = await Hospital.find(query)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    
    // Convert to plain objects and add distance if location provided
    hospitals = hospitals.map(h => {
      const hospitalObj = h.toObject();
      if (lat && lng && hospitalObj.location) {
        hospitalObj.distance = calculateDistance(
          parseFloat(lat), parseFloat(lng),
          hospitalObj.location.lat, hospitalObj.location.lng
        );
      }
      return hospitalObj;
    });
    
    res.json({
      success: true,
      data: hospitals,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalHospitals: total,
        perPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/hospitals/:id - Get single hospital
router.get('/:id', async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }
    res.json({ success: true, data: hospital });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

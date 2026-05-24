const express = require('express');
const router = express.Router();

// Temporary in-memory data (until MongoDB model is ready)
const hospitals = [
  {
    _id: "1",
    name: "Apollo Hospital Mumbai",
    address: { city: "Mumbai", state: "Maharashtra" },
    specialties: ["Cardiology", "Neurology"],
    pricing: { consultation: 1200 },
    ratings: { average: 4.8, count: 1240 },
    image: "https://placehold.co/600x200/e2e8f0/1e293b?text=Apollo+Hospital"
  },
  {
    _id: "2",
    name: "Fortis Hospital Delhi",
    address: { city: "Delhi", state: "Delhi" },
    specialties: ["Cardiology", "Orthopedics"],
    pricing: { consultation: 1500 },
    ratings: { average: 4.6, count: 890 },
    image: "https://placehold.co/600x200/e2e8f0/1e293b?text=Fortis+Hospital"
  },
  {
    _id: "3",
    name: "Manipal Hospital Bangalore",
    address: { city: "Bangalore", state: "Karnataka" },
    specialties: ["Neurology", "Oncology"],
    pricing: { consultation: 1000 },
    ratings: { average: 4.9, count: 2100 },
    image: "https://placehold.co/600x200/e2e8f0/1e293b?text=Manipal+Hospital"
  }
];

// Search hospitals
router.get('/search', (req, res) => {
  try {
    const { city, disease } = req.query;
    let filtered = [...hospitals];
    
    if (city) {
      filtered = filtered.filter(h => 
        h.address.city.toLowerCase().includes(city.toLowerCase())
      );
    }
    if (disease) {
      filtered = filtered.filter(h =>
        h.specialties.some(s => s.toLowerCase().includes(disease.toLowerCase()))
      );
    }
    
    res.json({ success: true, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single hospital
router.get('/:id', (req, res) => {
  try {
    const hospital = hospitals.find(h => h._id === req.params.id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }
    res.json({ success: true, data: hospital });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// Emergency search endpoint
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
        distance: calculateDistance(lat, lng, h.location?.lat, h.location?.lng)
      }));
    }
    
    res.json({ success: true, data: hospitals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper function for distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(1);
}

module.exports = router;

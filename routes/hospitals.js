const express = require('express');
const router = express.Router();

// Dummy hospital data with subscription plans
const hospitals = [
  {
    _id: "1",
    name: "Apollo Hospital Mumbai",
    subscription_plan: "platinum",
    address: { city: "Mumbai", state: "Maharashtra" },
    diseases_treated: ["heart attack", "cardiac arrest", "chest pain", "fever"],
    has24x7ER: true,
    beds: { total: 350, available: 45, icu_available: 4 },
    ratings: { average: 4.8, count: 1240 },
    location: { lat: 19.1079, lng: 72.8344 },
    pricing: { consultation: 1200, icu_bed_per_day: 8000, general_bed_per_day: 3000 },
    doctors: [
      { _id: "d1", name: "Dr. Priya Sharma", specialization: "Cardiologist", consultation_fee: 1200 },
      { _id: "d2", name: "Dr. Rajesh Mehta", specialization: "Neurologist", consultation_fee: 1300 }
    ],
    insurance_accepted: ["Star Health", "ICICI Lombard", "HDFC ERGO"],
    ambulance_available: true,
    offers_discount: true
  },
  {
    _id: "2",
    name: "Fortis Hospital Delhi",
    subscription_plan: "gold",
    address: { city: "Delhi", state: "Delhi" },
    diseases_treated: ["heart attack", "chest pain", "accident"],
    has24x7ER: true,
    beds: { total: 280, available: 32, icu_available: 2 },
    ratings: { average: 4.6, count: 890 },
    location: { lat: 28.5623, lng: 77.2093 },
    pricing: { consultation: 1500, icu_bed_per_day: 9000, general_bed_per_day: 3500 },
    doctors: [
      { _id: "d3", name: "Dr. Anil Kumar", specialization: "Cardiologist", consultation_fee: 1500 }
    ],
    insurance_accepted: ["Star Health", "HDFC ERGO"],
    ambulance_available: true,
    offers_discount: true
  },
  {
    _id: "3",
    name: "Manipal Hospital Bangalore",
    subscription_plan: "silver",
    address: { city: "Bangalore", state: "Karnataka" },
    diseases_treated: ["stroke", "fever", "neurology"],
    has24x7ER: true,
    beds: { total: 420, available: 56, icu_available: 5 },
    ratings: { average: 4.9, count: 2100 },
    location: { lat: 12.9592, lng: 77.6451 },
    pricing: { consultation: 1000, icu_bed_per_day: 7500, general_bed_per_day: 2500 },
    doctors: [
      { _id: "d4", name: "Dr. Sunita Reddy", specialization: "Neurologist", consultation_fee: 1000 }
    ],
    insurance_accepted: ["Star Health", "ICICI Lombard", "HDFC ERGO"],
    ambulance_available: true,
    offers_discount: true
  }
];

// Get rank score based on subscription
function getRankScore(hospital) {
  const scores = { platinum: 100, gold: 80, silver: 60, featured: 50, free: 30 };
  return scores[hospital.subscription_plan] || 30;
}

// Search with pagination
router.get('/search', (req, res) => {
  try {
    const { city, disease, insurance, sort_by, bed_required, page = 1, limit = 5 } = req.query;
    
    let filtered = [...hospitals];
    
    if (city) {
      filtered = filtered.filter(h => h.address.city.toLowerCase().includes(city.toLowerCase()));
    }
    if (disease) {
      filtered = filtered.filter(h => 
        h.diseases_treated.some(d => d.toLowerCase().includes(disease.toLowerCase()))
      );
    }
    if (insurance) {
      filtered = filtered.filter(h => 
        h.insurance_accepted.some(i => i.toLowerCase().includes(insurance.toLowerCase()))
      );
    }
    if (bed_required === 'true') {
      filtered = filtered.filter(h => h.beds.available > 0);
    }
    
    // Add rank score
    filtered = filtered.map(h => ({ ...h, rankScore: getRankScore(h) }));
    
    // Sort
    if (sort_by === 'priority') {
      filtered.sort((a, b) => b.rankScore - a.rankScore);
    } else if (sort_by === 'price') {
      filtered.sort((a, b) => a.pricing.consultation - b.pricing.consultation);
    } else if (sort_by === 'rating') {
      filtered.sort((a, b) => b.ratings.average - a.ratings.average);
    }
    
    const total = filtered.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const end = start + parseInt(limit);
    const paginatedData = filtered.slice(start, end);
    
    res.json({
      success: true,
      data: paginatedData,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalHospitals: total,
        perPage: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single hospital
router.get('/:id', (req, res) => {
  const hospital = hospitals.find(h => h._id === req.params.id);
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }
  res.json({ success: true, data: hospital });
});

module.exports = router;

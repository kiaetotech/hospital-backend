const express = require('express');
const router = express.Router();

// Dummy hospital data
const hospitals = [
  {
    _id: "1",
    name: "Apollo Hospital Mumbai",
    address: { city: "Mumbai", state: "Maharashtra" },
    diseases_treated: ["heart attack", "cardiac arrest", "chest pain", "fever", "stroke", "accident"],
    has24x7ER: true,
    beds: { icu_available: 4 },
    ratings: { average: 4.8, count: 1240 },
    location: { lat: 19.1079, lng: 72.8344 },
    pricing: { consultation: 1200 },
    specialties: ["Cardiology", "Neurology"],
    insurance_accepted: ["Star Health", "ICICI"],
    ambulance_available: true
  },
  {
    _id: "2",
    name: "Fortis Hospital Delhi",
    address: { city: "Delhi", state: "Delhi" },
    diseases_treated: ["heart attack", "cardiac arrest", "chest pain", "accident", "stroke"],
    has24x7ER: true,
    beds: { icu_available: 2 },
    ratings: { average: 4.6, count: 890 },
    location: { lat: 28.5623, lng: 77.2093 },
    pricing: { consultation: 1500 },
    specialties: ["Cardiology", "Orthopedics"],
    insurance_accepted: ["Star Health", "HDFC"],
    ambulance_available: true
  },
  {
    _id: "3",
    name: "Manipal Hospital Bangalore",
    address: { city: "Bangalore", state: "Karnataka" },
    diseases_treated: ["heart attack", "stroke", "fever", "neurology"],
    has24x7ER: true,
    beds: { icu_available: 5 },
    ratings: { average: 4.9, count: 2100 },
    location: { lat: 12.9592, lng: 77.6451 },
    pricing: { consultation: 1000 },
    specialties: ["Neurology", "Cardiology"],
    insurance_accepted: ["Star Health", "ICICI", "HDFC"],
    ambulance_available: true
  }
];

// Emergency search
router.get('/emergency-search', (req, res) => {
  const { disease } = req.query;
  let filtered = hospitals;
  if (disease) {
    filtered = hospitals.filter(h => 
      h.diseases_treated.some(d => d.toLowerCase().includes(disease.toLowerCase()))
    );
  }
  res.json({ success: true, data: filtered });
});

// Regular search
router.get('/search', (req, res) => {
  const { city, disease } = req.query;
  let filtered = hospitals;
  if (city) {
    filtered = filtered.filter(h => h.address.city.toLowerCase().includes(city.toLowerCase()));
  }
  if (disease) {
    filtered = filtered.filter(h => 
      h.diseases_treated.some(d => d.toLowerCase().includes(disease.toLowerCase()))
    );
  }
  res.json({ success: true, data: filtered });
});

// Get single hospital by ID
router.get('/:id', (req, res) => {
  const hospital = hospitals.find(h => h._id === req.params.id);
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }
  res.json({ success: true, data: hospital });
});

module.exports = router;

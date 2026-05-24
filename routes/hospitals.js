const express = require('express');
const router = express.Router();

// Dummy data - make sure field names match what frontend expects
const hospitals = [
  {
    _id: "1",
    name: "Apollo Hospital Mumbai",
    address: { city: "Mumbai", state: "Maharashtra" },
    diseases_treated: ["heart attack", "cardiac arrest", "chest pain", "fever", "stroke", "accident"],
    has24x7ER: true,
    beds: { 
      total: 350,
      available: 45,
      icu: 12,
      icu_available: 4,
      ventilator: 8,
      general: 200
    },
    ratings: { average: 4.8, count: 1240 },
    location: { lat: 19.1079, lng: 72.8344 },
    pricing: { consultation: 1200 },
    specialties: ["Cardiology", "Neurology", "Orthopedics"],
    insurance_accepted: ["Star Health", "ICICI Lombard"],
    ambulance_available: true,
    ambulance_eta_minutes: 10
  },
  {
    _id: "2",
    name: "Fortis Hospital Delhi",
    address: { city: "Delhi", state: "Delhi" },
    diseases_treated: ["heart attack", "cardiac arrest", "chest pain", "accident", "head injury", "stroke"],
    has24x7ER: true,
    beds: { 
      total: 280,
      available: 32,
      icu: 8,
      icu_available: 2,
      ventilator: 6,
      general: 180
    },
    ratings: { average: 4.6, count: 890 },
    location: { lat: 28.5623, lng: 77.2093 },
    pricing: { consultation: 1500 },
    specialties: ["Cardiology", "Orthopedics", "Neurology"],
    insurance_accepted: ["Star Health", "HDFC ERGO"],
    ambulance_available: true,
    ambulance_eta_minutes: 15
  },
  {
    _id: "3",
    name: "Manipal Hospital Bangalore",
    address: { city: "Bangalore", state: "Karnataka" },
    diseases_treated: ["heart attack", "stroke", "fever", "neurology", "brain tumor", "seizure"],
    has24x7ER: true,
    beds: { 
      total: 420,
      available: 56,
      icu: 15,
      icu_available: 5,
      ventilator: 10,
      general: 250
    },
    ratings: { average: 4.9, count: 2100 },
    location: { lat: 12.9592, lng: 77.6451 },
    pricing: { consultation: 1000 },
    specialties: ["Neurology", "Oncology", "Cardiology"],
    insurance_accepted: ["Star Health", "ICICI Lombard", "HDFC ERGO"],
    ambulance_available: true,
    ambulance_eta_minutes: 12
  }
];

// Emergency search endpoint
router.get('/emergency-search', (req, res) => {
  try {
    const { disease } = req.query;
    console.log('Searching for disease:', disease);
    
    let filtered = hospitals;
    
    if (disease && disease.trim() !== '') {
      const searchTerm = disease.toLowerCase();
      filtered = hospitals.filter(hospital => {
        return hospital.diseases_treated && hospital.diseases_treated.some(d => 
          d.toLowerCase().includes(searchTerm)
        );
      });
      console.log('Found:', filtered.length, 'hospitals');
    }
    
    res.json({ success: true, data: filtered });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single hospital by ID
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

module.exports = router;
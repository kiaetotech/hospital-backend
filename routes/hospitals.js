const express = require('express');
const router = express.Router();

// Helper function for distance calculation
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

// Dummy hospital data
const hospitals = [
  {
    _id: "1",
    name: "Apollo Hospital Mumbai",
    subscription_plan: "platinum",
    address: { city: "Mumbai", state: "Maharashtra", street: "Plot No. 13, Off Western Express Highway" },
    location: { lat: 19.1079, lng: 72.8344 },
    diseases_treated: ["heart attack", "cardiac arrest", "chest pain", "fever", "stroke", "accident"],
    specialties: ["Cardiology", "Neurology", "Orthopedics"],
    surgeries: ["Bypass Surgery", "Angioplasty", "Knee Replacement"],
    symptoms_treated: ["chest pain", "breathing difficulty", "unconsciousness"],
    has24x7ER: true,
    beds: { total: 350, available: 45, icu_available: 4 },
    pricing: { consultation: 1200, icu_bed_per_day: 8000, general_bed_per_day: 3000 },
    doctors: [
      { name: "Dr. Priya Sharma", specialization: "Cardiologist", consultation_fee: 1200 },
      { name: "Dr. Rajesh Mehta", specialization: "Neurologist", consultation_fee: 1300 },
      { name: "Dr. Sunil Patil", specialization: "Orthopedic", consultation_fee: 1100 }
    ],
    insurance_accepted: ["Star Health", "ICICI Lombard", "HDFC ERGO"],
    lab_tests_available: true,
    ambulance_available: true,
    contact: { phone: "02212345678", email: "contact@apollo.com" },
    ratings: { average: 4.8, count: 1240 }
  },
  {
    _id: "2",
    name: "Fortis Hospital Delhi",
    subscription_plan: "gold",
    address: { city: "Delhi", state: "Delhi", street: "Sector B, Pocket 1" },
    location: { lat: 28.5623, lng: 77.2093 },
    diseases_treated: ["heart attack", "chest pain", "accident", "head injury"],
    specialties: ["Cardiology", "Orthopedics", "Neurology"],
    surgeries: ["Angioplasty", "Spine Surgery"],
    symptoms_treated: ["chest pain", "headache", "fracture"],
    has24x7ER: true,
    beds: { total: 280, available: 32, icu_available: 2 },
    pricing: { consultation: 1500, icu_bed_per_day: 9000, general_bed_per_day: 3500 },
    doctors: [
      { name: "Dr. Anil Kumar", specialization: "Cardiologist", consultation_fee: 1500 },
      { name: "Dr. Neha Gupta", specialization: "Orthopedic", consultation_fee: 1400 }
    ],
    insurance_accepted: ["Star Health", "HDFC ERGO"],
    lab_tests_available: false,
    ambulance_available: true,
    contact: { phone: "01112345678", email: "contact@fortis.com" },
    ratings: { average: 4.6, count: 890 }
  },
  {
    _id: "3",
    name: "Manipal Hospital Bangalore",
    subscription_plan: "silver",
    address: { city: "Bangalore", state: "Karnataka", street: "98, HAL Old Airport Rd" },
    location: { lat: 12.9592, lng: 77.6451 },
    diseases_treated: ["stroke", "fever", "neurology", "brain tumor", "kidney stone"],
    specialties: ["Neurology", "Oncology", "Nephrology"],
    surgeries: ["Brain Surgery", "Kidney Stone Removal"],
    symptoms_treated: ["severe headache", "fever", "back pain"],
    has24x7ER: true,
    beds: { total: 420, available: 56, icu_available: 5 },
    pricing: { consultation: 1000, icu_bed_per_day: 7500, general_bed_per_day: 2500 },
    doctors: [
      { name: "Dr. Sunita Reddy", specialization: "Neurologist", consultation_fee: 1000 },
      { name: "Dr. Vikram Singh", specialization: "Oncologist", consultation_fee: 1200 },
      { name: "Dr. Arjun Rao", specialization: "Nephrologist", consultation_fee: 1100 }
    ],
    insurance_accepted: ["Star Health", "ICICI Lombard", "HDFC ERGO"],
    lab_tests_available: true,
    ambulance_available: true,
    contact: { phone: "08012345678", email: "contact@manipal.com" },
    ratings: { average: 4.9, count: 2100 }
  }
];

// Search endpoint - searches across diseases, specialties, surgeries, symptoms
router.get('/search', (req, res) => {
  try {
    const { q, city, page = 1, limit = 10, lat, lng } = req.query;
    
    let filtered = [...hospitals];
    
    // Main search - searches multiple medical fields
    if (q && q.trim() !== '') {
      const searchTerm = q.toLowerCase();
      filtered = filtered.filter(hospital => {
        return (
          hospital.diseases_treated?.some(d => d.toLowerCase().includes(searchTerm)) ||
          hospital.specialties?.some(s => s.toLowerCase().includes(searchTerm)) ||
          hospital.surgeries?.some(sug => sug.toLowerCase().includes(searchTerm)) ||
          hospital.symptoms_treated?.some(sym => sym.toLowerCase().includes(searchTerm)) ||
          hospital.name.toLowerCase().includes(searchTerm)
        );
      });
    }
    
    // City filter
    if (city && city.trim() !== '') {
      filtered = filtered.filter(h => h.address.city.toLowerCase().includes(city.toLowerCase()));
    }
    
    // Add distance if location provided
    if (lat && lng) {
      filtered = filtered.map(h => ({
        ...h,
        distance: calculateDistance(parseFloat(lat), parseFloat(lng), h.location.lat, h.location.lng)
      }));
    }
    
    // Pagination
    const total = filtered.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginatedData = filtered.slice(start, start + parseInt(limit));
    
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

// Get single hospital by ID
router.get('/:id', (req, res) => {
  const hospital = hospitals.find(h => h._id === req.params.id);
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }
  res.json({ success: true, data: hospital });
});

module.exports = router;

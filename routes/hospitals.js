const express = require('express');
const router = express.Router();

// ========== HOSPITAL DATA (Hardcoded for now) ==========
const hospitals = [
  {
    _id: "1",
    name: "Apollo Hospital Mumbai",
    subscription_plan: "platinum",
    address: { city: "Mumbai", state: "Maharashtra" },
    location: { lat: 19.1079, lng: 72.8344 },
    diseases_treated: ["heart attack", "chest pain", "fever", "stroke"],
    specialties: ["Cardiology", "Neurology", "Orthopedics"],
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
    ratings: { average: 4.8, count: 1240 },
    contact: { phone: "02212345678", email: "contact@apollo.com" }
  },
  {
    _id: "2",
    name: "Fortis Hospital Delhi",
    subscription_plan: "gold",
    address: { city: "Delhi", state: "Delhi" },
    location: { lat: 28.5623, lng: 77.2093 },
    diseases_treated: ["heart attack", "chest pain", "accident", "head injury"],
    specialties: ["Cardiology", "Orthopedics", "Neurology"],
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
    ratings: { average: 4.6, count: 890 },
    contact: { phone: "01112345678", email: "contact@fortis.com" }
  },
  {
    _id: "3",
    name: "Manipal Hospital Bangalore",
    subscription_plan: "silver",
    address: { city: "Bangalore", state: "Karnataka" },
    location: { lat: 12.9592, lng: 77.6451 },
    diseases_treated: ["stroke", "fever", "neurology", "brain tumor"],
    specialties: ["Neurology", "Oncology", "Cardiology"],
    has24x7ER: true,
    beds: { total: 420, available: 56, icu_available: 5 },
    pricing: { consultation: 1000, icu_bed_per_day: 7500, general_bed_per_day: 2500 },
    doctors: [
      { name: "Dr. Sunita Reddy", specialization: "Neurologist", consultation_fee: 1000 },
      { name: "Dr. Vikram Singh", specialization: "Oncologist", consultation_fee: 1200 }
    ],
    insurance_accepted: ["Star Health", "ICICI Lombard", "HDFC ERGO"],
    lab_tests_available: true,
    ambulance_available: true,
    ratings: { average: 4.9, count: 2100 },
    contact: { phone: "08012345678", email: "contact@manipal.com" }
  },
  {
    _id: "4",
    name: "Medicover Hospital Hyderabad",
    subscription_plan: "gold",
    address: { city: "Hyderabad", state: "Telangana" },
    location: { lat: 17.4481, lng: 78.3914 },
    diseases_treated: ["heart attack", "chest pain", "diabetes", "kidney stone"],
    specialties: ["Cardiology", "Nephrology", "Urology"],
    has24x7ER: true,
    beds: { total: 320, available: 28, icu_available: 6 },
    pricing: { consultation: 1100, icu_bed_per_day: 7500, general_bed_per_day: 2800 },
    doctors: [
      { name: "Dr. Ajay Kumar", specialization: "Cardiologist", consultation_fee: 1100 },
      { name: "Dr. Meera Reddy", specialization: "Nephrologist", consultation_fee: 1000 }
    ],
    insurance_accepted: ["Star Health", "ICICI Lombard", "Bajaj Allianz"],
    lab_tests_available: true,
    ambulance_available: true,
    ratings: { average: 4.7, count: 1560 },
    contact: { phone: "04012345678", email: "contact@medicover.com" }
  },
  {
    _id: "5",
    name: "Narayana Health Kolkata",
    subscription_plan: "silver",
    address: { city: "Kolkata", state: "West Bengal" },
    location: { lat: 22.5726, lng: 88.3639 },
    diseases_treated: ["heart attack", "stroke", "cancer", "fever"],
    specialties: ["Cardiology", "Oncology", "Neurology"],
    has24x7ER: true,
    beds: { total: 450, available: 42, icu_available: 8 },
    pricing: { consultation: 900, icu_bed_per_day: 6800, general_bed_per_day: 2200 },
    doctors: [
      { name: "Dr. S. Chatterjee", specialization: "Cardiologist", consultation_fee: 900 },
      { name: "Dr. R. Banerjee", specialization: "Oncologist", consultation_fee: 950 }
    ],
    insurance_accepted: ["Star Health", "HDFC ERGO", "New India Assurance"],
    lab_tests_available: false,
    ambulance_available: true,
    ratings: { average: 4.5, count: 980 },
    contact: { phone: "03312345678", email: "contact@narayana.com" }
  }
];

// ========== ROUTES ==========

// GET /api/hospitals/search - Search hospitals
router.get('/search', (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    
    let filtered = [...hospitals];
    
    // Apply search filter
    if (q && q.trim() !== '') {
      const searchTerm = q.toLowerCase();
      filtered = filtered.filter(hospital => {
        return (
          hospital.name.toLowerCase().includes(searchTerm) ||
          hospital.diseases_treated.some(d => d.toLowerCase().includes(searchTerm)) ||
          hospital.specialties.some(s => s.toLowerCase().includes(searchTerm))
        );
      });
    }
    
    // Pagination
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginatedData = filtered.slice(start, start + parseInt(limit));
    
    res.json({
      success: true,
      data: paginatedData,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filtered.length / limit),
        totalHospitals: filtered.length,
        perPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/hospitals/:id - Get single hospital
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

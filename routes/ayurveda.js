const express = require('express');
const router = express.Router();

// ============================================
// DUMMY DATABASE (Replace with MongoDB models)
// ============================================
const doctors = [
  {
    _id: 'AYD001',
    name: 'Dr. Rajesh Sharma',
    specialization: 'Panchakarma',
    experience: 15,
    languages: ['Hindi', 'English'],
    rating: 4.8,
    consultationFee: 500,
    availableSlots: ['10:00 AM', '2:00 PM', '5:00 PM'],
    city: 'Mumbai',
    ayushRegNo: 'AYUSH-MH-2018-00123',
    education: 'BAMS, MD (Panchakarma)',
    about: '15+ years experience in authentic Kerala Panchakarma therapies. Specialized in chronic disease management through detoxification.',
    available: true,
    image: null
  },
  {
    _id: 'AYD002',
    name: 'Dr. Priya Gupta',
    specialization: 'General Ayurveda',
    experience: 12,
    languages: ['Hindi', 'English', 'Marathi'],
    rating: 4.9,
    consultationFee: 400,
    availableSlots: ['11:00 AM', '3:00 PM', '6:00 PM'],
    city: 'Pune',
    ayushRegNo: 'AYUSH-MH-2019-00456',
    education: 'BAMS, MD (Kayachikitsa)',
    about: 'Holistic Ayurvedic physician focusing on lifestyle disorders, women health, and preventive care.',
    available: true,
    image: null
  },
  {
    _id: 'AYD003',
    name: 'Dr. Amit Verma',
    specialization: 'Kerala Ayurveda',
    experience: 20,
    languages: ['English', 'Malayalam', 'Hindi'],
    rating: 4.7,
    consultationFee: 600,
    availableSlots: ['9:00 AM', '12:00 PM'],
    city: 'Kochi',
    ayushRegNo: 'AYUSH-KL-2015-00789',
    education: 'BAMS, MD (Ayurveda), PhD',
    about: 'Renowned Kerala Ayurveda practitioner with expertise in authentic Panchakarma and Rasayana therapies.',
    available: false,
    image: null
  },
  {
    _id: 'AYD004',
    name: 'Dr. Sunita Reddy',
    specialization: 'Ayurvedic Dermatology',
    experience: 10,
    languages: ['Telugu', 'English'],
    rating: 4.6,
    consultationFee: 350,
    availableSlots: ['3:00 PM', '5:00 PM'],
    city: 'Hyderabad',
    ayushRegNo: 'AYUSH-TG-2020-00321',
    education: 'BAMS, Diploma in Dermatology',
    about: 'Specialized in treating skin disorders through Ayurvedic herbs and therapies.',
    available: true,
    image: null
  },
  {
    _id: 'AYD005',
    name: 'Dr. Karan Patel',
    specialization: 'Panchakarma',
    experience: 8,
    languages: ['Gujarati', 'Hindi', 'English'],
    rating: 4.5,
    consultationFee: 450,
    availableSlots: ['12:00 PM', '4:00 PM'],
    city: 'Ahmedabad',
    ayushRegNo: 'AYUSH-GJ-2021-00654',
    education: 'BAMS, MD (Panchakarma)',
    about: 'Young and dynamic Panchakarma specialist focusing on modern lifestyle diseases.',
    available: true,
    image: null
  }
];

const centers = [
  {
    _id: 'AYC001',
    name: 'AyurVeda Retreat',
    location: 'Rishikesh, Uttarakhand',
    rating: 4.9,
    packages: [
      { name: '7-Day Panchakarma', price: 25000, duration: '7 days' },
      { name: '14-Day Rejuvenation', price: 45000, duration: '14 days' },
      { name: '21-Day Complete Detox', price: 65000, duration: '21 days' }
    ],
    facilities: ['AC Rooms', 'Organic Food', 'Yoga Hall', 'Herbal Garden'],
    image: null
  },
  {
    _id: 'AYC002',
    name: 'Kerala Ayurveda Kendra',
    location: 'Kochi, Kerala',
    rating: 4.8,
    packages: [
      { name: '5-Day Detox', price: 18000, duration: '5 days' },
      { name: '10-Day Panchakarma', price: 35000, duration: '10 days' }
    ],
    facilities: ['Traditional Therapies', 'Beach Proximity', 'Organic Meals'],
    image: null
  }
];

// ============================================
// DOCTOR ROUTES
// ============================================

// GET /api/ayurveda/doctors - List all doctors with filters
router.get('/doctors', (req, res) => {
  try {
    let filtered = [...doctors];
    
    const { specialization, minExperience, available, language } = req.query;
    
    if (specialization) {
      filtered = filtered.filter(d => d.specialization === specialization);
    }
    if (minExperience) {
      filtered = filtered.filter(d => d.experience >= parseInt(minExperience));
    }
    if (available === 'true') {
      filtered = filtered.filter(d => d.available === true);
    }
    if (language) {
      filtered = filtered.filter(d => d.languages.includes(language));
    }
    
    res.json({ success: true, data: filtered, count: filtered.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ayurveda/doctors/featured - Featured doctors
router.get('/doctors/featured', (req, res) => {
  try {
    const featured = doctors.filter(d => d.rating >= 4.7).slice(0, 5);
    res.json({ success: true, data: featured });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ayurveda/doctors/:id - Doctor details
router.get('/doctors/:id', (req, res) => {
  try {
    const doctor = doctors.find(d => d._id === req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, error: 'Doctor not found' });
    }
    res.json({ success: true, data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CENTER ROUTES
// ============================================

// GET /api/ayurveda/centers
router.get('/centers', (req, res) => {
  try {
    res.json({ success: true, data: centers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ayurveda/centers/:id
router.get('/centers/:id', (req, res) => {
  try {
    const center = centers.find(c => c._id === req.params.id);
    if (!center) {
      return res.status(404).json({ success: false, error: 'Center not found' });
    }
    res.json({ success: true, data: center });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// BOOKING ROUTES
// ============================================

// POST /api/ayurveda/bookings
router.post('/bookings', (req, res) => {
  try {
    const { doctorId, date, time, patientName, phone, symptoms } = req.body;
    
    // Validate
    if (!doctorId || !date || !time || !patientName || !phone) {
      return res.status(400).json({ success: false, error: 'All fields required' });
    }
    
    const doctor = doctors.find(d => d._id === doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, error: 'Doctor not found' });
    }
    
    // Simulate booking creation
    const booking = {
      _id: 'BKG' + Date.now(),
      doctorId,
      doctorName: doctor.name,
      date,
      time,
      patientName,
      phone,
      symptoms,
      fee: doctor.consultationFee,
      platformCommission: doctor.consultationFee * 0.15,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };
    
    res.status(201).json({ 
      success: true, 
      message: 'Booking confirmed', 
      data: booking 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PRAKRITI ROUTES
// ============================================

// POST /api/ayurveda/prakriti
router.post('/prakriti', (req, res) => {
  try {
    const { answers } = req.body;
    
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, error: 'Answers required' });
    }
    
    // Simple calculation (same as frontend)
    let vata = answers.filter(a => a === 0).length;
    let pitta = answers.filter(a => a === 1).length;
    let kapha = answers.filter(a => a === 2).length;
    
    const total = vata + pitta + kapha;
    
    res.json({
      success: true,
      data: {
        vata: Math.round((vata/total)*100),
        pitta: Math.round((pitta/total)*100),
        kapha: Math.round((kapha/total)*100),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
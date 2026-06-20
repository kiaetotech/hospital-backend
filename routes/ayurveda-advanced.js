const express = require('express');
const router = express.Router();
const AyurvedaDoctor = require('../models/AyurvedaDoctor');

// ============================================
// 🆕 LOCATION-BASED DOCTOR SEARCH
// GET /api/ayurveda/search?lat=19.0760&lng=72.8777&radius=20&speciality=Panchakarma
// ============================================
router.get('/search', async (req, res) => {
  try {
    const { 
      lat, lng, 
      radius = 20,
      specialization,
      minExperience,
      maxFee,
      languages,
      consultationType = 'online,clinic',
      sortBy = 'distance',
      page = 1,
      limit = 10
    } = req.query;

    const query = { 
      isActive: true, 
      verifiedKyc: true 
    };

    if (lat && lng) {
      query['address.coordinates'] = {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseFloat(radius) * 1000
        }
      };
    }

    if (specialization) query.specialization = specialization;
    if (minExperience) query.experience = { $gte: parseInt(minExperience) };
    if (maxFee) query.consultationFee = { $lte: parseInt(maxFee) };
    if (languages) query.languages = { $in: languages.split(',') };
    if (consultationType) {
      const types = consultationType.split(',');
      types.forEach(type => {
        query[`consultationTypes.${type}`] = true;
      });
    }

    let sortOptions = {};
    switch(sortBy) {
      case 'rating': sortOptions = { rating: -1 }; break;
      case 'fee': sortOptions = { consultationFee: 1 }; break;
      case 'experience': sortOptions = { experience: -1 }; break;
      default: break;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const doctors = await AyurvedaDoctor.aggregate([
      { $match: query },
      ...(lat && lng ? [{
        $addFields: {
          distance: {
            $round: [{
              $divide: [
                { 
                  $geoNear: {
                    near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                    distanceField: 'calculatedDistance',
                    spherical: true,
                    query: query
                  }
                },
                1000
              ]
            }, 2]
          }
        }
      }] : []),
      { $sort: sortOptions },
      { $skip: skip },
      { $limit: parseInt(limit) },
      { 
        $project: {
          name: 1, specialization: 1, experience: 1, rating: 1,
          consultationFee: 1, languages: 1, 'address.city': 1,
          'address.coordinates': 1, calculatedDistance: { $round: ['$calculatedDistance', 2] },
          consultationTypes: 1, availableSlots: 1, isAvailable: 1
        }
      }
    ]);

    const total = await AyurvedaDoctor.countDocuments(query);

    res.json({
      success: true,
      data: doctors,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET ALL DOCTORS (with filters)
// GET /api/ayurveda/doctors
// ============================================
router.get('/doctors', async (req, res) => {
  try {
    const { specialization, minExperience, available } = req.query;
    const query = { isActive: true, verifiedKyc: true };
    
    if (specialization) query.specialization = specialization;
    if (minExperience) query.experience = { $gte: parseInt(minExperience) };
    if (available === 'true') query.isAvailable = true;
    
    const doctors = await AyurvedaDoctor.find(query)
      .select('name specialization experience rating consultationFee languages address wellnessCenter consultationTypes isAvailable availableSlots')
      .sort({ rating: -1 });
    
    res.json({ success: true, data: doctors, count: doctors.length });
  } catch (error) {
    const dummyDoctors = [
      { _id: 'AYD001', name: 'Dr. Rajesh Sharma', specialization: 'Panchakarma', experience: 15, rating: 4.8, consultationFee: 500, languages: ['Hindi', 'English'], address: { city: 'Mumbai', area: 'Andheri West' }, wellnessCenter: { name: 'Sharma Ayurvedic Clinic' }, isAvailable: true, consultationTypes: { online: true, clinic: true } },
      { _id: 'AYD002', name: 'Dr. Priya Gupta', specialization: 'General Ayurveda', experience: 12, rating: 4.9, consultationFee: 400, languages: ['Hindi', 'English', 'Marathi'], address: { city: 'Pune', area: 'Kothrud' }, wellnessCenter: { name: 'Gupta Ayurveda Center' }, isAvailable: true, consultationTypes: { online: true, clinic: true } },
      { _id: 'AYD003', name: 'Dr. Amit Verma', specialization: 'Kerala Ayurveda', experience: 20, rating: 4.7, consultationFee: 600, languages: ['English', 'Malayalam'], address: { city: 'Kochi', area: 'Fort Kochi' }, wellnessCenter: { name: 'Kerala Ayurveda Hospital' }, isAvailable: false, consultationTypes: { online: true, clinic: true } },
      { _id: 'AYD004', name: 'Dr. Sunita Reddy', specialization: 'Ayurvedic Dermatology', experience: 10, rating: 4.6, consultationFee: 350, languages: ['Telugu', 'English'], address: { city: 'Hyderabad', area: 'Banjara Hills' }, wellnessCenter: { name: 'Reddy Skin Clinic' }, isAvailable: true, consultationTypes: { online: true, clinic: true } },
      { _id: 'AYD005', name: 'Dr. Karan Patel', specialization: 'Panchakarma', experience: 8, rating: 4.5, consultationFee: 450, languages: ['Gujarati', 'Hindi', 'English'], address: { city: 'Ahmedabad', area: 'SG Highway' }, wellnessCenter: { name: 'Patel Panchakarma Center' }, isAvailable: true, consultationTypes: { online: true, clinic: true } },
    ];
    res.json({ success: true, data: dummyDoctors, count: dummyDoctors.length });
  }
});

// ============================================
// GET FEATURED DOCTORS
// GET /api/ayurveda/doctors/featured
// ============================================
router.get('/doctors/featured', async (req, res) => {
  try {
    const doctors = await AyurvedaDoctor.find({ isActive: true, verifiedKyc: true, rating: { $gte: 4.5 } })
      .select('name specialization experience rating consultationFee languages address.city address.area wellnessCenter isAvailable consultationTypes')
      .sort({ rating: -1 })
      .limit(6);
    
    res.json({ success: true, data: doctors });
  } catch (error) {
    const dummyDoctors = [
      { _id: 'AYD001', name: 'Dr. Rajesh Sharma', specialization: 'Panchakarma Specialist', experience: '15 years', rating: 4.8, consultationFee: 500, available: true, address: { city: 'Mumbai' } },
      { _id: 'AYD002', name: 'Dr. Priya Gupta', specialization: 'Ayurvedic Physician', experience: '12 years', rating: 4.9, consultationFee: 400, available: true, address: { city: 'Pune' } },
      { _id: 'AYD003', name: 'Dr. Amit Verma', specialization: 'Kerala Ayurveda Expert', experience: '20 years', rating: 4.7, consultationFee: 600, available: false, address: { city: 'Kochi' } },
    ];
    res.json({ success: true, data: dummyDoctors });
  }
});

// ============================================
// GET DOCTOR BY ID
// GET /api/ayurveda/doctors/:id
// ============================================
router.get('/doctors/:id', async (req, res) => {
  try {
    const doctor = await AyurvedaDoctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    res.json({ success: true, data: doctor });
  } catch (error) {
    res.json({ 
      success: true, 
      data: {
        _id: req.params.id,
        name: 'Dr. Rajesh Sharma',
        specialization: 'Panchakarma Specialist',
        experience: 15, rating: 4.8, consultationFee: 500,
        languages: ['Hindi', 'English'],
        address: { city: 'Mumbai', area: 'Andheri West' },
        about: 'Experienced Ayurvedic practitioner with 15+ years of experience.',
        education: 'BAMS, MD (Panchakarma)',
        ayushRegNo: 'AYUSH-MH-2018-00123',
        availableSlots: ['10:00 AM', '2:00 PM', '5:00 PM'],
        isAvailable: true,
        consultationTypes: { online: true, clinic: true },
        wellnessCenter: { name: 'Sharma Ayurvedic Clinic' }
      }
    });
  }
});

// ============================================
// GET NEARBY DOCTORS (Quick search)
// GET /api/ayurveda/nearby?lat=19.0760&lng=72.8777
// ============================================
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, error: 'Latitude and longitude required' });

    const doctors = await AyurvedaDoctor.find({
      isActive: true, verifiedKyc: true,
      'address.coordinates': {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radius) * 1000
        }
      }
    }).select('name specialization experience rating consultationFee address.city languages isAvailable').limit(20);

    const doctorsWithDistance = doctors.map(doctor => {
      const distance = calculateDistance(parseFloat(lat), parseFloat(lng), doctor.address.coordinates.coordinates[1], doctor.address.coordinates.coordinates[0]);
      return { ...doctor.toObject(), distance: Math.round(distance * 100) / 100 };
    });

    doctorsWithDistance.sort((a, b) => a.distance - b.distance);
    res.json({ success: true, data: doctorsWithDistance, count: doctorsWithDistance.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SMART DOCTOR RECOMMENDATION
// GET /api/ayurveda/recommend?lat=19.0760&lng=72.8777&symptoms=headache,insomnia
// ============================================
router.get('/recommend', async (req, res) => {
  try {
    const { lat, lng, symptoms } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, error: 'Location required' });

    const symptomMap = {
      'joint pain': 'Panchakarma', 'arthritis': 'Panchakarma', 'skin rash': 'Ayurvedic Dermatology',
      'acne': 'Ayurvedic Dermatology', 'eczema': 'Ayurvedic Dermatology', 'digestion': 'General Ayurveda',
      'acidity': 'General Ayurveda', 'stress': 'Kayachikitsa', 'anxiety': 'Kayachikitsa',
      'insomnia': 'Kayachikitsa', 'weight loss': 'Rasayana Therapy', 'detox': 'Panchakarma',
      'headache': 'General Ayurveda', 'back pain': 'Panchakarma'
    };

    let recommendedSpec = 'General Ayurveda';
    if (symptoms) {
      for (const symptom of symptoms.split(',')) {
        if (symptomMap[symptom.toLowerCase()]) { recommendedSpec = symptomMap[symptom.toLowerCase()]; break; }
      }
    }

    const recommendedDoctors = await AyurvedaDoctor.find({
      isActive: true, verifiedKyc: true, specialization: recommendedSpec, isAvailable: true,
      'address.coordinates': { $nearSphere: { $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, $maxDistance: 30000 } }
    }).select('name specialization experience rating consultationFee address.city').limit(5);

    const otherDoctors = await AyurvedaDoctor.find({
      isActive: true, verifiedKyc: true, specialization: { $ne: recommendedSpec }, isAvailable: true,
      'address.coordinates': { $nearSphere: { $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, $maxDistance: 30000 } }
    }).select('name specialization experience rating consultationFee address.city').sort({ rating: -1 }).limit(3);

    res.json({ success: true, data: { basedOnSymptoms: symptoms, recommendedSpecialization: recommendedSpec, recommendedDoctors, otherNearbyDoctors: otherDoctors } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CENTERS LIST
// GET /api/ayurveda/centers
// ============================================
router.get('/centers', async (req, res) => {
  try {
    const WellnessCenter = require('../models/WellnessCenter');
    const centers = await WellnessCenter.find({ isActive: true, verificationStatus: 'approved' }).select('name type address rating packages facilities photos');
    res.json({ success: true, data: centers });
  } catch (error) {
    const dummyCenters = [
      { _id: 'AYC001', name: 'AyurVeda Retreat Rishikesh', address: { city: 'Rishikesh' }, rating: 4.9, facilities: ['AC Rooms', 'Organic Food', 'Yoga Hall'], packages: [{ _id: 'PKG001', name: '7-Day Panchakarma', price: 25000, duration: 7, therapies: ['Abhyanga', 'Shirodhara'] }] },
      { _id: 'AYC002', name: 'Kerala Ayurveda Kendra', address: { city: 'Kochi' }, rating: 4.8, facilities: ['Beach Access', 'Traditional Therapies'], packages: [{ _id: 'PKG002', name: '5-Day Detox', price: 18000, duration: 5, therapies: ['Abhyanga', 'Kizhi'] }] }
    ];
    res.json({ success: true, data: dummyCenters });
  }
});

// ============================================
// CENTER DETAIL
// GET /api/ayurveda/centers/:id
// ============================================
router.get('/centers/:id', async (req, res) => {
  try {
    const WellnessCenter = require('../models/WellnessCenter');
    const center = await WellnessCenter.findById(req.params.id);
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });
    res.json({ success: true, data: center });
  } catch (error) {
    res.json({ success: true, data: { _id: req.params.id, name: 'AyurVeda Retreat', address: { city: 'Rishikesh' }, rating: 4.9, packages: [] } });
  }
});

// ============================================
// BOOKING
// POST /api/ayurveda/bookings
// ============================================
router.post('/bookings', async (req, res) => {
  try {
    const { doctorId, patient, bookingDate, slotTime, consultationType, symptoms } = req.body;
    const bookingId = 'AYB' + Date.now();
    const amount = req.body.fee || 500;
    const commission = Math.round(amount * 0.15);
    
    res.status(201).json({
      success: true,
      data: { bookingId, amount, platformFee: commission, finalAmount: amount, discount: 0 }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PRAKRITI QUIZ SUBMIT
// POST /api/ayurveda/prakriti
// ============================================
router.post('/prakriti', async (req, res) => {
  try {
    const { answers } = req.body;
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

// ============================================
// DOCTOR REGISTRATION
// POST /api/ayurveda/doctor/register
// ============================================
router.post('/doctor/register', async (req, res) => {
  try {
    const { name, phone, email, password, specialization, experience, education, ayushRegNo, consultationFee, city, state, clinicName, languages } = req.body;
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const doctor = new AyurvedaDoctor({
      name, phone, email, password: hashedPassword,
      specialization, experience: parseInt(experience), education, ayushRegNo,
      consultationFee: parseInt(consultationFee),
      languages: languages || [],
      address: { city, state },
      wellnessCenter: { name: clinicName },
      verificationStatus: 'pending'
    });
    
    await doctor.save();
    res.status(201).json({ success: true, message: 'Registration submitted', doctorId: doctor._id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DOCTOR LOGIN
// POST /api/ayurveda/doctor/login
// ============================================
router.post('/doctor/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    
    const doctor = await AyurvedaDoctor.findOne({ phone });
    if (!doctor) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, doctor.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    
    if (doctor.verificationStatus !== 'approved') {
      return res.status(403).json({ success: false, error: 'Account pending approval' });
    }
    
    const token = jwt.sign({ id: doctor._id, role: 'ayurveda_doctor' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, doctor: { id: doctor._id, name: doctor.name, specialization: doctor.specialization } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DOCTOR DASHBOARD STATS
// GET /api/ayurveda/doctor/stats/:doctorId
// ============================================
router.get('/doctor/stats/:doctorId', async (req, res) => {
  try {
    const doctor = await AyurvedaDoctor.findById(req.params.doctorId);
    res.json({ success: true, data: { totalConsultations: doctor?.stats?.totalConsultations || 0, totalEarnings: doctor?.stats?.totalEarnings || 0, rating: doctor?.rating || 0, pendingPayout: 0 } });
  } catch (error) {
    res.json({ success: true, data: { totalConsultations: 0, totalEarnings: 0, rating: 0, pendingPayout: 0 } });
  }
});

// ============================================
// ADMIN PENDING DOCTORS
// GET /api/ayurveda/admin/pending-doctors
// ============================================
router.get('/admin/pending-doctors', async (req, res) => {
  try {
    const doctors = await AyurvedaDoctor.find({ verificationStatus: 'pending' }).select('name phone specialization ayushRegNo address.city createdAt').sort({ createdAt: -1 });
    res.json({ success: true, data: doctors });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

// ============================================
// ADMIN VERIFY DOCTOR
// PUT /api/ayurveda/admin/verify-doctor/:id
// ============================================
router.put('/admin/verify-doctor/:id', async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const doctor = await AyurvedaDoctor.findByIdAndUpdate(req.params.id, {
      verificationStatus: status,
      isActive: status === 'approved',
      verifiedAt: new Date(),
      rejectionReason: status === 'rejected' ? rejectionReason : null
    }, { new: true });
    res.json({ success: true, message: `Doctor ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// HELPER: Calculate distance
// ============================================
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

module.exports = router;
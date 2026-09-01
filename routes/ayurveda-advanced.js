const express = require('express');
const router = express.Router();
const AyurvedaDoctor = require('../models/AyurvedaDoctor');
const CorporateEmployee = require('../models/CorporateEmployee');
const CorporateHR = require('../models/CorporateHR');
const WellnessCenter = require('../models/WellnessCenter');

// ============================================
// AUTHENTICATE HR MIDDLEWARE (ADDED)
// ============================================

const authenticateHR = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized. No token provided.' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hr = await CorporateHR.findById(decoded.id);
    if (!hr) {
      return res.status(401).json({ success: false, message: 'HR not found' });
    }
    if (!hr.isActive) {
      return res.status(403).json({ success: false, message: 'Account suspended' });
    }

    req.hr = hr;
    req.companyId = hr.companyId;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ============================================
// YOUR EXISTING ROUTES (PRESERVED)
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
    console.error('Error fetching doctors:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch doctors', data: [] });
  }
});

router.get('/doctors/featured', async (req, res) => {
  try {
    const doctors = await AyurvedaDoctor.find({ isActive: true, verifiedKyc: true, rating: { $gte: 4.5 } })
      .select('name specialization experience rating consultationFee languages address.city address.area wellnessCenter isAvailable consultationTypes')
      .sort({ rating: -1 })
      .limit(6);
    
    res.json({ success: true, data: doctors });
    } catch (error) {
    console.error('Error fetching featured doctors:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch featured doctors', data: [] });
  }
});

router.get('/doctors/:id', async (req, res) => {
  try {
    const doctor = await AyurvedaDoctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    res.json({ success: true, data: doctor });
    } catch (error) {
    console.error('Error fetching doctor:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch doctor details' });
  }
});

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

router.get('/centers', async (req, res) => {
  try {
    const centers = await WellnessCenter.find({ isActive: true, verificationStatus: 'approved' }).select('name type address rating packages facilities photos');
    res.json({ success: true, data: centers });
    } catch (error) {
    console.error('Error fetching centers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch centers', data: [] });
  }
});

router.get('/centers/:id', async (req, res) => {
  try {
    const center = await WellnessCenter.findById(req.params.id);
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });
    res.json({ success: true, data: center });
    } catch (error) {
    console.error('Error fetching center:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch center details' });
  }
});

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

router.post('/doctor/register', async (req, res) => {
  try {
    const { name, phone, email, password, specialization, experience, education, ayushRegNo, consultationFee, city, state, clinicName, languages, documents, about } = req.body;
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const doctor = new AyurvedaDoctor({
      name,
      phone,
      email,
      password: hashedPassword,
      specialization,
      experience: parseInt(experience),
      education,
      ayushRegNo,
      consultationFee: parseInt(consultationFee),
      languages: languages || [],
      address: { city, state },
      wellnessCenter: { name: clinicName },
      about: about || '',
      documents: {
        ayushCertificate: documents?.ayushCertificate || '',
        degreeCertificate: documents?.degreeCertificate || '',
        idProof: documents?.idProof || '',
        photo: documents?.photo || '',
        clinicLicense: documents?.clinicLicense || '',
        panCard: documents?.panCard || ''
      },
      verificationStatus: 'pending'
    });
    
    await doctor.save();
    res.status(201).json({ success: true, message: 'Registration submitted', doctorId: doctor._id });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/doctor/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
    
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

router.get('/doctor/stats/:doctorId', async (req, res) => {
  try {
    const doctor = await AyurvedaDoctor.findById(req.params.doctorId);
    res.json({ success: true, data: { totalConsultations: doctor?.stats?.totalConsultations || 0, totalEarnings: doctor?.stats?.totalEarnings || 0, rating: doctor?.rating || 0, pendingPayout: 0 } });
  } catch (error) {
    res.json({ success: true, data: { totalConsultations: 0, totalEarnings: 0, rating: 0, pendingPayout: 0 } });
  }
});

router.get('/admin/pending-doctors', async (req, res) => {
  try {
    const doctors = await AyurvedaDoctor.find({ verificationStatus: 'pending' }).select('name phone specialization ayushRegNo address.city createdAt').sort({ createdAt: -1 });
    res.json({ success: true, data: doctors });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

const doctor = await AyurvedaDoctor.findByIdAndUpdate(req.params.id, {
      verificationStatus: status,
      isActive: status === 'approved',
      verifiedKyc: status === 'approved',
      verifiedAt: new Date(),
      rejectionReason: status === 'rejected' ? rejectionReason : null
    }, { new: true });
    res.json({ success: true, message: `Doctor ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 🆕 CORPORATE WELLNESS ROUTES (ADDED)
// ============================================

/**
 * GET /api/ayurveda/corporate/wellness
 * Get corporate wellness packages from Ayurveda doctors
 */
router.get('/corporate/wellness', async (req, res) => {
  try {
    const { city, minEmployees, sort, page = 1, limit = 20 } = req.query;

    const query = {
      offersCorporateWellness: true,
      isActive: true,
      verificationStatus: 'approved'
    };

    if (city) query['address.city'] = { $regex: city, $options: 'i' };
    if (minEmployees) query.minEmployees = { $lte: parseInt(minEmployees) };

    const skip = (page - 1) * limit;
    const doctors = await AyurvedaDoctor.find(query)
      .select('name rating address city specialization corporateWellnessPackages corporateDiscount minEmployees')
      .sort(sort === 'rating' ? { rating: -1 } : { name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AyurvedaDoctor.countDocuments(query);

    const packages = [];
    doctors.forEach(doctor => {
      const activePackages = doctor.corporateWellnessPackages?.filter(p => p.isActive !== false) || [];
      activePackages.forEach(pkg => {
        packages.push({
          ...pkg.toObject(),
          doctorId: doctor._id,
          doctorName: doctor.name,
          doctorCity: doctor.address?.city,
          doctorRating: doctor.rating,
          specialization: doctor.specialization,
          discount: doctor.corporateDiscount || 0,
          minEmployees: doctor.minEmployees || 10
        });
      });
    });

    res.json({
      success: true,
      data: packages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching corporate wellness:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ayurveda/corporate/wellness/:id
 * Get single corporate wellness package details
 */
router.get('/corporate/wellness/:id', async (req, res) => {
  try {
    const doctor = await AyurvedaDoctor.findOne({
      'corporateWellnessPackages._id': req.params.id,
      offersCorporateWellness: true,
      isActive: true,
      verificationStatus: 'approved'
    });

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Corporate wellness package not found' });
    }

    const packageItem = doctor.corporateWellnessPackages.find(p => p._id.toString() === req.params.id);
    if (!packageItem || packageItem.isActive === false) {
      return res.status(404).json({ success: false, message: 'Package not active' });
    }

    res.json({
      success: true,
      data: {
        package: packageItem,
        doctor: {
          id: doctor._id,
          name: doctor.name,
          city: doctor.address?.city,
          rating: doctor.rating,
          specialization: doctor.specialization,
          experience: doctor.experience,
          discount: doctor.corporateDiscount || 0,
          minEmployees: doctor.minEmployees || 10
        }
      }
    });
  } catch (error) {
    console.error('Error fetching corporate wellness package:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ayurveda/corporate/doctors
 * Get doctors offering corporate wellness
 */
router.get('/corporate/doctors', async (req, res) => {
  try {
    const { city, specialization, minRating, page = 1, limit = 20 } = req.query;

    const query = {
      offersCorporateWellness: true,
      isActive: true,
      verificationStatus: 'approved'
    };

    if (city) query['address.city'] = { $regex: city, $options: 'i' };
    if (specialization) query.specialization = specialization;
    if (minRating) query.rating = { $gte: parseFloat(minRating) };

    const skip = (page - 1) * limit;
    const doctors = await AyurvedaDoctor.find(query)
      .select('name rating address city specialization corporateWellnessPackages corporateDiscount minYears experience')
      .sort({ rating: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AyurvedaDoctor.countDocuments(query);

    const doctorsWithCount = doctors.map(d => ({
      ...d.toObject(),
      packageCount: d.corporateWellnessPackages?.filter(pkg => pkg.isActive !== false).length || 0,
      workshopCount: d.corporateWorkshops?.filter(w => w.isActive !== false).length || 0
    }));

    res.json({
      success: true,
      data: doctorsWithCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching corporate doctors:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/ayurveda/corporate/book
 * Book corporate wellness for employees
 */
router.post('/corporate/book', authenticateHR, async (req, res) => {
  try {
    const companyId = req.companyId;
    const { packageId, doctorId, employeeIds, scheduledDate, address, workshopId } = req.body;

    if (!packageId || !doctorId || !employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'packageId, doctorId, and employeeIds are required'
      });
    }

    const doctor = await AyurvedaDoctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    let packageItem = null;
    let workshopItem = null;
    let pricePerEmployee = 0;
    let duration = '';
    let sessions = 1;
    let bookingType = 'package';

    if (workshopId) {
      workshopItem = doctor.corporateWorkshops?.find(w => w._id.toString() === workshopId);
      if (!workshopItem || workshopItem.isActive === false) {
        return res.status(404).json({ success: false, message: 'Workshop not found or inactive' });
      }
      pricePerEmployee = workshopItem.price || 1000;
      duration = workshopItem.duration || '2 hours';
      sessions = 1;
      bookingType = 'workshop';
    } else {
      packageItem = doctor.corporateWellnessPackages.find(p => p._id.toString() === packageId);
      if (!packageItem || packageItem.isActive === false) {
        return res.status(404).json({ success: false, message: 'Package not found or inactive' });
      }
      pricePerEmployee = packageItem.pricePerEmployee || 1000;
      duration = packageItem.duration || '1-day';
      sessions = packageItem.sessions || 1;
    }

    const employees = await CorporateEmployee.find({
      _id: { $in: employeeIds },
      companyId: companyId,
      isActive: true
    });

    if (employees.length === 0) {
      return res.status(400).json({ success: false, message: 'No active employees found' });
    }

    const discount = doctor.corporateDiscount || 0;
    const discountedPrice = pricePerEmployee * (1 - discount / 100);
    const totalPrice = discountedPrice * employees.length;

    const booking = {
      doctorId,
      packageId: packageItem?._id || null,
      workshopId: workshopItem?._id || null,
      bookingType,
      companyId,
      employeeCount: employees.length,
      totalPrice,
      scheduledDate: scheduledDate || new Date(),
      address: address || '',
      status: 'confirmed',
      createdAt: new Date()
    };

    doctor.corporateAnalytics.totalCorporateBookings = (doctor.corporateAnalytics?.totalCorporateBookings || 0) + 1;
    doctor.corporateAnalytics.totalCorporateRevenue = (doctor.corporateAnalytics?.totalCorporateRevenue || 0) + totalPrice;
    await doctor.save();

    res.json({
      success: true,
      message: 'Corporate wellness booked successfully',
      data: {
        booking,
        employees: employees.map(e => ({ id: e._id, name: e.name, email: e.email })),
        pricePerEmployee: discountedPrice,
        totalPrice,
        discountApplied: discount,
        duration,
        sessions
      }
    });
  } catch (error) {
    console.error('Error booking corporate wellness:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ayurveda/corporate/workshops
 * Get corporate workshops from Ayurveda doctors
 */
router.get('/corporate/workshops', async (req, res) => {
  try {
    const { city, page = 1, limit = 20 } = req.query;

    const query = {
      offersCorporateWellness: true,
      isActive: true,
      verificationStatus: 'approved'
    };

    if (city) query['address.city'] = { $regex: city, $options: 'i' };

    const skip = (page - 1) * limit;
    const doctors = await AyurvedaDoctor.find(query)
      .select('name rating address city corporateWorkshops corporateDiscount')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AyurvedaDoctor.countDocuments(query);

    const workshops = [];
    doctors.forEach(doctor => {
      const activeWorkshops = doctor.corporateWorkshops?.filter(w => w.isActive !== false) || [];
      activeWorkshops.forEach(ws => {
        workshops.push({
          ...ws.toObject(),
          doctorId: doctor._id,
          doctorName: doctor.name,
          doctorCity: doctor.address?.city,
          doctorRating: doctor.rating,
          discount: doctor.corporateDiscount || 0
        });
      });
    });

    res.json({
      success: true,
      data: workshops,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching corporate workshops:', error);
    res.status(500).json({ success: false, message: error.message });
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

// ============================================
// 🆕 AYURVEDA PRODUCTS
// ============================================

const AyurvedaProduct = require('../models/AyurvedaProduct');
const PanchakarmaProgress = require('../models/PanchakarmaProgress');

// GET /api/ayurveda/products
router.get('/products', async (req, res) => {
  try {
    const { category, prakriti, season, healthGoal, featured } = req.query;
    const query = { isActive: true };
    
    if (category) query.category = category;
    if (prakriti) query.prakritiType = { $in: [prakriti, 'All'] };
    if (season) query.recommendedSeason = { $in: [season, 'All'] };
    if (healthGoal) query.healthGoals = healthGoal;
    if (featured) query.isFeatured = true;

    const products = await AyurvedaProduct.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/ayurveda/products/:id
router.get('/products/:id', async (req, res) => {
  try {
    const product = await AyurvedaProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/ayurveda/products/prakriti/:type
router.get('/products/prakriti/:type', async (req, res) => {
  try {
    const products = await AyurvedaProduct.find({
      prakritiType: { $in: [req.params.type, 'All'] },
      isActive: true
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 PANCHAKARMA PROGRESS TRACKER
// ============================================

// GET /api/ayurveda/panchakarma-progress/:bookingId
router.get('/panchakarma-progress/:bookingId', async (req, res) => {
  try {
    let progress = await PanchakarmaProgress.findOne({ bookingId: req.params.bookingId });
    
    if (!progress) {
      const booking = await require('../models/Booking').findById(req.params.bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      
      progress = new PanchakarmaProgress({
        bookingId: booking._id,
        patientId: booking.userId,
        packageName: booking.packageName || 'Panchakarma Treatment',
        totalDays: booking.durationDays || 21,
        startDate: booking.appointmentDate || new Date(),
        status: 'not_started'
      });
      await progress.save();
    }
    
    res.json({ success: true, data: progress });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/ayurveda/panchakarma-progress/:bookingId
router.put('/panchakarma-progress/:bookingId', async (req, res) => {
  try {
    const { dailyLog, doctorNote, status } = req.body;
    
    const progress = await PanchakarmaProgress.findOne({ bookingId: req.params.bookingId });
    if (!progress) return res.status(404).json({ success: false, message: 'Progress not found' });
    
    if (dailyLog) {
      progress.dailyLogs.push(dailyLog);
      progress.currentDay = dailyLog.day;
    }
    if (doctorNote) {
      progress.doctorNotes.push({ note: doctorNote, date: new Date() });
    }
    if (status) {
      progress.status = status;
      if (status === 'completed') {
        progress.completedAt = new Date();
        progress.endDate = new Date();
      }
    }
    
    progress.updatedAt = new Date();
    await progress.save();
    
    res.json({ success: true, data: progress });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 SEASONAL WELLNESS
// ============================================

// GET /api/ayurveda/seasonal-recommendations
router.get('/seasonal-recommendations', async (req, res) => {
  try {
    const month = new Date().getMonth();
    let season;
    if (month >= 2 && month <= 4) season = 'Spring';
    else if (month >= 5 && month <= 6) season = 'Summer';
    else if (month >= 7 && month <= 8) season = 'Monsoon';
    else if (month >= 9 && month <= 10) season = 'Autumn';
    else season = 'Winter';
    
    const products = await AyurvedaProduct.find({
      recommendedSeason: { $in: [season, 'All'] },
      isActive: true
    }).limit(6);
    
    res.json({ success: true, data: { season, products } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// DOCTOR AVAILABILITY MANAGEMENT
// ============================================

// GET /api/ayurveda/doctor/:id/availability
router.get('/doctor/:id/availability', async (req, res) => {
  try {
    const doctor = await AyurvedaDoctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    
    res.json({
      success: true,
      data: {
        availability: doctor.availability || [],
        consultationTypes: doctor.consultationTypes || {},
        isAvailable: doctor.isActive && doctor.verificationStatus === 'approved'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/ayurveda/doctor/availability (auth required)
router.put('/doctor/availability', async (req, res) => {
  try {
    const { doctorId, availability } = req.body;
    
    if (!doctorId || !availability) {
      return res.status(400).json({ success: false, error: 'Doctor ID and availability are required' });
    }
    
    const doctor = await AyurvedaDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    
    doctor.availability = availability;
    await doctor.save();
    
    res.json({
      success: true,
      message: 'Availability updated successfully',
      data: doctor.availability
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ayurveda/doctor/:id/slots?date=2026-08-30
router.get('/doctor/:id/slots', async (req, res) => {
  try {
    const { date } = req.query;
    const doctor = await AyurvedaDoctor.findById(req.params.id);
    
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    
    if (!date) {
      return res.status(400).json({ success: false, error: 'Date is required' });
    }
    
    // Get day of week
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[new Date(date).getDay()];
    
    // Find availability for this day
    const dayAvailability = doctor.availability?.find(a => a.day === dayName);
    
    if (!dayAvailability) {
      return res.json({ success: true, data: { available: false, slots: [] } });
    }
    
    // Check existing bookings for this date
    const AyurvedaBooking = require('../models/AyurvedaBooking');
    const existingBookings = await AyurvedaBooking.find({
      doctor: doctor._id,
      bookingDate: {
        $gte: new Date(date + 'T00:00:00'),
        $lt: new Date(date + 'T23:59:59')
      },
      status: { $in: ['pending', 'confirmed'] }
    });
    
    const bookedSlots = existingBookings.map(b => b.slotTime);
    
    const slots = dayAvailability.slots.map(slot => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      maxBookings: slot.maxBookings,
      currentBookings: bookedSlots.filter(t => t === slot.startTime).length,
      available: bookedSlots.filter(t => t === slot.startTime).length < slot.maxBookings
    }));
    
    res.json({
      success: true,
      data: {
        day: dayName,
        available: slots.some(s => s.available),
        slots
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// WELLNESS PROGRAMS (Doctor Listings)
// ============================================

// GET /api/ayurveda/wellness-programs
router.get('/wellness-programs', async (req, res) => {
  try {
    const { category, minPrice, maxPrice, sortBy, page = 1, limit = 10 } = req.query;
    
    const query = { isActive: true, verificationStatus: 'approved' };
    
    if (category) query['wellnessPrograms.category'] = category;
    
    const doctors = await AyurvedaDoctor.find(query)
      .select('name specialization rating experience address.city wellnessPrograms')
      .lean();
    
    let programs = [];
    doctors.forEach(doctor => {
      const activePrograms = (doctor.wellnessPrograms || []).filter(p => p.isActive !== false);
      activePrograms.forEach(program => {
        programs.push({
          ...program,
          doctorId: doctor._id,
          doctorName: doctor.name,
          doctorSpecialization: doctor.specialization,
          doctorRating: doctor.rating,
          doctorExperience: doctor.experience,
          doctorCity: doctor.address?.city
        });
      });
    });
    
    // Filters
    if (minPrice) programs = programs.filter(p => p.price >= parseInt(minPrice));
    if (maxPrice) programs = programs.filter(p => p.price <= parseInt(maxPrice));
    
    // Sorting
    if (sortBy === 'price_low') programs.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price_high') programs.sort((a, b) => b.price - a.price);
    else if (sortBy === 'rating') programs.sort((a, b) => b.doctorRating - a.doctorRating);
    else programs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const total = programs.length;
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedPrograms = programs.slice(startIndex, startIndex + parseInt(limit));
    
    res.json({
      success: true,
      data: paginatedPrograms,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/ayurveda/doctor/wellness-program (Doctor creates program)
router.post('/doctor/wellness-program', async (req, res) => {
  try {
    const { doctorId, program } = req.body;
    
    if (!doctorId || !program) {
      return res.status(400).json({ success: false, error: 'Doctor ID and program details required' });
    }
    
    const doctor = await AyurvedaDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    
    if (!doctor.wellnessPrograms) doctor.wellnessPrograms = [];
    
    doctor.wellnessPrograms.push({
      ...program,
      createdAt: new Date(),
      isActive: true,
      totalBookings: 0,
      totalRevenue: 0
    });
    
    await doctor.save();
    
    res.json({ success: true, message: 'Program added successfully', data: doctor.wellnessPrograms });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ayurveda/doctor/:id/wellness-programs
router.get('/doctor/:id/wellness-programs', async (req, res) => {
  try {
    const doctor = await AyurvedaDoctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    
    const programs = (doctor.wellnessPrograms || []).filter(p => p.isActive !== false);
    
    res.json({ success: true, data: programs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DOCTOR ONLINE/OFFLINE STATUS
// ============================================

// POST /api/ayurveda/doctor/toggle-availability-status
router.post('/doctor/toggle-availability-status', async (req, res) => {
  try {
    const { doctorId, status, consultationMode } = req.body;
    // status: 'online' | 'offline' | 'in_clinic'
    // consultationMode: 'video' | 'clinic' | 'both'
    
    if (!doctorId || !status) {
      return res.status(400).json({ success: false, error: 'Doctor ID and status required' });
    }
    
    const doctor = await AyurvedaDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    
    doctor.isAvailable = status === 'online' || status === 'in_clinic';
    doctor.currentStatus = status;
    doctor.lastStatusUpdate = new Date();
    
    if (consultationMode) {
      doctor.currentConsultationMode = consultationMode;
    }
    
    await doctor.save();
    
    res.json({
      success: true,
      message: `Doctor is now ${status.replace('_', ' ')}`,
      data: {
        isAvailable: doctor.isAvailable,
        currentStatus: doctor.currentStatus,
        currentConsultationMode: doctor.currentConsultationMode
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ayurveda/doctor/:id/status
router.get('/doctor/:id/status', async (req, res) => {
  try {
    const doctor = await AyurvedaDoctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    
    res.json({
      success: true,
      data: {
        isAvailable: doctor.isAvailable || false,
        currentStatus: doctor.currentStatus || 'offline',
        currentConsultationMode: doctor.currentConsultationMode || 'video',
        lastStatusUpdate: doctor.lastStatusUpdate || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ayurveda/doctors/available-now
router.get('/doctors/available-now', async (req, res) => {
  try {
    const { consultationType = 'video' } = req.query;
    
    const query = {
      isActive: true,
      verificationStatus: 'approved',
      isAvailable: true
    };
    
    if (consultationType === 'video') {
      query.currentConsultationMode = { $in: ['video', 'both'] };
    } else if (consultationType === 'clinic') {
      query.currentConsultationMode = { $in: ['clinic', 'both'] };
    }
    
    const doctors = await AyurvedaDoctor.find(query)
      .select('name specialization experience rating consultationFee address.city currentStatus currentConsultationMode')
      .sort({ rating: -1 })
      .limit(20);
    
    res.json({ success: true, data: doctors, count: doctors.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
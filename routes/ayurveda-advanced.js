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
      return res.status(401).json({ success, message: 'Unauthorized. No token provided.' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hr = await CorporateHR.findById(decoded.id);
    if (!hr) {
      return res.status(401).json({ success, message: 'HR not found' });
    }
    if (!hr.isActive) {
      return res.status(403).json({ success, message: 'Account suspended' });
    }

    req.hr = hr;
    req.companyId = hr.companyId;
    next();
  } catch (error) {
    res.status(401).json({ success, message: 'Invalid token' });
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
      isActive, 
      verifiedKyc};

    if (lat && lng) {
      query['address.coordinates'] = {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance(radius) * 1000
        }
      };
    }

    if (specialization) query.specialization = specialization;
    if (minExperience) query.experience = { $gte(minExperience) };
    if (maxFee) query.consultationFee = { $lte(maxFee) };
    if (languages) query.languages = { $in.split(',') };
    if (consultationType) {
      const types = consultationType.split(',');
      types.forEach(type => {
        query[`consultationTypes.${type}`] = true;
      });
    }

    let sortOptions = {};
    switch(sortBy) {
      case 'rating'= { rating: -1 }; break;
      case 'fee'= { consultationFee: 1 }; break;
      case 'experience'= { experience: -1 }; break;
      default;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const doctors = await AyurvedaDoctor.aggregate([
      { $match},
      ...(lat && lng ? [{
        $addFields: {
          distance: {
            $round: [{
              $divide: [
                { 
                  $geoNear: {
                    near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                    distanceField: 'calculatedDistance',
                    spherical,
                    query}
                },
                1000
              ]
            }, 2]
          }
        }
      }] : []),
      { $sort},
      { $skip},
      { $limit(limit) },
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
      success,
      data,
      pagination: { page(page), limit(limit), total, pages.ceil(total / parseInt(limit)) }
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success, error.message });
  }
});

router.get('/doctors', async (req, res) => {
  try {
    const { specialization, minExperience, available } = req.query;
    const query = { isActive, verifiedKyc};
    
    if (specialization) query.specialization = specialization;
    if (minExperience) query.experience = { $gte(minExperience) };
    if (available === 'true') query.isAvailable = true;
    
    const doctors = await AyurvedaDoctor.find(query)
      .select('name specialization experience rating consultationFee languages address wellnessCenter consultationTypes isAvailable availableSlots')
      .sort({ rating: -1 });
    
    res.json({ success, data, count.length });
  } catch (error) {
    const dummyDoctors = [
      { _id: 'AYD001', name: 'Dr. Rajesh Sharma', specialization: 'Panchakarma', experience: 15, rating: 4.8, consultationFee: 500, languages: ['Hindi', 'English'], address: { city: 'Mumbai', area: 'Andheri West' }, wellnessCenter: { name: 'Sharma Ayurvedic Clinic' }, isAvailable, consultationTypes: { online, clinic} },
      { _id: 'AYD002', name: 'Dr. Priya Gupta', specialization: 'General Ayurveda', experience: 12, rating: 4.9, consultationFee: 400, languages: ['Hindi', 'English', 'Marathi'], address: { city: 'Pune', area: 'Kothrud' }, wellnessCenter: { name: 'Gupta Ayurveda Center' }, isAvailable, consultationTypes: { online, clinic} },
      { _id: 'AYD003', name: 'Dr. Amit Verma', specialization: 'Kerala Ayurveda', experience: 20, rating: 4.7, consultationFee: 600, languages: ['English', 'Malayalam'], address: { city: 'Kochi', area: 'Fort Kochi' }, wellnessCenter: { name: 'Kerala Ayurveda Hospital' }, isAvailable, consultationTypes: { online, clinic} },
      { _id: 'AYD004', name: 'Dr. Sunita Reddy', specialization: 'Ayurvedic Dermatology', experience: 10, rating: 4.6, consultationFee: 350, languages: ['Telugu', 'English'], address: { city: 'Hyderabad', area: 'Banjara Hills' }, wellnessCenter: { name: 'Reddy Skin Clinic' }, isAvailable, consultationTypes: { online, clinic} },
      { _id: 'AYD005', name: 'Dr. Karan Patel', specialization: 'Panchakarma', experience: 8, rating: 4.5, consultationFee: 450, languages: ['Gujarati', 'Hindi', 'English'], address: { city: 'Ahmedabad', area: 'SG Highway' }, wellnessCenter: { name: 'Patel Panchakarma Center' }, isAvailable, consultationTypes: { online, clinic} },
    ];
    res.json({ success, data, count.length });
  }
});

router.get('/doctors/featured', async (req, res) => {
  try {
    const doctors = await AyurvedaDoctor.find({ isActive, verifiedKyc, rating: { $gte: 4.5 } })
      .select('name specialization experience rating consultationFee languages address.city address.area wellnessCenter isAvailable consultationTypes')
      .sort({ rating: -1 })
      .limit(6);
    
    res.json({ success, data});
  } catch (error) {
    const dummyDoctors = [
      { _id: 'AYD001', name: 'Dr. Rajesh Sharma', specialization: 'Panchakarma Specialist', experience: '15 years', rating: 4.8, consultationFee: 500, available, address: { city: 'Mumbai' } },
      { _id: 'AYD002', name: 'Dr. Priya Gupta', specialization: 'Ayurvedic Physician', experience: '12 years', rating: 4.9, consultationFee: 400, available, address: { city: 'Pune' } },
      { _id: 'AYD003', name: 'Dr. Amit Verma', specialization: 'Kerala Ayurveda Expert', experience: '20 years', rating: 4.7, consultationFee: 600, available, address: { city: 'Kochi' } },
    ];
    res.json({ success, data});
  }
});

router.get('/doctors/', async (req, res) => {
  try {
    const doctor = await AyurvedaDoctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ success, error: 'Doctor not found' });
    res.json({ success, data});
  } catch (error) {
    res.json({ 
      success, 
      data: {
        _id.params.id,
        name: 'Dr. Rajesh Sharma',
        specialization: 'Panchakarma Specialist',
        experience: 15, rating: 4.8, consultationFee: 500,
        languages: ['Hindi', 'English'],
        address: { city: 'Mumbai', area: 'Andheri West' },
        about: 'Experienced Ayurvedic practitioner with 15+ years of experience.',
        education: 'BAMS, MD (Panchakarma)',
        ayushRegNo: 'AYUSH-MH-2018-00123',
        availableSlots: ['10:00 AM', '2:00 PM', '5:00 PM'],
        isAvailable,
        consultationTypes: { online, clinic},
        wellnessCenter: { name: 'Sharma Ayurvedic Clinic' }
      }
    });
  }
});

router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;
    if (!lat || !lng) return res.status(400).json({ success, error: 'Latitude and longitude required' });

    const doctors = await AyurvedaDoctor.find({
      isActive, verifiedKyc,
      'address.coordinates': {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance(radius) * 1000
        }
      }
    }).select('name specialization experience rating consultationFee address.city languages isAvailable').limit(20);

    const doctorsWithDistance = doctors.map(doctor => {
      const distance = calculateDistance(parseFloat(lat), parseFloat(lng), doctor.address.coordinates.coordinates[1], doctor.address.coordinates.coordinates[0]);
      return { ...doctor.toObject(), distance.round(distance * 100) / 100 };
    });

    doctorsWithDistance.sort((a, b) => a.distance - b.distance);
    res.json({ success, data, count.length });
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

router.get('/recommend', async (req, res) => {
  try {
    const { lat, lng, symptoms } = req.query;
    if (!lat || !lng) return res.status(400).json({ success, error: 'Location required' });

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
      isActive, verifiedKyc, specialization, isAvailable,
      'address.coordinates': { $nearSphere: { $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, $maxDistance: 30000 } }
    }).select('name specialization experience rating consultationFee address.city').limit(5);

    const otherDoctors = await AyurvedaDoctor.find({
      isActive, verifiedKyc, specialization: { $ne}, isAvailable,
      'address.coordinates': { $nearSphere: { $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, $maxDistance: 30000 } }
    }).select('name specialization experience rating consultationFee address.city').sort({ rating: -1 }).limit(3);

    res.json({ success, data: { basedOnSymptoms, recommendedSpecialization, recommendedDoctors, otherNearbyDoctors} });
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

router.get('/centers', async (req, res) => {
  try {
    const centers = await WellnessCenter.find({ isActive, verificationStatus: 'approved' }).select('name type address rating packages facilities photos');
    res.json({ success, data});
  } catch (error) {
    const dummyCenters = [
      { _id: 'AYC001', name: 'AyurVeda Retreat Rishikesh', address: { city: 'Rishikesh' }, rating: 4.9, facilities: ['AC Rooms', 'Organic Food', 'Yoga Hall'], packages: [{ _id: 'PKG001', name: '7-Day Panchakarma', price: 25000, duration: 7, therapies: ['Abhyanga', 'Shirodhara'] }] },
      { _id: 'AYC002', name: 'Kerala Ayurveda Kendra', address: { city: 'Kochi' }, rating: 4.8, facilities: ['Beach Access', 'Traditional Therapies'], packages: [{ _id: 'PKG002', name: '5-Day Detox', price: 18000, duration: 5, therapies: ['Abhyanga', 'Kizhi'] }] }
    ];
    res.json({ success, data});
  }
});

router.get('/centers/', async (req, res) => {
  try {
    const center = await WellnessCenter.findById(req.params.id);
    if (!center) return res.status(404).json({ success, error: 'Center not found' });
    res.json({ success, data});
  } catch (error) {
    res.json({ success, data: { _id.params.id, name: 'AyurVeda Retreat', address: { city: 'Rishikesh' }, rating: 4.9, packages: [] } });
  }
});

router.post('/bookings', async (req, res) => {
  try {
    const { doctorId, patient, bookingDate, slotTime, consultationType, symptoms } = req.body;
    const bookingId = 'AYB' + Date.now();
    const amount = req.body.fee || 500;
    const commission = Math.round(amount * 0.15);
    
    res.status(201).json({
      success,
      data: { bookingId, amount, platformFee, finalAmount, discount: 0 }
    });
  } catch (error) {
    res.status(500).json({ success, error.message });
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
      success,
      data: {
        vata.round((vata/total)*100),
        pitta.round((pitta/total)*100),
        kapha.round((kapha/total)*100),
        timestampDate().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

router.post('/doctor/register', async (req, res) => {
  try {
    const { name, phone, email, password, specialization, experience, education, ayushRegNo, consultationFee, city, state, clinicName, languages } = req.body;
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const doctor = new AyurvedaDoctor({
      name, phone, email, password,
      specialization, experience(experience), education, ayushRegNo,
      consultationFee(consultationFee),
      languages|| [],
      address: { city, state },
      wellnessCenter: { name},
      verificationStatus: 'pending'
    });
    
    await doctor.save();
    res.status(201).json({ success, message: 'Registration submitted', doctorId._id });
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

router.post('/doctor/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
    
    const doctor = await AyurvedaDoctor.findOne({ phone });
    if (!doctor) return res.status(401).json({ success, error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, doctor.password);
    if (!valid) return res.status(401).json({ success, error: 'Invalid credentials' });
    
    if (doctor.verificationStatus !== 'approved') {
      return res.status(403).json({ success, error: 'Account pending approval' });
    }
    
    const token = jwt.sign({ id._id, role: 'ayurveda_doctor' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success, token, doctor: { id._id, name.name, specialization.specialization } });
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

router.get('/doctor/stats/', async (req, res) => {
  try {
    const doctor = await AyurvedaDoctor.findById(req.params.doctorId);
    res.json({ success, data: { totalConsultations?.stats?.totalConsultations || 0, totalEarnings?.stats?.totalEarnings || 0, rating?.rating || 0, pendingPayout: 0 } });
  } catch (error) {
    res.json({ success, data: { totalConsultations: 0, totalEarnings: 0, rating: 0, pendingPayout: 0 } });
  }
});

router.get('/admin/pending-doctors', async (req, res) => {
  try {
    const doctors = await AyurvedaDoctor.find({ verificationStatus: 'pending' }).select('name phone specialization ayushRegNo address.city createdAt').sort({ createdAt: -1 });
    res.json({ success, data});
  } catch (error) {
    res.json({ success, data: [] });
  }
});

router.put('/admin/verify-doctor/', async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const doctor = await AyurvedaDoctor.findByIdAndUpdate(req.params.id, {
      verificationStatus,
      isActive=== 'approved',
      verifiedAtDate(),
      rejectionReason=== 'rejected' ? rejectionReason }, { new});
    res.json({ success, message: `Doctor ${status}` });
  } catch (error) {
    res.status(500).json({ success, error.message });
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
      offersCorporateWellness,
      isActive,
      verificationStatus: 'approved'
    };

    if (city) query['address.city'] = { $regex, $options: 'i' };
    if (minEmployees) query.minEmployees = { $lte(minEmployees) };

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
          doctorId._id,
          doctorName.name,
          doctorCity.address?.city,
          doctorRating.rating,
          specialization.specialization,
          discount.corporateDiscount || 0,
          minEmployees.minEmployees || 10
        });
      });
    });

    res.json({
      success,
      data,
      pagination: {
        page(page),
        limit(limit),
        total,
        pages.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching corporate wellness:', error);
    res.status(500).json({ success, message.message });
  }
});

/**
 * GET /api/ayurveda/corporate/wellness/* Get single corporate wellness package details
 */
router.get('/corporate/wellness/', async (req, res) => {
  try {
    const doctor = await AyurvedaDoctor.findOne({
      'corporateWellnessPackages._id'.params.id,
      offersCorporateWellness,
      isActive,
      verificationStatus: 'approved'
    });

    if (!doctor) {
      return res.status(404).json({ success, message: 'Corporate wellness package not found' });
    }

    const packageItem = doctor.corporateWellnessPackages.find(p => p._id.toString() === req.params.id);
    if (!packageItem || packageItem.isActive === false) {
      return res.status(404).json({ success, message: 'Package not active' });
    }

    res.json({
      success,
      data: {
        package,
        doctor: {
          id._id,
          name.name,
          city.address?.city,
          rating.rating,
          specialization.specialization,
          experience.experience,
          discount.corporateDiscount || 0,
          minEmployees.minEmployees || 10
        }
      }
    });
  } catch (error) {
    console.error('Error fetching corporate wellness package:', error);
    res.status(500).json({ success, message.message });
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
      offersCorporateWellness,
      isActive,
      verificationStatus: 'approved'
    };

    if (city) query['address.city'] = { $regex, $options: 'i' };
    if (specialization) query.specialization = specialization;
    if (minRating) query.rating = { $gte(minRating) };

    const skip = (page - 1) * limit;
    const doctors = await AyurvedaDoctor.find(query)
      .select('name rating address city specialization corporateWellnessPackages corporateDiscount minYears experience')
      .sort({ rating: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AyurvedaDoctor.countDocuments(query);

    const doctorsWithCount = doctors.map(d => ({
      ...d.toObject(),
      packageCount.corporateWellnessPackages?.filter(pkg => pkg.isActive !== false).length || 0,
      workshopCount.corporateWorkshops?.filter(w => w.isActive !== false).length || 0
    }));

    res.json({
      success,
      data,
      pagination: {
        page(page),
        limit(limit),
        total,
        pages.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching corporate doctors:', error);
    res.status(500).json({ success, message.message });
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
        success,
        message: 'packageId, doctorId, and employeeIds are required'
      });
    }

    const doctor = await AyurvedaDoctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success, message: 'Doctor not found' });
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
        return res.status(404).json({ success, message: 'Workshop not found or inactive' });
      }
      pricePerEmployee = workshopItem.price || 1000;
      duration = workshopItem.duration || '2 hours';
      sessions = 1;
      bookingType = 'workshop';
    } else {
      packageItem = doctor.corporateWellnessPackages.find(p => p._id.toString() === packageId);
      if (!packageItem || packageItem.isActive === false) {
        return res.status(404).json({ success, message: 'Package not found or inactive' });
      }
      pricePerEmployee = packageItem.pricePerEmployee || 1000;
      duration = packageItem.duration || '1-day';
      sessions = packageItem.sessions || 1;
    }

    const employees = await CorporateEmployee.find({
      _id: { $in},
      companyId,
      isActive});

    if (employees.length === 0) {
      return res.status(400).json({ success, message: 'No active employees found' });
    }

    const discount = doctor.corporateDiscount || 0;
    const discountedPrice = pricePerEmployee * (1 - discount / 100);
    const totalPrice = discountedPrice * employees.length;

    const booking = {
      doctorId,
      packageId?._id || null,
      workshopId?._id || null,
      bookingType,
      companyId,
      employeeCount.length,
      totalPrice,
      scheduledDate|| new Date(),
      address|| '',
      status: 'confirmed',
      createdAtDate()
    };

    doctor.corporateAnalytics.totalCorporateBookings = (doctor.corporateAnalytics?.totalCorporateBookings || 0) + 1;
    doctor.corporateAnalytics.totalCorporateRevenue = (doctor.corporateAnalytics?.totalCorporateRevenue || 0) + totalPrice;
    await doctor.save();

    res.json({
      success,
      message: 'Corporate wellness booked successfully',
      data: {
        booking,
        employees.map(e => ({ id._id, name.name, email.email })),
        pricePerEmployee,
        totalPrice,
        discountApplied,
        duration,
        sessions
      }
    });
  } catch (error) {
    console.error('Error booking corporate wellness:', error);
    res.status(500).json({ success, message.message });
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
      offersCorporateWellness,
      isActive,
      verificationStatus: 'approved'
    };

    if (city) query['address.city'] = { $regex, $options: 'i' };

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
          doctorId._id,
          doctorName.name,
          doctorCity.address?.city,
          doctorRating.rating,
          discount.corporateDiscount || 0
        });
      });
    });

    res.json({
      success,
      data,
      pagination: {
        page(page),
        limit(limit),
        total,
        pages.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching corporate workshops:', error);
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// HELPERdistance
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
    const query = { isActive};
    
    if (category) query.category = category;
    if (prakriti) query.prakritiType = { $in: [prakriti, 'All'] };
    if (season) query.recommendedSeason = { $in: [season, 'All'] };
    if (healthGoal) query.healthGoals = healthGoal;
    if (featured) query.isFeatured = true;

    const products = await AyurvedaProduct.find(query).sort({ createdAt: -1 });
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// GET /api/ayurveda/products/router.get('/products/', async (req, res) => {
  try {
    const product = await AyurvedaProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ success, message: 'Product not found' });
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// GET /api/ayurveda/products/prakriti/router.get('/products/prakriti/', async (req, res) => {
  try {
    const products = await AyurvedaProduct.find({
      prakritiType: { $in: [req.params.type, 'All'] },
      isActive}).sort({ createdAt: -1 });
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// 🆕 PANCHAKARMA PROGRESS TRACKER
// ============================================

// GET /api/ayurveda/panchakarma-progress/router.get('/panchakarma-progress/', async (req, res) => {
  try {
    let progress = await PanchakarmaProgress.findOne({ bookingId.params.bookingId });
    
    if (!progress) {
      const booking = await require('../models/Booking').findById(req.params.bookingId);
      if (!booking) return res.status(404).json({ success, message: 'Booking not found' });
      
      progress = new PanchakarmaProgress({
        bookingId._id,
        patientId.userId,
        packageName.packageName || 'Panchakarma Treatment',
        totalDays.durationDays || 21,
        startDate.appointmentDate || new Date(),
        status: 'not_started'
      });
      await progress.save();
    }
    
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// PUT /api/ayurveda/panchakarma-progress/router.put('/panchakarma-progress/', async (req, res) => {
  try {
    const { dailyLog, doctorNote, status } = req.body;
    
    const progress = await PanchakarmaProgress.findOne({ bookingId.params.bookingId });
    if (!progress) return res.status(404).json({ success, message: 'Progress not found' });
    
    if (dailyLog) {
      progress.dailyLogs.push(dailyLog);
      progress.currentDay = dailyLog.day;
    }
    if (doctorNote) {
      progress.doctorNotes.push({ note, dateDate() });
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
    
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
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
      isActive}).limit(6);
    
    res.json({ success, data: { season, products } });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

module.exports = router;


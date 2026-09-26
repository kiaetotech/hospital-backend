const express = require('express');
const router = express.Router();
const AyurvedaDoctor = require('../models/AyurvedaDoctor');
const CommissionConfig = require('../models/CommissionConfig');
const CorporateEmployee = require('../models/CorporateEmployee');
const CorporateHR = require('../models/CorporateHR');
const WellnessCenter = require('../models/WellnessCenter');
const Discount = require('../models/Discount');

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
      verificationStatus: 'approved'
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
    const query = { isActive: true, verificationStatus: 'approved' };
    
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
    const doctors = await AyurvedaDoctor.find({ isActive: true, verificationStatus: 'approved', rating: { $gte: 4.5 } })
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
      isActive: true, verificationStatus: 'approved',
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
      isActive: true, verificationStatus: 'approved', specialization: recommendedSpec, isAvailable: true,
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
// PUBLIC: LIST CENTERS (Only with approved packages)
// ============================================
router.get('/centers', async (req, res) => {
  try {
    const centers = await WellnessCenter.find({ 
      isActive: true, 
      verificationStatus: 'approved' 
    })
    .select('-password -documents -bankDetails')
    .lean();

    // Filter to only centers with at least 1 APPROVED and ACTIVE package
    const centersWithApprovedPackages = centers
      .map(c => {
        const approvedPackages = (c.packages || []).filter(
          p => p.isActive !== false && p.approvalStatus === 'approved' && !p.deleted
        );
        return { ...c, packages: approvedPackages };
      })
      .filter(c => c.packages.length > 0);

    res.json({ 
      success: true, 
      data: centersWithApprovedPackages 
    });
  } catch (error) {
    console.error('Error fetching centers:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch centers', 
      details: error.message,
      data: [] 
    });
  }
});

// ============================================
// PUBLIC: SINGLE CENTER DETAIL (Only approved packages)
// ============================================
router.get('/centers/:id', async (req, res) => {
  try {
    const center = await WellnessCenter.findById(req.params.id)
      .select('-password -documents -bankDetails')
      .lean();

    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });

    // Only show approved and active packages
    center.packages = (center.packages || []).filter(
      p => p.isActive !== false && p.approvalStatus === 'approved' && !p.deleted
    );
    
    // Only show active rooms
    center.roomTypes = (center.roomTypes || []).filter(r => r.isActive !== false);
    
    // Only show approved reviews
    center.reviews = (center.reviews || [])
      .filter(r => r.adminApproved !== false)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    // Populate doctors safely
    if (center.doctors && center.doctors.length > 0) {
      try {
        const AyurvedaDoctor = require('../models/AyurvedaDoctor');
        const doctors = await AyurvedaDoctor.find(
          { _id: { $in: center.doctors } },
          'name specialization experience education rating totalReviews consultationFee consultationTypes languages about'
        ).lean();
        center.doctors = doctors;
      } catch (docError) {
        console.error('Doctor populate error:', docError.message);
        center.doctors = [];
      }
    } else {
      center.doctors = [];
    }

    res.json({ success: true, data: center });
  } catch (error) {
    console.error('Center detail error:', error);
    res.status(500).json({ success: false, error: error.message });
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
    const JWT_SECRET = process.env.JWT_SECRET;
    
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

router.put('/admin/verify-doctor/:id', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  try {
    const { status, rejectionReason } = req.body;
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
      const activePrograms = (doctor.wellnessPrograms || []).filter(
  p => p.isActive !== false && p.approvalStatus === 'approved' && !p.deleted
);
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

// ============================================
// DOCTOR: CREATE WELLNESS PROGRAM (With Approval)
// ============================================
router.post('/doctor/wellness-program', async (req, res) => {
  try {
    const { doctorId, program } = req.body;
    
    if (!doctorId || !program) {
      return res.status(400).json({ success: false, error: 'Doctor ID and program details required' });
    }
    
    const doctor = await AyurvedaDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    
    if (!doctor.wellnessPrograms) doctor.wellnessPrograms = [];
    
    const newProgram = {
      ...program,
      createdAt: new Date(),
      isActive: true,
      totalBookings: 0,
      totalRevenue: 0,
      // Approval
      approvalStatus: 'pending',
      submittedAt: new Date(),
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: '',
      approvalNotes: ''
    };
    
    doctor.wellnessPrograms.push(newProgram);
    await doctor.save();
    
    const addedProgram = doctor.wellnessPrograms[doctor.wellnessPrograms.length - 1];
    
    res.json({ 
      success: true, 
      message: 'Program submitted for admin approval',
      data: addedProgram
    });
  } catch (error) {
    console.error('Program creation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// GET /api/ayurveda/doctor/:id/wellness-programs
router.get('/doctor/:id/wellness-programs', async (req, res) => {
  try {
    const doctor = await AyurvedaDoctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    
    // Check both fields (corporateWellnessPackages is where POST saves)
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

// ============================================
// DOCTOR: UPDATE WELLNESS PROGRAM
// ============================================
router.put('/doctor/wellness-program/:doctorId/:programId', async (req, res) => {
  try {
    const { doctorId, programId } = req.params;
    const updates = req.body;
    
    const doctor = await AyurvedaDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    
    const program = doctor.wellnessPrograms.id(programId);
    if (!program) return res.status(404).json({ success: false, error: 'Program not found' });
    
    // Update fields
    Object.assign(program, updates);
    
    // Reset approval on edit
    program.approvalStatus = 'pending';
    program.submittedAt = new Date();
    program.approvedAt = null;
    program.approvedBy = null;
    program.rejectedAt = null;
    program.rejectedBy = null;
    program.rejectionReason = '';
    
    await doctor.save();
    
    res.json({ 
      success: true, 
      message: 'Program updated and sent for re-approval',
      data: program
    });
  } catch (error) {
    console.error('Program update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DOCTOR: DELETE WELLNESS PROGRAM
// ============================================
router.delete('/doctor/wellness-program/:doctorId/:programId', async (req, res) => {
  try {
    const { doctorId, programId } = req.params;
    
    const doctor = await AyurvedaDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    
    doctor.wellnessPrograms.pull(programId);
    await doctor.save();
    
    res.json({ success: true, message: 'Program removed' });
  } catch (error) {
    console.error('Program delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN: WELLNESS PROGRAM APPROVAL
// ============================================

// Get all pending wellness programs across all doctors
router.get('/admin/programs/pending', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }

  try {
    // Fetch all doctors with any programs, filter in JS (matches /programs/all behavior)
    const doctors = await AyurvedaDoctor.find({
      'wellnessPrograms.0': { $exists: true }
    }).select('name phone email specialization address wellnessPrograms');

    const pendingPrograms = [];
    doctors.forEach(doctor => {
      (doctor.wellnessPrograms || [])
        .filter(prog =>
          prog.approvalStatus === 'pending' &&
          prog.deleted !== true
        )
        .forEach(prog => {
          pendingPrograms.push({
            doctorId: doctor._id,
            doctorName: doctor.name,
            doctorSpecialization: doctor.specialization,
            doctorCity: doctor.address?.city,
            doctorPhone: doctor.phone,
            programId: prog._id,
            name: prog.name,
            description: prog.description,
            shortDescription: prog.shortDescription,
            category: prog.category,
            price: prog.price,
            discountPrice: prog.discountPrice,
            duration: prog.duration,
            durationDays: prog.durationDays,
            programType: prog.programType,
            therapies: prog.therapies,
            includes: prog.includes,
            exclusions: prog.exclusions,
            accommodationNotes: prog.accommodationNotes,
            submittedAt: prog.submittedAt,
            approvalStatus: prog.approvalStatus
          });
        });
    });

    pendingPrograms.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    res.json({
      success: true,
      count: pendingPrograms.length,
      data: pendingPrograms
    });
  } catch (error) {
    console.error('Pending programs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve a wellness program
router.put('/admin/programs/:doctorId/:programId/approve', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  
  try {
    const { doctorId, programId } = req.params;
    
    const doctor = await AyurvedaDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    
    const program = doctor.wellnessPrograms.id(programId);
    if (!program) return res.status(404).json({ success: false, error: 'Program not found' });
    
    program.approvalStatus = 'approved';
    program.approvedAt = new Date();
    program.rejectionReason = '';
    program.approvalNotes = req.body.notes || '';
    
    await doctor.save();
    
    res.json({ 
      success: true, 
      message: 'Program approved',
      data: program 
    });
  } catch (error) {
    console.error('Program approval error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject a wellness program
router.put('/admin/programs/:doctorId/:programId/reject', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  
  try {
    const { doctorId, programId } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required' });
    }
    
    const doctor = await AyurvedaDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    
    const program = doctor.wellnessPrograms.id(programId);
    if (!program) return res.status(404).json({ success: false, error: 'Program not found' });
    
    program.approvalStatus = 'rejected';
    program.rejectedAt = new Date();
    program.rejectionReason = reason;
    
    await doctor.save();
    
    res.json({ 
      success: true, 
      message: 'Program rejected',
      data: program 
    });
  } catch (error) {
    console.error('Program rejection error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: All programs (pending + approved + rejected)
router.get('/admin/programs/all', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }

  try {
    const doctors = await AyurvedaDoctor.find({
      'wellnessPrograms.0': { $exists: true }
    }).select('name phone email specialization address wellnessPrograms');

    const programs = [];
    doctors.forEach(doctor => {
      (doctor.wellnessPrograms || []).forEach(prog => {
        programs.push({
          doctorId: doctor._id,
          doctorName: doctor.name,
          doctorPhone: doctor.phone,
          doctorSpecialization: doctor.specialization,
          doctorCity: doctor.address?.city,
          programId: prog._id,
          name: prog.name,
          description: prog.description,
          shortDescription: prog.shortDescription,
          category: prog.category,
          price: prog.price,
          discountPrice: prog.discountPrice,
          duration: prog.duration,
          durationDays: prog.durationDays,
          programType: prog.programType,
          therapies: prog.therapies,
          includes: prog.includes,
          isActive: prog.isActive !== false,
          approvalStatus: prog.approvalStatus || 'pending',
          submittedAt: prog.submittedAt,
          approvedAt: prog.approvedAt,
          rejectedAt: prog.rejectedAt,
          rejectionReason: prog.rejectionReason || ''
        });
      });
    });

    programs.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

    res.json({ success: true, count: programs.length, data: programs });
  } catch (error) {
    console.error('[admin.programs.all]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pending programs count
router.get('/admin/programs/pending-count', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  
  try {
    const doctors = await AyurvedaDoctor.find({
      'wellnessPrograms.approvalStatus': 'pending'
    }).select('wellnessPrograms');
    
    let count = 0;
    doctors.forEach(doctor => {
      count += (doctor.wellnessPrograms || []).filter(p => p.approvalStatus === 'pending').length;
    });
    
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ONE-TIME MIGRATION: Add approvalStatus to old programs
// ============================================
router.post('/admin/migrate/programs-approval', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  
  try {
    const doctors = await AyurvedaDoctor.find({});
    let updated = 0;
    
    for (const doctor of doctors) {
      let changed = false;
      (doctor.wellnessPrograms || []).forEach(prog => {
        if (!prog.approvalStatus) {
          prog.approvalStatus = 'pending';
          prog.submittedAt = prog.submittedAt || new Date();
          changed = true;
          updated++;
        }
      });
      if (changed) await doctor.save();
    }
    
    res.json({ 
      success: true, 
      message: `Migration complete. Updated ${updated} programs.`,
      totalDoctors: doctors.length
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// AYURVEDA DISCOUNTS — Admin Management
// ============================================

// Create discount
router.post('/discounts', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const {
      code,
      discountType,
      value,
      maxDiscount,
      validFrom,
      validTill,
      applicableTags
    } = req.body;

    if (!code || !discountType || value === undefined) {
      return res.status(400).json({ success: false, message: 'code, discountType, and value are required' });
    }

    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({ success: false, message: 'discountType must be percentage or fixed' });
    }

    const normalizedCode = String(code).trim().toUpperCase();

    const existing = await Discount.findOne({ code: normalizedCode });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Discount code already exists' });
    }

    // Default to all ayurveda services if nothing specified
    const tags = Array.isArray(applicableTags) && applicableTags.length > 0
      ? applicableTags
      : ['ayurveda_all'];

    const discount = await Discount.create({
      code: normalizedCode,
      type: discountType,
      value: Number(value),
      maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validUntil: validTill ? new Date(validTill) : undefined,
      applicableTags: tags,
      createdBy: { type: 'admin' },
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'Discount created',
      data: discount
    });

  } catch (error) {
    console.error('[ayurveda.discounts.create]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Toggle discount active/inactive
router.put('/discounts/:id', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const discount = await Discount.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: req.body.isActive, updatedAt: new Date() } },
      { new: true }
    );

    if (!discount) {
      return res.status(404).json({ success: false, message: 'Discount not found' });
    }

    res.json({ success: true, message: 'Discount updated', data: discount });
  } catch (error) {
    console.error('[ayurveda.discounts.update]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// AYURVEDA DISCOUNTS — UPDATE
// ============================================
router.put('/discounts/:id/full', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const {
      value,
      maxDiscount,
      validFrom,
      validTill,
      applicableTags,
      isActive
    } = req.body;

    const updates = {};
    if (value !== undefined) updates.value = Number(value);
    if (maxDiscount !== undefined) updates.maxDiscount = maxDiscount === null ? undefined : Number(maxDiscount);
    if (validFrom) updates.validFrom = new Date(validFrom);
    if (validTill) updates.validUntil = new Date(validTill);
    if (Array.isArray(applicableTags) && applicableTags.length > 0) updates.applicableTags = applicableTags;
    if (isActive !== undefined) updates.isActive = isActive;
    updates.updatedAt = new Date();

    const discount = await Discount.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });

    if (!discount) {
      return res.status(404).json({ success: false, message: 'Discount not found' });
    }

    res.json({ success: true, message: 'Discount updated', data: discount });
  } catch (error) {
    console.error('[ayurveda.discounts.fullUpdate]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// AYURVEDA DISCOUNTS — DELETE
// ============================================
router.delete('/discounts/:id', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const discount = await Discount.findByIdAndDelete(req.params.id);

    if (!discount) {
      return res.status(404).json({ success: false, message: 'Discount not found' });
    }

    res.json({ success: true, message: 'Discount deleted' });
  } catch (error) {
    console.error('[ayurveda.discounts.delete]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

const CommissionConfig = require('../models/CommissionConfig');

// ────────────────────────────────────────────────
// GET current config (for admin UI)
// ────────────────────────────────────────────────
router.get('/admin/fee-config', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }

  try {
    const serviceTypes = [
      'ayurveda_consultation',
      'ayurveda_panchakarma',
      'ayurveda_wellness_center',
      'ayurveda_home_therapy',
      'ayurveda_medicine',
    ];

    const configs = {};
    for (const st of serviceTypes) {
      configs[st] = await CommissionConfig.getActiveConfig(st);
    }

    const anyMissing = Object.values(configs).some(c => !c);

    res.json({
      success: true,
      data: configs,
      isConfigured: !anyMissing,
      message: anyMissing ? 'Some service types are not configured' : 'OK',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────────────
// UPDATE config (per service type, with versioning)
// ────────────────────────────────────────────────
router.put('/admin/fee-config', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }

  try {
    const { serviceType, platformFeeKey, platformFeeValue, gstPercentage, commissionRate, reason } = req.body;

    if (!serviceType || !reason || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'serviceType and reason (min 5 chars) are required'
      });
    }

    // Validate ranges
    if (gstPercentage != null && (gstPercentage < 0 || gstPercentage > 28)) {
      return res.status(400).json({ success: false, error: 'GST % must be 0-28' });
    }
    if (commissionRate != null && (commissionRate < 0 || commissionRate > 50)) {
      return res.status(400).json({ success: false, error: 'Commission % must be 0-50' });
    }
    if (platformFeeValue != null && platformFeeValue < 0) {
      return res.status(400).json({ success: false, error: 'Platform fee must be ≥ 0' });
    }

    const existing = await CommissionConfig.getActiveConfig(serviceType);

    if (!existing) {
      // Seed new config
      const newConfig = new CommissionConfig({
        configId: `COMM_${serviceType.toUpperCase()}_${Date.now()}`,
        configName: serviceType,
        serviceType,
        commissionType: 'percentage',
        percentageRate: commissionRate ?? 20,
        effectiveFrom: new Date(),
        isActive: true,
        isDefault: true,
        createdBy: req.user?.id || 'admin',
        updatedBy: req.user?.id || 'admin',
        changeReason: reason.trim(),
        ayurvedaSpecific: {
          platformFees: {
            [platformFeeKey]: platformFeeValue ?? 0
          },
          gstPercentage: gstPercentage ?? 18,
        }
      });
      if (commissionRate != null) {
        newConfig.ayurvedaSpecific[`${serviceType.replace('ayurveda_', '')}Rate`] = commissionRate;
      }
      await newConfig.save();
      return res.json({ success: true, message: 'Config created', data: newConfig });
    }

    // Update existing via versioned approach
    const updates = {
      effectiveFrom: new Date(),
      changeReason: reason.trim(),
      updatedBy: req.user?.id || 'admin',
    };
    if (gstPercentage != null) updates['ayurvedaSpecific.gstPercentage'] = gstPercentage;
    if (platformFeeKey && platformFeeValue != null) {
      updates[`ayurvedaSpecific.platformFees.${platformFeeKey}`] = platformFeeValue;
    }
    if (commissionRate != null) {
      updates.percentageRate = commissionRate;
    }

    const updated = await CommissionConfig.createNewVersion(existing.configId, updates, req.user?.id);

    res.json({
      success: true,
      message: `Config updated (version ${updated.version})`,
      data: updated,
    });
  } catch (error) {
    console.error('[fee-config.update]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
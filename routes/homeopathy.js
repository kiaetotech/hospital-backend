const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const HomeopathyDoctor = require('../models/HomeopathyDoctor');
const NaturopathyCenter = require('../models/NaturopathyCenter');
const Pharmacy = require('../models/Pharmacy');
const Booking = require('../models/Booking');
const CorporateEmployee = require('../models/CorporateEmployee');
const CorporateHR = require('../models/CorporateHR');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital_platform_secret_key_2024';

// ============================================
// AUTHENTICATE HR MIDDLEWARE (ADDED)
// ============================================

const authenticateHR = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized. No token provided.' });
    }

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

// GET /api/homeopathy/doctors - Search doctors
router.get('/doctors', async (req, res) => {
  try {
    const { city, specialization, minRating, maxFee, mode } = req.query;
    const query = { isActive: true, verificationStatus: 'approved' };
    if (city) query['address.city'] = city;
    if (specialization) query.specialization = specialization;
    if (minRating) query.rating = { $gte: parseFloat(minRating) };
    if (maxFee) query.consultationFee = { $lte: parseInt(maxFee) };
    if (mode === 'online') query['consultationTypes.online'] = true;
    if (mode === 'clinic') query['consultationTypes.clinic'] = true;

    const doctors = await HomeopathyDoctor.find(query).select('-password').sort({ rating: -1 });
    res.json({ success: true, data: doctors, count: doctors.length });
  } catch (error) {
    res.json({ success: true, data: [], count: 0 });
  }
});

// GET /api/homeopathy/doctors/:id
router.get('/doctors/:id', async (req, res) => {
  try {
    const doctor = await HomeopathyDoctor.findById(req.params.id).select('-password');
    if (!doctor) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/homeopathy/doctor/register
router.post('/doctor/register', async (req, res) => {
  try {
    const { name, phone, email, password, specialization, experience, education, registrationNumber, registrationCouncil, consultationFee, city, state, clinicName, about, languages } = req.body;
    
    const existing = await HomeopathyDoctor.findOne({ $or: [{ phone }, { registrationNumber }] });
    if (existing) return res.status(400).json({ success: false, error: 'Phone or registration number already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const doctor = new HomeopathyDoctor({
      name, phone, email, password: hashedPassword, specialization,
      experience: parseInt(experience), education, registrationNumber, registrationCouncil,
      consultationFee: parseInt(consultationFee), clinicName, about,
      languages: languages || [],
      address: { city, state },
      verificationStatus: 'pending'
    });
    await doctor.save();
    res.status(201).json({ success: true, message: 'Registration submitted for verification', doctorId: doctor._id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/homeopathy/doctor/login
router.post('/doctor/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const doctor = await HomeopathyDoctor.findOne({ phone });
    if (!doctor) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, doctor.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    if (doctor.verificationStatus !== 'approved') return res.status(403).json({ success: false, error: 'Account not approved' });
    const token = jwt.sign({ id: doctor._id, role: 'homeopathy_doctor' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, doctor: { id: doctor._id, name: doctor.name, specialization: doctor.specialization } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/homeopathy/doctor/dashboard/:id
router.get('/doctor/dashboard/:id', async (req, res) => {
  try {
    const doctor = await HomeopathyDoctor.findById(req.params.id).select('-password');
    const bookings = await Booking.find({ bookingType: 'homeopathy_consult', paymentStatus: 'paid' }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, doctor, bookings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/homeopathy/centers
router.get('/centers', async (req, res) => {
  try {
    const centers = await NaturopathyCenter.find({ isActive: true, verificationStatus: 'approved' }).select('-password');
    res.json({ success: true, data: centers });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

// POST /api/homeopathy/center/register
router.post('/center/register', async (req, res) => {
  try {
    const { name, phone, email, password, type, description, city, state, facilities } = req.body;
    const existing = await NaturopathyCenter.findOne({ phone });
    if (existing) return res.status(400).json({ success: false, error: 'Phone already registered' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const center = new NaturopathyCenter({
      name, phone, email, password: hashedPassword, type, description,
      address: { city, state }, facilities: facilities || [], verificationStatus: 'pending'
    });
    await center.save();
    res.status(201).json({ success: true, message: 'Registration submitted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/homeopathy/pharmacy/register
router.post('/pharmacy/register', async (req, res) => {
  try {
    const { businessName, phone, email, password, drugLicenseNumber, gstNumber, city, state, pincodesServed, ownerName } = req.body;
    const existing = await Pharmacy.findOne({ $or: [{ phone }, { drugLicenseNumber }] });
    if (existing) return res.status(400).json({ success: false, error: 'Phone or license already registered' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const pharmacy = new Pharmacy({
      businessName, phone, email, password: hashedPassword,
      drugLicenseNumber, gstNumber, ownerName,
      address: { city, state }, pincodesServed: pincodesServed || [],
      verificationStatus: 'pending'
    });
    await pharmacy.save();
    res.status(201).json({ success: true, message: 'Pharmacy registration submitted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/homeopathy/pharmacy/medicines
router.get('/pharmacy/medicines', async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({ isActive: true, verificationStatus: 'approved' }).select('businessName address medicines');
    let allMedicines = [];
    pharmacies.forEach(p => {
      p.medicines.forEach(m => {
        allMedicines.push({ ...m.toObject(), pharmacyName: p.businessName, pharmacyId: p._id });
      });
    });
    res.json({ success: true, data: allMedicines });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

// POST /api/homeopathy/review
router.post('/review', async (req, res) => {
  try {
    const { doctorId, bookingId, rating, review, patientName } = req.body;
    const doctor = await HomeopathyDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    doctor.reviews.push({ patient: bookingId, patientName, rating, review });
    const total = doctor.reviews.reduce((sum, r) => sum + r.rating, 0);
    doctor.rating = (total / doctor.reviews.length).toFixed(1);
    doctor.totalReviews = doctor.reviews.length;
    await doctor.save();
    res.json({ success: true, message: 'Review submitted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/homeopathy/admin/pending-doctors
router.get('/admin/pending-doctors', async (req, res) => {
  try {
    const doctors = await HomeopathyDoctor.find({ verificationStatus: 'pending' }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: doctors });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/homeopathy/admin/verify-doctor/:id
router.put('/admin/verify-doctor/:id', async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const doctor = await HomeopathyDoctor.findByIdAndUpdate(req.params.id, {
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

// GET /api/homeopathy/admin/pending-centers
router.get('/admin/pending-centers', async (req, res) => {
  try {
    const centers = await NaturopathyCenter.find({ verificationStatus: 'pending' }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: centers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/homeopathy/admin/verify-center/:id
router.put('/admin/verify-center/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await NaturopathyCenter.findByIdAndUpdate(req.params.id, { verificationStatus: status, isActive: status === 'approved', verifiedAt: new Date() });
    res.json({ success: true, message: `Center ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/homeopathy/admin/pending-pharmacies
router.get('/admin/pending-pharmacies', async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({ verificationStatus: 'pending' }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: pharmacies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/homeopathy/admin/verify-pharmacy/:id
router.put('/admin/verify-pharmacy/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await Pharmacy.findByIdAndUpdate(req.params.id, { verificationStatus: status, isActive: status === 'approved', verifiedAt: new Date() });
    res.json({ success: true, message: `Pharmacy ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/homeopathy/admin/bulk-upload
router.post('/admin/bulk-upload', async (req, res) => {
  try {
    const { type, data } = req.body;
    if (type === 'doctors') {
      for (const item of data) {
        const hashedPassword = await bcrypt.hash(item.phone || '123456', 10);
        await HomeopathyDoctor.findOneAndUpdate(
          { registrationNumber: item.registrationNumber },
          { ...item, password: hashedPassword, verificationStatus: 'approved', isActive: true },
          { upsert: true, new: true }
        );
      }
    } else if (type === 'medicines') {
      for (const item of data) {
        await Pharmacy.findOneAndUpdate(
          { drugLicenseNumber: item.drugLicenseNumber },
          { $push: { medicines: item } },
          { upsert: true }
        );
      }
    }
    res.json({ success: true, message: `${data.length} records uploaded` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 🆕 CORPORATE WELLNESS ROUTES (ADDED)
// ============================================

/**
 * GET /api/homeopathy/corporate/wellness
 * Get corporate wellness packages from Homeopathy doctors
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
    const doctors = await HomeopathyDoctor.find(query)
      .select('name rating address city specialization corporateWellnessPackages corporateDiscount minEmployees')
      .sort(sort === 'rating' ? { rating: -1 } : { name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await HomeopathyDoctor.countDocuments(query);

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
 * GET /api/homeopathy/corporate/wellness/:id
 * Get single corporate wellness package details
 */
router.get('/corporate/wellness/:id', async (req, res) => {
  try {
    const doctor = await HomeopathyDoctor.findOne({
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
 * GET /api/homeopathy/corporate/doctors
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
    const doctors = await HomeopathyDoctor.find(query)
      .select('name rating address city specialization corporateWellnessPackages corporateDiscount minEmployees experience')
      .sort({ rating: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await HomeopathyDoctor.countDocuments(query);

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
 * POST /api/homeopathy/corporate/book
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

    const doctor = await HomeopathyDoctor.findById(doctorId);
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
 * GET /api/homeopathy/corporate/workshops
 * Get corporate workshops from Homeopathy doctors
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
    const doctors = await HomeopathyDoctor.find(query)
      .select('name rating address city corporateWorkshops corporateDiscount')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await HomeopathyDoctor.countDocuments(query);

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
// 🆕 REMEDY MATCHER AI
// ============================================

const aiService = require('../services/aiService');

// POST /api/homeopathy/remedy-match
router.post('/remedy-match', async (req, res) => {
  try {
    const { symptoms } = req.body;
    if (!symptoms || symptoms.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Please describe your symptoms' });
    }

    // Use Groq AI to match symptoms to remedies
    const prompt = `You are a homeopathic remedy finder. Based on symptoms, suggest remedies.

Patient symptoms: "${symptoms}"

Return ONLY valid JSON:
{
  "remedies": [
    { "name": "Remedy Name", "potency": "30C or 200C", "confidence": "High/Medium", "reason": "Why this remedy matches" }
  ],
  "disclaimer": "IMPORTANT: This is AI-assisted suggestion only. Consult a qualified homeopathic doctor before taking any remedy. Remedies should be taken under professional supervision.",
  "recommendedAction": "Consult a homeopathic doctor for proper case analysis"
}

Suggest 2-4 remedies maximum. Include common Indian homeopathic remedies.`;

    // Try AI first
    let result = null;
    try {
      if (process.env.GROQ_API_KEY) {
        result = await aiService.callGroq(prompt);
      }
      if (!result && process.env.GEMINI_API_KEY) {
        result = await aiService.callGemini(prompt);
      }
    } catch (err) {
      console.log('AI failed, using rule-based');
    }

    // Fallback rule-based
    if (!result || !result.remedies) {
      const s = symptoms.toLowerCase();
      const remedyMap = [
        { keywords: ['headache', 'migraine', 'head pain'], remedies: [{ name: 'Belladonna', potency: '30C', reason: 'Throbbing headache' }, { name: 'Nux Vomica', potency: '200C', reason: 'Stress headache' }] },
        { keywords: ['fever', 'temperature', 'chills'], remedies: [{ name: 'Aconite', potency: '30C', reason: 'Sudden fever' }, { name: 'Bryonia', potency: '200C', reason: 'Dry fever with body ache' }] },
        { keywords: ['cough', 'cold', 'throat'], remedies: [{ name: 'Hepar Sulph', potency: '30C', reason: 'Sore throat' }, { name: 'Spongia', potency: '30C', reason: 'Dry cough' }] },
        { keywords: ['stomach', 'acidity', 'gas'], remedies: [{ name: 'Nux Vomica', potency: '30C', reason: 'Acidity from overeating' }, { name: 'Carbo Veg', potency: '30C', reason: 'Gas and bloating' }] },
        { keywords: ['skin', 'rash', 'itching'], remedies: [{ name: 'Apis Mellifica', potency: '30C', reason: 'Red swollen rash' }, { name: 'Sulphur', potency: '200C', reason: 'Itching worse with heat' }] },
        { keywords: ['anxiety', 'stress', 'sleep'], remedies: [{ name: 'Ignatia', potency: '200C', reason: 'Emotional stress' }, { name: 'Coffea', potency: '30C', reason: 'Sleeplessness' }] },
        { keywords: ['joint', 'pain', 'arthritis'], remedies: [{ name: 'Rhus Tox', potency: '30C', reason: 'Joint pain better with movement' }, { name: 'Bryonia', potency: '200C', reason: 'Joint pain worse with movement' }] },
        { keywords: ['allergy', 'sneeze', 'dust'], remedies: [{ name: 'Allium Cepa', potency: '30C', reason: 'Runny nose' }, { name: 'Sabadilla', potency: '30C', reason: 'Sneezing fits' }] },
      ];

      let matchedRemedies = [];
      for (const map of remedyMap) {
        if (map.keywords.some(k => s.includes(k))) {
          matchedRemedies.push(...map.remedies);
          if (matchedRemedies.length >= 4) break;
        }
      }

      result = {
        remedies: matchedRemedies.length > 0 ? matchedRemedies : [{ name: 'Nux Vomica', potency: '30C', reason: 'General remedy - consult doctor' }, { name: 'Arnica', potency: '30C', reason: 'General wellness' }],
        disclaimer: 'AI-assisted suggestion. Consult a qualified homeopathic doctor before taking any remedy.',
        recommendedAction: 'Book a consultation with a homeopathic doctor for proper case analysis'
      };
    }

    // Find related doctors
    const doctors = await HomeopathyDoctor.find({ isActive: true, verificationStatus: 'approved' })
      .select('name specialization consultationFee rating address.city')
      .limit(4).lean();

    res.json({
      success: true,
      data: {
        symptoms,
        ...result,
        availableDoctors: doctors,
        doctorsCount: doctors.length
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
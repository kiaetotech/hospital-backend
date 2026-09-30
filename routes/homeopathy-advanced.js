// D:\hospital backend\routes\homeopathy-advanced.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const HomeopathyDoctor = require('../models/HomeopathyDoctor');
const NaturopathyCenter = require('../models/NaturopathyCenter');
const Pharmacy = require('../models/Pharmacy');
const CommissionConfig = require('../models/CommissionConfig');
const Discount = require('../models/Discount');
const CorporateEmployee = require('../models/CorporateEmployee');
const CorporateHR = require('../models/CorporateHR');

const JWT_SECRET = process.env.JWT_SECRET;

// ============================================
// MIDDLEWARE
// ============================================
const requireAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && adminKey === process.env.ADMIN_KEY) return next();

  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin') return next();
    } catch (e) {}
  }
  return res.status(401).json({ success: false, message: 'Admin authentication required' });
};

const authenticateHR = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized. No token provided.' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hr = await CorporateHR.findById(decoded.id);
    if (!hr) return res.status(401).json({ success: false, message: 'HR not found' });
    if (!hr.isActive) return res.status(403).json({ success: false, message: 'Account suspended' });

    req.hr = hr;
    req.companyId = hr.companyId;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ============================================
// DOCTORS
// ============================================
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

router.get('/doctors/featured', async (req, res) => {
  try {
    const doctors = await HomeopathyDoctor.find({
      isActive: true,
      verificationStatus: 'approved',
      rating: { $gte: 4.5 }
    })
      .select('name specialization experience rating consultationFee languages address.city clinicName consultationTypes')
      .sort({ rating: -1 })
      .limit(6);
    res.json({ success: true, data: doctors });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

router.get('/doctors/available-now', async (req, res) => {
  try {
    const { consultationType = 'video' } = req.query;
    const doctors = await HomeopathyDoctor.findAvailableNow(consultationType);
    res.json({ success: true, data: doctors, count: doctors.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/doctors/:id', async (req, res) => {
  try {
    const doctor = await HomeopathyDoctor.findById(req.params.id).select('-password');
    if (!doctor) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Doctor availability / status
router.get('/doctor/:id/availability', async (req, res) => {
  try {
    const doctor = await HomeopathyDoctor.findById(req.params.id);
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

router.put('/doctor/availability', async (req, res) => {
  try {
    const { doctorId, availability } = req.body;
    if (!doctorId || !availability) {
      return res.status(400).json({ success: false, error: 'Doctor ID and availability are required' });
    }

    const doctor = await HomeopathyDoctor.findById(doctorId);
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

router.get('/doctor/:id/slots', async (req, res) => {
  try {
    const { date } = req.query;
    const doctor = await HomeopathyDoctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    if (!date) return res.status(400).json({ success: false, error: 'Date is required' });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[new Date(date).getDay()];

    const dayAvailability = doctor.availability?.find(a => a.day === dayName);
    if (!dayAvailability) {
      return res.json({ success: true, data: { available: false, slots: [] } });
    }

    const HomeopathyBooking = require('../models/HomeopathyBooking');
    const existingBookings = await HomeopathyBooking.find({
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
      maxBookings: slot.maxBookings || 1,
      currentBookings: bookedSlots.filter(t => t === slot.startTime).length,
      available: bookedSlots.filter(t => t === slot.startTime).length < (slot.maxBookings || 1)
    }));

    res.json({
      success: true,
      data: { day: dayName, available: slots.some(s => s.available), slots }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/doctor/toggle-availability-status', async (req, res) => {
  try {
    const { doctorId, status, consultationMode } = req.body;
    if (!doctorId || !status) {
      return res.status(400).json({ success: false, error: 'Doctor ID and status required' });
    }

    const doctor = await HomeopathyDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });

    await doctor.setAvailabilityStatus(status, consultationMode);

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

router.get('/doctor/:id/status', async (req, res) => {
  try {
    const doctor = await HomeopathyDoctor.findById(req.params.id);
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

// Doctor registration/login
router.post('/doctor/register', async (req, res) => {
  try {
    const {
      name, phone, email, password, specialization, experience, education,
      registrationNumber, registrationCouncil, consultationFee, city, state,
      clinicName, about, languages
    } = req.body;

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

// ============================================
// CENTERS
// ============================================
router.get('/centers', async (req, res) => {
  try {
    const centers = await NaturopathyCenter.find({
      isActive: true,
      verificationStatus: 'approved'
    })
      .select('-password -documents -bankDetails')
      .lean();

    const centersWithApprovedPackages = centers
      .map(c => {
        const approvedPackages = (c.packages || []).filter(
          p => p.isActive !== false && p.approvalStatus === 'approved' && !p.deleted
        );
        return { ...c, packages: approvedPackages };
      })
      .filter(c => c.packages.length > 0);

    res.json({ success: true, data: centersWithApprovedPackages });
  } catch (error) {
    console.error('Error fetching centers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch centers', data: [] });
  }
});

router.get('/centers/:id', async (req, res) => {
  try {
    const center = await NaturopathyCenter.findById(req.params.id)
      .select('-password -documents -bankDetails')
      .lean();

    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });

    center.packages = (center.packages || []).filter(
      p => p.isActive !== false && p.approvalStatus === 'approved' && !p.deleted
    );

    center.reviews = (center.reviews || [])
      .filter(r => r.adminApproved !== false)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    res.json({ success: true, data: center });
  } catch (error) {
    console.error('Center detail error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/center/register', async (req, res) => {
  try {
    const { name, phone, email, password, type, description, city, state, facilities } = req.body;
    const existing = await NaturopathyCenter.findOne({ phone });
    if (existing) return res.status(400).json({ success: false, error: 'Phone already registered' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const center = new NaturopathyCenter({
      name, phone, email, password: hashedPassword, type, description,
      address: { city, state }, facilities: facilities || [],
      verificationStatus: 'pending'
    });
    await center.save();
    res.status(201).json({ success: true, message: 'Registration submitted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PHARMACIES
// ============================================
router.get('/pharmacies', async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({
      isActive: true,
      verificationStatus: 'approved'
    }).select('-password -documents -bankDetails');

    res.json({ success: true, data: pharmacies });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

router.get('/pharmacy/medicines', async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({
      isActive: true,
      verificationStatus: 'approved'
    }).select('businessName address medicines');

    let allMedicines = [];
    pharmacies.forEach(p => {
      (p.medicines || []).forEach(m => {
        allMedicines.push({
          ...m.toObject(),
          pharmacyName: p.businessName,
          pharmacyId: p._id,
          pharmacyCity: p.address?.city
        });
      });
    });
    res.json({ success: true, data: allMedicines });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

router.post('/pharmacy/register', async (req, res) => {
  try {
    const {
      businessName, phone, email, password, drugLicenseNumber, gstNumber,
      city, state, pincodesServed, ownerName
    } = req.body;

    const existing = await Pharmacy.findOne({ $or: [{ phone }, { drugLicenseNumber }] });
    if (existing) return res.status(400).json({ success: false, error: 'Phone or license already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const pharmacy = new Pharmacy({
      businessName, phone, email, password: hashedPassword,
      drugLicenseNumber, gstNumber, ownerName,
      address: { city, state },
      pincodesServed: pincodesServed || [],
      verificationStatus: 'pending'
    });
    await pharmacy.save();
    res.status(201).json({ success: true, message: 'Pharmacy registration submitted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CORPORATE WELLNESS (preserved)
// ============================================
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
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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
    res.status(500).json({ success: false, message: error.message });
  }
});

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
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

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
    res.status(500).json({ success: false, message: error.message });
  }
});

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
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// REVIEWS (public — per provider)
// ============================================
router.get('/doctor/:id/reviews', async (req, res) => {
  try {
    const doctor = await HomeopathyDoctor.findById(req.params.id)
      .select('reviews rating totalReviews name');
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });

    const reviews = (doctor.reviews || [])
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50);

    res.json({
      success: true,
      data: reviews,
      averageRating: doctor.rating,
      totalReviews: doctor.totalReviews
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN: VERIFICATION (doctors, centers, pharmacies)
// ============================================
router.get('/admin/pending-doctors', requireAdmin, async (req, res) => {
  try {
    const doctors = await HomeopathyDoctor.find({ verificationStatus: 'pending' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: doctors });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/admin/verify-doctor/:id', requireAdmin, async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const doctor = await HomeopathyDoctor.findByIdAndUpdate(req.params.id, {
      verificationStatus: status,
      isActive: status === 'approved',
      verifiedKyc: status === 'approved',
      verifiedAt: new Date(),
      rejectionReason: status === 'rejected' ? rejectionReason : null
    }, { new: true });
    res.json({ success: true, message: `Doctor ${status}`, data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/admin/pending-centers', requireAdmin, async (req, res) => {
  try {
    const centers = await NaturopathyCenter.find({ verificationStatus: 'pending' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: centers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/admin/verify-center/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await NaturopathyCenter.findByIdAndUpdate(req.params.id, {
      verificationStatus: status,
      isActive: status === 'approved',
      verifiedAt: new Date()
    });
    res.json({ success: true, message: `Center ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/admin/pending-pharmacies', requireAdmin, async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({ verificationStatus: 'pending' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: pharmacies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/admin/verify-pharmacy/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await Pharmacy.findByIdAndUpdate(req.params.id, {
      verificationStatus: status,
      isActive: status === 'approved',
      verifiedAt: new Date()
    });
    res.json({ success: true, message: `Pharmacy ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin/bulk-upload', requireAdmin, async (req, res) => {
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
// ADMIN: FEE CONFIG (CommissionConfig)
// ============================================
router.get('/admin/fee-config', requireAdmin, async (req, res) => {
  try {
    const serviceTypes = [
      'homeopathy_consultation',
      'homeopathy_medicine',
      'naturopathy_center'
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
      message: anyMissing ? 'Some service types are not configured' : 'OK'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/admin/fee-config', requireAdmin, async (req, res) => {
  try {
    const {
      serviceType, platformFeeKey, platformFeeValue,
      gstPercentage, commissionRate, reason
    } = req.body;

    if (!serviceType || !reason || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'serviceType and reason (min 5 chars) are required'
      });
    }

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
          platformFees: { [platformFeeKey]: platformFeeValue ?? 0 },
          gstPercentage: gstPercentage ?? 18
        }
      });
      await newConfig.save();
      return res.json({ success: true, message: 'Config created', data: newConfig });
    }

    const updates = {
      effectiveFrom: new Date(),
      changeReason: reason.trim(),
      updatedBy: req.user?.id || 'admin'
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
      data: updated
    });
  } catch (error) {
    console.error('[homeopathy.fee-config.update]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ONE-TIME SEED
router.post('/admin/fee-config/seed', requireAdmin, async (req, res) => {
  const seeds = [
    {
      serviceType: 'homeopathy_consultation',
      platformFees: { consultation: 30 },
      gst: 18,
      rate: 20
    },
    {
      serviceType: 'homeopathy_medicine',
      platformFees: { medicine: 20 },
      gst: 12,
      rate: 15
    },
    {
      serviceType: 'naturopathy_center',
      platformFees: { centerVisit: 100 },
      gst: 18,
      rate: 20
    }
  ];

  const results = [];
  for (const s of seeds) {
    try {
      const existing = await CommissionConfig.getActiveConfig(s.serviceType);
      if (existing) {
        results.push({ serviceType: s.serviceType, status: 'exists' });
        continue;
      }
      const config = new CommissionConfig({
        configId: `COMM_${s.serviceType.toUpperCase()}_${Date.now()}`,
        configName: s.serviceType,
        serviceType: s.serviceType,
        commissionType: 'percentage',
        percentageRate: s.rate,
        effectiveFrom: new Date(),
        isActive: true,
        isDefault: true,
        createdBy: 'seed',
        updatedBy: 'seed',
        changeReason: 'Initial seed',
        ayurvedaSpecific: {
          platformFees: s.platformFees,
          gstPercentage: s.gst
        }
      });
      await config.save();
      results.push({ serviceType: s.serviceType, status: 'created' });
    } catch (e) {
      results.push({ serviceType: s.serviceType, status: 'error', error: e.message });
    }
  }

  res.json({ success: true, message: `Seeded ${results.length} configs`, results });
});

// ============================================
// ADMIN: COMMISSION RULES (overrides)
// ============================================
router.get('/admin/commission-rules', requireAdmin, async (req, res) => {
  try {
    const { scopeType, serviceType, search } = req.query;
    const query = {};
    if (scopeType) query.scopeType = scopeType;
    if (serviceType) query.serviceType = serviceType;
    if (search) {
      query.$or = [
        { scopeValue: { $regex: search, $options: 'i' } },
        { configName: { $regex: search, $options: 'i' } }
      ];
    }
    query.serviceType = query.serviceType || {
      $in: ['homeopathy_consultation', 'homeopathy_medicine', 'naturopathy_center']
    };

    const rules = await CommissionConfig.find(query)
      .sort({ priority: -1, effectiveFrom: -1 })
      .lean();
    res.json({ success: true, count: rules.length, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin/commission-rules', requireAdmin, async (req, res) => {
  try {
    const {
      scopeType, scopeValue, scopeState, serviceType,
      commissionType, percentageRate, fixedAmount,
      hybridConfig, priority, effectiveFrom, effectiveUntil,
      changeReason, configName, ayurvedaSpecific
    } = req.body;

    if (!scopeType || !serviceType) {
      return res.status(400).json({ success: false, error: 'scopeType and serviceType required' });
    }
    if (scopeType !== 'global' && !scopeValue) {
      return res.status(400).json({ success: false, error: 'scopeValue required for non-global scope' });
    }
    if (commissionType === 'percentage' && (percentageRate == null || percentageRate < 0 || percentageRate > 50)) {
      return res.status(400).json({ success: false, error: 'percentageRate must be 0-50' });
    }
    if (commissionType === 'fixed' && (fixedAmount == null || fixedAmount < 0)) {
      return res.status(400).json({ success: false, error: 'fixedAmount must be >= 0' });
    }

    const defaultPriority = scopeType === 'provider' ? 100
      : scopeType === 'city' ? 50
      : scopeType === 'state' ? 30
      : 0;

    const config = new CommissionConfig({
      configId: `COMM_${serviceType.toUpperCase()}_${scopeType.toUpperCase()}_${Date.now()}`,
      configName: configName || `${serviceType} — ${scopeType}:${scopeValue || 'all'}`,
      scopeType,
      scopeValue: scopeValue || null,
      scopeState: scopeState || null,
      providerSpecific: scopeType === 'provider',
      providerId: scopeType === 'provider' ? scopeValue : undefined,
      providerType: scopeType === 'provider' ? req.body.providerModel : undefined,
      serviceType,
      commissionType: commissionType || 'percentage',
      percentageRate: percentageRate ?? 20,
      fixedAmount: fixedAmount ?? 0,
      hybridConfig: hybridConfig || undefined,
      priority: priority ?? defaultPriority,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
      isActive: true,
      changeReason: changeReason || 'Admin created override',
      createdBy: 'admin',
      updatedBy: 'admin',
      ayurvedaSpecific: ayurvedaSpecific || undefined
    });

    await config.save();
    res.status(201).json({ success: true, message: 'Rule created', data: config });
  } catch (error) {
    console.error('[homeopathy.commission-rules.create]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/admin/commission-rules/:id', requireAdmin, async (req, res) => {
  try {
    const rule = await CommissionConfig.findById(req.params.id);
    if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });

    const updates = req.body;
    const tracked = ['percentageRate', 'fixedAmount', 'priority', 'effectiveUntil', 'isActive'];
    const log = [];
    tracked.forEach(f => {
      if (updates[f] !== undefined && updates[f] !== rule[f]) {
        log.push({
          changedBy: 'admin',
          field: f,
          oldValue: rule[f],
          newValue: updates[f],
          reason: updates.changeReason || 'Admin update'
        });
        rule[f] = updates[f];
      }
    });
    if (log.length === 0) {
      return res.status(400).json({ success: false, error: 'No changes detected' });
    }
    rule.auditLog = rule.auditLog || [];
    rule.auditLog.push(...log);
    rule.version = (rule.version || 0) + 1;
    rule.updatedAt = new Date();
    rule.updatedBy = 'admin';
    await rule.save();
    res.json({ success: true, message: `Updated (v${rule.version})`, data: rule, changes: log.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/admin/commission-rules/:id', requireAdmin, async (req, res) => {
  try {
    const rule = await CommissionConfig.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
    res.json({ success: true, message: 'Rule deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin/commission-resolve', requireAdmin, async (req, res) => {
  try {
    const { serviceType, providerId, city, state } = req.body;
    if (!serviceType) return res.status(400).json({ success: false, error: 'serviceType required' });
    const config = await CommissionConfig.resolve({ serviceType, providerId, city, state });
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN: DISCOUNTS
// ============================================
router.post('/discounts', requireAdmin, async (req, res) => {
  try {
    const {
      code, discountType, value, maxDiscount,
      validFrom, validTill, applicableTags
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

    const tags = Array.isArray(applicableTags) && applicableTags.length > 0
      ? applicableTags
      : ['homeopathy_all'];

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

    res.status(201).json({ success: true, message: 'Discount created', data: discount });
  } catch (error) {
    console.error('[homeopathy.discounts.create]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/discounts/:id', requireAdmin, async (req, res) => {
  try {
    const discount = await Discount.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: req.body.isActive, updatedAt: new Date() } },
      { new: true }
    );
    if (!discount) return res.status(404).json({ success: false, message: 'Discount not found' });
    res.json({ success: true, message: 'Discount updated', data: discount });
  } catch (error) {
    console.error('[homeopathy.discounts.update]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/discounts/:id/full', requireAdmin, async (req, res) => {
  try {
    const {
      value, maxDiscount, validFrom, validTill,
      applicableTags, isActive
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
    if (!discount) return res.status(404).json({ success: false, message: 'Discount not found' });
    res.json({ success: true, message: 'Discount updated', data: discount });
  } catch (error) {
    console.error('[homeopathy.discounts.fullUpdate]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/discounts/:id', requireAdmin, async (req, res) => {
  try {
    const discount = await Discount.findByIdAndDelete(req.params.id);
    if (!discount) return res.status(404).json({ success: false, message: 'Discount not found' });
    res.json({ success: true, message: 'Discount deleted' });
  } catch (error) {
    console.error('[homeopathy.discounts.delete]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});
// ============================================
// DOCTOR DASHBOARD (migrated from legacy homeopathy.js)
// ============================================
router.get('/doctor/dashboard/:id', async (req, res) => {
  try {
    const HomeopathyBooking = require('../models/HomeopathyBooking');
    const doctor = await HomeopathyDoctor.findById(req.params.id).select('-password');

    // Try new model first; fall back to generic Booking for migration period
    let bookings = await HomeopathyBooking.find({
      doctor: req.params.id,
      paymentStatus: 'paid'
    }).sort({ createdAt: -1 }).limit(20);

    if (!bookings.length) {
      const Booking = require('../models/Booking');
      bookings = await Booking.find({
        bookingType: 'homeopathy_consult',
        paymentStatus: 'paid'
      }).sort({ createdAt: -1 }).limit(20);
    }

    res.json({ success: true, doctor, bookings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// LEGACY REVIEW SUBMISSION (used by pre-migration frontend)
// ============================================
router.post('/review', async (req, res) => {
  try {
    const { doctorId, bookingId, rating, review, patientName } = req.body;
    const doctor = await HomeopathyDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });

    doctor.reviews.push({
      patient: bookingId,
      patientName,
      rating,
      review,
      bookingId: bookingId || '',
      verified: false
    });
    const total = doctor.reviews.reduce((sum, r) => sum + r.rating, 0);
    doctor.rating = (total / doctor.reviews.length).toFixed(1);
    doctor.totalReviews = doctor.reviews.length;
    await doctor.save();

    res.json({ success: true, message: 'Review submitted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN: OVERVIEW (single-call KPIs)
// ============================================
router.get('/admin/overview', requireAdmin, async (req, res) => {
  try {
    const HomeopathyBooking = require('../models/HomeopathyBooking');

    const [
      totalDoctors,
      pendingDoctors,
      totalCenters,
      pendingCenters,
      totalPharmacies,
      pendingPharmacies,
      bookingsAgg,
      revenueAgg,
      commissionAgg
    ] = await Promise.all([
      HomeopathyDoctor.countDocuments({ isActive: true, verificationStatus: 'approved' }),
      HomeopathyDoctor.countDocuments({ verificationStatus: 'pending' }),
      NaturopathyCenter.countDocuments({ isActive: true, verificationStatus: 'approved' }),
      NaturopathyCenter.countDocuments({ verificationStatus: 'pending' }),
      Pharmacy.countDocuments({ isActive: true, verificationStatus: 'approved' }),
      Pharmacy.countDocuments({ verificationStatus: 'pending' }),

      // Booking counts by status
      HomeopathyBooking.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // Revenue — only paid bookings
      HomeopathyBooking.aggregate([
        { $match: { paymentStatus: 'paid' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$finalAmount' },
            totalBookings: { $sum: 1 }
          }
        }
      ]),

      // Commission — only paid bookings
      HomeopathyBooking.aggregate([
        { $match: { paymentStatus: 'paid' } },
        {
          $group: {
            _id: null,
            totalCommission: { $sum: '$platformCommission' }
          }
        }
      ])
    ]);

    const statusCounts = {
      pending: 0,
      confirmed: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
      rescheduled: 0
    };
    bookingsAgg.forEach(s => {
      if (s._id in statusCounts) statusCounts[s._id] = s.count;
    });

    const totalBookings = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    const revenue = revenueAgg[0]?.totalRevenue || 0;
    const commission = commissionAgg[0]?.totalCommission || 0;

    res.json({
      success: true,
      data: {
        providers: {
          doctors: { total: totalDoctors, pending: pendingDoctors },
          centers: { total: totalCenters, pending: pendingCenters },
          pharmacies: { total: totalPharmacies, pending: pendingPharmacies },
          totalPendingApprovals: pendingDoctors + pendingCenters + pendingPharmacies
        },
        bookings: {
          total: totalBookings,
          ...statusCounts
        },
        finance: {
          revenue,
          commission,
          providerEarnings: revenue - commission
        }
      }
    });
  } catch (error) {
    console.error('[homeopathy.admin.overview]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN: REVENUE TREND (last N days)
// ============================================
router.get('/admin/revenue-trend', requireAdmin, async (req, res) => {
  try {
    const HomeopathyBooking = require('../models/HomeopathyBooking');

    const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 90);
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    from.setHours(0, 0, 0, 0);

    const trend = await HomeopathyBooking.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          paidAt: { $gte: from }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$paidAt',
              timezone: 'Asia/Kolkata'
            }
          },
          revenue: { $sum: '$finalAmount' },
          commission: { $sum: '$platformCommission' },
          bookings: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill missing days with zeros so the chart is continuous
    const byDate = {};
    trend.forEach(t => { byDate[t._id] = t; });

    const series = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      const row = byDate[key] || { revenue: 0, commission: 0, bookings: 0 };
      series.push({
        date: key,
        revenue: row.revenue || 0,
        commission: row.commission || 0,
        bookings: row.bookings || 0
      });
    }

    const totals = series.reduce(
      (acc, d) => ({
        revenue: acc.revenue + d.revenue,
        commission: acc.commission + d.commission,
        bookings: acc.bookings + d.bookings
      }),
      { revenue: 0, commission: 0, bookings: 0 }
    );

    res.json({ success: true, data: series, totals, days });
  } catch (error) {
    console.error('[homeopathy.admin.revenue-trend]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ALIASES — match frontend URLs
// ============================================

// Frontend NaturopathyCenters.jsx calls /homeopathy/naturopathy
router.get('/naturopathy', async (req, res) => {
  try {
    const centers = await NaturopathyCenter.find({
      isActive: true,
      verificationStatus: 'approved'
    })
      .select('-password -documents -bankDetails')
      .lean();

    const centersWithApprovedPackages = centers
      .map(c => {
        const approvedPackages = (c.packages || []).filter(
          p => p.isActive !== false && p.approvalStatus === 'approved' && !p.deleted
        );
        return { ...c, packages: approvedPackages };
      })
      .filter(c => c.packages.length > 0);

    res.json({ success: true, data: centersWithApprovedPackages });
  } catch (error) {
    console.error('[homeopathy.naturopathy.alias]', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch centers', data: [] });
  }
});

// Frontend HomeopathyPharmacy.jsx calls /homeopathy/pharmacy
// Note: /homeopathy/pharmacy/register (POST) and /homeopathy/pharmacy/medicines (GET)
// already exist as more-specific routes and take precedence.
router.get('/pharmacy', async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({
      isActive: true,
      verificationStatus: 'approved'
    }).select('businessName address medicines');

    const allMedicines = [];
    pharmacies.forEach(p => {
      (p.medicines || []).forEach(m => {
        allMedicines.push({
          ...m.toObject(),
          pharmacyName: p.businessName,
          pharmacyId: p._id,
          pharmacyCity: p.address?.city
        });
      });
    });

    res.json({ success: true, data: allMedicines });
  } catch (error) {
    console.error('[homeopathy.pharmacy.alias]', error.message);
    res.json({ success: true, data: [] });
  }
});

// ============================================
// STUB — Remedy Matcher (not yet implemented)
// ============================================
router.post('/remedy-match', async (req, res) => {
  res.status(503).json({
    success: false,
    message: 'Remedy Matcher AI is coming soon.',
    code: 'NOT_IMPLEMENTED'
  });
});

// ============================================
// ONE-TIME: Tag existing discounts as Homeopathy-compatible
// ============================================
router.post('/admin/discounts/tag-homeopathy', requireAdmin, async (req, res) => {
  try {
    const Discount = require('../models/Discount');
    const { codes, all = false } = req.body;

    const filter = all
      ? {}
      : { code: { $in: (codes || []).map(c => String(c).toUpperCase()) } };

    const discounts = await Discount.find(filter);
    if (discounts.length === 0) {
      return res.json({ success: true, message: 'No matching discounts', updated: 0 });
    }

    let updated = 0;
    for (const d of discounts) {
      const tags = new Set(d.applicableTags || []);
      tags.add('homeopathy_all');
      d.applicableTags = Array.from(tags);
      await d.save();
      updated++;
    }

    res.json({
      success: true,
      message: `Tagged ${updated} discounts as homeopathy-compatible`,
      updated,
      codes: discounts.map(d => d.code)
    });
  } catch (error) {
    console.error('[homeopathy.discounts.tag]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN: Reset doctor password (test helper)
// ============================================
router.post('/admin/reset-doctor-password', requireAdmin, async (req, res) => {
  try {
    const { phone, newPassword } = req.body;
    if (!phone || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'phone and newPassword (min 6 chars) required' });
    }
    const bcrypt = require('bcryptjs');
    const doctor = await HomeopathyDoctor.findOne({ phone });
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });

    doctor.password = await bcrypt.hash(newPassword, 10);
    await doctor.save();

    res.json({ success: true, message: `Password reset for ${doctor.name}`, phone });
  } catch (error) {
    console.error('[admin.reset-doctor-password]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
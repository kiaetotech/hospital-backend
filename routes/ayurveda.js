const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AyurvedaDoctor = require('../models/AyurvedaDoctor');
const PanchakarmaCenter = require('../models/PanchakarmaCenter');
const AyurvedaBooking = require('../models/AyurvedaBooking');
const Discount = require('../models/Discount');

// ============================================
// DOCTOR REGISTRATION & ONBOARDING
// ============================================

// POST /api/ayurveda/doctor/register
router.post('/doctor/register', async (req, res) => {
  try {
    const { name, phone, email, password, specialization, experience, education, ayushRegNo, address, consultationFee, languages } = req.body;
    
    // Check existing
    const existing = await AyurvedaDoctor.findOne({ $or: [{ phone }, { ayushRegNo }] });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Doctor already registered with this phone or AYUSH number' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const doctor = new AyurvedaDoctor({
      name, phone, email,
      password: hashedPassword,
      specialization, experience, education,
      ayushRegNo,
      address,
      consultationFee,
      languages: languages || [],
      verificationStatus: 'pending',
      isActive: false
    });
    
    await doctor.save();
    
    res.status(201).json({ 
      success: true, 
      message: 'Registration submitted. Awaiting admin verification.',
      data: { doctorId: doctor._id }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/ayurveda/doctor/login
router.post('/doctor/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const doctor = await AyurvedaDoctor.findOne({ phone });
    
    if (!doctor) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, doctor.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    if (doctor.verificationStatus !== 'approved') {
      return res.status(403).json({ 
        success: false, 
        error: 'Account not approved yet',
        status: doctor.verificationStatus 
      });
    }
    
    const token = jwt.sign(
      { id: doctor._id, role: 'ayurveda_doctor' },
      process.env.JWT_SECRET || 'hospital_platform_secret_key_2024',
      { expiresIn: '30d' }
    );
    
    res.json({ success: true, token, doctor: { id: doctor._id, name: doctor.name, specialization: doctor.specialization } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN: VERIFY DOCTOR
// ============================================

// PUT /api/ayurveda/admin/verify-doctor/:id
router.put('/admin/verify-doctor/:id', async (req, res) => {
  try {
    const { status, rejectionReason } = req.body; // 'approved' or 'rejected'
    const adminId = req.headers['admin-id']; // Admin ID from middleware
    
    const doctor = await AyurvedaDoctor.findByIdAndUpdate(
      req.params.id,
      {
        verificationStatus: status,
        isActive: status === 'approved',
        verifiedBy: adminId,
        verifiedAt: new Date(),
        rejectionReason: status === 'rejected' ? rejectionReason : null
      },
      { new: true }
    );
    
    if (!doctor) {
      return res.status(404).json({ success: false, error: 'Doctor not found' });
    }
    
    res.json({ success: true, message: `Doctor ${status}`, data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ayurveda/admin/pending-doctors
router.get('/admin/pending-doctors', async (req, res) => {
  try {
    const doctors = await AyurvedaDoctor.find({ verificationStatus: 'pending' })
      .select('name phone specialization ayushRegNo address.city documents createdAt')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, count: doctors.length, data: doctors });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DOCTOR UPLOAD DOCUMENTS
// ============================================

// POST /api/ayurveda/doctor/upload-documents/:id
router.post('/doctor/upload-documents/:id', async (req, res) => {
  try {
    const { ayushCertificate, degreeCertificate, idProof, photo, clinicLicense } = req.body;
    
    const doctor = await AyurvedaDoctor.findByIdAndUpdate(
      req.params.id,
      {
        'documents.ayushCertificate': ayushCertificate,
        'documents.degreeCertificate': degreeCertificate,
        'documents.idProof': idProof,
        'documents.photo': photo,
        'documents.clinicLicense': clinicLicense,
        verificationStatus: 'documents_verified'
      },
      { new: true }
    );
    
    res.json({ success: true, message: 'Documents uploaded for verification', data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// BOOKING WITH DISCOUNT & COMMISSION
// ============================================

// POST /api/ayurveda/bookings
router.post('/bookings', async (req, res) => {
  try {
    const { doctorId, patient, bookingDate, slotTime, consultationType, symptoms, discountCode } = req.body;
    
    // Get doctor
    const doctor = await AyurvedaDoctor.findById(doctorId);
    if (!doctor || !doctor.isActive) {
      return res.status(400).json({ success: false, error: 'Doctor not available' });
    }
    
    let amount = doctor.consultationFee;
    let discountAmount = 0;
    let discount = null;
    
    // Apply discount if code provided
    if (discountCode) {
      discount = await Discount.findOne({ 
        code: discountCode.toUpperCase(), 
        isActive: true,
        validFrom: { $lte: new Date() },
        validTill: { $gte: new Date() }
      });
      
      if (discount) {
        if (discount.discountType === 'percentage') {
          discountAmount = Math.min(
            (amount * discount.value) / 100,
            discount.maxDiscount || Infinity
          );
        } else {
          discountAmount = discount.value;
        }
        
        // Update usage
        discount.usedCount += 1;
        if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
          discount.isActive = false;
        }
        await discount.save();
      }
    }
    
    const finalAmount = amount - discountAmount;
    const commissionRate = doctor.subscription.commissionRate.firstConsult / 100;
    const platformCommission = finalAmount * commissionRate;
    const providerEarning = finalAmount - platformCommission;
    
    const booking = new AyurvedaBooking({
      bookingId: 'AYB' + Date.now(),
      type: 'doctor_consultation',
      doctor: doctorId,
      consultationType,
      patient,
      bookingDate,
      slotTime,
      symptoms,
      amount,
      discount: discount ? {
        code: discountCode,
        percentage: discount.discountType === 'percentage' ? discount.value : null,
        amount: discountAmount
      } : null,
      finalAmount,
      platformCommission,
      providerEarning,
      paymentStatus: 'pending',
      status: 'pending'
    });
    
    await booking.save();
    
    // Update doctor stats
    doctor.stats.totalConsultations += 1;
    await doctor.save();
    
    res.status(201).json({
      success: true,
      data: {
        bookingId: booking.bookingId,
        amount: finalAmount,
        discount: discountAmount,
        originalAmount: amount,
        platformFee: platformCommission
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PATIENT RATING & REVIEW
// ============================================

// POST /api/ayurveda/review/:bookingId
router.post('/review/:bookingId', async (req, res) => {
  try {
    const { rating, comment } = req.body;
    
    const booking = await AyurvedaBooking.findOne({ bookingId: req.params.bookingId });
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    
    if (booking.reviewed) {
      return res.status(400).json({ success: false, error: 'Already reviewed' });
    }
    
    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Can only review completed bookings' });
    }
    
    // Update booking
    booking.reviewed = true;
    booking.review = { rating, comment, createdAt: new Date() };
    await booking.save();
    
    // Update doctor rating
    if (booking.doctor) {
      const doctor = await AyurvedaDoctor.findById(booking.doctor);
      const totalRating = doctor.rating * doctor.totalReviews;
      doctor.totalReviews += 1;
      doctor.rating = (totalRating + rating) / doctor.totalReviews;
      doctor.reviews.push({
        patient: booking._id,
        patientName: booking.patient.name,
        rating,
        review: comment,
        treatment: booking.consultationType,
        createdAt: new Date()
      });
      await doctor.save();
    }
    
    res.json({ success: true, message: 'Review submitted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DISCOUNT/COUPON MANAGEMENT
// ============================================

// POST /api/ayurveda/discounts (Admin creates platform-wide discount)
router.post('/discounts', async (req, res) => {
  try {
    const { code, discountType, value, maxDiscount, minOrderAmount, applicableFor, validFrom, validTill, newUsersOnly } = req.body;
    
    const discount = new Discount({
      code: code.toUpperCase(),
      type: 'platform',
      createdBy: { type: 'admin', id: req.body.adminId },
      discountType, value, maxDiscount, minOrderAmount,
      applicableFor: applicableFor || ['all'],
      validFrom, validTill,
      newUsersOnly: newUsersOnly || false
    });
    
    await discount.save();
    
    res.status(201).json({ success: true, data: discount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ayurveda/discounts/validate/:code
router.get('/discounts/validate/:code', async (req, res) => {
  try {
    const discount = await Discount.findOne({
      code: req.params.code.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validTill: { $gte: new Date() }
    });
    
    if (!discount) {
      return res.status(404).json({ success: false, error: 'Invalid or expired discount code' });
    }
    
    res.json({ success: true, data: discount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN DASHBOARD
// ============================================

// GET /api/ayurveda/admin/stats
router.get('/admin/stats', async (req, res) => {
  try {
    const [totalDoctors, pendingDoctors, totalCenters, totalBookings, totalRevenue] = await Promise.all([
      AyurvedaDoctor.countDocuments({ verificationStatus: 'approved' }),
      AyurvedaDoctor.countDocuments({ verificationStatus: 'pending' }),
      PanchakarmaCenter.countDocuments({ verificationStatus: 'approved' }),
      AyurvedaBooking.countDocuments(),
      AyurvedaBooking.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$platformCommission' } } }
      ])
    ]);
    
    res.json({
      success: true,
      data: {
        totalDoctors,
        pendingVerifications: pendingDoctors,
        totalCenters,
        totalBookings,
        totalCommissionEarned: totalRevenue[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const OnlineDoctor = require('../models/OnlineDoctor');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const Review = require('../models/Review');

// ============================================
// DOCTOR AUTH MIDDLEWARE
// ============================================
const authenticateDoctor = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied. Please login.' });
  
  jwt.verify(token, global.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    if (user.role !== 'doctor') return res.status(403).json({ error: 'Doctor access required.' });
    req.user = user;
    next();
  });
};

// ============================================
// HEALTH CHECK
// ============================================
router.get('/health', (req, res) => {
  res.json({
    success: true,
    module: 'Online Doctor',
    status: 'active',
    endpoints: {
      search: '/api/online-doctor/search',
      doctor: '/api/online-doctor/doctor/:id',
      book: '/api/online-doctor/book',
      register: '/api/online-doctor/doctor/register',
      login: '/api/online-doctor/doctor/login',
      dashboard: '/api/online-doctor/doctor/dashboard'
    }
  });
});

// ============================================
// PUBLIC ROUTES
// ============================================

// Search doctors
router.get('/search', async (req, res) => {
  try {
    const { 
      specialty, language, gender, minExperience, maxFee, 
      minRating, available, sort = 'rating', page = 1, limit = 10 
    } = req.query;
    
    const query = { isActive: true, verificationStatus: 'verified' };
    
    if (specialty) query.specialization = { $regex: specialty, $options: 'i' };
    if (language) query.languages = { $in: [language] };
    if (gender) query.gender = gender;
    if (minExperience) query.experience = { $gte: parseInt(minExperience) };
    if (maxFee) query.consultationFee = { $lte: parseInt(maxFee) };
    if (minRating) query['ratingSummary.averageRating'] = { $gte: parseFloat(minRating) };
    if (available === 'true') query.isAvailable = true;
    
    let sortQuery = {};
    switch(sort) {
      case 'fee_low': sortQuery = { consultationFee: 1 }; break;
      case 'fee_high': sortQuery = { consultationFee: -1 }; break;
      case 'experience': sortQuery = { experience: -1 }; break;
      case 'reviews': sortQuery = { 'ratingSummary.totalReviews': -1 }; break;
      default: sortQuery = { 'ratingSummary.averageRating': -1 };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [doctors, total] = await Promise.all([
      OnlineDoctor.find(query)
        .sort(sortQuery)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-password -documents -bankDetails')
        .lean(),
      OnlineDoctor.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: doctors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get doctor profile
router.get('/doctor/:id', async (req, res) => {
  try {
    const doctor = await OnlineDoctor.findById(req.params.id)
      .select('-password -documents -bankDetails');
    
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }
    
    res.json({ success: true, data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get featured doctors
router.get('/doctors/featured', async (req, res) => {
  try {
    const doctors = await OnlineDoctor.find({
      isActive: true,
      verificationStatus: 'verified',
      'ratingSummary.averageRating': { $gte: 4.0 }
    })
      .select('-password -documents -bankDetails')
      .sort({ 'ratingSummary.averageRating': -1 })
      .limit(6);
    
    res.json({ success: true, data: doctors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// DOCTOR AUTH ROUTES
// ============================================

// Register
router.post('/doctor/register', async (req, res) => {
  try {
    const { 
      name, email, phone, password, specialization, 
      qualification, experience, languages, gender, 
      consultationFee, registrationNumber, about 
    } = req.body;
    
    const existing = await OnlineDoctor.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Doctor already exists with this email or phone' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const doctor = new OnlineDoctor({
      name,
      email,
      phone,
      password: hashedPassword,
      specialization,
      qualification,
      experience: parseInt(experience) || 0,
      languages: languages || [],
      gender: gender || 'Male',
      consultationFee: parseInt(consultationFee),
      registrationNumber,
      about: about || '',
      verificationStatus: 'pending',
      isActive: false
    });
    
    await doctor.save();
    
    const token = jwt.sign(
      { id: doctor._id, role: 'doctor' }, 
      global.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      success: true,
      token,
      doctor: {
        id: doctor._id,
        name,
        email,
        specialization,
        verificationStatus: 'pending'
      },
      message: 'Registration submitted successfully. Please wait for verification.'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login
router.post('/doctor/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const doctor = await OnlineDoctor.findOne({ email });
    if (!doctor) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const valid = await bcrypt.compare(password, doctor.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    if (doctor.verificationStatus !== 'verified') {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account is pending verification. Please wait for approval.' 
      });
    }
    
    if (!doctor.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account has been deactivated. Please contact support.' 
      });
    }
    
    const token = jwt.sign(
      { id: doctor._id, role: 'doctor' }, 
      global.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    doctor.lastLoginAt = new Date();
    await doctor.save();
    
    res.json({
      success: true,
      token,
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
        consultationFee: doctor.consultationFee,
        verificationStatus: doctor.verificationStatus,
        commissionPercentage: doctor.commissionPercentage
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// DOCTOR PROTECTED ROUTES
// ============================================

// Get profile
router.get('/doctor/profile', authenticateDoctor, async (req, res) => {
  try {
    const doctor = await OnlineDoctor.findById(req.user.id).select('-password');
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }
    res.json({ success: true, data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update profile
router.put('/doctor/profile', authenticateDoctor, async (req, res) => {
  try {
    const allowedUpdates = [
      'name', 'about', 'languages', 'consultationFee', 
      'consultationDuration', 'profilePhoto', 'hospitalAffiliation'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    updates.updatedAt = new Date();
    
    const doctor = await OnlineDoctor.findByIdAndUpdate(
      req.user.id, 
      updates, 
      { new: true }
    ).select('-password');
    
    res.json({ success: true, data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Set availability
router.put('/doctor/availability', authenticateDoctor, async (req, res) => {
  try {
    const { availability } = req.body;
    
    const doctor = await OnlineDoctor.findByIdAndUpdate(
      req.user.id,
      { availability, updatedAt: new Date() },
      { new: true }
    );
    
    res.json({ success: true, data: doctor.availability });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update bank details
router.put('/doctor/bank-details', authenticateDoctor, async (req, res) => {
  try {
    const { bankDetails } = req.body;
    
    const doctor = await OnlineDoctor.findByIdAndUpdate(
      req.user.id,
      { bankDetails, updatedAt: new Date() },
      { new: true }
    ).select('-password');
    
    res.json({ success: true, data: doctor.bankDetails });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upload documents
router.post('/doctor/documents', authenticateDoctor, async (req, res) => {
  try {
    const { documents } = req.body;
    
    const doctor = await OnlineDoctor.findByIdAndUpdate(
      req.user.id,
      { 
        documents,
        verificationStatus: 'documents_uploaded',
        updatedAt: new Date() 
      },
      { new: true }
    ).select('-password');
    
    res.json({ 
      success: true, 
      data: doctor.documents,
      verificationStatus: doctor.verificationStatus
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get dashboard
router.get('/doctor/dashboard', authenticateDoctor, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const [todayBookings, earningsAgg, totalConsults, completedConsults] = await Promise.all([
      Booking.find({
        doctorId: req.user.id,
        bookingType: 'online_consult',
        appointmentDate: { $gte: today, $lt: tomorrow }
      }).sort({ timeSlot: 1 }).lean(),
      
      Transaction.aggregate([
        { $match: { providerId: req.user.id.toString(), status: { $in: ['completed', 'captured'] } } },
        { $group: { _id: null, total: { $sum: '$providerAmount' }, platformTotal: { $sum: '$platformCommission' } } }
      ]),
      
      Booking.countDocuments({ doctorId: req.user.id, bookingType: 'online_consult' }),
      
      Booking.countDocuments({ doctorId: req.user.id, bookingType: 'online_consult', status: 'completed' })
    ]);
    
    const doctor = await OnlineDoctor.findById(req.user.id).select('commissionPercentage commissionSlab stats');
    
    res.json({
      success: true,
      data: {
        todayBookings,
        todayCount: todayBookings.length,
        totalEarnings: earningsAgg[0]?.total || 0,
        platformCommissionPaid: earningsAgg[0]?.platformTotal || 0,
        totalConsultations: totalConsults,
        completedConsultations: completedConsults,
        commissionPercentage: doctor?.commissionPercentage || 25,
        commissionSlab: doctor?.commissionSlab || 'default'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// PATIENT BOOKING ROUTES
// ============================================

// Book consultation
router.post('/book', global.authenticateToken, async (req, res) => {
  try {
    const { doctorId, appointmentDate, timeSlot, symptoms, mode = 'video' } = req.body;
    
    const doctor = await OnlineDoctor.findById(doctorId);
    if (!doctor || !doctor.isActive || doctor.verificationStatus !== 'verified') {
      return res.status(404).json({ success: false, message: 'Doctor not available' });
    }
    
    const amount = doctor.consultationFee;
    const platformFee = amount <= 500 ? 30 : amount <= 1000 ? 50 : 80;
    const commissionPercent = doctor.commissionPercentage || 25;
    const commission = Math.round(amount * commissionPercent / 100);
    const doctorEarning = amount - commission;
    const totalAmount = amount + platformFee;
    
    const booking = new Booking({
      userId: req.user.id,
      bookingType: 'online_consult',
      patientName: req.user.name || 'Patient',
      patientPhone: req.user.phone || '',
      appointmentDate: new Date(appointmentDate),
      timeSlot,
      originalAmount: totalAmount,
      finalAmount: totalAmount,
      doctorId: doctor._id,
      doctorName: doctor.name,
      doctorSpecialization: doctor.specialization,
      consultationFee: amount,
      platformCommission: commission,
      providerAmount: doctorEarning,
      status: 'pending',
      paymentStatus: 'pending',
      reason: symptoms || ''
    });
    
    await booking.save();
    
    res.json({
      success: true,
      data: {
        bookingId: booking._id,
        bookingNumber: booking.bookingId,
        amount: totalAmount,
        doctorFee: amount,
        platformFee,
        doctorName: doctor.name,
        appointmentDate,
        timeSlot
      }
    });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get patient bookings
router.get('/my-bookings', global.authenticateToken, async (req, res) => {
  try {
    const bookings = await Booking.find({
      userId: req.user.id,
      bookingType: 'online_consult'
    }).sort({ createdAt: -1 }).lean();
    
    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single booking
router.get('/booking/:id', global.authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Submit review
router.post('/review', global.authenticateToken, async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    if (booking.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Can only review completed consultations' });
    }
    
    const review = new Review({
      providerId: booking.doctorId,
      providerName: booking.doctorName,
      patientName: booking.patientName,
      patientPhone: booking.patientPhone,
      rating,
      comment,
      bookingId
    });
    await review.save();
    
    // Update doctor rating
    const reviews = await Review.find({ providerId: booking.doctorId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await OnlineDoctor.findByIdAndUpdate(booking.doctorId, {
      'ratingSummary.averageRating': parseFloat(avgRating.toFixed(1)),
      'ratingSummary.totalReviews': reviews.length
    });
    
    // Update commission slab
    const doctor = await OnlineDoctor.findById(booking.doctorId);
    if (doctor) {
      await doctor.updateCommissionSlab();
      await doctor.save();
    }
    
    res.json({ success: true, data: review, message: 'Review submitted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cancel booking
router.put('/booking/:id/cancel', global.authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    if (booking.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Booking cannot be cancelled' });
    }
    
    booking.status = 'cancelled';
    booking.cancellation = {
      cancelledAt: new Date(),
      reason: req.body.reason || 'Cancelled by patient',
      cancelledBy: req.user.id,
      refundAmount: booking.finalAmount,
      refundPercentage: 100,
      refundStatus: 'pending'
    };
    
    await booking.save();
    
    res.json({ success: true, data: booking, message: 'Booking cancelled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Get pending doctors
router.get('/admin/doctors/pending', async (req, res) => {
  try {
    const doctors = await OnlineDoctor.find({
      verificationStatus: { $in: ['pending', 'documents_uploaded'] }
    }).select('-password').sort({ createdAt: -1 });
    
    res.json({ success: true, data: doctors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Verify doctor
router.put('/admin/doctor/:id/verify', async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    
    const updateData = {
      verificationStatus: status,
      isActive: status === 'verified',
      verifiedAt: new Date()
    };
    
    if (status === 'rejected') {
      updateData.rejectionReason = rejectionReason || 'Documents not satisfactory';
    }
    
    const doctor = await OnlineDoctor.findByIdAndUpdate(req.params.id, updateData, { new: true });
    
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }
    
    res.json({ success: true, data: doctor, message: `Doctor ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all doctors (admin)
router.get('/admin/doctors', async (req, res) => {
  try {
    const doctors = await OnlineDoctor.find()
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: doctors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
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
// POST /api/online-doctor/send-reminder
router.post('/send-reminder', async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const doctor = await OnlineDoctor.findById(booking.doctorId);
    const patientPhone = booking.patientPhone;
    const doctorName = booking.doctorName;
    const date = new Date(booking.appointmentDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const time = booking.timeSlot;

    // Send SMS
    if (patientPhone) {
      await smsService.send({
        to: patientPhone,
        message: `HealthCare Hub: Reminder - Your consultation with ${doctorName} is on ${date} at ${time}. Join: ${process.env.FRONTEND_URL}/online-doctor/consult/${bookingId}`
      });
    }

    // Send WhatsApp
    if (patientPhone) {
      await notificationService.sendWhatsApp({
        to: patientPhone,
        template: 'appointment_reminder',
        data: { doctorName, date, time, bookingId }
      });
    }

    res.json({ success: true, message: 'Reminder sent' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/online-doctor/prescription - Save prescription
router.post('/prescription', authenticateDoctor, async (req, res) => {
  try {
    const { bookingId, medicines, tests, advice, followUpDate } = req.body;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.doctorId.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Unauthorized' });

    booking.prescription = {
      generated: true,
      prescriptionId: 'RX' + Date.now(),
      medicines: medicines || [],
      tests: tests || [],
      doctorNotes: advice || '',
      generatedAt: new Date()
    };
    
    booking.status = 'completed';
    booking.completedAt = new Date();
    booking.consultationEndTime = new Date();
    
    await booking.save();

    // Update doctor stats
    await OnlineDoctor.findByIdAndUpdate(req.user.id, {
      $inc: { 'stats.completedConsultations': 1, 'stats.totalEarnings': booking.providerAmount || 0 }
    });

    res.json({ success: true, data: booking.prescription });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/online-doctor/booking/:id/complete - Mark consultation complete
router.put('/booking/:id/complete', authenticateDoctor, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.doctorId.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Unauthorized' });

    booking.status = 'completed';
    booking.completedAt = new Date();
    await booking.save();

    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// ============================================
// FORGOT PASSWORD
// ============================================

// POST /api/online-doctor/doctor/forgot-password
router.post('/doctor/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const doctor = await OnlineDoctor.findOne({ email });
    if (!doctor) return res.status(404).json({ success: false, message: 'No account found with this email' });

    // Generate reset token (valid for 1 hour)
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    doctor.resetPasswordToken = resetToken;
    doctor.resetPasswordExpires = resetTokenExpiry;
    await doctor.save();

    // Send email with reset link
    const resetUrl = `${process.env.FRONTEND_URL || 'https://hospital-frontend-kiaeto.vercel.app'}/online-doctor/reset-password/${resetToken}`;
    
    try {
      await emailService.send({
        to: doctor.email,
        subject: 'Password Reset - HealthCare Hub',
        html: `<h2>Password Reset Request</h2>
               <p>Click the link below to reset your password:</p>
               <a href="${resetUrl}">${resetUrl}</a>
               <p>This link expires in 1 hour.</p>
               <p>If you didn't request this, ignore this email.</p>`
      });
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
    }

    res.json({ success: true, message: 'Password reset link sent to your email' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/online-doctor/doctor/reset-password/:token
router.post('/doctor/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const doctor = await OnlineDoctor.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!doctor) return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });

    const bcrypt = require('bcryptjs');
    doctor.password = await bcrypt.hash(password, 10);
    doctor.resetPasswordToken = undefined;
    doctor.resetPasswordExpires = undefined;
    await doctor.save();

    res.json({ success: true, message: 'Password reset successful. You can now login.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// OTP ENDPOINTS
// ============================================

// POST /api/online-doctor/doctor/send-otp
router.post('/doctor/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required' });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 600000); // 10 minutes

    // Store OTP (in production, use Redis or OTP model)
    // For now, store in doctor document temporarily
    const doctor = await OnlineDoctor.findOne({ phone });
    if (doctor) {
      doctor.otp = otp;
      doctor.otpExpires = otpExpiry;
      await doctor.save();
    } else {
      // Store OTP for new registration (use a temp collection or cache)
      // For simplicity, return OTP in response (in production, send via SMS)
    }

    // Send SMS (in production)
    try {
      await smsService.send({
        to: phone,
        message: `Your HealthCare Hub OTP is: ${otp}. Valid for 10 minutes.`
      });
    } catch (smsErr) {
      console.error('SMS send failed:', smsErr);
    }

    // For development, return OTP in response
    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      otp: process.env.NODE_ENV === 'production' ? undefined : otp // Only in dev
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/online-doctor/doctor/verify-otp
router.post('/doctor/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ success: false, message: 'Phone and OTP are required' });

    const doctor = await OnlineDoctor.findOne({ 
      phone, 
      otp, 
      otpExpires: { $gt: new Date() } 
    });

    if (!doctor) {
      // For new registrations, just verify OTP against temp storage
      // For dev, accept 123456
      if (otp === '123456') {
        return res.json({ success: true, message: 'OTP verified' });
      }
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Clear OTP after verification
    doctor.otp = undefined;
    doctor.otpExpires = undefined;
    await doctor.save();

    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// DOCTOR AVAILABILITY AUTO-SLOTS
// ============================================

// POST /api/online-doctor/doctor/auto-generate-slots
router.post('/doctor/auto-generate-slots', authenticateDoctor, async (req, res) => {
  try {
    const { startTime, endTime, duration, buffer, days } = req.body;
    
    const doctor = await OnlineDoctor.findById(req.user.id);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const slots = [];
    const start = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
    const end = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
    const slotDuration = parseInt(duration) || 15;
    const bufferTime = parseInt(buffer) || 5;
    const totalSlotTime = slotDuration + bufferTime;

    for (let time = start; time + slotDuration <= end; time += totalSlotTime) {
      const hours = Math.floor(time / 60);
      const minutes = time % 60;
      const endHours = Math.floor((time + slotDuration) / 60);
      const endMinutes = (time + slotDuration) % 60;
      
      slots.push({
        startTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        endTime: `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`,
        maxBookings: 1,
        currentBookings: 0
      });
    }

    const daysArray = days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    doctor.availability = daysArray.map(day => ({
      day,
      isAvailable: true,
      slots: slots
    }));

    await doctor.save();

    res.json({ success: true, data: doctor.availability, message: `${slots.length} slots generated for ${daysArray.length} days` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// DOCTOR STATS & ANALYTICS
// ============================================

// GET /api/online-doctor/doctor/analytics
router.get('/doctor/analytics', authenticateDoctor, async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;
    const doctorId = req.user.id;

    const now = new Date();
    let startDate;
    if (period === 'weekly') {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (period === 'monthly') {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    } else {
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
    }

    const bookings = await Booking.find({
      doctorId,
      bookingType: 'online_consult',
      createdAt: { $gte: startDate }
    });

    const completedBookings = bookings.filter(b => b.status === 'completed');
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled');
    
    const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.providerAmount || 0), 0);
    const totalCommission = completedBookings.reduce((sum, b) => sum + (b.platformCommission || 0), 0);

    // Daily breakdown
    const dailyStats = {};
    bookings.forEach(b => {
      const date = new Date(b.createdAt).toISOString().split('T')[0];
      if (!dailyStats[date]) dailyStats[date] = { total: 0, completed: 0, cancelled: 0, revenue: 0 };
      dailyStats[date].total++;
      if (b.status === 'completed') {
        dailyStats[date].completed++;
        dailyStats[date].revenue += (b.providerAmount || 0);
      }
      if (b.status === 'cancelled') dailyStats[date].cancelled++;
    });

    // Patient demographics
    const uniquePatients = [...new Set(bookings.map(b => b.userId))];
    const repeatPatients = uniquePatients.filter(patientId => 
      bookings.filter(b => b.userId === patientId).length > 1
    );

    res.json({
      success: true,
      data: {
        period,
        summary: {
          totalBookings: bookings.length,
          completedBookings: completedBookings.length,
          cancelledBookings: cancelledBookings.length,
          completionRate: bookings.length > 0 ? Math.round((completedBookings.length / bookings.length) * 100) : 0,
          totalRevenue,
          totalCommission,
          netEarnings: totalRevenue,
          uniquePatients: uniquePatients.length,
          repeatPatients: repeatPatients.length,
          repeatRate: uniquePatients.length > 0 ? Math.round((repeatPatients.length / uniquePatients.length) * 100) : 0,
          averageRating: req.user.rating || 0
        },
        dailyStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 FEE SETTINGS ROUTES
// ============================================

// PUT /api/online-doctor/fee-settings
// Doctor updates their own pricing
router.put('/fee-settings', authenticateDoctor, async (req, res) => {
  try {
    const doctorId = req.user.id;
    
    const {
      consultationFee,
      followUpFee,
      followUpWindowDays,
      freeFollowUps,
      emergencyConsultFee,
      consultationDuration,
      packagePrice
    } = req.body;

    // Build update object (only update provided fields)
    const updateFields = {};
    
    if (consultationFee !== undefined) {
      if (consultationFee < 0) return res.status(400).json({ success: false, message: 'Consultation fee cannot be negative' });
      updateFields.consultationFee = consultationFee;
    }
    if (followUpFee !== undefined) {
      if (followUpFee < 0) return res.status(400).json({ success: false, message: 'Follow-up fee cannot be negative' });
      updateFields.followUpFee = followUpFee;
    }
    if (followUpWindowDays !== undefined) {
      if (followUpWindowDays < 1 || followUpWindowDays > 30) return res.status(400).json({ success: false, message: 'Follow-up window must be 1-30 days' });
      updateFields.followUpWindowDays = followUpWindowDays;
    }
    if (freeFollowUps !== undefined) {
      if (freeFollowUps < 0 || freeFollowUps > 5) return res.status(400).json({ success: false, message: 'Free follow-ups must be 0-5' });
      updateFields.freeFollowUps = freeFollowUps;
    }
    if (emergencyConsultFee !== undefined) {
      if (emergencyConsultFee < 0) return res.status(400).json({ success: false, message: 'Emergency fee cannot be negative' });
      updateFields.emergencyConsultFee = emergencyConsultFee;
    }
    if (consultationDuration !== undefined) {
      if (consultationDuration < 5 || consultationDuration > 60) return res.status(400).json({ success: false, message: 'Duration must be 5-60 minutes' });
      updateFields.consultationDuration = consultationDuration;
    }
    if (packagePrice !== undefined) {
      if (packagePrice < 0) return res.status(400).json({ success: false, message: 'Package price cannot be negative' });
      updateFields.packagePrice = packagePrice;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updateFields.updatedAt = new Date();

    const doctor = await OnlineDoctor.findByIdAndUpdate(
      doctorId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('consultationFee followUpFee followUpWindowDays freeFollowUps emergencyConsultFee consultationDuration packagePrice commissionPercentage commissionSlab');

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    res.json({
      success: true,
      message: 'Fee settings updated successfully',
      data: {
        consultationFee: doctor.consultationFee,
        followUpFee: doctor.followUpFee,
        followUpWindowDays: doctor.followUpWindowDays,
        freeFollowUps: doctor.freeFollowUps,
        emergencyConsultFee: doctor.emergencyConsultFee,
        consultationDuration: doctor.consultationDuration,
        packagePrice: doctor.packagePrice,
        commissionPercentage: doctor.commissionPercentage,
        commissionSlab: doctor.commissionSlab
      }
    });

  } catch (error) {
    console.error('Error updating fee settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/online-doctor/fee-settings
// Doctor views their own pricing
router.get('/fee-settings', authenticateDoctor, async (req, res) => {
  try {
    const doctor = await OnlineDoctor.findById(req.user.id)
      .select('consultationFee followUpFee followUpWindowDays freeFollowUps emergencyConsultFee consultationDuration packagePrice commissionPercentage commissionSlab');

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    res.json({
      success: true,
      data: {
        consultationFee: doctor.consultationFee,
        followUpFee: doctor.followUpFee,
        followUpWindowDays: doctor.followUpWindowDays,
        freeFollowUps: doctor.freeFollowUps,
        emergencyConsultFee: doctor.emergencyConsultFee,
        consultationDuration: doctor.consultationDuration,
        packagePrice: doctor.packagePrice,
        commissionPercentage: doctor.commissionPercentage,
        commissionSlab: doctor.commissionSlab
      }
    });

  } catch (error) {
    console.error('Error fetching fee settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/online-doctor/:id/pricing
// Public - Patient sees doctor pricing with follow-up eligibility
router.get('/:id/pricing', async (req, res) => {
  try {
    const { id } = req.params;
    const { patientId } = req.query;

    const doctor = await OnlineDoctor.findById(id)
      .select('consultationFee followUpFee followUpWindowDays freeFollowUps emergencyConsultFee consultationDuration packagePrice consultationModes name specialization');

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Check follow-up eligibility if patientId provided
    let lastConsultDate = null;
    let freeFollowUpsUsed = 0;

    if (patientId) {
      const lastConsult = await Booking.findOne({
        doctorId: id,
        userId: patientId,
        status: 'completed',
        bookingType: 'online_consult'
      }).sort({ createdAt: -1 });

      if (lastConsult) {
        lastConsultDate = lastConsult.createdAt;
      }

      freeFollowUpsUsed = await Booking.countDocuments({
        doctorId: id,
        userId: patientId,
        consult_type: 'free_follow_up',
        status: 'completed'
      });
    }

    const pricing = doctor.getPricingForPatient(lastConsultDate, freeFollowUpsUsed);

    // Get platform fee from commission service
    const commissionService = require('../services/commissionService');
    const platformFeeConsult = commissionService.calculatePlatformFee('online_consult');
    const platformFeeFollowUp = commissionService.calculatePlatformFee('online_followup');
    const platformFeeEmergency = commissionService.calculatePlatformFee('online_consult', { isEmergency: true });

    res.json({
      success: true,
      data: {
        doctorName: doctor.name,
        specialization: doctor.specialization,
        pricing: {
          ...pricing,
          platformFee: {
            consultation: platformFeeConsult,
            followUp: platformFeeFollowUp,
            emergency: platformFeeEmergency
          }
        }
      }
    });

  } catch (error) {
    console.error('Error fetching doctor pricing:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 AI SYMPTOM TRIAGE
// ============================================

const triageService = require('../services/triageService');

// POST /api/online-doctor/triage
// Analyze symptoms and recommend specialist
router.post('/triage', async (req, res) => {
  try {
    const { symptoms } = req.body;

    if (!symptoms || symptoms.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Please describe your symptoms in at least 3 characters'
      });
    }

    const result = triageService.triageSymptoms(symptoms);

    // If we have a recommendation, find matching doctors
    let availableDoctors = [];
    if (result.success && result.recommendation?.specialty) {
      availableDoctors = await OnlineDoctor.find({
        specialization: { $regex: result.recommendation.specialty, $options: 'i' },
        isActive: true,
        verificationStatus: 'verified'
      })
      .select('name specialization consultationFee followUpFee ratingSummary experience consultationDuration')
      .sort({ 'ratingSummary.averageRating': -1 })
      .limit(6)
      .lean();
    }

    res.json({
      success: true,
      data: {
        ...result,
        availableDoctors,
        doctorsCount: availableDoctors.length,
        searchUrl: result.recommendation?.specialty 
          ? `/online-doctor/search?specialty=${encodeURIComponent(result.recommendation.specialty)}`
          : null
      }
    });

  } catch (error) {
    console.error('Triage error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/online-doctor/specialties
// Get all available specialties
router.get('/specialties', async (req, res) => {
  try {
    const specialties = triageService.getAvailableSpecialties();
    res.json({ success: true, data: specialties });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// ... all your existing routes ...

// ============================================
// 🆕 FOLLOW-UP SCHEDULER ROUTES
// ============================================

const schedulerService = require('../services/schedulerService');

// POST /api/online-doctor/admin/trigger-reminders
router.post('/admin/trigger-reminders', async (req, res) => {
  try {
    const result = await schedulerService.processFollowUpReminders();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/online-doctor/admin/reminder-stats
router.get('/admin/reminder-stats', async (req, res) => {
  try {
    const stats = await schedulerService.getReminderStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/online-doctor/follow-up/mark-booked/:bookingId
router.post('/follow-up/mark-booked/:bookingId', async (req, res) => {
  try {
    await schedulerService.markFollowUpBooked(req.params.bookingId);
    res.json({ success: true, message: 'Follow-up marked as booked' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ⬇️ THIS MUST BE THE LAST LINE ⬇️
module.exports = router;

module.exports = router;
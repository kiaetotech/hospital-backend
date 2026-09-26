const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AyurvedaBooking = require('../models/AyurvedaBooking');
const AyurvedaDoctor = require('../models/AyurvedaDoctor');
const WellnessCenter = require('../models/WellnessCenter');
const Transaction = require('../models/Transaction');
const Discount = require('../models/Discount');
const commissionService = require('../services/commissionService');
const pricingService = require('../services/pricingService');
const cancellationService = require('../services/cancellationPolicyService');
const razorpayService = require('../services/razorpayService');
const notificationService = require('../services/notificationService');
const smsService = require('../services/smsService');
const emailService = require('../services/emailService');

// ============================================
// AUTH MIDDLEWARE
// ============================================
const authenticateUser = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Please login to continue' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// ============================================
// PRODUCTION HELPER: Get user ID as ObjectId
// ============================================
const getUserObjectId = (user) => {
  const mongoose = require('mongoose');
  const idStr = user?.id || user?._id || user?.userId;
  if (!idStr) return null;
  
  try {
    return new mongoose.Types.ObjectId(String(idStr));
  } catch (e) {
    return null;
  }
};

// ============================================
// DOCTOR: VIEW COMPLAINTS ON OWN BOOKINGS
// ============================================
router.get('/doctor/complaints', authenticateUser, async (req, res) => {
  try {
    const doctorObjectId = getUserObjectId(req.user);

    if (!doctorObjectId) {
      return res.status(400).json({ success: false, message: 'Invalid user session' });
    }

    const { status, page = 1, limit = 20 } = req.query;

    const query = { 
      doctor: doctorObjectId,
      'complaints.0': { $exists: true }
    };

    const bookings = await AyurvedaBooking.find(query)
      .select('bookingId type patient package doctorName centerName complaints review createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean();

    let complaints = [];
    bookings.forEach(b => {
      (b.complaints || []).forEach(c => {
        if (status && c.status !== status) return;
        complaints.push({
          complaintId: c._id,
          bookingId: b.bookingId,
          bookingType: b.type,
          patientName: b.patient?.name || 'Patient',
          patientPhone: b.patient?.phone || '',
          packageName: b.package?.name || '',
          centerName: b.centerName || '',
          category: c.category,
          description: c.description,
          priority: c.priority,
          status: c.status,
          adminResponse: c.adminResponse || '',
          doctorResponse: c.doctorResponse || c.centerResponse || '',
          resolvedAt: c.resolvedAt,
          createdAt: c.createdAt
        });
      });
    });

    complaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = complaints.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginated = complaints.slice(start, start + parseInt(limit));

    res.json({
      success: true,
      data: paginated,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Doctor complaints error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints' });
  }
});

// ============================================
// DOCTOR: RESPOND TO COMPLAINT
// ============================================
router.put('/:bookingId/complaint/:complaintId/doctor-respond', authenticateUser, async (req, res) => {
  try {
    const { response } = req.body;
    const doctorObjectId = getUserObjectId(req.user);

    if (!doctorObjectId) {
      return res.status(400).json({ success: false, message: 'Invalid user session' });
    }

    if (!response || response.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Response must be at least 3 characters' });
    }

    const booking = await AyurvedaBooking.findOne({ 
      bookingId: req.params.bookingId,
      doctor: doctorObjectId
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const complaint = booking.complaints.id(req.params.complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    complaint.doctorResponse = response.trim().slice(0, 2000);
    complaint.doctorRespondedAt = new Date();
    if (complaint.status === 'pending') {
      complaint.status = 'in_review';
    }

    await booking.save();

    res.json({
      success: true,
      message: 'Response submitted',
      data: complaint
    });
  } catch (error) {
    console.error('Doctor respond error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to respond' });
  }
});

// ============================================
// DOCTOR: MARK COMPLAINT RESOLVED
// ============================================
router.put('/:bookingId/complaint/:complaintId/doctor-resolve', authenticateUser, async (req, res) => {
  try {
    const doctorObjectId = getUserObjectId(req.user);

    if (!doctorObjectId) {
      return res.status(400).json({ success: false, message: 'Invalid user session' });
    }

    const booking = await AyurvedaBooking.findOne({ 
      bookingId: req.params.bookingId,
      doctor: doctorObjectId
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const complaint = booking.complaints.id(req.params.complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    complaint.status = 'resolved';
    complaint.resolvedAt = new Date();

    await booking.save();

    res.json({
      success: true,
      message: 'Complaint resolved',
      data: complaint
    });
  } catch (error) {
    console.error('Doctor resolve error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to resolve' });
  }
});

// ============================================
// DOCTOR: VIEW REVIEWS ON OWN BOOKINGS
// ============================================
router.get('/doctor/reviews', authenticateUser, async (req, res) => {
  try {
    const doctorObjectId = getUserObjectId(req.user);

    if (!doctorObjectId) {
      return res.status(400).json({ success: false, message: 'Invalid user session' });
    }

    const { page = 1, limit = 20 } = req.query;

    // Fetch all doctor bookings
    const bookings = await AyurvedaBooking.find({
      doctor: doctorObjectId
    })
      .select('bookingId type patient package doctorName centerName review reviewed createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // Filter only those with actual review content
    const reviewedBookings = bookings.filter(b => 
      b.review && (b.review.rating || b.review.comment || b.review.createdAt)
    );

    const reviews = reviewedBookings.map(b => ({
      bookingId: b.bookingId,
      bookingType: b.type,
      patientName: b.patient?.name || 'Patient',
      packageName: b.package?.name || '',
      centerName: b.centerName || '',
      rating: b.review?.rating,
      comment: b.review?.comment,
      doctorResponse: b.review?.doctorResponse || b.review?.centerResponse || '',
      doctorRespondedAt: b.review?.doctorRespondedAt || b.review?.centerRespondedAt,
      createdAt: b.review?.createdAt
    }));

    const total = reviews.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginated = reviews.slice(start, start + parseInt(limit));

    const avgRating = reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length) * 10) / 10
      : 0;

    res.json({
      success: true,
      data: paginated,
      averageRating: avgRating,
      totalReviews: total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Doctor reviews error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
});

// ============================================
// DOCTOR: RESPOND TO REVIEW
// ============================================
router.put('/:bookingId/review/doctor-respond', authenticateUser, async (req, res) => {
  try {
    const { response } = req.body;
    const doctorObjectId = getUserObjectId(req.user);

    if (!doctorObjectId) {
      return res.status(400).json({ success: false, message: 'Invalid user session' });
    }

    if (!response || response.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Response must be at least 3 characters' });
    }

    const booking = await AyurvedaBooking.findOne({
      bookingId: req.params.bookingId,
      doctor: doctorObjectId
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (!booking.review || (!booking.review.rating && !booking.review.comment)) {
      return res.status(404).json({ success: false, message: 'No review exists on this booking' });
    }

    booking.review = booking.review || {};
    booking.review.doctorResponse = response.trim().slice(0, 1000);
    booking.review.doctorRespondedAt = new Date();
    booking.markModified('review');

    await booking.save();

    res.json({
      success: true,
      message: 'Response submitted',
      data: booking.review
    });
  } catch (error) {
    console.error('Doctor review respond error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to respond' });
  }
});

// ============================================
// PUBLIC: Pricing preview (no auth needed)
// POST /api/ayurveda/bookings/pricing-preview
// ============================================
router.post('/pricing-preview', async (req, res) => {
  try {
    const pricingService = require('../services/pricingService');
    const { bookingType, amount, discountAmount = 0 } = req.body;

    if (!bookingType || typeof amount !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'bookingType and amount are required'
      });
    }

    const pricing = await pricingService.calculatePricing({
      bookingType,
      amount,
      discountAmount
    });

    res.json({ success: true, data: pricing });
  } catch (error) {
    console.error('[pricing-preview]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});


// ============================================
// PATIENT-ONLY MIDDLEWARE
// ============================================
const authenticatePatient = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Please login as a patient to continue' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Reject non-patient tokens
    if (decoded.role !== 'patient') {
      return res.status(403).json({ 
        success: false, 
        message: `Patient access required. You are logged in as ${decoded.role}. Please logout and login as a patient.` 
      });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// ============================================
// CREATE BOOKING
// ============================================
router.post('/create', authenticatePatient, async (req, res) => {
  try {
 
    // ============================================
    // SLOT LOCK CHECK (fail-open — never blocks on error)
    // Prevents double-booking during the payment window
    // ============================================
    const { doctorId: _did, centerId: _cid, bookingDate: _bdate, slotTime: _slot } = req.body;
    if (_bdate && _slot && (_did || _cid)) {
      try {
        const redis = global.redisClient;
        if (redis && redis.status === 'ready') {
          const dateStr = new Date(_bdate).toISOString().split('T')[0];
          const providerKey = _did || _cid;
          const lockKey = `slot-lock:${providerKey}:${dateStr}:${_slot}`;

          const existingLock = await redis.get(lockKey);
          if (existingLock) {
            return res.status(409).json({
              success: false,
              message: 'This slot is being booked by another patient. Please try again in a few minutes or pick a different slot.',
              code: 'SLOT_LOCKED'
            });
          }
        }
      } catch (lockCheckErr) {
        // Fail-open: if Redis is unavailable, allow booking to proceed
        console.warn('[slot-lock] Check failed (proceeding):', lockCheckErr.message);
      }
    }

    const {
      type,
      doctorId,
      centerId,
      consultationType,
      bookingDate,
      slotTime,
      symptoms,
      medicalHistory,
      prakritiType,
      patientName,
      patientPhone,
      patientEmail,
      patientAge,
      patientGender,
      discountCode
    } = req.body;

    // Validate required fields
    if (!type || !bookingDate) {
      return res.status(400).json({ success: false, message: 'Booking type and date are required' });
    }

    let amount = 0;
    let doctor = null;
    let center = null;
    let packageDetails = null;

    // Get amount based on booking type
        if (type === 'doctor_consultation') {
      if (!doctorId) {
        return res.status(400).json({ success: false, message: 'Doctor ID is required' });
      }
      doctor = await AyurvedaDoctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({ success: false, message: 'Doctor not found' });
      }
      if (!doctor.isActive || doctor.verificationStatus !== 'approved') {
        return res.status(400).json({ success: false, message: 'Doctor is not available' });
      }
      amount = req.body.amount || doctor.consultationFee;
    }   // ← CLOSING BRACE ADDED HERE

	else if (type === 'wellness_program') {
  if (!doctorId) {
    return res.status(400).json({ success: false, message: 'Doctor ID is required' });
  }
  doctor = await AyurvedaDoctor.findById(doctorId);
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }
  if (!doctor.isActive || doctor.verificationStatus !== 'approved') {
    return res.status(400).json({ success: false, message: 'Doctor is not available' });
  }

  const programId = req.body.wellnessProgramId;
  if (!programId) {
    return res.status(400).json({ success: false, message: 'Wellness program ID is required' });
  }

  const program = (doctor.wellnessPrograms || []).find(
    p => p._id.toString() === programId && p.approvalStatus === 'approved' && p.isActive !== false
  );

  if (!program) {
    return res.status(404).json({ success: false, message: 'Wellness program not found or not approved' });
  }

  amount = program.discountPrice || program.price;
  req.body.amount = amount;
  // Store program reference for record-keeping
  req.body.wellnessProgramDetails = {
    programId: program._id.toString(),
    name: program.name,
    duration: program.duration,
    price: program.price
  };
}
    
    else if (type === 'panchakarma_package') {
      if (!centerId || !req.body.packageId) {
        return res.status(400).json({ success: false, message: 'Center ID and Package ID are required' });
      }
      const WellnessCenter = require('../models/WellnessCenter');
      center = await WellnessCenter.findById(centerId);
      if (!center) {
        return res.status(404).json({ success: false, message: 'Center not found' });
      }
      if (!center.isActive || center.verificationStatus !== 'approved') {
        return res.status(400).json({ success: false, message: 'Center is not available' });
      }
      
      const pkg = center.packages?.find(p => p._id.toString() === req.body.packageId);
      if (!pkg) {
        return res.status(404).json({ success: false, message: 'Package not found' });
      }
      if (!pkg.isActive) {
        return res.status(400).json({ success: false, message: 'Package is not active' });
      }
      if (pkg.currentBookings >= pkg.maxCapacity) {
        return res.status(400).json({ success: false, message: 'Package is full' });
      }
      
      amount = pkg.discountPrice || pkg.price;
      packageDetails = {
        packageId: pkg._id,
        name: pkg.name,
        duration: pkg.duration,
        therapies: pkg.therapies,
        inclusions: pkg.inclusions
      };
    }
    else {
      return res.status(400).json({ success: false, message: 'Invalid booking type' });
    }

    // Apply discount
    let discountAmount = 0;
    let discountDetails = {};
    if (discountCode) {
      const discount = await Discount.findByCode(discountCode);
      if (discount) {
        const canApply = discount.canApply(amount, type, req.user.id);
        if (canApply.valid) {
          discountAmount = discount.calculateDiscount(amount);
          discountDetails = {
            code: discount.code,
            percentage: discount.type === 'percentage' ? discount.value : 0,
            amount: discountAmount,
            description: discount.description
          };
          await discount.incrementUsage(req.user.id);
        } else {
          return res.status(400).json({ success: false, message: canApply.reason });
        }
      } else {
        return res.status(400).json({ success: false, message: 'Invalid discount code' });
      }
    }

            // ─────────────────────────────────────────
    // PRICING — single source of truth
    // All numbers from CommissionConfig in DB.
    // ─────────────────────────────────────────
    let pricing;
    try {
      pricing = await pricingService.calculatePricing({
        bookingType: type,
        amount,
        discountAmount
      });
    } catch (priceErr) {
      console.error('[booking.create] pricing failed:', priceErr.message);
      return res.status(503).json({
        success: false,
        message: 'Booking temporarily unavailable. Admin has not configured pricing. Please try again later.',
        code: 'PRICING_NOT_CONFIGURED'
      });
    }

    const {
      platformFee,
      gstAmount,
      total: finalAmount,
      platformCommission,
      providerEarning,
      gstPercentage,
      configVersion,
      configId
    } = pricing;

    // Create Razorpay order
    const orderResult = await razorpayService.createOrder(
      finalAmount,
      'INR',
      `AYU_${Date.now()}`,
      {
        bookingType: type,
        userId: req.user.id,
        doctorId: doctorId || '',
        centerId: centerId || ''
      }
    );

    if (!orderResult.success) {
      return res.status(500).json({ success: false, message: 'Failed to create payment order' });
    }

    // Create booking
    const booking = new AyurvedaBooking({
      userId: req.user.id,
      type,
      doctor: doctorId || null,
      doctorName: doctor?.name || '',
      doctorPhone: doctor?.phone || '',
      doctorSpecialization: doctor?.specialization || '',
      center: centerId || null,
      centerName: center?.name || '',
      centerPhone: center?.phone || '',
      consultationType: consultationType || 'online',
      package: packageDetails,
      wellnessProgram: req.body.wellnessProgramDetails || null,
      bookingDate: new Date(bookingDate),
      slotTime,
      symptoms,
      medicalHistory,
      prakritiType,
      patient: {
        name: patientName || req.user.name || 'Patient',
        phone: patientPhone || req.user.phone || '',
        email: patientEmail || req.user.email || '',
        age: patientAge,
        gender: patientGender
      },
      amount,
      discount: discountDetails,
      finalAmount,
      platformFee,
      gstAmount,
      platformCommission,
      providerEarning,
      razorpayOrderId: orderResult.order.id,
      status: 'pending'
    });

    // Generate booking ID
    booking.bookingId = 'AYU' + Date.now() + Math.floor(Math.random() * 1000);
    
    // Generate OTP
    booking.generateOtp();

    await booking.save();

    // ============================================
    // SET SLOT LOCK (best-effort, TTL 15 min)
    // ============================================
    if (bookingDate && slotTime && (doctorId || centerId)) {
      try {
        const redis = global.redisClient;
        if (redis && redis.status === 'ready') {
          const dateStr = new Date(bookingDate).toISOString().split('T')[0];
          const providerKey = doctorId || centerId;
          const lockKey = `slot-lock:${providerKey}:${dateStr}:${slotTime}`;
          await redis.set(lockKey, booking.bookingId, 'EX', 900);
          console.log(`[slot-lock] Set for ${lockKey} → ${booking.bookingId}`);
        }
      } catch (lockSetErr) {
        console.warn('[slot-lock] Set failed (non-fatal):', lockSetErr.message);
      }
    }

    // Increment package booking count
    if (type === 'panchakarma_package' && centerId && req.body.packageId) {
      const WellnessCenter = require('../models/WellnessCenter');
      await WellnessCenter.updateOne(
        { _id: centerId, 'packages._id': req.body.packageId },
        { $inc: { 'packages.$.currentBookings': 1 } }
      );
    }

    // Send booking confirmation
    try {
      await notificationService.sendBookingConfirmation(booking);
    } catch (notifError) {
      console.error('Notification failed:', notifError.message);
    }

    // Create transaction record
    const transaction = new Transaction({
      transactionId: `TXN_AYU_${Date.now()}`,
      type: 'ayurveda_booking',
      bookingType: type,
      bookingId: booking._id,
      userId: req.user.id,
      amount: finalAmount,
      originalAmount: amount,
      discountAmount,
      platformFee,
      gstAmount,
      platformCommission,
      providerAmount: providerEarning,
      status: 'initiated',
      orderId: orderResult.order.id,
      razorpayOrderId: orderResult.order.id,
      ayurvedaDoctorId: doctorId || '',
      ayurvedaCenterId: centerId || ''
    });

    await transaction.save();

    // Send booking confirmation SMS
    try {
      await smsService.sendSms(
        patientPhone || req.user.phone,
        `Your Ayurveda booking ${booking.bookingId} is pending payment. Complete payment to confirm. OTP: ${booking.otp}`
      );
    } catch (smsError) {
      console.error('SMS sending failed:', smsError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Booking created. Please complete payment.',
      data: {
        bookingId: booking.bookingId,
        razorpayOrderId: orderResult.order.id,
        amount: finalAmount,
        currency: 'INR',
        otp: booking.otp,
        booking: booking
      }
    });

  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create booking' });
  }
});

// ============================================
// VERIFY PAYMENT
// ============================================
router.post('/verify-payment', authenticatePatient, async (req, res) => {
  try {
    const { bookingId, razorpayPaymentId, razorpaySignature } = req.body;

    const booking = await AyurvedaBooking.findOne({ bookingId, userId: req.user.id });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Verify payment signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${booking.razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      booking.paymentStatus = 'failed';
      await booking.save();
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // Update booking
        booking.paymentStatus = 'paid';
    booking.razorpayPaymentId = razorpayPaymentId;
    booking.razorpaySignature = razorpaySignature;
    booking.paidAt = new Date();
    booking.transactionId = `TXN_${Date.now()}`;
    booking.otpVerified = false;

    await booking.save();

    // Update transaction
    await Transaction.findOneAndUpdate(
      { orderId: booking.razorpayOrderId },
      {
        status: 'completed',
        paymentId: razorpayPaymentId,
        razorpayPaymentId,
        paidAt: new Date()
      }
    );

    // Increment doctor booking count
    if (booking.doctor) {
      await AyurvedaDoctor.findByIdAndUpdate(booking.doctor, {
        $inc: { 'stats.totalConsultations': 1 }
      });
    }

    // Increment center booking count
    if (booking.center) {
      await WellnessCenter.findByIdAndUpdate(booking.center, {
        $inc: { 'stats.totalBookings': 1 }
      });
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        bookingId: booking.bookingId,
        status: booking.status,
        otp: booking.otp
      }
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, message: error.message || 'Payment verification failed' });
  }
});

// ============================================
// VERIFY OTP
// ============================================
router.post('/verify-otp', authenticatePatient, async (req, res) => {
  try {
    const { bookingId, otp } = req.body;

    const booking = await AyurvedaBooking.findOne({ bookingId, userId: req.user.id });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.paymentStatus !== 'paid') {
      return res.status(400).json({ success: false, message: 'Payment required before OTP verification' });
    }

    const verified = await booking.verifyOtp(otp);
    if (!verified) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    res.json({
      success: true,
      message: 'Booking confirmed successfully',
      data: {
        bookingId: booking.bookingId,
        status: booking.status,
        confirmedAt: booking.confirmedAt
      }
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(400).json({ success: false, message: error.message || 'OTP verification failed' });
  }
});

// ============================================
// RESEND OTP
// ============================================
router.post('/resend-otp', authenticatePatient, async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await AyurvedaBooking.findOne({ bookingId, userId: req.user.id });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const newOtp = booking.generateOtp();
    await booking.save();

    // Send OTP via SMS
    try {
      await smsService.sendSms(
        booking.patient.phone,
        `Your new OTP for booking ${booking.bookingId} is: ${newOtp}`
      );
    } catch (smsError) {
      console.error('SMS sending failed:', smsError.message);
    }

    res.json({
      success: true,
      message: 'OTP resent successfully',
      data: { otp: newOtp }
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to resend OTP' });
  }
});

// ============================================
// GET MY BOOKINGS
// ============================================
router.get('/my-bookings', authenticatePatient, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;
    
    const query = { userId: req.user.id };
    if (status) query.status = status;
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await AyurvedaBooking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AyurvedaBooking.countDocuments(query);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// ============================================
// GET BOOKING DETAILS
// ============================================
// ============================================
// GET BOOKING DETAILS
// ============================================
router.get('/:bookingId', authenticateUser, async (req, res) => {
  try {
    const booking = await AyurvedaBooking.findOne({ bookingId: req.params.bookingId });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const userId = req.user.id;
    const isOwner =
      booking.userId?.toString() === userId ||
      booking.doctor?.toString() === userId ||
      booking.center?.toString() === userId;

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const data = booking.toObject();

    if (booking.doctor) {
      try {
        const doctor = await AyurvedaDoctor.findById(booking.doctor)
          .select('name specialization consultationFee rating address')
          .lean();
        data.doctor = doctor || null;
      } catch (e) {
        console.error('Doctor fetch error:', e.message);
      }
    }

    if (booking.center) {
      try {
        const center = await WellnessCenter.findById(booking.center)
          .select('name address rating facilities')
          .lean();
        data.center = center || null;
      } catch (e) {
        console.error('Center fetch error:', e.message);
      }
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get booking error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch booking' });
  }
});
// ============================================
// GET CANCELLATION QUOTE
// ============================================
router.get('/:bookingId/cancellation-quote', authenticatePatient, async (req, res) => {
  try {
    const booking = await AyurvedaBooking.findOne({ 
      bookingId: req.params.bookingId,
      userId: req.user.id
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking already cancelled' });
    }

    const info = cancellationService.calculateAyurvedaCancellation(booking);

    res.json({
      success: true,
      data: {
        bookingId: booking.bookingId,
        canCancel: info.canCancel,
        cancellationFee: info.cancellationFee,
        refundAmount: info.refundAmount,
        refundPercentage: info.refundPercentage,
        reason: info.reason,
        totalAmount: booking.finalAmount,
        bookingDate: booking.bookingDate
      }
    });

  } catch (error) {
    console.error('Cancellation quote error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get cancellation quote' });
  }
});


// ============================================
// CANCEL BOOKING
// ============================================
router.put('/:bookingId/cancel', authenticatePatient, async (req, res) => {
  try {
    const { reason } = req.body;

    const booking = await AyurvedaBooking.findOne({ 
      bookingId: req.params.bookingId,
      userId: req.user.id
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking already cancelled' });
    }

    // Check if booking can be cancelled
    const cancellationInfo = cancellationService.calculateAyurvedaCancellation(booking);
    
    if (!cancellationInfo.canCancel) {
      return res.status(400).json({ 
        success: false, 
        message: cancellationInfo.reason || 'Booking cannot be cancelled' 
      });
    }

    // Cancel booking
    await booking.cancelBooking(reason, 'patient');

    // Decrement package counter if this was a panchakarma package
    if (booking.type === 'panchakarma_package' && booking.center && booking.package?.packageId) {
      try {
        await WellnessCenter.updateOne(
          { 
            _id: booking.center, 
            'packages._id': booking.package.packageId 
          },
          { 
            $inc: { 'packages.$.currentBookings': -1 } 
          }
        );
      } catch (counterError) {
        console.error('Counter decrement error:', counterError.message);
      }
    }

    // Process refund if applicable
    if (cancellationInfo.refundAmount > 0 && booking.razorpayPaymentId) {
      try {
        const refundResult = await razorpayService.createRefund(
          booking.razorpayPaymentId,
          cancellationInfo.refundAmount,
          { bookingId: booking.bookingId, reason: reason || 'Booking cancelled' }
        );

        if (refundResult.success) {
          booking.cancellation.refundStatus = 'processed';
          booking.cancellation.refundProcessedAt = new Date();
          booking.cancellation.refundTransactionId = refundResult.refund.id;
          await booking.save();

          // Update transaction
          await Transaction.findOneAndUpdate(
            { razorpayPaymentId: booking.razorpayPaymentId },
            {
              status: 'refunded',
              refundAmount: cancellationInfo.refundAmount,
              refundedAt: new Date(),
              refundId: refundResult.refund.id
            }
          );
        }
      } catch (refundError) {
        console.error('Refund error:', refundError);
        booking.cancellation.refundStatus = 'failed';
        await booking.save();
      }
    }

    // Send cancellation notification
    try {
      await smsService.sendSms(
        booking.patient.phone,
        `Your booking ${booking.bookingId} has been cancelled. Refund: ₹${cancellationInfo.refundAmount}`
      );
    } catch (smsError) {
      console.error('SMS sending failed:', smsError.message);
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        bookingId: booking.bookingId,
        cancellationFee: cancellationInfo.cancellationFee,
        refundAmount: cancellationInfo.refundAmount,
        refundStatus: booking.cancellation.refundStatus
      }
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to cancel booking' });
  }
});

// ============================================
// RESCHEDULE BOOKING
// ============================================
router.put('/:bookingId/reschedule', authenticateUser, async (req, res) => {
  try {
    const { newDate, newSlot, reason } = req.body;

    if (!newDate || !newSlot) {
      return res.status(400).json({ success: false, message: 'New date and slot are required' });
    }

    const booking = await AyurvedaBooking.findOne({ 
      bookingId: req.params.bookingId,
      userId: req.user.id
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    await booking.rescheduleBooking(new Date(newDate), newSlot, reason, 'patient');

    res.json({
      success: true,
      message: 'Booking rescheduled successfully',
      data: {
        bookingId: booking.bookingId,
        newDate: booking.bookingDate,
        newSlot: booking.slotTime,
        otp: booking.otp
      }
    });

  } catch (error) {
    console.error('Reschedule error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to reschedule' });
  }
});

// ============================================
// SUBMIT REVIEW
// ============================================
router.post('/:bookingId/review', authenticatePatient, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const userIdStr = String(req.user.id || req.user._id || '');

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const booking = await AyurvedaBooking.findOne({ bookingId: req.params.bookingId });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (String(booking.userId) !== userIdStr) {
      return res.status(403).json({ success: false, message: 'You can only review your own bookings' });
    }

    // Model handles: status check, duplicate check, rating update
    await booking.submitReview(rating, comment);

    res.json({
      success: true,
      message: 'Review submitted successfully',
      data: booking.review
    });

  } catch (error) {
    console.error('Review error:', error.message);
    const status = error.message.includes('already') ||
                   error.message.includes('Can only review') ||
                   error.message.includes('Rating must') ? 400 : 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to submit review' });
  }
});

// ============================================
// SUBMIT COMPLAINT
// ============================================
router.post('/:bookingId/complaint', authenticatePatient, async (req, res) => {
  try {
    const { category, description, priority } = req.body;

    if (!description || description.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Description must be at least 10 characters' });
    }

    const booking = await AyurvedaBooking.findOne({ 
      bookingId: req.params.bookingId,
      userId: req.user.id
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Store complaint inside the booking
    if (!booking.complaints) booking.complaints = [];
    
    booking.complaints.push({
      category: category || 'other',
      description: description.trim().slice(0, 2000),
      priority: priority || 'medium',
      status: 'pending',
      createdAt: new Date()
    });

    await booking.save();

    // Notify admin (optional)
    try {
      const notificationService = require('../services/notificationService');
      if (notificationService.sendComplaintNotification) {
        await notificationService.sendComplaintNotification(booking, category);
      }
    } catch (notifError) {
      console.error('Complaint notification failed:', notifError.message);
    }

    res.json({
      success: true,
      message: 'Complaint submitted successfully',
      data: booking.complaints[booking.complaints.length - 1]
    });

  } catch (error) {
    console.error('Complaint error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to submit complaint' });
  }
});

// ============================================
// GET MY COMPLAINTS
// ============================================
router.get('/complaints/my', authenticatePatient, async (req, res) => {
  try {
    const bookings = await AyurvedaBooking.find({
      userId: req.user.id,
      'complaints.0': { $exists: true }
    }).select('bookingId complaints type centerName doctorName');

    const complaints = [];
    bookings.forEach(b => {
      (b.complaints || []).forEach(c => {
        complaints.push({
          bookingId: b.bookingId,
          bookingType: b.type,
          centerName: b.centerName,
          doctorName: b.doctorName,
          ...c.toObject()
        });
      });
    });

    complaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: complaints,
      count: complaints.length
    });
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints' });
  }
});

// ============================================
// GET DOCTOR BOOKINGS
// ============================================
router.get('/doctor/:doctorId', authenticateUser, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { doctor: req.params.doctorId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await AyurvedaBooking.find(query)
      .sort({ bookingDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-otp -razorpaySignature');

    const total = await AyurvedaBooking.countDocuments(query);

    res.json({
      success: true,
      data: bookings,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });

  } catch (error) {
    console.error('Get doctor bookings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// ============================================
// UPDATE BOOKING STATUS (DOCTOR/CENTER)
// ============================================
router.put('/:bookingId/status', authenticateUser, async (req, res) => {
  try {
    const { action } = req.body; // accept, start, complete, no_show

    const booking = await AyurvedaBooking.findOne({ 
      bookingId: req.params.bookingId 
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

        // Check if user is the doctor or center (with flexible ID matching)
    const userIdStr = String(req.user.id || req.user._id || req.user.userId || '');
    const doctorIdStr = booking.doctor ? booking.doctor.toString() : '';
    const centerIdStr = booking.center ? booking.center.toString() : '';

    const isAuthorized = 
      (doctorIdStr && doctorIdStr === userIdStr) ||
      (centerIdStr && centerIdStr === userIdStr);

    if (!isAuthorized) {
      console.error('Status update unauthorized:', {
        userId: userIdStr,
        doctorId: doctorIdStr,
        centerId: centerIdStr,
        role: req.user.role,
        bookingId: req.params.bookingId
      });
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    switch (action) {
                  case 'accept':
        await booking.acceptBooking('doctor');
        break;
        
      case 'start':
        if (!booking.otpVerified) {
          return res.status(400).json({ 
            success: false, 
            message: 'Patient has not verified OTP. Please ask patient for OTP before starting consultation.' 
          });
        }
        await booking.startConsultation();
        break;

	      case 'reject':
        // Only allow reject on pending bookings
        if (booking.status !== 'pending') {
          return res.status(400).json({ success: false, message: 'Only pending bookings can be rejected' });
        }
        
        booking.status = 'cancelled';
        booking.cancelledAt = new Date();
        booking.cancellationReason = req.body.reason || 'Rejected by provider';
        
        await booking.save();
        
        // Decrement package counter
        if (booking.type === 'panchakarma_package' && booking.center && booking.package?.packageId) {
          try {
            await WellnessCenter.updateOne(
              { _id: booking.center, 'packages._id': booking.package.packageId },
              { $inc: { 'packages.$.currentBookings': -1 } }
            );
          } catch (decrementError) {
            console.error('Counter decrement error:', decrementError.message);
          }
        }
        break;
        
      case 'complete':
        await booking.completeConsultation(req.body.prescription);
        break;
        
            case 'no_show':
        await booking.markNoShow();
        
        // Decrement package counter if panchakarma booking
        if (booking.type === 'panchakarma_package' && booking.center && booking.package?.packageId) {
          try {
            await WellnessCenter.updateOne(
              { _id: booking.center, 'packages._id': booking.package.packageId },
              { $inc: { 'packages.$.currentBookings': -1 } }
            );
          } catch (decrementError) {
            console.error('Counter decrement error:', decrementError.message);
          }
        }
        break;
        
      default:
        return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    res.json({
      success: true,
      message: `Booking ${action}ed successfully`,
      data: { status: booking.status }
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to update status' });
  }
});

// ============================================
// PANCHAKARMA BOOKING
// ============================================

// POST /api/ayurveda/bookings/panchakarma
router.post('/panchakarma', authenticatePatient, async (req, res) => {
  try {
    const {
      centerId,
      packageId,
      admissionDate,
      patientName,
      patientPhone,
      patientEmail,
      patientAge,
      patientGender,
      symptoms,
      medicalHistory,
      prakritiType
    } = req.body;

    if (!centerId || !packageId || !admissionDate) {
      return res.status(400).json({ success: false, message: 'Center ID, Package ID, and admission date are required' });
    }

    const WellnessCenter = require('../models/WellnessCenter');
    const center = await WellnessCenter.findById(centerId);
    if (!center) {
      return res.status(404).json({ success: false, message: 'Center not found' });
    }
    if (!center.isActive || center.verificationStatus !== 'approved') {
      return res.status(400).json({ success: false, message: 'Center is not available' });
    }

    const pkg = center.packages?.find(p => p._id.toString() === packageId);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }
    if (!pkg.isActive) {
      return res.status(400).json({ success: false, message: 'Package is not active' });
    }
    if (pkg.currentBookings >= pkg.maxCapacity) {
      return res.status(400).json({ success: false, message: 'Package is full' });
    }

    const amount = pkg.discountPrice || pkg.price;
    const platformFee = 100;
    const gstPercentage = 18;
    const baseAmount = amount;
    const gstAmount = Math.round((baseAmount + platformFee) * gstPercentage / 100);
    const finalAmount = baseAmount + platformFee + gstAmount;
    const platformCommission = Math.round(baseAmount * 15 / 100);
    const providerEarning = baseAmount - platformCommission;

    // Create Razorpay order
    const orderResult = await razorpayService.createOrder(finalAmount, 'INR', `AYU_PK_${Date.now()}`, {
      bookingType: 'panchakarma',
      userId: req.user.id,
      centerId
    });

    if (!orderResult.success) {
      return res.status(500).json({ success: false, message: 'Failed to create payment order' });
    }

    const booking = new AyurvedaBooking({
      userId: req.user.id,
      type: 'panchakarma_package',
      center: centerId,
      centerName: center.name,
      centerPhone: center.phone,
      package: {
        packageId: pkg._id,
        name: pkg.name,
        duration: pkg.duration,
        therapies: pkg.therapies,
        inclusions: pkg.inclusions
      },
      bookingDate: new Date(admissionDate),
      admissionDate: new Date(admissionDate),
      symptoms,
      medicalHistory,
      prakritiType,
      patient: {
        name: patientName || req.user.name || 'Patient',
        phone: patientPhone || req.user.phone || '',
        email: patientEmail || req.user.email || '',
        age: patientAge,
        gender: patientGender
      },
      amount,
      finalAmount,
      platformFee,
      gstAmount,
      platformCommission,
      providerEarning,
      razorpayOrderId: orderResult.order.id,
      status: 'pending'
    });

    booking.bookingId = 'AYU' + Date.now() + Math.floor(Math.random() * 1000);
    booking.generateOtp();
    await booking.save();

    // Increment package booking count
    await WellnessCenter.updateOne(
      { _id: centerId, 'packages._id': pkg._id },
      { $inc: { 'packages.$.currentBookings': 1 } }
    );

    const transaction = new Transaction({
      transactionId: `TXN_AYU_PK_${Date.now()}`,
      type: 'ayurveda_booking',
      bookingType: 'panchakarma',
      bookingId: booking._id,
      userId: req.user.id,
      amount: finalAmount,
      originalAmount: amount,
      platformFee,
      gstAmount,
      platformCommission,
      providerAmount: providerEarning,
      status: 'initiated',
      orderId: orderResult.order.id,
      razorpayOrderId: orderResult.order.id,
      ayurvedaCenterId: centerId
    });

    await transaction.save();

    res.status(201).json({
      success: true,
      message: 'Panchakarma booking created',
      data: {
        bookingId: booking.bookingId,
        razorpayOrderId: orderResult.order.id,
        amount: finalAmount,
        otp: booking.otp
      }
    });

  } catch (error) {
    console.error('Panchakarma booking error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create booking' });
  }
});

// ============================================
// CENTER: VIEW COMPLAINTS ON OWN BOOKINGS
// ============================================
router.get('/center/complaints', authenticateUser, async (req, res) => {
  try {
    const centerObjectId = getUserObjectId(req.user);

    if (!centerObjectId) {
      return res.status(400).json({ success: false, message: 'Invalid user session' });
    }

    const { status, page = 1, limit = 20 } = req.query;

    const query = { 
      center: centerObjectId,
      'complaints.0': { $exists: true }
    };

    const bookings = await AyurvedaBooking.find(query)
      .select('bookingId type patient package centerName complaints review createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean();

    let complaints = [];
    bookings.forEach(b => {
      (b.complaints || []).forEach(c => {
        if (status && c.status !== status) return;
        complaints.push({
          complaintId: c._id,
          bookingId: b.bookingId,
          bookingType: b.type,
          patientName: b.patient?.name || 'Patient',
          patientPhone: b.patient?.phone || '',
          packageName: b.package?.name || '',
          category: c.category,
          description: c.description,
          priority: c.priority,
          status: c.status,
          adminResponse: c.adminResponse || '',
          centerResponse: c.centerResponse || '',
          resolvedAt: c.resolvedAt,
          createdAt: c.createdAt
        });
      });
    });

    complaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = complaints.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginated = complaints.slice(start, start + parseInt(limit));

    res.json({
      success: true,
      data: paginated,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Center complaints error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints' });
  }
});

// ============================================
// CENTER: RESPOND TO COMPLAINT
// ============================================
router.put('/:bookingId/complaint/:complaintId/respond', authenticateUser, async (req, res) => {
  try {
    const { response } = req.body;
    const centerObjectId = getUserObjectId(req.user);

    if (!centerObjectId) {
      return res.status(400).json({ success: false, message: 'Invalid user session' });
    }

    if (!response || response.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Response must be at least 3 characters' });
    }

    const booking = await AyurvedaBooking.findOne({ 
      bookingId: req.params.bookingId,
      center: centerObjectId
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const complaint = booking.complaints.id(req.params.complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    complaint.centerResponse = response.trim().slice(0, 2000);
    complaint.centerRespondedAt = new Date();
    complaint.status = 'in_review';

    await booking.save();

    res.json({
      success: true,
      message: 'Response submitted',
      data: complaint
    });
  } catch (error) {
    console.error('Respond error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to respond' });
  }
});

// ============================================
// CENTER: MARK COMPLAINT RESOLVED
// ============================================
router.put('/:bookingId/complaint/:complaintId/resolve', authenticateUser, async (req, res) => {
  try {
    const centerObjectId = getUserObjectId(req.user);

    if (!centerObjectId) {
      return res.status(400).json({ success: false, message: 'Invalid user session' });
    }

    const booking = await AyurvedaBooking.findOne({ 
      bookingId: req.params.bookingId,
      center: centerObjectId
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const complaint = booking.complaints.id(req.params.complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    complaint.status = 'resolved';
    complaint.resolvedAt = new Date();

    await booking.save();

    res.json({
      success: true,
      message: 'Complaint resolved',
      data: complaint
    });
  } catch (error) {
    console.error('Resolve error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to resolve' });
  }
});

// ============================================
// CENTER: VIEW REVIEWS ON OWN BOOKINGS
// ============================================
router.get('/center/reviews', authenticateUser, async (req, res) => {
  try {
    const centerObjectId = getUserObjectId(req.user);

    if (!centerObjectId) {
      return res.status(400).json({ success: false, message: 'Invalid user session' });
    }

    const { page = 1, limit = 20 } = req.query;

    const bookings = await AyurvedaBooking.find({
      center: centerObjectId,
      reviewed: true
    })
      .select('bookingId type patient package review centerName createdAt')
      .sort({ 'review.createdAt': -1 })
      .lean();

    const reviews = bookings.map(b => ({
      bookingId: b.bookingId,
      bookingType: b.type,
      patientName: b.patient?.name || 'Patient',
      packageName: b.package?.name || '',
      rating: b.review?.rating,
      comment: b.review?.comment,
      centerResponse: b.review?.centerResponse || '',
      centerRespondedAt: b.review?.centerRespondedAt,
      createdAt: b.review?.createdAt
    }));

    const total = reviews.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginated = reviews.slice(start, start + parseInt(limit));

    const avgRating = reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length) * 10) / 10
      : 0;

    res.json({
      success: true,
      data: paginated,
      averageRating: avgRating,
      totalReviews: total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Center reviews error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
});

// ============================================
// GET CENTER BOOKINGS
// ============================================
router.get('/center/:centerId', authenticateUser, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { center: req.params.centerId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await AyurvedaBooking.find(query)
      .sort({ bookingDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-otp -razorpaySignature');

    const total = await AyurvedaBooking.countDocuments(query);

    res.json({
      success: true,
      data: bookings,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });

  } catch (error) {
    console.error('Get center bookings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// ============================================
// CENTER: RESPOND TO REVIEW
// ============================================
router.put('/:bookingId/review/respond', authenticateUser, async (req, res) => {
  try {
    const { response } = req.body;
    const centerObjectId = getUserObjectId(req.user);

    if (!centerObjectId) {
      return res.status(400).json({ success: false, message: 'Invalid user session' });
    }

    if (!response || response.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Response must be at least 3 characters' });
    }

    const booking = await AyurvedaBooking.findOne({
  bookingId: req.params.bookingId,
  center: centerObjectId
});

if (!booking) {
  return res.status(404).json({ success: false, message: 'Booking not found' });
}

if (!booking.review || (!booking.review.rating && !booking.review.comment)) {
  return res.status(404).json({ success: false, message: 'No review exists on this booking' });
}

booking.review = booking.review || {};
booking.review.centerResponse = response.trim().slice(0, 1000);
booking.review.centerRespondedAt = new Date();
booking.markModified('review');

await booking.save();

    res.json({
      success: true,
      message: 'Response submitted',
      data: booking.review
    });
  } catch (error) {
    console.error('Review respond error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to respond' });
  }
});

// ============================================
// ADMIN: VIEW ALL COMPLAINTS
// ============================================
router.get('/admin/complaints', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const { status, page = 1, limit = 50 } = req.query;

    const bookings = await AyurvedaBooking.find({
      'complaints.0': { $exists: true }
    })
      .select('bookingId type patient package centerName center doctor doctorName complaints')
      .sort({ updatedAt: -1 });

    let complaints = [];
    bookings.forEach(b => {
      (b.complaints || []).forEach(c => {
        if (status && c.status !== status) return;
        complaints.push({
          complaintId: c._id,
          bookingId: b.bookingId,
          bookingType: b.type,
          centerId: b.center,
          centerName: b.centerName,
          doctorName: b.doctorName,
          patientName: b.patient?.name,
          patientPhone: b.patient?.phone,
          category: c.category,
          description: c.description,
          priority: c.priority,
          status: c.status,
          centerResponse: c.centerResponse || '',
          adminResponse: c.adminResponse || '',
          resolvedAt: c.resolvedAt,
          createdAt: c.createdAt,
          ageHours: Math.round((Date.now() - new Date(c.createdAt)) / (1000 * 60 * 60))
        });
      });
    });

    complaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = complaints.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginated = complaints.slice(start, start + parseInt(limit));

    res.json({
      success: true,
      data: paginated,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin complaints error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints' });
  }
});

// ============================================
// ADMIN: UPDATE COMPLAINT STATUS
// ============================================
router.put('/admin/complaint/:bookingId/:complaintId', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const { status, adminResponse } = req.body;

    const booking = await AyurvedaBooking.findOne({ bookingId: req.params.bookingId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const complaint = booking.complaints.id(req.params.complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    if (status) complaint.status = status;
    if (adminResponse) complaint.adminResponse = adminResponse.trim().slice(0, 2000);
    if (status === 'resolved') complaint.resolvedAt = new Date();

    await booking.save();

    res.json({
      success: true,
      message: 'Complaint updated',
      data: complaint
    });
  } catch (error) {
    console.error('Admin complaint update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
});

// ============================================
// ADMIN: VIEW ALL REVIEWS
// ============================================
router.get('/admin/reviews', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const { page = 1, limit = 50, minRating, maxRating } = req.query;

    const query = { reviewed: true };
    const bookings = await AyurvedaBooking.find(query)
      .select('bookingId type patient center centerName doctor doctorName review package createdAt')
      .sort({ 'review.createdAt': -1 });

        let reviews = bookings.map(b => ({
      bookingId: b.bookingId,
      bookingType: b.type,
      patientName: b.patient?.name,
      centerName: b.centerName,
      doctorName: b.doctorName,
      packageName: b.package?.name,
      rating: b.review?.rating,
      comment: b.review?.comment,
      centerResponse: b.review?.centerResponse || '',
      isFlagged: b.review?.isFlagged === true,
      isHidden: b.review?.isHidden === true,
      flaggedReason: b.review?.flaggedReason || '',
      flaggedAt: b.review?.flaggedAt || null,
      hiddenReason: b.review?.hiddenReason || '',
      hiddenAt: b.review?.hiddenAt || null,
      createdAt: b.review?.createdAt
    }));

    if (minRating) reviews = reviews.filter(r => r.rating >= parseInt(minRating));
    if (maxRating) reviews = reviews.filter(r => r.rating <= parseInt(maxRating));

    const total = reviews.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginated = reviews.slice(start, start + parseInt(limit));

    const avgRating = reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length) * 10) / 10
      : 0;

    res.json({
      success: true,
      data: paginated,
      averageRating: avgRating,
      totalReviews: total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin reviews error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
});

// ============================================
// PATIENT: GET OWN COMPLAINTS
// ============================================
router.get('/complaints/my', authenticatePatient, async (req, res) => {
  try {
    const bookings = await AyurvedaBooking.find({
      userId: req.user.id,
      'complaints.0': { $exists: true }
    }).select('bookingId complaints type centerName doctorName package createdAt');

    const complaints = [];
    bookings.forEach(b => {
      (b.complaints || []).forEach(c => {
        complaints.push({
          complaintId: c._id,
          bookingId: b.bookingId,
          bookingType: b.type,
          centerName: b.centerName,
          doctorName: b.doctorName,
          packageName: b.package?.name,
          category: c.category,
          description: c.description,
          priority: c.priority,
          status: c.status,
          centerResponse: c.centerResponse || '',
          adminResponse: c.adminResponse || '',
          resolvedAt: c.resolvedAt,
          createdAt: c.createdAt
        });
      });
    });

    complaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, data: complaints, count: complaints.length });
  } catch (error) {
    console.error('Patient complaints error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints' });
  }
});

// ============================================
// ADMIN: Reset a review (in case of bad state)
// ============================================
router.put('/admin/reset-review/:bookingId', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }
  try {
    const booking = await AyurvedaBooking.findOne({ bookingId: req.params.bookingId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    booking.reviewed = false;
    booking.review = undefined;
    booking.markModified('review');
    await booking.save();
    res.json({ success: true, message: 'Review reset', data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ADMIN: GET ALL BOOKINGS
// ============================================
router.get('/admin/all', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const { status, type, page = 1, limit = 50 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await AyurvedaBooking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-otp -razorpaySignature -razorpaySignature')
      .lean();

    const total = await AyurvedaBooking.countDocuments(query);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin bookings error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// ============================================
// ADMIN: GET ALL REVIEWS
// ============================================
router.get('/admin/reviews/all', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const { page = 1, limit = 50 } = req.query;

        const bookings = await AyurvedaBooking.find({})
      .sort({ 'review.createdAt': -1 })
      .select('bookingId type patient doctorName centerName review package createdAt')
      .lean();

    const reviews = bookings
      .filter(b => b.review && (b.review.rating || b.review.comment))
        .map(b => ({
        bookingId: b.bookingId,
        bookingType: b.type,
        patientName: b.patient?.name || 'Patient',
        doctorName: b.doctorName || '',
        centerName: b.centerName || '',
        packageName: b.package?.name || '',
        rating: b.review?.rating,
        comment: b.review?.comment,
        doctorResponse: b.review?.doctorResponse || '',
        centerResponse: b.review?.centerResponse || '',
        isFlagged: b.review?.isFlagged === true,
        isHidden: b.review?.isHidden === true,
        flaggedReason: b.review?.flaggedReason || '',
        flaggedAt: b.review?.flaggedAt || null,
        hiddenReason: b.review?.hiddenReason || '',
        hiddenAt: b.review?.hiddenAt || null,
        createdAt: b.review?.createdAt
      }));

    const total = reviews.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginated = reviews.slice(skip, skip + parseInt(limit));

    const avgRating = reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length) * 10) / 10
      : 0;

    res.json({
      success: true,
      data: paginated,
      averageRating: avgRating,
      totalReviews: total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin reviews error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
});

// ============================================
// ADMIN: FLAG REVIEW
// ============================================
router.put('/admin/reviews/:bookingId/flag', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const { reason } = req.body;
    const booking = await AyurvedaBooking.findOne({ bookingId: req.params.bookingId });
    if (!booking || !booking.review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    booking.review.isFlagged = true;
    booking.review.flaggedReason = (reason || 'Flagged by admin').slice(0, 500);
    booking.review.flaggedAt = new Date();
    booking.markModified('review');
    await booking.save();

    res.json({ success: true, message: 'Review flagged', data: booking.review });
  } catch (error) {
    console.error('[admin.review.flag]', error.message);
    res.status(500).json({ success: false, message: 'Failed to flag review' });
  }
});

// ============================================
// ADMIN: UNFLAG REVIEW
// ============================================
router.put('/admin/reviews/:bookingId/unflag', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const booking = await AyurvedaBooking.findOne({ bookingId: req.params.bookingId });
    if (!booking || !booking.review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    booking.review.isFlagged = false;
    booking.review.flaggedReason = '';
    booking.review.flaggedAt = null;
    booking.markModified('review');
    await booking.save();

    res.json({ success: true, message: 'Review unflagged', data: booking.review });
  } catch (error) {
    console.error('[admin.review.unflag]', error.message);
    res.status(500).json({ success: false, message: 'Failed to unflag review' });
  }
});

// ============================================
// ADMIN: HIDE / RESTORE REVIEW
// ============================================
router.put('/admin/reviews/:bookingId/hide', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const { reason, unhide } = req.body;
    const booking = await AyurvedaBooking.findOne({ bookingId: req.params.bookingId });
    if (!booking || !booking.review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (unhide === true) {
      booking.review.isHidden = false;
      booking.review.hiddenReason = '';
      booking.review.hiddenAt = null;
    } else {
      booking.review.isHidden = true;
      booking.review.hiddenReason = (reason || 'Hidden by admin').slice(0, 500);
      booking.review.hiddenAt = new Date();
    }
    booking.markModified('review');
    await booking.save();

    res.json({
      success: true,
      message: unhide ? 'Review restored' : 'Review hidden',
      data: booking.review
    });
  } catch (error) {
    console.error('[admin.review.hide]', error.message);
    res.status(500).json({ success: false, message: 'Failed to update review' });
  }
});

// ============================================
// ADMIN: FORCE CANCEL BOOKING
// Safe decrement of package counter on admin cancel
// ============================================
router.put('/admin/force-cancel/:bookingId', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const { reason } = req.body;

    const booking = await AyurvedaBooking.findOne({ bookingId: req.params.bookingId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking already cancelled' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed booking' });
    }

    // Track if this booking contributed to a package counter
    const wasActiveBooking = 
      booking.type === 'panchakarma_package' &&
      booking.center &&
      booking.package?.packageId &&
      ['pending', 'confirmed', 'in_progress'].includes(booking.status);

    // Cancel the booking
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason || 'Cancelled by admin';
    booking.cancellation = {
      cancelledAt: new Date(),
      reason: reason || 'Cancelled by admin',
      cancelledBy: 'admin',
      refundStatus: 'pending',
      refundAmount: booking.finalAmount, // Admin cancel = full refund
      refundPercentage: 100,
      cancellationFee: 0
    };

    booking.statusHistory = booking.statusHistory || [];
    booking.statusHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      note: `Force-cancelled by admin. Reason: ${reason || 'Not specified'}`,
      updatedBy: 'admin'
    });

    await booking.save();

    // Decrement package counter if this was an active package booking
    if (wasActiveBooking) {
      try {
        const WellnessCenter = require('../models/WellnessCenter');
        const result = await WellnessCenter.updateOne(
          {
            _id: booking.center,
            'packages._id': booking.package.packageId
          },
          {
            $inc: { 'packages.$.currentBookings': -1 }
          }
        );
        console.log(`[admin.cancel] Package counter decremented for booking ${booking.bookingId}`, result);
      } catch (decrementError) {
        console.error('[admin.cancel] Counter decrement failed (non-fatal):', decrementError.message);
      }
    }

    res.json({
      success: true,
      message: 'Booking force-cancelled by admin',
      data: {
        bookingId: booking.bookingId,
        status: booking.status,
        cancelledAt: booking.cancelledAt,
        refundAmount: booking.cancellation.refundAmount,
        packageCounterAdjusted: wasActiveBooking
      }
    });

  } catch (error) {
    console.error('Admin force-cancel error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to cancel booking' });
  }
});

// ============================================
// ADMIN: MARK BOOKING AS NO-SHOW
// Used when patient didn't show up (booking date has passed)
// No refund to patient — provider keeps earning
// ============================================
router.put('/admin/mark-no-show/:bookingId', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const { reason } = req.body;

    const booking = await AyurvedaBooking.findOne({ bookingId: req.params.bookingId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Validate booking state
    if (booking.status === 'no_show') {
      return res.status(400).json({ success: false, message: 'Booking is already marked as no-show' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot mark a completed booking as no-show' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot mark a cancelled booking as no-show' });
    }

    // Check payment
    if (booking.paymentStatus !== 'paid' && booking.paymentStatus !== 'partial_refund') {
      return res.status(400).json({ success: false, message: 'Cannot mark unpaid booking as no-show' });
    }

    // Business rule: no-show can only be marked AFTER booking date
    const bookingDate = new Date(booking.bookingDate);
    const now = new Date();
    if (bookingDate > now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot mark no-show before the scheduled booking date. Use force-cancel for future bookings.'
      });
    }

    // Was this an active booking that contributed to a package counter?
    const wasActiveBooking = 
      booking.type === 'panchakarma_package' &&
      booking.center &&
      booking.package?.packageId &&
      ['pending', 'confirmed', 'in_progress'].includes(booking.status);

    // Update booking
    booking.status = 'no_show';
    booking.noShowAt = new Date();
    booking.noShowReason = reason || 'Patient did not attend appointment';
    booking.cancellationReason = `No-show: ${reason || 'Patient did not attend'}`;

    booking.statusHistory = booking.statusHistory || [];
    booking.statusHistory.push({
      status: 'no_show',
      timestamp: new Date(),
      note: `Marked as no-show by admin. Reason: ${reason || 'Patient did not attend'}`,
      updatedBy: 'admin'
    });

    // Patient earns nothing back — provider keeps full earning
    // Payment status stays as 'paid' (not refunded)
    // providerEarning remains as calculated

    await booking.save();

    // Decrement package counter
    if (wasActiveBooking) {
      try {
        const WellnessCenter = require('../models/WellnessCenter');
        const result = await WellnessCenter.updateOne(
          {
            _id: booking.center,
            'packages._id': booking.package.packageId
          },
          { $inc: { 'packages.$.currentBookings': -1 } }
        );
        console.log(`[admin.no_show] Counter decremented for ${booking.bookingId}`, result);
      } catch (err) {
        console.error('[admin.no_show] Counter decrement failed:', err.message);
      }
    }

    // Optional: Send no-show notification to patient (informational)
    try {
      if (booking.patient?.phone) {
        const smsService = require('../services/smsService');
        await smsService.sendSMS(
          booking.patient.phone,
          `Your appointment on ${new Date(booking.bookingDate).toLocaleDateString()} was marked as no-show. Booking ID: ${booking.bookingId}. As per our policy, no refund is applicable for no-shows. - KiaetoCare`
        );
      }
    } catch (smsErr) {
      console.warn('No-show SMS failed (non-fatal):', smsErr.message);
    }

    console.log(`[admin.no_show] Booking ${booking.bookingId} marked as no-show by admin`);

    res.json({
      success: true,
      message: 'Booking marked as no-show. No refund issued. Provider earning protected.',
      data: {
        bookingId: booking.bookingId,
        status: booking.status,
        noShowAt: booking.noShowAt,
        refundAmount: 0,
        providerEarning: booking.providerEarning,
        packageCounterAdjusted: wasActiveBooking
      }
    });

  } catch (error) {
    console.error('Admin mark no-show error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to mark no-show' });
  }
});

// ============================================
// ADMIN: GET ALL COMPLAINTS
// ============================================
router.get('/admin/complaints/all', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const { status, page = 1, limit = 50 } = req.query;

    const bookings = await AyurvedaBooking.find({
      'complaints.0': { $exists: true }
    })
      .sort({ updatedAt: -1 })
      .select('bookingId type patient doctorName centerName complaints package')
      .lean();

    let complaints = [];
    bookings.forEach(b => {
      (b.complaints || []).forEach(c => {
        if (status && c.status !== status) return;
        complaints.push({
          complaintId: c._id,
          bookingId: b.bookingId,
          bookingType: b.type,
          patientName: b.patient?.name || 'Patient',
          patientPhone: b.patient?.phone || '',
          doctorName: b.doctorName || '',
          centerName: b.centerName || '',
          packageName: b.package?.name || '',
          category: c.category,
          description: c.description,
          priority: c.priority,
          status: c.status,
          doctorResponse: c.doctorResponse || '',
          centerResponse: c.centerResponse || '',
          adminResponse: c.adminResponse || '',
          resolvedAt: c.resolvedAt,
          createdAt: c.createdAt,
          ageHours: Math.round((Date.now() - new Date(c.createdAt)) / (1000 * 60 * 60))
        });
      });
    });

    complaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = complaints.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginated = complaints.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: paginated,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin complaints error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints' });
  }
});

// ============================================
// ADMIN: UPDATE COMPLAINT
// ============================================
// ============================================
// ADMIN: UPDATE COMPLAINT
// ============================================
router.put('/admin/complaints/:bookingId/:complaintId', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const { status, adminResponse } = req.body;

    const booking = await AyurvedaBooking.findOne({ bookingId: req.params.bookingId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const complaint = booking.complaints.id(req.params.complaintId);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    // Track prior status for notification logic
    const previousStatus = complaint.status;

    if (status) complaint.status = status;
    if (adminResponse) complaint.adminResponse = adminResponse.trim().slice(0, 2000);
    if (status === 'resolved') complaint.resolvedAt = new Date();

    // Auto-upgrade priority on escalation
    if (status === 'escalated' && previousStatus !== 'escalated') {
      const priorityRank = { low: 1, medium: 2, high: 3, critical: 4 };
      const currentRank = priorityRank[complaint.priority] || 2;
      if (currentRank < 3) {
        complaint.priority = 'high';
      }
    }

    await booking.save();

    // ============================================
    // NOTIFY PROVIDER ON ESCALATION (non-blocking)
    // ============================================
    if (status === 'escalated' && previousStatus !== 'escalated') {
      try {
        const notificationService = require('../services/notificationService');
        const smsService = require('../services/smsService');

        const notificationMessage = 
          `Complaint on your booking ${booking.bookingId} has been ESCALATED for priority review. ` +
          `Please respond to the complaint within 24 hours to avoid potential penalties.`;

        // Notify doctor
        if (booking.doctor && booking.doctorPhone) {
          try {
            await smsService.sendSms(booking.doctorPhone, notificationMessage);
          } catch (smsErr) {
            console.warn('Doctor escalation SMS failed:', smsErr.message);
          }
        }

        // Notify center
        if (booking.center && booking.centerPhone) {
          try {
            await smsService.sendSms(booking.centerPhone, notificationMessage);
          } catch (smsErr) {
            console.warn('Center escalation SMS failed:', smsErr.message);
          }
        }

        // In-app notification via notificationService if available
        if (notificationService && typeof notificationService.sendComplaintEscalation === 'function') {
          try {
            await notificationService.sendComplaintEscalation(booking, complaint);
          } catch (notifErr) {
            console.warn('Escalation notification failed:', notifErr.message);
          }
        }

        console.log(`[escalation.notify] Booking ${booking.bookingId} — provider notified`);
      } catch (notifyError) {
        // Never fail the request due to notification errors
        console.error('Escalation notify error (non-fatal):', notifyError.message);
      }
    }

    res.json({ success: true, message: 'Complaint updated', data: complaint });
  } catch (error) {
    console.error('Admin complaint update error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update complaint' });
  }
});

// ============================================
// ADMIN: GET ALL DISCOUNTS (Ayurveda scope)
// ============================================
router.get('/admin/discounts', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  try {
    const Discount = require('../models/Discount');
    const discounts = await Discount.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json({ success: true, data: discounts, total: discounts.length });
  } catch (error) {
    console.error('Admin discounts error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch discounts' });
  }
});


module.exports = router;
// D:\hospital backend\routes\homeopathy-booking.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const HomeopathyBooking = require('../models/HomeopathyBooking');
const HomeopathyDoctor = require('../models/HomeopathyDoctor');
const NaturopathyCenter = require('../models/NaturopathyCenter');
const Pharmacy = require('../models/Pharmacy');
const Transaction = require('../models/Transaction');
const Discount = require('../models/Discount');
const pricingService = require('../services/pricingService');
const cancellationService = require('../services/cancellationPolicyService');
const razorpayService = require('../services/razorpayService');
const notificationService = require('../services/notificationService');
const smsService = require('../services/smsService');

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

const authenticatePatient = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Please login as a patient to continue' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'patient') {
      return res.status(403).json({
        success: false,
        message: `Patient access required. You are logged in as ${decoded.role}.`
      });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && adminKey === process.env.ADMIN_KEY) return next();

  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin') return next();
    } catch (e) {}
  }
  return res.status(401).json({ success: false, message: 'Admin authentication required' });
};

const getUserObjectId = (user) => {
  const idStr = user?.id || user?._id || user?.userId;
  if (!idStr) return null;
  try {
    return new mongoose.Types.ObjectId(String(idStr));
  } catch (e) {
    return null;
  }
};

// ============================================
// PRICING PREVIEW
// ============================================
router.post('/pricing-preview', async (req, res) => {
  try {
    const {
      bookingType, amount, discountAmount = 0,
      providerId = null, providerModel = null,
      city = null, state = null
    } = req.body;

    if (!bookingType || typeof amount !== 'number') {
      return res.status(400).json({ success: false, message: 'bookingType and amount are required' });
    }

    const pricing = await pricingService.calculatePricing({
      bookingType, amount, discountAmount,
      providerId, providerModel, city, state
    });

    res.json({ success: true, data: pricing });
  } catch (error) {
    console.error('[homeopathy.pricing-preview]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CREATE BOOKING
// ============================================
router.post('/create', authenticatePatient, async (req, res) => {
  try {
    // Slot lock check (fail-open)
    const { doctorId: _did, centerId: _cid, bookingDate: _bdate, slotTime: _slot } = req.body;
    if (_bdate && _slot && (_did || _cid)) {
      try {
        const redis = global.redisClient;
        if (redis && redis.status === 'ready') {
          const dateStr = new Date(_bdate).toISOString().split('T')[0];
          const providerKey = _did || _cid;
          const lockKey = `slot-lock:hom:${providerKey}:${dateStr}:${_slot}`;
          const existingLock = await redis.get(lockKey);
          if (existingLock) {
            return res.status(409).json({
              success: false,
              message: 'This slot is being booked by another patient. Please try again in a few minutes.',
              code: 'SLOT_LOCKED'
            });
          }
        }
      } catch (lockCheckErr) {
        console.warn('[homeopathy.slot-lock] Check failed (proceeding):', lockCheckErr.message);
      }
    }

    const {
      type, doctorId, centerId, pharmacyId, consultationType,
      bookingDate, slotTime, symptoms, medicalHistory,
      patientName, patientPhone, patientEmail, patientAge, patientGender,
      discountCode, medicines, deliveryAddress, packageId
    } = req.body;

    if (!type || !bookingDate) {
      return res.status(400).json({ success: false, message: 'Booking type and date are required' });
    }

    let amount = 0;
    let doctor = null;
    let center = null;
    let pharmacy = null;
    let packageDetails = null;
    let medicineDetails = null;

    // ── DOCTOR CONSULTATION ──
    if (type === 'homeopathy_consult') {
      if (!doctorId) {
        return res.status(400).json({ success: false, message: 'Doctor ID is required' });
      }
      doctor = await HomeopathyDoctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({ success: false, message: 'Doctor not found' });
      }
      if (!doctor.isActive || doctor.verificationStatus !== 'approved') {
        return res.status(400).json({ success: false, message: 'Doctor is not available' });
      }
      amount = req.body.amount || doctor.consultationFee;
    }
    // ── NATUROPATHY CENTER PACKAGE ──
    else if (type === 'naturopathy_center') {
      if (!centerId || !packageId) {
        return res.status(400).json({ success: false, message: 'Center ID and Package ID are required' });
      }
      center = await NaturopathyCenter.findById(centerId);
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
      if (!pkg.isActive || pkg.approvalStatus !== 'approved') {
        return res.status(400).json({ success: false, message: 'Package not available' });
      }
      if ((pkg.currentBookings || 0) >= (pkg.maxCapacity || 5)) {
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
    // ── MEDICINE ORDER ──
    else if (type === 'homeopathy_medicine') {
      if (!pharmacyId) {
        return res.status(400).json({ success: false, message: 'Pharmacy ID is required' });
      }
      if (!Array.isArray(medicines) || medicines.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one medicine is required' });
      }
      if (!deliveryAddress) {
        return res.status(400).json({ success: false, message: 'Delivery address is required' });
      }
      pharmacy = await Pharmacy.findById(pharmacyId);
      if (!pharmacy) {
        return res.status(404).json({ success: false, message: 'Pharmacy not found' });
      }
      if (!pharmacy.isActive || pharmacy.verificationStatus !== 'approved') {
        return res.status(400).json({ success: false, message: 'Pharmacy is not available' });
      }

      // Calculate amount from medicines
      amount = 0;
      medicineDetails = medicines.map(m => {
        const item = (pharmacy.medicines || []).find(
          med => med.name === m.name && med.potency === m.potency
        );
        if (!item) {
          throw new Error(`Medicine not found: ${m.name} ${m.potency || ''}`);
        }
        const price = item.price || 0;
        const qty = Math.max(1, parseInt(m.quantity) || 1);
        amount += price * qty;
        return {
          name: m.name,
          potency: m.potency || '',
          quantity: qty,
          price
        };
      });
    }
    else {
      return res.status(400).json({ success: false, message: 'Invalid booking type' });
    }

    // ── DISCOUNT ──
    let discountAmount = 0;
    let discountDetails = {};
    let providerCity = null;
    let providerState = null;
    let providerModel = null;

    if (type === 'homeopathy_consult') {
      providerCity = doctor?.address?.city;
      providerState = doctor?.address?.state;
      providerModel = 'HomeopathyDoctor';
    } else if (type === 'naturopathy_center') {
      providerCity = center?.address?.city;
      providerState = center?.address?.state;
      providerModel = 'NaturopathyCenter';
    } else if (type === 'homeopathy_medicine') {
      providerCity = pharmacy?.address?.city;
      providerState = pharmacy?.address?.state;
      providerModel = 'Pharmacy';
    }

        if (discountCode) {
      const discount = await Discount.findByCode(discountCode);
      if (!discount) {
        return res.status(400).json({ success: false, message: 'Invalid discount code' });
      }

      // Map homeopathy booking type → tag names the discount model understands
      const homeopathyTags = [];
      if (type === 'homeopathy_consult')      homeopathyTags.push('homeopathy_consultation', 'homeopathy_consult');
      if (type === 'homeopathy_medicine')     homeopathyTags.push('homeopathy_medicine');
      if (type === 'naturopathy_center')      homeopathyTags.push('naturopathy_center');
      homeopathyTags.push('homeopathy_all');

      const applicableTags = discount.applicableTags || [];
      const isCompatible =
        applicableTags.includes('all') ||
        applicableTags.includes('homeopathy_all') ||
        applicableTags.some(tag => homeopathyTags.includes(tag));

      if (!isCompatible) {
        return res.status(400).json({
          success: false,
          message: 'This discount is not applicable to Homeopathy services'
        });
      }

      const canApply = discount.canApply(amount, type, req.user.id, {
        city: providerCity,
        state: providerState,
        providerId: doctorId || centerId || pharmacyId
      });

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
    }

    // ── PRICING ──
    let pricing;
    try {
      pricing = await pricingService.calculatePricing({
        bookingType: type,
        amount,
        discountAmount,
        providerId: doctorId || centerId || pharmacyId,
        providerModel,
        city: providerCity,
        state: providerState
      });
    } catch (priceErr) {
      console.error('[homeopathy.booking.create] pricing failed:', priceErr.message);
      return res.status(503).json({
        success: false,
        message: 'Booking temporarily unavailable. Admin has not configured pricing.',
        code: 'PRICING_NOT_CONFIGURED'
      });
    }

    const {
      platformFee, gstAmount, total: finalAmount,
      platformCommission, providerEarning
    } = pricing;

        // ── RAZORPAY ORDER ──
    if (!process.env.RAZORPAY_KEY_ID) {
      console.error('[homeopathy.booking.create] RAZORPAY_KEY_ID missing');
      return res.status(503).json({
        success: false,
        message: 'Payment gateway not configured. Please contact support.',
        code: 'RAZORPAY_NOT_CONFIGURED'
      });
    }

      const orderResult = await razorpayService.createOrder(
      finalAmount,
      'INR',
      `HOM_${Date.now()}`,
      {
        bookingType: type,
        userId: req.user.id,
        doctorId: doctorId || '',
        centerId: centerId || '',
        pharmacyId: pharmacyId || ''
      }
    );

    if (!orderResult.success) {
      return res.status(500).json({ success: false, message: 'Failed to create payment order' });
    }

    // ── CREATE BOOKING ──
    const booking = new HomeopathyBooking({
      userId: req.user.id,
      type,
      doctor: doctorId || null,
      doctorName: doctor?.name || '',
      doctorPhone: doctor?.phone || '',
      doctorSpecialization: doctor?.specialization || '',
      center: centerId || null,
      centerName: center?.name || '',
      centerPhone: center?.phone || '',
      pharmacy: pharmacyId || null,
      pharmacyName: pharmacy?.businessName || '',
      pharmacyPhone: pharmacy?.phone || '',
      medicines: medicineDetails || [],
      deliveryAddress: deliveryAddress || '',
      consultationType: consultationType || 'online',
      package: packageDetails,
      bookingDate: new Date(bookingDate),
      slotTime,
      symptoms,
      medicalHistory,
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

    booking.bookingId = 'HOM' + Date.now() + Math.floor(Math.random() * 1000);
    booking.generateOtp();
    await booking.save();

    // ── SET SLOT LOCK ──
    if (bookingDate && slotTime && (doctorId || centerId)) {
      try {
        const redis = global.redisClient;
        if (redis && redis.status === 'ready') {
          const dateStr = new Date(bookingDate).toISOString().split('T')[0];
          const providerKey = doctorId || centerId;
          const lockKey = `slot-lock:hom:${providerKey}:${dateStr}:${slotTime}`;
          await redis.set(lockKey, booking.bookingId, 'EX', 900);
        }
      } catch (lockSetErr) {
        console.warn('[homeopathy.slot-lock] Set failed:', lockSetErr.message);
      }
    }

    // ── INCREMENT PACKAGE COUNTER ──
    if (type === 'naturopathy_center' && centerId && packageId) {
      await NaturopathyCenter.updateOne(
        { _id: centerId, 'packages._id': packageId },
        { $inc: { 'packages.$.currentBookings': 1 } }
      );
    }

    // ── NOTIFICATION ──
    try {
      await notificationService.sendBookingConfirmation(booking);
    } catch (notifError) {
      console.error('Notification failed:', notifError.message);
    }

    // ── TRANSACTION ──
    const transaction = new Transaction({
      transactionId: `TXN_HOM_${Date.now()}`,
      type: 'homeopathy_booking',
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
      providerId: doctorId || centerId || pharmacyId
    });

    await transaction.save();

    // ── SMS ──
    try {
      await smsService.sendSms(
        patientPhone || req.user.phone,
        `Your Homeopathy booking ${booking.bookingId} is pending payment. OTP: ${booking.otp}`
      );
    } catch (smsError) {
      console.error('SMS failed:', smsError.message);
    }

        res.status(201).json({
      success: true,
      message: 'Booking created. Please complete payment.',
      data: {
        bookingId: booking.bookingId,
        razorpayOrderId: orderResult.order.id,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        amount: finalAmount,
        currency: 'INR',
        otp: booking.otp,
        booking
      }
    });

  } catch (error) {
    console.error('Homeopathy booking creation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create booking' });
  }
});

// ============================================
// VERIFY PAYMENT
// ============================================
router.post('/verify-payment', authenticatePatient, async (req, res) => {
  try {
    const { bookingId, razorpayPaymentId, razorpaySignature } = req.body;

    const booking = await HomeopathyBooking.findOne({ bookingId, userId: req.user.id });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

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

    booking.paymentStatus = 'paid';
    booking.razorpayPaymentId = razorpayPaymentId;
    booking.razorpaySignature = razorpaySignature;
    booking.paidAt = new Date();
    booking.transactionId = `TXN_HOM_${Date.now()}`;
    booking.otpVerified = false;
    await booking.save();

    await Transaction.findOneAndUpdate(
      { orderId: booking.razorpayOrderId },
      {
        status: 'completed',
        paymentId: razorpayPaymentId,
        razorpayPaymentId,
        paidAt: new Date()
      }
    );

    if (booking.doctor) {
      await HomeopathyDoctor.findByIdAndUpdate(booking.doctor, {
        $inc: { 'stats.totalConsultations': 1 }
      });
    }
    if (booking.center) {
      await NaturopathyCenter.findByIdAndUpdate(booking.center, {
        $inc: { 'stats.totalBookings': 1 }
      });
    }
    if (booking.pharmacy) {
      await Pharmacy.findByIdAndUpdate(booking.pharmacy, {
        $inc: { totalOrders: 1 }
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
    console.error('Homeopathy payment verification error:', error);
    res.status(500).json({ success: false, message: error.message || 'Payment verification failed' });
  }
});

// ============================================
// VERIFY OTP
// ============================================
router.post('/verify-otp', authenticatePatient, async (req, res) => {
  try {
    const { bookingId, otp } = req.body;

    const booking = await HomeopathyBooking.findOne({ bookingId, userId: req.user.id });
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
    console.error('Homeopathy OTP verification error:', error);
    res.status(400).json({ success: false, message: error.message || 'OTP verification failed' });
  }
});

// ============================================
// RESEND OTP
// ============================================
router.post('/resend-otp', authenticatePatient, async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await HomeopathyBooking.findOne({ bookingId, userId: req.user.id });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const newOtp = booking.generateOtp();
    await booking.save();

    try {
      await smsService.sendSms(
        booking.patient.phone,
        `Your new OTP for booking ${booking.bookingId} is: ${newOtp}`
      );
    } catch (smsError) {
      console.error('SMS failed:', smsError.message);
    }

    res.json({ success: true, message: 'OTP resent successfully', data: { otp: newOtp } });

  } catch (error) {
    console.error('Homeopathy resend OTP error:', error);
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

    const bookings = await HomeopathyBooking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await HomeopathyBooking.countDocuments(query);

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
    console.error('Homeopathy get bookings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// ============================================
// PATIENT: GET MY COMPLAINTS
// (single canonical route — no duplicate like Ayurveda)
// ============================================
router.get('/complaints/my', authenticatePatient, async (req, res) => {
  try {
    const bookings = await HomeopathyBooking.find({
      userId: req.user.id,
      'complaints.0': { $exists: true }
    }).select('bookingId complaints type centerName doctorName pharmacyName package createdAt');

    const complaints = [];
    bookings.forEach(b => {
      (b.complaints || []).forEach(c => {
        complaints.push({
          complaintId: c._id,
          bookingId: b.bookingId,
          bookingType: b.type,
          centerName: b.centerName,
          doctorName: b.doctorName,
          pharmacyName: b.pharmacyName,
          packageName: b.package?.name,
          category: c.category,
          description: c.description,
          priority: c.priority,
          status: c.status,
          centerResponse: c.centerResponse || '',
          doctorResponse: c.doctorResponse || '',
          pharmacyResponse: c.pharmacyResponse || '',
          adminResponse: c.adminResponse || '',
          resolvedAt: c.resolvedAt,
          createdAt: c.createdAt
        });
      });
    });

    complaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, data: complaints, count: complaints.length });
  } catch (error) {
    console.error('Homeopathy patient complaints error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints' });
  }
});

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

    const bookings = await HomeopathyBooking.find({
      doctor: doctorObjectId,
      'complaints.0': { $exists: true }
    })
      .select('bookingId type patient complaints review createdAt updatedAt')
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
          category: c.category,
          description: c.description,
          priority: c.priority,
          status: c.status,
          adminResponse: c.adminResponse || '',
          doctorResponse: c.doctorResponse || '',
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
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Homeopathy doctor complaints error:', error.message);
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

    const booking = await HomeopathyBooking.findOne({
      bookingId: req.params.bookingId,
      doctor: doctorObjectId
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const complaint = booking.complaints.id(req.params.complaintId);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    complaint.doctorResponse = response.trim().slice(0, 2000);
    complaint.doctorRespondedAt = new Date();
    if (complaint.status === 'pending') complaint.status = 'in_review';

    await booking.save();
    res.json({ success: true, message: 'Response submitted', data: complaint });
  } catch (error) {
    console.error('Homeopathy doctor respond error:', error.message);
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

    const booking = await HomeopathyBooking.findOne({
      bookingId: req.params.bookingId,
      doctor: doctorObjectId
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const complaint = booking.complaints.id(req.params.complaintId);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    complaint.status = 'resolved';
    complaint.resolvedAt = new Date();
    await booking.save();

    res.json({ success: true, message: 'Complaint resolved', data: complaint });
  } catch (error) {
    console.error('Homeopathy doctor resolve error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to resolve' });
  }
});

// ============================================
// DOCTOR: VIEW REVIEWS
// ============================================
router.get('/doctor/reviews', authenticateUser, async (req, res) => {
  try {
    const doctorObjectId = getUserObjectId(req.user);
    if (!doctorObjectId) {
      return res.status(400).json({ success: false, message: 'Invalid user session' });
    }

    const { page = 1, limit = 20 } = req.query;

    const bookings = await HomeopathyBooking.find({
      doctor: doctorObjectId
    })
      .select('bookingId type patient review createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const reviewedBookings = bookings.filter(b =>
      b.review && (b.review.rating || b.review.comment || b.review.createdAt)
    );

    const reviews = reviewedBookings.map(b => ({
      bookingId: b.bookingId,
      bookingType: b.type,
      patientName: b.patient?.name || 'Patient',
      rating: b.review?.rating,
      comment: b.review?.comment,
      doctorResponse: b.review?.doctorResponse || '',
      doctorRespondedAt: b.review?.doctorRespondedAt,
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
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Homeopathy doctor reviews error:', error.message);
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

    const booking = await HomeopathyBooking.findOne({
      bookingId: req.params.bookingId,
      doctor: doctorObjectId
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!booking.review || (!booking.review.rating && !booking.review.comment)) {
      return res.status(404).json({ success: false, message: 'No review exists on this booking' });
    }

    booking.review = booking.review || {};
    booking.review.doctorResponse = response.trim().slice(0, 1000);
    booking.review.doctorRespondedAt = new Date();
    booking.markModified('review');
    await booking.save();

    res.json({ success: true, message: 'Response submitted', data: booking.review });
  } catch (error) {
    console.error('Homeopathy doctor review respond error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to respond' });
  }
});

// ============================================
// GET BOOKING DETAILS
// ============================================
router.get('/:bookingId', authenticateUser, async (req, res) => {
  try {
    const booking = await HomeopathyBooking.findOne({ bookingId: req.params.bookingId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const userId = req.user.id;
    const isOwner =
      booking.userId?.toString() === userId ||
      booking.doctor?.toString() === userId ||
      booking.center?.toString() === userId ||
      booking.pharmacy?.toString() === userId;

    if (!isOwner) return res.status(403).json({ success: false, message: 'Access denied' });

    const data = booking.toObject();

    if (booking.doctor) {
      try {
        const doctor = await HomeopathyDoctor.findById(booking.doctor)
          .select('name specialization consultationFee rating address')
          .lean();
        data.doctor = doctor || null;
      } catch (e) { console.error('Doctor fetch error:', e.message); }
    }
    if (booking.center) {
      try {
        const center = await NaturopathyCenter.findById(booking.center)
          .select('name address rating facilities')
          .lean();
        data.center = center || null;
      } catch (e) { console.error('Center fetch error:', e.message); }
    }
    if (booking.pharmacy) {
      try {
        const pharmacy = await Pharmacy.findById(booking.pharmacy)
          .select('businessName address rating')
          .lean();
        data.pharmacy = pharmacy || null;
      } catch (e) { console.error('Pharmacy fetch error:', e.message); }
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Homeopathy get booking error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch booking' });
  }
});

// ============================================
// GET CANCELLATION QUOTE
// ============================================
router.get('/:bookingId/cancellation-quote', authenticatePatient, async (req, res) => {
  try {
    const booking = await HomeopathyBooking.findOne({
      bookingId: req.params.bookingId,
      userId: req.user.id
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status === 'cancelled') return res.status(400).json({ success: false, message: 'Booking already cancelled' });

    const info = cancellationService.calculateAyurvedaCancellation
      ? cancellationService.calculateAyurvedaCancellation(booking)
      : booking.refundEligibility;

    res.json({
      success: true,
      data: {
        bookingId: booking.bookingId,
        canCancel: info.canCancel !== false,
        cancellationFee: info.cancellationFee || 0,
        refundAmount: info.refundAmount || (info.eligible ? Math.round(booking.finalAmount * info.percentage / 100) : 0),
        refundPercentage: info.refundPercentage || info.percentage || 0,
        reason: info.reason || info.label || '',
        totalAmount: booking.finalAmount,
        bookingDate: booking.bookingDate
      }
    });
  } catch (error) {
    console.error('Homeopathy cancellation quote error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get cancellation quote' });
  }
});

// ============================================
// CANCEL BOOKING
// ============================================
router.put('/:bookingId/cancel', authenticatePatient, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await HomeopathyBooking.findOne({
      bookingId: req.params.bookingId,
      userId: req.user.id
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status === 'cancelled') return res.status(400).json({ success: false, message: 'Booking already cancelled' });

    const refundInfo = booking.refundEligibility;
    if (!booking.canCancel) {
      return res.status(400).json({ success: false, message: 'Booking cannot be cancelled in current status' });
    }

    await booking.cancelBooking(reason, 'patient');

    // Decrement package counter if applicable
    if (booking.type === 'naturopathy_center' && booking.center && booking.package?.packageId) {
      try {
        await NaturopathyCenter.updateOne(
          { _id: booking.center, 'packages._id': booking.package.packageId },
          { $inc: { 'packages.$.currentBookings': -1 } }
        );
      } catch (counterError) {
        console.error('Counter decrement error:', counterError.message);
      }
    }

    // Process refund
    const refundAmount = booking.cancellation?.refundAmount || 0;
    if (refundAmount > 0 && booking.razorpayPaymentId) {
      try {
        const refundResult = await razorpayService.createRefund(
          booking.razorpayPaymentId,
          refundAmount,
          { bookingId: booking.bookingId, reason: reason || 'Booking cancelled' }
        );

        if (refundResult.success) {
          booking.cancellation.refundStatus = 'processed';
          booking.cancellation.refundProcessedAt = new Date();
          booking.cancellation.refundTransactionId = refundResult.refund.id;
          await booking.save();

          await Transaction.findOneAndUpdate(
            { razorpayPaymentId: booking.razorpayPaymentId },
            {
              status: 'refunded',
              refundAmount,
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

    try {
      await smsService.sendSms(
        booking.patient.phone,
        `Your Homeopathy booking ${booking.bookingId} has been cancelled. Refund: ₹${refundAmount}`
      );
    } catch (smsError) {
      console.error('SMS failed:', smsError.message);
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        bookingId: booking.bookingId,
        cancellationFee: booking.cancellation?.cancellationFee || 0,
        refundAmount,
        refundStatus: booking.cancellation?.refundStatus || 'not_applicable'
      }
    });

  } catch (error) {
    console.error('Homeopathy cancel booking error:', error);
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

    const booking = await HomeopathyBooking.findOne({
      bookingId: req.params.bookingId,
      userId: req.user.id
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

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
    console.error('Homeopathy reschedule error:', error);
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

    const booking = await HomeopathyBooking.findOne({ bookingId: req.params.bookingId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (String(booking.userId) !== userIdStr) {
      return res.status(403).json({ success: false, message: 'You can only review your own bookings' });
    }

    await booking.submitReview(rating, comment);

    res.json({ success: true, message: 'Review submitted successfully', data: booking.review });
  } catch (error) {
    console.error('Homeopathy review error:', error.message);
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

    const booking = await HomeopathyBooking.findOne({
      bookingId: req.params.bookingId,
      userId: req.user.id
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (!booking.complaints) booking.complaints = [];

    booking.complaints.push({
      category: category || 'other',
      description: description.trim().slice(0, 2000),
      priority: priority || 'medium',
      status: 'pending',
      createdAt: new Date()
    });

    await booking.save();

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
    console.error('Homeopathy complaint error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to submit complaint' });
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

    const bookings = await HomeopathyBooking.find(query)
      .sort({ bookingDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-otp -razorpaySignature');

    const total = await HomeopathyBooking.countDocuments(query);

    res.json({
      success: true,
      data: bookings,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    console.error('Homeopathy get doctor bookings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
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

    const bookings = await HomeopathyBooking.find(query)
      .sort({ bookingDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-otp -razorpaySignature');

    const total = await HomeopathyBooking.countDocuments(query);

    res.json({
      success: true,
      data: bookings,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    console.error('Homeopathy get center bookings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// ============================================
// GET PHARMACY BOOKINGS
// ============================================
router.get('/pharmacy/:pharmacyId', authenticateUser, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { pharmacy: req.params.pharmacyId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await HomeopathyBooking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-otp -razorpaySignature');

    const total = await HomeopathyBooking.countDocuments(query);

    res.json({
      success: true,
      data: bookings,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    console.error('Homeopathy get pharmacy bookings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// ============================================
// UPDATE BOOKING STATUS (DOCTOR/CENTER/PHARMACY)
// ============================================
router.put('/:bookingId/status', authenticateUser, async (req, res) => {
  try {
    const { action } = req.body;

    const booking = await HomeopathyBooking.findOne({ bookingId: req.params.bookingId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const userIdStr = String(req.user.id || req.user._id || req.user.userId || '');
    const doctorIdStr = booking.doctor ? booking.doctor.toString() : '';
    const centerIdStr = booking.center ? booking.center.toString() : '';
    const pharmacyIdStr = booking.pharmacy ? booking.pharmacy.toString() : '';

    const isAuthorized =
      (doctorIdStr && doctorIdStr === userIdStr) ||
      (centerIdStr && centerIdStr === userIdStr) ||
      (pharmacyIdStr && pharmacyIdStr === userIdStr);

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    switch (action) {
      case 'accept':
        await booking.acceptBooking(booking.doctor ? 'doctor' : booking.center ? 'center' : 'pharmacy');
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
        if (booking.status !== 'pending') {
          return res.status(400).json({ success: false, message: 'Only pending bookings can be rejected' });
        }
        booking.status = 'cancelled';
        booking.cancelledAt = new Date();
        booking.cancellationReason = req.body.reason || 'Rejected by provider';
        await booking.save();

        if (booking.type === 'naturopathy_center' && booking.center && booking.package?.packageId) {
          try {
            await NaturopathyCenter.updateOne(
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

        if (booking.type === 'naturopathy_center' && booking.center && booking.package?.packageId) {
          try {
            await NaturopathyCenter.updateOne(
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
    console.error('Homeopathy update status error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to update status' });
  }
});

// ============================================
// CENTER: COMPLAINTS + REVIEWS
// ============================================
router.get('/center/complaints', authenticateUser, async (req, res) => {
  try {
    const centerObjectId = getUserObjectId(req.user);
    if (!centerObjectId) return res.status(400).json({ success: false, message: 'Invalid user session' });

    const { status, page = 1, limit = 20 } = req.query;

    const bookings = await HomeopathyBooking.find({
      center: centerObjectId,
      'complaints.0': { $exists: true }
    })
      .select('bookingId type patient package complaints createdAt updatedAt')
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
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Homeopathy center complaints error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints' });
  }
});

router.put('/:bookingId/complaint/:complaintId/respond', authenticateUser, async (req, res) => {
  try {
    const { response } = req.body;
    const centerObjectId = getUserObjectId(req.user);
    if (!centerObjectId) return res.status(400).json({ success: false, message: 'Invalid user session' });
    if (!response || response.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Response must be at least 3 characters' });
    }

    const booking = await HomeopathyBooking.findOne({
      bookingId: req.params.bookingId,
      center: centerObjectId
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const complaint = booking.complaints.id(req.params.complaintId);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    complaint.centerResponse = response.trim().slice(0, 2000);
    complaint.centerRespondedAt = new Date();
    complaint.status = 'in_review';
    await booking.save();

    res.json({ success: true, message: 'Response submitted', data: complaint });
  } catch (error) {
    console.error('Homeopathy center respond error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to respond' });
  }
});

router.put('/:bookingId/complaint/:complaintId/resolve', authenticateUser, async (req, res) => {
  try {
    const centerObjectId = getUserObjectId(req.user);
    if (!centerObjectId) return res.status(400).json({ success: false, message: 'Invalid user session' });

    const booking = await HomeopathyBooking.findOne({
      bookingId: req.params.bookingId,
      center: centerObjectId
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const complaint = booking.complaints.id(req.params.complaintId);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    complaint.status = 'resolved';
    complaint.resolvedAt = new Date();
    await booking.save();

    res.json({ success: true, message: 'Complaint resolved', data: complaint });
  } catch (error) {
    console.error('Homeopathy center resolve error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to resolve' });
  }
});

router.get('/center/reviews', authenticateUser, async (req, res) => {
  try {
    const centerObjectId = getUserObjectId(req.user);
    if (!centerObjectId) return res.status(400).json({ success: false, message: 'Invalid user session' });

    const { page = 1, limit = 20 } = req.query;

    const bookings = await HomeopathyBooking.find({
      center: centerObjectId,
      'review.rating': { $exists: true, $ne: null }
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
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Homeopathy center reviews error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
});

router.put('/:bookingId/review/respond', authenticateUser, async (req, res) => {
  try {
    const { response } = req.body;
    const centerObjectId = getUserObjectId(req.user);
    if (!centerObjectId) return res.status(400).json({ success: false, message: 'Invalid user session' });
    if (!response || response.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Response must be at least 3 characters' });
    }

    const booking = await HomeopathyBooking.findOne({
      bookingId: req.params.bookingId,
      center: centerObjectId
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!booking.review || (!booking.review.rating && !booking.review.comment)) {
      return res.status(404).json({ success: false, message: 'No review exists on this booking' });
    }

    booking.review = booking.review || {};
    booking.review.centerResponse = response.trim().slice(0, 1000);
    booking.review.centerRespondedAt = new Date();
    booking.markModified('review');
    await booking.save();

    res.json({ success: true, message: 'Response submitted', data: booking.review });
  } catch (error) {
    console.error('Homeopathy center review respond error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to respond' });
  }
});

// ============================================
// ADMIN ROUTES (all require admin key)
// ============================================

// ADMIN: ALL BOOKINGS
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 50 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await HomeopathyBooking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-otp -razorpaySignature')
      .lean();

    const total = await HomeopathyBooking.countDocuments(query);

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
    console.error('Homeopathy admin bookings error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// ADMIN: ALL COMPLAINTS
router.get('/admin/complaints/all', requireAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;

    const bookings = await HomeopathyBooking.find({
      'complaints.0': { $exists: true }
    })
      .sort({ updatedAt: -1 })
      .select('bookingId type patient doctorName centerName pharmacyName complaints package')
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
          pharmacyName: b.pharmacyName || '',
          packageName: b.package?.name || '',
          category: c.category,
          description: c.description,
          priority: c.priority,
          status: c.status,
          doctorResponse: c.doctorResponse || '',
          centerResponse: c.centerResponse || '',
          pharmacyResponse: c.pharmacyResponse || '',
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
    console.error('Homeopathy admin complaints error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints' });
  }
});

// ADMIN: UPDATE COMPLAINT
router.put('/admin/complaints/:bookingId/:complaintId', requireAdmin, async (req, res) => {
  try {
    const { status, adminResponse } = req.body;

    const booking = await HomeopathyBooking.findOne({ bookingId: req.params.bookingId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const complaint = booking.complaints.id(req.params.complaintId);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    const previousStatus = complaint.status;

    if (status) complaint.status = status;
    if (adminResponse) complaint.adminResponse = adminResponse.trim().slice(0, 2000);
    if (status === 'resolved') complaint.resolvedAt = new Date();

    if (status === 'escalated' && previousStatus !== 'escalated') {
      const priorityRank = { low: 1, medium: 2, high: 3, critical: 4 };
      const currentRank = priorityRank[complaint.priority] || 2;
      if (currentRank < 3) complaint.priority = 'high';
    }

    await booking.save();

    if (status === 'escalated' && previousStatus !== 'escalated') {
      try {
        const smsService = require('../services/smsService');
        const notificationMessage =
          `Complaint on your booking ${booking.bookingId} has been ESCALATED for priority review. ` +
          `Please respond within 24 hours.`;

        if (booking.doctor && booking.doctorPhone) {
          try { await smsService.sendSms(booking.doctorPhone, notificationMessage); } catch (e) {}
        }
        if (booking.center && booking.centerPhone) {
          try { await smsService.sendSms(booking.centerPhone, notificationMessage); } catch (e) {}
        }
        if (booking.pharmacy && booking.pharmacyPhone) {
          try { await smsService.sendSms(booking.pharmacyPhone, notificationMessage); } catch (e) {}
        }
      } catch (notifyError) {
        console.error('Escalation notify error (non-fatal):', notifyError.message);
      }
    }

    res.json({ success: true, message: 'Complaint updated', data: complaint });
  } catch (error) {
    console.error('Homeopathy admin complaint update error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update complaint' });
  }
});

// ADMIN: ALL REVIEWS
router.get('/admin/reviews/all', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const bookings = await HomeopathyBooking.find({})
      .sort({ 'review.createdAt': -1 })
      .select('bookingId type patient doctorName centerName pharmacyName review package createdAt')
      .lean();

    const reviews = bookings
      .filter(b => b.review && (b.review.rating || b.review.comment))
      .map(b => ({
        bookingId: b.bookingId,
        bookingType: b.type,
        patientName: b.patient?.name || 'Patient',
        doctorName: b.doctorName || '',
        centerName: b.centerName || '',
        pharmacyName: b.pharmacyName || '',
        packageName: b.package?.name || '',
        rating: b.review?.rating,
        comment: b.review?.comment,
        doctorResponse: b.review?.doctorResponse || '',
        centerResponse: b.review?.centerResponse || '',
        pharmacyResponse: b.review?.pharmacyResponse || '',
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
    console.error('Homeopathy admin reviews error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
});

// ADMIN: FLAG REVIEW
router.put('/admin/reviews/:bookingId/flag', requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await HomeopathyBooking.findOne({ bookingId: req.params.bookingId });
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
    console.error('[homeopathy.admin.review.flag]', error.message);
    res.status(500).json({ success: false, message: 'Failed to flag review' });
  }
});

// ADMIN: UNFLAG REVIEW
router.put('/admin/reviews/:bookingId/unflag', requireAdmin, async (req, res) => {
  try {
    const booking = await HomeopathyBooking.findOne({ bookingId: req.params.bookingId });
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
    console.error('[homeopathy.admin.review.unflag]', error.message);
    res.status(500).json({ success: false, message: 'Failed to unflag review' });
  }
});

// ADMIN: HIDE / RESTORE REVIEW
router.put('/admin/reviews/:bookingId/hide', requireAdmin, async (req, res) => {
  try {
    const { reason, unhide } = req.body;
    const booking = await HomeopathyBooking.findOne({ bookingId: req.params.bookingId });
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
    console.error('[homeopathy.admin.review.hide]', error.message);
    res.status(500).json({ success: false, message: 'Failed to update review' });
  }
});

// ADMIN: RESET REVIEW
router.put('/admin/reset-review/:bookingId', requireAdmin, async (req, res) => {
  try {
    const booking = await HomeopathyBooking.findOne({ bookingId: req.params.bookingId });
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

// ADMIN: FORCE CANCEL
router.put('/admin/force-cancel/:bookingId', requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;

    const booking = await HomeopathyBooking.findOne({ bookingId: req.params.bookingId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status === 'cancelled') return res.status(400).json({ success: false, message: 'Already cancelled' });
    if (booking.status === 'completed') return res.status(400).json({ success: false, message: 'Cannot cancel completed booking' });

    const wasActiveBooking =
      booking.type === 'naturopathy_center' &&
      booking.center &&
      booking.package?.packageId &&
      ['pending', 'confirmed', 'in_progress'].includes(booking.status);

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason || 'Cancelled by admin';
    booking.cancellation = {
      cancelledAt: new Date(),
      reason: reason || 'Cancelled by admin',
      cancelledBy: 'admin',
      refundStatus: 'pending',
      refundAmount: booking.finalAmount,
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

    if (wasActiveBooking) {
      try {
        await NaturopathyCenter.updateOne(
          { _id: booking.center, 'packages._id': booking.package.packageId },
          { $inc: { 'packages.$.currentBookings': -1 } }
        );
      } catch (decrementError) {
        console.error('[admin.cancel] Counter decrement failed:', decrementError.message);
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
    console.error('Homeopathy admin force-cancel error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to cancel booking' });
  }
});

// ADMIN: MARK NO-SHOW
router.put('/admin/mark-no-show/:bookingId', requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;

    const booking = await HomeopathyBooking.findOne({ bookingId: req.params.bookingId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status === 'no_show') return res.status(400).json({ success: false, message: 'Already no-show' });
    if (booking.status === 'completed') return res.status(400).json({ success: false, message: 'Cannot mark completed as no-show' });
    if (booking.status === 'cancelled') return res.status(400).json({ success: false, message: 'Cannot mark cancelled as no-show' });
    if (booking.paymentStatus !== 'paid' && booking.paymentStatus !== 'partial_refund') {
      return res.status(400).json({ success: false, message: 'Cannot mark unpaid booking as no-show' });
    }

    const bookingDate = new Date(booking.bookingDate);
    const now = new Date();
    if (bookingDate > now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot mark no-show before the scheduled booking date. Use force-cancel for future bookings.'
      });
    }

    const wasActiveBooking =
      booking.type === 'naturopathy_center' &&
      booking.center &&
      booking.package?.packageId &&
      ['pending', 'confirmed', 'in_progress'].includes(booking.status);

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

    await booking.save();

    if (wasActiveBooking) {
      try {
        await NaturopathyCenter.updateOne(
          { _id: booking.center, 'packages._id': booking.package.packageId },
          { $inc: { 'packages.$.currentBookings': -1 } }
        );
      } catch (err) {
        console.error('[homeopathy.admin.no_show] Counter decrement failed:', err.message);
      }
    }

    try {
      if (booking.patient?.phone) {
        await smsService.sendSms(
          booking.patient.phone,
          `Your Homeopathy appointment on ${new Date(booking.bookingDate).toLocaleDateString()} was marked as no-show. Booking ID: ${booking.bookingId}. No refund applicable.`
        );
      }
    } catch (smsErr) {
      console.warn('No-show SMS failed (non-fatal):', smsErr.message);
    }

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
    console.error('Homeopathy admin mark no-show error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to mark no-show' });
  }
});

// ADMIN: DISCOUNTS (view)
router.get('/admin/discounts', requireAdmin, async (req, res) => {
  try {
    const Discount = require('../models/Discount');
    const discounts = await Discount.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ success: true, data: discounts, total: discounts.length });
  } catch (error) {
    console.error('Homeopathy admin discounts error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch discounts' });
  }
});

// ============================================
// ADMIN: EXPORT BOOKINGS CSV
// ============================================
router.get('/admin/export', requireAdmin, async (req, res) => {
  try {
    const { status, type, from, to } = req.query;

    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    const bookings = await HomeopathyBooking.find(query)
      .sort({ createdAt: -1 })
      .limit(10000)
      .lean();

    const headers = [
      'Booking ID',
      'Type',
      'Status',
      'Payment Status',
      'Patient Name',
      'Patient Phone',
      'Doctor',
      'Center',
      'Pharmacy',
      'Amount',
      'Discount',
      'Final Amount',
      'Platform Fee',
      'GST',
      'Platform Commission',
      'Provider Earning',
      'Created At',
      'Paid At'
    ];

    const escapeCsv = (v) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const rows = bookings.map(b => [
      b.bookingId || '',
      b.type || '',
      b.status || '',
      b.paymentStatus || '',
      b.patient?.name || '',
      b.patient?.phone || '',
      b.doctorName || '',
      b.centerName || '',
      b.pharmacyName || '',
      b.amount || 0,
      b.discount?.amount || 0,
      b.finalAmount || 0,
      b.platformFee || 0,
      b.gstAmount || 0,
      b.platformCommission || 0,
      b.providerEarning || 0,
      b.createdAt ? new Date(b.createdAt).toISOString() : '',
      b.paidAt ? new Date(b.paidAt).toISOString() : ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="homeopathy-bookings-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('[homeopathy.admin.bookings.export]', error.message);
    res.status(500).json({ success: false, message: 'Failed to export bookings' });
  }
});

module.exports = router;
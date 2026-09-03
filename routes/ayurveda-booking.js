const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AyurvedaBooking = require('../models/AyurvedaBooking');
const AyurvedaDoctor = require('../models/AyurvedaDoctor');
const WellnessCenter = require('../models/WellnessCenter');
const Transaction = require('../models/Transaction');
const Discount = require('../models/Discount');
const commissionService = require('../services/commissionService');
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// ============================================
// CREATE BOOKING
// ============================================
router.post('/create', authenticateUser, async (req, res) => {
  try {
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
      amount = doctor.consultationFee;
      
            // Check if slot is available (only validate if doctor has availability set)
      if (doctor.availability && doctor.availability.length > 0) {
        const slotAvailable = doctor.availability.some(day => 
          day.slots?.some(slot => 
            slot.startTime === slotTime && 
            slot.currentBookings < slot.maxBookings
          )
        );
        if (!slotAvailable) {
          return res.status(400).json({ success: false, message: 'Selected slot is full' });
        }
      }
    } 
    else if (type === 'panchakarma_package') {
      if (!centerId || !req.body.packageId) {
        return res.status(400).json({ success: false, message: 'Center ID and Package ID are required' });
      }
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

    // Calculate commission
    const commissionResult = commissionService.calculateAyurvedaCommission({
      amount: amount - discountAmount,
      providerId: doctorId || centerId,
      subType: type === 'panchakarma_package' ? 'panchakarma' : 'consultation'
    });

    const finalAmount = amount - discountAmount;
    const platformCommission = commissionResult.commissionAmount;
    const providerEarning = finalAmount - platformCommission;

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
      platformCommission,
      providerEarning,
      razorpayOrderId: orderResult.order.id,
      status: 'pending'
    });

    // Generate OTP
    booking.generateOtp();

    await booking.save();

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
router.post('/verify-payment', authenticateUser, async (req, res) => {
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
    booking.status = 'pending'; // Still pending until OTP verification
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
router.post('/verify-otp', authenticateUser, async (req, res) => {
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
router.post('/resend-otp', authenticateUser, async (req, res) => {
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
router.get('/my-bookings', authenticateUser, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;
    
    const query = { userId: req.user.id };
    if (status) query.status = status;
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await AyurvedaBooking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('doctor', 'name specialization consultationFee rating')
      .populate('center', 'name address rating');

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
router.get('/:bookingId', authenticateUser, async (req, res) => {
  try {
    const booking = await AyurvedaBooking.findOne({ 
      bookingId: req.params.bookingId,
      $or: [{ userId: req.user.id }, { doctor: req.user.id }, { center: req.user.id }]
    })
      .populate('doctor', 'name specialization consultationFee rating address')
      .populate('center', 'name address rating facilities');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.json({ success: true, data: booking });

  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch booking' });
  }
});

// ============================================
// CANCEL BOOKING
// ============================================
router.put('/:bookingId/cancel', authenticateUser, async (req, res) => {
  try {
    const { reason } = req.body;

    const booking = await AyurvedaBooking.findOne({ 
      bookingId: req.params.bookingId,
      userId: req.user.id
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
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
router.post('/:bookingId/review', authenticateUser, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const booking = await AyurvedaBooking.findOne({ 
      bookingId: req.params.bookingId,
      userId: req.user.id
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    await booking.submitReview(rating, comment);

    res.json({
      success: true,
      message: 'Review submitted successfully'
    });

  } catch (error) {
    console.error('Review error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to submit review' });
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

    // Check if user is the doctor or center
    const isAuthorized = 
      (booking.doctor && booking.doctor.toString() === req.user.id) ||
      (booking.center && booking.center.toString() === req.user.id);

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    switch (action) {
      case 'accept':
        await booking.acceptBooking('doctor');
        break;
      case 'start':
        await booking.startConsultation();
        break;
      case 'complete':
        await booking.completeConsultation(req.body.prescription);
        break;
      case 'no_show':
        await booking.markNoShow();
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

module.exports = router;
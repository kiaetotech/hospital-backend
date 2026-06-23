const express = require('express');
const router = express.Router();
const MentalHealthTherapist = require('../models/MentalHealthTherapist');
const MentalHealthBooking = require('../models/MentalHealthBooking');
const MentalHealthScreening = require('../models/MentalHealthScreening');
const User = require('../models/User');
const { authenticate: auth } = require('../middleware/auth');
const razorpayService = require('../services/razorpayService');
const notificationService = require('../services/notificationService');

// ============================================
// PUBLIC ROUTES
// ============================================

// Get all therapists with filters
router.get('/therapists', async (req, res) => {
  try {
    const {
      specializations,
      city,
      minRating,
      maxPrice,
      consultationType,
      isEmergency,
      page = 1,
      limit = 20,
      sort = 'rating'
    } = req.query;

    const query = {
      isActive: true,
      verificationStatus: 'approved'
    };

    if (specializations) {
      query.specializations = { $in: specializations.split(',') };
    }
    if (city) query['address.city'] = { $regex: city, $options: 'i' };
    if (minRating) query.rating = { $gte: parseFloat(minRating) };
    if (maxPrice) query['pricing.consultation'] = { $lte: parseInt(maxPrice) };
    if (consultationType) {
      query[`consultationTypes.${consultationType}`] = true;
    }
    if (isEmergency === 'true') {
      query.isEmergencyAvailable = true;
    }

    let sortOptions = { rating: -1 };
    if (sort === 'price_low') sortOptions = { 'pricing.consultation': 1 };
    if (sort === 'price_high') sortOptions = { 'pricing.consultation': -1 };
    if (sort === 'experience') sortOptions = { experience: -1 };
    if (sort === 'popularity') sortOptions = { 'stats.totalConsultations': -1 };

    const skip = (page - 1) * limit;
    const therapists = await MentalHealthTherapist.find(query)
      .select('-password -documents -bankDetails')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MentalHealthTherapist.countDocuments(query);

    res.json({
      success: true,
      data: therapists,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching therapists:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get featured therapists
router.get('/therapists/featured', async (req, res) => {
  try {
    const therapists = await MentalHealthTherapist.find({
      isActive: true,
      verificationStatus: 'approved',
      rating: { $gte: 4.5 }
    })
      .select('-password -documents -bankDetails')
      .sort({ rating: -1, 'stats.totalConsultations': -1 })
      .limit(6);

    res.json({
      success: true,
      data: therapists
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single therapist
router.get('/therapists/:id', async (req, res) => {
  try {
    const therapist = await MentalHealthTherapist.findById(req.params.id)
      .select('-password -documents -bankDetails');
    
    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }

    if (!therapist.isApproved) {
      return res.status(403).json({ success: false, message: 'Therapist not available' });
    }

    res.json({
      success: true,
      data: therapist
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get available slots
router.get('/therapists/:id/slots', async (req, res) => {
  try {
    const { date } = req.query;
    const therapist = await MentalHealthTherapist.findById(req.params.id);
    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }

    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    const availability = therapist.availability.find(a => a.day === dayOfWeek);

    if (!availability) {
      return res.json({ success: true, data: [] });
    }

    res.json({
      success: true,
      data: availability.slots
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 SCREENING ROUTES (FIXED)
// ============================================

// POST /api/mentalhealth/screening - Submit screening
router.post('/screening', async (req, res) => {
  try {
    const { screeningType, answers, isAnonymous } = req.body;

    // Validate required fields
    if (!screeningType || !answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: 'screeningType and answers array are required'
      });
    }

    // Calculate score
    let score = 0;
    answers.forEach(a => { score += a; });

    let severity = '';
    let recommendations = [];
    let requiresEmergency = false;

    // Depression (PHQ-9)
    if (screeningType === 'depression') {
      if (score <= 4) severity = 'minimal';
      else if (score <= 9) severity = 'mild';
      else if (score <= 14) severity = 'moderate';
      else if (score <= 19) severity = 'moderately_severe';
      else severity = 'severe';
      
      if (score >= 15) {
        recommendations.push({
          type: 'consultation',
          description: 'Please consult a mental health professional',
          urgency: 'high'
        });
        requiresEmergency = true;
      }
    } 
    // Anxiety (GAD-7)
    else if (screeningType === 'anxiety') {
      if (score <= 4) severity = 'minimal';
      else if (score <= 9) severity = 'mild';
      else if (score <= 14) severity = 'moderate';
      else severity = 'severe';
      
      if (score >= 15) {
        recommendations.push({
          type: 'consultation',
          description: 'Please consult a mental health professional',
          urgency: 'high'
        });
        requiresEmergency = true;
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid screening type. Use "depression" or "anxiety"'
      });
    }

    // Save screening result
    const screening = new MentalHealthScreening({
      userId: req.user?.id || null,
      screeningType,
      depressionScores: screeningType === 'depression' ? answers.map((a, i) => ({ question: i + 1, answer: a })) : [],
      depressionTotal: screeningType === 'depression' ? score : 0,
      depressionSeverity: screeningType === 'depression' ? severity : '',
      anxietyScores: screeningType === 'anxiety' ? answers.map((a, i) => ({ question: i + 1, answer: a })) : [],
      anxietyTotal: screeningType === 'anxiety' ? score : 0,
      anxietySeverity: screeningType === 'anxiety' ? severity : '',
      recommendations,
      requiresEmergency,
      isAnonymous: isAnonymous || false,
      anonymousId: isAnonymous ? `ANON_${Date.now()}_${Math.random().toString(36).substr(2, 6)}` : null
    });

    await screening.save();

    // If emergency, alert crisis team
    if (requiresEmergency && notificationService && notificationService.sendCrisisAlert) {
      try {
        await notificationService.sendCrisisAlert({
          screeningId: screening._id,
          severity: severity,
          isAnonymous: isAnonymous
        });
      } catch (notifError) {
        console.log('Notification error:', notifError);
      }
    }

    res.json({
      success: true,
      data: {
        screeningId: screening._id,
        score,
        severity,
        recommendations,
        requiresEmergency,
        crisisHelpline: '988'
      }
    });

  } catch (error) {
    console.error('Error in screening:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/mentalhealth/screening/results/:id - Get screening results
router.get('/screening/results/:id', async (req, res) => {
  try {
    const screening = await MentalHealthScreening.findById(req.params.id);
    if (!screening) {
      return res.status(404).json({ success: false, message: 'Screening not found' });
    }

    // Check if user owns this screening or is admin
    if (screening.userId && req.user && screening.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    res.json({
      success: true,
      data: screening
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// AUTHENTICATED ROUTES
// ============================================

// Book session
router.post('/book', auth, async (req, res) => {
  try {
    const {
      therapistId,
      bookingType,
      scheduledDate,
      scheduledTime,
      duration,
      isAnonymous,
      participants,
      isEmergency,
      emergencyLevel,
      crisisNotes,
      emergencyContact
    } = req.body;

    const therapist = await MentalHealthTherapist.findById(therapistId);
    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }

    if (!therapist.isApproved) {
      return res.status(403).json({ success: false, message: 'Therapist not available' });
    }

    // Calculate pricing
    let amount = therapist.pricing?.consultation || 500;
    if (bookingType === 'video') amount = therapist.pricing?.videoTherapy || amount;
    else if (bookingType === 'audio') amount = therapist.pricing?.audioTherapy || amount;
    else if (bookingType === 'text') amount = therapist.pricing?.textTherapy || amount;
    else if (bookingType === 'emergency') amount = therapist.pricing?.emergency || amount * 1.5;

    const commissionRate = therapist.commissionRate || 15;
    const platformCommission = (amount * commissionRate) / 100;
    const therapistEarning = amount - platformCommission;

    const booking = new MentalHealthBooking({
      therapistId,
      patientId: req.user.id,
      bookingType,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      duration: duration || 60,
      amount,
      platformCommission,
      therapistEarning,
      status: 'pending',
      isAnonymous: isAnonymous || false,
      isEmergency: isEmergency || false,
      emergencyLevel,
      crisisNotes,
      emergencyContact,
      participants: participants || []
    });

    await booking.save();

    const order = await razorpayService.createOrder({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: booking._id.toString(),
      notes: {
        bookingId: booking._id.toString(),
        therapistId: therapistId,
        type: 'mental_health'
      }
    });

    booking.orderId = order.id;
    await booking.save();

    res.json({
      success: true,
      data: {
        bookingId: booking._id,
        orderId: order.id,
        amount: amount,
        therapistName: therapist.name,
        razorpayKey: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    console.error('Error booking session:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Verify payment
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const { bookingId, paymentId, orderId, signature } = req.body;

    const isValid = razorpayService.verifyPaymentSignature({
      orderId,
      paymentId,
      signature
    });

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid payment' });
    }

    const booking = await MentalHealthBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    booking.paymentStatus = 'paid';
    booking.status = 'confirmed';
    booking.paymentId = paymentId;
    await booking.save();

    await MentalHealthTherapist.findByIdAndUpdate(booking.therapistId, {
      $inc: { 'stats.totalConsultations': 1, 'stats.totalRevenue': booking.therapistEarning }
    });

    if (notificationService && notificationService.sendEmail) {
      await notificationService.sendEmail(req.user.email, 'Session Confirmed', {
        template: 'mental_health_confirmation',
        data: {
          name: req.user.name,
          therapistName: therapist.name,
          date: booking.scheduledDate,
          time: booking.scheduledTime
        }
      });
    }

    const sessionLink = `https://${process.env.DOMAIN || 'localhost:3000'}/session/${booking._id}`;
    booking.sessionLink = sessionLink;
    await booking.save();

    res.json({
      success: true,
      message: 'Payment verified and session confirmed',
      data: {
        bookingId: booking._id,
        sessionLink: sessionLink,
        status: 'confirmed'
      }
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user bookings
router.get('/my-bookings', auth, async (req, res) => {
  try {
    const bookings = await MentalHealthBooking.find({ patientId: req.user.id })
      .populate('therapistId', 'name specializations rating pricing')
      .sort({ scheduledDate: -1 });

    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cancel booking
router.put('/bookings/:id/cancel', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await MentalHealthBooking.findOne({
      _id: req.params.id,
      patientId: req.user.id
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel completed session' });
    }

    booking.status = 'cancelled';
    booking.cancellationReason = reason;
    await booking.save();

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CRISIS HELPLINE (Public)
// ============================================

router.get('/crisis', (req, res) => {
  res.json({
    success: true,
    data: {
      helplines: [
        { name: 'National Mental Health Helpline', number: '988' },
        { name: 'Vandrevala Foundation', number: '1860-266-2345' },
        { name: 'iCall Helpline', number: '022-2552-1111' },
        { name: 'Snehi Helpline', number: '044-2464-0050' },
        { name: 'Jeevan Aastha', number: '1800-233-3330' }
      ],
      emergencyMessage: 'If you are in immediate danger, please call 112 or go to your nearest emergency room.'
    }
  });
});

// ============================================
// STATS (Public)
// ============================================

router.get('/stats', async (req, res) => {
  try {
    const totalTherapists = await MentalHealthTherapist.countDocuments({
      isActive: true,
      verificationStatus: 'approved'
    });
    const totalSessions = await MentalHealthBooking.countDocuments({ status: 'completed' });
    
    res.json({
      success: true,
      data: {
        totalTherapists,
        totalSessions,
        satisfactionRate: 96,
        averageResponseTime: '24 hours'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const MentalHealthTherapist = require('../models/MentalHealthTherapist');
const MentalHealthBooking = require('../models/MentalHealthBooking');
const MentalHealthScreening = require('../models/MentalHealthScreening');
const { authenticate: auth } = require('../middleware/auth');
const razorpayService = require('../services/razorpayService');

// ============================================
// PUBLIC ROUTES
// ============================================

// GET /api/mentalhealth/therapists
router.get('/therapists', async (req, res) => {
  try {
    const therapists = await MentalHealthTherapist.find({
      isActive: true,
      verificationStatus: 'approved'
    }).select('-password -documents -bankDetails').limit(20);

    res.json({
      success: true,
      data: therapists
    });
  } catch (error) {
    console.error('Error fetching therapists:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/mentalhealth/therapists/featured
router.get('/therapists/featured', async (req, res) => {
  try {
    const therapists = await MentalHealthTherapist.find({
      isActive: true,
      verificationStatus: 'approved',
      rating: { $gte: 4.0 }
    })
      .select('-password -documents -bankDetails')
      .sort({ rating: -1 })
      .limit(6);

    res.json({
      success: true,
      data: therapists
    });
  } catch (error) {
    console.error('Error fetching featured therapists:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/mentalhealth/therapists/:id
router.get('/therapists/:id', async (req, res) => {
  try {
    const therapist = await MentalHealthTherapist.findById(req.params.id)
      .select('-password -documents -bankDetails');
    
    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }

    res.json({
      success: true,
      data: therapist
    });
  } catch (error) {
    console.error('Error fetching therapist:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ✅ SCREENING ROUTE - FIXED POST METHOD
// ============================================

// POST /api/mentalhealth/screening
router.post('/screening', async (req, res) => {
  try {
    console.log('📊 Screening request received:', req.body);
    
    const { screeningType, answers, isAnonymous } = req.body;

    // Validate
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
    } else if (screeningType === 'anxiety') {
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

    // ✅ Create and save screening
    const screening = new MentalHealthScreening({
      userId: req.user?.id || null,
      screeningType,
      depressionScores: screeningType === 'depression' ? answers.map((a, i) => ({ question: i + 1, answer: a })) : [],
      depressionTotal: screeningType === 'depression' ? score : 0,
      depressionSeverity: screeningType === 'depression' ? severity : undefined,
      anxietyScores: screeningType === 'anxiety' ? answers.map((a, i) => ({ question: i + 1, answer: a })) : [],
      anxietyTotal: screeningType === 'anxiety' ? score : 0,
      anxietySeverity: screeningType === 'anxiety' ? severity : undefined,
      recommendations,
      requiresEmergency,
      isAnonymous: isAnonymous || false,
      anonymousId: isAnonymous ? `ANON_${Date.now()}_${Math.random().toString(36).substr(2, 6)}` : null
    });

    await screening.save();

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
    console.error('❌ Screening error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/mentalhealth/crisis
router.get('/crisis', (req, res) => {
  res.json({
    success: true,
    data: {
      helplines: [
        { name: 'National Mental Health Helpline', number: '988' },
        { name: 'Vandrevala Foundation', number: '1860-266-2345' },
        { name: 'iCall Helpline', number: '022-2552-1111' }
      ]
    }
  });
});

// GET /api/mentalhealth/stats
router.get('/stats', async (req, res) => {
  try {
    const totalTherapists = await MentalHealthTherapist.countDocuments({
      isActive: true,
      verificationStatus: 'approved'
    });
    
    res.json({
      success: true,
      data: {
        totalTherapists,
        totalSessions: 0,
        satisfactionRate: 96,
        averageResponseTime: '24 hours'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// AUTHENTICATED ROUTES
// ============================================

// POST /api/mentalhealth/book
router.post('/book', auth, async (req, res) => {
  try {
    const { therapistId, bookingType, scheduledDate, scheduledTime } = req.body;

    const therapist = await MentalHealthTherapist.findById(therapistId);
    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }

    const amount = therapist.pricing?.consultation || 500;
    const platformCommission = amount * 0.15;
    const therapistEarning = amount - platformCommission;

    const booking = new MentalHealthBooking({
      therapistId,
      patientId: req.user.id,
      bookingType: bookingType || 'video',
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      amount,
      platformCommission,
      therapistEarning,
      status: 'pending',
      paymentStatus: 'pending'
    });

    await booking.save();

    const order = await razorpayService.createOrder({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: booking._id.toString()
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

// GET /api/mentalhealth/my-bookings
router.get('/my-bookings', auth, async (req, res) => {
  try {
    const bookings = await MentalHealthBooking.find({ patientId: req.user.id })
      .populate('therapistId', 'name specializations rating')
      .sort({ scheduledDate: -1 });

    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
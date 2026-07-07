const express = require('express');
const router = express.Router();
const MentalHealthTherapist = require('../models/MentalHealthTherapist');
const MentalHealthBooking = require('../models/MentalHealthBooking');
const MentalHealthScreening = require('../models/MentalHealthScreening');
const TherapistWallet = require('../models/TherapistWallet');
const CommissionRule = require('../models/CommissionRule');
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
// ============================================
// MODIFIED: Added Commission Calculation & Wallet Integration
// ============================================

router.post('/book', auth, async (req, res) => {
  try {
    const { 
      therapistId, 
      bookingType, 
      scheduledDate, 
      scheduledTime,
      duration = 60,
      mode = 'video',
      notes = ''
    } = req.body;

    // Validate
    if (!therapistId || !scheduledDate || !scheduledTime) {
      return res.status(400).json({ 
        success: false, 
        message: 'therapistId, scheduledDate, and scheduledTime are required' 
      });
    }

    // Get therapist
    const therapist = await MentalHealthTherapist.findById(therapistId);
    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }

    // ============================================
    // 1. COMMISSION CALCULATION
    // ============================================
    
    const amount = therapist.pricing?.consultation || 500;
    
    // Get active commission rule
    const rule = await CommissionRule.getActiveRule(
      therapist.specializations?.[0] || 'all',
      therapist.experience > 5 ? 'experienced_therapists' : 'new_therapists'
    );
    
    // Get session count for tiered commission
    const sessionCount = await MentalHealthBooking.countDocuments({
      therapistId,
      paymentStatus: 'paid'
    });
    
    // Calculate commission
    const commissionResult = await CommissionRule.calculateCommission(
      amount,
      sessionCount,
      {
        specialization: therapist.specializations?.[0] || 'all',
        type: therapist.experience > 5 ? 'experienced_therapists' : 'new_therapists'
      }
    );

    // ============================================
    // 2. CREATE BOOKING WITH FINANCE DETAILS
    // ============================================
    
    const booking = new MentalHealthBooking({
      therapistId,
      patientId: req.user.id,
      bookingType: bookingType || 'video',
      sessionType: 'individual',
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      duration: duration || 60,
      
      // Pricing & Finance
      amount: amount,
      patientAmount: amount,
      platformCommission: commissionResult.commission,
      therapistEarning: commissionResult.therapistEarnings,
      commissionRate: commissionResult.commissionRate,
      commissionRuleId: commissionResult.ruleId,
      
      // Status
      status: 'pending',
      paymentStatus: 'pending',
      payoutStatus: 'pending',
      
      // Other fields
      patientNotes: notes,
      isAnonymous: false
    });

    await booking.save();

    // ============================================
    // 3. ADD TO THERAPIST'S PENDING EARNINGS
    // ============================================
    
    await TherapistWallet.addEarnings(
      therapistId,
      commissionResult.therapistEarnings,
      booking._id,
      `Session booking - ${scheduledDate} ${scheduledTime}`
    );

    // ============================================
    // 4. CREATE RAZORPAY ORDER
    // ============================================
    
    const order = await razorpayService.createOrder({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: booking._id.toString()
    });

    booking.orderId = order.id;
    await booking.save();

    // ============================================
    // 5. RESPONSE
    // ============================================
    
    res.json({
      success: true,
      data: {
        bookingId: booking._id,
        orderId: order.id,
        amount: amount,
        therapistName: therapist.name,
        razorpayKey: process.env.RAZORPAY_KEY_ID,
        
        // Finance Details (for transparency)
        finance: {
          patientAmount: amount,
          platformCommission: commissionResult.commission,
          therapistEarnings: commissionResult.therapistEarnings,
          commissionRate: commissionResult.commissionRate,
          ruleName: commissionResult.ruleName
        }
      }
    });
    
  } catch (error) {
    console.error('Error booking session:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET /api/mentalhealth/my-bookings
// ============================================

router.get('/my-bookings', auth, async (req, res) => {
  try {
    const bookings = await MentalHealthBooking.find({ patientId: req.user.id })
      .populate('therapistId', 'name specializations rating profileImage')
      .sort({ scheduledDate: -1 });

    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET /api/mentalhealth/booking/:id
// ============================================

router.get('/booking/:id', auth, async (req, res) => {
  try {
    const booking = await MentalHealthBooking.findById(req.params.id)
      .populate('therapistId', 'name specializations rating profileImage consultationFee')
      .populate('patientId', 'name email phone');
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    // Check authorization
    if (booking.patientId._id.toString() !== req.user.id && 
        booking.therapistId._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// PUT /api/mentalhealth/booking/:id/cancel
// ============================================

router.put('/booking/:id/cancel', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await MentalHealthBooking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    // Check authorization
    if (booking.patientId.toString() !== req.user.id && 
        booking.therapistId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    // Check if booking is cancellable
    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Booking cannot be cancelled' });
    }
    
    await booking.cancel(reason || 'User cancelled');
    
    // Reverse wallet earnings if already added
    // Note: This would need refund logic

    res.json({
      success: true,
      data: booking,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// POST /api/mentalhealth/booking/:id/feedback
// ============================================

router.post('/booking/:id/feedback', auth, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const booking = await MentalHealthBooking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    // Check authorization - only patient can give feedback
    if (booking.patientId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Booking must be completed to give feedback' });
    }
    
    await booking.addFeedback(rating, review);
    
    // Update therapist rating
    await MentalHealthTherapist.updateRating(booking.therapistId);

    res.json({
      success: true,
      data: booking,
      message: 'Feedback submitted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET /api/mentalhealth/booking/:id/session-link
// ============================================

router.get('/booking/:id/session-link', auth, async (req, res) => {
  try {
    const booking = await MentalHealthBooking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    // Check authorization
    if (booking.patientId.toString() !== req.user.id && 
        booking.therapistId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    // Generate session link if not exists
    if (!booking.sessionLink) {
      const roomId = `session_${booking._id}_${Date.now()}`;
      // In production, integrate with video provider (Zoom, Google Meet, etc.)
      booking.sessionLink = `https://meet.hospital-platform.com/${roomId}`;
      await booking.save();
    }

    res.json({
      success: true,
      data: {
        sessionLink: booking.sessionLink,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const MoodLog = require('../models/MoodLog');

// ============================================
// MOOD TRACKING
// ============================================

// POST /api/mentalhealth/mood
router.post('/mood', async (req, res) => {
  try {
    const { mood, moodScore, journalEntry, tags } = req.body;
    const userId = req.user?.id || req.body.userId;

    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });

    // Simple sentiment analysis (rule-based)
    let sentimentScore = 0;
    let crisisDetected = false;
    let detectedKeywords = [];

    if (journalEntry) {
      const lower = journalEntry.toLowerCase();
      
      // Crisis keywords
      const crisisWords = ['suicidal', 'kill myself', 'end my life', 'want to die', 'self harm', 'no reason to live'];
      crisisDetected = crisisWords.some(w => lower.includes(w));

      // Sentiment keywords
      const positiveWords = ['happy', 'better', 'good', 'great', 'hopeful', 'peaceful', 'grateful', 'calm', 'improved'];
      const negativeWords = ['sad', 'anxious', 'depressed', 'lonely', 'hopeless', 'tired', 'angry', 'stressed', 'worried', 'crying', 'exhausted'];
      
      detectedKeywords = [...positiveWords, ...negativeWords].filter(w => lower.includes(w));
      
      const posCount = positiveWords.filter(w => lower.includes(w)).length;
      const negCount = negativeWords.filter(w => lower.includes(w)).length;
      if (posCount + negCount > 0) {
        sentimentScore = Math.round(((posCount - negCount) / (posCount + negCount)) * 100) / 100;
      }
    }

    const moodLog = new MoodLog({
      userId, mood, moodScore, journalEntry, tags,
      sentimentScore, detectedKeywords, crisisDetected
    });
    await moodLog.save();

    res.status(201).json({
      success: true,
      data: moodLog,
      alert: crisisDetected ? {
        type: 'crisis',
        message: 'We noticed some concerning words. If you need immediate help, please call our helpline.',
        helpline: '+91-XXXXXXXXXX'
      } : null
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/mentalhealth/mood/trend
router.get('/mood/trend', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });

    const trend = await MoodLog.getWeeklyTrend(userId);
    res.json({ success: true, data: trend });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/mentalhealth/crisis-alert
router.post('/crisis-alert', async (req, res) => {
  try {
    const { userId, message, location } = req.body;
    
    // In production: Notify therapist, send SMS, email admins
    console.log('🚨 CRISIS ALERT:', { userId, message, location, time: new Date() });

    res.json({
      success: true,
      message: 'Help is on the way. Please stay on the line.',
      helplines: [
        'iCall: +91-9152987821',
        'AASRA: +91-9820466726',
        'Vandrevala Foundation: +91-9999666555'
      ],
      immediateAction: 'Contact emergency services (108) if in immediate danger.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const MentalHealthTherapist = require('../models/MentalHealthTherapist');
const MentalHealthBooking = require('../models/MentalHealthBooking');
const MentalHealthScreening = require('../models/MentalHealthScreening');
const { authenticate: auth } = require('../middleware/auth');

// ============================================
// ADMIN MIDDLEWARE
// ============================================

const isAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Authorization error' });
  }
};

// ============================================
// THERAPIST MANAGEMENT
// ============================================

// GET /api/mentalhealth/admin/therapists
router.get('/therapists', auth, isAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.verificationStatus = status;

    const skip = (page - 1) * limit;
    const therapists = await MentalHealthTherapist.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
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
    console.error('Admin therapists fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch therapists' });
  }
});

// GET /api/mentalhealth/admin/therapists/:id
router.get('/therapists/:id', auth, isAdmin, async (req, res) => {
  try {
    const therapist = await MentalHealthTherapist.findById(req.params.id).select('-password');
    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }
    res.json({ success: true, data: therapist });
  } catch (error) {
    console.error('Admin therapist fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch therapist' });
  }
});

// PUT /api/mentalhealth/admin/therapists/:id/verify
router.put('/therapists/:id/verify', auth, isAdmin, async (req, res) => {
  try {
    const { status, rejectionReason } = req.body; // status: 'approved', 'rejected'

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (approved/rejected) required'
      });
    }

    const therapist = await MentalHealthTherapist.findById(req.params.id);
    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }

    therapist.verificationStatus = status;
    therapist.isActive = status === 'approved';
    therapist.verifiedBy = req.user.id;
    therapist.verifiedAt = new Date();
    if (status === 'rejected') {
      therapist.rejectionReason = rejectionReason || 'Verification failed';
    }

    await therapist.save();

    res.json({
      success: true,
      message: `Therapist ${status}`,
      data: therapist
    });
  } catch (error) {
    console.error('Therapist verification error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify therapist' });
  }
});

// PUT /api/mentalhealth/admin/therapists/:id/suspend
router.put('/therapists/:id/suspend', auth, isAdmin, async (req, res) => {
  try {
    const { isActive, reason } = req.body;

    const therapist = await MentalHealthTherapist.findById(req.params.id);
    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }

    therapist.isActive = isActive;
    if (!isActive) {
      therapist.verificationStatus = 'suspended';
      therapist.rejectionReason = reason || 'Suspended by admin';
    } else {
      therapist.verificationStatus = 'approved';
      therapist.rejectionReason = null;
    }
    await therapist.save();

    res.json({
      success: true,
      message: `Therapist ${isActive ? 'activated' : 'suspended'}`,
      data: therapist
    });
  } catch (error) {
    console.error('Therapist suspension error:', error);
    res.status(500).json({ success: false, message: 'Failed to update therapist status' });
  }
});

// DELETE /api/mentalhealth/admin/therapists/:id
router.delete('/therapists/:id', auth, isAdmin, async (req, res) => {
  try {
    const therapist = await MentalHealthTherapist.findById(req.params.id);
    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }

    // Soft delete
    therapist.isActive = false;
    therapist.verificationStatus = 'rejected';
    await therapist.save();

    res.json({
      success: true,
      message: 'Therapist removed'
    });
  } catch (error) {
    console.error('Therapist deletion error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove therapist' });
  }
});

// ============================================
// BOOKING MANAGEMENT
// ============================================

// GET /api/mentalhealth/admin/bookings
router.get('/bookings', auth, isAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const bookings = await MentalHealthBooking.find(query)
      .populate('therapistId', 'name phone')
      .populate('patientId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MentalHealthBooking.countDocuments(query);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Admin bookings fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// GET /api/mentalhealth/admin/bookings/:id
router.get('/bookings/:id', auth, isAdmin, async (req, res) => {
  try {
    const booking = await MentalHealthBooking.findById(req.params.id)
      .populate('therapistId', 'name phone specializations')
      .populate('patientId', 'name email phone');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    console.error('Admin booking fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch booking' });
  }
});

// ============================================
// SCREENING MANAGEMENT
// ============================================

// GET /api/mentalhealth/admin/screenings
router.get('/screenings', auth, isAdmin, async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;

    const query = {};
    if (type) query.screeningType = type;

    const skip = (page - 1) * limit;
    const screenings = await MentalHealthScreening.find(query)
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MentalHealthScreening.countDocuments(query);

    res.json({
      success: true,
      data: screenings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Admin screenings fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch screenings' });
  }
});

// GET /api/mentalhealth/admin/dashboard
router.get('/dashboard', auth, isAdmin, async (req, res) => {
  try {
    const totalTherapists = await MentalHealthTherapist.countDocuments();
    const pendingTherapists = await MentalHealthTherapist.countDocuments({ verificationStatus: 'pending' });
    const approvedTherapists = await MentalHealthTherapist.countDocuments({ verificationStatus: 'approved' });

    const totalBookings = await MentalHealthBooking.countDocuments();
    const pendingBookings = await MentalHealthBooking.countDocuments({ status: 'pending' });
    const completedBookings = await MentalHealthBooking.countDocuments({ status: 'completed' });

    const totalScreenings = await MentalHealthScreening.countDocuments();
    const crisisScreenings = await MentalHealthScreening.countDocuments({ requiresEmergency: true });

    res.json({
      success: true,
      data: {
        therapists: {
          total: totalTherapists,
          pending: pendingTherapists,
          approved: approvedTherapists
        },
        bookings: {
          total: totalBookings,
          pending: pendingBookings,
          completed: completedBookings
        },
        screenings: {
          total: totalScreenings,
          crisis: crisisScreenings
        }
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;
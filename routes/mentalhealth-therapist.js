const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const MentalHealthTherapist = require('../models/MentalHealthTherapist');
const { authenticate: auth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital_platform_secret_key_2024';

// ============================================
// THERAPIST REGISTRATION
// ============================================

// POST /api/mentalhealth/therapist/register
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      password,
      licenseNumber,
      licenseCouncil,
      specializations,
      experience,
      education,
      about,
      languages,
      city,
      state,
      consultationFee,
      consultationTypes
    } = req.body;

    // Validate required fields
    if (!name || !phone || !password || !licenseNumber || !specializations || !experience || !consultationFee) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, phone, password, licenseNumber, specializations, experience, consultationFee'
      });
    }

    // Check if phone already registered
    const existing = await MentalHealthTherapist.findOne({ phone });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Phone number already registered' });
    }

    // Check if license number already registered
    const existingLicense = await MentalHealthTherapist.findOne({ licenseNumber });
    if (existingLicense) {
      return res.status(400).json({ success: false, message: 'License number already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create therapist
    const therapist = new MentalHealthTherapist({
      name,
      phone,
      email: email || '',
      password: hashedPassword,
      licenseNumber,
      licenseCouncil: licenseCouncil || '',
      specializations: specializations || [],
      experience: parseInt(experience),
      education: education || '',
      about: about || '',
      languages: languages || ['English'],
      address: { city: city || '', state: state || '' },
      consultationFee: parseInt(consultationFee),
      consultationTypes: consultationTypes || { video: true, audio: true, text: true, anonymous: true },
      verificationStatus: 'pending',
      isActive: false
    });

    await therapist.save();

    res.status(201).json({
      success: true,
      message: 'Therapist registration submitted for verification',
      data: {
        therapistId: therapist._id,
        name: therapist.name,
        verificationStatus: therapist.verificationStatus
      }
    });

  } catch (error) {
    console.error('Therapist registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed: ' + error.message });
  }
});

// ============================================
// THERAPIST LOGIN
// ============================================

// POST /api/mentalhealth/therapist/login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password required' });
    }

    const therapist = await MentalHealthTherapist.findOne({ phone });
    if (!therapist) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, therapist.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (therapist.verificationStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        message: `Account is ${therapist.verificationStatus}. Please wait for admin approval.`,
        status: therapist.verificationStatus
      });
    }

    const token = jwt.sign(
      { id: therapist._id, role: 'mental_health_therapist' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      therapist: {
        id: therapist._id,
        name: therapist.name,
        phone: therapist.phone,
        email: therapist.email,
        licenseNumber: therapist.licenseNumber,
        specializations: therapist.specializations,
        verificationStatus: therapist.verificationStatus
      }
    });

  } catch (error) {
    console.error('Therapist login error:', error);
    res.status(500).json({ success: false, message: 'Login failed: ' + error.message });
  }
});

// ============================================
// THERAPIST PROFILE (Authenticated)
// ============================================

// GET /api/mentalhealth/therapist/profile
router.get('/profile', auth, async (req, res) => {
  try {
    const therapist = await MentalHealthTherapist.findById(req.user.id).select('-password');
    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }
    res.json({ success: true, data: therapist });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// PUT /api/mentalhealth/therapist/profile
router.put('/profile', auth, async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password; // Prevent password update here

    const therapist = await MentalHealthTherapist.findByIdAndUpdate(
      req.user.id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-password');

    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }

    res.json({ success: true, message: 'Profile updated', data: therapist });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// ============================================
// THERAPIST AVAILABILITY
// ============================================

// PUT /api/mentalhealth/therapist/availability
router.put('/availability', auth, async (req, res) => {
  try {
    const { availability } = req.body;

    const therapist = await MentalHealthTherapist.findByIdAndUpdate(
      req.user.id,
      { availability, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }

    res.json({ success: true, message: 'Availability updated', data: therapist.availability });
  } catch (error) {
    console.error('Availability update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update availability' });
  }
});

// ============================================
// THERAPIST BOOKINGS
// ============================================

// GET /api/mentalhealth/therapist/bookings
router.get('/bookings', auth, async (req, res) => {
  try {
    const MentalHealthBooking = require('../models/MentalHealthBooking');
    const bookings = await MentalHealthBooking.find({ therapistId: req.user.id })
      .populate('patientId', 'name email phone')
      .sort({ scheduledDate: -1 });

    res.json({ success: true, data: bookings });
  } catch (error) {
    console.error('Bookings fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// PUT /api/mentalhealth/therapist/bookings/:id/status
router.put('/bookings/:id/status', auth, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const MentalHealthBooking = require('../models/MentalHealthBooking');

    const booking = await MentalHealthBooking.findOne({
      _id: req.params.id,
      therapistId: req.user.id
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    booking.status = status;
    if (notes) booking.therapistNotes = notes;
    booking.updatedAt = new Date();
    await booking.save();

    res.json({ success: true, message: 'Booking status updated', data: booking });
  } catch (error) {
    console.error('Booking status update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update booking status' });
  }
});

// ============================================
// THERAPIST STATS
// ============================================

// GET /api/mentalhealth/therapist/stats
router.get('/stats', auth, async (req, res) => {
  try {
    const MentalHealthBooking = require('../models/MentalHealthBooking');

    const totalBookings = await MentalHealthBooking.countDocuments({ therapistId: req.user.id });
    const pendingBookings = await MentalHealthBooking.countDocuments({
      therapistId: req.user.id,
      status: 'pending'
    });
    const confirmedBookings = await MentalHealthBooking.countDocuments({
      therapistId: req.user.id,
      status: 'confirmed'
    });
    const completedBookings = await MentalHealthBooking.countDocuments({
      therapistId: req.user.id,
      status: 'completed'
    });

    // Total revenue
    const revenueResult = await MentalHealthBooking.aggregate([
      { $match: { therapistId: req.user.id, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$therapistEarning' } } }
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;

    // Total patients (unique)
    const patients = await MentalHealthBooking.distinct('patientId', {
      therapistId: req.user.id,
      status: { $in: ['confirmed', 'completed'] }
    });

    res.json({
      success: true,
      data: {
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        totalRevenue,
        totalPatients: patients.length
      }
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// ============================================
// EMERGENCY TOGGLE
// ============================================

// PUT /api/mentalhealth/therapist/emergency-toggle
router.put('/emergency-toggle', auth, async (req, res) => {
  try {
    const { isEmergencyAvailable } = req.body;

    const therapist = await MentalHealthTherapist.findByIdAndUpdate(
      req.user.id,
      { isEmergencyAvailable, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: `Emergency availability ${isEmergencyAvailable ? 'enabled' : 'disabled'}`,
      data: { isEmergencyAvailable: therapist.isEmergencyAvailable }
    });
  } catch (error) {
    console.error('Emergency toggle error:', error);
    res.status(500).json({ success: false, message: 'Failed to update emergency status' });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const MentalHealthTherapist = require('../models/MentalHealthTherapist');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// REGISTER ROUTE
// ============================================
router.post('/register', async (req, res) => {
  try {
    console.log('📥 Request Body:', req.body);

    const {
      name, phone, email, password, licenseNumber,
      specializations, experience, about, city, state,
      education, languages, consultationTypes,
      consultationFee, pricing
    } = req.body;

    // Validation
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!phone) return res.status(400).json({ success: false, message: 'Phone is required' });
    if (!password) return res.status(400).json({ success: false, message: 'Password is required' });
    if (!licenseNumber) return res.status(400).json({ success: false, message: 'License number is required' });
    if (!specializations || specializations.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one specialization is required' });
    }
    if (!experience) return res.status(400).json({ success: false, message: 'Experience is required' });
    if (!city) return res.status(400).json({ success: false, message: 'City is required' });
    if (!state) return res.status(400).json({ success: false, message: 'State is required' });
    if (!consultationFee || parseInt(consultationFee) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid consultation fee is required' });
    }

    // Check duplicates
    const existingPhone = await MentalHealthTherapist.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({ success: false, message: 'Phone already registered' });
    }

    const existingLicense = await MentalHealthTherapist.findOne({ licenseNumber });
    if (existingLicense) {
      return res.status(400).json({ success: false, message: 'License already registered' });
    }

    if (email) {
      const existingEmail = await MentalHealthTherapist.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'Email already registered' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const consultationFeeNum = parseInt(consultationFee) || 0;

    const therapist = new MentalHealthTherapist({
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : '',
      password: hashedPassword,
      licenseNumber: licenseNumber.trim(),
      specializations,
      experience: parseInt(experience) || 0,
      about: about || '',
      city: city.trim(),
      state: state.trim(),
      education: education || '',
      languages: languages || [],
      consultationTypes: consultationTypes || { video: true, audio: true, text: true, anonymous: true },
      consultationFee: consultationFeeNum,
      pricing: {
        consultation: consultationFeeNum,
        videoTherapy: consultationFeeNum,
        audioTherapy: Math.round(consultationFeeNum * 0.8),
        textTherapy: Math.round(consultationFeeNum * 0.6),
        packageDiscount: 10
      },
      verificationStatus: 'pending',
      isActive: true
    });

    await therapist.save();

    const token = jwt.sign(
      { id: therapist._id, name: therapist.name, email: therapist.email, role: 'therapist', providerType: 'mentalhealth' },
      process.env.JWT_SECRET || 'hospital_platform_secret_key_2024',
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Please wait for verification.',
      data: { id: therapist._id, name: therapist.name, phone: therapist.phone, email: therapist.email, city: therapist.city, state: therapist.state, specializations: therapist.specializations, consultationFee: therapist.consultationFee, verificationStatus: therapist.verificationStatus, token }
    });

  } catch (error) {
    console.error('❌ Registration Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Registration failed' });
  }
});

// ============================================
// LOGIN ROUTE
// ============================================
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

    if (therapist.verificationStatus === 'rejected') {
      return res.status(403).json({ success: false, message: 'Registration rejected. Contact support.' });
    }

    const isPasswordValid = await bcrypt.compare(password, therapist.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: therapist._id, name: therapist.name, email: therapist.email, role: 'therapist', providerType: 'mentalhealth' },
      process.env.JWT_SECRET || 'hospital_platform_secret_key_2024',
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { id: therapist._id, name: therapist.name, phone: therapist.phone, email: therapist.email, city: therapist.city, state: therapist.state, specializations: therapist.specializations, consultationFee: therapist.consultationFee, verificationStatus: therapist.verificationStatus, token }
    });

  } catch (error) {
    console.error('❌ Login Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// VERIFY ROUTE
// ============================================
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const therapist = await MentalHealthTherapist.findById(req.user.id).select('-password');
    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }
    return res.status(200).json({ success: true, data: therapist });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// PROFILE ROUTE
// ============================================
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const therapist = await MentalHealthTherapist.findById(req.user.id).select('-password');
    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }
    return res.status(200).json({ success: true, data: therapist });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// UPDATE PROFILE ROUTE
// ============================================
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password;

    const therapist = await MentalHealthTherapist.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }

    return res.status(200).json({ success: true, message: 'Profile updated', data: therapist });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const MentalHealthTherapist = require('../models/MentalHealthTherapist');

// ✅ FIXED: Use correct auth middleware import
const { authenticateToken } = require('../middleware/auth');

// ============================================
// REGISTER
// ============================================
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      password,
      licenseNumber,
      specializations = [],
      experience,
      about = '',
      city,
      state,
      education = '',
      languages = [],
      consultationTypes = {
        video: true,
        audio: true,
        text: true,
        anonymous: true
      },
      consultationFee
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    if (!phone?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Phone is required'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    if (!licenseNumber?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'License number is required'
      });
    }

    if (!Array.isArray(specializations) || specializations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one specialization is required'
      });
    }

    if (experience === undefined || experience === null) {
      return res.status(400).json({
        success: false,
        message: 'Experience is required'
      });
    }

    if (!city?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'City is required'
      });
    }

    if (!state?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'State is required'
      });
    }

    const fee = Number(consultationFee);

    if (!fee || fee <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid consultation fee is required'
      });
    }

    const existingPhone = await MentalHealthTherapist.findOne({ phone });

    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: 'Phone already registered'
      });
    }

    const existingLicense = await MentalHealthTherapist.findOne({
      licenseNumber
    });

    if (existingLicense) {
      return res.status(400).json({
        success: false,
        message: 'License already registered'
      });
    }

    if (email?.trim()) {
      const existingEmail = await MentalHealthTherapist.findOne({
        email: email.trim()
      });

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const therapist = new MentalHealthTherapist({
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : '',
      password: hashedPassword,
      licenseNumber: licenseNumber.trim(),
      specializations,
      experience: Number(experience),
      about,
      city: city.trim(),
      state: state.trim(),
      education,
      languages,
      consultationTypes,
      consultationFee: fee,

      pricing: {
        consultation: fee,
        videoTherapy: fee,
        audioTherapy: Math.round(fee * 0.8),
        textTherapy: Math.round(fee * 0.6),
        packageDiscount: 10
      },

      verificationStatus: 'pending',
      isActive: true
    });

    await therapist.save();

    const token = jwt.sign(
      {
        id: therapist._id,
        name: therapist.name,
        email: therapist.email,
        role: 'therapist',
        providerType: 'mentalhealth'
      },
      process.env.JWT_SECRET || 'hospital_platform_secret_key_2024',
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        therapist,
        token
      }
    });

  } catch (error) {
    console.error('REGISTER ERROR:', error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// LOGIN
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone and password required'
      });
    }

    const therapist = await MentalHealthTherapist.findOne({ phone });

    if (!therapist) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const valid = await bcrypt.compare(
      password,
      therapist.password
    );

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      {
        id: therapist._id,
        role: 'therapist',
        providerType: 'mentalhealth'
      },
      process.env.JWT_SECRET || 'hospital_platform_secret_key_2024',
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      data: therapist
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// VERIFY
// ============================================
router.get('/verify', authenticateToken, async (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

// ============================================
// PROFILE
// ============================================
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const therapist = await MentalHealthTherapist
      .findById(req.user.id)
      .select('-password');

    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist not found'
      });
    }

    return res.json({
      success: true,
      data: therapist
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// UPDATE PROFILE
// ============================================
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const updates = { ...req.body };

    delete updates.password;

    const therapist = await MentalHealthTherapist.findByIdAndUpdate(
      req.user.id,
      updates,
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist not found'
      });
    }

    return res.json({
      success: true,
      message: 'Profile updated',
      data: therapist
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// ✅ ADMIN: RESET THERAPIST PASSWORD
// ============================================
router.put('/admin/therapists/:id/reset-password', authenticateToken, async (req, res) => {
  try {
    // Check admin role
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const therapist = await MentalHealthTherapist.findByIdAndUpdate(
      req.params.id,
      { password: hashedPassword },
      { new: true }
    );

    if (!therapist) {
      return res.status(404).json({ 
        success: false, 
        message: 'Therapist not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Password reset successfully' 
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;
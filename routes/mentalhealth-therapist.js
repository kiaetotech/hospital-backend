const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const MentalHealthTherapist = require('../models/MentalHealthTherapist');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// ✅ REGISTER ROUTE - COMPLETE FIXED VERSION
// ============================================
router.post('/register', async (req, res) => {
  try {
    console.log('📥 Registration Request Body:', req.body);

    // Destructure ALL fields from request body
    const {
      name,
      phone,
      email,
      password,
      licenseNumber,
      specializations,
      experience,
      about,
      city,
      state,
      education,
      languages,
      consultationTypes,
      consultationFee,
      pricing
    } = req.body;

    // ============================================
    // VALIDATION
    // ============================================
    
    // Check required fields
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name is required' 
      });
    }
    
    if (!phone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number is required' 
      });
    }
    
    if (!password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password is required' 
      });
    }
    
    if (!licenseNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'License number is required' 
      });
    }
    
    if (!specializations || specializations.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'At least one specialization is required' 
      });
    }
    
    if (!experience) {
      return res.status(400).json({ 
        success: false, 
        message: 'Years of experience is required' 
      });
    }
    
    if (!city) {
      return res.status(400).json({ 
        success: false, 
        message: 'City is required' 
      });
    }
    
    if (!state) {
      return res.status(400).json({ 
        success: false, 
        message: 'State is required' 
      });
    }
    
    if (!consultationFee || parseInt(consultationFee) <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid consultation fee is required' 
      });
    }

    // ============================================
    // CHECK DUPLICATES
    // ============================================

    // Check if phone already registered
    const existingPhone = await MentalHealthTherapist.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number already registered' 
      });
    }

    // Check if license number already registered
    const existingLicense = await MentalHealthTherapist.findOne({ licenseNumber });
    if (existingLicense) {
      return res.status(400).json({ 
        success: false, 
        message: 'License number already registered' 
      });
    }

    // Check if email already registered (if provided)
    if (email) {
      const existingEmail = await MentalHealthTherapist.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email already registered' 
        });
      }
    }

    // ============================================
    // HASH PASSWORD
    // ============================================
    
    const hashedPassword = await bcrypt.hash(password, 10);

    // ============================================
    // CREATE THERAPIST WITH ALL FIELDS
    // ============================================

    const consultationFeeNum = parseInt(consultationFee) || 0;

    const therapist = new MentalHealthTherapist({
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : '',
      password: hashedPassword,
      licenseNumber: licenseNumber.trim(),
      specializations: specializations,
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

    console.log('✅ Therapist registered successfully:', therapist._id);

    // ============================================
    // GENERATE JWT TOKEN
    // ============================================

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

    // ============================================
    // RESPONSE
    // ============================================

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Please wait for verification.',
      data: {
        id: therapist._id,
        name: therapist.name,
        phone: therapist.phone,
        email: therapist.email,
        city: therapist.city,
        state: therapist.state,
        specializations: therapist.specializations,
        consultationFee: therapist.consultationFee,
        verificationStatus: therapist.verificationStatus,
        token: token
      }
    });

  } catch (error) {
    console.error('❌ Registration Error:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Registration failed. Please try again.'
    });
  }
});

// ============================================
// ✅ LOGIN ROUTE
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone and password are required'
      });
    }

    // Find therapist by phone
    const therapist = await MentalHealthTherapist.findOne({ phone });
    if (!therapist) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone or password'
      });
    }

    // Check if approved
    if (therapist.verificationStatus === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your registration has been rejected. Please contact support.'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, therapist.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone or password'
      });
    }

    // Generate JWT token
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

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: therapist._id,
        name: therapist.name,
        phone: therapist.phone,
        email: therapist.email,
        city: therapist.city,
        state: therapist.state,
        specializations: therapist.specializations,
        consultationFee: therapist.consultationFee,
        verificationStatus: therapist.verificationStatus,
        token: token
      }
    });

  } catch (error) {
    console.error('❌ Login Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Login failed. Please try again.'
    });
  }
});

// ============================================
// ✅ GET THERAPIST PROFILE
// ============================================
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const therapist = await MentalHealthTherapist.findById(req.user.id)
      .select('-password');

    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: therapist
    });

  } catch (error) {
    console.error('❌ Profile Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch profile'
    });
  }
});

// ============================================
// ✅ UPDATE THERAPIST PROFILE
// ============================================
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password; // Prevent password update here

    const therapist = await MentalHealthTherapist.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: therapist
    });

  } catch (error) {
    console.error('❌ Update Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update profile'
    });
  }
});

module.exports = router;
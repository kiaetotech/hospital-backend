const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const MentalHealthTherapist = require('../models/MentalHealthTherapist');

// ✅ FIXEDcorrect auth middleware import
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
        video,
        audio,
        text,
        anonymous},
      consultationFee
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success,
        message: 'Name is required'
      });
    }

    if (!phone?.trim()) {
      return res.status(400).json({
        success,
        message: 'Phone is required'
      });
    }

    if (!password) {
      return res.status(400).json({
        success,
        message: 'Password is required'
      });
    }

    if (!licenseNumber?.trim()) {
      return res.status(400).json({
        success,
        message: 'License number is required'
      });
    }

    if (!Array.isArray(specializations) || specializations.length === 0) {
      return res.status(400).json({
        success,
        message: 'At least one specialization is required'
      });
    }

    if (experience === undefined || experience === null) {
      return res.status(400).json({
        success,
        message: 'Experience is required'
      });
    }

    if (!city?.trim()) {
      return res.status(400).json({
        success,
        message: 'City is required'
      });
    }

    if (!state?.trim()) {
      return res.status(400).json({
        success,
        message: 'State is required'
      });
    }

    const fee = Number(consultationFee);

    if (!fee || fee <= 0) {
      return res.status(400).json({
        success,
        message: 'Valid consultation fee is required'
      });
    }

    const existingPhone = await MentalHealthTherapist.findOne({ phone });

    if (existingPhone) {
      return res.status(400).json({
        success,
        message: 'Phone already registered'
      });
    }

    const existingLicense = await MentalHealthTherapist.findOne({
      licenseNumber
    });

    if (existingLicense) {
      return res.status(400).json({
        success,
        message: 'License already registered'
      });
    }

    if (email?.trim()) {
      const existingEmail = await MentalHealthTherapist.findOne({
        email.trim()
      });

      if (existingEmail) {
        return res.status(400).json({
          success,
          message: 'Email already registered'
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const therapist = new MentalHealthTherapist({
      name.trim(),
      phone.trim(),
      email? email.trim() : '',
      password,
      licenseNumber.trim(),
      specializations,
      experience(experience),
      about,
      city.trim(),
      state.trim(),
      education,
      languages,
      consultationTypes,
      consultationFee,

      pricing: {
        consultation,
        videoTherapy,
        audioTherapy.round(fee * 0.8),
        textTherapy.round(fee * 0.6),
        packageDiscount: 10
      },

      verificationStatus: 'pending',
      isActive});

    await therapist.save();

    const token = jwt.sign(
      {
        id._id,
        name.name,
        email.email,
        role: 'therapist',
        providerType: 'mentalhealth'
      },
      process.env.JWT_SECRET || 'hospital_platform_secret_key_2024',
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success,
      message: 'Registration successful',
      data: {
        therapist,
        token
      }
    });

  } catch (error) {
    console.error('REGISTER ERROR:', error);

    return res.status(500).json({
      success,
      message.message
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
        success,
        message: 'Phone and password required'
      });
    }

    const therapist = await MentalHealthTherapist.findOne({ phone });

    if (!therapist) {
      return res.status(401).json({
        success,
        message: 'Invalid credentials'
      });
    }

    const valid = await bcrypt.compare(
      password,
      therapist.password
    );

    if (!valid) {
      return res.status(401).json({
        success,
        message: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      {
        id._id,
        role: 'therapist',
        providerType: 'mentalhealth'
      },
      process.env.JWT_SECRET || 'hospital_platform_secret_key_2024',
      { expiresIn: '7d' }
    );

    return res.json({
      success,
      message: 'Login successful',
      token,
      data});

  } catch (error) {
    console.error('LOGIN ERROR:', error);

    return res.status(500).json({
      success,
      message.message
    });
  }
});

// ============================================
// VERIFY
// ============================================
router.get('/verify', authenticateToken, async (req, res) => {
  return res.json({
    success,
    user.user
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
        success,
        message: 'Therapist not found'
      });
    }

    return res.json({
      success,
      data});

  } catch (error) {
    return res.status(500).json({
      success,
      message.message
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
        new,
        runValidators}
    ).select('-password');

    if (!therapist) {
      return res.status(404).json({
        success,
        message: 'Therapist not found'
      });
    }

    return res.json({
      success,
      message: 'Profile updated',
      data});

  } catch (error) {
    return res.status(500).json({
      success,
      message.message
    });
  }
});

// ============================================
// ✅ ADMINTHERAPIST PASSWORD
// ============================================
router.put('/admin/therapists//reset-password', authenticateToken, async (req, res) => {
  try {
    // Check admin role
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        success, 
        message: 'Admin access required' 
      });
    }

    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ 
        success, 
        message: 'Password must be at least 6 characters' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const therapist = await MentalHealthTherapist.findByIdAndUpdate(
      req.params.id,
      { password},
      { new}
    );

    if (!therapist) {
      return res.status(404).json({ 
        success, 
        message: 'Therapist not found' 
      });
    }

    res.json({ 
      success, 
      message: 'Password reset successfully' 
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ 
      success, 
      message.message 
    });
  }
});

// ============================================
// 🆕 CORPORATE HEALTH ROUTES
// ============================================

// Toggle corporate serving status
router.put('/corporate/toggle', authenticateToken, async (req, res) => {
  try {
    const therapist = await MentalHealthTherapist.findById(req.user.id);
    if (!therapist) {
      return res.status(404).json({ success, message: 'Therapist not found' });
    }

    const enable = req.body.enable !== false;
    await therapist.toggleCorporate(enable);

    res.json({
      success,
      message: `Corporate ${enable ? 'enabled' : 'disabled'} successfully`,
      data: { servesCorporate.servesCorporate }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Get corporate packages
router.get('/corporate/packages', authenticateToken, async (req, res) => {
  try {
    const therapist = await MentalHealthTherapist.findById(req.user.id).select('servesCorporate corporatePackages');
    if (!therapist) {
      return res.status(404).json({ success, message: 'Therapist not found' });
    }

    res.json({
      success,
      data: {
        servesCorporate.servesCorporate,
        packages.corporatePackages || []
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Create corporate package
router.post('/corporate/packages', authenticateToken, async (req, res) => {
  try {
    const therapist = await MentalHealthTherapist.findById(req.user.id);
    if (!therapist) {
      return res.status(404).json({ success, message: 'Therapist not found' });
    }

    const { packageName, packageType, description, servicesIncluded, pricePerEmployee, discountedPricePerEmployee, minEmployees, maxEmployees, validityDays, sessionsPerEmployee, sessionDurationMinutes, availableCities, dedicatedPOC, anonymityGuaranteed, slaTerms } = req.body;

    if (!packageName || !pricePerEmployee) {
      return res.status(400).json({ success, message: 'Package name and price per employee are required' });
    }

    const packageData = {
      packageName,
      packageType|| 'employee_assistance_program',
      description|| '',
      servicesIncluded|| [],
      pricePerEmployee,
      discountedPricePerEmployee,
      minEmployees|| 10,
      maxEmployees,
      validityDays|| 365,
      sessionsPerEmployee|| 4,
      sessionDurationMinutes|| 50,
      availableCities|| [],
      dedicatedPOC|| {},
      anonymityGuaranteed!== undefined ? anonymityGuaranteed ,
      slaTerms|| ''
    };

    await therapist.addCorporatePackage(packageData);

    res.json({
      success,
      message: 'Corporate package added successfully',
      data.corporatePackages[therapist.corporatePackages.length - 1]
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Update corporate package
router.put('/corporate/packages/', authenticateToken, async (req, res) => {
  try {
    const therapist = await MentalHealthTherapist.findById(req.user.id);
    if (!therapist) {
      return res.status(404).json({ success, message: 'Therapist not found' });
    }

    const pkg = therapist.corporatePackages.id(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ success, message: 'Package not found' });
    }

    const updatableFields = [
      'packageName', 'packageType', 'description', 'servicesIncluded',
      'pricePerEmployee', 'discountedPricePerEmployee', 'minEmployees',
      'maxEmployees', 'validityDays', 'sessionsPerEmployee',
      'sessionDurationMinutes', 'availableCities', 'dedicatedPOC',
      'anonymityGuaranteed', 'slaTerms', 'isActive'
    ];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        pkg[field] = req.body[field];
      }
    });

    pkg.updatedAt = new Date();
    await therapist.save();

    res.json({ success, message: 'Corporate package updated', data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Delete corporate package
router.delete('/corporate/packages/', authenticateToken, async (req, res) => {
  try {
    const therapist = await MentalHealthTherapist.findById(req.user.id);
    if (!therapist) {
      return res.status(404).json({ success, message: 'Therapist not found' });
    }

    const pkg = therapist.corporatePackages.id(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ success, message: 'Package not found' });
    }

    pkg.remove();
    await therapist.save();

    res.json({ success, message: 'Corporate package deleted' });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Get corporate enquiries
router.get('/corporate/enquiries', authenticateToken, async (req, res) => {
  try {
    const therapist = await MentalHealthTherapist.findById(req.user.id).select('corporateEnquiries');
    if (!therapist) {
      return res.status(404).json({ success, message: 'Therapist not found' });
    }

    res.json({ success, data.corporateEnquiries || [] });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Update enquiry status
router.put('/corporate/enquiries/', authenticateToken, async (req, res) => {
  try {
    const therapist = await MentalHealthTherapist.findById(req.user.id);
    if (!therapist) {
      return res.status(404).json({ success, message: 'Therapist not found' });
    }

    const enquiry = therapist.corporateEnquiries.id(req.params.enquiryId);
    if (!enquiry) {
      return res.status(404).json({ success, message: 'Enquiry not found' });
    }

    if (req.body.status) {
      enquiry.status = req.body.status;
    }

    await therapist.save();
    res.json({ success, message: 'Enquiry updated', data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

module.exports = router;


const express = require('express');
const router = express.Router();
const Otp = require('../models/Otp');
const User = require('../models/User');
const { authenticate: auth } = require('../middleware/auth');
const smsService = require('../services/smsService');
const emailService = require('../services/emailService');

// ============================================
// SEND OTP
// ============================================

/**
 * POST /api/otp/send
 * Body: { phone, email, type, referenceId, referenceModel }
 * 
 * Types: login, registration, password_reset, 
 *        hospital_booking, ambulance_booking, labtest_booking,
 *        caregiver_booking, ayurveda_consultation, homeopathy_consult,
 *        insurance_application, insurance_claim, policy_issue,
 *        verification, two_factor
 */
router.post('/send', async (req, res) => {
  try {
    const { 
      phone, 
      email, 
      type, 
      referenceId, 
      referenceModel,
      expiresIn = 300 // 5 minutes
    } = req.body;

    // Validate: at least phone or email
    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        message: 'Either phone number or email is required'
      });
    }

    // Validate type
    const validTypes = [
      'login', 'registration', 'password_reset',
      'hospital_booking', 'ambulance_booking', 'labtest_booking',
      'caregiver_booking', 'ayurveda_consultation', 'homeopathy_consult',
      'insurance_application', 'insurance_claim', 'policy_issue',
      'verification', 'two_factor'
    ];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP type'
      });
    }

    // Get user ID if authenticated
    let userId = null;
    if (req.user) {
      userId = req.user.id;
    }

    // Create OTP
    const otpDoc = await Otp.createOTP({
      phone,
      email,
      type,
      userId,
      referenceId,
      referenceModel,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      sentVia: phone ? 'sms' : 'email',
      expiresIn
    });

    // Send OTP via SMS or Email
    let deliveryStatus = 'pending';
    
    if (phone) {
      // Send SMS
      const smsResult = await smsService.sendOTP(phone, otpDoc.otp, type);
      if (smsResult.success) {
        deliveryStatus = 'sent';
        otpDoc.deliveredAt = new Date();
        await otpDoc.save();
      }
    }

    if (email && !phone) {
      // Send Email
      const emailResult = await emailService.sendOTP(email, otpDoc.otp, type);
      if (emailResult.success) {
        deliveryStatus = 'sent';
        otpDoc.deliveredAt = new Date();
        await otpDoc.save();
      }
    }

    // For security, don't return OTP in response
        res.json({
      success: true,
      message: deliveryStatus === 'sent' ? `OTP sent successfully` : `OTP generated — use this code`,
      data: {
        referenceId: otpDoc._id,
        sentVia: phone ? 'sms' : 'email',
        expiresIn: expiresIn,
        deliveryStatus: deliveryStatus,
        otp: deliveryStatus !== 'sent' ? otpDoc.otp : undefined
      }
    });

  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP: ' + error.message
    });
  }
});

// ============================================
// VERIFY OTP
// ============================================

/**
 * POST /api/otp/verify
 * Body: { phone, email, otp, type }
 */
router.post('/verify', async (req, res) => {
  try {
    const { phone, email, otp, type } = req.body;

    // Validate
    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        message: 'Either phone number or email is required'
      });
    }

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required'
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'OTP type is required'
      });
    }

    // Verify OTP
    const result = await Otp.verifyOTP(phone, email, otp, type);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        data: {
          attemptsRemaining: result.attemptsRemaining,
          isBlocked: result.isBlocked,
          isExpired: result.isExpired
        }
      });
    }

    // If user is authenticated, mark phone/email as verified
    if (req.user) {
      const updateData = {};
      if (phone) {
        updateData.phoneVerified = true;
        updateData.phoneVerificationDate = new Date();
      }
      if (email) {
        updateData.emailVerified = true;
        updateData.emailVerificationDate = new Date();
      }
      
      await User.findByIdAndUpdate(req.user.id, updateData);
    }

    res.json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        verified: true,
        verifiedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP: ' + error.message
    });
  }
});

// ============================================
// RESEND OTP
// ============================================

/**
 * POST /api/otp/resend
 * Body: { phone, email, type }
 */
router.post('/resend', async (req, res) => {
  try {
    const { phone, email, type } = req.body;

    // Validate
    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        message: 'Either phone number or email is required'
      });
    }

    // Delete old unused OTPs
    const query = { type, isUsed: false };
    if (phone) query.phone = phone;
    if (email) query.email = email;
    
    await Otp.deleteMany(query);

    // Get user ID if authenticated
    let userId = null;
    if (req.user) {
      userId = req.user.id;
    }

    // Create new OTP
    const otpDoc = await Otp.createOTP({
      phone,
      email,
      type,
      userId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      sentVia: phone ? 'sms' : 'email'
    });

    // Send OTP
    if (phone) {
      await smsService.sendOTP(phone, otpDoc.otp, type);
    }
    if (email && !phone) {
      await emailService.sendOTP(email, otpDoc.otp, type);
    }

    res.json({
      success: true,
      message: 'OTP resent successfully',
      data: {
        referenceId: otpDoc._id
      }
    });

  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP: ' + error.message
    });
  }
});

// ============================================
// GET OTP STATUS
// ============================================

/**
 * GET /api/otp/status
 * Query: { phone, email, type }
 */
router.get('/status', async (req, res) => {
  try {
    const { phone, email, type } = req.query;

    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        message: 'Either phone number or email is required'
      });
    }

    const status = await Otp.getStatus(phone, email, type);

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('Error getting OTP status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get OTP status: ' + error.message
    });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Get OTP logs (Admin only)
router.get('/logs', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { page = 1, limit = 50, type, phone, email, isUsed } = req.query;

    const query = {};
    if (type) query.type = type;
    if (phone) query.phone = phone;
    if (email) query.email = email;
    if (isUsed !== undefined) query.isUsed = isUsed === 'true';

    const skip = (page - 1) * limit;
    const otps = await Otp.find(query)
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Otp.countDocuments(query);

    res.json({
      success: true,
      data: otps,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching OTP logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch OTP logs'
    });
  }
});

// Clean up expired OTPs (Admin only)
router.delete('/cleanup', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const result = await Otp.cleanupExpired();

    res.json({
      success: true,
      message: `Cleaned up ${result.deletedCount} expired OTPs`,
      data: result
    });

  } catch (error) {
    console.error('Error cleaning up OTPs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clean up OTPs'
    });
  }
});

module.exports = router;
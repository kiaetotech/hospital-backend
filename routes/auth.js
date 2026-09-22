const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { authenticateToken } = require('../middleware/auth');
const smsService = require('../services/smsService');

// ============================================
// MULTI-ROLE MODEL MAP
// Each user type maps to its model + contact fields
// ============================================
const getModelForUserType = (userType) => {
  const models = {
    patient: {
      Model: require('../models/User'),
      phoneField: 'phone',
      emailField: 'email',
      nameField: 'name',
      passwordField: 'password'
    },
    doctor: {
      Model: require('../models/AyurvedaDoctor'),
      phoneField: 'phone',
      emailField: 'email',
      nameField: 'name',
      passwordField: 'password'
    },
    center: {
      Model: require('../models/WellnessCenter'),
      phoneField: 'phone',
      emailField: 'email',
      nameField: 'name',
      passwordField: 'password'
    },
    hospital: {
      Model: (() => { try { return require('../models/Hospital'); } catch { return null; } })(),
      phoneField: 'phone',
      emailField: 'email',
      nameField: 'name',
      passwordField: 'password'
    },
    online_doctor: {
      Model: (() => { try { return require('../models/OnlineDoctor'); } catch { return null; } })(),
      phoneField: 'phone',
      emailField: 'email',
      nameField: 'name',
      passwordField: 'password'
    },
    therapist: {
      Model: (() => { try { return require('../models/MentalHealthTherapist'); } catch { return null; } })(),
      phoneField: 'phone',
      emailField: 'email',
      nameField: 'name',
      passwordField: 'password'
    },
    caregiver: {
      Model: (() => { try { return require('../models/Caregiver'); } catch { return null; } })(),
      phoneField: 'phone',
      emailField: 'email',
      nameField: 'name',
      passwordField: 'password'
    },
    diagnostics: {
      Model: (() => { try { return require('../models/DiagnosticsProvider'); } catch { return null; } })(),
      phoneField: 'phone',
      emailField: 'email',
      nameField: 'name',
      passwordField: 'password'
    },
    lender: {
      Model: (() => { try { return require('../models/Lender'); } catch { return null; } })(),
      phoneField: 'phone',
      emailField: 'email',
      nameField: 'name',
      passwordField: 'password'
    },
    insurance: {
      Model: (() => { try { return require('../models/InsuranceCompany'); } catch { return null; } })(),
      phoneField: 'phone',
      emailField: 'email',
      nameField: 'name',
      passwordField: 'password'
    }
  };

  return models[userType] || models.patient;
};

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role, vehicleNumber, ambulanceType, driverName, driverPhone } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userData = { name, email, phone, password: hashedPassword, role };
    
    // Save ambulance registration data
    if (role === 'ambulance_provider') {
      if (vehicleNumber || ambulanceType || driverName || driverPhone) {
        userData.ambulanceFleet = [{
          vehicleNumber: vehicleNumber || '',
          type: ambulanceType || 'Basic',
          status: 'available'
        }];
        userData.ambulanceDrivers = [{
          name: driverName || '',
          phone: driverPhone || '',
          licenseNumber: '',
          status: 'available',
          isAvailable: true
        }];
      }
      userData.ambulanceVerificationStatus = 'pending';
    }
    
    const user = new User(userData);
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ success: true, token, user: { id: user._id, name, email, role } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🔐 MULTI-ROLE PASSWORD RESET FLOW — Production
// ============================================

const resetAttempts = new Map();

const checkRateLimit = (key, maxAttempts = 3, windowMs = 60 * 60 * 1000) => {
  const now = Date.now();
  const record = resetAttempts.get(key);

  if (!record || now > record.resetAt) {
    resetAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (record.count >= maxAttempts) {
    const waitMin = Math.ceil((record.resetAt - now) / 60000);
    return { allowed: false, message: `Too many attempts. Try again after ${waitMin} minutes.` };
  }
  record.count += 1;
  return { allowed: true };
};

const isStrongPassword = (password) => {
  if (!password || password.length < 8) return { valid: false, reason: 'Password must be at least 8 characters' };
  if (!/[A-Z]/.test(password)) return { valid: false, reason: 'Must contain at least one uppercase letter' };
  if (!/[a-z]/.test(password)) return { valid: false, reason: 'Must contain at least one lowercase letter' };
  if (!/[0-9]/.test(password)) return { valid: false, reason: 'Must contain at least one number' };
  return { valid: true };
};

// ============================================
// STEP 1 — Request Password Reset OTP
// ============================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, phone, userType = 'patient' } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'Email or phone is required' });
    }

    const rateCheck = checkRateLimit(`pwd-reset:${userType}:${email || phone}`);
    if (!rateCheck.allowed) {
      return res.status(429).json({ success: false, message: rateCheck.message });
    }

    const config = getModelForUserType(userType);
    if (!config.Model) {
      return res.status(400).json({ success: false, message: 'Invalid user type' });
    }

    const { Model, phoneField, emailField } = config;

    const query = email 
      ? { [emailField]: email.toLowerCase().trim() } 
      : { [phoneField]: phone.trim() };

    const user = await Model.findOne(query);

    if (user) {
      try {
        const otpDoc = await Otp.createOTP({
          phone: user[phoneField],
          email: user[emailField],
          type: 'password_reset',
          userId: user._id,
          referenceModel: userType,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          sentVia: 'sms',
          expiresIn: 600
        });

        if (user[phoneField]) {
          try {
            await smsService.sendSMS(
              user[phoneField],
              `Your password reset OTP is ${otpDoc.otp}. Valid for 10 minutes. Do not share this with anyone. - KiaetoCare`
            );
          } catch (smsErr) {
            console.error('Reset SMS failed:', smsErr.message);
          }
        }

        if (user[emailField]) {
          console.log(`[Password Reset] ${userType} ${user[emailField]}: ${otpDoc.otp}`);
        }
      } catch (otpErr) {
        console.error('OTP create failed:', otpErr.message);
      }
    }

    // Same response regardless — no user enumeration
    res.json({
      success: true,
      message: 'If an account exists with these details, an OTP has been sent.'
    });

  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({ success: false, message: 'Unable to process request' });
  }
});

// ============================================
// STEP 2 — Verify OTP, issue reset token
// ============================================
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, phone, otp, userType = 'patient' } = req.body;

    if (!otp || otp.length !== 6) {
      return res.status(400).json({ success: false, message: 'Enter a valid 6-digit OTP' });
    }

    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'Email or phone is required' });
    }

    const config = getModelForUserType(userType);
    const { phoneField, emailField } = config;

    const query = { type: 'password_reset', isUsed: false };
    if (email) query[emailField] = email.toLowerCase().trim();
    if (phone) query[phoneField] = phone.trim();

    const otpDoc = await Otp.findOne(query).sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const verifyResult = otpDoc.verify(otp);
    await otpDoc.save();

    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        message: verifyResult.message,
        attemptsRemaining: verifyResult.attemptsRemaining
      });
    }

    // Issue reset token (15 min)
    const resetToken = crypto.randomBytes(32).toString('hex');
    resetAttempts.set(`reset-token:${resetToken}`, {
      userId: otpDoc.userId,
      userType,
      expiresAt: Date.now() + 15 * 60 * 1000
    });

    res.json({
      success: true,
      message: 'OTP verified. Please set your new password.',
      resetToken,
      expiresIn: 900
    });

  } catch (error) {
    console.error('Verify OTP error:', error.message);
    res.status(500).json({ success: false, message: 'Unable to verify OTP' });
  }
});

// ============================================
// STEP 3 — Set new password
// ============================================
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ success: false, message: 'Reset token and new password required' });
    }

    const tokenData = resetAttempts.get(`reset-token:${resetToken}`);
    if (!tokenData) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    if (Date.now() > tokenData.expiresAt) {
      resetAttempts.delete(`reset-token:${resetToken}`);
      return res.status(400).json({ success: false, message: 'Reset token expired' });
    }

    const strength = isStrongPassword(newPassword);
    if (!strength.valid) {
      return res.status(400).json({ success: false, message: strength.reason });
    }

    const config = getModelForUserType(tokenData.userType);
    if (!config.Model) {
      return res.status(400).json({ success: false, message: 'Invalid user type' });
    }

    const { Model, passwordField } = config;

    const user = await Model.findById(tokenData.userId);
    if (!user) {
      resetAttempts.delete(`reset-token:${resetToken}`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user[passwordField] = await bcrypt.hash(newPassword, 10);
    await user.save();

    resetAttempts.delete(`reset-token:${resetToken}`);

    await Otp.updateMany(
      { userId: user._id, type: 'password_reset' },
      { $set: { isUsed: true } }
    );

    console.log(`✅ Password reset successful for ${tokenData.userType}: ${user._id}`);

    res.json({
      success: true,
      message: 'Password reset successful. Please login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error.message);
    res.status(500).json({ success: false, message: 'Unable to reset password' });
  }
});

router.post('/migrate-ambulance-data', async (req, res) => {
  try {
    const { email, vehicleNumber, type } = req.body;
    const user = await User.findOne({ email, role: 'ambulance_provider' });
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });
    
    if (user.ambulanceFleet && user.ambulanceFleet.length > 0) {
      user.ambulanceFleet[0].vehicleNumber = vehicleNumber || user.ambulanceFleet[0].vehicleNumber;
      user.ambulanceFleet[0].type = type || user.ambulanceFleet[0].type || 'basic';
    } else {
      user.ambulanceFleet = [{ vehicleNumber: vehicleNumber || 'N/A', type: type || 'basic', status: 'available' }];
    }
    await user.save();
    
    res.json({ success: true, message: 'Updated', fleet: user.ambulanceFleet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get patient profile
router.get('/patient/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email phone patientAddress patientLocation');
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update patient profile
router.put('/patient/profile', authenticateToken, async (req, res) => {
  try {
    const { patientAddress, patientLocation, name, phone } = req.body;
    const updates = {};
    if (patientAddress) updates.patientAddress = patientAddress;
    if (patientLocation) updates.patientLocation = patientLocation;
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    
    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true }).select('-password');
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
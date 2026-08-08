const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

// Reset password (for testing - REMOVE IN PRODUCTION)
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

module.exports = router;
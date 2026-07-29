const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ success, message: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, phone, password, role });
    await user.save();
    
    const token = jwt.sign({ id._id, role.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ success, token, user: { id._id, name, email, role } });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success, message: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success, message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id._id, role.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ success, token, user: { id._id, name.name, email.email, role.role } });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

module.exports = router;


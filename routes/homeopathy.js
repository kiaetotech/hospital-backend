const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const HomeopathyDoctor = require('../models/HomeopathyDoctor');
const JWT_SECRET = process.env.JWT_SECRET || 'hospital_platform_secret_key_2024';

// GET /api/homeopathy/doctors
router.get('/doctors', async (req, res) => {
  try {
    const doctors = await HomeopathyDoctor.find({ isActive: true }).select('-password');
    res.json({ success: true, data: doctors });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

// GET /api/homeopathy/doctors/:id
router.get('/doctors/:id', async (req, res) => {
  try {
    const doctor = await HomeopathyDoctor.findById(req.params.id).select('-password');
    if (!doctor) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/homeopathy/doctor/register
router.post('/doctor/register', async (req, res) => {
  try {
    const { name, phone, password, specialization, experience, education, registrationNumber, consultationFee, city } = req.body;
    const existing = await HomeopathyDoctor.findOne({ $or: [{ phone }, { registrationNumber }] });
    if (existing) return res.status(400).json({ success: false, error: 'Already registered' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const doctor = new HomeopathyDoctor({
      name, phone, password: hashedPassword, specialization, experience, education,
      registrationNumber, consultationFee, address: { city }
    });
    await doctor.save();
    res.status(201).json({ success: true, message: 'Registration submitted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/homeopathy/doctor/login
router.post('/doctor/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const doctor = await HomeopathyDoctor.findOne({ phone });
    if (!doctor) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, doctor.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    
    if (doctor.verificationStatus !== 'approved') return res.status(403).json({ success: false, error: 'Account not approved' });
    
    const token = jwt.sign({ id: doctor._id, role: 'homeopathy_doctor' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, doctor: { id: doctor._id, name: doctor.name } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
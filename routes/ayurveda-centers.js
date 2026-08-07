const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const WellnessCenter = require('../models/WellnessCenter');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital_platform_secret_key_2024';

// ============================================
// CENTER REGISTRATION
// ============================================
router.post('/register', async (req, res) => {
  try {
    const { name, phone, email, password, type, description, address, bedCount, panchakarmaRooms, facilities } = req.body;
    
    const existing = await WellnessCenter.findOne({ $or: [{ phone }, { email }] });
    if (existing) return res.status(400).json({ success: false, error: 'Center already registered' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const center = new WellnessCenter({
      name, phone, email, password: hashedPassword,
      type: type || 'Wellness Center',
      description,
      address: address || {},
      bedCount, panchakarmaRooms,
      facilities: facilities || [],
      verificationStatus: 'pending'
    });
    
    await center.save();
    res.status(201).json({ success: true, message: 'Registration submitted for verification', centerId: center._id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CENTER LOGIN
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const center = await WellnessCenter.findOne({ phone });
    if (!center) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, center.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    
    if (center.verificationStatus !== 'approved') {
      return res.status(403).json({ success: false, error: 'Account not approved. Status: ' + center.verificationStatus });
    }
    
    const token = jwt.sign({ id: center._id, role: 'wellness_center' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, center: { id: center._id, name: center.name, type: center.type } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CENTER DASHBOARD
// ============================================
router.get('/dashboard/:centerId', async (req, res) => {
  try {
    const center = await WellnessCenter.findById(req.params.centerId)
      .select('-password')
      .populate('doctors', 'name specialization');
    
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });
    
    res.json({ success: true, data: center });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PACKAGE MANAGEMENT
// ============================================
router.post('/packages/:centerId', async (req, res) => {
  try {
    const center = await WellnessCenter.findById(req.params.centerId);
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });
    
    center.packages.push(req.body);
    await center.save();
    
    res.json({ success: true, message: 'Package added', data: center.packages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/packages/:centerId/:packageId', async (req, res) => {
  try {
    const center = await WellnessCenter.findById(req.params.centerId);
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });
    
    const pkg = center.packages.id(req.params.packageId);
    if (!pkg) return res.status(404).json({ success: false, error: 'Package not found' });
    
    Object.assign(pkg, req.body);
    await center.save();
    
    res.json({ success: true, message: 'Package updated', data: pkg });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/packages/:centerId/:packageId', async (req, res) => {
  try {
    const center = await WellnessCenter.findById(req.params.centerId);
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });
    
    center.packages.pull(req.params.packageId);
    await center.save();
    
    res.json({ success: true, message: 'Package removed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN: VERIFY CENTER
// ============================================
router.put('/admin/verify/:centerId', async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const center = await WellnessCenter.findByIdAndUpdate(req.params.centerId, {
      verificationStatus: status,
      isActive: status === 'approved',
      verifiedAt: new Date(),
      rejectionReason: status === 'rejected' ? rejectionReason : null
    }, { new: true });
    
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });
    res.json({ success: true, message: `Center ${status}`, data: center });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN: PENDING CENTERS
// ============================================
router.get('/admin/pending', async (req, res) => {
  try {
    const centers = await WellnessCenter.find({ verificationStatus: 'pending' })
      .select('name phone type address.city createdAt')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: centers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PUBLIC: LIST CENTERS
// ============================================
router.get('/', async (req, res) => {
  try {
    var { city, type, page = 1, limit = 20 } = req.query;
    var query = { isActive: true, verificationStatus: 'approved' };
    if (city) query['address.city'] = { $regex: city, $options: 'i' };
    if (type) query.type = type;
    
    var centers = await WellnessCenter.find(query).select('-password').skip((page - 1) * limit).limit(parseInt(limit)).lean();
    var total = await WellnessCenter.countDocuments(query);
    
    res.json({ success: true, data: centers, total: total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
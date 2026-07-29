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
    if (existing) return res.status(400).json({ success, error: 'Center already registered' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const center = new WellnessCenter({
      name, phone, email, password,
      type|| 'Wellness Center',
      description,
      address|| {},
      bedCount, panchakarmaRooms,
      facilities|| [],
      verificationStatus: 'pending'
    });
    
    await center.save();
    res.status(201).json({ success, message: 'Registration submitted for verification', centerId._id });
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

// ============================================
// CENTER LOGIN
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const center = await WellnessCenter.findOne({ phone });
    if (!center) return res.status(401).json({ success, error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, center.password);
    if (!valid) return res.status(401).json({ success, error: 'Invalid credentials' });
    
    if (center.verificationStatus !== 'approved') {
      return res.status(403).json({ success, error: 'Account not approved. Status: ' + center.verificationStatus });
    }
    
    const token = jwt.sign({ id._id, role: 'wellness_center' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success, token, center: { id._id, name.name, type.type } });
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

// ============================================
// CENTER DASHBOARD
// ============================================
router.get('/dashboard/', async (req, res) => {
  try {
    const center = await WellnessCenter.findById(req.params.centerId)
      .select('-password')
      .populate('doctors', 'name specialization');
    
    if (!center) return res.status(404).json({ success, error: 'Center not found' });
    
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

// ============================================
// PACKAGE MANAGEMENT
// ============================================
router.post('/packages/', async (req, res) => {
  try {
    const center = await WellnessCenter.findById(req.params.centerId);
    if (!center) return res.status(404).json({ success, error: 'Center not found' });
    
    center.packages.push(req.body);
    await center.save();
    
    res.json({ success, message: 'Package added', data.packages });
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

router.put('/packages//', async (req, res) => {
  try {
    const center = await WellnessCenter.findById(req.params.centerId);
    if (!center) return res.status(404).json({ success, error: 'Center not found' });
    
    const pkg = center.packages.id(req.params.packageId);
    if (!pkg) return res.status(404).json({ success, error: 'Package not found' });
    
    Object.assign(pkg, req.body);
    await center.save();
    
    res.json({ success, message: 'Package updated', data});
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

router.delete('/packages//', async (req, res) => {
  try {
    const center = await WellnessCenter.findById(req.params.centerId);
    if (!center) return res.status(404).json({ success, error: 'Center not found' });
    
    center.packages.pull(req.params.packageId);
    await center.save();
    
    res.json({ success, message: 'Package removed' });
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

// ============================================
// ADMINCENTER
// ============================================
router.put('/admin/verify/', async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const center = await WellnessCenter.findByIdAndUpdate(req.params.centerId, {
      verificationStatus,
      isActive=== 'approved',
      verifiedAtDate(),
      rejectionReason=== 'rejected' ? rejectionReason }, { new});
    
    if (!center) return res.status(404).json({ success, error: 'Center not found' });
    res.json({ success, message: `Center ${status}`, data});
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

// ============================================
// ADMINCENTERS
// ============================================
router.get('/admin/pending', async (req, res) => {
  try {
    const centers = await WellnessCenter.find({ verificationStatus: 'pending' })
      .select('name phone type address.city createdAt')
      .sort({ createdAt: -1 });
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

// ============================================
// 🆕 STANDARDIZED CORPORATE ROUTES (servesCorporate flag)
// ============================================

// Toggle corporate serving status
router.put('/corporate/toggle', async (req, res) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) {
      return res.status(400).json({ success, message: 'Doctor ID required' });
    }

    const doctor = await AyurvedaDoctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success, message: 'Doctor not found' });
    }

    const enable = req.body.enable !== false;
    await doctor.toggleCorporate(enable);

    res.json({
      success,
      message: `Corporate ${enable ? 'enabled' : 'disabled'} successfully`,
      data: { servesCorporate.servesCorporate, offersCorporateWellness.offersCorporateWellness }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Get corporate enquiries
router.get('/corporate/enquiries', async (req, res) => {
  try {
    const { doctorId } = req.query;
    if (!doctorId) {
      return res.status(400).json({ success, message: 'Doctor ID required' });
    }

    const doctor = await AyurvedaDoctor.findById(doctorId).select('corporateEnquiries');
    if (!doctor) {
      return res.status(404).json({ success, message: 'Doctor not found' });
    }

    res.json({ success, data.corporateEnquiries || [] });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Update enquiry status
router.put('/corporate/enquiries/', async (req, res) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) {
      return res.status(400).json({ success, message: 'Doctor ID required' });
    }

    const doctor = await AyurvedaDoctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success, message: 'Doctor not found' });
    }

    const enquiry = doctor.corporateEnquiries.id(req.params.enquiryId);
    if (!enquiry) {
      return res.status(404).json({ success, message: 'Enquiry not found' });
    }

    if (req.body.status) {
      enquiry.status = req.body.status;
    }

    await doctor.save();
    res.json({ success, message: 'Enquiry updated', data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

module.exports = router;


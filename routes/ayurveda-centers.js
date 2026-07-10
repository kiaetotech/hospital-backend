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
// 🆕 STANDARDIZED CORPORATE ROUTES (servesCorporate flag)
// ============================================

// Toggle corporate serving status
router.put('/corporate/toggle', async (req, res) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) {
      return res.status(400).json({ success: false, message: 'Doctor ID required' });
    }

    const doctor = await AyurvedaDoctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const enable = req.body.enable !== false;
    await doctor.toggleCorporate(enable);

    res.json({
      success: true,
      message: `Corporate ${enable ? 'enabled' : 'disabled'} successfully`,
      data: { servesCorporate: doctor.servesCorporate, offersCorporateWellness: doctor.offersCorporateWellness }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get corporate enquiries
router.get('/corporate/enquiries', async (req, res) => {
  try {
    const { doctorId } = req.query;
    if (!doctorId) {
      return res.status(400).json({ success: false, message: 'Doctor ID required' });
    }

    const doctor = await AyurvedaDoctor.findById(doctorId).select('corporateEnquiries');
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    res.json({ success: true, data: doctor.corporateEnquiries || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update enquiry status
router.put('/corporate/enquiries/:enquiryId', async (req, res) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) {
      return res.status(400).json({ success: false, message: 'Doctor ID required' });
    }

    const doctor = await AyurvedaDoctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const enquiry = doctor.corporateEnquiries.id(req.params.enquiryId);
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    if (req.body.status) {
      enquiry.status = req.body.status;
    }

    await doctor.save();
    res.json({ success: true, message: 'Enquiry updated', data: enquiry });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
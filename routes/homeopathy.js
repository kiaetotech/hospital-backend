const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const HomeopathyDoctor = require('../models/HomeopathyDoctor');
const NaturopathyCenter = require('../models/NaturopathyCenter');
const Pharmacy = require('../models/Pharmacy');
const Booking = require('../models/Booking');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital_platform_secret_key_2024';

// ============================================
// DOCTOR ROUTES
// ============================================

// GET /api/homeopathy/doctors - Search doctors
router.get('/doctors', async (req, res) => {
  try {
    const { city, specialization, minRating, maxFee, mode } = req.query;
    const query = { isActive: true, verificationStatus: 'approved' };
    if (city) query['address.city'] = city;
    if (specialization) query.specialization = specialization;
    if (minRating) query.rating = { $gte: parseFloat(minRating) };
    if (maxFee) query.consultationFee = { $lte: parseInt(maxFee) };
    if (mode === 'online') query['consultationTypes.online'] = true;
    if (mode === 'clinic') query['consultationTypes.clinic'] = true;

    const doctors = await HomeopathyDoctor.find(query).select('-password').sort({ rating: -1 });
    res.json({ success: true, data: doctors, count: doctors.length });
  } catch (error) {
    res.json({ success: true, data: [], count: 0 });
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
    const { name, phone, email, password, specialization, experience, education, registrationNumber, registrationCouncil, consultationFee, city, state, clinicName, about, languages } = req.body;
    
    const existing = await HomeopathyDoctor.findOne({ $or: [{ phone }, { registrationNumber }] });
    if (existing) return res.status(400).json({ success: false, error: 'Phone or registration number already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const doctor = new HomeopathyDoctor({
      name, phone, email, password: hashedPassword, specialization,
      experience: parseInt(experience), education, registrationNumber, registrationCouncil,
      consultationFee: parseInt(consultationFee), clinicName, about,
      languages: languages || [],
      address: { city, state },
      verificationStatus: 'pending'
    });
    await doctor.save();
    res.status(201).json({ success: true, message: 'Registration submitted for verification', doctorId: doctor._id });
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
    res.json({ success: true, token, doctor: { id: doctor._id, name: doctor.name, specialization: doctor.specialization } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/homeopathy/doctor/dashboard/:id
router.get('/doctor/dashboard/:id', async (req, res) => {
  try {
    const doctor = await HomeopathyDoctor.findById(req.params.id).select('-password');
    const bookings = await Booking.find({ bookingType: 'homeopathy_consult', paymentStatus: 'paid' }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, doctor, bookings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CENTER ROUTES
// ============================================

// GET /api/homeopathy/centers
router.get('/centers', async (req, res) => {
  try {
    const centers = await NaturopathyCenter.find({ isActive: true, verificationStatus: 'approved' }).select('-password');
    res.json({ success: true, data: centers });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

// POST /api/homeopathy/center/register
router.post('/center/register', async (req, res) => {
  try {
    const { name, phone, email, password, type, description, city, state, facilities } = req.body;
    const existing = await NaturopathyCenter.findOne({ phone });
    if (existing) return res.status(400).json({ success: false, error: 'Phone already registered' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const center = new NaturopathyCenter({
      name, phone, email, password: hashedPassword, type, description,
      address: { city, state }, facilities: facilities || [], verificationStatus: 'pending'
    });
    await center.save();
    res.status(201).json({ success: true, message: 'Registration submitted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PHARMACY ROUTES
// ============================================

// POST /api/homeopathy/pharmacy/register
router.post('/pharmacy/register', async (req, res) => {
  try {
    const { businessName, phone, email, password, drugLicenseNumber, gstNumber, city, state, pincodesServed, ownerName } = req.body;
    const existing = await Pharmacy.findOne({ $or: [{ phone }, { drugLicenseNumber }] });
    if (existing) return res.status(400).json({ success: false, error: 'Phone or license already registered' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const pharmacy = new Pharmacy({
      businessName, phone, email, password: hashedPassword,
      drugLicenseNumber, gstNumber, ownerName,
      address: { city, state }, pincodesServed: pincodesServed || [],
      verificationStatus: 'pending'
    });
    await pharmacy.save();
    res.status(201).json({ success: true, message: 'Pharmacy registration submitted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/homeopathy/pharmacy/medicines
router.get('/pharmacy/medicines', async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({ isActive: true, verificationStatus: 'approved' }).select('businessName address medicines');
    let allMedicines = [];
    pharmacies.forEach(p => {
      p.medicines.forEach(m => {
        allMedicines.push({ ...m.toObject(), pharmacyName: p.businessName, pharmacyId: p._id });
      });
    });
    res.json({ success: true, data: allMedicines });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

// ============================================
// REVIEWS
// ============================================

// POST /api/homeopathy/review
router.post('/review', async (req, res) => {
  try {
    const { doctorId, bookingId, rating, review, patientName } = req.body;
    const doctor = await HomeopathyDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, error: 'Doctor not found' });
    doctor.reviews.push({ patient: bookingId, patientName, rating, review });
    const total = doctor.reviews.reduce((sum, r) => sum + r.rating, 0);
    doctor.rating = (total / doctor.reviews.length).toFixed(1);
    doctor.totalReviews = doctor.reviews.length;
    await doctor.save();
    res.json({ success: true, message: 'Review submitted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// GET /api/homeopathy/admin/pending-doctors
router.get('/admin/pending-doctors', async (req, res) => {
  try {
    const doctors = await HomeopathyDoctor.find({ verificationStatus: 'pending' }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: doctors });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/homeopathy/admin/verify-doctor/:id
router.put('/admin/verify-doctor/:id', async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const doctor = await HomeopathyDoctor.findByIdAndUpdate(req.params.id, {
      verificationStatus: status,
      isActive: status === 'approved',
      verifiedAt: new Date(),
      rejectionReason: status === 'rejected' ? rejectionReason : null
    }, { new: true });
    res.json({ success: true, message: `Doctor ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/homeopathy/admin/pending-centers
router.get('/admin/pending-centers', async (req, res) => {
  try {
    const centers = await NaturopathyCenter.find({ verificationStatus: 'pending' }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: centers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/homeopathy/admin/verify-center/:id
router.put('/admin/verify-center/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await NaturopathyCenter.findByIdAndUpdate(req.params.id, { verificationStatus: status, isActive: status === 'approved', verifiedAt: new Date() });
    res.json({ success: true, message: `Center ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/homeopathy/admin/pending-pharmacies
router.get('/admin/pending-pharmacies', async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({ verificationStatus: 'pending' }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: pharmacies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/homeopathy/admin/verify-pharmacy/:id
router.put('/admin/verify-pharmacy/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await Pharmacy.findByIdAndUpdate(req.params.id, { verificationStatus: status, isActive: status === 'approved', verifiedAt: new Date() });
    res.json({ success: true, message: `Pharmacy ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/homeopathy/admin/bulk-upload - Excel upload
router.post('/admin/bulk-upload', async (req, res) => {
  try {
    const { type, data } = req.body;
    if (type === 'doctors') {
      for (const item of data) {
        const hashedPassword = await bcrypt.hash(item.phone || '123456', 10);
        await HomeopathyDoctor.findOneAndUpdate(
          { registrationNumber: item.registrationNumber },
          { ...item, password: hashedPassword, verificationStatus: 'approved', isActive: true },
          { upsert: true, new: true }
        );
      }
    } else if (type === 'medicines') {
      for (const item of data) {
        await Pharmacy.findOneAndUpdate(
          { drugLicenseNumber: item.drugLicenseNumber },
          { $push: { medicines: item } },
          { upsert: true }
        );
      }
    }
    res.json({ success: true, message: `${data.length} records uploaded` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
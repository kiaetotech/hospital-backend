const express = require('express');
const router = express.Router();
const Caregiver = require('../models/Caregiver');
const CaregiverBooking = require('../models/CaregiverBooking');
const auth = require('../middleware/auth');

// GET /api/caregivers - Get all caregivers (public)
router.get('/', async (req, res) => {
  try {
    const { serviceType, gender, minExperience, minRating, maxHourlyRate, city } = req.query;
    let query = { isActive: true, backgroundCheckStatus: 'cleared' };
    
    if (serviceType && serviceType !== '') query.serviceType = { $in: [serviceType, 'both'] };
    if (gender && gender !== 'any') query.gender = gender;
    if (minExperience) query.experienceYears = { $gte: parseInt(minExperience) };
    if (minRating) query['ratings.average'] = { $gte: parseFloat(minRating) };
    if (city) query['location.city'] = { $regex: new RegExp(city, 'i') };
    
    let caregivers = await Caregiver.find(query).sort({ 'ratings.average': -1 });
    
    if (maxHourlyRate) {
      caregivers = caregivers.filter(c => {
        const rate = c.pricing?.personal?.hourly || c.pricing?.skilled?.hourly || 0;
        return rate <= parseInt(maxHourlyRate);
      });
    }
    
    res.json({ success: true, data: caregivers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/caregivers/:id - Get single caregiver
router.get('/:id', async (req, res) => {
  try {
    const caregiver = await Caregiver.findById(req.params.id);
    if (!caregiver) return res.status(404).json({ success: false, message: 'Caregiver not found' });
    res.json({ success: true, data: caregiver });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/caregivers/profile - Create/Update caregiver profile (authenticated)
router.post('/profile', auth, async (req, res) => {
  try {
    if (req.user.role !== 'caregiver') {
      return res.status(403).json({ success: false, message: 'Only caregivers can create profile' });
    }
    
    let caregiver = await Caregiver.findOne({ userId: req.user.id });
    
    if (caregiver) {
      caregiver = await Caregiver.findOneAndUpdate(
        { userId: req.user.id },
        { ...req.body, updatedAt: Date.now() },
        { new: true }
      );
    } else {
      caregiver = new Caregiver({ ...req.body, userId: req.user.id });
      await caregiver.save();
    }
    
    res.json({ success: true, data: caregiver });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/caregivers/profile/me - Get my caregiver profile
router.get('/profile/me', auth, async (req, res) => {
  try {
    const caregiver = await Caregiver.findOne({ userId: req.user.id });
    if (!caregiver) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: caregiver });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/caregivers/book - Create booking
router.post('/book', auth, async (req, res) => {
  try {
    const booking = new CaregiverBooking({
      ...req.body,
      patientId: req.user.id,
      status: 'pending',
      paymentStatus: 'pending'
    });
    await booking.save();
    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/caregivers/my-bookings - Get patient bookings
router.get('/my-bookings', auth, async (req, res) => {
  try {
    const bookings = await CaregiverBooking.find({ patientId: req.user.id })
      .populate('caregiverId', 'fullName photo ratings')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/caregivers/checkin/:bookingId - Check-in
router.post('/checkin/:bookingId', auth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const booking = await CaregiverBooking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ success: false });
    
    booking.checkIn = { timestamp: new Date(), location: { lat, lng } };
    booking.status = 'in_progress';
    await booking.save();
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/caregivers/checkout/:bookingId - Check-out
router.post('/checkout/:bookingId', auth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const booking = await CaregiverBooking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ success: false });
    
    booking.checkOut = { timestamp: new Date(), location: { lat, lng } };
    booking.status = 'completed';
    await booking.save();
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/caregivers/rate/:bookingId - Add rating
router.post('/rate/:bookingId', auth, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const booking = await CaregiverBooking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ success: false });
    
    booking.rating = rating;
    booking.review = review;
    await booking.save();
    
    const caregiver = await Caregiver.findById(booking.caregiverId);
    const allRatings = await CaregiverBooking.find({ caregiverId: booking.caregiverId, rating: { $ne: null } });
    const avgRating = allRatings.reduce((sum, b) => sum + b.rating, 0) / allRatings.length;
    caregiver.ratings.average = avgRating;
    caregiver.ratings.count = allRatings.length;
    await caregiver.save();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
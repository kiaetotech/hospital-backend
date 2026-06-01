const express = require('express');
const router = express.Router();
const Caregiver = require('../models/Caregiver');
const CaregiverBooking = require('../models/CaregiverBooking');
const ServiceLog = require('../models/ServiceLog');
const auth = require('../middleware/auth');

// Get all caregivers (public)
router.get('/', async (req, res) => {
  try {
    const { lat, lng, radius, serviceType, gender, minExperience, minRating, maxHourlyRate, specializations } = req.query;
    let query = { isActive: true, backgroundCheckStatus: 'cleared' };
    
    if (serviceType) query.serviceType = { $in: [serviceType, 'both'] };
    if (gender && gender !== 'any') query.gender = gender;
    if (minExperience) query.experienceYears = { $gte: parseInt(minExperience) };
    if (minRating) query['ratings.average'] = { $gte: parseFloat(minRating) };
    if (specializations) query.specializations = { $in: specializations.split(',') };
    
    let caregivers = await Caregiver.find(query);
    
    if (maxHourlyRate) {
      caregivers = caregivers.filter(c => (c.pricing.personal?.hourly || c.pricing.skilled?.hourly) <= parseInt(maxHourlyRate));
    }
    
    res.json({ success: true, data: caregivers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single caregiver
router.get('/:id', async (req, res) => {
  try {
    const caregiver = await Caregiver.findById(req.params.id);
    if (!caregiver) return res.status(404).json({ success: false });
    res.json({ success: true, data: caregiver });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create booking (authenticated)
router.post('/book', auth, async (req, res) => {
  try {
    const booking = new CaregiverBooking({ ...req.body, patientId: req.user.id });
    await booking.save();
    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Check-in (authenticated caregiver)
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

// Check-out (authenticated caregiver)
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

// Add service log (authenticated caregiver)
router.post('/log/:bookingId', auth, async (req, res) => {
  try {
    const log = new ServiceLog({ ...req.body, bookingId: req.params.bookingId });
    await log.save();
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add rating (authenticated patient)
router.post('/rate/:bookingId', auth, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const booking = await CaregiverBooking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ success: false });
    
    booking.rating = rating;
    booking.review = review;
    await booking.save();
    
    // Update caregiver average rating
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
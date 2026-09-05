const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const router = express.Router();
const Caregiver = require('../models/Caregiver');
const CaregiverBooking = require('../models/CaregiverBooking');
const Patient = require('../models/Patient');

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ success: false, message: 'JWT_SECRET is not configured' });
  try { req.user = jwt.verify(token, secret); next(); }
  catch { return res.status(401).json({ success: false, message: 'Invalid or expired token.' }); }
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const parseTime = (value) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return null;
  const [h,m] = value.split(':').map(Number); return h * 60 + m;
};
const calculateServiceAmount = (caregiver, serviceType, durationType, duration) => {
  const rate = caregiver.pricing?.[serviceType]?.hourly;
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Caregiver pricing is not configured for this service');
  const multiplier = { hourly: duration, daily: duration * 8, weekly: duration * 40, monthly: duration * 160, yearly: duration * 1920 }[durationType];
  if (!multiplier) throw new Error('Invalid duration type');
  return Math.round(rate * multiplier);
};

router.get('/', async (req, res) => {
  try {
    const { serviceType, gender, minExperience, minRating, maxHourlyRate, city, page = 1, limit = 20 } = req.query;
    const query = { isActive: true, backgroundCheckStatus: 'cleared' };
    if (serviceType) query.serviceType = { $in: [serviceType, 'both'] };
    if (gender && gender !== 'any') query.gender = gender;
    if (minExperience) query.experienceYears = { $gte: Number(minExperience) };
    if (minRating) query['ratings.average'] = { $gte: Number(minRating) };
    if (city) query['location.city'] = { $regex: new RegExp(String(city).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') };
    const pageNum = Math.max(1, Number(page)); const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const [data, total] = await Promise.all([
      Caregiver.find(query).sort({ 'ratings.average': -1 }).skip((pageNum-1)*limitNum).limit(limitNum).lean(),
      Caregiver.countDocuments(query)
    ]);
    const filtered = maxHourlyRate ? data.filter(c => (c.pricing?.personal?.hourly || c.pricing?.skilled?.hourly || 0) <= Number(maxHourlyRate)) : data;
    res.json({ success: true, data: filtered, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total/limitNum) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/profile/me', auth, async (req, res) => {
  try {
    const caregiver = await Caregiver.findOne({ userId: req.user.id || req.user._id }).lean();
    if (!caregiver) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: caregiver });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/my-bookings', auth, async (req, res) => {
  try {
    const patient = await Patient.findOne({ userId: req.user.id || req.user._id }).select('_id');
    if (!patient) return res.status(404).json({ success: false, message: 'Patient profile not found' });
    const bookings = await CaregiverBooking.find({ patientId: patient._id }).populate('caregiverId','fullName photo ratings').sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid caregiver ID' });
    const caregiver = await Caregiver.findById(req.params.id).lean();
    if (!caregiver) return res.status(404).json({ success: false, message: 'Caregiver not found' });
    res.json({ success: true, data: caregiver });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/profile', auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const allowed = { ...req.body }; delete allowed.userId; delete allowed.isVerified; delete allowed.backgroundCheckStatus; delete allowed.isActive;
    const caregiver = await Caregiver.findOneAndUpdate({ userId }, { $set: allowed, $setOnInsert: { userId } }, { new: true, upsert: true, runValidators: true });
    res.json({ success: true, data: caregiver });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});



router.post('/book', auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    if (!isValidObjectId(userId)) return res.status(401).json({ success: false, message: 'Invalid authenticated user' });
    const patient = await Patient.findOne({ userId });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient profile not found' });
    const { caregiverId, serviceType, durationType='hourly', duration, startDate, startTime='09:00', endTime } = req.body;
    if (!isValidObjectId(caregiverId)) return res.status(400).json({ success: false, message: 'Invalid caregiver ID' });
    if (!['personal','skilled'].includes(serviceType)) return res.status(400).json({ success: false, message: 'Invalid service type' });
    const durationNum = Number(duration); if (!Number.isFinite(durationNum) || durationNum < 1) return res.status(400).json({ success: false, message: 'Invalid duration' });
    const date = new Date(startDate); if (Number.isNaN(date.getTime())) return res.status(400).json({ success: false, message: 'Invalid start date' });
    if (!parseTime(startTime)) return res.status(400).json({ success: false, message: 'Invalid start time' });
    const caregiver = await Caregiver.findOne({ _id: caregiverId, isActive: true, backgroundCheckStatus: 'cleared' });
    if (!caregiver) return res.status(404).json({ success: false, message: 'Caregiver is not currently available for booking' });
    if (caregiver.serviceType !== 'both' && caregiver.serviceType !== serviceType) return res.status(400).json({ success: false, message: 'Caregiver does not offer this service' });
    const totalService = calculateServiceAmount(caregiver, serviceType, durationType, durationNum);
    const platformFee = Math.min(Math.round(totalService * 0.05), 500);
    const gstAmount = Math.round(platformFee * 0.18);
    const totalAmount = totalService + platformFee + gstAmount;
    const caregiverEarnings = totalService;
    const startMinutes = parseTime(startTime);
    const endMinutes = endTime ? parseTime(endTime) : (durationType === 'hourly' ? startMinutes + durationNum*60 : startMinutes + 8*60);
    if (endMinutes === null || endMinutes <= startMinutes || endMinutes > 24*60) return res.status(400).json({ success: false, message: 'Invalid time window' });
    const normalizedEnd = `${String(Math.floor(endMinutes/60)%24).padStart(2,'0')}:${String(endMinutes%60).padStart(2,'0')}`;
    const conflict = await CaregiverBooking.exists({ caregiverId, date: { $gte: new Date(date.setHours(0,0,0,0)), $lt: new Date(new Date(date).setHours(23,59,59,999)) }, status: { $in: ['pending','confirmed','in_progress'] }, startTime: { $lt: normalizedEnd }, endTime: { $gt: startTime } });
    if (conflict) return res.status(409).json({ success: false, message: 'Caregiver is already booked for the selected time' });
    const booking = await CaregiverBooking.create({
      patientId: patient._id, caregiverId, serviceType, durationType, duration: durationNum, date: new Date(startDate), startTime, endTime: normalizedEnd,
      totalAmount, platformFee, gstAmount, caregiverEarnings, status: 'pending', paymentStatus: 'pending',
      patientName: req.body.patientName || patient.fullName, patientPhone: req.body.patientPhone || patient.phone,
      serviceAddress: req.body.serviceAddress || patient.serviceAddress?.address, requirements: req.body.requirements,
      recurringWeekly: !!req.body.recurringWeekly, recurringDays: req.body.recurringDays || []
    });
    res.status(201).json({ success: true, data: booking });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});



const loadBookingForActor = async (bookingId, userId) => {
  if (!isValidObjectId(bookingId) || !isValidObjectId(userId)) return null;
  const [patient, caregiver] = await Promise.all([
    Patient.findOne({ userId }).select('_id'),
    Caregiver.findOne({ userId }).select('_id')
  ]);
  const clauses = [];
  if (patient) clauses.push({ patientId: patient._id });
  if (caregiver) clauses.push({ caregiverId: caregiver._id });
  if (!clauses.length) return null;
  return CaregiverBooking.findOne({ _id: bookingId, $or: clauses });
};

router.post('/checkin/:bookingId', auth, async (req, res) => {
  try {
    const booking = await loadBookingForActor(req.params.bookingId, req.user.id || req.user._id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status !== 'confirmed') return res.status(409).json({ success: false, message: 'Booking must be confirmed before check-in' });
    const { lat, lng } = req.body; booking.checkIn = { timestamp: new Date(), location: { lat, lng } }; booking.status='in_progress'; booking.updatedAt=new Date(); await booking.save();
    res.json({ success: true, data: booking });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/checkout/:bookingId', auth, async (req, res) => {
  try {
    const booking = await loadBookingForActor(req.params.bookingId, req.user.id || req.user._id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status !== 'in_progress') return res.status(409).json({ success: false, message: 'Booking must be in progress before check-out' });
    const { lat, lng } = req.body; booking.checkOut = { timestamp: new Date(), location: { lat, lng } }; booking.status='completed'; booking.paymentStatus = booking.paymentStatus === 'captured' ? 'released' : booking.paymentStatus; booking.updatedAt=new Date(); await booking.save();
    res.json({ success: true, data: booking });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/rate/:bookingId', auth, async (req, res) => {
  try {
    const patient = await Patient.findOne({ userId: req.user.id || req.user._id }).select('_id');
    if (!patient) return res.status(403).json({ success: false, message: 'Patient access required' });
    const booking = await CaregiverBooking.findOne({ _id: req.params.bookingId, patientId: patient._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status !== 'completed') return res.status(409).json({ success: false, message: 'Only completed bookings can be reviewed' });
    if (booking.reviewedAt || booking.rating != null) return res.status(409).json({ success: false, message: 'Booking has already been reviewed' });
    const rating = Number(req.body.rating); if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Rating must be an integer from 1 to 5' });
    booking.rating=rating; booking.review=String(req.body.review || '').trim(); booking.reviewedAt=new Date(); await booking.save();
    const caregiver = await Caregiver.findById(booking.caregiverId); if (caregiver) { const agg=await CaregiverBooking.aggregate([{ $match:{ caregiverId:booking.caregiverId, rating:{ $gte:1,$lte:5 } } },{ $group:{ _id:null, average:{ $avg:'$rating' }, count:{ $sum:1 } } }]); caregiver.ratings=caregiver.ratings||{}; caregiver.ratings.average=Number((agg[0]?.average||0).toFixed(2)); caregiver.ratings.count=agg[0]?.count||0; await caregiver.save(); }
    res.json({ success: true, data: booking });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;

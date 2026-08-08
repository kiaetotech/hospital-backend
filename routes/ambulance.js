// D:\hospital backend\routes\ambulance.js

const AmbulanceFleet = require('../models/AmbulanceFleet');
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const EmergencyContact = require('../models/EmergencyContact');
const { authenticateToken } = require('../middleware/auth');
const dispatchService = require('../services/ambulanceDispatchService');
const locationCache = require('../services/locationCacheService');
const commissionService = require('../services/commissionService');
const notificationService = require('../services/notificationService');
const smsService = require('../services/smsService');

// ============================================
// 🚨 EMERGENCY DISPATCH ENDPOINTS
// ============================================

// ─────────────────────────────────────────────
// POST /ambulance/emergency-dispatch
// 🚑 Emergency button pressed by patient
// ─────────────────────────────────────────────
router.post('/emergency-dispatch', async (req, res) => {
  try {
    const {
      userId, patientName, patientPhone, patientAge, patientGender,
      pickupLat, pickupLng, pickupAddress, patientCondition, emergencyType = 'blitz'
    } = req.body;

    if (!patientPhone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    if (!pickupLat || !pickupLng) {
      return res.status(400).json({ success: false, error: 'Location is required' });
    }

    const result = await dispatchService.dispatchEmergencyAmbulance({
      userId: userId || 'guest',
      patientName: patientName || 'Emergency Patient',
      patientPhone, patientAge, patientGender,
      pickupLat, pickupLng,
      pickupAddress: pickupAddress || 'GPS Location',
      patientCondition, emergencyType
    });

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Ambulance dispatched successfully',
        data: {
          bookingId: result.booking.bookingId,
          driver: {
            name: result.driver.driverName,
            phone: result.driver.driverPhone,
            vehicleNumber: result.driver.vehicleNumber,
            rating: result.driver.driverRating
          },
          trackingUrl: result.trackingUrl,
          tripOtp: result.booking.tripOtp,
          fareEstimate: result.fareEstimate
        }
      });
    } else {
      return res.status(200).json({
        success: false,
        reason: result.reason,
        message: 'No ambulance available. Please call 108.',
        bookingId: result.booking?.bookingId
      });
    }
  } catch (error) {
    console.error('Emergency dispatch error:', error);
    return res.status(500).json({ 
      success: false, error: 'Emergency dispatch failed',
      message: 'Please call 108 for immediate assistance'
    });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/accept-emergency/:bookingId
// 🚑 Driver accepts emergency request
// ─────────────────────────────────────────────
router.post('/accept-emergency/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const driverId = req.body.driverId || req.user.driverId;
    if (!driverId) return res.status(400).json({ success: false, error: 'Driver ID required' });

    const result = await dispatchService.driverAcceptEmergency(driverId, bookingId);
    if (result.success) {
      return res.json({ success: true, message: 'Emergency accepted', data: result.booking });
    }
    return res.json({ success: false, reason: result.reason });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/trip-start/:bookingId
// 🚑 Driver reached pickup location
// ─────────────────────────────────────────────
router.post('/trip-start/:bookingId', authenticateToken, async (req, res) => {
  try {
    const result = await dispatchService.driverArrivedAtPickup(req.params.bookingId);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/patient-onboard/:bookingId
// 🚑 Patient onboard with OTP verification
// ─────────────────────────────────────────────
router.post('/patient-onboard/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, error: 'OTP required' });
    const result = await dispatchService.patientOnboard(req.params.bookingId, otp);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/arrived-hospital/:bookingId
// 🚑 Arrived at hospital
// ─────────────────────────────────────────────
router.post('/arrived-hospital/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { vitals } = req.body;
    const result = await dispatchService.arrivedAtHospital(req.params.bookingId, vitals);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/trip-complete/:bookingId
// 🚑 Trip completed with trip sheet
// ─────────────────────────────────────────────
router.post('/trip-complete/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { distance, duration, oxygenAdministered, medicationsGiven, vitals, notes } = req.body;
    const result = await dispatchService.completeEmergencyTrip(req.params.bookingId, {
      distance, duration, oxygenAdministered, medicationsGiven, vitals, driverNotes: notes
    });
    if (result.success) {
      return res.json({ success: true, message: 'Trip completed', data: result });
    }
    return res.json({ success: false, reason: result.reason });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/cancel-emergency/:bookingId
// 🚑 Cancel emergency
// ─────────────────────────────────────────────
router.post('/cancel-emergency/:bookingId', async (req, res) => {
  try {
    const { reason, cancelledBy = 'patient' } = req.body;
    const result = await dispatchService.cancelEmergency(req.params.bookingId, reason, cancelledBy);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/send-sos-sms
// 🚑 Send SOS to emergency contacts
// ─────────────────────────────────────────────
router.post('/send-sos-sms', async (req, res) => {
  try {
    const { bookingId, contacts } = req.body;
    const booking = await Booking.findOne({ bookingId });
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const emergencyData = {
      patientName: booking.patientName,
      ambulanceType: booking.vehicleType || 'Emergency',
      vehicleNumber: booking.vehicleNumber,
      driverName: booking.driverName,
      driverPhone: booking.driverPhone,
      eta: '5',
      trackingUrl: booking.trackingUrl,
      hospitalName: booking.hospitalDestination?.hospitalName || 'Nearest hospital'
    };

    await smsService.sendEmergencyContactsSMS(contacts, emergencyData);
    return res.json({ success: true, message: 'SOS messages sent' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/notify-hospital
// 🚑 Notify hospital ER
// ─────────────────────────────────────────────
router.post('/notify-hospital', async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findOne({ bookingId });
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    await notificationService.sendHospitalERNotification(null, null, {
      bookingId: booking.bookingId,
      patientName: booking.patientName,
      patientAge: booking.patientAge,
      patientGender: booking.patientGender,
      chiefComplaint: booking.patientCondition?.chiefComplaint || 'Emergency',
      ambulanceType: booking.vehicleType,
      vehicleNumber: booking.vehicleNumber,
      eta: '5',
      driverPhone: booking.driverPhone
    });

    booking.hospitalNotified = true;
    booking.hospitalNotificationTime = new Date();
    await booking.save();

    return res.json({ success: true, message: 'Hospital notified' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 📍 LOCATION & TRACKING ENDPOINTS
// ============================================

// ─────────────────────────────────────────────
// POST /ambulance/update-location
// 📍 Driver GPS update
// ─────────────────────────────────────────────
router.post('/update-location', authenticateToken, async (req, res) => {
  try {
    const { lat, lng, speed, heading, isAvailable, isOnTrip, tripId } = req.body;
    const driverId = req.body.driverId || req.user.driverId;
    if (!lat || !lng) return res.status(400).json({ success: false, error: 'Coordinates required' });

    await locationCache.ambulance.updateDriverLocation(driverId, lat, lng, {
      speed, heading, isAvailable: isAvailable !== false,
      isOnTrip: isOnTrip || false, tripId: tripId || '',
      vehicleType: req.body.vehicleType || 'basic',
      providerId: req.body.providerId || ''
    });
    return res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /ambulance/nearby-ambulances
// 📍 Find nearby available ambulances
// ─────────────────────────────────────────────
router.get('/nearby-ambulances', async (req, res) => {
  try {
    const { lat, lng, radius = 5, vehicleType, limit = 10 } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, error: 'Coordinates required' });

    const drivers = await locationCache.ambulance.findNearbyDrivers(
      parseFloat(lat), parseFloat(lng), parseFloat(radius), {
        vehicleType: vehicleType || null,
        limit: parseInt(limit),
        requireAvailable: true
      }
    );

    return res.json({
      success: true, count: drivers.length,
      data: drivers.map(d => ({
        driverId: d.driverId, distance: d.distance,
        vehicleType: d.vehicleType, rating: d.rating || 0,
        estimatedETA: Math.round(d.distance * 2)
      }))
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /ambulance/active-emergency/:bookingId
// 📍 Live tracking for active emergency
// ─────────────────────────────────────────────
router.get('/active-emergency/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId });
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    let driverLocation = null;
    if (booking.driverId) {
      driverLocation = await locationCache.ambulance.getDriverLocation(booking.driverId);
    }

    return res.json({
      success: true,
      data: {
        bookingId: booking.bookingId,
        status: booking.status,
        driver: {
          name: booking.driverName, phone: booking.driverPhone,
          vehicleNumber: booking.vehicleNumber, rating: booking.driverRating,
          location: driverLocation ? { lat: driverLocation.lat, lng: driverLocation.lng } : null
        },
        hospital: booking.hospitalDestination,
        timestamps: {
          requested: booking.emergencyRequestedAt, accepted: booking.driverAcceptedAt,
          arrived: booking.driverReachedAt, onboard: booking.patientOnboardAt,
          completed: booking.completedAt
        },
        trackingUrl: booking.trackingUrl
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /ambulance/surge-check
// 📍 Check surge pricing in area
// ─────────────────────────────────────────────
router.get('/surge-check', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, error: 'Coordinates required' });

    const surgeInfo = await dispatchService.checkSurgePricing(parseFloat(lat), parseFloat(lng));
    return res.json({ success: true, data: surgeInfo });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 📅 SCHEDULED AMBULANCE ENDPOINTS
// ============================================

// ─────────────────────────────────────────────
// POST /ambulance/schedule-transport
// 📅 Book non-emergency ambulance
// ─────────────────────────────────────────────
router.post('/schedule-transport', authenticateToken, async (req, res) => {
  try {
    const {
      patientName, patientPhone, patientAge, patientGender,
      pickupAddress, pickupLat, pickupLng,
      destinationAddress, destinationLat, destinationLng,
      hospitalName, ambulanceType = 'basic',
      scheduledDate, scheduledTime,
      requiresOxygen, requiresAttendant, mobilityType,
      specialRequirements, isRecurring, recurringDays
    } = req.body;

    const fareEstimate = commissionService.calculateAmbulanceFare({
      baseFare: 500,
      distance: 10,
      ambulanceType,
      isEmergency: false,
      oxygenRequired: requiresOxygen
    });

    const booking = new Booking({
      userId: req.user.userId || req.user.id,
      bookingType: 'ambulance',
      emergencyType: 'scheduled',
      patientName, patientPhone, patientAge, patientGender,
      ambulanceType,
      pickupAddress,
      pickupCoordinates: { lat: pickupLat, lng: pickupLng },
      dropAddress: destinationAddress,
      hospitalDestination: {
        hospitalName: hospitalName || destinationAddress,
        address: destinationAddress,
        coordinates: { lat: destinationLat, lng: destinationLng }
      },
      appointmentDate: new Date(`${scheduledDate}T${scheduledTime || '10:00'}`),
      originalAmount: fareEstimate.breakdown.total,
      finalAmount: fareEstimate.breakdown.total,
      fareBreakdown: fareEstimate.breakdown,
      scheduledTransport: {
        isRecurring: isRecurring || false,
        recurringDays: recurringDays || [],
        requiresOxygen: requiresOxygen || false,
        requiresAttendant: requiresAttendant || false,
        mobilityType: mobilityType || 'walking',
        specialEquipment: []
      },
      specialRequirements,
      status: 'pending'
    });

    await booking.save();

    await smsService.sendAmbulanceSMS(patientPhone, 'scheduled_confirmed', {
      date: new Date(scheduledDate).toLocaleDateString('en-IN'),
      time: scheduledTime || 'Scheduled',
      pickupAddress,
      hospitalName: hospitalName || destinationAddress,
      vehicleType: ambulanceType,
      bookingId: booking.bookingId
    });

    return res.json({
      success: true,
      message: 'Ambulance scheduled successfully',
      data: {
        bookingId: booking.bookingId,
        scheduledDate, scheduledTime,
        fareEstimate: fareEstimate.breakdown
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /ambulance/scheduled-bookings
// 📅 Get user's scheduled ambulance bookings
// ─────────────────────────────────────────────
router.get('/scheduled-bookings', authenticateToken, async (req, res) => {
  try {
    const bookings = await Booking.find({
      userId: req.user.userId || req.user.id,
      bookingType: 'ambulance',
      emergencyType: 'scheduled',
      status: { $in: ['pending', 'confirmed', 'completed'] }
    }).sort({ appointmentDate: -1 });

    return res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 📊 BOOKING HISTORY & DETAILS
// ============================================

// ─────────────────────────────────────────────
// GET /ambulance/my-bookings
// 📊 Get all ambulance bookings for user
// ─────────────────────────────────────────────
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    const { type, limit = 20, page = 1 } = req.query;
    const query = {
      userId: req.user.userId || req.user.id,
      bookingType: { $in: ['ambulance', 'ambulance_emergency'] }
    };
    
    if (type === 'emergency') query.emergencyType = 'blitz';
    else if (type === 'scheduled') query.emergencyType = 'scheduled';

    const bookings = await Booking.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    return res.json({
      success: true,
      data: bookings,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /ambulance/booking/:bookingId
// 📊 Get single booking details
// ─────────────────────────────────────────────
router.get('/booking/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId });
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
    return res.json({ success: true, data: booking });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /ambulance/trip-sheet/:bookingId
// 📊 Get digital trip sheet for insurance
// ─────────────────────────────────────────────
router.get('/trip-sheet/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId });
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
    if (!booking.digitalTripSheet?.generated) {
      return res.status(400).json({ success: false, error: 'Trip sheet not yet generated' });
    }

    return res.json({
      success: true,
      data: {
        tripSheetId: booking.digitalTripSheet.tripSheetId,
        bookingId: booking.bookingId,
        patientName: booking.patientName,
        driverName: booking.driverName,
        vehicleNumber: booking.vehicleNumber,
        ambulanceType: booking.vehicleType,
        pickupAddress: booking.pickupAddress,
        hospitalDestination: booking.hospitalDestination?.hospitalName,
        pickupTime: booking.digitalTripSheet.pickupTime || booking.driverAcceptedAt,
        dropTime: booking.digitalTripSheet.dropTime || booking.completedAt,
        distance: booking.digitalTripSheet.distance,
        duration: booking.digitalTripSheet.duration,
        vitals: booking.digitalTripSheet.vitals,
        oxygenAdministered: booking.digitalTripSheet.oxygenAdministered,
        medicationsGiven: booking.digitalTripSheet.medicationsGiven,
        fareBreakdown: booking.fareBreakdown,
        generatedAt: booking.digitalTripSheet.generatedAt,
        insuranceReady: true
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 👨‍⚕️ DRIVER ENDPOINTS
// ============================================

// ─────────────────────────────────────────────
// GET /ambulance/driver/dashboard
// 👨‍⚕️ Driver dashboard with stats
// ─────────────────────────────────────────────
router.get('/driver/dashboard', authenticateToken, async (req, res) => {
  try {
    const driverId = req.query.driverId || req.user.driverId;
    if (!driverId) return res.status(400).json({ success: false, error: 'Driver ID required' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayTrips, totalTrips, recentTrips, driverLocation] = await Promise.all([
      Booking.countDocuments({ driverId, bookingType: 'ambulance_emergency', createdAt: { $gte: today, $lt: tomorrow }, status: 'completed' }),
      Booking.countDocuments({ driverId, status: 'completed' }),
      Booking.find({ driverId, status: 'completed' }).sort({ completedAt: -1 }).limit(5),
      locationCache.ambulance.getDriverLocation(driverId)
    ]);

    const todayEarnings = await Transaction.aggregate([
      { $match: { ambulanceDriverId: driverId, createdAt: { $gte: today, $lt: tomorrow }, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$ambulanceCommission.driverEarnings' } } }
    ]);

    return res.json({
      success: true,
      data: {
        todayTrips,
        todayEarnings: todayEarnings[0]?.total || 0,
        totalTrips,
        recentTrips,
        currentLocation: driverLocation,
        rating: req.user.driverRating || 0
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/driver/toggle-availability
// 👨‍⚕️ Toggle driver online/offline
// ─────────────────────────────────────────────
router.post('/driver/toggle-availability', authenticateToken, async (req, res) => {
  try {
    const driverId = req.body.driverId || req.user.driverId;
    const { isAvailable } = req.body;

    await locationCache.ambulance.updateDriverStatus(driverId, { isAvailable });

    return res.json({ success: true, isAvailable });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /ambulance/driver/trip-history
// 👨‍⚕️ Driver trip history
// ─────────────────────────────────────────────
router.get('/driver/trip-history', authenticateToken, async (req, res) => {
  try {
    const driverId = req.query.driverId || req.user.driverId;
    const { limit = 20, page = 1 } = req.query;

    const trips = await Booking.find({ driverId, status: 'completed' })
      .sort({ completedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments({ driverId, status: 'completed' });

    return res.json({
      success: true,
      data: trips,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 💰 FARE & COMMISSION ENDPOINTS
// ============================================

// ─────────────────────────────────────────────
// GET /ambulance/fare-estimate
// 💰 Get fare estimate before booking
// ─────────────────────────────────────────────
router.get('/fare-estimate', async (req, res) => {
  try {
    const { distance, ambulanceType = 'basic', isEmergency = 'false', isNightTime = 'false' } = req.query;

    const fareEstimate = commissionService.calculateAmbulanceFare({
      baseFare: 500,
      distance: parseFloat(distance) || 5,
      ambulanceType,
      isEmergency: isEmergency === 'true',
      isNightTime: isNightTime === 'true'
    });

    return res.json({
      success: true,
      data: {
        fareBreakdown: fareEstimate.breakdown,
        total: fareEstimate.breakdown.total,
        platformFee: isEmergency === 'true' ? 0 : 50
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 🛡️ EMERGENCY CONTACTS ENDPOINTS
// ============================================

// ─────────────────────────────────────────────
// GET /ambulance/emergency-contacts
// 🛡️ Get user's emergency contacts
// ─────────────────────────────────────────────
router.get('/emergency-contacts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const emergencyProfile = await EmergencyContact.findByUserId(userId);
    
    if (!emergencyProfile) {
      return res.json({ success: true, data: { contacts: [], medicalInfo: null } });
    }

    return res.json({
      success: true,
      data: {
        contacts: emergencyProfile.contacts,
        medicalInfo: emergencyProfile.medicalInfo,
        insuranceInfo: emergencyProfile.insuranceInfo,
        ambulancePreferences: emergencyProfile.ambulancePreferences
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/emergency-contacts
// 🛡️ Update emergency contacts
// ─────────────────────────────────────────────
router.post('/emergency-contacts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { contacts, medicalInfo, insuranceInfo, ambulancePreferences } = req.body;

    let emergencyProfile = await EmergencyContact.findByUserId(userId);
    
    if (!emergencyProfile) {
      emergencyProfile = new EmergencyContact({ userId, contacts, medicalInfo, insuranceInfo, ambulancePreferences });
    } else {
      if (contacts) emergencyProfile.contacts = contacts;
      if (medicalInfo) emergencyProfile.medicalInfo = { ...emergencyProfile.medicalInfo, ...medicalInfo };
      if (insuranceInfo) emergencyProfile.insuranceInfo = insuranceInfo;
      if (ambulancePreferences) emergencyProfile.ambulancePreferences = ambulancePreferences;
    }

    await emergencyProfile.save();
    return res.json({ success: true, message: 'Emergency contacts updated' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 🏢 CORPORATE HEALTH ROUTES (AmbulanceFleet)
// ============================================

async function getFleet(userId, userName) {
  let fleet = await AmbulanceFleet.findOne({ ownerType: 'ambulance_provider', ownerId: userId });
  if (!fleet) {
    const user = await User.findById(userId);
    fleet = new AmbulanceFleet({ 
      ownerType: 'ambulance_provider', ownerId: userId, 
      providerName: userName || user?.name || 'Provider',
      contactPhone: user?.phone || '', contactEmail: user?.email || '',
      city: user?.ambulanceCompanyAddress?.city || '',
      vehicles: [],
      drivers: []
    });
    await fleet.save();
  }
  return fleet;
}

router.put('/corporate/toggle', authenticateToken, async (req, res) => {
  try {
    const fleet = await getFleet(req.user.id || req.user._id, req.user.name);
    fleet.servesCorporate = req.body.enable !== false; await fleet.save();
    res.json({ success: true, data: { servesCorporate: fleet.servesCorporate } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/corporate/packages', authenticateToken, async (req, res) => {
  try {
    const fleet = await getFleet(req.user.id || req.user._id, req.user.name);
    res.json({ success: true, data: { servesCorporate: fleet.servesCorporate || false, packages: fleet.corporatePackages || [] } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/corporate/packages', authenticateToken, async (req, res) => {
  try {
    const fleet = await getFleet(req.user.id || req.user._id, req.user.name);
    const { packageName, pricePerEmployee } = req.body;
    if (!packageName || !pricePerEmployee) return res.status(400).json({ success: false, message: 'Name and price required' });
    fleet.corporatePackages.push({ ...req.body, isActive: true, createdAt: new Date() }); await fleet.save();
    res.json({ success: true, data: fleet.corporatePackages[fleet.corporatePackages.length - 1] });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/corporate/enquiries', authenticateToken, async (req, res) => {
  try {
    const fleet = await getFleet(req.user.id || req.user._id, req.user.name);
    res.json({ success: true, data: fleet.corporateEnquiries || [] });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.put('/corporate/enquiries/:enquiryId', authenticateToken, async (req, res) => {
  try {
    const fleet = await getFleet(req.user.id || req.user._id, req.user.name);
    const enquiry = fleet.corporateEnquiries.id(req.params.enquiryId);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    if (req.body.status) enquiry.status = req.body.status; await fleet.save();
    res.json({ success: true, data: enquiry });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Provider stats - works with any authenticated user
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    var providerId = req.user.id || req.user._id || req.user.userId;
    var bookings = await Booking.countDocuments({ 
      $or: [
        { providerId: providerId },
        { userId: providerId },
        { driverId: providerId }
      ]
    });
    var activeBookings = await Booking.countDocuments({ 
      $or: [
        { providerId: providerId },
        { userId: providerId }
      ],
      status: { $in: ['active', 'pending', 'confirmed', 'en_route', 'in_progress'] }
    });
    res.json({ success: true, data: { totalBookings: bookings, activeBookings: activeBookings } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🚑 PROVIDER DASHBOARD ENDPOINTS (AmbulanceFleet)
// ============================================

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'Provider not found' });
    res.json({ success: true, data: user });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const updates = { ...req.body }; delete updates.password; delete updates.role;
    const user = await User.findByIdAndUpdate(req.user.id || req.user._id, updates, { new: true }).select('-password');
    res.json({ success: true, data: user });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.put('/location', authenticateToken, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    await User.findByIdAndUpdate(req.user.id || req.user._id, {
      'ambulanceCompanyAddress.coordinates': { lat: lat || 0, lng: lng || 0 }
    });
    res.json({ success: true, message: 'Location updated' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/vehicles', authenticateToken, async (req, res) => {
  try {
    const providerId = req.user.id || req.user._id;
    let fleet = await AmbulanceFleet.findOne({ ownerType: 'ambulance_provider', ownerId: providerId });
    if (fleet && fleet.vehicles && fleet.vehicles.length > 0) {
      return res.json({ success: true, data: fleet.vehicles.map(v => ({
        _id: v._id,
        vehicleNumber: v.vehicleNumber || 'N/A',
        type: v.type || 'basic',
        model: v.model || '',
        year: v.year || '',
        equipment: v.equipment || [],
        baseFare: v.baseFare || 0,
        perKmRate: v.perKmRate || 0,
        nightCharge: v.nightCharge || 0,
        waitingCharge: v.waitingCharge || 0,
        driver: v.driverName || 'N/A',
        driverPhone: v.driverPhone || 'N/A',
        driverLicense: v.driverLicense || '',
        driverExperience: v.driverExperience || '',
        location: v.location || { lat: 0, lng: 0 },
        city: v.city || '',
        status: v.status || 'available'
      })) });
    }
    const user = await User.findById(providerId);
    const fleetType = (user?.ambulanceFleet && user.ambulanceFleet.length > 0) ? (user.ambulanceFleet[0].type || 'basic') : 'basic';
    if (user && user.ambulanceDrivers && user.ambulanceDrivers.length > 0) {
      return res.json({ success: true, data: user.ambulanceDrivers.map((d, i) => ({
        _id: d._id || d.driverId,
        vehicleNumber: (user.ambulanceFleet && user.ambulanceFleet[i]) ? (user.ambulanceFleet[i].vehicleNumber || 'N/A') : 'N/A',
        type: fleetType,
        model: '', year: '', equipment: [], baseFare: 0, perKmRate: 0, nightCharge: 0, waitingCharge: 0,
        driver: d.name || 'N/A',
        driverPhone: d.phone || 'N/A',
        driverLicense: d.licenseNumber || '',
        driverExperience: d.experience || '',
        location: { lat: 0, lng: 0 },
        city: '',
        status: 'available'
      })) });
    }
    res.json({ success: true, data: [] });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/vehicles', authenticateToken, async (req, res) => {
  try {
    console.log('========== ADD VEHICLE START ==========');
    console.log('USER:', JSON.stringify(req.user));
    console.log('BODY:', JSON.stringify(req.body, null, 2));

    const providerId = req.user.id || req.user._id;

    console.log('PROVIDER ID:', providerId);

    if (!providerId) {
      return res.status(401).json({
        success: false,
        message: 'Provider ID missing'
      });
    }

    const fleet = await getFleet(providerId, req.user.name);

    console.log('FLEET FOUND:', !!fleet);
    console.log('FLEET ID:', fleet?._id);
    console.log('VEHICLES BEFORE:', fleet?.vehicles?.length);

    if (!Array.isArray(fleet.vehicles)) {
      fleet.vehicles = [];
    }

    const vehicle = {
      vehicleNumber: String(req.body.vehicleNumber || '').trim(),
      type: req.body.type || 'basic',
      model: String(req.body.model || '').trim(),

      year:
        req.body.year !== undefined &&
        req.body.year !== null &&
        req.body.year !== ''
          ? Number(req.body.year)
          : undefined,

      equipment: Array.isArray(req.body.equipment)
        ? req.body.equipment.map(String)
        : [],

      baseFare: Number(req.body.baseFare) || 0,
      perKmRate: Number(req.body.perKmRate) || 0,
      nightCharge: Number(req.body.nightCharge) || 0,
      waitingCharge: Number(req.body.waitingCharge) || 0,

      driverName: String(req.body.driverName || '').trim(),
      driverPhone: String(req.body.driverPhone || '').trim(),

      status: 'available',

      location: {
        lat: 0,
        lng: 0
      }
    };

    console.log(
      'VEHICLE:',
      JSON.stringify(vehicle, null, 2)
    );

    fleet.vehicles.push(vehicle);
    fleet.updatedAt = new Date();

    console.log(
      'VEHICLES AFTER:',
      fleet.vehicles.length
    );

    console.log('ABOUT TO SAVE FLEET');

    await fleet.save();

    console.log('========== VEHICLE SAVED ==========');

    const savedVehicle =
      fleet.vehicles[fleet.vehicles.length - 1];

    return res.status(201).json({
      success: true,
      message: 'Vehicle saved successfully',
      data: savedVehicle
    });

  } catch (error) {

    console.error('==========================================');
    console.error('🚨 ADD VEHICLE FAILED');
    console.error('ERROR NAME:', error.name);
    console.error('ERROR MESSAGE:', error.message);
    console.error('ERROR CODE:', error.code);
    console.error('ERROR STACK:', error.stack);

    if (error.errors) {
      console.error(
        'MONGOOSE VALIDATION ERRORS:',
        JSON.stringify(error.errors, null, 2)
      );
    }

    console.error('==========================================');

    return res.status(500).json({
      success: false,
      message: error.message,
      errorName: error.name,
      errorCode: error.code
    });
  }
});

router.put('/vehicles/:id', authenticateToken, async (req, res) => {
  try {
    const fleet = await getFleet(req.user.id || req.user._id, req.user.name);
    const v = fleet.vehicles.id(req.params.id);
    if (!v) return res.status(404).json({ success: false, message: 'Not found' });
    Object.assign(v, req.body); fleet.updatedAt = new Date(); await fleet.save();
    res.json({ success: true, data: v });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.delete('/vehicles/:id', authenticateToken, async (req, res) => {
  try {
    const fleet = await getFleet(req.user.id || req.user._id, req.user.name);
    fleet.vehicles.pull(req.params.id); fleet.updatedAt = new Date(); await fleet.save();
    res.json({ success: true, message: 'Removed' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/drivers', authenticateToken, async (req, res) => {
  try {
    const providerId = req.user.id || req.user._id;
    let fleet = await AmbulanceFleet.findOne({ ownerType: 'ambulance_provider', ownerId: providerId });
    if (fleet && fleet.drivers && fleet.drivers.length > 0) {
      return res.json({ success: true, data: fleet.drivers.map(d => ({
        _id: d._id,
        name: d.name || 'N/A',
        phone: d.phone || 'N/A',
        licenseNumber: d.licenseNumber || 'N/A',
        experience: d.experience || '',
        status: d.status || 'available'
      })) });
    }
    const user = await User.findById(providerId);
    if (user && user.ambulanceDrivers && user.ambulanceDrivers.length > 0) {
      return res.json({ success: true, data: user.ambulanceDrivers.map(d => ({
        _id: d._id || d.driverId,
        name: d.name || 'N/A',
        phone: d.phone || 'N/A',
        licenseNumber: d.licenseNumber || 'N/A',
        experience: d.experience || '',
        status: 'available'
      })) });
    }
    res.json({ success: true, data: [] });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/drivers', authenticateToken, async (req, res) => {
  try {
    const fleet = await getFleet(req.user.id || req.user._id, req.user.name);
    fleet.drivers.push(req.body); fleet.updatedAt = new Date(); await fleet.save();
    res.json({ success: true, data: fleet.drivers[fleet.drivers.length - 1] });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.put('/drivers/:id', authenticateToken, async (req, res) => {
  try {
    const fleet = await getFleet(req.user.id || req.user._id, req.user.name);
    const d = fleet.drivers.id(req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Not found' });
    Object.assign(d, req.body); fleet.updatedAt = new Date(); await fleet.save();
    res.json({ success: true, data: d });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.delete('/drivers/:id', authenticateToken, async (req, res) => {
  try {
    const fleet = await getFleet(req.user.id || req.user._id, req.user.name);
    fleet.drivers.pull(req.params.id); fleet.updatedAt = new Date(); await fleet.save();
    res.json({ success: true, message: 'Removed' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/bookings', authenticateToken, async (req, res) => {
  try {
    const providerId = req.user.id || req.user._id;
    const { status, limit = 20, page = 1 } = req.query;
    const query = { providerId };
    if (status && status !== 'all') query.status = status;
    const [bookings, total] = await Promise.all([Booking.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)), Booking.countDocuments(query)]);
    res.json({ success: true, data: bookings, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const fleet = await getFleet(req.user.id || req.user._id, req.user.name);
    res.json({ success: true, data: { totalBookings: 0, activeBookings: 0, totalVehicles: fleet.vehicles?.length || 0, totalDrivers: fleet.drivers?.length || 0 } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/reports', authenticateToken, async (req, res) => {
  try {
    const fleet = await getFleet(req.user.id || req.user._id, req.user.name);
    const providerId = req.user.id || req.user._id;
    const [total, completed] = await Promise.all([Booking.countDocuments({ providerId }), Booking.countDocuments({ providerId, status: 'completed' })]);
    res.json({ success: true, data: { totalBookings: total, completedBookings: completed, totalVehicles: fleet.vehicles?.length || 0, totalDrivers: fleet.drivers?.length || 0 } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ============================================
// EMERGENCY FIX: Vehicles from User model if Ambulance missing
// ============================================
router.get('/vehicles-fix', authenticateToken, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id || req.user._id);
    res.json({ 
      success: true, 
      data: (user?.ambulanceDrivers || []).map(d => ({
        vehicleNumber: d.vehicleNumber || 'N/A',
        type: d.vehicleType || 'Basic', 
        driver: d.name || 'N/A',
        driverPhone: d.phone || 'N/A',
        status: 'available'
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/reset-fleet', authenticateToken, async (req, res) => {
  try {
    const providerId = req.user.id || req.user._id;
    await AmbulanceFleet.deleteMany({ ownerType: 'ambulance_provider', ownerId: providerId });
    res.json({ success: true, message: 'Fleet reset. Refresh dashboard.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.patch('/fix-type', authenticateToken, async (req, res) => {
  try {
    const { type } = req.body;
    if (!type) return res.status(400).json({ success: false, message: 'Type required' });
    const user = await User.findById(req.user.id || req.user._id);
    if (!user || user.role !== 'ambulance_provider') return res.status(404).json({ success: false, message: 'Not found' });
    if (user.ambulanceFleet && user.ambulanceFleet.length > 0) {
      user.ambulanceFleet[0].type = type;
      await user.save();
    }
    const fleet = await AmbulanceFleet.findOne({ ownerType: 'ambulance_provider', ownerId: user._id });
    if (fleet && fleet.vehicles && fleet.vehicles.length > 0) {
      fleet.vehicles[0].type = type;
      await fleet.save();
    }
    res.json({ success: true, message: `Type set to ${type}` });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.patch('/fix-type-raw', authenticateToken, async (req, res) => {
  try {
    const { type } = req.body;
    if (!type) return res.status(400).json({ success: false, message: 'Type required' });
    const result = await User.updateOne(
      { _id: req.user.id || req.user._id, 'ambulanceFleet._id': req.body.fleetId || { $exists: true } },
      { $set: { 'ambulanceFleet.$[elem].type': type } },
      { arrayFilters: [{ 'elem._id': { $exists: true } }] }
    );
    res.json({ success: true, matched: result.matchedCount, modified: result.modifiedCount });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;// fix 

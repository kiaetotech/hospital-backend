// D:\hospital backend\routes\ambulance.js

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
      return res.status(400).json({ success, error: 'Phone number is required' });
    }
    if (!pickupLat || !pickupLng) {
      return res.status(400).json({ success, error: 'Location is required' });
    }

    const result = await dispatchService.dispatchEmergencyAmbulance({
      userId|| 'guest',
      patientName|| 'Emergency Patient',
      patientPhone, patientAge, patientGender,
      pickupLat, pickupLng,
      pickupAddress|| 'GPS Location',
      patientCondition, emergencyType
    });

    if (result.success) {
      return res.status(200).json({
        success,
        message: 'Ambulance dispatched successfully',
        data: {
          bookingId.booking.bookingId,
          driver: {
            name.driver.driverName,
            phone.driver.driverPhone,
            vehicleNumber.driver.vehicleNumber,
            rating.driver.driverRating
          },
          trackingUrl.trackingUrl,
          tripOtp.booking.tripOtp,
          fareEstimate.fareEstimate
        }
      });
    } else {
      return res.status(200).json({
        success,
        reason.reason,
        message: 'No ambulance available. Please call 108.',
        bookingId.booking?.bookingId
      });
    }
  } catch (error) {
    console.error('Emergency dispatch error:', error);
    return res.status(500).json({ 
      success, error: 'Emergency dispatch failed',
      message: 'Please call 108 for immediate assistance'
    });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/accept-emergency/// 🚑 Driver accepts emergency request
// ─────────────────────────────────────────────
router.post('/accept-emergency/', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const driverId = req.body.driverId || req.user.driverId;
    if (!driverId) return res.status(400).json({ success, error: 'Driver ID required' });

    const result = await dispatchService.driverAcceptEmergency(driverId, bookingId);
    if (result.success) {
      return res.json({ success, message: 'Emergency accepted', data.booking });
    }
    return res.json({ success, reason.reason });
  } catch (error) {
    return res.status(500).json({ success, error.message });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/trip-start/// 🚑 Driver reached pickup location
// ─────────────────────────────────────────────
router.post('/trip-start/', authenticateToken, async (req, res) => {
  try {
    const result = await dispatchService.driverArrivedAtPickup(req.params.bookingId);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success, error.message });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/patient-onboard/// 🚑 Patient onboard with OTP verification
// ─────────────────────────────────────────────
router.post('/patient-onboard/', authenticateToken, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success, error: 'OTP required' });
    const result = await dispatchService.patientOnboard(req.params.bookingId, otp);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success, error.message });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/arrived-hospital/// 🚑 Arrived at hospital
// ─────────────────────────────────────────────
router.post('/arrived-hospital/', authenticateToken, async (req, res) => {
  try {
    const { vitals } = req.body;
    const result = await dispatchService.arrivedAtHospital(req.params.bookingId, vitals);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success, error.message });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/trip-complete/// 🚑 Trip completed with trip sheet
// ─────────────────────────────────────────────
router.post('/trip-complete/', authenticateToken, async (req, res) => {
  try {
    const { distance, duration, oxygenAdministered, medicationsGiven, vitals, notes } = req.body;
    const result = await dispatchService.completeEmergencyTrip(req.params.bookingId, {
      distance, duration, oxygenAdministered, medicationsGiven, vitals, driverNotes});
    if (result.success) {
      return res.json({ success, message: 'Trip completed', data});
    }
    return res.json({ success, reason.reason });
  } catch (error) {
    return res.status(500).json({ success, error.message });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/cancel-emergency/// 🚑 Cancel emergency
// ─────────────────────────────────────────────
router.post('/cancel-emergency/', async (req, res) => {
  try {
    const { reason, cancelledBy = 'patient' } = req.body;
    const result = await dispatchService.cancelEmergency(req.params.bookingId, reason, cancelledBy);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success, error.message });
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
    if (!booking) return res.status(404).json({ success, error: 'Booking not found' });

    const emergencyData = {
      patientName.patientName,
      ambulanceType.vehicleType || 'Emergency',
      vehicleNumber.vehicleNumber,
      driverName.driverName,
      driverPhone.driverPhone,
      eta: '5',
      trackingUrl.trackingUrl,
      hospitalName.hospitalDestination?.hospitalName || 'Nearest hospital'
    };

    await smsService.sendEmergencyContactsSMS(contacts, emergencyData);
    return res.json({ success, message: 'SOS messages sent' });
  } catch (error) {
    return res.status(500).json({ success, error.message });
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
    if (!booking) return res.status(404).json({ success, error: 'Booking not found' });

    await notificationService.sendHospitalERNotification(null, null, {
      bookingId.bookingId,
      patientName.patientName,
      patientAge.patientAge,
      patientGender.patientGender,
      chiefComplaint.patientCondition?.chiefComplaint || 'Emergency',
      ambulanceType.vehicleType,
      vehicleNumber.vehicleNumber,
      eta: '5',
      driverPhone.driverPhone
    });

    booking.hospitalNotified = true;
    booking.hospitalNotificationTime = new Date();
    await booking.save();

    return res.json({ success, message: 'Hospital notified' });
  } catch (error) {
    return res.status(500).json({ success, error.message });
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
    if (!lat || !lng) return res.status(400).json({ success, error: 'Coordinates required' });

    await locationCache.ambulance.updateDriverLocation(driverId, lat, lng, {
      speed, heading, isAvailable!== false,
      isOnTrip|| false, tripId|| '',
      vehicleType.body.vehicleType || 'basic',
      providerId.body.providerId || ''
    });
    return res.json({ success, message: 'Location updated' });
  } catch (error) {
    return res.status(500).json({ success, error.message });
  }
});

// ─────────────────────────────────────────────
// GET /ambulance/nearby-ambulances
// 📍 Find nearby available ambulances
// ─────────────────────────────────────────────
router.get('/nearby-ambulances', async (req, res) => {
  try {
    const { lat, lng, radius = 5, vehicleType, limit = 10 } = req.query;
    if (!lat || !lng) return res.status(400).json({ success, error: 'Coordinates required' });

    const drivers = await locationCache.ambulance.findNearbyDrivers(
      parseFloat(lat), parseFloat(lng), parseFloat(radius), {
        vehicleType|| null,
        limit(limit),
        requireAvailable}
    );

    return res.json({
      success, count.length,
      data.map(d => ({
        driverId.driverId, distance.distance,
        vehicleType.vehicleType, rating.rating || 0,
        estimatedETA.round(d.distance * 2)
      }))
    });
  } catch (error) {
    return res.status(500).json({ success, error.message });
  }
});

// ─────────────────────────────────────────────
// GET /ambulance/active-emergency/// 📍 Live tracking for active emergency
// ─────────────────────────────────────────────
router.get('/active-emergency/', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId.params.bookingId });
    if (!booking) return res.status(404).json({ success, error: 'Booking not found' });

    let driverLocation = null;
    if (booking.driverId) {
      driverLocation = await locationCache.ambulance.getDriverLocation(booking.driverId);
    }

    return res.json({
      success,
      data: {
        bookingId.bookingId,
        status.status,
        driver: {
          name.driverName, phone.driverPhone,
          vehicleNumber.vehicleNumber, rating.driverRating,
          location? { lat.lat, lng.lng } },
        hospital.hospitalDestination,
        timestamps: {
          requested.emergencyRequestedAt, accepted.driverAcceptedAt,
          arrived.driverReachedAt, onboard.patientOnboardAt,
          completed.completedAt
        },
        trackingUrl.trackingUrl
      }
    });
  } catch (error) {
    return res.status(500).json({ success, error.message });
  }
});

// ─────────────────────────────────────────────
// GET /ambulance/surge-check
// 📍 Check surge pricing in area
// ─────────────────────────────────────────────
router.get('/surge-check', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ success, error: 'Coordinates required' });

    const surgeInfo = await dispatchService.checkSurgePricing(parseFloat(lat), parseFloat(lng));
    return res.json({ success, data});
  } catch (error) {
    return res.status(500).json({ success, error.message });
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
      isEmergency,
      oxygenRequired});

    const booking = new Booking({
      userId.user.userId || req.user.id,
      bookingType: 'ambulance',
      emergencyType: 'scheduled',
      patientName, patientPhone, patientAge, patientGender,
      ambulanceType,
      pickupAddress,
      pickupCoordinates: { lat, lng},
      dropAddress,
      hospitalDestination: {
        hospitalName|| destinationAddress,
        address,
        coordinates: { lat, lng}
      },
      appointmentDateDate(`${scheduledDate}T${scheduledTime || '10:00'}`),
      originalAmount.breakdown.total,
      finalAmount.breakdown.total,
      fareBreakdown.breakdown,
      scheduledTransport: {
        isRecurring|| false,
        recurringDays|| [],
        requiresOxygen|| false,
        requiresAttendant|| false,
        mobilityType|| 'walking',
        specialEquipment: []
      },
      specialRequirements,
      status: 'pending'
    });

    await booking.save();

    await smsService.sendAmbulanceSMS(patientPhone, 'scheduled_confirmed', {
      dateDate(scheduledDate).toLocaleDateString('en-IN'),
      time|| 'Scheduled',
      pickupAddress,
      hospitalName|| destinationAddress,
      vehicleType,
      bookingId.bookingId
    });

    return res.json({
      success,
      message: 'Ambulance scheduled successfully',
      data: {
        bookingId.bookingId,
        scheduledDate, scheduledTime,
        fareEstimate.breakdown
      }
    });
  } catch (error) {
    return res.status(500).json({ success, error.message });
  }
});

// ─────────────────────────────────────────────
// GET /ambulance/scheduled-bookings
// 📅 Get user's scheduled ambulance bookings
// ─────────────────────────────────────────────
router.get('/scheduled-bookings', authenticateToken, async (req, res) => {
  try {
    const bookings = await Booking.find({
      userId.user.userId || req.user.id,
      bookingType: 'ambulance',
      emergencyType: 'scheduled',
      status: { $in: ['pending', 'confirmed', 'completed'] }
    }).sort({ appointmentDate: -1 });

    return res.json({ success, count.length, data});
  } catch (error) {
    return res.status(500).json({ success, error.message });
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
      userId.user.userId || req.user.id,
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
      success,
      data,
      pagination: { total, page(page), pages.ceil(total / limit) }
    });
  } catch (error) {
    return res.status(500).json({ success, error.message });
  }
});

// ─────────────────────────────────────────────
// GET /ambulance/booking/// 📊 Get single booking details
// ─────────────────────────────────────────────
router.get('/booking/', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId.params.bookingId });
    if (!booking) return res.status(404).json({ success, error: 'Booking not found' });
    return res.json({ success, data});
  } catch (error) {
    return res.status(500).json({ success, error.message });
  }
});

// ─────────────────────────────────────────────
// GET /ambulance/trip-sheet/// 📊 Get digital trip sheet for insurance
// ─────────────────────────────────────────────
router.get('/trip-sheet/', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId.params.bookingId });
    if (!booking) return res.status(404).json({ success, error: 'Booking not found' });
    if (!booking.digitalTripSheet?.generated) {
      return res.status(400).json({ success, error: 'Trip sheet not yet generated' });
    }

    return res.json({
      success,
      data: {
        tripSheetId.digitalTripSheet.tripSheetId,
        bookingId.bookingId,
        patientName.patientName,
        driverName.driverName,
        vehicleNumber.vehicleNumber,
        ambulanceType.vehicleType,
        pickupAddress.pickupAddress,
        hospitalDestination.hospitalDestination?.hospitalName,
        pickupTime.digitalTripSheet.pickupTime || booking.driverAcceptedAt,
        dropTime.digitalTripSheet.dropTime || booking.completedAt,
        distance.digitalTripSheet.distance,
        duration.digitalTripSheet.duration,
        vitals.digitalTripSheet.vitals,
        oxygenAdministered.digitalTripSheet.oxygenAdministered,
        medicationsGiven.digitalTripSheet.medicationsGiven,
        fareBreakdown.fareBreakdown,
        generatedAt.digitalTripSheet.generatedAt,
        insuranceReady}
    });
  } catch (error) {
    return res.status(500).json({ success, error.message });
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
    if (!driverId) return res.status(400).json({ success, error: 'Driver ID required' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayTrips, totalTrips, recentTrips, driverLocation] = await Promise.all([
      Booking.countDocuments({ driverId, bookingType: 'ambulance_emergency', createdAt: { $gte, $lt}, status: 'completed' }),
      Booking.countDocuments({ driverId, status: 'completed' }),
      Booking.find({ driverId, status: 'completed' }).sort({ completedAt: -1 }).limit(5),
      locationCache.ambulance.getDriverLocation(driverId)
    ]);

    const todayEarnings = await Transaction.aggregate([
      { $match: { ambulanceDriverId, createdAt: { $gte, $lt}, status: 'completed' } },
      { $group: { _id, total: { $sum: '$ambulanceCommission.driverEarnings' } } }
    ]);

    return res.json({
      success,
      data: {
        todayTrips,
        todayEarnings[0]?.total || 0,
        totalTrips,
        recentTrips,
        currentLocation,
        rating.user.driverRating || 0
      }
    });
  } catch (error) {
    return res.status(500).json({ success, error.message });
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

    return res.json({ success, isAvailable });
  } catch (error) {
    return res.status(500).json({ success, error.message });
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
      success,
      data,
      pagination: { total, page(page), pages.ceil(total / limit) }
    });
  } catch (error) {
    return res.status(500).json({ success, error.message });
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
      distance(distance) || 5,
      ambulanceType,
      isEmergency=== 'true',
      isNightTime=== 'true'
    });

    return res.json({
      success,
      data: {
        fareBreakdown.breakdown,
        total.breakdown.total,
        platformFee=== 'true' ? 0 : 50
      }
    });
  } catch (error) {
    return res.status(500).json({ success, error.message });
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
      return res.json({ success, data: { contacts: [], medicalInfo} });
    }

    return res.json({
      success,
      data: {
        contacts.contacts,
        medicalInfo.medicalInfo,
        insuranceInfo.insuranceInfo,
        ambulancePreferences.ambulancePreferences
      }
    });
  } catch (error) {
    return res.status(500).json({ success, error.message });
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
    return res.json({ success, message: 'Emergency contacts updated' });
  } catch (error) {
    return res.status(500).json({ success, error.message });
  }
});

// ============================================
// 🆕 CORPORATE HEALTH ROUTES
// ============================================

// Toggle corporate serving status
router.put('/corporate/toggle', authenticateToken, async (req, res) => {
  try {
    const Ambulance = require('../models/Ambulance');
    const { ambulanceId } = req.body;
    if (!ambulanceId) {
      return res.status(400).json({ success, message: 'Ambulance ID required' });
    }

    const ambulance = await Ambulance.findById(ambulanceId);
    if (!ambulance) {
      return res.status(404).json({ success, message: 'Ambulance not found' });
    }

    const enable = req.body.enable !== false;
    await ambulance.toggleCorporate(enable);

    res.json({
      success,
      message: `Corporate ${enable ? 'enabled' : 'disabled'} successfully`,
      data: { servesCorporate.servesCorporate }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Get corporate packages
router.get('/corporate/packages', authenticateToken, async (req, res) => {
  try {
    const Ambulance = require('../models/Ambulance');
    const { ambulanceId } = req.query;
    if (!ambulanceId) {
      return res.status(400).json({ success, message: 'Ambulance ID required' });
    }

    const ambulance = await Ambulance.findById(ambulanceId).select('servesCorporate corporatePackages');
    if (!ambulance) {
      return res.status(404).json({ success, message: 'Ambulance not found' });
    }

    res.json({
      success,
      data: {
        servesCorporate.servesCorporate,
        packages.corporatePackages || []
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Create corporate package
router.post('/corporate/packages', authenticateToken, async (req, res) => {
  try {
    const Ambulance = require('../models/Ambulance');
    const { ambulanceId, packageName, packageType, description, servicesIncluded, pricePerEmployee, discountedPricePerEmployee, minEmployees, maxEmployees, validityDays, numberOfVehicles, vehicleTypes, coverageRadiusKm, responseTimeMinutes, availableCities, dedicatedPOC, slaTerms } = req.body;

    if (!ambulanceId) {
      return res.status(400).json({ success, message: 'Ambulance ID required' });
    }
    if (!packageName || !pricePerEmployee) {
      return res.status(400).json({ success, message: 'Package name and price per employee are required' });
    }

    const ambulance = await Ambulance.findById(ambulanceId);
    if (!ambulance) {
      return res.status(404).json({ success, message: 'Ambulance not found' });
    }

    const packageData = {
      packageName,
      packageType|| 'ambulance_retainer',
      description|| '',
      servicesIncluded|| [],
      pricePerEmployee,
      discountedPricePerEmployee,
      minEmployees|| 50,
      maxEmployees,
      validityDays|| 365,
      numberOfVehiclesOfVehicles || 1,
      vehicleTypes|| ['basic'],
      coverageRadiusKm|| 20,
      responseTimeMinutes|| 30,
      availableCities|| [],
      dedicatedPOC|| {},
      slaTerms|| ''
    };

    await ambulance.addCorporatePackage(packageData);

    res.json({
      success,
      message: 'Corporate package added successfully',
      data.corporatePackages[ambulance.corporatePackages.length - 1]
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Update corporate package
router.put('/corporate/packages/', authenticateToken, async (req, res) => {
  try {
    const Ambulance = require('../models/Ambulance');
    const { ambulanceId } = req.body;
    if (!ambulanceId) {
      return res.status(400).json({ success, message: 'Ambulance ID required' });
    }

    const ambulance = await Ambulance.findById(ambulanceId);
    if (!ambulance) {
      return res.status(404).json({ success, message: 'Ambulance not found' });
    }

    const pkg = ambulance.corporatePackages.id(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ success, message: 'Package not found' });
    }

    const updatableFields = [
      'packageName', 'packageType', 'description', 'servicesIncluded',
      'pricePerEmployee', 'discountedPricePerEmployee', 'minEmployees',
      'maxEmployees', 'validityDays', 'numberOfVehicles', 'vehicleTypes',
      'coverageRadiusKm', 'responseTimeMinutes', 'availableCities',
      'dedicatedPOC', 'slaTerms', 'isActive'
    ];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        pkg[field] = req.body[field];
      }
    });

    pkg.updatedAt = new Date();
    await ambulance.save();

    res.json({ success, message: 'Corporate package updated', data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Delete corporate package
router.delete('/corporate/packages/', authenticateToken, async (req, res) => {
  try {
    const Ambulance = require('../models/Ambulance');
    const { ambulanceId } = req.body;
    if (!ambulanceId) {
      return res.status(400).json({ success, message: 'Ambulance ID required' });
    }

    const ambulance = await Ambulance.findById(ambulanceId);
    if (!ambulance) {
      return res.status(404).json({ success, message: 'Ambulance not found' });
    }

    const pkg = ambulance.corporatePackages.id(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ success, message: 'Package not found' });
    }

    pkg.remove();
    await ambulance.save();

    res.json({ success, message: 'Corporate package deleted' });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Get corporate enquiries
router.get('/corporate/enquiries', authenticateToken, async (req, res) => {
  try {
    const Ambulance = require('../models/Ambulance');
    const { ambulanceId } = req.query;
    if (!ambulanceId) {
      return res.status(400).json({ success, message: 'Ambulance ID required' });
    }

    const ambulance = await Ambulance.findById(ambulanceId).select('corporateEnquiries');
    if (!ambulance) {
      return res.status(404).json({ success, message: 'Ambulance not found' });
    }

    res.json({ success, data.corporateEnquiries || [] });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Update enquiry status
router.put('/corporate/enquiries/', authenticateToken, async (req, res) => {
  try {
    const Ambulance = require('../models/Ambulance');
    const { ambulanceId } = req.body;
    if (!ambulanceId) {
      return res.status(400).json({ success, message: 'Ambulance ID required' });
    }

    const ambulance = await Ambulance.findById(ambulanceId);
    if (!ambulance) {
      return res.status(404).json({ success, message: 'Ambulance not found' });
    }

    const enquiry = ambulance.corporateEnquiries.id(req.params.enquiryId);
    if (!enquiry) {
      return res.status(404).json({ success, message: 'Enquiry not found' });
    }

    if (req.body.status) {
      enquiry.status = req.body.status;
    }

    await ambulance.save();
    res.json({ success, message: 'Enquiry updated', data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// EXPORT
// ============================================

module.exports = router;


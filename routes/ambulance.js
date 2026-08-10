// D:\hospital backend\routes\ambulance.js

const AmbulanceFleet = require('../models/AmbulanceFleet');
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const EmergencyContact = require('../models/EmergencyContact');
const { authenticateToken } = require('../middleware/auth');

// AmbulanceFleet.vehicleSchema allowed values
const ALLOWED_VEHICLE_TYPES = ['basic', 'cardiac', 'ventilator', 'neonatal', 'wheelchair'];
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
// ============================================
// GET /ambulance/nearby-ambulances
// Find available ambulances + provider pricing
// ============================================
router.get('/nearby-ambulances', async (req, res) => {
  try {
    const {
      lat,
      lng,
      radius = 25,
      vehicleType,
      limit = 20
    } = req.query;

    if (
      lat === undefined ||
      lng === undefined ||
      lat === '' ||
      lng === ''
    ) {
      return res.status(400).json({
        success: false,
        error: 'Coordinates required'
      });
    }

    const drivers =
      await locationCache.ambulance.findNearbyDrivers(
        parseFloat(lat),
        parseFloat(lng),
        parseFloat(radius),
        {
          vehicleType:
            vehicleType || null,

          limit:
            parseInt(limit, 10),

          requireAvailable: true
        }
      );

    const results = [];

    for (const driver of drivers) {

      if (!driver.providerId) {
        continue;
      }

      const fleet =
        await AmbulanceFleet.findOne({
          ownerType: 'ambulance_provider',
          ownerId: driver.providerId,
          isActive: true
        });

      if (!fleet) {
        continue;
      }

      let vehicle = null;

      // First try vehicleId if the driver location
      // already contains it.
      if (driver.vehicleId) {
        vehicle =
          fleet.vehicles.id(
            driver.vehicleId
          );
      }

      // Otherwise find by driver ID / vehicle number.
      if (!vehicle && driver.vehicleNumber) {
        vehicle =
          fleet.vehicles.find(
            v =>
              v.vehicleNumber ===
              driver.vehicleNumber
          );
      }

      // Final fallback: match vehicle type.
      if (!vehicle) {
        vehicle =
          fleet.vehicles.find(
            v =>
              String(v.type || '')
                .toLowerCase() ===
                String(driver.vehicleType || '')
                .toLowerCase() &&
              v.status === 'available'
          );
      }

      if (!vehicle) {
        continue;
      }

      results.push({
        driverId:
          driver.driverId,

        providerId:
          driver.providerId,

        vehicleId:
          vehicle._id,

        vehicleNumber:
          vehicle.vehicleNumber || '',

        vehicleType:
          vehicle.type || 'basic',

        driverName:
          vehicle.driverName || '',

        driverPhone:
          vehicle.driverPhone || '',

        distance:
          driver.distance,

        rating:
          driver.rating || 0,

        estimatedETA:
          Math.max(
            5,
            Math.round(
              driver.distance * 2
            )
          ),

        // PROVIDER-ENTERED PRICING
        pricing: {
          baseFare:
            Number(vehicle.baseFare) || 0,

          perKmRate:
            Number(vehicle.perKmRate) || 0,

          nightCharge:
            Number(vehicle.nightCharge) || 0,

          waitingCharge:
            Number(vehicle.waitingCharge) || 0
        }
      });
    }

    return res.json({
      success: true,
      count: results.length,
      data: results
    });

  } catch (error) {

    console.error(
      'NEARBY AMBULANCE ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// POST /ambulance/schedule-transport
// Schedule non-emergency ambulance
// Uses ONLY provider-entered vehicle pricing
// ============================================
router.post('/schedule-transport', authenticateToken, async (req, res) => {
  try {
    const {
      patientName,
      patientPhone,
      patientAge,
      patientGender,

      pickupAddress,
      pickupLat,
      pickupLng,

      destinationAddress,
      destinationLat,
      destinationLng,

      hospitalName,
      ambulanceType = 'basic',

      scheduledDate,
      scheduledTime,

      requiresOxygen,
      requiresAttendant,
      mobilityType,

      specialRequirements,
      isRecurring,
      recurringDays,

      providerId,
      vehicleId
    } = req.body;

    // --------------------------------------------
    // BASIC VALIDATION
    // --------------------------------------------
    const patientLat = Number(pickupLat);
    const patientLng = Number(pickupLng);
    const destinationLatNum = Number(destinationLat);
    const destinationLngNum = Number(destinationLng);

    if (
      !Number.isFinite(patientLat) ||
      !Number.isFinite(patientLng) ||
      !Number.isFinite(destinationLatNum) ||
      !Number.isFinite(destinationLngNum)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Valid pickup and destination coordinates are required'
      });
    }

    if (!providerId) {
      return res.status(400).json({
        success: false,
        error: 'Ambulance provider is required'
      });
    }

    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        error: 'Ambulance vehicle is required'
      });
    }

    if (!scheduledDate) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled date is required'
      });
    }

    // --------------------------------------------
    // FIND THE AUTHORITATIVE PROVIDER FLEET
    // --------------------------------------------
    const fleet = await AmbulanceFleet.findOne({
      ownerType: 'ambulance_provider',
      ownerId: providerId,
      isActive: true,
      isVerified: true
    });

    if (!fleet) {
      return res.status(404).json({
        success: false,
        error: 'Selected ambulance provider is not available'
      });
    }

    // --------------------------------------------
    // FIND EXACT VEHICLE SELECTED BY PATIENT
    // --------------------------------------------
    const vehicle = fleet.vehicles.id(vehicleId);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Selected ambulance vehicle was not found'
      });
    }

    // --------------------------------------------
    // VEHICLE MUST ACTUALLY BE AVAILABLE
    // --------------------------------------------
    if (vehicle.status !== 'available') {
      return res.status(409).json({
        success: false,
        error: 'Selected ambulance is no longer available. Please select another ambulance.'
      });
    }

    // --------------------------------------------
    // PROVIDER-ENTERED PRICING
    // NEVER USE CLIENT-SENT PRICES
    // NEVER USE DUMMY BASE FARE
    // --------------------------------------------
    const baseFare = Number(vehicle.baseFare);
    const perKmRate = Number(vehicle.perKmRate);
    const nightCharge = Number(vehicle.nightCharge || 0);
    const waitingCharge = Number(vehicle.waitingCharge || 0);

    if (
      !Number.isFinite(baseFare) ||
      !Number.isFinite(perKmRate) ||
      baseFare < 0 ||
      perKmRate < 0 ||
      nightCharge < 0 ||
      waitingCharge < 0
    ) {
      return res.status(422).json({
        success: false,
        error: 'Selected ambulance provider has not configured valid pricing'
      });
    }

    // --------------------------------------------
    // CALCULATE DISTANCE
    // Server calculates this independently.
    // --------------------------------------------
    const earthRadiusKm = 6371;

    const dLat =
      ((destinationLatNum - patientLat) * Math.PI) / 180;

    const dLng =
      ((destinationLngNum - patientLng) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +
      Math.cos((patientLat * Math.PI) / 180) *
        Math.cos((destinationLatNum * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    const distanceKm =
      earthRadiusKm * c;

    // --------------------------------------------
    // NIGHT CHARGE
    // Uses provider's configured nightCharge.
    // --------------------------------------------
    const scheduledDateTime = new Date(
      `${scheduledDate}T${scheduledTime || '10:00'}`
    );

    if (Number.isNaN(scheduledDateTime.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid scheduled date or time'
      });
    }

    const scheduledHour =
      scheduledDateTime.getHours();

    const isNightTime =
      scheduledHour >= 22 ||
      scheduledHour < 6;

    const appliedNightCharge =
      isNightTime
        ? nightCharge
        : 0;

    // --------------------------------------------
    // WAITING CHARGE
    // No waiting minutes are requested by the
    // current scheduling form, therefore no
    // waiting charge is added to the booking.
    // --------------------------------------------
    const waitingMinutes = 0;

    const appliedWaitingCharge =
      waitingCharge * waitingMinutes;

    // --------------------------------------------
    // FINAL PROVIDER FARE
    // --------------------------------------------
    const distanceCharge =
      distanceKm * perKmRate;

    const totalFare =
      baseFare +
      distanceCharge +
      appliedNightCharge +
      appliedWaitingCharge;

    const roundedTotalFare =
      Math.round(totalFare * 100) / 100;

    const roundedDistance =
      Math.round(distanceKm * 100) / 100;

    // --------------------------------------------
    // CREATE BOOKING
    // --------------------------------------------
    const booking = new Booking({
      userId:
        req.user.userId ||
        req.user.id ||
        req.user._id,

      bookingType: 'ambulance',
      emergencyType: 'scheduled',

      patientName,
      patientPhone,
      patientAge,
      patientGender,

      ambulanceType:
        vehicle.type ||
        ambulanceType ||
        'basic',

      providerId: fleet.ownerId,
      vehicleId: vehicle._id,

      providerName:
        fleet.providerName || '',

      vehicleNumber:
        vehicle.vehicleNumber || '',

      driverName:
        vehicle.driverName || '',

      driverPhone:
        vehicle.driverPhone || '',

      pickupAddress,

      pickupCoordinates: {
        lat: patientLat,
        lng: patientLng
      },

      dropAddress:
        destinationAddress,

      hospitalDestination: {
        hospitalName:
          hospitalName ||
          destinationAddress,

        address:
          destinationAddress,

        coordinates: {
          lat: destinationLatNum,
          lng: destinationLngNum
        }
      },

      appointmentDate:
        scheduledDateTime,

      originalAmount:
        roundedTotalFare,

      finalAmount:
        roundedTotalFare,

      fareBreakdown: {
        baseFare,
        distanceKm: roundedDistance,
        perKmRate,
        distanceCharge:
          Math.round(distanceCharge * 100) / 100,

        nightCharge:
          appliedNightCharge,

        waitingCharge:
          appliedWaitingCharge,

        waitingMinutes,

        total:
          roundedTotalFare
      },

      scheduledTransport: {
        isRecurring:
          Boolean(isRecurring),

        recurringDays:
          Array.isArray(recurringDays)
            ? recurringDays
            : [],

        requiresOxygen:
          Boolean(requiresOxygen),

        requiresAttendant:
          Boolean(requiresAttendant),

        mobilityType:
          mobilityType || 'walking',

        specialEquipment: []
      },

      specialRequirements,

      status: 'pending'
    });

    await booking.save();

    console.log(
      'SCHEDULED AMBULANCE BOOKING CREATED:',
      {
        bookingId: booking.bookingId,
        providerId: String(fleet.ownerId),
        vehicleId: String(vehicle._id),
        vehicleNumber: vehicle.vehicleNumber,
        distanceKm: roundedDistance,
        totalFare: roundedTotalFare
      }
    );

    // --------------------------------------------
    // SMS
    // SMS failure must NOT cancel the booking.
    // --------------------------------------------
    try {
      await smsService.sendAmbulanceSMS(
        patientPhone,
        'scheduled_confirmed',
        {
          date:
            scheduledDateTime.toLocaleDateString('en-IN'),

          time:
            scheduledTime || 'Scheduled',

          pickupAddress,

          hospitalName:
            hospitalName ||
            destinationAddress,

          vehicleType:
            vehicle.type ||
            ambulanceType,

          bookingId:
            booking.bookingId
        }
      );

      console.log(
        'Scheduled ambulance SMS sent:',
        booking.bookingId
      );

    } catch (smsError) {
      console.error(
        'Scheduled ambulance SMS failed:',
        smsError.message
      );
    }

    // --------------------------------------------
    // RESPONSE
    // --------------------------------------------
    return res.json({
      success: true,
      message:
        'Ambulance scheduled successfully',

      data: {
        bookingId:
          booking.bookingId,

        providerId:
          String(fleet.ownerId),

        vehicleId:
          String(vehicle._id),

        vehicleNumber:
          vehicle.vehicleNumber || '',

        providerName:
          fleet.providerName || '',

        ambulanceType:
          vehicle.type || ambulanceType,

        scheduledDate,
        scheduledTime,

        distanceKm:
          roundedDistance,

        fareEstimate: {
          baseFare,
          perKmRate,
          distanceCharge:
            Math.round(distanceCharge * 100) / 100,

          nightCharge:
            appliedNightCharge,

          waitingCharge:
            appliedWaitingCharge,

          total:
            roundedTotalFare
        }
      }
    });

  } catch (error) {
    console.error(
      '===================================='
    );

    console.error(
      'SCHEDULE TRANSPORT ERROR:',
      error
    );

    console.error(
      '===================================='
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
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

// Provider stats - single consolidated endpoint
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const providerId = req.user.id || req.user._id || req.user.userId;

    if (!providerId) {
      return res.status(401).json({
        success: false,
        message: 'Provider ID missing'
      });
    }

    const [fleet, totalBookings, activeBookings] = await Promise.all([
      getFleet(providerId, req.user.name),
      Booking.countDocuments({
        $or: [
          { providerId },
          { userId: providerId },
          { driverId: providerId }
        ]
      }),
      Booking.countDocuments({
        $or: [
          { providerId },
          { userId: providerId }
        ],
        status: { $in: ['active', 'pending', 'confirmed', 'en_route', 'in_progress'] }
      })
    ]);

    return res.json({
      success: true,
      data: {
        totalBookings,
        activeBookings,
        totalVehicles: fleet.vehicles?.length || 0,
        totalDrivers: fleet.drivers?.length || 0
      }
    });
  } catch (error) {
    console.error('AMBULANCE STATS ERROR:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// 🚑 PROVIDER DASHBOARD ENDPOINTS (AmbulanceFleet)
// ============================================

// ============================================
// GET AMBULANCE PROVIDER PROFILE
// ============================================
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const providerId = req.user.id || req.user._id;

    if (!providerId) {
      return res.status(401).json({
        success: false,
        message: 'Provider ID missing'
      });
    }

    const user = await User.findById(providerId)
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Ambulance provider not found'
      });
    }

    const address = user.ambulanceCompanyAddress || {};
    const settings = user.ambulanceSettings || {};

    const coordinates =
      settings.serviceAreaCoordinates?.center || {};

    const serviceArea =
      settings.serviceArea || '';

    const serviceAreas = serviceArea
      ? serviceArea
          .split(',')
          .map(area => area.trim())
          .filter(Boolean)
      : [];

    return res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name || '',
        phone: user.phone || '',
        email: user.email || '',

        ambulanceCompanyAddress: {
          address: address.line1 || '',
          city: address.city || '',
          coordinates: {
            lat: coordinates.lat ?? '',
            lng: coordinates.lng ?? ''
          }
        },

        ambulanceSettings: {
          operatingHours: {
            open:
              settings.operatingHours?.open ||
              '00:00',

            close:
              settings.operatingHours?.close ||
              '23:59'
          },

          acceptsEmergency:
            settings.acceptsEmergency !== false,

          acceptsScheduled:
            settings.acceptsScheduled !== false,

          acceptsIntercity:
            settings.acceptsIntercity === true
        },

        serviceAreas,

        isAvailable:
          user.ambulanceSettings?.isAvailable === true
      }
    });

  } catch (error) {
    console.error('GET AMBULANCE PROFILE ERROR:', error);
    console.error(error.stack);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// UPDATE AMBULANCE PROVIDER PROFILE
// ============================================
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const providerId = req.user.id || req.user._id;

    if (!providerId) {
      return res.status(401).json({
        success: false,
        message: 'Provider ID missing'
      });
    }

    const {
      name,
      phone,
      email,
      address,
      city,
      lat,
      lng,
      operatingHours,
      acceptsEmergency,
      acceptsScheduled,
      acceptsIntercity,
      serviceAreas,
      isAvailable
    } = req.body;

    const user = await User.findById(providerId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // ==========================================
    // BASIC PROFILE
    // ==========================================

    if (name !== undefined) {
      user.name = String(name).trim();
    }

    if (phone !== undefined) {
      user.phone = String(phone).trim();
    }

    if (email !== undefined) {
      user.email = String(email).trim();
    }

    // ==========================================
    // COMPANY ADDRESS
    // User.js schema uses:
    // line1, line2, city, state, pincode, country
    // ==========================================

    if (!user.ambulanceCompanyAddress) {
      user.ambulanceCompanyAddress = {};
    }

    if (address !== undefined) {
      user.ambulanceCompanyAddress.line1 =
        String(address).trim();
    }

    if (city !== undefined) {
      user.ambulanceCompanyAddress.city =
        String(city).trim();
    }

    // ==========================================
    // AMBULANCE SETTINGS
    // ==========================================

    if (!user.ambulanceSettings) {
      user.ambulanceSettings = {};
    }

    // ==========================================
    // SERVICE AREAS
    // User.js has serviceArea as a String
    // ==========================================

    if (Array.isArray(serviceAreas)) {
      user.ambulanceSettings.serviceArea =
        serviceAreas
          .map(area => String(area).trim())
          .filter(Boolean)
          .join(', ');
    } else if (typeof serviceAreas === 'string') {
      user.ambulanceSettings.serviceArea =
        serviceAreas.trim();
    }

    // ==========================================
    // LATITUDE / LONGITUDE
    // User.js stores these at:
    // ambulanceSettings.serviceAreaCoordinates.center
    // ==========================================

    if (
      (lat !== undefined && lat !== '') ||
      (lng !== undefined && lng !== '')
    ) {
      if (!user.ambulanceSettings.serviceAreaCoordinates) {
        user.ambulanceSettings.serviceAreaCoordinates = {};
      }

      if (!user.ambulanceSettings.serviceAreaCoordinates.center) {
        user.ambulanceSettings.serviceAreaCoordinates.center = {};
      }

      if (lat !== undefined && lat !== '') {
        user.ambulanceSettings
          .serviceAreaCoordinates
          .center
          .lat = Number(lat);
      }

      if (lng !== undefined && lng !== '') {
        user.ambulanceSettings
          .serviceAreaCoordinates
          .center
          .lng = Number(lng);
      }
    }

    // ==========================================
    // OPERATING HOURS
    // ==========================================

    if (operatingHours !== undefined) {
      if (!user.ambulanceSettings.operatingHours) {
        user.ambulanceSettings.operatingHours = {};
      }

      if (operatingHours.open !== undefined) {
        user.ambulanceSettings.operatingHours.open =
          String(operatingHours.open);
      }

      if (operatingHours.close !== undefined) {
        user.ambulanceSettings.operatingHours.close =
          String(operatingHours.close);
      }
    }

    // ==========================================
    // ACCEPT EMERGENCY
    // ==========================================

    if (acceptsEmergency !== undefined) {
      user.ambulanceSettings.acceptsEmergency =
        Boolean(acceptsEmergency);
    }

    // ==========================================
    // ACCEPT SCHEDULED
    // ==========================================

    if (acceptsScheduled !== undefined) {
      user.ambulanceSettings.acceptsScheduled =
        Boolean(acceptsScheduled);
    }

    // ==========================================
    // INTERCITY
    // ==========================================

    if (acceptsIntercity !== undefined) {
      user.ambulanceSettings.acceptsIntercity =
        Boolean(acceptsIntercity);
    }

    // ==========================================
    // AVAILABILITY
    // ==========================================

        if (isAvailable !== undefined) {
      if (!user.ambulanceSettings) {
        user.ambulanceSettings = {};
      }
      user.ambulanceSettings.isAvailable = Boolean(isAvailable);
    }

    // ==========================================
    // SAVE TO MONGODB
    // ==========================================

    await user.save();

    // ==========================================
    // RETURN SAVED PROFILE
    // ==========================================

    const updatedUser = await User.findById(providerId)
      .select('-password');

    console.log(
      '✅ Ambulance provider profile saved:',
      providerId
    );

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });

  } catch (error) {
    console.error('====================================');
    console.error('❌ AMBULANCE PROFILE UPDATE ERROR');
    console.error('Name:', error.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('====================================');

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// UPDATE AMBULANCE PROVIDER LOCATION
// ============================================
router.put('/location', authenticateToken, async (req, res) => {
  try {
    const providerId = req.user.id || req.user._id;

    if (!providerId) {
      return res.status(401).json({
        success: false,
        message: 'Provider ID missing'
      });
    }

    const { lat, lng } = req.body;

    const user = await User.findById(providerId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Ambulance provider not found'
      });
    }

    if (!user.ambulanceSettings) {
      user.ambulanceSettings = {};
    }

    if (!user.ambulanceSettings.serviceAreaCoordinates) {
      user.ambulanceSettings.serviceAreaCoordinates = {};
    }

    if (!user.ambulanceSettings.serviceAreaCoordinates.center) {
      user.ambulanceSettings.serviceAreaCoordinates.center = {};
    }

    if (lat !== undefined && lat !== '') {
      user.ambulanceSettings.serviceAreaCoordinates.center.lat =
        Number(lat);
    }

    if (lng !== undefined && lng !== '') {
      user.ambulanceSettings.serviceAreaCoordinates.center.lng =
        Number(lng);
    }

    await user.save();

    return res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        lat:
          user.ambulanceSettings
            .serviceAreaCoordinates
            .center
            .lat ?? 0,

        lng:
          user.ambulanceSettings
            .serviceAreaCoordinates
            .center
            .lng ?? 0
      }
    });

  } catch (error) {
    console.error('AMBULANCE LOCATION UPDATE ERROR:', error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
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

    const vehicleType = String(req.body.type || 'basic').trim().toLowerCase();

    if (!ALLOWED_VEHICLE_TYPES.includes(vehicleType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ambulance type '${vehicleType}'. Allowed types: ${ALLOWED_VEHICLE_TYPES.join(', ')}`
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

    if (req.body.type !== undefined) {
      const vehicleType = String(req.body.type).trim().toLowerCase();
      if (!ALLOWED_VEHICLE_TYPES.includes(vehicleType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid ambulance type '${vehicleType}'. Allowed types: ${ALLOWED_VEHICLE_TYPES.join(', ')}`
        });
      }
      req.body.type = vehicleType;
    }

    Object.assign(v, req.body);
    fleet.updatedAt = new Date();
    await fleet.save();
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

    const normalizedType = String(type).trim().toLowerCase();
    if (!ALLOWED_VEHICLE_TYPES.includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ambulance type '${normalizedType}'. Allowed types: ${ALLOWED_VEHICLE_TYPES.join(', ')}`
      });
    }

    const user = await User.findById(req.user.id || req.user._id);
    if (!user || user.role !== 'ambulance_provider') return res.status(404).json({ success: false, message: 'Not found' });
    if (user.ambulanceFleet && user.ambulanceFleet.length > 0) {
      user.ambulanceFleet[0].type = normalizedType;
      await user.save();
    }
    const fleet = await AmbulanceFleet.findOne({ ownerType: 'ambulance_provider', ownerId: user._id });
    if (fleet && fleet.vehicles && fleet.vehicles.length > 0) {
      fleet.vehicles[0].type = normalizedType;
      await fleet.save();
    }
    res.json({ success: true, message: `Type set to ${normalizedType}` });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.patch('/fix-type-raw', authenticateToken, async (req, res) => {
  try {
    const { type } = req.body;
    if (!type) return res.status(400).json({ success: false, message: 'Type required' });

    const normalizedType = String(type).trim().toLowerCase();
    if (!ALLOWED_VEHICLE_TYPES.includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ambulance type '${normalizedType}'. Allowed types: ${ALLOWED_VEHICLE_TYPES.join(', ')}`
      });
    }

    const result = await User.updateOne(
      { _id: req.user.id || req.user._id, 'ambulanceFleet._id': req.body.fleetId || { $exists: true } },
      { $set: { 'ambulanceFleet.$[elem].type': normalizedType } },
      { arrayFilters: [{ 'elem._id': { $exists: true } }] }
    );
    res.json({ success: true, matched: result.matchedCount, modified: result.modifiedCount });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ============================================
// SEARCH AVAILABLE AMBULANCES (DATABASE + CACHE)
// ============================================
router.get('/search', async (req, res) => {
  try {
    const { lat, lng, city, type, radius = 25, limit = 20 } = req.query;

    let results = [];

    // 1. Search AmbulanceFleet for available vehicles
    const fleetQuery = {
      'vehicles.status': 'available'
    };
    
    if (city) {
      fleetQuery.city = { $regex: city, $options: 'i' };
    }

    const fleets = await AmbulanceFleet.find(fleetQuery)
      .populate('ownerId', 'name phone email ambulanceCompanyAddress ambulanceSettings')
      .limit(parseInt(limit));

    for (const fleet of fleets) {
      const availableVehicles = fleet.vehicles.filter(v => v.status === 'available');
      
      for (const vehicle of availableVehicles) {
        // Get provider location from User model
        const provider = await User.findById(fleet.ownerId).select('ambulanceCompanyAddress ambulanceSettings.serviceAreaCoordinates ambulanceSettings.isAvailable');
        
                if (!provider || !provider.ambulanceSettings?.isAvailable) continue;

        const providerLat = provider.ambulanceSettings?.serviceAreaCoordinates?.center?.lat || provider.ambulanceCompanyAddress?.coordinates?.lat;
        const providerLng = provider.ambulanceSettings?.serviceAreaCoordinates?.center?.lng || provider.ambulanceCompanyAddress?.coordinates?.lng;

        // Calculate distance if coordinates available
        let distance = null;
        if (lat && lng && providerLat && providerLng) {
          const R = 6371;
          const dLat = (providerLat - parseFloat(lat)) * Math.PI / 180;
          const dLng = (providerLng - parseFloat(lng)) * Math.PI / 180;
          const a = Math.sin(dLat/2) ** 2 + Math.cos(parseFloat(lat) * Math.PI/180) * Math.cos(providerLat * Math.PI/180) * Math.sin(dLng/2) ** 2;
          distance = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 100) / 100;
        }

        // Filter by type if specified
        if (type && type !== 'all' && vehicle.type !== type) continue;

        // Filter by radius if coordinates available
        if (distance !== null && distance > parseFloat(radius)) continue;

        results.push({
          providerId: fleet.ownerId,
          providerName: fleet.providerName,
          providerPhone: fleet.contactPhone,
          vehicleId: vehicle._id,
          vehicleNumber: vehicle.vehicleNumber,
          vehicleType: vehicle.type,
          driverName: vehicle.driverName || 'Not assigned',
          driverPhone: vehicle.driverPhone || '',
          equipment: vehicle.equipment || [],
          baseFare: vehicle.baseFare || 0,
          perKmRate: vehicle.perKmRate || 0,
          nightCharge: vehicle.nightCharge || 0,
          waitingCharge: vehicle.waitingCharge || 0,
          distance: distance,
          estimatedETA: distance ? Math.round(distance * 2) : null,
          providerLat,
          providerLng,
          status: 'available'
        });
      }
    }

    // 2. Also check locationCache for live drivers
    if (lat && lng) {
      try {
        const liveDrivers = await locationCache.ambulance.findNearbyDrivers(
          parseFloat(lat), parseFloat(lng), parseFloat(radius), {
            limit: parseInt(limit),
            requireAvailable: true
          }
        );

        for (const driver of liveDrivers) {
          // Check if already in results
          const exists = results.find(r => 
            r.vehicleId?.toString() === driver.vehicleId?.toString()
          );
          if (!exists) {
            results.push({
              driverId: driver.driverId,
              vehicleType: driver.vehicleType || 'basic',
              distance: driver.distance,
              estimatedETA: Math.round(driver.distance * 2),
              rating: driver.rating || 0,
              status: 'live'
            });
          }
        }
      } catch (cacheErr) {
        console.log('Location cache search skipped:', cacheErr.message);
      }
    }

    // Sort by distance
    results.sort((a, b) => (a.distance || 999) - (b.distance || 999));

    res.json({
      success: true,
      count: results.length,
      data: results.slice(0, parseInt(limit))
    });

  } catch (error) {
    console.error('Ambulance search error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;// fix 

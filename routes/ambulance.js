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
const ALLOWED_VEHICLE_TYPES = ['basic', 'bls', 'als', 'cardiac', 'ventilator', 'neonatal', 'air', 'bike', 'mortuary', 'ptv', 'wheelchair'];
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

    // Try dispatch service first
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
            name: result.driver?.name || result.driver?.driverName || result.booking?.driverName || 'Assigned',
            phone: result.driver?.phone || result.driver?.driverPhone || result.booking?.driverPhone || 'N/A',
            vehicleNumber: result.driver?.vehicleNumber || result.booking?.vehicleNumber || 'N/A',
            rating: result.driver?.rating || result.driver?.driverRating || 0
          },
          trackingUrl: result.trackingUrl,
          tripOtp: result.booking.tripOtp,
          fareEstimate: {
            baseFare: result.fareEstimate?.breakdown?.baseFare || 0,
            perKmRate: result.fareEstimate?.breakdown?.perKmRate || 0,
            total: result.fareEstimate?.total || 0,
            breakdown: result.fareEstimate?.breakdown || {}
          }
        }
      });
    }

        // Fallback: Find nearest available ambulance from AmbulanceFleet
    const fleets = await AmbulanceFleet.find({ 'vehicles.status': 'available' });
    
    let nearestVehicle = null;
    let nearestProvider = null;
    let minDistance = Infinity;

    for (const fleet of fleets) {
      const provider = await User.findById(fleet.ownerId);
      if (!provider?.ambulanceSettings?.isAvailable) continue;

      const availableVehicles = fleet.vehicles.filter(v => 
        v.status === 'available' && 
        Number(v.baseFare) > 0 && 
        Number(v.perKmRate) > 0
      );
      if (availableVehicles.length === 0) continue;
      
      const providerLat = provider.ambulanceSettings?.serviceAreaCoordinates?.center?.lat || provider.ambulanceCompanyAddress?.coordinates?.lat;
      const providerLng = provider.ambulanceSettings?.serviceAreaCoordinates?.center?.lng || provider.ambulanceCompanyAddress?.coordinates?.lng;
      
      if (!providerLat || !providerLng) continue;
      
      const distance = Math.sqrt(
        Math.pow(providerLat - parseFloat(pickupLat), 2) + 
        Math.pow(providerLng - parseFloat(pickupLng), 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestProvider = provider;
        nearestVehicle = availableVehicles.find(v => v.status === 'available');
      }
    }

    if (!nearestVehicle || !nearestProvider) {
      return res.status(200).json({
        success: false,
        reason: 'no_vehicle_available',
        message: 'No ambulance available. Please call 108.'
      });
    }

    const bookingId = 'EMG' + Date.now();
    const tripOtp = Math.floor(1000 + Math.random() * 9000);

    try {
      const emergencyBooking = new Booking({
        bookingId,
        userId: userId || 'guest',
        bookingType: 'ambulance_emergency',
        appointmentDate: new Date(),
        emergencyType: 'blitz',
        patientName: patientName || 'Emergency Patient',
        patientPhone,
        pickupAddress: pickupAddress || 'GPS Location',
        pickupCoordinates: { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) },
        vehicleNumber: nearestVehicle.vehicleNumber,
        driverName: nearestVehicle.driverName || nearestProvider.name,
        driverPhone: nearestVehicle.driverPhone || nearestProvider.phone,
        providerId: nearestProvider._id,
        providerName: nearestProvider.name,
        vehicleId: nearestVehicle._id,
        status: 'confirmed',
        tripOtp,
        location: { type: 'Point', coordinates: [parseFloat(pickupLng), parseFloat(pickupLat)] },
        originalAmount: Number(nearestVehicle.baseFare) || 0,
        finalAmount: Number(nearestVehicle.baseFare) || 0,
        emergencyRequestedAt: new Date(),
        createdAt: new Date()
      });
      await emergencyBooking.save();
      
      // Emit socket event to driver
            // Emit socket event to driver using socket utility
      try {
        const io = req.app.get('io');
        const socketUtils = require('../socket/ambulanceSocket');
        
        if (io && socketUtils) {
          const driverId = nearestVehicle._id.toString();
          const emergencyData = {
            bookingId,
            patientName: patientName || 'Emergency Patient',
            patientCondition: patientCondition || 'Emergency',
            pickupAddress: pickupAddress || 'GPS Location',
            distance: Math.round(minDistance * 10) / 10,
            estimatedFare: Number(nearestVehicle.baseFare) || 0,
            tripOtp
          };
          
          // Try direct socket emit first
          const sent = socketUtils.sendEmergencyToDriver(io, driverId, emergencyData);
          
          if (sent) {
            console.log(`📡 Emergency alert sent directly to driver ${driverId}`);
          } else {
            // Fallback: emit to room
            io.to(`driver:${driverId}`).emit('emergency:new_request', emergencyData);
            console.log(`📡 Emergency alert emitted to driver room: driver:${driverId}`);
          }
        }
      } catch (socketError) {
        console.error('Socket emit failed:', socketError.message);
      }
      
    } catch (saveError) {
      console.error('Emergency booking save failed:', saveError);
    }

    return res.status(200).json({
      success: true,
      message: 'Ambulance dispatched from fleet',
      data: {
        bookingId,
        driver: {
          name: nearestVehicle.driverName || nearestProvider.name || 'Driver',
          phone: nearestVehicle.driverPhone || nearestProvider.phone || 'N/A',
          vehicleNumber: nearestVehicle.vehicleNumber,
          rating: 4.5
        },
        tripOtp,
        fareEstimate: {
          baseFare: Number(nearestVehicle.baseFare) || 0,
          perKmRate: Number(nearestVehicle.perKmRate) || 0
        }
      }
    });

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

// Cancel scheduled ambulance booking
router.put('/cancel-booking/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const booking = await Booking.findOne({ bookingId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    
    booking.status = 'cancelled';
    booking.cancellation = {
      reason: reason || 'Cancelled by patient',
      cancelledAt: new Date(),
      refundAmount: 0,
      refundPercentage: 0,
      refundStatus: 'not_applicable'
    };

    // If payment was made, process refund
    if (booking.paymentStatus === 'paid' && booking.paymentId) {
      try {
        const Razorpay = require('razorpay');
        const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET
        });
        
         // Get actual captured amount from transaction
        const Transaction = require('../models/Transaction');
        const transaction = await Transaction.findOne({ paymentId: booking.paymentId });
        const refundableAmount = transaction?.netAmount || booking.finalAmount || 0;
        
        const refund = await razorpay.payments.refund(booking.paymentId, {
          amount: Math.round(refundableAmount * 100)
        });
        
        booking.paymentStatus = 'refunded';
        booking.refundId = refund.id;
        booking.refundAmount = booking.finalAmount;
        booking.refundedAt = new Date();
        booking.refundStatus = 'processed';
        booking.cancellation.refundAmount = booking.finalAmount;
        booking.cancellation.refundPercentage = 100;
        booking.cancellation.refundStatus = 'processed';
       } catch (refundError) {
        console.error('Refund failed:', JSON.stringify(refundError.error || refundError));
        booking.cancellation.refundStatus = 'failed';
        booking.cancellation.refundError = refundError.error?.description || refundError.message || 'Unknown error';
      }
    }
    
    await booking.save();
    
    res.json({ 
      success: true, 
      message: 'Booking cancelled', 
      data: { 
        refundAmount: booking.cancellation.refundAmount || 0, 
        refundPercentage: booking.cancellation.refundPercentage || 0 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
// Resolve a driver to the authenticated provider's fleet.
async function resolveDriverAssignment(driverId, reqUser = {}) {
  const id = String(driverId || reqUser.driverId || '').trim();
  if (!id) return null;
  const authUserId = reqUser.id || reqUser._id || reqUser.userId;
  let providerUser = null;
  if (authUserId) {
    providerUser = await User.findOne({ _id: authUserId, 'ambulanceDrivers.driverId': id }).lean();
  }
  if (!providerUser) {
    providerUser = await User.findOne({ 'ambulanceDrivers.driverId': id }).lean();
  }
  if (!providerUser) return null;
  const driver = (providerUser.ambulanceDrivers || []).find(d => String(d.driverId || '') === id);
  if (!driver) return null;
  const fleet = await AmbulanceFleet.findOne({
    ownerType: 'ambulance_provider', ownerId: providerUser._id, isActive: true
  });
  let vehicle = null;
  if (fleet) {
    const assigned = String(driver.assignedVehicle || '').trim();
    if (assigned) {
      vehicle = fleet.vehicles.id(assigned);
      if (!vehicle) vehicle = fleet.vehicles.find(v => String(v.vehicleNumber || '').trim().toLowerCase() === assigned.toLowerCase());
    }
    if (!vehicle && driver.name) {
      vehicle = fleet.vehicles.find(v => String(v.driverName || '').trim().toLowerCase() === String(driver.name || '').trim().toLowerCase());
    }
  }
  return { providerUser, driver, providerId: String(providerUser._id), fleet, vehicle };
}

// POST /ambulance/update-location
// 📍 Driver GPS update
// ─────────────────────────────────────────────
router.post('/update-location', authenticateToken, async (req, res) => {
  try {
    const { lat, lng, speed, heading, isAvailable, isOnTrip, tripId } = req.body;
    
    let driverId;
    let assignment = null;
    
    if (req.user.role === 'ambulance_driver') {
      driverId = String(req.user.driverId || '');
      if (!driverId) return res.status(400).json({ success: false, error: 'Driver ID missing in token' });
    } else {
      driverId = String(req.body.driverId || req.user.driverId || '').trim();
      if (!driverId) return res.status(400).json({ success: false, error: 'Driver ID required' });
      assignment = await resolveDriverAssignment(driverId, req.user);
      if (!assignment) return res.status(403).json({ success: false, error: 'Driver is not registered under the authenticated provider' });
    }

    const numericLat = Number(lat);
    const numericLng = Number(lng);
    if (!Number.isFinite(numericLat) || !Number.isFinite(numericLng) || numericLat < -90 || numericLat > 90 || numericLng < -180 || numericLng > 180) {
      return res.status(400).json({ success: false, error: 'Valid coordinates required' });
    }

    const vehicleType = assignment?.vehicle?.type || req.body.vehicleType || 'basic';
    const providerId = assignment?.providerId || req.user.id || '';
    
    await locationCache.ambulance.updateDriverLocation(driverId, numericLat, numericLng, {
      speed: Number(speed || 0), heading: Number(heading || 0),
      isAvailable: isAvailable !== false, isOnTrip: isOnTrip === true,
      tripId: tripId || '', vehicleType, providerId
    });

    return res.json({
      success: true, message: 'Location updated',
      data: { driverId, providerId, vehicleId: assignment?.vehicle?._id || null, vehicleNumber: assignment?.vehicle?.vehicleNumber || '', vehicleType, lat: numericLat, lng: numericLng }
    });
  } catch (error) {
    console.error('AMBULANCE LOCATION UPDATE ERROR:', error);
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
    // Simple surge calculation - no external service dependency
    const hour = new Date().getHours();
    const isPeakHour = (hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21);
    const surgeMultiplier = isPeakHour ? 1.5 : 1.0;
    return res.json({ success: true, data: { surgeMultiplier, isPeakHour } });
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

      // Existing provider data stores driverId on User and driverName on the vehicle.
      if (!vehicle && driver.driverId) {
        const owner = await User.findOne({ _id: driver.providerId, 'ambulanceDrivers.driverId': driver.driverId }).select('ambulanceDrivers').lean();
        const driverRecord = owner?.ambulanceDrivers?.find(d => String(d.driverId || '') === String(driver.driverId));
        if (driverRecord?.name) {
          vehicle = fleet.vehicles.find(v => String(v.driverName || '').trim().toLowerCase() === String(driverRecord.name).trim().toLowerCase() && v.status === 'available');
        }
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
  isActive: true
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
      tripOtp: Math.floor(1000 + Math.random() * 9000).toString(),

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

      driverId: vehicle._id,

      pickupAddress,

      pickupCoordinates: {
        lat: patientLat,
        lng: patientLng
      },

      location: {
        type: 'Point',
        coordinates: [patientLng, patientLat]
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

    // Auto-assign driver and send alert immediately after booking
    try {
      const drivers = await locationCache.ambulance.findNearbyDrivers(
        patientLat,
        patientLng,
        50,
        { limit: 5, requireAvailable: true }
      );
      
      const matchedDriver = drivers.find(d => d.driverId === vehicle._id?.toString()) || drivers[0];
      
      if (matchedDriver) {
        booking.driverId = matchedDriver.driverId;
        booking.status = 'driver_assigned';
        booking.driverAcceptedAt = new Date();
        await booking.save();
        
        const io = req.app.get('io') || global.io;
        if (io) {
          io.to(`driver:${matchedDriver.driverId}`).emit('scheduled:new_request', {
            bookingId: booking.bookingId,
            patientName: booking.patientName,
            pickupAddress: booking.pickupAddress,
            dropAddress: booking.dropAddress || booking.hospitalDestination?.address,
            scheduledDate: booking.appointmentDate,
            amount: booking.finalAmount,
            vehicleType: booking.ambulanceType,
            paymentStatus: 'pending'
          });
          console.log(`📡 Scheduled trip alert sent at booking creation to driver ${matchedDriver.driverId}`);
        }
      }
    } catch (assignError) {
      console.error('Driver assignment at booking failed:', assignError.message);
    }

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

        tripOtp:
          booking.tripOtp,

        driver: {
          name: vehicle.driverName || 'Assigned',
          phone: vehicle.driverPhone || 'N/A',
          vehicleNumber: vehicle.vehicleNumber || 'N/A',
          rating: 0
        },

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

// Driver accepts scheduled trip
router.post('/accept-scheduled/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findOne({ bookingId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    
    booking.status = 'confirmed';
    booking.driverAcceptedAt = new Date();
    await booking.save();
    
    res.json({ success: true, message: 'Trip accepted', data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Driver declines scheduled trip
router.post('/decline-scheduled/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findOne({ bookingId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    
    booking.status = 'pending';
    booking.driverId = null;
    booking.driverAcceptedAt = null;
    await booking.save();
    
     const drivers = await locationCache.ambulance.findNearbyDrivers(
      booking.pickupCoordinates?.lat,
      booking.pickupCoordinates?.lng,
      50,
      { limit: 5, requireAvailable: true }
    );
    
    const nextDriver = drivers.length > 1 ? drivers[1] : null;
    
    if (nextDriver) {
      booking.driverId = nextDriver.driverId;
      booking.status = 'driver_assigned';
      await booking.save();
      
      const io = req.app.get('io') || global.io;
      if (io) {
        io.to(`driver:${nextDriver.driverId}`).emit('scheduled:new_request', {
          bookingId: booking.bookingId,
          patientName: booking.patientName,
          pickupAddress: booking.pickupAddress,
          dropAddress: booking.dropAddress || booking.hospitalDestination?.address,
          scheduledDate: booking.appointmentDate,
          amount: booking.finalAmount,
          vehicleType: booking.ambulanceType
        });
      }
    }
    
    res.json({ success: true, message: 'Trip declined, reassigned to next driver', data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

	// Driver arrived at pickup for scheduled trip
router.post('/start-scheduled/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findOne({ bookingId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    
    booking.status = 'driver_arrived';
    booking.driverReachedAt = new Date();
    await booking.save();
    
    res.json({ success: true, message: 'Driver arrived', data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Patient onboard with OTP for scheduled trip
router.post('/patient-onboard-scheduled/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { otp } = req.body;
    const booking = await Booking.findOne({ bookingId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    
    if (!otp || otp !== booking.tripOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    
    booking.status = 'patient_onboard';
    booking.patientOnboardAt = new Date();
    booking.otpVerified = true;
    await booking.save();
    
    res.json({ success: true, message: 'Patient onboard', data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Complete scheduled trip with earnings
router.post('/complete-scheduled/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { distance, duration } = req.body;
    const booking = await Booking.findOne({ bookingId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    
    booking.status = 'completed';
    booking.completedAt = new Date();
    
    // Calculate earnings
    const totalFare = booking.finalAmount || 0;
    const platformCommission = Math.round(totalFare * 0.15);
    const driverEarnings = totalFare - platformCommission;
    
    booking.driverEarnings = driverEarnings;
    await booking.save();
    
        // Update transaction (create if not exists with proper transactionId)
    const existingTransaction = await Transaction.findOne({ applicationId: bookingId });
    
    if (existingTransaction) {
      existingTransaction.status = 'completed';
      existingTransaction.completedAt = new Date();
      existingTransaction.ambulanceDriverId = booking.driverId;
      existingTransaction.netAmount = driverEarnings;
      existingTransaction.ambulanceCommission = {
        platformCommission,
        driverEarnings
      };
      await existingTransaction.save();
    } else {
      await Transaction.create({
        transactionId: Transaction.generateTransactionId(),
        applicationId: bookingId,
        status: 'completed',
        completedAt: new Date(),
        ambulanceDriverId: booking.driverId,
        amount: totalFare,
        originalAmount: totalFare,
        netAmount: driverEarnings,
        ambulanceCommission: {
          platformCommission,
          driverEarnings
        }
      });
    }
    
    res.json({ success: true, message: 'Trip completed', data: booking, driverEarnings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    const user = await User.findById(req.user.id || req.user._id);
    const userPhone = user?.phone || '';
    const userPhoneAlt = userPhone.replace('+91', '');

    const query = {
      $or: [
        { userId: req.user.userId || req.user.id },
        { patientPhone: userPhone },
        { patientPhone: userPhoneAlt }
      ],
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

// Submit rating for completed ambulance trip
router.post('/rate-trip/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { rating, review, waitTimeRating, valueForMoneyRating } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }
    
    const booking = await Booking.findOne({ bookingId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    
    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Can only rate completed trips' });
    }
    
    if (booking.review?.submittedAt) {
      return res.status(400).json({ success: false, message: 'Rating already submitted' });
    }
    
    booking.review = {
      rating: rating,
      review: review || '',
      staffRating: rating,
      waitTimeRating: waitTimeRating || rating,
      valueForMoneyRating: valueForMoneyRating || rating,
      submittedAt: new Date(),
      isVerified: false
    };
    
    await booking.save();
    
    //     // Update driver's average rating
    const allRatedTrips = await Booking.find({
      driverId: booking.driverId,
      status: 'completed',
      'review.submittedAt': { $exists: true }
    });
    
    const avgRating = allRatedTrips.length > 0 
      ? allRatedTrips.reduce((sum, t) => sum + (t.review?.rating || 0), 0) / allRatedTrips.length
      : rating;
    
    res.json({
      success: true,
      message: 'Rating submitted successfully',
      data: {
        bookingId,
        rating,
        driverAvgRating: Math.round(avgRating * 10) / 10
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    let driverId;
    let assignment = null;

    if (req.user.role === 'ambulance_driver') {
      driverId = String(req.query.driverId || req.user.driverId || '');
      if (!driverId) return res.status(400).json({ success: false, error: 'Driver ID missing in token' });
    } else if (req.query.driverId) {
      driverId = String(req.query.driverId).trim();
      if (!driverId) return res.status(400).json({ success: false, error: 'Driver ID required' });
    } else {
      driverId = String(req.query.driverId || req.user.driverId || '').trim();
      if (!driverId) return res.status(400).json({ success: false, error: 'Driver ID required' });
      assignment = await resolveDriverAssignment(driverId, req.user);
      if (!assignment) return res.status(403).json({ success: false, error: 'Driver is not registered under the authenticated provider' });
    }

    // Fetch vehicle details from AmbulanceFleet
    const AmbulanceFleet = require('../models/AmbulanceFleet');
    let vehicleDetails = null;
    let driverDetails = null;
    let providerName = '';

    const fleet = await AmbulanceFleet.findOne({
      'vehicles._id': driverId
    });

    if (fleet) {
      const vehicle = fleet.vehicles.id(driverId);
      if (vehicle) {
        vehicleDetails = {
          _id: vehicle._id,
          vehicleNumber: vehicle.vehicleNumber || '',
          type: vehicle.type || 'basic',
          model: vehicle.model || '',
          year: vehicle.year || '',
          equipment: vehicle.equipment || [],
          baseFare: Number(vehicle.baseFare) || 0,
          perKmRate: Number(vehicle.perKmRate) || 0,
          nightCharge: Number(vehicle.nightCharge) || 0,
          waitingCharge: Number(vehicle.waitingCharge) || 0,
          status: vehicle.status || 'available'
        };
        driverDetails = {
          name: vehicle.driverName || '',
          phone: vehicle.driverPhone || '',
          licenseNumber: vehicle.driverLicense || '',
          experience: vehicle.driverExperience || ''
        };
      }
      providerName = fleet.providerName || '';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date(today);
    monthStart.setDate(monthStart.getDate() - 30);

        const [todayTrips, totalTrips, weekTrips, monthTrips, recentTrips, driverLocation] = await Promise.all([
      Booking.countDocuments({ driverId, bookingType: { $in: ['ambulance', 'ambulance_emergency'] }, status: 'completed', completedAt: { $gte: today, $lt: tomorrow } }),
      Booking.countDocuments({ driverId, bookingType: { $in: ['ambulance', 'ambulance_emergency'] }, status: 'completed' }),
      Booking.countDocuments({ driverId, bookingType: { $in: ['ambulance', 'ambulance_emergency'] }, status: 'completed', completedAt: { $gte: weekStart } }),
      Booking.countDocuments({ driverId, bookingType: { $in: ['ambulance', 'ambulance_emergency'] }, status: 'completed', completedAt: { $gte: monthStart } }),
      Booking.find({ driverId, bookingType: { $in: ['ambulance', 'ambulance_emergency'] }, status: 'completed' }).sort({ completedAt: -1 }).limit(10),
      locationCache.ambulance.getDriverLocation(driverId)
    ]);

    const [todayEarnings, weekEarnings, monthEarnings, totalEarnings] = await Promise.all([
      Transaction.aggregate([
        { $match: { ambulanceDriverId: driverId, status: 'completed', completedAt: { $gte: today, $lt: tomorrow } } },
        { $group: { _id: null, total: { $sum: '$ambulanceCommission.driverEarnings' } } }
      ]),
      Transaction.aggregate([
        { $match: { ambulanceDriverId: driverId, status: 'completed', completedAt: { $gte: weekStart } } },
        { $group: { _id: null, total: { $sum: '$ambulanceCommission.driverEarnings' } } }
      ]),
      Transaction.aggregate([
        { $match: { ambulanceDriverId: driverId, status: 'completed', completedAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$ambulanceCommission.driverEarnings' } } }
      ]),
      Transaction.aggregate([
        { $match: { ambulanceDriverId: driverId, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$ambulanceCommission.driverEarnings' } } }
      ])
    ]);

    const ratedTrips = await Booking.find({
      driverId,
      status: 'completed',
      'review.submittedAt': { $exists: true }
    }).select('review.rating');
    
    const avgRating = ratedTrips.length > 0 
      ? Math.round((ratedTrips.reduce((sum, t) => sum + (t.review?.rating || 0), 0) / ratedTrips.length) * 10) / 10
      : 0;

    return res.json({
      success: true,
      data: {
        driverId,
        driverName: driverDetails?.name || req.user.name || 'Driver',
        driverPhone: driverDetails?.phone || '',
        driverLicense: driverDetails?.licenseNumber || '',
        driverExperience: driverDetails?.experience || '',
        providerName,
        
        vehicle: vehicleDetails,
        vehicleNumber: vehicleDetails?.vehicleNumber || '',
        vehicleType: vehicleDetails?.type || 'basic',
      
        stats: {
          todayTrips,
          totalTrips,
          weekTrips,
          monthTrips,
          todayEarnings: todayEarnings[0]?.total || 0,
          weekEarnings: weekEarnings[0]?.total || 0,
          monthEarnings: monthEarnings[0]?.total || 0,
          totalEarnings: totalEarnings[0]?.total || 0,
          rating: avgRating,
          totalRatings: ratedTrips.length,
          acceptanceRate: 100,
          avgResponseTime: 0
        },
        
        recentTrips,
        currentLocation: driverLocation,
        isOnline: driverLocation?.isAvailable || false
      }
    });
  } catch (error) {
    console.error('DRIVER DASHBOARD ERROR:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /ambulance/driver/toggle-availability
// 👨‍⚕️ Toggle driver online/offline
// ─────────────────────────────────────────────
router.post('/driver/toggle-availability', authenticateToken, async (req, res) => {
  try {
    const { isAvailable } = req.body;
    
    if (req.user.role === 'ambulance_driver') {
      const driverId = String(req.body.driverId || req.user.driverId || '');
      if (!driverId) return res.status(400).json({ success: false, error: 'Driver ID missing in token' });
      await locationCache.ambulance.updateDriverStatus(driverId, { isAvailable });
      return res.json({ success: true, isAvailable });
    }
    
    const driverId = String(req.body.driverId || '').trim();
    if (!driverId) return res.status(400).json({ success: false, error: 'Driver ID required' });
    const assignment = await resolveDriverAssignment(driverId, req.user);
    if (!assignment) return res.status(403).json({ success: false, error: 'Driver not assigned to this provider' });
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
    let driverId;
    
    console.log('TRIP HISTORY REQUEST - Role:', req.user.role, 'DriverId:', req.user.driverId, 'Query:', JSON.stringify(req.query));
    
    if (req.user.role === 'ambulance_driver') {
      driverId = String(req.query.driverId || req.user.driverId || '');
      if (!driverId) return res.status(400).json({ success: false, error: 'Driver ID missing in token' });
    } else {
      driverId = String(req.query.driverId || req.user.driverId || '').trim();
      if (!driverId) return res.status(400).json({ success: false, error: 'Driver ID required' });
      const assignment = await resolveDriverAssignment(driverId, req.user);
      if (!assignment) return res.status(403).json({ success: false, error: 'Driver is not registered under the authenticated provider' });
    }
    
    const { limit = 20, page = 1 } = req.query;
    const trips = await Booking.find({ driverId, bookingType: { $in: ['ambulance', 'ambulance_emergency'] }, status: 'completed' })
      .sort({ completedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Booking.countDocuments({ driverId, status: 'completed' });
    return res.json({ success: true, data: trips, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('TRIP HISTORY ERROR:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Debug: Check driver location in Redis
router.get('/driver/debug-location/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;
    const location = await locationCache.ambulance.getDriverLocation(driverId);
    const nearbyDrivers = await locationCache.ambulance.findNearbyDrivers(21.2153, 79.0797, 50, { limit: 10, requireAvailable: false });
    
    res.json({
      success: true,
      driverId,
      location,
      nearbyDrivers
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ============================================
// 💰 FARE & COMMISSION ENDPOINTS
// ============================================

// GET /ambulance/fare-estimate
router.get('/fare-estimate', async (req, res) => {
  try {
    const { distance, ambulanceType = 'basic', isEmergency = 'false', isNightTime = 'false', providerId } = req.query;
    
    // Get dynamic commission config
    const CommissionConfig = require('../models/CommissionConfig');
    const commissionConfig = await CommissionConfig.getActiveConfig(
      isEmergency === 'true' ? 'ambulance_emergency' : 'ambulance_scheduled',
      providerId
    );
    
    // Provider-set pricing from AmbulanceFleet
    let baseFare = 0;
    let perKmRate = 0;
    
    if (providerId) {
      const fleet = await AmbulanceFleet.findOne({ ownerId: providerId });
      if (fleet) {
        const vehicle = fleet.vehicles.find(v => 
          v.type === ambulanceType && v.status === 'available'
        ) || fleet.vehicles[0];
        if (vehicle) {
          baseFare = Number(vehicle.baseFare) || 0;
          perKmRate = Number(vehicle.perKmRate) || 0;
        }
      }
    }
    
    const distanceKm = parseFloat(distance) || 0;
    const baseTotal = baseFare + (distanceKm * perKmRate);
    
    // Apply commission
    const commission = commissionConfig 
      ? commissionConfig.calculateCommission(baseTotal, { 
          isEmergency: isEmergency === 'true',
          isNightShift: isNightTime === 'true' 
        })
      : { commission: Math.round(baseTotal * 0.15), rate: 15 };
    
    // Platform fee
    const platformFee = commissionConfig 
      ? commissionConfig.calculatePlatformFee(baseTotal, isEmergency === 'true')
      : 0;
    
    const total = baseTotal + commission.commission + platformFee;
    
    res.json({
      success: true,
      data: {
        ambulanceType,
        distanceKm,
        baseFare,
        perKmRate,
        providerAmount: baseTotal,
        commissionRate: commission.rate,
        commissionAmount: commission.commission,
        platformFee,
        estimatedTotal: Math.round(total)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

// Get single ambulance by provider and vehicle
router.get('/vehicle/:providerId/:vehicleId', async (req, res) => {
  try {
    const { providerId, vehicleId } = req.params;
    const fleet = await AmbulanceFleet.findOne({ ownerId: providerId });
    if (!fleet) return res.status(404).json({ success: false, message: 'Provider not found' });
    const vehicle = fleet.vehicles.id(vehicleId);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    res.json({ success: true, data: vehicle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete cancelled bookings older than X days
router.post('/cleanup-bookings', authenticateToken, async (req, res) => {
  try {
    const { days = 30, status = 'cancelled' } = req.body;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const result = await Booking.deleteMany({
      userId: req.user.id || req.user._id,
      status,
      createdAt: { $lt: cutoff }
    });
    
    res.json({ success: true, deleted: result.deletedCount, message: `Deleted ${result.deletedCount} old ${status} bookings` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete specific bookings by IDs
router.post('/delete-bookings', authenticateToken, async (req, res) => {
  try {
    const { bookingIds } = req.body;
    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No bookings selected' });
    }
    
    const result = await Booking.deleteMany({
      bookingId: { $in: bookingIds },
      userId: req.user.id || req.user._id
    });
    
    res.json({ success: true, deleted: result.deletedCount, message: `Deleted ${result.deletedCount} bookings` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get available cities from ambulance providers
router.get('/cities', async (req, res) => {
  try {
    const providers = await User.find({ 
      role: 'ambulance_provider', 
      'ambulanceSettings.isAvailable': true 
    }).select('ambulanceCompanyAddress.city ambulanceSettings.serviceArea');
    
    const cities = new Set();
    providers.forEach(p => {
      const city = p.ambulanceCompanyAddress?.city;
      if (city) cities.add(city.trim());
      const area = p.ambulanceSettings?.serviceArea;
      if (area) area.split(',').forEach(c => cities.add(c.trim()));
    });
    
    res.json({ success: true, data: [...cities].filter(Boolean) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Driver login with phone
router.post('/driver-login', async (req, res) => {
  try {
    const { phone } = req.body;
    const cleanPhone = phone.replace('+91', '');
    
    const fleet = await AmbulanceFleet.findOne({
      'vehicles.driverPhone': { $in: [phone, cleanPhone, `+91${cleanPhone}`] }
    });
    
    if (!fleet) return res.status(404).json({ success: false, message: 'Driver not found' });
    
    const vehicle = fleet.vehicles.find(v => 
      v.driverPhone === phone || v.driverPhone === cleanPhone || v.driverPhone === `+91${cleanPhone}`
    );
    
    if (!vehicle) return res.status(404).json({ success: false, message: 'Driver not found' });
    
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: fleet.ownerId, driverId: vehicle._id, name: vehicle.driverName, role: 'ambulance_driver' },
      process.env.JWT_SECRET || 'hospital_platform_secret_key_2024',
      { expiresIn: '7d' }
    );
    
    res.json({ success: true, token, driver: { id: vehicle._id, name: vehicle.driverName, phone: vehicle.driverPhone } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
    
module.exports = router;

module.exports = router;// fix 

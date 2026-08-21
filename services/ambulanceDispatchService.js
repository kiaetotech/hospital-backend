// D:\hospital backend\services\ambulanceDispatchService.js

// ============================================
// AMBULANCE DISPATCH SERVICE - Multi-Tag Interface
// ============================================

/**
 * Core emergency dispatch logic with interfaces to:
 * 
 * 🏥 Hospitals    - Find nearest ER, check bed availability, notify ER
 * 🛡️ Insurance    - Share insurance card with hospital
 * 👤 Users        - Get patient emergency contacts & medical info
 * 📍 Location     - Find nearby drivers, track locations
 * 💰 Commission   - Calculate emergency commission
 * 📱 Notifications - Send emergency alerts to all parties
 * 📊 Booking      - Create & manage emergency booking records
 */

const Booking = require('../models/Booking');
const mongoose = require('mongoose');
const User = require('../models/User');
const EmergencyContact = require('../models/EmergencyContact');
const Transaction = require('../models/Transaction');
const locationCache = require('./locationCacheService');
const commissionService = require('./commissionService');
const notificationService = require('./notificationService');
const smsService = require('./smsService');

// ============================================
// CONFIGURATION
// ============================================

const DISPATCH_CONFIG = {
  // Search radius (expands if no drivers found)
  initialRadiusKm: 5,
  expandedRadiusKm: 10,
  maxRadiusKm: 25,
  
  // Driver accept window
  driverAcceptTimeout: 15,     // seconds
  maxRetryAttempts: 3,
  
  // Timeouts
  driverArrivalTimeout: 30,    // minutes (driver must arrive within this)
  stuckBookingCheckInterval: 2, // minutes (cron job interval)
  
  // Dispatch strategy
  driversToContact: 5,         // Contact 5 nearest drivers simultaneously
  sortBy: 'distance',          // distance | rating | acceptance_rate
  
  // Fallback
  emergencyFallbackNumber: '108',
  
  // Surge pricing
  surgeThreshold: 3,           // Active emergencies in area before surge
  surgeMultiplierCap: 2.0,     // Maximum surge multiplier
};

// ============================================
// 🚨 MAIN DISPATCH FUNCTION
// ============================================

/**
 * Full emergency dispatch workflow
 * Called when patient clicks emergency button
 */
const dispatchEmergencyAmbulance = async (emergencyData) => {
  const dispatchId = 'DISP_' + Date.now();
  console.log(`🚨 [${dispatchId}] Emergency dispatch initiated`);

  try {
    // ============================================
    // STEP 1: Validate & enrich patient data
    // ============================================
    const patientData = await enrichPatientData(emergencyData);
    
    // ============================================
    // STEP 2: Find nearest hospital with ER & beds
    // ============================================
    const hospitalData = await findDestinationHospital(
      patientData.pickupLat,
      patientData.pickupLng,
      patientData.insuranceInfo
    );
    
    // ============================================
    // STEP 3: Create emergency booking record
    // ============================================
    const booking = await createEmergencyBooking(patientData, hospitalData);
    
    // ============================================
    // STEP 4: Calculate fare estimate
    // ============================================
    const fareEstimate = calculateEmergencyFare(booking, hospitalData, null);
    
    // ============================================
    // STEP 5: Find & dispatch nearest drivers
    // ============================================
    const dispatchResult = await findAndDispatchDrivers(booking, fareEstimate);
    
    if (!dispatchResult.success) {
      // No driver found - notify patient to call 108
      await handleNoDriverFound(booking);
      return { success: false, reason: 'no_driver_available', booking };
    }
    
    // ============================================
    // STEP 6: Notify emergency contacts
    // ============================================
    await notifyEmergencyContacts(booking, dispatchResult.driver);
    
    // ============================================
    // STEP 7: Notify hospital ER
    // ============================================
    await notifyHospitalER(booking, dispatchResult.driver);
    
    // ============================================
    // STEP 8: Share insurance info with hospital
    // ============================================
    await shareInsuranceWithHospital(booking);
    
    // ============================================
    // STEP 9: Create transaction record
    // ============================================
    await createEmergencyTransaction(booking, fareEstimate);
    
    console.log(`✅ [${dispatchId}] Emergency dispatch successful. Driver: ${dispatchResult.driver.driverName}`);
    
    return {
      success: true,
      booking,
      driver: dispatchResult.driver,
      fareEstimate,
      trackingUrl: booking.trackingUrl
    };
    
  } catch (error) {
    console.error(`❌ [${dispatchId}] Dispatch failed:`, error);
    return { success: false, reason: 'system_error', error: error.message };
  }
};

// ============================================
// STEP 1: ENRICH PATIENT DATA
// ============================================

/**
 * Get patient's emergency contacts, medical info, insurance
 * from EmergencyContact model
 */
const enrichPatientData = async (emergencyData) => {
  const {
    userId,
    patientName,
    patientPhone,
    patientAge,
    patientGender,
    pickupLat,
    pickupLng,
    pickupAddress,
    patientCondition = {},
    emergencyType = 'blitz'
  } = emergencyData;

  let emergencyContacts = [];
  let medicalInfo = null;
  let insuranceInfo = null;
  let ambulancePreferences = {};

  // Get emergency profile if user is registered
  if (userId && userId !== 'guest' && mongoose.Types.ObjectId.isValid(userId)) {
    const emergencyProfile = await EmergencyContact.findByUserId(userId);
    
    if (emergencyProfile) {
      // Get contacts filtered for ambulance emergency
      emergencyContacts = emergencyProfile.getContactsForEmergency('ambulance_emergency');
      
      // Get medical info
      medicalInfo = {
        bloodGroup: emergencyProfile.medicalInfo?.bloodGroup,
        allergies: emergencyProfile.medicalInfo?.allergies?.filter(
          a => a.severity === 'severe' || a.severity === 'life_threatening'
        ),
        chronicConditions: emergencyProfile.medicalInfo?.chronicConditions?.filter(
          c => c.severity === 'severe' || c.severity === 'critical'
        ),
        currentMedications: emergencyProfile.medicalInfo?.currentMedications,
        implants: emergencyProfile.medicalInfo?.implants,
        isPregnant: emergencyProfile.medicalInfo?.isPregnant,
        doNotResuscitate: emergencyProfile.medicalInfo?.doNotResuscitate
      };
      
      // Get insurance info
      insuranceInfo = emergencyProfile.insuranceInfo;
      
      // Get ambulance preferences
      ambulancePreferences = emergencyProfile.ambulancePreferences || {};
      
      // Record this emergency
      await emergencyProfile.recordEmergency({
        emergencyType: 'ambulance_emergency',
        location: { lat: pickupLat, lng: pickupLng, address: pickupAddress },
        outcome: 'dispatched'
      });
    }
  }

  return {
    userId,
    patientName,
    patientPhone,
    patientAge,
    patientGender,
    pickupLat,
    pickupLng,
    pickupAddress,
    patientCondition,
    emergencyType,
    emergencyContacts,
    medicalInfo,
    insuranceInfo,
    ambulancePreferences
  };
};

// ============================================
// STEP 2: FIND DESTINATION HOSPITAL
// ============================================

/**
 * Find nearest hospital with emergency department & bed availability
 * Interfaces with: locationCache.hospital
 */
const findDestinationHospital = async (lat, lng, insuranceInfo = null) => {
  console.log(`🏥 Finding nearest hospital with ER near [${lat}, ${lng}]`);
  
  // Try with insurance network first
  let hospitals = [];
  
  if (insuranceInfo?.primaryInsurance?.provider) {
    // TODO: Get insurance ID and search network hospitals
    // For now, search all hospitals with ER
  }
  
  // Search all hospitals with emergency department and beds
  hospitals = await locationCache.hospital.findNearbyHospitals(lat, lng, 20, {
    emergencyOnly: true,
    hasBeds: true,
    limit: 5,
    sortBy: 'beds'  // Prioritize hospitals with more available beds
  });
  
  if (!hospitals || hospitals.length === 0) {
    // Fallback: Any hospital with ER within 50km
    hospitals = await locationCache.hospital.findNearbyHospitals(lat, lng, 50, {
      emergencyOnly: true,
      limit: 3,
      sortBy: 'distance'
    });
  }
  
    if (!hospitals || hospitals.length === 0) {
    // Fallback: Use generic hospital destination
    return {
      hospitalId: null,
      hospitalName: 'Nearest Hospital',
      address: 'To be determined',
      phone: '',
      coordinates: {
        lat: lat,
        lng: lng
      },
      distance: 5,
      bedAvailability: {
        general: 0,
        icu: 0,
        ventilator: 0
      },
      emergencyDepartment: 'Emergency Department'
    };
  }
  
  const selectedHospital = hospitals[0];
  
  console.log(`✅ Selected hospital: ${selectedHospital.name} (${selectedHospital.distance}km, ${selectedHospital.availableBeds} beds)`);
  
  return {
    hospitalId: selectedHospital.hospitalId,
    hospitalName: selectedHospital.name,
    address: selectedHospital.address,
    phone: selectedHospital.phone,
    coordinates: {
      lat: selectedHospital.lat,
      lng: selectedHospital.lng
    },
    distance: selectedHospital.distance,
    bedAvailability: {
      general: selectedHospital.availableBeds || 0,
      icu: selectedHospital.icuBeds || 0,
      ventilator: selectedHospital.ventilatorBeds || 0
    },
    emergencyDepartment: selectedHospital.emergencyDepartment || 'Emergency Department'
  };
};

// ============================================
// STEP 3: CREATE EMERGENCY BOOKING
// ============================================

/**
 * Create booking record in database
 * Interfaces with: Booking model
 */
const createEmergencyBooking = async (patientData, hospitalData) => {
  const bookingData = {
    userId: patientData.userId || 'guest',
    bookingType: 'ambulance_emergency',
    patientName: patientData.patientName,
    patientPhone: patientData.patientPhone,
    patientAge: patientData.patientAge,
    patientGender: patientData.patientGender,
    
    // Emergency specific
    emergencyType: 'blitz',
    patientCondition: patientData.patientCondition,
    
    // Location
    pickupAddress: patientData.pickupAddress,
    pickupCoordinates: {
      lat: patientData.pickupLat,
      lng: patientData.pickupLng
    },
    location: {
      type: 'Point',
      coordinates: [patientData.pickupLng, patientData.pickupLat]
    },
    
    // Hospital
    hospitalDestination: hospitalData,
    
    // Emergency contacts
    emergencyContacts: patientData.emergencyContacts?.map(c => ({
      name: c.name,
      phone: c.phone,
      relationship: c.relationship,
      notified: false
    })) || [],
    
    // Medical info
    medicalInfo: patientData.medicalInfo,
    insuranceInfo: patientData.insuranceInfo,
    
    // Initial values
    originalAmount: 0,  // Will be calculated after trip
    finalAmount: 0,
    appointmentDate: new Date(),
    status: 'pending',
    priority: 'emergency',
    
    // Tracking
    trackingUrl: `${process.env.FRONTEND_URL || 'https://hospital-frontend-kiaeto.vercel.app'}/ambulance/tracking/`,
    
    createdAt: new Date()
  };

  const booking = new Booking(bookingData);
  await booking.save();
  
  // Update tracking URL with actual booking ID
  booking.trackingUrl += booking.bookingId;
  await booking.save();
  
  console.log(`📋 Emergency booking created: ${booking.bookingId}`);
  
  return booking;
};

// ============================================
// STEP 4: CALCULATE EMERGENCY FARE
// ============================================

/**
 * Calculate fare estimate before dispatch
 * Interfaces with: commissionService
 */
const calculateEmergencyFare = (booking, hospitalData, vehicle = null) => {
  const distance = hospitalData.distance || 5;
  const isNightTime = isNightTimeNow();
  const surgeMultiplier = 1.0;
  
  // Use provider pricing if available, otherwise defaults
  const baseFare = vehicle?.baseFare || 500;
  const perKmRate = vehicle?.perKmRate || 30;
  const nightCharge = vehicle?.nightCharge || 0;
  
  const distanceCharge = distance * perKmRate;
  const appliedNightCharge = isNightTime ? nightCharge : 0;
  const surgeCharge = (baseFare + distanceCharge) * (surgeMultiplier - 1);
  const total = baseFare + distanceCharge + appliedNightCharge + surgeCharge;
  
  const fareEstimate = {
    breakdown: {
      baseFare,
      distance: Math.round(distance * 10) / 10,
      perKmRate,
      distanceCharge: Math.round(distanceCharge),
      nightCharge: Math.round(appliedNightCharge),
      surgeMultiplier,
      surgeCharge: Math.round(surgeCharge),
      total: Math.round(total)
    },
    total: Math.round(total)
  };
  
  // Use correct production commission function
  const commission = commissionService.calculateAmbulanceCommission({
    amount: total,
    providerId: booking.providerId || null,
    emergencyType: 'blitz',
    isNightTime,
    isLongDistance: distance > 50
  });
  
  return {
    ...fareEstimate,
    commission,
    platformFee: 0,
    total: Math.round(total)
  };
};

// ============================================
// STEP 5: FIND & DISPATCH DRIVERS
// ============================================

/**
 * Find nearest available drivers and dispatch
 * Interfaces with: locationCache.ambulance
 */
const findAndDispatchDrivers = async (booking, fareEstimate) => {
  console.log(`🔍 Searching for drivers near [${booking.pickupCoordinates.lat}, ${booking.pickupCoordinates.lng}]`);
  
  let radius = DISPATCH_CONFIG.initialRadiusKm;
  let retryCount = 0;
  let driverFound = null;
  
  while (retryCount < DISPATCH_CONFIG.maxRetryAttempts && !driverFound) {
    // Find nearby drivers
    const drivers = await locationCache.ambulance.findNearbyDrivers(
      booking.pickupCoordinates.lat,
      booking.pickupCoordinates.lng,
      radius,
      {
        vehicleType: booking.ambulanceType || 'any',
        limit: DISPATCH_CONFIG.driversToContact,
        requireAvailable: true
      }
    );
    
    console.log(`   Attempt ${retryCount + 1}: Found ${drivers.length} drivers within ${radius}km`);
    
    if (drivers.length === 0) {
      radius = Math.min(radius * 2, DISPATCH_CONFIG.maxRadiusKm);
      retryCount++;
      continue;
    }
    
    // Contact drivers simultaneously
    driverFound = await contactDrivers(booking, drivers, fareEstimate);
    
    if (!driverFound) {
      radius = Math.min(radius * 2, DISPATCH_CONFIG.maxRadiusKm);
      retryCount++;
    }
  }
  
  if (!driverFound) {
    return { success: false, reason: 'No driver accepted' };
  }
  
  // Update booking with driver info
  booking.driverId = driverFound.driverId;
  booking.driverName = driverFound.name || driverFound.driverName;
  booking.driverPhone = driverFound.phone || driverFound.driverPhone;
  booking.driverRating = driverFound.rating || 0;
  booking.vehicleNumber = driverFound.vehicleNumber;
  booking.vehicleType = driverFound.vehicleType;
  booking.status = 'driver_assigned';
  booking.driverAcceptedAt = new Date();
  booking.dispatchAttempts = retryCount + 1;
  booking.dispatchRadius = radius;
  
  await booking.save();
  
  // Mark driver as on trip in location cache
  await locationCache.ambulance.setDriverOnTrip(driverFound.driverId, booking.bookingId);
  
  // Notify patient
  await notificationService.sendDriverAcceptedAlert(booking);
  await smsService.sendAmbulanceSMS(booking.patientPhone, 'emergency_driver_accepted', {
    driverName: driverFound.name,
    vehicleNumber: driverFound.vehicleNumber,
    vehicleType: driverFound.vehicleType,
    eta: Math.round(driverFound.distance * 2), // ~2 min per km
    trackingUrl: booking.trackingUrl,
    otp: booking.tripOtp,
    bookingId: booking.bookingId
  });
  
  return { success: true, driver: driverFound };
};

/**
 * Contact drivers one by one with 15-second accept window
 */
const contactDrivers = async (booking, drivers, fareEstimate) => {
  for (const driver of drivers) {
    console.log(`   📞 Contacting driver: ${driver.driverId} (${driver.distance}km)`);
    
    // Add to contacted list
    booking.driversContacted.push({
      driverId: driver.driverId,
      driverName: driver.name || 'Unknown',
      accepted: false,
      responseTime: 0
    });
    
    // Send emergency alert to driver
    const alertSent = await smsService.sendDriverDispatchSMS(driver.phone || driver.driverPhone, {
      bookingId: booking.bookingId,
      patientName: booking.patientName,
      patientCondition: booking.patientCondition?.chiefComplaint || 'Emergency',
      pickupAddress: booking.pickupAddress,
      distance: driver.distance,
      eta: Math.round(driver.distance * 2),
      estimatedFare: fareEstimate.total,
      surgeMultiplier: fareEstimate.surgeMultiplier || 1.0,
      surgeMessage: fareEstimate.surgeMultiplier > 1 ? `⚠️ Surge: ${fareEstimate.surgeMultiplier}x` : ''
    });
    
    // Send push notification with loud alert
    await notificationService.sendDriverEmergencyAlert(driver.phone, {
      bookingId: booking.bookingId,
      patientName: booking.patientName,
      patientCondition: booking.patientCondition?.chiefComplaint || 'Emergency',
      pickupAddress: booking.pickupAddress,
      distance: driver.distance,
      eta: Math.round(driver.distance * 2),
      estimatedFare: fareEstimate.total,
      surgeMultiplier: fareEstimate.surgeMultiplier || 1.0
    });
    
    // In production: Wait for driver to accept via WebSocket
    // For now: Auto-accept the first available driver
    // TODO: Implement real-time accept/reject via WebSocket
    
    // Simulate: Driver accepts (in real system, this comes from WebSocket)
    const driverAccepted = true; // Placeholder
    
    if (driverAccepted) {
      // Update contacted list
      const contacted = booking.driversContacted[booking.driversContacted.length - 1];
      contacted.accepted = true;
      contacted.responseTime = 3; // seconds
      
      return driver;
    }
  }
  
  return null;
};

// ============================================
// STEP 6: NOTIFY EMERGENCY CONTACTS
// ============================================

/**
 * Send SMS to all emergency contacts
 * Interfaces with: smsService, notificationService
 */
const notifyEmergencyContacts = async (booking, driver) => {
  const contacts = booking.emergencyContacts || [];
  
  if (contacts.length === 0) {
    console.log('   No emergency contacts to notify');
    return;
  }
  
  console.log(`   📢 Notifying ${contacts.length} emergency contacts...`);
  
  const emergencyData = {
    patientName: booking.patientName,
    ambulanceType: booking.vehicleType || 'Emergency',
    vehicleNumber: booking.vehicleNumber,
    driverName: booking.driverName,
    driverPhone: booking.driverPhone,
    eta: Math.round((driver.distance || 5) * 2),
    trackingUrl: booking.trackingUrl,
    hospitalName: booking.hospitalDestination?.hospitalName || 'Nearest hospital'
  };
  
  // Send to each contact
  const results = await smsService.sendEmergencyContactsSMS(
    contacts.filter(c => c.phone),
    emergencyData
  );
  
  // Mark contacts as notified in booking
  booking.emergencyContacts = contacts.map(c => ({
    ...c,
    notified: true,
    notifiedAt: new Date()
  }));
  await booking.save();
  
  // Also update EmergencyContact model if user is registered
  if (booking.userId && booking.userId !== 'guest') {
    const emergencyProfile = await EmergencyContact.findByUserId(booking.userId);
    if (emergencyProfile) {
      const contactIds = contacts.map(c => c._id).filter(Boolean);
      await emergencyProfile.markContactsNotified(contactIds);
    }
  }
  
  return results;
};

// ============================================
// STEP 7: NOTIFY HOSPITAL ER
// ============================================

/**
 * Alert hospital emergency department
 * Interfaces with: smsService, notificationService, locationCache.hospital
 */
const notifyHospitalER = async (booking, driver) => {
  const hospital = booking.hospitalDestination;
  if (!hospital) return;
  
  console.log(`   🏥 Notifying ${hospital.hospitalName} ER...`);
  
  // Get hospital details for phone/email
  const hospitalDetails = await locationCache.hospital.getHospitalDetails(hospital.hospitalId);
  
  const emergencyData = {
    bookingId: booking.bookingId,
    patientName: booking.patientName,
    patientAge: booking.patientAge,
    patientGender: booking.patientGender,
    chiefComplaint: booking.patientCondition?.chiefComplaint || 'Emergency',
    patientCondition: `${booking.patientCondition?.isBreathing ? 'Breathing' : 'NOT BREATHING'}, ${booking.patientCondition?.isConscious ? 'Conscious' : 'UNCONSCIOUS'}`,
    ambulanceType: booking.vehicleType,
    vehicleNumber: booking.vehicleNumber,
    eta: Math.round((driver.distance || 5) * 2),
    driverPhone: booking.driverPhone,
    vitals: booking.digitalTripSheet?.vitals || null,
    insuranceProvider: booking.insuranceInfo?.primaryInsurance?.provider || 'None',
    insurancePolicyNumber: booking.insuranceInfo?.primaryInsurance?.policyNumber || 'N/A'
  };
  
  // Send SMS to hospital
  if (hospitalDetails?.phone) {
    await smsService.sendHospitalERAlertSMS(hospitalDetails.phone, emergencyData);
  }
  
  // Send email notification
  if (hospitalDetails?.email) {
    await notificationService.sendHospitalERNotification(
      hospitalDetails.phone,
      hospitalDetails.email,
      emergencyData
    );
  }
  
  // Mark hospital as notified
  booking.hospitalNotified = true;
  booking.hospitalNotificationTime = new Date();
  await booking.save();
  
  console.log(`   ✅ Hospital ER notified`);
};

// ============================================
// STEP 8: SHARE INSURANCE WITH HOSPITAL
// ============================================

/**
 * Share patient's insurance card with hospital
 * Interfaces with: EmergencyContact model
 */
const shareInsuranceWithHospital = async (booking) => {
  if (!booking.insuranceInfo?.primaryInsurance?.provider) {
    console.log('   No insurance to share');
    return;
  }
  
  booking.insuranceCardShared = true;
  await booking.save();
  
  console.log(`   🛡️ Insurance info shared with hospital`);
};

// ============================================
// STEP 9: CREATE TRANSACTION
// ============================================

/**
 * Create payment transaction record
 * Interfaces with: Transaction model
 */
const createEmergencyTransaction = async (booking, fareEstimate) => {
  const transaction = new Transaction({
    transactionId: 'TXN_AMB_' + Date.now(),
    applicationId: booking.bookingId,
    lenderId: 'platform',
    type: 'ambulance_emergency',
    bookingType: 'ambulance_emergency',
    bookingId: booking._id,
    userId: booking.userId,
    
    amount: fareEstimate.total,
    originalAmount: fareEstimate.total,
    netAmount: fareEstimate.total,
    
    ambulanceId: booking.driverId,
    ambulanceProviderId: booking.providerId,
    ambulanceDriverId: booking.driverId,
    ambulanceDriverName: booking.driverName,
    ambulanceVehicleNumber: booking.vehicleNumber,
    ambulanceType: booking.vehicleType,
    
    ambulanceTripDetails: {
      tripType: 'emergency',
      pickupAddress: booking.pickupAddress,
      dropAddress: booking.hospitalDestination?.address,
      hospitalDestination: booking.hospitalDestination?.hospitalName,
      distance: fareEstimate.breakdown?.distance || 0,
      isEmergency: true
    },
    
    ambulanceFareBreakdown: fareEstimate.breakdown,
    ambulanceCommission: fareEstimate.commission,
    
    status: 'pending',
    paymentStatus: 'pending',
    createdAt: new Date()
  });
  
  await transaction.save();
  console.log(`   💰 Transaction created: ${transaction.transactionId}`);
  
  return transaction;
};

// ============================================
// NO DRIVER FOUND - FALLBACK
// ============================================

/**
 * Handle case when no driver accepts the emergency
 */
const handleNoDriverFound = async (booking) => {
  console.log(`⚠️ No driver found for booking ${booking.bookingId}`);
  
  booking.status = 'no_driver_found';
  await booking.save();
  
  // Notify patient to call 108
  await smsService.sendAmbulanceSMS(booking.patientPhone, 'emergency_no_driver', {
    bookingId: booking.bookingId
  });
  
  await notificationService.sendNoDriverFoundAlert(booking);
};

// ============================================
// DRIVER TRIP MANAGEMENT
// ============================================

/**
 * Driver accepts emergency (called via WebSocket/API)
 */
const driverAcceptEmergency = async (driverId, bookingId) => {
  const booking = await Booking.findOne({ bookingId });
  if (!booking) return { success: false, reason: 'Booking not found' };
  
  // Check if already assigned to another driver
  if (booking.status === 'driver_assigned' && booking.driverId !== driverId) {
    return { success: false, reason: 'Already assigned to another driver' };
  }
  
  // Get driver details
  const driverLocation = await locationCache.ambulance.getDriverLocation(driverId);
  
  booking.driverId = driverId;
  booking.driverName = driverLocation?.driverName || 'Driver';
  booking.vehicleNumber = driverLocation?.vehicleNumber || '';
  booking.status = 'driver_assigned';
  booking.driverAcceptedAt = new Date();
  await booking.save();
  
  // Mark driver on trip
  await locationCache.ambulance.setDriverOnTrip(driverId, bookingId);
  
  // Notify patient
  await notificationService.sendDriverAcceptedAlert(booking);
  
  return { success: true, booking };
};

/**
 * Driver reached pickup location
 */
const driverArrivedAtPickup = async (bookingId) => {
  const booking = await Booking.findOne({ bookingId });
  if (!booking) return { success: false, reason: 'Booking not found' };
  
  booking.status = 'driver_arrived';
  booking.driverReachedAt = new Date();
  await booking.save();
  
  // Notify patient
  await notificationService.sendDriverArrivedAlert(booking);
  await smsService.sendAmbulanceSMS(booking.patientPhone, 'emergency_driver_arrived', {
    driverName: booking.driverName,
    vehicleNumber: booking.vehicleNumber,
    otp: booking.tripOtp,
    bookingId: booking.bookingId
  });
  
  return { success: true, booking };
};

/**
 * Patient onboard, heading to hospital
 */
const patientOnboard = async (bookingId, otp) => {
  const booking = await Booking.findOne({ bookingId });
  if (!booking) return { success: false, reason: 'Booking not found' };
  
  // Verify OTP
  const isOtpValid = await booking.verifyTripOtp(otp);
  if (!isOtpValid) return { success: false, reason: 'Invalid OTP' };
  
  booking.status = 'patient_onboard';
  booking.patientOnboardAt = new Date();
  booking.otpVerified = true;
  await booking.save();
  
  // Notify hospital
  await notificationService.sendPatientOnboardAlert(booking);
  
  return { success: true, booking };
};

/**
 * Arrived at hospital
 */
const arrivedAtHospital = async (bookingId, vitalsData = null) => {
  const booking = await Booking.findOne({ bookingId });
  if (!booking) return { success: false, reason: 'Booking not found' };
  
  booking.status = 'arrived_hospital';
  booking.arrivedHospitalAt = new Date();
  
  if (vitalsData) {
    if (!booking.digitalTripSheet) booking.digitalTripSheet = {};
    booking.digitalTripSheet.vitals = vitalsData;
  }
  
  await booking.save();
  
  // Notify patient
  await notificationService.sendArrivedHospitalAlert(booking);
  
  return { success: true, booking };
};

/**
 * Complete emergency trip
 */
const completeEmergencyTrip = async (bookingId, tripData = {}) => {
  const booking = await Booking.findOne({ bookingId });
  if (!booking) return { success: false, reason: 'Booking not found' };
  
  // Calculate final fare
  const fareBreakdown = booking.calculateFare();
  
  // Update booking
  booking.status = 'completed';
  booking.completedAt = new Date();
  
  if (tripData) {
    if (!booking.digitalTripSheet) booking.digitalTripSheet = {};
    Object.assign(booking.digitalTripSheet, {
      ...tripData,
      generated: true,
      tripSheetId: 'TRIP' + Date.now(),
      generatedAt: new Date(),
      pickupTime: booking.driverAcceptedAt,
      dropTime: new Date(),
      distance: tripData.distance || 0,
      duration: tripData.duration || 0
    });
  }
  
  booking.fareBreakdown = fareBreakdown;
  booking.finalAmount = fareBreakdown.total;
  
  await booking.save();
  
  // Clear driver trip
  await locationCache.ambulance.clearDriverTrip(booking.driverId);
  
  // Update transaction
  await Transaction.findOneAndUpdate(
    { applicationId: bookingId },
    {
      status: 'completed',
      completedAt: new Date(),
      ambulanceFareBreakdown: fareBreakdown,
      netAmount: fareBreakdown.total
    }
  );
  
  // Notify patient with trip sheet
  await notificationService.sendTripCompletedAlert(booking);
  await notificationService.sendTripSheetReadyAlert(booking);
  
  return { success: true, booking, fareBreakdown };
};

/**
 * Cancel emergency
 */
const cancelEmergency = async (bookingId, reason, cancelledBy = 'patient') => {
  const booking = await Booking.findOne({ bookingId });
  if (!booking) return { success: false, reason: 'Booking not found' };
  
  await booking.cancelEmergency(reason, cancelledBy);
  
  // Clear driver trip if assigned
  if (booking.driverId) {
    await locationCache.ambulance.clearDriverTrip(booking.driverId);
  }
  
  // Notify
  if (cancelledBy === 'patient') {
    await notificationService.sendEmergencyCancelledAlert(booking);
  } else if (cancelledBy === 'driver') {
    await notificationService.sendDriverCancelledAlert(booking);
    // Re-dispatch if driver cancelled
    // TODO: Auto re-dispatch logic
  }
  
  return { success: true, booking };
};

// ============================================
// SURGE PRICING
// ============================================

/**
 * Check if surge pricing should apply
 */
const checkSurgePricing = async (lat, lng) => {
  const demandLevel = await locationCache.ambulance.getAreaDemand(lat, lng);
  const isPeakHour = isPeakHourNow();
  
  let multiplier = 1.0;
  let reasons = [];
  
  if (demandLevel >= DISPATCH_CONFIG.surgeThreshold) {
    multiplier += Math.min(demandLevel * 0.2, 1.0);
    reasons.push('High demand in area');
  }
  
  if (isPeakHour) {
    multiplier += 0.3;
    reasons.push('Peak hours');
  }
  
  if (isNightTimeNow()) {
    multiplier += 0.2;
    reasons.push('Night time');
  }
  
  multiplier = Math.min(multiplier, DISPATCH_CONFIG.surgeMultiplierCap);
  
  return {
    surgeActive: multiplier > 1.0,
    multiplier: Math.round(multiplier * 10) / 10,
    reasons
  };
};

// ============================================
// STUCK BOOKING CHECKER (Cron Job)
// ============================================

/**
 * Check for stuck emergency bookings
 * Run every 2 minutes via cron
 */
const checkStuckBookings = async () => {
  const stuckTimeout = 5 * 60 * 1000; // 5 minutes
  
  const stuckBookings = await Booking.find({
    bookingType: 'ambulance_emergency',
    status: { $in: ['driver_assigned', 'driver_en_route'] },
    driverAcceptedAt: { $lt: new Date(Date.now() - stuckTimeout) }
  });
  
  for (const booking of stuckBookings) {
    console.log(`⚠️ Stuck booking detected: ${booking.bookingId}`);
    
    // Check if driver is still online
    const driverOnline = await locationCache.ambulance.isDriverOnline(booking.driverId);
    
    if (!driverOnline) {
      // Driver went offline - cancel and re-dispatch
      await cancelEmergency(booking.bookingId, 'Driver disconnected', 'system');
      // Re-dispatch
      // TODO: Call dispatchEmergencyAmbulance() again
    }
  }
  
  return { checked: stuckBookings.length };
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const isNightTimeNow = () => {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 6;
};

const isPeakHourNow = () => {
  const hour = new Date().getHours();
  return (hour >= 9 && hour < 11) || (hour >= 17 && hour < 20);
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Main dispatch
  dispatchEmergencyAmbulance,
  
  // Driver trip management
  driverAcceptEmergency,
  driverArrivedAtPickup,
  patientOnboard,
  arrivedAtHospital,
  completeEmergencyTrip,
  cancelEmergency,
  
  // Surge pricing
  checkSurgePricing,
  
  // Maintenance
  checkStuckBookings,
  
  // Config
  DISPATCH_CONFIG
};
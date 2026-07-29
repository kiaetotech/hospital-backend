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
    // STEP 1& enrich patient data
    // ============================================
    const patientData = await enrichPatientData(emergencyData);
    
    // ============================================
    // STEP 2nearest hospital with ER & beds
    // ============================================
    const hospitalData = await findDestinationHospital(
      patientData.pickupLat,
      patientData.pickupLng,
      patientData.insuranceInfo
    );
    
    // ============================================
    // STEP 3emergency booking record
    // ============================================
    const booking = await createEmergencyBooking(patientData, hospitalData);
    
    // ============================================
    // STEP 4fare estimate
    // ============================================
    const fareEstimate = calculateEmergencyFare(booking, hospitalData);
    
    // ============================================
    // STEP 5& dispatch nearest drivers
    // ============================================
    const dispatchResult = await findAndDispatchDrivers(booking, fareEstimate);
    
    if (!dispatchResult.success) {
      // No driver found - notify patient to call 108
      await handleNoDriverFound(booking);
      return { success, reason: 'no_driver_available', booking };
    }
    
    // ============================================
    // STEP 6emergency contacts
    // ============================================
    await notifyEmergencyContacts(booking, dispatchResult.driver);
    
    // ============================================
    // STEP 7hospital ER
    // ============================================
    await notifyHospitalER(booking, dispatchResult.driver);
    
    // ============================================
    // STEP 8insurance info with hospital
    // ============================================
    await shareInsuranceWithHospital(booking);
    
    // ============================================
    // STEP 9transaction record
    // ============================================
    await createEmergencyTransaction(booking, fareEstimate);
    
    console.log(`✅ [${dispatchId}] Emergency dispatch successful. Driver: ${dispatchResult.driver.driverName}`);
    
    return {
      success,
      booking,
      driver.driver,
      fareEstimate,
      trackingUrl.trackingUrl
    };
    
  } catch (error) {
    console.error(`❌ [${dispatchId}] Dispatch failed:`, error);
    return { success, reason: 'system_error', error.message };
  }
};

// ============================================
// STEP 1PATIENT DATA
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
  if (userId) {
    const emergencyProfile = await EmergencyContact.findByUserId(userId);
    
    if (emergencyProfile) {
      // Get contacts filtered for ambulance emergency
      emergencyContacts = emergencyProfile.getContactsForEmergency('ambulance_emergency');
      
      // Get medical info
      medicalInfo = {
        bloodGroup.medicalInfo?.bloodGroup,
        allergies.medicalInfo?.allergies?.filter(
          a => a.severity === 'severe' || a.severity === 'life_threatening'
        ),
        chronicConditions.medicalInfo?.chronicConditions?.filter(
          c => c.severity === 'severe' || c.severity === 'critical'
        ),
        currentMedications.medicalInfo?.currentMedications,
        implants.medicalInfo?.implants,
        isPregnant.medicalInfo?.isPregnant,
        doNotResuscitate.medicalInfo?.doNotResuscitate
      };
      
      // Get insurance info
      insuranceInfo = emergencyProfile.insuranceInfo;
      
      // Get ambulance preferences
      ambulancePreferences = emergencyProfile.ambulancePreferences || {};
      
      // Record this emergency
      await emergencyProfile.recordEmergency({
        emergencyType: 'ambulance_emergency',
        location: { lat, lng, address},
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
// STEP 2DESTINATION HOSPITAL
// ============================================

/**
 * Find nearest hospital with emergency department & bed availability
 * Interfaces with.hospital
 */
const findDestinationHospital = async (lat, lng, insuranceInfo = null) => {
  console.log(`🏥 Finding nearest hospital with ER near [${lat}, ${lng}]`);
  
  // Try with insurance network first
  let hospitals = [];
  
  if (insuranceInfo?.primaryInsurance?.provider) {
    // TODOinsurance ID and search network hospitals
    // For now, search all hospitals with ER
  }
  
  // Search all hospitals with emergency department and beds
  hospitals = await locationCache.hospital.findNearbyHospitals(lat, lng, 20, {
    emergencyOnly,
    hasBeds,
    limit: 5,
    sortBy: 'beds'  // Prioritize hospitals with more available beds
  });
  
  if (!hospitals || hospitals.length === 0) {
    // Fallbackhospital with ER within 50km
    hospitals = await locationCache.hospital.findNearbyHospitals(lat, lng, 50, {
      emergencyOnly,
      limit: 3,
      sortBy: 'distance'
    });
  }
  
  if (!hospitals || hospitals.length === 0) {
    throw new Error('No hospital with emergency department found nearby');
  }
  
  const selectedHospital = hospitals[0];
  
  console.log(`✅ Selected hospital: ${selectedHospital.name} (${selectedHospital.distance}km, ${selectedHospital.availableBeds} beds)`);
  
  return {
    hospitalId.hospitalId,
    hospitalName.name,
    address.address,
    phone.phone,
    coordinates: {
      lat.lat,
      lng.lng
    },
    distance.distance,
    bedAvailability: {
      general.availableBeds || 0,
      icu.icuBeds || 0,
      ventilator.ventilatorBeds || 0
    },
    emergencyDepartment.emergencyDepartment || 'Emergency Department'
  };
};

// ============================================
// STEP 3EMERGENCY BOOKING
// ============================================

/**
 * Create booking record in database
 * Interfaces withmodel
 */
const createEmergencyBooking = async (patientData, hospitalData) => {
  const bookingData = {
    userId.userId || 'guest',
    bookingType: 'ambulance_emergency',
    patientName.patientName,
    patientPhone.patientPhone,
    patientAge.patientAge,
    patientGender.patientGender,
    
    // Emergency specific
    emergencyType: 'blitz',
    patientCondition.patientCondition,
    
    // Location
    pickupAddress.pickupAddress,
    pickupCoordinates: {
      lat.pickupLat,
      lng.pickupLng
    },
    location: {
      type: 'Point',
      coordinates: [patientData.pickupLng, patientData.pickupLat]
    },
    
    // Hospital
    hospitalDestination,
    
    // Emergency contacts
    emergencyContacts.emergencyContacts?.map(c => ({
      name.name,
      phone.phone,
      relationship.relationship,
      notified})) || [],
    
    // Medical info
    medicalInfo.medicalInfo,
    insuranceInfo.insuranceInfo,
    
    // Initial values
    originalAmount: 0,  // Will be calculated after trip
    finalAmount: 0,
    appointmentDateDate(),
    status: 'pending',
    priority: 'emergency',
    
    // Tracking
    trackingUrl: `${process.env.FRONTEND_URL || 'https://hospital-frontend-kiaeto.vercel.app'}/ambulance/tracking/`,
    
    createdAtDate()
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
// STEP 4EMERGENCY FARE
// ============================================

/**
 * Calculate fare estimate before dispatch
 * Interfaces with*/
const calculateEmergencyFare = (booking, hospitalData) => {
  const distance = hospitalData.distance || 5;
  const isNightTime = isNightTimeNow();
  const surgeMultiplier = 1.0; // Will be updated if surge detected
  
  const fareEstimate = commissionService.calculateAmbulanceFare({
    baseFare: 500,
    distance,
    isNightTime,
    ambulanceType: 'basic',
    surgeMultiplier,
    isEmergency});
  
  // Calculate commission
  const commission = commissionService.calculateEmergencyCommission({
    bookingType: 'ambulance_emergency',
    emergencyType: 'blitz',
    amount.breakdown.total,
    isNightTime,
    isLongDistance> 50
  });
  
  return {
    ...fareEstimate,
    commission,
    platformFee: 0, // Waived for emergency
    total.breakdown.total
  };
};

// ============================================
// STEP 5& DISPATCH DRIVERS
// ============================================

/**
 * Find nearest available drivers and dispatch
 * Interfaces with.ambulance
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
        vehicleType.ambulanceType || 'any',
        limit_CONFIG.driversToContact,
        requireAvailable}
    );
    
    console.log(`   Attempt ${retryCount + 1}${drivers.length} drivers within ${radius}km`);
    
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
    return { success, reason: 'No driver accepted' };
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
    driverName.name,
    vehicleNumber.vehicleNumber,
    vehicleType.vehicleType,
    eta.round(driverFound.distance * 2), // ~2 min per km
    trackingUrl.trackingUrl,
    otp.tripOtp,
    bookingId.bookingId
  });
  
  return { success, driver};
};

/**
 * Contact drivers one by one with 15-second accept window
 */
const contactDrivers = async (booking, drivers, fareEstimate) => {
  for (const driver of drivers) {
    console.log(`   📞 Contacting driver: ${driver.driverId} (${driver.distance}km)`);
    
    // Add to contacted list
    booking.driversContacted.push({
      driverId.driverId,
      driverName.name || 'Unknown',
      accepted,
      responseTime: 0
    });
    
    // Send emergency alert to driver
    const alertSent = await smsService.sendDriverDispatchSMS(driver.phone || driver.driverPhone, {
      bookingId.bookingId,
      patientName.patientName,
      patientCondition.patientCondition?.chiefComplaint || 'Emergency',
      pickupAddress.pickupAddress,
      distance.distance,
      eta.round(driver.distance * 2),
      estimatedFare.total,
      surgeMultiplier.surgeMultiplier || 1.0,
      surgeMessage.surgeMultiplier > 1 ? `⚠️ Surge: ${fareEstimate.surgeMultiplier}x` : ''
    });
    
    // Send push notification with loud alert
    await notificationService.sendDriverEmergencyAlert(driver.phone, {
      bookingId.bookingId,
      patientName.patientName,
      patientCondition.patientCondition?.chiefComplaint || 'Emergency',
      pickupAddress.pickupAddress,
      distance.distance,
      eta.round(driver.distance * 2),
      estimatedFare.total,
      surgeMultiplier.surgeMultiplier || 1.0
    });
    
    // In productionfor driver to accept via WebSocket
    // For now-accept the first available driver
    // TODOreal-time accept/reject via WebSocket
    
    // Simulateaccepts (in real system, this comes from WebSocket)
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
// STEP 6EMERGENCY CONTACTS
// ============================================

/**
 * Send SMS to all emergency contacts
 * Interfaces with, notificationService
 */
const notifyEmergencyContacts = async (booking, driver) => {
  const contacts = booking.emergencyContacts || [];
  
  if (contacts.length === 0) {
    console.log('   No emergency contacts to notify');
    return;
  }
  
  console.log(`   📢 Notifying ${contacts.length} emergency contacts...`);
  
  const emergencyData = {
    patientName.patientName,
    ambulanceType.vehicleType || 'Emergency',
    vehicleNumber.vehicleNumber,
    driverName.driverName,
    driverPhone.driverPhone,
    eta.round((driver.distance || 5) * 2),
    trackingUrl.trackingUrl,
    hospitalName.hospitalDestination?.hospitalName || 'Nearest hospital'
  };
  
  // Send to each contact
  const results = await smsService.sendEmergencyContactsSMS(
    contacts.filter(c => c.phone),
    emergencyData
  );
  
  // Mark contacts as notified in booking
  booking.emergencyContacts = contacts.map(c => ({
    ...c,
    notified,
    notifiedAtDate()
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
// STEP 7HOSPITAL ER
// ============================================

/**
 * Alert hospital emergency department
 * Interfaces with, notificationService, locationCache.hospital
 */
const notifyHospitalER = async (booking, driver) => {
  const hospital = booking.hospitalDestination;
  if (!hospital) return;
  
  console.log(`   🏥 Notifying ${hospital.hospitalName} ER...`);
  
  // Get hospital details for phone/email
  const hospitalDetails = await locationCache.hospital.getHospitalDetails(hospital.hospitalId);
  
  const emergencyData = {
    bookingId.bookingId,
    patientName.patientName,
    patientAge.patientAge,
    patientGender.patientGender,
    chiefComplaint.patientCondition?.chiefComplaint || 'Emergency',
    patientCondition: `${booking.patientCondition?.isBreathing ? 'Breathing' : 'NOT BREATHING'}, ${booking.patientCondition?.isConscious ? 'Conscious' : 'UNCONSCIOUS'}`,
    ambulanceType.vehicleType,
    vehicleNumber.vehicleNumber,
    eta.round((driver.distance || 5) * 2),
    driverPhone.driverPhone,
    vitals.digitalTripSheet?.vitals || null,
    insuranceProvider.insuranceInfo?.primaryInsurance?.provider || 'None',
    insurancePolicyNumber.insuranceInfo?.primaryInsurance?.policyNumber || 'N/A'
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
// STEP 8INSURANCE WITH HOSPITAL
// ============================================

/**
 * Share patient's insurance card with hospital
 * Interfaces withmodel
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
// STEP 9TRANSACTION
// ============================================

/**
 * Create payment transaction record
 * Interfaces withmodel
 */
const createEmergencyTransaction = async (booking, fareEstimate) => {
  const transaction = new Transaction({
    transactionId: 'TXN_AMB_' + Date.now(),
    applicationId.bookingId,
    lenderId: 'platform',
    type: 'ambulance_emergency',
    bookingType: 'ambulance_emergency',
    bookingId._id,
    userId.userId,
    
    amount.total,
    originalAmount.total,
    netAmount.total,
    
    ambulanceId.driverId,
    ambulanceProviderId.providerId,
    ambulanceDriverId.driverId,
    ambulanceDriverName.driverName,
    ambulanceVehicleNumber.vehicleNumber,
    ambulanceType.vehicleType,
    
    ambulanceTripDetails: {
      tripType: 'emergency',
      pickupAddress.pickupAddress,
      dropAddress.hospitalDestination?.address,
      hospitalDestination.hospitalDestination?.hospitalName,
      distance.breakdown?.distance || 0,
      isEmergency},
    
    ambulanceFareBreakdown.breakdown,
    ambulanceCommission.commission,
    
    status: 'pending',
    paymentStatus: 'pending',
    createdAtDate()
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
    bookingId.bookingId
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
  if (!booking) return { success, reason: 'Booking not found' };
  
  // Check if already assigned to another driver
  if (booking.status === 'driver_assigned' && booking.driverId !== driverId) {
    return { success, reason: 'Already assigned to another driver' };
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
  
  return { success, booking };
};

/**
 * Driver reached pickup location
 */
const driverArrivedAtPickup = async (bookingId) => {
  const booking = await Booking.findOne({ bookingId });
  if (!booking) return { success, reason: 'Booking not found' };
  
  booking.status = 'driver_arrived';
  booking.driverReachedAt = new Date();
  await booking.save();
  
  // Notify patient
  await notificationService.sendDriverArrivedAlert(booking);
  await smsService.sendAmbulanceSMS(booking.patientPhone, 'emergency_driver_arrived', {
    driverName.driverName,
    vehicleNumber.vehicleNumber,
    otp.tripOtp,
    bookingId.bookingId
  });
  
  return { success, booking };
};

/**
 * Patient onboard, heading to hospital
 */
const patientOnboard = async (bookingId, otp) => {
  const booking = await Booking.findOne({ bookingId });
  if (!booking) return { success, reason: 'Booking not found' };
  
  // Verify OTP
  const isOtpValid = await booking.verifyTripOtp(otp);
  if (!isOtpValid) return { success, reason: 'Invalid OTP' };
  
  booking.status = 'patient_onboard';
  booking.patientOnboardAt = new Date();
  booking.otpVerified = true;
  await booking.save();
  
  // Notify hospital
  await notificationService.sendPatientOnboardAlert(booking);
  
  return { success, booking };
};

/**
 * Arrived at hospital
 */
const arrivedAtHospital = async (bookingId, vitalsData = null) => {
  const booking = await Booking.findOne({ bookingId });
  if (!booking) return { success, reason: 'Booking not found' };
  
  booking.status = 'arrived_hospital';
  booking.arrivedHospitalAt = new Date();
  
  if (vitalsData) {
    if (!booking.digitalTripSheet) booking.digitalTripSheet = {};
    booking.digitalTripSheet.vitals = vitalsData;
  }
  
  await booking.save();
  
  // Notify patient
  await notificationService.sendArrivedHospitalAlert(booking);
  
  return { success, booking };
};

/**
 * Complete emergency trip
 */
const completeEmergencyTrip = async (bookingId, tripData = {}) => {
  const booking = await Booking.findOne({ bookingId });
  if (!booking) return { success, reason: 'Booking not found' };
  
  // Calculate final fare
  const fareBreakdown = booking.calculateFare();
  
  // Update booking
  booking.status = 'completed';
  booking.completedAt = new Date();
  
  if (tripData) {
    if (!booking.digitalTripSheet) booking.digitalTripSheet = {};
    Object.assign(booking.digitalTripSheet, {
      ...tripData,
      generated,
      tripSheetId: 'TRIP' + Date.now(),
      generatedAtDate(),
      pickupTime.driverAcceptedAt,
      dropTimeDate(),
      distance.distance || 0,
      duration.duration || 0
    });
  }
  
  booking.fareBreakdown = fareBreakdown;
  booking.finalAmount = fareBreakdown.total;
  
  await booking.save();
  
  // Clear driver trip
  await locationCache.ambulance.clearDriverTrip(booking.driverId);
  
  // Update transaction
  await Transaction.findOneAndUpdate(
    { applicationId},
    {
      status: 'completed',
      completedAtDate(),
      ambulanceFareBreakdown,
      netAmount.total
    }
  );
  
  // Notify patient with trip sheet
  await notificationService.sendTripCompletedAlert(booking);
  await notificationService.sendTripSheetReadyAlert(booking);
  
  return { success, booking, fareBreakdown };
};

/**
 * Cancel emergency
 */
const cancelEmergency = async (bookingId, reason, cancelledBy = 'patient') => {
  const booking = await Booking.findOne({ bookingId });
  if (!booking) return { success, reason: 'Booking not found' };
  
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
    // TODOre-dispatch logic
  }
  
  return { success, booking };
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
    surgeActive> 1.0,
    multiplier.round(multiplier * 10) / 10,
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
    driverAcceptedAt: { $ltDate(Date.now() - stuckTimeout) }
  });
  
  for (const booking of stuckBookings) {
    console.log(`⚠️ Stuck booking detected: ${booking.bookingId}`);
    
    // Check if driver is still online
    const driverOnline = await locationCache.ambulance.isDriverOnline(booking.driverId);
    
    if (!driverOnline) {
      // Driver went offline - cancel and re-dispatch
      await cancelEmergency(booking.bookingId, 'Driver disconnected', 'system');
      // Re-dispatch
      // TODOdispatchEmergencyAmbulance() again
    }
  }
  
  return { checked.length };
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


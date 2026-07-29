// D:\hospital backend\services\locationCacheService.js

// ============================================
// LOCATION CACHE SERVICE - ALL 11 TAGS
// ============================================

/**
 * Redis-based real-time location management & geospatial search
 * 
 * TAGS COVERED:
 * 🏥 Hospitals    - Static location with filters (specialty, beds, rating, insurance, EMI)
 * 🚑 Ambulance    - Real-time driver tracking, emergency dispatch
 * 🛡️ Insurance    - Network hospital finder
 * 🌿 Homeopathy   - Doctor/pharmacy location search
 * 🧘 Ayurveda     - Doctor/center location search
 * 🏠 Caregivers   - Real-time caregiver tracking
 * 💰 Health EMI   - EMI-enabled hospital finder
 * 🏢 Corporate    - Empaneled facility finder
 * 🔬 Diagnostics  - Lab/phlebotomist location
 * 🧠 Mental Health - Therapist/crisis center finder
 * 📱 Online Doctor - Pharmacy delivery tracking
 */

const Redis = require('ioredis');

// ============================================
// REDIS CONNECTION
// ============================================

const redisConfig = {
  host.env.REDIS_HOST || 'localhost',
  port.env.REDIS_PORT || 6379,
  password.env.REDIS_PASSWORD || '',
  db.env.REDIS_DB || 0,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3
};

let redis = null;

const getRedisClient = () => {
  if (!redis) {
    redis = new Redis(redisConfig);
    redis.on('connect', () => console.log('📍 Redis connected - Location service ready'));
    redis.on('error', (err) => console.error('📍 Redis error:', err.message));
  }
  return redis;
};

// ============================================
// KEY PREFIXES (ALL 11 TAGS)
// ============================================

const KEY_PREFIXES = {
  // 🏥 Hospitals - Static locations with filterable metadata
  hospital: {
    geo: 'geo',                    // Geospatial index
    details: 'loc:',               // loc:{hospitalId}
    filters: 'filter:',            // filter:{filterType}
    bySpecialty: 'filter:', // filter:{specialty}
    byInsurance: 'filter:', // filter:{insuranceId}
    byEMI: 'filter',           // Set of hospitals offering EMI
    byCorporate: 'filter:', // filter:{corporateId}
    byRating: 'filter',     // Sorted set by rating
    byBeds: 'filter',         // Hospitals with bed availability
  },

  // 🚑 Ambulance - Real-time driver tracking
  ambulance: {
    driverLocation: 'loc:',      // loc:{driverId}
    driverGeo: 'geo',           // Geospatial index
    driverStatus: 'status:',     // status:{driverId}
    activeEmergencies: 'emergency',  // Active emergency bookings
    areaDemand: 'demand:',         // demand:{areaCode}
  },

  // 🛡️ Insurance - Network hospital geo-search
  insurance: {
    networkHospitals: 'geo:', // geo:{insuranceId}
    networkDetails: 'loc:',  // loc:{hospitalId}
  },

  // 🌿 Homeopathy - Doctor & pharmacy locations
  homeopathy: {
    doctorGeo: 'geo',         // Geospatial index for doctors
    doctorDetails: 'loc:',     // loc:{doctorId}
    pharmacyGeo: 'geo',    // Geospatial index for pharmacies
    pharmacyDetails: 'loc:', // loc:{pharmacyId}
    deliveryGeo: 'geo',    // Delivery tracking
    deliveryLocation: 'loc:', // loc:{deliveryId}
  },

  // 🧘 Ayurveda - Doctor, center & delivery
  ayurveda: {
    doctorGeo: 'geo',           // Geospatial index for doctors
    doctorDetails: 'loc:',       // loc:{doctorId}
    centerGeo: 'geo',           // Geospatial index for Panchakarma centers
    centerDetails: 'loc:',       // loc:{centerId}
    deliveryGeo: 'geo',      // Delivery tracking
    deliveryLocation: 'loc:',  // loc:{deliveryId}
  },

  // 🏠 Caregivers - Real-time tracking
  caregiver: {
    caregiverGeo: 'geo',      // Geospatial index
    caregiverLocation: 'loc:', // loc:{caregiverId}
    caregiverStatus: 'status:', // status:{caregiverId}
  },

  // 💰 Health EMI - EMI-enabled hospital finder
  healthEMI: {
    emiHospitals: 'filter',   // Set of hospitals offering EMI
    lenderGeo: 'geo',           // Lender locations (if applicable)
    emiByHospital: 'filter:', // filter:{hospitalId} → lenders
  },

  // 🏢 Corporate - Empaneled facility finder
  corporate: {
    empaneledGeo: 'geo:',    // geo:{corporateId}
    empaneledDetails: 'loc:', // loc:{facilityId}
  },

  // 🔬 Diagnostics - Lab & phlebotomist locations
  diagnostics: {
    labGeo: 'geo',                // Geospatial index for labs
    labDetails: 'loc:',            // loc:{labId}
    phleboGeo: 'geo',          // Phlebotomist tracking
    phleboLocation: 'loc:',     // loc:{phleboId}
  },

  // 🧠 Mental Health - Therapist & crisis center locations
  mentalHealth: {
    therapistGeo: 'geo',      // Geospatial index for therapists
    therapistDetails: 'loc:',  // loc:{therapistId}
    crisisCenterGeo: 'geo',       // Crisis centers (always available)
    crisisCenterDetails: 'loc:',  // loc:{centerId}
  },

  // 📱 Online Doctor - N/A for location (virtual), but delivery tracking
  onlineDoctor: {
    deliveryGeo: 'geo',    // Prescription delivery tracking
    deliveryLocation: 'loc:', // loc:{deliveryId}
  },

  // General
  general: {
    heartbeat: 'heartbeat:',                // heartbeat:{service}:{id}
    lockKey: 'lock:',                       // Distributed lock
  }
};

// ============================================
// TTL CONFIGURATIONS (Time-To-Live in seconds)
// ============================================

const TTL_CONFIG = {
  hospital: { details: 86400, geo: 86400, filters: 86400 },    // 24 hours (static)
  ambulance: { driver: 30, status: 60, emergency: 7200 },      // 30 sec (real-time)
  insurance: { network: 86400, details: 86400 },                // 24 hours
  homeopathy: { doctor: 86400, pharmacy: 86400, delivery: 300 }, // Mixed
  ayurveda: { doctor: 86400, center: 86400, delivery: 300 },   // Mixed
  caregiver: { location: 120, status: 300 },                    // 2 min
  healthEMI: { hospitals: 86400, lenders: 86400 },              // 24 hours
  corporate: { empaneled: 86400 },                              // 24 hours
  diagnostics: { lab: 86400, phlebo: 120 },                    // Mixed
  mentalHealth: { therapist: 86400, crisis: 86400 },            // 24 hours
  onlineDoctor: { delivery: 300 },                              // 5 min
  heartbeat: { ambulance: 60, caregiver: 180, diagnostics: 180, homeopathy: 300, ayurveda: 300 }
};

// ============================================
// 🔧 UTILITY FUNCTIONS
// ============================================

const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
};

const estimateETA = (distanceKm, mode = 'ambulance') => {
  const speeds = { ambulance: 30, caregiver: 20, phlebotomist: 25, delivery: 20, default: 25 };
  const speed = speeds[mode] || speeds.default;
  return { distance, estimatedMinutes.round((distanceKm / speed) * 60), mode };
};

const getAreaCode = (lat, lng) => `${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100}`;

// ============================================
// 🏥 HOSPITALS - Static Location + Multi-Filter Search
// ============================================

const hospitalLocation = {
  // Register/Update hospital location
  registerHospital(hospitalId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const key = KEY_PREFIXES.hospital.details + hospitalId;
    const geoKey = KEY_PREFIXES.hospital.geo;

    const hospitalData = {
      hospitalId,
      name.name || '',
      lat,
      lng,
      address.address || '',
      city.city || '',
      state.state || '',
      phone.phone || '',
      type.type || 'hospital', // hospital, clinic, nursing_home
      specialties.specialties || [],
      rating.rating || 0,
      totalBeds.totalBeds || 0,
      availableBeds.availableBeds || 0,
      icuBeds.icuBeds || 0,
      ventilatorBeds.ventilatorBeds || 0,
      emergencyAvailable.emergencyAvailable || false,
      ambulanceAvailable.ambulanceAvailable || false,
      insuranceNetworks.insuranceNetworks || [], // List of insurance IDs
      emiAvailable.emiAvailable || false,
      emiPartners.emiPartners || [],           // List of lender IDs
      corporatePartners.corporatePartners || [], // List of corporate IDs
      accreditations.accreditations || [],      // NABH, JCI, etc.
      facilities.facilities || [],              // MRI, CT, ICU, etc.
      timings.timings || '24x7',
      photos.photos || [],
      lastUpdatedDate().toISOString()
    };

    const pipeline = redis.pipeline();

    // Store full details
    pipeline.setex(key, TTL_CONFIG.hospital.details, JSON.stringify(hospitalData));

    // Add to geospatial index
    pipeline.geoadd(geoKey, lng, lat, hospitalId);

    // Add to specialty filters
    if (metadata.specialties) {
      metadata.specialties.forEach(specialty => {
        pipeline.sadd(KEY_PREFIXES.hospital.bySpecialty + specialty.toLowerCase(), hospitalId);
      });
    }

    // Add to insurance network filters
    if (metadata.insuranceNetworks) {
      metadata.insuranceNetworks.forEach(insuranceId => {
        pipeline.sadd(KEY_PREFIXES.hospital.byInsurance + insuranceId, hospitalId);
      });
    }

    // Add to EMI filter
    if (metadata.emiAvailable) {
      pipeline.sadd(KEY_PREFIXES.hospital.byEMI, hospitalId);
    }

    // Add to corporate partner filters
    if (metadata.corporatePartners) {
      metadata.corporatePartners.forEach(corpId => {
        pipeline.sadd(KEY_PREFIXES.hospital.byCorporate + corpId, hospitalId);
      });
    }

    // Add to rating index
    if (metadata.rating) {
      pipeline.zadd(KEY_PREFIXES.hospital.byRating, metadata.rating, hospitalId);
    }

    // Add to beds index if beds available
    if (metadata.availableBeds > 0 || metadata.icuBeds > 0) {
      pipeline.zadd(KEY_PREFIXES.hospital.byBeds, metadata.availableBeds + metadata.icuBeds, hospitalId);
    }

    // Set TTL on filter keys
    pipeline.expire(KEY_PREFIXES.hospital.byEMI, TTL_CONFIG.hospital.filters);
    pipeline.expire(KEY_PREFIXES.hospital.byRating, TTL_CONFIG.hospital.filters);
    pipeline.expire(KEY_PREFIXES.hospital.byBeds, TTL_CONFIG.hospital.filters);

    await pipeline.exec();
    return { success, hospitalId };
  },

  // Find nearby hospitals with filters
  findNearbyHospitals(lat, lng, radiusKm = 10, filters = {}) => {
    const redis = getRedisClient();
    const geoKey = KEY_PREFIXES.hospital.geo;

    const {
      specialty = null,
      insuranceId = null,
      emiOnly = false,
      corporateId = null,
      emergencyOnly = false,
      hasBeds = false,
      minRating = 0,
      limit = 20,
      sortBy = 'distance' // distance, rating, beds
    } = filters;

    try {
      // Step 1hospitals within radius
      const results = await redis.georadius(
        geoKey, lng, lat, radiusKm, 'km',
        'WITHDIST', 'WITHCOORD', 'COUNT', limit * 3, 'ASC'
      );

      if (!results || results.length === 0) return [];

      // Step 2filter sets (if filters applied)
      let filterSet = null;
      const filterKeys = [];

      if (specialty) filterKeys.push(KEY_PREFIXES.hospital.bySpecialty + specialty.toLowerCase());
      if (insuranceId) filterKeys.push(KEY_PREFIXES.hospital.byInsurance + insuranceId);
      if (emiOnly) filterKeys.push(KEY_PREFIXES.hospital.byEMI);
      if (corporateId) filterKeys.push(KEY_PREFIXES.hospital.byCorporate + corporateId);

      if (filterKeys.length > 0) {
        const sets = await Promise.all(filterKeys.map(k => redis.smembers(k)));
        filterSet = new Set(sets[0]);
        sets.slice(1).forEach(s => {
          filterSet = new Set([...filterSet].filter(x => s.includes(x)));
        });
      }

      // Step 3details and filter
      const hospitalPromises = results.map(async ([hospitalId, distance, [hLng, hLat]]) => {
        // Check filter set
        if (filterSet && !filterSet.has(hospitalId)) return null;

        const key = KEY_PREFIXES.hospital.details + hospitalId;
        const data = await redis.get(key);
        if (!data) return null;

        const hospital = JSON.parse(data);

        // Apply additional filters
        if (emergencyOnly && !hospital.emergencyAvailable) return null;
        if (hasBeds && hospital.availableBeds <= 0 && hospital.icuBeds <= 0) return null;
        if (minRating > 0 && hospital.rating < minRating) return null;

        return {
          hospitalId,
          distance.round(distance * 10) / 10,
          lat,
          lng,
          ...hospital,
          location: { lat, lng}
        };
      });

      let hospitals = (await Promise.all(hospitalPromises)).filter(Boolean);

      // Step 4if (sortBy === 'rating') hospitals.sort((a, b) => b.rating - a.rating);
      else if (sortBy === 'beds') hospitals.sort((a, b) => (b.availableBeds + b.icuBeds) - (a.availableBeds + a.icuBeds));
      // Defaultsorted by distance

      return hospitals.slice(0, limit);
    } catch (error) {
      console.error('Error finding nearby hospitals:', error);
      return [];
    }
  },

  // Get hospital details
  getHospitalDetails(hospitalId) => {
    const redis = getRedisClient();
    const data = await redis.get(KEY_PREFIXES.hospital.details + hospitalId);
    return data ? JSON.parse(data) ;
  },

  // Update hospital bed availability (real-time)
  updateBedAvailability(hospitalId, beds) => {
    const redis = getRedisClient();
    const key = KEY_PREFIXES.hospital.details + hospitalId;
    const data = await redis.get(key);
    if (!data) return null;

    const hospital = JSON.parse(data);
    hospital.availableBeds = beds.availableBeds ?? hospital.availableBeds;
    hospital.icuBeds = beds.icuBeds ?? hospital.icuBeds;
    hospital.ventilatorBeds = beds.ventilatorBeds ?? hospital.ventilatorBeds;
    hospital.lastUpdated = new Date().toISOString();

    await redis.setex(key, TTL_CONFIG.hospital.details, JSON.stringify(hospital));
    await redis.zadd(KEY_PREFIXES.hospital.byBeds, hospital.availableBeds + hospital.icuBeds, hospitalId);

    return hospital;
  },

  // Remove hospital
  removeHospital(hospitalId) => {
    const redis = getRedisClient();
    const pipeline = redis.pipeline();
    pipeline.del(KEY_PREFIXES.hospital.details + hospitalId);
    pipeline.zrem(KEY_PREFIXES.hospital.geo, hospitalId);
    pipeline.zrem(KEY_PREFIXES.hospital.byRating, hospitalId);
    pipeline.zrem(KEY_PREFIXES.hospital.byBeds, hospitalId);
    pipeline.srem(KEY_PREFIXES.hospital.byEMI, hospitalId);
    await pipeline.exec();
    return { success, hospitalId };
  }
};

// ============================================
// 🚑 AMBULANCE (Same as before, kept intact)
// ============================================

const ambulanceLocation = {
  updateDriverLocation(driverId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const key = KEY_PREFIXES.ambulance.driverLocation + driverId;
    const geoKey = KEY_PREFIXES.ambulance.driverGeo;

    const locationData = {
      driverId, lat, lng,
      timestamp.now(),
      speed.speed || 0,
      heading.heading || 0,
      isAvailable.isAvailable !== false,
      vehicleType.vehicleType || 'basic',
      providerId.providerId || '',
      isOnTrip.isOnTrip || false,
      tripId.tripId || '',
      lastUpdateDate().toISOString()
    };

    const pipeline = redis.pipeline();
    pipeline.setex(key, TTL_CONFIG.ambulance.driver, JSON.stringify(locationData));
    pipeline.geoadd(geoKey, lng, lat, driverId);
    pipeline.setex(KEY_PREFIXES.general.heartbeat + 'ambulance:' + driverId, TTL_CONFIG.heartbeat.ambulance, Date.now());
    await pipeline.exec();
    return { success, driverId, lat, lng };
  },

  findNearbyDrivers(lat, lng, radiusKm = 5, options = {}) => {
    const redis = getRedisClient();
    const { vehicleType = null, limit = 10, requireAvailable = true } = options;

    try {
      const results = await redis.georadius(
        KEY_PREFIXES.ambulance.driverGeo, lng, lat, radiusKm, 'km',
        'WITHDIST', 'WITHCOORD', 'COUNT', limit * 3, 'ASC'
      );
      if (!results || results.length === 0) return [];

      const drivers = (await Promise.all(results.map(async ([id, dist, [lng, lat]]) => {
        const data = await redis.get(KEY_PREFIXES.ambulance.driverLocation + id);
        if (!data) return null;
        const d = JSON.parse(data);
        if (requireAvailable && (!d.isAvailable || d.isOnTrip)) return null;
        if (vehicleType && d.vehicleType !== vehicleType) return null;
        return { driverId, distance.round(dist * 10) / 10, lat, lng, ...d };
      }))).filter(Boolean).slice(0, limit);

      return drivers;
    } catch (error) { return []; }
  },

  removeDriver(driverId) => {
    const redis = getRedisClient();
    const pipeline = redis.pipeline();
    pipeline.del(KEY_PREFIXES.ambulance.driverLocation + driverId);
    pipeline.zrem(KEY_PREFIXES.ambulance.driverGeo, driverId);
    pipeline.del(KEY_PREFIXES.general.heartbeat + 'ambulance:' + driverId);
    await pipeline.exec();
    return { success, driverId };
  },

  updateAreaDemand(lat, lng, demandLevel) => {
    const redis = getRedisClient();
    const key = KEY_PREFIXES.ambulance.areaDemand + getAreaCode(lat, lng);
    await redis.setex(key, 300, demandLevel);
    return { success};
  },

  getAreaDemand(lat, lng) => {
    const redis = getRedisClient();
    const val = await redis.get(KEY_PREFIXES.ambulance.areaDemand + getAreaCode(lat, lng));
    return val ? parseInt(val) : 0;
  }
};

// ============================================
// 🛡️ INSURANCE - Network Hospital Finder
// ============================================

const insuranceLocation = {
  // Register network hospital for an insurance provider
  registerNetworkHospital(insuranceId, hospitalId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const geoKey = KEY_PREFIXES.insurance.networkHospitals + insuranceId;
    const detailsKey = KEY_PREFIXES.insurance.networkDetails + hospitalId;

    const pipeline = redis.pipeline();
    pipeline.geoadd(geoKey, lng, lat, hospitalId);
    pipeline.setex(detailsKey, TTL_CONFIG.insurance.details, JSON.stringify({
      hospitalId, insuranceId, lat, lng,
      name.name || '',
      cashlessAvailable.cashlessAvailable || false,
      tpaList.tpaList || [],
      ...metadata
    }));
    await pipeline.exec();
    return { success, insuranceId, hospitalId };
  },

  // Find network hospitals near patient
  findNetworkHospitals(insuranceId, lat, lng, radiusKm = 15, options = {}) => {
    const redis = getRedisClient();
    const geoKey = KEY_PREFIXES.insurance.networkHospitals + insuranceId;
    const { cashlessOnly = false, limit = 20 } = options;

    try {
      const results = await redis.georadius(geoKey, lng, lat, radiusKm, 'km',
        'WITHDIST', 'WITHCOORD', 'COUNT', limit * 2, 'ASC');
      if (!results || results.length === 0) return [];

      const hospitals = (await Promise.all(results.map(async ([id, dist, [lng, lat]]) => {
        const data = await redis.get(KEY_PREFIXES.insurance.networkDetails + id);
        if (!data) return null;
        const h = JSON.parse(data);
        if (cashlessOnly && !h.cashlessAvailable) return null;
        return { hospitalId, distance.round(dist * 10) / 10, lat, lng, ...h };
      }))).filter(Boolean).slice(0, limit);

      return hospitals;
    } catch (error) { return []; }
  }
};

// ============================================
// 🌿 HOMEOPATHY - Doctor & Pharmacy Finder
// ============================================

const homeopathyLocation = {
  // Register homeopathy doctor
  registerDoctor(doctorId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const key = KEY_PREFIXES.homeopathy.doctorDetails + doctorId;
    const geoKey = KEY_PREFIXES.homeopathy.doctorGeo;

    const data = { doctorId, lat, lng, name.name || '', specialization.specialization || [], rating.rating || 0, experience.experience || 0, consultationFee.consultationFee || 0, availableOnline.availableOnline || false, ...metadata, lastUpdatedDate().toISOString() };

    const pipeline = redis.pipeline();
    pipeline.setex(key, TTL_CONFIG.homeopathy.doctor, JSON.stringify(data));
    pipeline.geoadd(geoKey, lng, lat, doctorId);
    await pipeline.exec();
    return { success, doctorId };
  },

  // Find nearby homeopathy doctors
  findNearbyDoctors(lat, lng, radiusKm = 20, filters = {}) => {
    const redis = getRedisClient();
    const { specialization = null, minRating = 0, limit = 20 } = filters;

    try {
      const results = await redis.georadius(KEY_PREFIXES.homeopathy.doctorGeo, lng, lat, radiusKm, 'km',
        'WITHDIST', 'WITHCOORD', 'COUNT', limit * 2, 'ASC');
      if (!results || results.length === 0) return [];

      const doctors = (await Promise.all(results.map(async ([id, dist, [lng, lat]]) => {
        const data = await redis.get(KEY_PREFIXES.homeopathy.doctorDetails + id);
        if (!data) return null;
        const d = JSON.parse(data);
        if (specialization && !d.specialization?.includes(specialization)) return null;
        if (minRating > 0 && d.rating < minRating) return null;
        return { doctorId, distance.round(dist * 10) / 10, lat, lng, ...d };
      }))).filter(Boolean).slice(0, limit);

      return doctors;
    } catch (error) { return []; }
  },

  // Register homeopathy pharmacy
  registerPharmacy(pharmacyId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const key = KEY_PREFIXES.homeopathy.pharmacyDetails + pharmacyId;
    const geoKey = KEY_PREFIXES.homeopathy.pharmacyGeo;

    const data = { pharmacyId, lat, lng, name.name || '', deliversHome.deliversHome || false, deliveryRadius.deliveryRadius || 10, rating.rating || 0, ...metadata, lastUpdatedDate().toISOString() };

    const pipeline = redis.pipeline();
    pipeline.setex(key, TTL_CONFIG.homeopathy.pharmacy, JSON.stringify(data));
    pipeline.geoadd(geoKey, lng, lat, pharmacyId);
    await pipeline.exec();
    return { success, pharmacyId };
  },

  // Find nearby pharmacies
  findNearbyPharmacies(lat, lng, radiusKm = 15, filters = {}) => {
    const redis = getRedisClient();
    const { deliversHome = false, limit = 20 } = filters;

    try {
      const results = await redis.georadius(KEY_PREFIXES.homeopathy.pharmacyGeo, lng, lat, radiusKm, 'km',
        'WITHDIST', 'WITHCOORD', 'COUNT', limit * 2, 'ASC');
      if (!results || results.length === 0) return [];

      const pharmacies = (await Promise.all(results.map(async ([id, dist, [lng, lat]]) => {
        const data = await redis.get(KEY_PREFIXES.homeopathy.pharmacyDetails + id);
        if (!data) return null;
        const p = JSON.parse(data);
        if (deliversHome && !p.deliversHome) return null;
        if (deliversHome && dist > (p.deliveryRadius || 10)) return null;
        return { pharmacyId, distance.round(dist * 10) / 10, lat, lng, ...p };
      }))).filter(Boolean).slice(0, limit);

      return pharmacies;
    } catch (error) { return []; }
  },

  // Delivery tracking
  updateDeliveryLocation(deliveryId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const key = KEY_PREFIXES.homeopathy.deliveryLocation + deliveryId;
    const geoKey = KEY_PREFIXES.homeopathy.deliveryGeo;
    const data = { deliveryId, lat, lng, timestamp.now(), orderId.orderId || '', status.status || 'in_transit' };
    const pipeline = redis.pipeline();
    pipeline.setex(key, TTL_CONFIG.homeopathy.delivery, JSON.stringify(data));
    pipeline.geoadd(geoKey, lng, lat, deliveryId);
    await pipeline.exec();
    return { success, deliveryId };
  },

  getDeliveryLocation(deliveryId) => {
    const data = await getRedisClient().get(KEY_PREFIXES.homeopathy.deliveryLocation + deliveryId);
    return data ? JSON.parse(data) ;
  }
};

// ============================================
// 🧘 AYURVEDA - Doctor, Center & Delivery Finder
// ============================================

const ayurvedaLocation = {
  registerDoctor(doctorId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const key = KEY_PREFIXES.ayurveda.doctorDetails + doctorId;
    const data = { doctorId, lat, lng, name.name || '', specialization.specialization || [], prakritiSpecialization.prakritiSpecialization || [], rating.rating || 0, ...metadata };
    const pipeline = redis.pipeline();
    pipeline.setex(key, TTL_CONFIG.ayurveda.doctor, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.ayurveda.doctorGeo, lng, lat, doctorId);
    await pipeline.exec();
    return { success, doctorId };
  },

  findNearbyDoctors(lat, lng, radiusKm = 20, filters = {}) => {
    const redis = getRedisClient();
    const { specialization = null, limit = 20 } = filters;
    try {
      const results = await redis.georadius(KEY_PREFIXES.ayurveda.doctorGeo, lng, lat, radiusKm, 'km', 'WITHDIST', 'WITHCOORD', 'COUNT', limit * 2, 'ASC');
      if (!results?.length) return [];
      const doctors = (await Promise.all(results.map(async ([id, dist, [lng, lat]]) => {
        const data = await redis.get(KEY_PREFIXES.ayurveda.doctorDetails + id);
        if (!data) return null;
        const d = JSON.parse(data);
        if (specialization && !d.specialization?.includes(specialization)) return null;
        return { doctorId, distance.round(dist * 10) / 10, lat, lng, ...d };
      }))).filter(Boolean).slice(0, limit);
      return doctors;
    } catch (error) { return []; }
  },

  registerCenter(centerId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const key = KEY_PREFIXES.ayurveda.centerDetails + centerId;
    const data = { centerId, lat, lng, name.name || '', treatments.treatments || [], rating.rating || 0, ...metadata };
    const pipeline = redis.pipeline();
    pipeline.setex(key, TTL_CONFIG.ayurveda.center, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.ayurveda.centerGeo, lng, lat, centerId);
    await pipeline.exec();
    return { success, centerId };
  },

  findNearbyCenters(lat, lng, radiusKm = 30, filters = {}) => {
    const redis = getRedisClient();
    const { treatment = null, limit = 20 } = filters;
    try {
      const results = await redis.georadius(KEY_PREFIXES.ayurveda.centerGeo, lng, lat, radiusKm, 'km', 'WITHDIST', 'WITHCOORD', 'COUNT', limit * 2, 'ASC');
      if (!results?.length) return [];
      const centers = (await Promise.all(results.map(async ([id, dist, [lng, lat]]) => {
        const data = await redis.get(KEY_PREFIXES.ayurveda.centerDetails + id);
        if (!data) return null;
        const c = JSON.parse(data);
        if (treatment && !c.treatments?.includes(treatment)) return null;
        return { centerId, distance.round(dist * 10) / 10, lat, lng, ...c };
      }))).filter(Boolean).slice(0, limit);
      return centers;
    } catch (error) { return []; }
  },

  updateDeliveryLocation(deliveryId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const data = { deliveryId, lat, lng, timestamp.now(), orderId.orderId || '', status.status || 'in_transit' };
    const pipeline = redis.pipeline();
    pipeline.setex(KEY_PREFIXES.ayurveda.deliveryLocation + deliveryId, TTL_CONFIG.ayurveda.delivery, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.ayurveda.deliveryGeo, lng, lat, deliveryId);
    await pipeline.exec();
    return { success, deliveryId };
  },

  getDeliveryLocation(deliveryId) => {
    const data = await getRedisClient().get(KEY_PREFIXES.ayurveda.deliveryLocation + deliveryId);
    return data ? JSON.parse(data) ;
  }
};

// ============================================
// 🏠 CAREGIVERS - Real-time Tracking
// ============================================

const caregiverLocation = {
  updateCaregiverLocation(caregiverId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const data = { caregiverId, lat, lng, timestamp.now(), isAvailable.isAvailable !== false, isOnVisit.isOnVisit || false };
    const pipeline = redis.pipeline();
    pipeline.setex(KEY_PREFIXES.caregiver.caregiverLocation + caregiverId, TTL_CONFIG.caregiver.location, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.caregiver.caregiverGeo, lng, lat, caregiverId);
    pipeline.setex(KEY_PREFIXES.general.heartbeat + 'caregiver:' + caregiverId, TTL_CONFIG.heartbeat.caregiver, Date.now());
    await pipeline.exec();
    return { success, caregiverId };
  },

  findNearbyCaregivers(lat, lng, radiusKm = 10, options = {}) => {
    const redis = getRedisClient();
    try {
      const results = await redis.georadius(KEY_PREFIXES.caregiver.caregiverGeo, lng, lat, radiusKm, 'km', 'WITHDIST', 'WITHCOORD', 'COUNT', (options.limit || 10) * 2, 'ASC');
      if (!results?.length) return [];
      return (await Promise.all(results.map(async ([id, dist, [lng, lat]]) => {
        const data = await redis.get(KEY_PREFIXES.caregiver.caregiverLocation + id);
        if (!data) return null;
        const c = JSON.parse(data);
        if (!c.isAvailable || c.isOnVisit) return null;
        return { caregiverId, distance.round(dist * 10) / 10, lat, lng, ...c };
      }))).filter(Boolean).slice(0, options.limit || 10);
    } catch (error) { return []; }
  }
};

// ============================================
// 💰 HEALTH EMI - EMI-Enabled Hospital Finder
// ============================================

const healthEMILocation = {
  // Register hospital with EMI facility
  registerEMIHospital(hospitalId, lenderIds = []) => {
    const redis = getRedisClient();
    const pipeline = redis.pipeline();
    pipeline.sadd(KEY_PREFIXES.healthEMI.emiHospitals, hospitalId);
    lenderIds.forEach(lenderId => {
      pipeline.sadd(KEY_PREFIXES.healthEMI.emiByHospital + hospitalId, lenderId);
    });
    pipeline.expire(KEY_PREFIXES.healthEMI.emiHospitals, TTL_CONFIG.healthEMI.hospitals);
    await pipeline.exec();
    return { success, hospitalId };
  },

  // Find nearby hospitals offering EMI
  findNearbyEMIHospitals(lat, lng, radiusKm = 15, filters = {}) => {
    const redis = getRedisClient();
    const { lenderId = null, loanAmount = 0, limit = 20 } = filters;

    try {
      // Use hospital geo index, then filter by EMI availability
      const results = await redis.georadius(KEY_PREFIXES.hospital.geo, lng, lat, radiusKm, 'km',
        'WITHDIST', 'WITHCOORD', 'COUNT', limit * 3, 'ASC');
      if (!results?.length) return [];

      const emiSet = await redis.smembers(KEY_PREFIXES.healthEMI.emiHospitals);
      const emiHospitalIds = new Set(emiSet);

      const hospitals = (await Promise.all(results.map(async ([id, dist, [lng, lat]]) => {
        if (!emiHospitalIds.has(id)) return null;

        if (lenderId) {
          const lenders = await redis.smembers(KEY_PREFIXES.healthEMI.emiByHospital + id);
          if (!lenders.includes(lenderId)) return null;
        }

        const data = await redis.get(KEY_PREFIXES.hospital.details + id);
        if (!data) return null;
        const h = JSON.parse(data);
        return { hospitalId, distance.round(dist * 10) / 10, lat, lng, ...h };
      }))).filter(Boolean).slice(0, limit);

      return hospitals;
    } catch (error) { return []; }
  },

  // Get lenders available at a hospital
  getLendersAtHospital(hospitalId) => {
    const redis = getRedisClient();
    return await redis.smembers(KEY_PREFIXES.healthEMI.emiByHospital + hospitalId);
  }
};

// ============================================
// 🏢 CORPORATE - Empaneled Facility Finder
// ============================================

const corporateLocation = {
  // Register empaneled facility for a corporate
  registerEmpaneledFacility(corporateId, facilityId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const geoKey = KEY_PREFIXES.corporate.empaneledGeo + corporateId;
    const detailsKey = KEY_PREFIXES.corporate.empaneledDetails + facilityId;

    const pipeline = redis.pipeline();
    pipeline.geoadd(geoKey, lng, lat, facilityId);
    pipeline.setex(detailsKey, TTL_CONFIG.corporate.empaneled, JSON.stringify({
      facilityId, corporateId, lat, lng,
      name.name || '',
      type.type || 'hospital', // hospital, clinic, diagnostic
      services.services || [],
      ...metadata
    }));
    await pipeline.exec();
    return { success, corporateId, facilityId };
  },

  // Find empaneled facilities near employee
  findEmpaneledFacilities(corporateId, lat, lng, radiusKm = 15, filters = {}) => {
    const redis = getRedisClient();
    const geoKey = KEY_PREFIXES.corporate.empaneledGeo + corporateId;
    const { type = null, limit = 20 } = filters;

    try {
      const results = await redis.georadius(geoKey, lng, lat, radiusKm, 'km',
        'WITHDIST', 'WITHCOORD', 'COUNT', limit * 2, 'ASC');
      if (!results?.length) return [];

      const facilities = (await Promise.all(results.map(async ([id, dist, [lng, lat]]) => {
        const data = await redis.get(KEY_PREFIXES.corporate.empaneledDetails + id);
        if (!data) return null;
        const f = JSON.parse(data);
        if (type && f.type !== type) return null;
        return { facilityId, distance.round(dist * 10) / 10, lat, lng, ...f };
      }))).filter(Boolean).slice(0, limit);

      return facilities;
    } catch (error) { return []; }
  }
};

// ============================================
// 🔬 DIAGNOSTICS - Lab & Phlebotomist Finder
// ============================================

const diagnosticsLocation = {
  registerLab(labId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const data = { labId, lat, lng, name.name || '', tests.tests || [], homeCollection.homeCollection || false, rating.rating || 0, ...metadata };
    const pipeline = redis.pipeline();
    pipeline.setex(KEY_PREFIXES.diagnostics.labDetails + labId, TTL_CONFIG.diagnostics.lab, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.diagnostics.labGeo, lng, lat, labId);
    await pipeline.exec();
    return { success, labId };
  },

  findNearbyLabs(lat, lng, radiusKm = 15, filters = {}) => {
    const redis = getRedisClient();
    const { testName = null, homeCollection = false, limit = 20 } = filters;
    try {
      const results = await redis.georadius(KEY_PREFIXES.diagnostics.labGeo, lng, lat, radiusKm, 'km', 'WITHDIST', 'WITHCOORD', 'COUNT', limit * 2, 'ASC');
      if (!results?.length) return [];
      return (await Promise.all(results.map(async ([id, dist, [lng, lat]]) => {
        const data = await redis.get(KEY_PREFIXES.diagnostics.labDetails + id);
        if (!data) return null;
        const l = JSON.parse(data);
        if (testName && !l.tests?.includes(testName)) return null;
        if (homeCollection && !l.homeCollection) return null;
        return { labId, distance.round(dist * 10) / 10, lat, lng, ...l };
      }))).filter(Boolean).slice(0, limit);
    } catch (error) { return []; }
  },

  updatePhleboLocation(phleboId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const data = { phleboId, lat, lng, timestamp.now(), isAvailable.isAvailable !== false, labId.labId || '' };
    const pipeline = redis.pipeline();
    pipeline.setex(KEY_PREFIXES.diagnostics.phleboLocation + phleboId, TTL_CONFIG.diagnostics.phlebo, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.diagnostics.phleboGeo, lng, lat, phleboId);
    pipeline.setex(KEY_PREFIXES.general.heartbeat + 'diagnostics:' + phleboId, TTL_CONFIG.heartbeat.diagnostics, Date.now());
    await pipeline.exec();
    return { success, phleboId };
  },

  findNearbyPhlebos(lat, lng, radiusKm = 15, options = {}) => {
    const redis = getRedisClient();
    try {
      const results = await redis.georadius(KEY_PREFIXES.diagnostics.phleboGeo, lng, lat, radiusKm, 'km', 'WITHDIST', 'WITHCOORD', 'COUNT', (options.limit || 10) * 2, 'ASC');
      if (!results?.length) return [];
      return (await Promise.all(results.map(async ([id, dist, [lng, lat]]) => {
        const data = await redis.get(KEY_PREFIXES.diagnostics.phleboLocation + id);
        if (!data) return null;
        const p = JSON.parse(data);
        if (!p.isAvailable) return null;
        if (options.labId && p.labId !== options.labId) return null;
        return { phleboId, distance.round(dist * 10) / 10, lat, lng, ...p };
      }))).filter(Boolean).slice(0, options.limit || 10);
    } catch (error) { return []; }
  }
};

// ============================================
// 🧠 MENTAL HEALTH - Therapist & Crisis Center Finder
// ============================================

const mentalHealthLocation = {
  registerTherapist(therapistId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const data = { therapistId, lat, lng, name.name || '', specializations.specializations || [], languages.languages || [], rating.rating || 0, sessionFee.sessionFee || 0, availableOnline.availableOnline || false, ...metadata };
    const pipeline = redis.pipeline();
    pipeline.setex(KEY_PREFIXES.mentalHealth.therapistDetails + therapistId, TTL_CONFIG.mentalHealth.therapist, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.mentalHealth.therapistGeo, lng, lat, therapistId);
    await pipeline.exec();
    return { success, therapistId };
  },

  findNearbyTherapists(lat, lng, radiusKm = 20, filters = {}) => {
    const redis = getRedisClient();
    const { specialization = null, language = null, limit = 20 } = filters;
    try {
      const results = await redis.georadius(KEY_PREFIXES.mentalHealth.therapistGeo, lng, lat, radiusKm, 'km', 'WITHDIST', 'WITHCOORD', 'COUNT', limit * 2, 'ASC');
      if (!results?.length) return [];
      return (await Promise.all(results.map(async ([id, dist, [lng, lat]]) => {
        const data = await redis.get(KEY_PREFIXES.mentalHealth.therapistDetails + id);
        if (!data) return null;
        const t = JSON.parse(data);
        if (specialization && !t.specializations?.includes(specialization)) return null;
        if (language && !t.languages?.includes(language)) return null;
        return { therapistId, distance.round(dist * 10) / 10, lat, lng, ...t };
      }))).filter(Boolean).slice(0, limit);
    } catch (error) { return []; }
  },

  registerCrisisCenter(centerId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const data = { centerId, lat, lng, name.name || '', phone.phone || '', available24x7.available24x7 || true, ...metadata };
    const pipeline = redis.pipeline();
    pipeline.setex(KEY_PREFIXES.mentalHealth.crisisCenterDetails + centerId, TTL_CONFIG.mentalHealth.crisis, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.mentalHealth.crisisCenterGeo, lng, lat, centerId);
    await pipeline.exec();
    return { success, centerId };
  },

  findNearestCrisisCenter(lat, lng) => {
    const redis = getRedisClient();
    try {
      const results = await redis.georadius(KEY_PREFIXES.mentalHealth.crisisCenterGeo, lng, lat, 50, 'km', 'WITHDIST', 'WITHCOORD', 'COUNT', 3, 'ASC');
      if (!results?.length) return [];
      return (await Promise.all(results.map(async ([id, dist, [lng, lat]]) => {
        const data = await redis.get(KEY_PREFIXES.mentalHealth.crisisCenterDetails + id);
        if (!data) return null;
        return { centerId, distance.round(dist * 10) / 10, lat, lng, ...JSON.parse(data) };
      }))).filter(Boolean);
    } catch (error) { return []; }
  }
};

// ============================================
// 📱 ONLINE DOCTOR - Delivery Tracking Only
// ============================================

const onlineDoctorLocation = {
  updateDeliveryLocation(deliveryId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const data = { deliveryId, lat, lng, timestamp.now(), prescriptionId.prescriptionId || '', status.status || 'in_transit' };
    const pipeline = redis.pipeline();
    pipeline.setex(KEY_PREFIXES.onlineDoctor.deliveryLocation + deliveryId, TTL_CONFIG.onlineDoctor.delivery, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.onlineDoctor.deliveryGeo, lng, lat, deliveryId);
    await pipeline.exec();
    return { success, deliveryId };
  },

  getDeliveryLocation(deliveryId) => {
    const data = await getRedisClient().get(KEY_PREFIXES.onlineDoctor.deliveryLocation + deliveryId);
    return data ? JSON.parse(data) ;
  }
};

// ============================================
// 🔒 DISTRIBUTED LOCK
// ============================================

const acquireLock = async (key, ttlSeconds = 30) => {
  const redis = getRedisClient();
  const lockKey = KEY_PREFIXES.general.lockKey + key;
  const lockValue = Date.now().toString();
  const acquired = await redis.set(lockKey, lockValue, 'EX', ttlSeconds, 'NX');
  return acquired === 'OK' ? { acquired, lockKey, lockValue } : { acquired};
};

const releaseLock = async (key, lockValue) => {
  const redis = getRedisClient();
  const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
  await redis.eval(script, 1, KEY_PREFIXES.general.lockKey + key, lockValue);
  return { success};
};

// ============================================
// 📊 HEALTH CHECK & STATS
// ============================================

const getServiceStats = async () => {
  const redis = getRedisClient();
  try {
    const keys = [
      'hospital.geo', 'ambulance.driverGeo', 'homeopathy.doctorGeo', 'homeopathy.pharmacyGeo',
      'ayurveda.doctorGeo', 'ayurveda.centerGeo', 'caregiver.caregiverGeo',
      'diagnostics.labGeo', 'diagnostics.phleboGeo', 'mentalHealth.therapistGeo', 'mentalHealth.crisisCenterGeo'
    ];
    const counts = await Promise.all(keys.map(k => redis.zcard(KEY_PREFIXES[k.split('.')[0]]?.[k.split('.')[1]] || k)));
    return {
      hospitals[0], ambulanceDrivers[1],
      homeopathyDoctors[2], homeopathyPharmacies[3],
      ayurvedaDoctors[4], ayurvedaCenters[5],
      caregivers[6], labs[7], phlebotomists[8],
      therapists[9], crisisCenters[10],
      timestampDate().toISOString()
    };
  } catch (error) { return { error.message }; }
};

const healthCheck = async () => {
  try {
    const pong = await getRedisClient().ping();
    return { status=== 'PONG' ? 'healthy' : 'unhealthy' };
  } catch (error) { return { status: 'unhealthy', error.message }; }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  getRedisClient,
  healthCheck,
  getServiceStats,
  calculateDistance,
  estimateETA,
  getAreaCode,
  acquireLock,
  releaseLock,

  // All 11 Tags
  hospital,
  ambulance,
  insurance,
  homeopathy,
  ayurveda,
  caregiver,
  healthEMI,
  corporate,
  diagnostics,
  mentalHealth,
  onlineDoctor,

  KEY_PREFIXES,
  TTL_CONFIG
};


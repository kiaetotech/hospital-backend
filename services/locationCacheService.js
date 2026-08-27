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
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || '',
  db: process.env.REDIS_DB || 0,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3
};

let redis = null;

const getRedisClient = () => {
  if (!redis) {
    if (process.env.REDIS_URL) {
      redis = new Redis(process.env.REDIS_URL);
    } else {
      redis = new Redis(redisConfig);
    }
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
    geo: 'geo:hospitals',                    // Geospatial index
    details: 'loc:hospital:',               // loc:hospital:{hospitalId}
    filters: 'filter:hospital:',            // filter:hospital:{filterType}
    bySpecialty: 'filter:hospital:specialty:', // filter:hospital:specialty:{specialty}
    byInsurance: 'filter:hospital:insurance:', // filter:hospital:insurance:{insuranceId}
    byEMI: 'filter:hospital:emi',           // Set of hospitals offering EMI
    byCorporate: 'filter:hospital:corporate:', // filter:hospital:corporate:{corporateId}
    byRating: 'filter:hospital:rating',     // Sorted set by rating
    byBeds: 'filter:hospital:beds',         // Hospitals with bed availability
  },

  // 🚑 Ambulance - Real-time driver tracking
  ambulance: {
    driverLocation: 'loc:amb:driver:',      // loc:amb:driver:{driverId}
    driverGeo: 'geo:amb:drivers',           // Geospatial index
    driverStatus: 'status:amb:driver:',     // status:amb:driver:{driverId}
    activeEmergencies: 'emergency:active',  // Active emergency bookings
    areaDemand: 'demand:amb:area:',         // demand:amb:area:{areaCode}
  },

  // 🛡️ Insurance - Network hospital geo-search
  insurance: {
    networkHospitals: 'geo:insurance:network:', // geo:insurance:network:{insuranceId}
    networkDetails: 'loc:insurance:hospital:',  // loc:insurance:hospital:{hospitalId}
  },

  // 🌿 Homeopathy - Doctor & pharmacy locations
  homeopathy: {
    doctorGeo: 'geo:homeo:doctors',         // Geospatial index for doctors
    doctorDetails: 'loc:homeo:doctor:',     // loc:homeo:doctor:{doctorId}
    pharmacyGeo: 'geo:homeo:pharmacies',    // Geospatial index for pharmacies
    pharmacyDetails: 'loc:homeo:pharmacy:', // loc:homeo:pharmacy:{pharmacyId}
    deliveryGeo: 'geo:homeo:deliveries',    // Delivery tracking
    deliveryLocation: 'loc:homeo:delivery:', // loc:homeo:delivery:{deliveryId}
  },

  // 🧘 Ayurveda - Doctor, center & delivery
  ayurveda: {
    doctorGeo: 'geo:ayu:doctors',           // Geospatial index for doctors
    doctorDetails: 'loc:ayu:doctor:',       // loc:ayu:doctor:{doctorId}
    centerGeo: 'geo:ayu:centers',           // Geospatial index for Panchakarma centers
    centerDetails: 'loc:ayu:center:',       // loc:ayu:center:{centerId}
    deliveryGeo: 'geo:ayu:deliveries',      // Delivery tracking
    deliveryLocation: 'loc:ayu:delivery:',  // loc:ayu:delivery:{deliveryId}
  },

  // 🏠 Caregivers - Real-time tracking
  caregiver: {
    caregiverGeo: 'geo:cg:caregivers',      // Geospatial index
    caregiverLocation: 'loc:cg:caregiver:', // loc:cg:caregiver:{caregiverId}
    caregiverStatus: 'status:cg:caregiver:', // status:cg:caregiver:{caregiverId}
  },

  // 💰 Health EMI - EMI-enabled hospital finder
  healthEMI: {
    emiHospitals: 'filter:emi:hospitals',   // Set of hospitals offering EMI
    lenderGeo: 'geo:emi:lenders',           // Lender locations (if applicable)
    emiByHospital: 'filter:emi:byhospital:', // filter:emi:byhospital:{hospitalId} → lenders
  },

  // 🏢 Corporate - Empaneled facility finder
  corporate: {
    empaneledGeo: 'geo:corp:empaneled:',    // geo:corp:empaneled:{corporateId}
    empaneledDetails: 'loc:corp:facility:', // loc:corp:facility:{facilityId}
  },

  // 🔬 Diagnostics - Lab & phlebotomist locations
  diagnostics: {
    labGeo: 'geo:diag:labs',                // Geospatial index for labs
    labDetails: 'loc:diag:lab:',            // loc:diag:lab:{labId}
    phleboGeo: 'geo:diag:phlebos',          // Phlebotomist tracking
    phleboLocation: 'loc:diag:phlebo:',     // loc:diag:phlebo:{phleboId}
  },

  // 🧠 Mental Health - Therapist & crisis center locations
  mentalHealth: {
    therapistGeo: 'geo:mh:therapists',      // Geospatial index for therapists
    therapistDetails: 'loc:mh:therapist:',  // loc:mh:therapist:{therapistId}
    crisisCenterGeo: 'geo:mh:crisis',       // Crisis centers (always available)
    crisisCenterDetails: 'loc:mh:crisis:',  // loc:mh:crisis:{centerId}
  },

  // 📱 Online Doctor - N/A for location (virtual), but delivery tracking
  onlineDoctor: {
    deliveryGeo: 'geo:ondoc:deliveries',    // Prescription delivery tracking
    deliveryLocation: 'loc:ondoc:delivery:', // loc:ondoc:delivery:{deliveryId}
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
  return { distance: distanceKm, estimatedMinutes: Math.round((distanceKm / speed) * 60), mode };
};

const getAreaCode = (lat, lng) => `${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100}`;

// ============================================
// 🏥 HOSPITALS - Static Location + Multi-Filter Search
// ============================================

const hospitalLocation = {
  // Register/Update hospital location
  registerHospital: async (hospitalId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const key = KEY_PREFIXES.hospital.details + hospitalId;
    const geoKey = KEY_PREFIXES.hospital.geo;

    const hospitalData = {
      hospitalId,
      name: metadata.name || '',
      lat,
      lng,
      address: metadata.address || '',
      city: metadata.city || '',
      state: metadata.state || '',
      phone: metadata.phone || '',
      type: metadata.type || 'hospital', // hospital, clinic, nursing_home
      specialties: metadata.specialties || [],
      rating: metadata.rating || 0,
      totalBeds: metadata.totalBeds || 0,
      availableBeds: metadata.availableBeds || 0,
      icuBeds: metadata.icuBeds || 0,
      ventilatorBeds: metadata.ventilatorBeds || 0,
      emergencyAvailable: metadata.emergencyAvailable || false,
      ambulanceAvailable: metadata.ambulanceAvailable || false,
      insuranceNetworks: metadata.insuranceNetworks || [], // List of insurance IDs
      emiAvailable: metadata.emiAvailable || false,
      emiPartners: metadata.emiPartners || [],           // List of lender IDs
      corporatePartners: metadata.corporatePartners || [], // List of corporate IDs
      accreditations: metadata.accreditations || [],      // NABH, JCI, etc.
      facilities: metadata.facilities || [],              // MRI, CT, ICU, etc.
      timings: metadata.timings || '24x7',
      photos: metadata.photos || [],
      lastUpdated: new Date().toISOString()
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
    return { success: true, hospitalId };
  },

  // Find nearby hospitals with filters
  findNearbyHospitals: async (lat, lng, radiusKm = 10, filters = {}) => {
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
      // Step 1: Get hospitals within radius
      const results = await redis.georadius(
        geoKey, lng, lat, radiusKm, 'km',
        'WITHDIST', 'WITHCOORD', 'COUNT', limit * 3, 'ASC'
      );

      if (!results || results.length === 0) return [];

      // Step 2: Get filter sets (if filters applied)
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

      // Step 3: Fetch details and filter
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
          distance: Math.round(distance * 10) / 10,
          lat: hLat,
          lng: hLng,
          ...hospital,
          location: { lat: hLat, lng: hLng }
        };
      });

      let hospitals = (await Promise.all(hospitalPromises)).filter(Boolean);

      // Step 4: Sort
      if (sortBy === 'rating') hospitals.sort((a, b) => b.rating - a.rating);
      else if (sortBy === 'beds') hospitals.sort((a, b) => (b.availableBeds + b.icuBeds) - (a.availableBeds + a.icuBeds));
      // Default: already sorted by distance

      return hospitals.slice(0, limit);
    } catch (error) {
      console.error('Error finding nearby hospitals:', error);
      return [];
    }
  },

  // Get hospital details
  getHospitalDetails: async (hospitalId) => {
    const redis = getRedisClient();
    const data = await redis.get(KEY_PREFIXES.hospital.details + hospitalId);
    return data ? JSON.parse(data) : null;
  },

  // Update hospital bed availability (real-time)
  updateBedAvailability: async (hospitalId, beds) => {
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
  removeHospital: async (hospitalId) => {
    const redis = getRedisClient();
    const pipeline = redis.pipeline();
    pipeline.del(KEY_PREFIXES.hospital.details + hospitalId);
    pipeline.zrem(KEY_PREFIXES.hospital.geo, hospitalId);
    pipeline.zrem(KEY_PREFIXES.hospital.byRating, hospitalId);
    pipeline.zrem(KEY_PREFIXES.hospital.byBeds, hospitalId);
    pipeline.srem(KEY_PREFIXES.hospital.byEMI, hospitalId);
    await pipeline.exec();
    return { success: true, hospitalId };
  }
};

// ============================================
// 🚑 AMBULANCE (Same as before, kept intact)
// ============================================

const ambulanceLocation = {
  getDriverLocation: async (driverId) => {
    try {
      const redis = getRedisClient();
      const data = await redis.get(KEY_PREFIXES.ambulance.driverLocation + driverId);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  },

  updateDriverStatus: async (driverId, status = {}) => {
    try {
      const redis = getRedisClient();
      const key = KEY_PREFIXES.ambulance.driverLocation + driverId;
      const data = await redis.get(key);
      if (!data) return null;
      const parsed = JSON.parse(data);
      parsed.isAvailable = status.isAvailable !== undefined ? status.isAvailable : parsed.isAvailable;
      parsed.lastUpdate = new Date().toISOString();
      await redis.setex(key, TTL_CONFIG.ambulance.driver, JSON.stringify(parsed));
      return parsed;
    } catch (error) {
      return null;
    }
  },

  setDriverOnTrip: async (driverId, tripId) => {
    try {
      const redis = getRedisClient();
      const key = KEY_PREFIXES.ambulance.driverLocation + driverId;
      const data = await redis.get(key);
      if (!data) return null;
      const parsed = JSON.parse(data);
      parsed.isOnTrip = true;
      parsed.tripId = tripId;
      parsed.lastUpdate = new Date().toISOString();
      await redis.setex(key, TTL_CONFIG.ambulance.driver, JSON.stringify(parsed));
      return parsed;
    } catch (error) {
      return null;
    }
  },

  clearDriverTrip: async (driverId) => {
    try {
      const redis = getRedisClient();
      const key = KEY_PREFIXES.ambulance.driverLocation + driverId;
      const data = await redis.get(key);
      if (!data) return null;
      const parsed = JSON.parse(data);
      parsed.isOnTrip = false;
      parsed.tripId = '';
      parsed.lastUpdate = new Date().toISOString();
      await redis.setex(key, TTL_CONFIG.ambulance.driver, JSON.stringify(parsed));
      return parsed;
    } catch (error) {
      return null;
    }
  },

  isDriverOnline: async (driverId) => {
    try {
      const location = await ambulanceLocation.getDriverLocation(driverId);
      return location ? location.isAvailable : false;
    } catch (error) {
      return false;
    }
  },

  updateDriverLocation: async (driverId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    console.log('📍 updateDriverLocation called:', driverId, lat, lng);
    const key = KEY_PREFIXES.ambulance.driverLocation + driverId;
    const geoKey = KEY_PREFIXES.ambulance.driverGeo;

    const locationData = {
      driverId, lat, lng,
      timestamp: Date.now(),
      speed: metadata.speed || 0,
      heading: metadata.heading || 0,
      isAvailable: metadata.isAvailable !== false,
      vehicleType: metadata.vehicleType || 'basic',
      providerId: metadata.providerId || '',
      isOnTrip: metadata.isOnTrip || false,
      tripId: metadata.tripId || '',
      lastUpdate: new Date().toISOString()
    };

    const pipeline = redis.pipeline();
    pipeline.setex(key, TTL_CONFIG.ambulance.driver, JSON.stringify(locationData));
    pipeline.geoadd(geoKey, lng, lat, driverId);
    pipeline.setex(KEY_PREFIXES.general.heartbeat + 'ambulance:' + driverId, TTL_CONFIG.heartbeat.ambulance, Date.now());
    await pipeline.exec();
    return { success: true, driverId, lat, lng };
  },

  findNearbyDrivers: async (lat, lng, radiusKm = 5, options = {}) => {
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
        return { driverId: id, distance: Math.round(dist * 10) / 10, lat, lng, ...d };
      }))).filter(Boolean).slice(0, limit);

      return drivers;
    } catch (error) { return []; }
  },

  removeDriver: async (driverId) => {
    const redis = getRedisClient();
    const pipeline = redis.pipeline();
    pipeline.del(KEY_PREFIXES.ambulance.driverLocation + driverId);
    pipeline.zrem(KEY_PREFIXES.ambulance.driverGeo, driverId);
    pipeline.del(KEY_PREFIXES.general.heartbeat + 'ambulance:' + driverId);
    await pipeline.exec();
    return { success: true, driverId };
  },

  updateAreaDemand: async (lat, lng, demandLevel) => {
    const redis = getRedisClient();
    const key = KEY_PREFIXES.ambulance.areaDemand + getAreaCode(lat, lng);
    await redis.setex(key, 300, demandLevel);
    return { success: true };
  },

  getAreaDemand: async (lat, lng) => {
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
  registerNetworkHospital: async (insuranceId, hospitalId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const geoKey = KEY_PREFIXES.insurance.networkHospitals + insuranceId;
    const detailsKey = KEY_PREFIXES.insurance.networkDetails + hospitalId;

    const pipeline = redis.pipeline();
    pipeline.geoadd(geoKey, lng, lat, hospitalId);
    pipeline.setex(detailsKey, TTL_CONFIG.insurance.details, JSON.stringify({
      hospitalId, insuranceId, lat, lng,
      name: metadata.name || '',
      cashlessAvailable: metadata.cashlessAvailable || false,
      tpaList: metadata.tpaList || [],
      ...metadata
    }));
    await pipeline.exec();
    return { success: true, insuranceId, hospitalId };
  },

  // Find network hospitals near patient
  findNetworkHospitals: async (insuranceId, lat, lng, radiusKm = 15, options = {}) => {
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
        return { hospitalId: id, distance: Math.round(dist * 10) / 10, lat, lng, ...h };
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
  registerDoctor: async (doctorId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const key = KEY_PREFIXES.homeopathy.doctorDetails + doctorId;
    const geoKey = KEY_PREFIXES.homeopathy.doctorGeo;

    const data = { doctorId, lat, lng, name: metadata.name || '', specialization: metadata.specialization || [], rating: metadata.rating || 0, experience: metadata.experience || 0, consultationFee: metadata.consultationFee || 0, availableOnline: metadata.availableOnline || false, ...metadata, lastUpdated: new Date().toISOString() };

    const pipeline = redis.pipeline();
    pipeline.setex(key, TTL_CONFIG.homeopathy.doctor, JSON.stringify(data));
    pipeline.geoadd(geoKey, lng, lat, doctorId);
    await pipeline.exec();
    return { success: true, doctorId };
  },

  // Find nearby homeopathy doctors
  findNearbyDoctors: async (lat, lng, radiusKm = 20, filters = {}) => {
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
        return { doctorId: id, distance: Math.round(dist * 10) / 10, lat, lng, ...d };
      }))).filter(Boolean).slice(0, limit);

      return doctors;
    } catch (error) { return []; }
  },

  // Register homeopathy pharmacy
  registerPharmacy: async (pharmacyId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const key = KEY_PREFIXES.homeopathy.pharmacyDetails + pharmacyId;
    const geoKey = KEY_PREFIXES.homeopathy.pharmacyGeo;

    const data = { pharmacyId, lat, lng, name: metadata.name || '', deliversHome: metadata.deliversHome || false, deliveryRadius: metadata.deliveryRadius || 10, rating: metadata.rating || 0, ...metadata, lastUpdated: new Date().toISOString() };

    const pipeline = redis.pipeline();
    pipeline.setex(key, TTL_CONFIG.homeopathy.pharmacy, JSON.stringify(data));
    pipeline.geoadd(geoKey, lng, lat, pharmacyId);
    await pipeline.exec();
    return { success: true, pharmacyId };
  },

  // Find nearby pharmacies
  findNearbyPharmacies: async (lat, lng, radiusKm = 15, filters = {}) => {
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
        return { pharmacyId: id, distance: Math.round(dist * 10) / 10, lat, lng, ...p };
      }))).filter(Boolean).slice(0, limit);

      return pharmacies;
    } catch (error) { return []; }
  },

  // Delivery tracking
  updateDeliveryLocation: async (deliveryId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const key = KEY_PREFIXES.homeopathy.deliveryLocation + deliveryId;
    const geoKey = KEY_PREFIXES.homeopathy.deliveryGeo;
    const data = { deliveryId, lat, lng, timestamp: Date.now(), orderId: metadata.orderId || '', status: metadata.status || 'in_transit' };
    const pipeline = redis.pipeline();
    pipeline.setex(key, TTL_CONFIG.homeopathy.delivery, JSON.stringify(data));
    pipeline.geoadd(geoKey, lng, lat, deliveryId);
    await pipeline.exec();
    return { success: true, deliveryId };
  },

  getDeliveryLocation: async (deliveryId) => {
    const data = await getRedisClient().get(KEY_PREFIXES.homeopathy.deliveryLocation + deliveryId);
    return data ? JSON.parse(data) : null;
  }
};

// ============================================
// 🧘 AYURVEDA - Doctor, Center & Delivery Finder
// ============================================

const ayurvedaLocation = {
  registerDoctor: async (doctorId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const key = KEY_PREFIXES.ayurveda.doctorDetails + doctorId;
    const data = { doctorId, lat, lng, name: metadata.name || '', specialization: metadata.specialization || [], prakritiSpecialization: metadata.prakritiSpecialization || [], rating: metadata.rating || 0, ...metadata };
    const pipeline = redis.pipeline();
    pipeline.setex(key, TTL_CONFIG.ayurveda.doctor, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.ayurveda.doctorGeo, lng, lat, doctorId);
    await pipeline.exec();
    return { success: true, doctorId };
  },

  findNearbyDoctors: async (lat, lng, radiusKm = 20, filters = {}) => {
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
        return { doctorId: id, distance: Math.round(dist * 10) / 10, lat, lng, ...d };
      }))).filter(Boolean).slice(0, limit);
      return doctors;
    } catch (error) { return []; }
  },

  registerCenter: async (centerId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const key = KEY_PREFIXES.ayurveda.centerDetails + centerId;
    const data = { centerId, lat, lng, name: metadata.name || '', treatments: metadata.treatments || [], rating: metadata.rating || 0, ...metadata };
    const pipeline = redis.pipeline();
    pipeline.setex(key, TTL_CONFIG.ayurveda.center, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.ayurveda.centerGeo, lng, lat, centerId);
    await pipeline.exec();
    return { success: true, centerId };
  },

  findNearbyCenters: async (lat, lng, radiusKm = 30, filters = {}) => {
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
        return { centerId: id, distance: Math.round(dist * 10) / 10, lat, lng, ...c };
      }))).filter(Boolean).slice(0, limit);
      return centers;
    } catch (error) { return []; }
  },

  updateDeliveryLocation: async (deliveryId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const data = { deliveryId, lat, lng, timestamp: Date.now(), orderId: metadata.orderId || '', status: metadata.status || 'in_transit' };
    const pipeline = redis.pipeline();
    pipeline.setex(KEY_PREFIXES.ayurveda.deliveryLocation + deliveryId, TTL_CONFIG.ayurveda.delivery, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.ayurveda.deliveryGeo, lng, lat, deliveryId);
    await pipeline.exec();
    return { success: true, deliveryId };
  },

  getDeliveryLocation: async (deliveryId) => {
    const data = await getRedisClient().get(KEY_PREFIXES.ayurveda.deliveryLocation + deliveryId);
    return data ? JSON.parse(data) : null;
  }
};

// ============================================
// 🏠 CAREGIVERS - Real-time Tracking
// ============================================

const caregiverLocation = {
  updateCaregiverLocation: async (caregiverId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const data = { caregiverId, lat, lng, timestamp: Date.now(), isAvailable: metadata.isAvailable !== false, isOnVisit: metadata.isOnVisit || false };
    const pipeline = redis.pipeline();
    pipeline.setex(KEY_PREFIXES.caregiver.caregiverLocation + caregiverId, TTL_CONFIG.caregiver.location, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.caregiver.caregiverGeo, lng, lat, caregiverId);
    pipeline.setex(KEY_PREFIXES.general.heartbeat + 'caregiver:' + caregiverId, TTL_CONFIG.heartbeat.caregiver, Date.now());
    await pipeline.exec();
    return { success: true, caregiverId };
  },

  findNearbyCaregivers: async (lat, lng, radiusKm = 10, options = {}) => {
    const redis = getRedisClient();
    try {
      const results = await redis.georadius(KEY_PREFIXES.caregiver.caregiverGeo, lng, lat, radiusKm, 'km', 'WITHDIST', 'WITHCOORD', 'COUNT', (options.limit || 10) * 2, 'ASC');
      if (!results?.length) return [];
      return (await Promise.all(results.map(async ([id, dist, [lng, lat]]) => {
        const data = await redis.get(KEY_PREFIXES.caregiver.caregiverLocation + id);
        if (!data) return null;
        const c = JSON.parse(data);
        if (!c.isAvailable || c.isOnVisit) return null;
        return { caregiverId: id, distance: Math.round(dist * 10) / 10, lat, lng, ...c };
      }))).filter(Boolean).slice(0, options.limit || 10);
    } catch (error) { return []; }
  }
};

// ============================================
// 💰 HEALTH EMI - EMI-Enabled Hospital Finder
// ============================================

const healthEMILocation = {
  // Register hospital with EMI facility
  registerEMIHospital: async (hospitalId, lenderIds = []) => {
    const redis = getRedisClient();
    const pipeline = redis.pipeline();
    pipeline.sadd(KEY_PREFIXES.healthEMI.emiHospitals, hospitalId);
    lenderIds.forEach(lenderId => {
      pipeline.sadd(KEY_PREFIXES.healthEMI.emiByHospital + hospitalId, lenderId);
    });
    pipeline.expire(KEY_PREFIXES.healthEMI.emiHospitals, TTL_CONFIG.healthEMI.hospitals);
    await pipeline.exec();
    return { success: true, hospitalId };
  },

  // Find nearby hospitals offering EMI
  findNearbyEMIHospitals: async (lat, lng, radiusKm = 15, filters = {}) => {
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
        return { hospitalId: id, distance: Math.round(dist * 10) / 10, lat, lng, ...h };
      }))).filter(Boolean).slice(0, limit);

      return hospitals;
    } catch (error) { return []; }
  },

  // Get lenders available at a hospital
  getLendersAtHospital: async (hospitalId) => {
    const redis = getRedisClient();
    return await redis.smembers(KEY_PREFIXES.healthEMI.emiByHospital + hospitalId);
  }
};

// ============================================
// 🏢 CORPORATE - Empaneled Facility Finder
// ============================================

const corporateLocation = {
  // Register empaneled facility for a corporate
  registerEmpaneledFacility: async (corporateId, facilityId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const geoKey = KEY_PREFIXES.corporate.empaneledGeo + corporateId;
    const detailsKey = KEY_PREFIXES.corporate.empaneledDetails + facilityId;

    const pipeline = redis.pipeline();
    pipeline.geoadd(geoKey, lng, lat, facilityId);
    pipeline.setex(detailsKey, TTL_CONFIG.corporate.empaneled, JSON.stringify({
      facilityId, corporateId, lat, lng,
      name: metadata.name || '',
      type: metadata.type || 'hospital', // hospital, clinic, diagnostic
      services: metadata.services || [],
      ...metadata
    }));
    await pipeline.exec();
    return { success: true, corporateId, facilityId };
  },

  // Find empaneled facilities near employee
  findEmpaneledFacilities: async (corporateId, lat, lng, radiusKm = 15, filters = {}) => {
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
        return { facilityId: id, distance: Math.round(dist * 10) / 10, lat, lng, ...f };
      }))).filter(Boolean).slice(0, limit);

      return facilities;
    } catch (error) { return []; }
  }
};

// ============================================
// 🔬 DIAGNOSTICS - Lab & Phlebotomist Finder
// ============================================

const diagnosticsLocation = {
  registerLab: async (labId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const data = { labId, lat, lng, name: metadata.name || '', tests: metadata.tests || [], homeCollection: metadata.homeCollection || false, rating: metadata.rating || 0, ...metadata };
    const pipeline = redis.pipeline();
    pipeline.setex(KEY_PREFIXES.diagnostics.labDetails + labId, TTL_CONFIG.diagnostics.lab, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.diagnostics.labGeo, lng, lat, labId);
    await pipeline.exec();
    return { success: true, labId };
  },

  findNearbyLabs: async (lat, lng, radiusKm = 15, filters = {}) => {
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
        return { labId: id, distance: Math.round(dist * 10) / 10, lat, lng, ...l };
      }))).filter(Boolean).slice(0, limit);
    } catch (error) { return []; }
  },

  updatePhleboLocation: async (phleboId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const data = { phleboId, lat, lng, timestamp: Date.now(), isAvailable: metadata.isAvailable !== false, labId: metadata.labId || '' };
    const pipeline = redis.pipeline();
    pipeline.setex(KEY_PREFIXES.diagnostics.phleboLocation + phleboId, TTL_CONFIG.diagnostics.phlebo, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.diagnostics.phleboGeo, lng, lat, phleboId);
    pipeline.setex(KEY_PREFIXES.general.heartbeat + 'diagnostics:' + phleboId, TTL_CONFIG.heartbeat.diagnostics, Date.now());
    await pipeline.exec();
    return { success: true, phleboId };
  },

  findNearbyPhlebos: async (lat, lng, radiusKm = 15, options = {}) => {
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
        return { phleboId: id, distance: Math.round(dist * 10) / 10, lat, lng, ...p };
      }))).filter(Boolean).slice(0, options.limit || 10);
    } catch (error) { return []; }
  }
};

// ============================================
// 🧠 MENTAL HEALTH - Therapist & Crisis Center Finder
// ============================================

const mentalHealthLocation = {
  registerTherapist: async (therapistId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const data = { therapistId, lat, lng, name: metadata.name || '', specializations: metadata.specializations || [], languages: metadata.languages || [], rating: metadata.rating || 0, sessionFee: metadata.sessionFee || 0, availableOnline: metadata.availableOnline || false, ...metadata };
    const pipeline = redis.pipeline();
    pipeline.setex(KEY_PREFIXES.mentalHealth.therapistDetails + therapistId, TTL_CONFIG.mentalHealth.therapist, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.mentalHealth.therapistGeo, lng, lat, therapistId);
    await pipeline.exec();
    return { success: true, therapistId };
  },

  findNearbyTherapists: async (lat, lng, radiusKm = 20, filters = {}) => {
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
        return { therapistId: id, distance: Math.round(dist * 10) / 10, lat, lng, ...t };
      }))).filter(Boolean).slice(0, limit);
    } catch (error) { return []; }
  },

  registerCrisisCenter: async (centerId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const data = { centerId, lat, lng, name: metadata.name || '', phone: metadata.phone || '', available24x7: metadata.available24x7 || true, ...metadata };
    const pipeline = redis.pipeline();
    pipeline.setex(KEY_PREFIXES.mentalHealth.crisisCenterDetails + centerId, TTL_CONFIG.mentalHealth.crisis, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.mentalHealth.crisisCenterGeo, lng, lat, centerId);
    await pipeline.exec();
    return { success: true, centerId };
  },

  findNearestCrisisCenter: async (lat, lng) => {
    const redis = getRedisClient();
    try {
      const results = await redis.georadius(KEY_PREFIXES.mentalHealth.crisisCenterGeo, lng, lat, 50, 'km', 'WITHDIST', 'WITHCOORD', 'COUNT', 3, 'ASC');
      if (!results?.length) return [];
      return (await Promise.all(results.map(async ([id, dist, [lng, lat]]) => {
        const data = await redis.get(KEY_PREFIXES.mentalHealth.crisisCenterDetails + id);
        if (!data) return null;
        return { centerId: id, distance: Math.round(dist * 10) / 10, lat, lng, ...JSON.parse(data) };
      }))).filter(Boolean);
    } catch (error) { return []; }
  }
};

// ============================================
// 📱 ONLINE DOCTOR - Delivery Tracking Only
// ============================================

const onlineDoctorLocation = {
  updateDeliveryLocation: async (deliveryId, lat, lng, metadata = {}) => {
    const redis = getRedisClient();
    const data = { deliveryId, lat, lng, timestamp: Date.now(), prescriptionId: metadata.prescriptionId || '', status: metadata.status || 'in_transit' };
    const pipeline = redis.pipeline();
    pipeline.setex(KEY_PREFIXES.onlineDoctor.deliveryLocation + deliveryId, TTL_CONFIG.onlineDoctor.delivery, JSON.stringify(data));
    pipeline.geoadd(KEY_PREFIXES.onlineDoctor.deliveryGeo, lng, lat, deliveryId);
    await pipeline.exec();
    return { success: true, deliveryId };
  },

  getDeliveryLocation: async (deliveryId) => {
    const data = await getRedisClient().get(KEY_PREFIXES.onlineDoctor.deliveryLocation + deliveryId);
    return data ? JSON.parse(data) : null;
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
  return acquired === 'OK' ? { acquired: true, lockKey, lockValue } : { acquired: false };
};

const releaseLock = async (key, lockValue) => {
  const redis = getRedisClient();
  const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
  await redis.eval(script, 1, KEY_PREFIXES.general.lockKey + key, lockValue);
  return { success: true };
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
      hospitals: counts[0], ambulanceDrivers: counts[1],
      homeopathyDoctors: counts[2], homeopathyPharmacies: counts[3],
      ayurvedaDoctors: counts[4], ayurvedaCenters: counts[5],
      caregivers: counts[6], labs: counts[7], phlebotomists: counts[8],
      therapists: counts[9], crisisCenters: counts[10],
      timestamp: new Date().toISOString()
    };
  } catch (error) { return { error: error.message }; }
};

const healthCheck = async () => {
  try {
    const pong = await getRedisClient().ping();
    return { status: pong === 'PONG' ? 'healthy' : 'unhealthy' };
  } catch (error) { return { status: 'unhealthy', error: error.message }; }
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
  hospital: hospitalLocation,
  ambulance: ambulanceLocation,
  insurance: insuranceLocation,
  homeopathy: homeopathyLocation,
  ayurveda: ayurvedaLocation,
  caregiver: caregiverLocation,
  healthEMI: healthEMILocation,
  corporate: corporateLocation,
  diagnostics: diagnosticsLocation,
  mentalHealth: mentalHealthLocation,
  onlineDoctor: onlineDoctorLocation,

  KEY_PREFIXES,
  TTL_CONFIG
};
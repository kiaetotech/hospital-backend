/**
 * Provider Snapshot Service
 *
 * Resolves provider metadata (city, state, phone, name) at payout creation time.
 * Uses raw MongoDB collection queries to avoid Mongoose model registry issues.
 *
 * Production design principles:
 * - Zero Mongoose model dependency — direct DB access
 * - Single responsibility: resolve + snapshot
 * - Fail-safe: returns Unknown defaults, never throws
 * - Extensible: register new provider types via config
 */

const mongoose = require('mongoose');

// ============================================
// PROVIDER REGISTRY
// Maps provider type → collection name + field paths
// ============================================
const PROVIDER_REGISTRY = {
  'ayurveda_doctor': {
    collection: 'ayurvedadoctors',
    cityPath: 'address.city',
    statePath: 'address.state',
    phonePath: 'phone',
    namePath: 'name'
  },
  'doctor': {
    collection: 'ayurvedadoctors',
    cityPath: 'address.city',
    statePath: 'address.state',
    phonePath: 'phone',
    namePath: 'name'
  },
  'wellness_center': {
    collection: 'wellnesscenters',
    cityPath: 'address.city',
    statePath: 'address.state',
    phonePath: 'phone',
    namePath: 'name'
  },
  'center': {
    collection: 'wellnesscenters',
    cityPath: 'address.city',
    statePath: 'address.state',
    phonePath: 'phone',
    namePath: 'name'
  }

  // Add more provider types here as modules go live:
  // 'hospital': { collection: 'hospitals', cityPath: 'address.city', ... },
  // 'ambulance_provider': { collection: 'ambulancefleets', ... },
  // 'diagnostics_lab': { collection: 'diagnosticsproviders', ... }
};

// ============================================
// HELPERS
// ============================================
function getNested(obj, path, fallback = null) {
  if (!obj || !path) return fallback;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return fallback;
    current = current[part];
  }
  return current ?? fallback;
}

function normalizeCity(rawCity) {
  if (!rawCity || typeof rawCity !== 'string') return 'Unknown';
  const trimmed = rawCity.trim();
  if (!trimmed) return 'Unknown';
  return trimmed
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ============================================
// MAIN API
// ============================================

/**
 * Fetch provider snapshot metadata.
 * Uses direct DB collection lookup — no Mongoose model dependency.
 *
 * @param {string} providerType - e.g. 'ayurveda_doctor'
 * @param {string|ObjectId} providerId
 * @returns {Promise<{name, city, state, phone, found}>}
 *   Never throws. Returns Unknown defaults on failure.
 */
async function getProviderSnapshot(providerType, providerId) {
  const fallback = {
    name: 'Unknown Provider',
    city: 'Unknown',
    state: '',
    phone: '',
    found: false
  };

  try {
    const entry = PROVIDER_REGISTRY[providerType];
    if (!entry) {
      console.warn(`[providerSnapshot] Unknown provider type: ${providerType}`);
      return fallback;
    }

    if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
      console.warn(`[providerSnapshot] Invalid providerId: ${providerId}`);
      return fallback;
    }

    // Direct DB access — bypasses Mongoose model registry entirely
    const db = mongoose.connection.db;
    if (!db) {
      console.warn('[providerSnapshot] MongoDB connection not ready');
      return fallback;
    }

    const objectId = new mongoose.Types.ObjectId(providerId);
    const provider = await db.collection(entry.collection).findOne({ _id: objectId });

    if (!provider) {
      console.warn(`[providerSnapshot] Provider not found: ${providerType}/${providerId}`);
      return fallback;
    }

    return {
      name: getNested(provider, entry.namePath, 'Unknown Provider'),
      city: normalizeCity(getNested(provider, entry.cityPath)),
      state: getNested(provider, entry.statePath, ''),
      phone: getNested(provider, entry.phonePath, ''),
      found: true
    };
  } catch (error) {
    console.error('[providerSnapshot] Failed:', {
      providerType,
      providerId: String(providerId),
      error: error.message
    });
    return fallback;
  }
}

/**
 * Build snapshot + denormalized fields ready to spread into a Payout doc.
 */
async function buildPayoutSnapshotFields(providerType, providerId, fallbackName = null) {
  const snap = await getProviderSnapshot(providerType, providerId);

  return {
    providerName: snap.name || fallbackName || 'Unknown Provider',
    providerCity: snap.city,
    providerSnapshot: {
      name: snap.name || fallbackName || 'Unknown Provider',
      city: snap.city,
      state: snap.state,
      phone: snap.phone,
      capturedAt: new Date()
    }
  };
}

module.exports = {
  getProviderSnapshot,
  buildPayoutSnapshotFields,
  PROVIDER_REGISTRY
};
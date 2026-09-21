/**
 * Provider Snapshot Service
 * Resolves provider city/state/phone at payout creation time.
 * Fail-safe: returns "Unknown" defaults, never throws.
 */

const mongoose = require('mongoose');

// ============================================
// PROVIDER REGISTRY
// Add provider types here as other modules adopt the payout snapshot system.
// ============================================
const PROVIDER_REGISTRY = {
  // Ayurveda — ACTIVE
  'ayurveda_doctor': {
    model: 'AyurvedaDoctor',
    cityPath: 'address.city',
    statePath: 'address.state',
    phonePath: 'phone',
    namePath: 'name'
  },
  'doctor': {
    model: 'AyurvedaDoctor',
    cityPath: 'address.city',
    statePath: 'address.state',
    phonePath: 'phone',
    namePath: 'name'
  },
  'wellness_center': {
    model: 'WellnessCenter',
    cityPath: 'address.city',
    statePath: 'address.state',
    phonePath: 'phone',
    namePath: 'name'
  },
  'center': {
    model: 'WellnessCenter',
    cityPath: 'address.city',
    statePath: 'address.state',
    phonePath: 'phone',
    namePath: 'name'
  }

  // Other tags — add when ready:
  // 'hospital': { model: 'Hospital', cityPath: 'address.city', ... },
  // 'ambulance_provider': { model: 'AmbulanceFleet', cityPath: 'address.city', ... },
  // 'diagnostics_lab': { model: 'DiagnosticsProvider', cityPath: 'address.city', ... },
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
async function getProviderSnapshot(providerType, providerId) {
  const fallback = {
    name: 'Unknown Provider',
    city: 'Unknown',
    state: '',
    phone: '',
    found: false
  };

  try {
    const registryEntry = PROVIDER_REGISTRY[providerType];
    if (!registryEntry) {
      console.warn(`[providerSnapshot] Unknown provider type: ${providerType}`);
      return fallback;
    }

    if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
      console.warn(`[providerSnapshot] Invalid providerId: ${providerId}`);
      return fallback;
    }

    let Model;
    try {
      Model = mongoose.model(registryEntry.model);
    } catch (err) {
      console.warn(`[providerSnapshot] Model not registered: ${registryEntry.model}`);
      return fallback;
    }

        // Full fetch — no projection, avoids Mongoose path quirks
    const provider = await Model.findById(providerId).lean();

    if (!provider) {
      console.warn(`[providerSnapshot] Provider not found: ${providerType}/${providerId}`);
      return fallback;
    }

    return {
      name: getNested(provider, registryEntry.namePath, 'Unknown Provider'),
      city: normalizeCity(getNested(provider, registryEntry.cityPath)),
      state: getNested(provider, registryEntry.statePath, ''),
      phone: getNested(provider, registryEntry.phonePath, ''),
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
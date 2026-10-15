// D:\hospital backend\routes\ads.js
// ============================================
// UNIVERSAL ADVERTISING SYSTEM
// Works for ALL provider types (insurance, hospital, lab, ambulance, etc.)
// Mount: app.use('/api/ads', ...)
// ============================================

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticate } = require('../middleware/auth');

// Try to load universal AdCampaign model
let AdCampaign = null;
try {
  AdCampaign = require('../models/AdCampaign');
} catch (e) {
  // Model not found — fallback to embedded campaigns in provider docs
  AdCampaign = null;
}

// ============================================
// SUPPORTED PROVIDER TYPES
// Must match how your app identifies tags
// ============================================
const PROVIDER_TYPES = [
  'insurance',
  'hospital',
  'diagnostics',
  'ambulance',
  'caregiver',
  'ayurveda',
  'homeopathy',
  'mentalhealth',
  'onlinedoctor',
  'corporate',
  'lender',
];

const PLACEMENTS = [
  'homepage_banner',
  'search_top',
  'search_inline',
  'plan_sidebar',
  'category_page',
  'dashboard_widget',
  'mobile_feed',
  'checkout_upsell',
];

// Map providerType → model + company field
const PROVIDER_MODELS = {
  insurance:      { model: 'InsuranceCompany',   nameField: 'companyName',   embedField: 'adCampaigns' },
  hospital:       { model: 'Hospital',           nameField: 'name',          embedField: 'adCampaigns' },
  diagnostics:    { model: 'DiagnosticsProvider',nameField: 'labName',       embedField: 'adCampaigns' },
  ambulance:      { model: 'AmbulanceProvider',  nameField: 'companyName',   embedField: 'adCampaigns' },
  caregiver:      { model: 'Caregiver',          nameField: 'fullName',      embedField: 'adCampaigns' },
  ayurveda:       { model: 'AyurvedaDoctor',     nameField: 'fullName',      embedField: 'adCampaigns' },
  homeopathy:     { model: 'HomeopathyDoctor',   nameField: 'fullName',      embedField: 'adCampaigns' },
  mentalhealth:   { model: 'MentalHealthTherapist', nameField: 'fullName',   embedField: 'adCampaigns' },
  onlinedoctor:   { model: 'OnlineDoctor',       nameField: 'fullName',      embedField: 'adCampaigns' },
  corporate:      { model: 'CorporateHR',        nameField: 'companyName',   embedField: 'adCampaigns' },
  lender:         { model: 'Lender',             nameField: 'companyName',   embedField: 'adCampaigns' },
};

// ============================================
// HELPER — load campaigns from embedded arrays
// ============================================
async function loadFromEmbedded({ providerType, placement, limit, now, filters = {} }) {
  const cfg = PROVIDER_MODELS[providerType];
  if (!cfg) return [];

  let Model;
  try { Model = require(`../models/${cfg.model}`); }
  catch (e) { return []; }

  const query = { isActive: true, [`${cfg.embedField}.0`]: { $exists: true } };

  // Optional location filters
  if (filters.state) query.state = filters.state;
  if (filters.city) query.city = filters.city;

  const providers = await Model.find(query)
    .select(`${cfg.nameField} logoUrl ${cfg.embedField}`)
    .limit(50)
    .lean();

  const campaigns = [];
  for (const p of providers) {
    for (const camp of (p[cfg.embedField] || [])) {
      if (camp.status !== 'active') continue;
      if (placement && camp.placement !== placement) continue;

      const start = camp.schedule?.startDate ? new Date(camp.schedule.startDate) : null;
      const end = camp.schedule?.endDate ? new Date(camp.schedule.endDate) : null;
      if (start && start > now) continue;
      if (end && end < now) continue;

      // Budget exhausted?
      const spent = camp.metrics?.spend || 0;
      const budget = camp.budget?.total || 0;
      if (budget > 0 && spent >= budget) continue;

      campaigns.push({
        _id: camp._id,
        providerId: p._id,
        providerType,
        providerName: p[cfg.nameField],
        providerLogo: p.logoUrl,
        name: camp.name,
        placement: camp.placement,
        creative: camp.creative,
        metrics: {
          impressions: camp.metrics?.impressions || 0,
          clicks: camp.metrics?.clicks || 0,
          ctr: camp.metrics?.impressions
            ? (camp.metrics.clicks || 0) / camp.metrics.impressions
            : 0,
        },
      });

      if (campaigns.length >= limit) break;
    }
    if (campaigns.length >= limit) break;
  }

  // Sort by CTR desc, then impressions desc
  campaigns.sort((a, b) => b.metrics.ctr - a.metrics.ctr || b.metrics.impressions - a.metrics.impressions);
  return campaigns.slice(0, limit);
}

// ============================================
// GET /api/ads/active
// Query: ?placement=X&providerType=Y&state=&city=&limit=3
// Public — returns active campaigns for a slot
// ============================================
router.get('/active', async (req, res) => {
  try {
    const {
      placement = 'homepage_banner',
      providerType,
      state,
      city,
      limit = 3,
    } = req.query;

    const now = new Date();
    const maxLimit = Math.min(Number(limit) || 3, 10);

    let campaigns = [];

    // Path 1: Universal AdCampaign model
    if (AdCampaign) {
      const query = {
        status: 'active',
        placement,
        'schedule.startDate': { $lte: now },
        'schedule.endDate': { $gte: now },
      };
      if (providerType) query.providerType = providerType;
      if (state) query['targeting.states'] = state;
      if (city) query['targeting.cities'] = city;

      campaigns = await AdCampaign.find(query)
        .sort({ 'metrics.ctr': -1, 'metrics.impressions': -1, createdAt: -1 })
        .limit(maxLimit)
        .lean();
    }

    // Path 2: Fallback — read from embedded campaigns on each provider model
    if (campaigns.length === 0) {
      if (providerType) {
        campaigns = await loadFromEmbedded({
          providerType,
          placement,
          limit: maxLimit,
          now,
          filters: { state, city },
        });
      } else {
        // Fan out across all provider types
        const results = await Promise.all(
          PROVIDER_TYPES.map((pt) =>
            loadFromEmbedded({ providerType: pt, placement, limit: maxLimit, now, filters: { state, city } })
          )
        );
        campaigns = results.flat().slice(0, maxLimit);
      }
    }

    // Sanitize — never expose budgets/internal metrics to public
    const sanitized = campaigns.map((c) => ({
      _id: c._id,
      providerId: c.providerId || c.companyId,
      providerType: c.providerType,
      providerName: c.providerName || c.companyName || c.creative?.providerName,
      providerLogo: c.providerLogo || c.companyLogo,
      name: c.name,
      placement: c.placement,
      creative: {
        headline: c.creative?.headline || '',
        bodyText: c.creative?.bodyText || c.creative?.description || '',
        imageUrl: c.creative?.imageUrl || '',
        ctaText: c.creative?.ctaText || 'Learn More',
        ctaUrl: c.creative?.ctaUrl || '/',
        accentColor: c.creative?.accentColor || '#1565C0',
      },
    }));

    return res.json({ success: true, data: sanitized, count: sanitized.length });
  } catch (e) {
    console.error('[ads/active]', e);
    return res.status(500).json({ success: false, message: 'Failed to load ads' });
  }
});

// ============================================
// POST /api/ads/impression
// Body: { campaignId, placement, providerType }
// Public — fires when an ad is rendered
// Cost: ₹0.02 per impression (configurable)
// ============================================
router.post('/impression', async (req, res) => {
  try {
    const { campaignId, providerType } = req.body;
    if (!campaignId) return res.status(400).json({ success: false, message: 'campaignId required' });

    const COST = 0.02;

    // Try universal model first
    if (AdCampaign && mongoose.Types.ObjectId.isValid(campaignId)) {
      const updated = await AdCampaign.findByIdAndUpdate(
        campaignId,
        {
          $inc: { 'metrics.impressions': 1, 'metrics.spend': COST },
          $set: { 'metrics.lastImpressionAt': new Date() },
        },
        { new: true }
      );
      if (updated) return res.json({ success: true, source: 'universal' });
    }

    // Fallback: search across embedded campaigns
    const typesToCheck = providerType ? [providerType] : PROVIDER_TYPES;
    for (const pt of typesToCheck) {
      const cfg = PROVIDER_MODELS[pt];
      if (!cfg) continue;
      let Model;
      try { Model = require(`../models/${cfg.model}`); } catch { continue; }

      const provider = await Model.findOne({ [`${cfg.embedField}._id`]: campaignId });
      if (provider) {
        const camp = provider[cfg.embedField].id(campaignId);
        if (camp) {
          camp.metrics = camp.metrics || {};
          camp.metrics.impressions = (camp.metrics.impressions || 0) + 1;
          camp.metrics.spend = (camp.metrics.spend || 0) + COST;
          camp.metrics.lastImpressionAt = new Date();
          await provider.save();
          return res.json({ success: true, source: 'embedded', providerType: pt });
        }
      }
    }

    return res.json({ success: true, source: 'not_found_ignored' });
  } catch (e) {
    console.error('[ads/impression]', e);
    return res.status(500).json({ success: false, message: 'Failed to track impression' });
  }
});

// ============================================
// POST /api/ads/click
// Body: { campaignId, providerType }
// Public — fires when user clicks an ad
// Cost: ₹1.50 per click (configurable)
// ============================================
router.post('/click', async (req, res) => {
  try {
    const { campaignId, providerType } = req.body;
    if (!campaignId) return res.status(400).json({ success: false, message: 'campaignId required' });

    const COST = 1.5;

    if (AdCampaign && mongoose.Types.ObjectId.isValid(campaignId)) {
      const updated = await AdCampaign.findByIdAndUpdate(
        campaignId,
        {
          $inc: { 'metrics.clicks': 1, 'metrics.spend': COST },
          $set: { 'metrics.lastClickAt': new Date() },
        },
        { new: true }
      );
      if (updated) return res.json({ success: true, source: 'universal' });
    }

    const typesToCheck = providerType ? [providerType] : PROVIDER_TYPES;
    for (const pt of typesToCheck) {
      const cfg = PROVIDER_MODELS[pt];
      if (!cfg) continue;
      let Model;
      try { Model = require(`../models/${cfg.model}`); } catch { continue; }

      const provider = await Model.findOne({ [`${cfg.embedField}._id`]: campaignId });
      if (provider) {
        const camp = provider[cfg.embedField].id(campaignId);
        if (camp) {
          camp.metrics = camp.metrics || {};
          camp.metrics.clicks = (camp.metrics.clicks || 0) + 1;
          camp.metrics.spend = (camp.metrics.spend || 0) + COST;
          camp.metrics.lastClickAt = new Date();
          await provider.save();
          return res.json({ success: true, source: 'embedded', providerType: pt });
        }
      }
    }

    return res.json({ success: true, source: 'not_found_ignored' });
  } catch (e) {
    console.error('[ads/click]', e);
    return res.status(500).json({ success: false, message: 'Failed to track click' });
  }
});

// ============================================
// GET /api/ads/placements
// Public — returns the list of supported placements
// ============================================
router.get('/placements', (req, res) => {
  return res.json({
    success: true,
    data: PLACEMENTS.map((p) => ({ value: p, label: p.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) })),
    providerTypes: PROVIDER_TYPES,
  });
});

module.exports = router;
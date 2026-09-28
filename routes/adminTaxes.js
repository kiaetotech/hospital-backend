const express = require('express');
const router = express.Router();
const TdsConfig = require('../models/TdsConfig');
const GstConfig = require('../models/GstConfig');
const tdsService = require('../services/tdsService');
const gstService = require('../services/gstService');

// ============================================
// ADMIN AUTH MIDDLEWARE (same pattern as existing)
// ============================================
const requireAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && adminKey === process.env.ADMIN_KEY) return next();

  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin') return next();
    } catch (e) {}
  }
  return res.status(401).json({ success: false, error: 'Admin authentication required' });
};

// ============================================
// TDS ROUTES
// ============================================

// List TDS rules
router.get('/tds', requireAdmin, async (req, res) => {
  try {
    const { serviceType, scopeType, isActive, search } = req.query;
    const query = {};
    if (serviceType) query.serviceType = serviceType;
    if (scopeType) query.scopeType = scopeType;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { configName: { $regex: search, $options: 'i' } },
        { scopeValue: { $regex: search, $options: 'i' } }
      ];
    }
    const rules = await TdsConfig.find(query)
      .sort({ priority: -1, effectiveFrom: -1 })
      .lean();
    res.json({ success: true, count: rules.length, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create TDS rule
router.post('/tds', requireAdmin, async (req, res) => {
  try {
    const {
      configName, description, scopeType, scopeValue, scopeState,
      serviceType, section, ratePercent, thresholdPerFY,
      priority, effectiveFrom, effectiveUntil, notificationRef,
      changeReason, adminNotes
    } = req.body;

    if (!serviceType) return res.status(400).json({ success: false, error: 'serviceType required' });
    if (ratePercent != null && (ratePercent < 0 || ratePercent > 100)) {
      return res.status(400).json({ success: false, error: 'ratePercent must be 0-100' });
    }
    if (scopeType && scopeType !== 'global' && !scopeValue) {
      return res.status(400).json({ success: false, error: 'scopeValue required for non-global scope' });
    }

    const rule = new TdsConfig({
      configId: `TDS_${serviceType.toUpperCase()}_${Date.now()}`,
      configName: configName || `${serviceType} — ${scopeType || 'global'}`,
      description: description || '',
      scopeType: scopeType || 'global',
      scopeValue: scopeValue || null,
      scopeState: scopeState || null,
      serviceType,
      section: section || '194-O',
      ratePercent: ratePercent ?? 0,
      thresholdPerFY: thresholdPerFY ?? 0,
      priority: priority ?? 0,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
      isActive: true,
      isDefault: false,
      createdBy: 'admin',
      updatedBy: 'admin',
      notificationRef: notificationRef || '',
      changeReason: changeReason || 'Admin created',
      adminNotes: adminNotes || ''
    });

    await rule.save();
    res.status(201).json({ success: true, message: 'TDS rule created', data: rule });
  } catch (error) {
    console.error('[adminTaxes.tds.create]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update TDS rule
router.put('/tds/:id', requireAdmin, async (req, res) => {
  try {
    const rule = await TdsConfig.findById(req.params.id);
    if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });

    const tracked = ['ratePercent', 'thresholdPerFY', 'section', 'priority', 'effectiveUntil', 'isActive', 'notificationRef'];
    const changes = [];
    tracked.forEach(f => {
      if (req.body[f] !== undefined && req.body[f] !== rule[f]) {
        changes.push({ field: f, oldValue: rule[f], newValue: req.body[f] });
        rule[f] = req.body[f];
      }
    });

    if (changes.length === 0) {
      return res.status(400).json({ success: false, error: 'No changes detected' });
    }

    rule.version = (rule.version || 1) + 1;
    rule.updatedBy = 'admin';
    rule.updatedAt = new Date();
    if (req.body.changeReason) rule.changeReason = req.body.changeReason;

    await rule.save();
    res.json({ success: true, message: `Updated (v${rule.version})`, data: rule, changes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deactivate TDS rule (soft delete)
router.delete('/tds/:id', requireAdmin, async (req, res) => {
  try {
    const rule = await TdsConfig.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedAt: new Date(), updatedBy: 'admin' },
      { new: true }
    );
    if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
    res.json({ success: true, message: 'Rule deactivated', data: rule });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Preview TDS calculation
router.post('/tds/preview', requireAdmin, async (req, res) => {
  try {
    const { serviceType, providerId, city, state, payoutAmount = 10000 } = req.body;
    if (!serviceType) return res.status(400).json({ success: false, error: 'serviceType required' });

    const result = await tdsService.preview({
      serviceType, providerId, city, state, payoutAmount
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Report: TDS by provider for a period
router.get('/tds/report', requireAdmin, async (req, res) => {
  try {
    const { from, to } = req.query;
    const match = { tdsDeducted: { $gt: 0 } };
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    const Payout = require('../models/Payout');
    const result = await Payout.aggregate([
      { $match: match },
      {
        $group: {
          _id: { providerId: '$providerId', providerType: '$providerType', section: '$tdsSection' },
          providerName: { $first: '$providerName' },
          totalTds: { $sum: '$tdsDeducted' },
          totalPaid: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalTds: -1 } }
    ]);

    const totals = result.reduce((acc, r) => acc + r.totalTds, 0);
    res.json({ success: true, data: result, totalTds: totals });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GST ROUTES
// ============================================

// List GST rules
router.get('/gst', requireAdmin, async (req, res) => {
  try {
    const { serviceType, scopeType, isActive, search } = req.query;
    const query = {};
    if (serviceType) query.serviceType = serviceType;
    if (scopeType) query.scopeType = scopeType;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { configName: { $regex: search, $options: 'i' } },
        { scopeValue: { $regex: search, $options: 'i' } }
      ];
    }
    const rules = await GstConfig.find(query)
      .sort({ serviceType: 1, priority: -1, effectiveFrom: -1 })
      .lean();
    res.json({ success: true, count: rules.length, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create GST rule
router.post('/gst', requireAdmin, async (req, res) => {
  try {
    const {
      configName, description, scopeType, scopeValue, scopeState,
      serviceType, ratePercent, hsnSacCode, chargeTo,
      isExempt, exemptionReason, reverseCharge,
      priority, effectiveFrom, effectiveUntil, notificationRef,
      changeReason, adminNotes
    } = req.body;

    if (!serviceType) return res.status(400).json({ success: false, error: 'serviceType required' });
    if (ratePercent != null && (ratePercent < 0 || ratePercent > 28)) {
      return res.status(400).json({ success: false, error: 'ratePercent must be 0-28' });
    }

    const rule = new GstConfig({
      configId: `GST_${serviceType.toUpperCase()}_${Date.now()}`,
      configName: configName || `${serviceType} GST`,
      description: description || '',
      scopeType: scopeType || 'global',
      scopeValue: scopeValue || null,
      scopeState: scopeState || null,
      serviceType,
      ratePercent: isExempt ? 0 : (ratePercent ?? 18),
      hsnSacCode: hsnSacCode || '',
      chargeTo: chargeTo || 'patient',
      isExempt: isExempt || false,
      exemptionReason: exemptionReason || '',
      reverseCharge: reverseCharge || false,
      priority: priority ?? 0,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
      isActive: true,
      createdBy: 'admin',
      updatedBy: 'admin',
      notificationRef: notificationRef || '',
      changeReason: changeReason || 'Admin created',
      adminNotes: adminNotes || ''
    });

    await rule.save();
    res.status(201).json({ success: true, message: 'GST rule created', data: rule });
  } catch (error) {
    console.error('[adminTaxes.gst.create]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update GST rule
router.put('/gst/:id', requireAdmin, async (req, res) => {
  try {
    const rule = await GstConfig.findById(req.params.id);
    if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });

    const tracked = ['ratePercent', 'hsnSacCode', 'chargeTo', 'isExempt', 'reverseCharge', 'priority', 'effectiveUntil', 'isActive', 'notificationRef'];
    const changes = [];
    tracked.forEach(f => {
      if (req.body[f] !== undefined && req.body[f] !== rule[f]) {
        changes.push({ field: f, oldValue: rule[f], newValue: req.body[f] });
        rule[f] = req.body[f];
      }
    });

    if (changes.length === 0) {
      return res.status(400).json({ success: false, error: 'No changes detected' });
    }

    rule.version = (rule.version || 1) + 1;
    rule.updatedBy = 'admin';
    rule.updatedAt = new Date();
    if (req.body.changeReason) rule.changeReason = req.body.changeReason;

    await rule.save();
    res.json({ success: true, message: `Updated (v${rule.version})`, data: rule, changes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deactivate GST rule
router.delete('/gst/:id', requireAdmin, async (req, res) => {
  try {
    const rule = await GstConfig.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedAt: new Date(), updatedBy: 'admin' },
      { new: true }
    );
    if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
    res.json({ success: true, message: 'Rule deactivated', data: rule });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Preview GST
router.post('/gst/preview', requireAdmin, async (req, res) => {
  try {
    const { serviceType, baseAmount = 10000, providerId, city, state } = req.body;
    if (!serviceType) return res.status(400).json({ success: false, error: 'serviceType required' });
    const result = await gstService.calculate({ serviceType, baseAmount, providerId, city, state });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SEED ENDPOINTS
// ============================================

// Seed default GST rules (18% for all service types)
router.post('/seed/gst', requireAdmin, async (req, res) => {
  const serviceTypes = [
    'hospital_opd', 'hospital_admission', 'ambulance', 'ambulance_emergency',
    'ambulance_scheduled', 'labtest', 'health_package', 'caregiver',
    'ayurveda_consultation', 'ayurveda_panchakarma', 'ayurveda_online_doctor',
    'ayurveda_wellness_center', 'ayurveda_home_therapy', 'ayurveda_medicine',
    'ayurveda_product', 'ayurveda_corporate', 'homeopathy_consult',
    'homeopathy_medicine', 'insurance', 'online_consult', 'mental_health',
    'health_emi', 'corporate_health', 'platform_commission'
  ];

  const results = [];
  for (const st of serviceTypes) {
    try {
      const existing = await GstConfig.findOne({ serviceType: st, isActive: true });
      if (existing) {
        results.push({ serviceType: st, status: 'exists' });
        continue;
      }
      const rule = new GstConfig({
        configId: `GST_${st.toUpperCase()}_SEED_${Date.now()}`,
        configName: `${st} — default 18%`,
        serviceType: st,
        ratePercent: 18,
        chargeTo: st === 'platform_commission' ? 'provider' : 'patient',
        scopeType: 'global',
        effectiveFrom: new Date(),
        isActive: true,
        isDefault: true,
        createdBy: 'seed',
        changeReason: 'Initial seed'
      });
      await rule.save();
      results.push({ serviceType: st, status: 'created' });
    } catch (e) {
      results.push({ serviceType: st, status: 'error', error: e.message });
    }
  }
  res.json({ success: true, count: results.length, results });
});

// (Optional) Seed zero-rate TDS rules — not created by default
// Admin adds rules manually when compliance requires
router.post('/seed/tds', requireAdmin, async (req, res) => {
  res.json({
    success: true,
    message: 'No TDS rules seeded. Admin adds rules when required by law. Default = 0% deduction.'
  });
});

module.exports = router;
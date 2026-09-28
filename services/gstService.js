const GstConfig = require('../models/GstConfig');

// ============================================
// GST SERVICE
// ============================================
// Calculates GST for bookings + platform commission.
// Default behavior: 18% (seeded). Admin can override per service.
// ============================================

// --------------------------------------------
// Resolve rate for a service
// --------------------------------------------
async function resolveRate({ serviceType, providerId, city, state }) {
  const config = await GstConfig.resolve({ serviceType, providerId, city, state });
  if (!config) {
    // Safe fallback: 18% if no config exists
    return {
      ratePercent: 18,
      hsnSacCode: '',
      isExempt: false,
      chargeTo: 'patient',
      configId: null
    };
  }
  return {
    ratePercent: config.ratePercent,
    hsnSacCode: config.hsnSacCode,
    isExempt: config.isExempt,
    chargeTo: config.chargeTo,
    exemptionReason: config.exemptionReason,
    configId: config._id,
    configVersion: config.version
  };
}

// --------------------------------------------
// Calculate GST on a base amount
// Returns: { gstAmount, ratePercent, ... }
// --------------------------------------------
async function calculate({ serviceType, baseAmount, providerId, city, state }) {
  const resolved = await resolveRate({ serviceType, providerId, city, state });

  if (resolved.isExempt) {
    return {
      gstAmount: 0,
      ratePercent: 0,
      hsnSacCode: resolved.hsnSacCode,
      isExempt: true,
      exemptionReason: resolved.exemptionReason,
      configId: resolved.configId
    };
  }

  const gstAmount = Math.round((baseAmount * resolved.ratePercent / 100) * 100) / 100;

  return {
    gstAmount,
    ratePercent: resolved.ratePercent,
    hsnSacCode: resolved.hsnSacCode,
    isExempt: false,
    chargeTo: resolved.chargeTo,
    configId: resolved.configId
  };
}

// --------------------------------------------
// GST on platform commission (your own revenue)
// --------------------------------------------
async function calculateOnCommission(platformCommission) {
  const resolved = await resolveRate({ serviceType: 'platform_commission' });
  const gstAmount = Math.round((platformCommission * resolved.ratePercent / 100) * 100) / 100;
  return {
    gstOnCommission: gstAmount,
    ratePercent: resolved.ratePercent,
    configId: resolved.configId
  };
}

// --------------------------------------------
// Split CGST/SGST vs IGST based on place of supply
// --------------------------------------------
function splitForInvoice({ gstAmount, patientState, providerState }) {
  if (!patientState || !providerState) {
    // Unknown → treat as intra-state (CGST + SGST)
    return {
      cgst: Math.round(gstAmount / 2 * 100) / 100,
      sgst: Math.round(gstAmount / 2 * 100) / 100,
      igst: 0
    };
  }

  if (String(patientState).toLowerCase() === String(providerState).toLowerCase()) {
    // Intra-state
    return {
      cgst: Math.round(gstAmount / 2 * 100) / 100,
      sgst: Math.round(gstAmount / 2 * 100) / 100,
      igst: 0
    };
  }

  // Inter-state
  return { cgst: 0, sgst: 0, igst: gstAmount };
}

// --------------------------------------------
// GSTR-1 report data
// --------------------------------------------
async function buildGstr1Report({ from, to, BookingModel }) {
  const match = {
    paymentStatus: 'paid',
    createdAt: { $gte: new Date(from), $lte: new Date(to) }
  };

  const result = await BookingModel.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$gstRate',
        taxableValue: { $sum: { $ifNull: ['$baseAmount', '$finalAmount'] } },
        gst: { $sum: { $ifNull: ['$gstAmount', 0] } },
        cgst: { $sum: { $ifNull: ['$cgst', 0] } },
        sgst: { $sum: { $ifNull: ['$sgst', 0] } },
        igst: { $sum: { $ifNull: ['$igst', 0] } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const totals = result.reduce((acc, r) => ({
    taxableValue: acc.taxableValue + r.taxableValue,
    gst: acc.gst + r.gst,
    cgst: acc.cgst + r.cgst,
    sgst: acc.sgst + r.sgst,
    igst: acc.igst + r.igst,
    count: acc.count + r.count
  }), { taxableValue: 0, gst: 0, cgst: 0, sgst: 0, igst: 0, count: 0 });

  return {
    period: { from, to },
    byRate: result.map(r => ({
      rate: r._id || 0,
      taxableValue: Math.round(r.taxableValue * 100) / 100,
      gst: Math.round(r.gst * 100) / 100,
      cgst: Math.round(r.cgst * 100) / 100,
      sgst: Math.round(r.sgst * 100) / 100,
      igst: Math.round(r.igst * 100) / 100,
      count: r.count
    })),
    totals
  };
}

module.exports = {
  calculate,
  calculateOnCommission,
  splitForInvoice,
  buildGstr1Report,
  resolveRate
};
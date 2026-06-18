// D:\hospital backend\services\commissionService.js

// ============================================
// COMMISSION SERVICE - For ALL Tags
// ============================================

/**
 * Calculate platform commission for any transaction
 * Supports: Hospitals, Ambulance, Caregivers, Diagnostics, Health Packages, Loans
 */

// ============================================
// COMMISSION RATES (Configurable)
// ============================================

const COMMISSION_RATES = {
  // Hospital
  hospital: {
    opd: { type: 'percentage', rate: 5 },        // 5% of booking amount
    admission: { type: 'percentage', rate: 3 },   // 3% of admission amount
    default: { type: 'percentage', rate: 4 }
  },
  
  // Ambulance
  ambulance: {
    default: { type: 'percentage', rate: 8 }      // 8% of ambulance fare
  },
  
  // Caregiver
  caregiver: {
    default: { type: 'percentage', rate: 10 }     // 10% of caregiver fee
  },
  
  // Diagnostics
  diagnostics: {
    labtest: { type: 'percentage', rate: 7 },     // 7% of lab test amount
    health_package: { type: 'percentage', rate: 6 }, // 6% of health package
    default: { type: 'percentage', rate: 7 }
  },
  
  // Loan
  loan: {
    disbursal: { type: 'percentage', rate: 2 },   // 2% of loan disbursal amount
    default: { type: 'percentage', rate: 2 }
  },
  
  // General
  general: {
    default: { type: 'percentage', rate: 5 }
  }
};

// ============================================
// FIXED COMMISSIONS (For specific services)
// ============================================

const FIXED_COMMISSIONS = {
  // Example: Fixed commission for specific services
  // 'service_id': { type: 'fixed', amount: 100 }
};

// ============================================
// MAIN COMMISSION CALCULATION FUNCTION
// ============================================

const calculateCommission = (bookingType, amount, serviceId = null, metadata = {}) => {
  let commissionAmount = 0;
  let commissionRate = 0;
  let commissionType = 'percentage';
  let breakdown = [];
  
  // Case 1: Check if fixed commission exists
  if (serviceId && FIXED_COMMISSIONS[serviceId]) {
    const fixed = FIXED_COMMISSIONS[serviceId];
    commissionAmount = fixed.amount;
    commissionType = 'fixed';
    commissionRate = 0;
    breakdown.push({
      type: 'fixed',
      rate: 0,
      amount: fixed.amount,
      description: `Fixed commission for ${serviceId}`
    });
    return { commissionAmount, commissionRate, commissionType, breakdown };
  }
  
  // Case 2: Calculate based on booking type
  let rateConfig = null;
  
  // Hospital
  if (bookingType === 'opd') {
    rateConfig = COMMISSION_RATES.hospital.opd;
  } else if (bookingType === 'admission') {
    rateConfig = COMMISSION_RATES.hospital.admission;
  } 
  // Ambulance
  else if (bookingType === 'ambulance') {
    rateConfig = COMMISSION_RATES.ambulance.default;
  } 
  // Caregiver
  else if (bookingType === 'caregiver') {
    rateConfig = COMMISSION_RATES.caregiver.default;
  } 
  // Diagnostics
  else if (bookingType === 'labtest') {
    rateConfig = COMMISSION_RATES.diagnostics.labtest;
  } else if (bookingType === 'health_package') {
    rateConfig = COMMISSION_RATES.diagnostics.health_package;
  } 
  // Loan
  else if (bookingType === 'loan') {
    rateConfig = COMMISSION_RATES.loan.default;
  } 
  // Default
  else {
    rateConfig = COMMISSION_RATES.general.default;
  }
  
  // Calculate commission
  if (rateConfig) {
    commissionType = rateConfig.type || 'percentage';
    commissionRate = rateConfig.rate || 0;
    
    if (commissionType === 'percentage') {
      commissionAmount = (amount * commissionRate) / 100;
    } else if (commissionType === 'fixed') {
      commissionAmount = commissionRate;
    }
  }
  
  // Add breakdown
  breakdown.push({
    type: commissionType,
    rate: commissionRate,
    amount: commissionAmount,
    description: `${bookingType} commission at ${commissionRate}%`
  });
  
  // Round to 2 decimal places
  commissionAmount = Math.round(commissionAmount * 100) / 100;
  
  return {
    commissionAmount,
    commissionRate,
    commissionType,
    breakdown,
    // Additional details for logging
    bookingType,
    originalAmount: amount,
    netAmount: amount - commissionAmount
  };
};

// ============================================
// CALCULATE COMMISSION FOR BOOKING
// ============================================

const calculateBookingCommission = (booking) => {
  const bookingType = booking.bookingType || 'general';
  const amount = booking.finalAmount || booking.originalAmount || 0;
  const serviceId = booking.hospitalId || booking.providerId || booking.caregiverId;
  
  return calculateCommission(bookingType, amount, serviceId, {
    bookingId: booking.bookingId,
    patientName: booking.patientName,
    hospitalName: booking.hospitalName || booking.providerName
  });
};

// ============================================
// CALCULATE COMMISSION FOR LOAN
// ============================================

const calculateLoanCommission = (loanApplication) => {
  const amount = loanApplication.disbursedAmount || loanApplication.estimatedAmount || 0;
  const bookingType = 'loan';
  
  return calculateCommission(bookingType, amount, loanApplication.lenderId, {
    applicationId: loanApplication.applicationId,
    lenderName: loanApplication.lender
  });
};

// ============================================
// GET COMMISSION RATE FOR PROVIDER
// ============================================

const getCommissionRate = (bookingType, providerId = null) => {
  if (bookingType === 'opd') {
    return COMMISSION_RATES.hospital.opd;
  } else if (bookingType === 'admission') {
    return COMMISSION_RATES.hospital.admission;
  } else if (bookingType === 'ambulance') {
    return COMMISSION_RATES.ambulance.default;
  } else if (bookingType === 'caregiver') {
    return COMMISSION_RATES.caregiver.default;
  } else if (bookingType === 'labtest') {
    return COMMISSION_RATES.diagnostics.labtest;
  } else if (bookingType === 'health_package') {
    return COMMISSION_RATES.diagnostics.health_package;
  } else if (bookingType === 'loan') {
    return COMMISSION_RATES.loan.default;
  }
  return COMMISSION_RATES.general.default;
};

// ============================================
// UPDATE COMMISSION RATE (Admin only)
// ============================================

const updateCommissionRate = (bookingType, rateConfig) => {
  if (COMMISSION_RATES[bookingType]) {
    COMMISSION_RATES[bookingType].default = rateConfig;
    return { success: true, message: `Commission rate updated for ${bookingType}` };
  }
  return { success: false, message: `Booking type ${bookingType} not found` };
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  calculateCommission,
  calculateBookingCommission,
  calculateLoanCommission,
  getCommissionRate,
  updateCommissionRate,
  COMMISSION_RATES,
  FIXED_COMMISSIONS
};
// D:\hospital backend\services\commissionService.js

// ============================================
// COMMISSION SERVICE - For ALL 11 Tags
// ============================================

/**
 * Calculate platform commission for any transaction
 * Supports ALL 11 Tags with specialized sub-types,
 * performance-based adjustments, and admin configurability
 * 
 * Tags, Ambulance, Insurance, Homeopathy,
 *       Ayurveda, Caregivers, Health EMI, Corporate Health,
 *       Diagnostics, Mental Health, Online Doctor
 */

// ============================================
// COMMISSION RATES (All 11 Tags - Configurable by Admin)
// ============================================

const COMMISSION_RATES = {
  
  // ============================================
  // 🏥 TAG 1// ============================================
  hospital: {
    opd: { type: 'percentage', rate: 15, label: 'OPD Consultation' },
    admission: { type: 'percentage', rate: 10, label: 'IPD Admission' },
    emergency_booking: { type: 'percentage', rate: 8, label: 'Emergency Booking' },
    surgery_package: { type: 'percentage', rate: 7, label: 'Surgery Package' },
    room_booking: { type: 'percentage', rate: 12, label: 'Room Booking' },
    default: { type: 'percentage', rate: 15 }
  },
  
  // ============================================
  // 🚑 TAG 2// ============================================
  ambulance: {
    emergency: { type: 'percentage', rate: 12, label: 'Emergency Ambulance' },
    scheduled: { type: 'percentage', rate: 18, label: 'Scheduled Ambulance' },
    intercity: { type: 'percentage', rate: 15, label: 'Intercity Transport' },
    neonatal: { type: 'percentage', rate: 10, label: 'Neonatal Ambulance' },
    mortuary: { type: 'percentage', rate: 12, label: 'Mortuary Transport' },
    default: { type: 'percentage', rate: 15 }
  },
  
  // ============================================
  // 🛡️ TAG 3INSURANCE
  // ============================================
  insurance: {
    new_policy: { type: 'percentage', rate: 15, label: 'New Policy' },
    renewal: { type: 'percentage', rate: 5, label: 'Policy Renewal' },
    family_floater: { type: 'percentage', rate: 12, label: 'Family Floater' },
    senior_citizen: { type: 'percentage', rate: 10, label: 'Senior Citizen Plan' },
    corporate_policy: { type: 'percentage', rate: 8, label: 'Corporate Policy' },
    top_up: { type: 'percentage', rate: 10, label: 'Top-up Plan' },
    default: { type: 'percentage', rate: 15 }
  },
  
  // ============================================
  // 🌿 TAG 4// ============================================
  homeopathy: {
    consultation: { type: 'percentage', rate: 20, label: 'Consultation' },
    follow_up: { type: 'percentage', rate: 15, label: 'Follow-up' },
    medicine_order: { type: 'percentage', rate: 20, label: 'Medicine Order' },
    chronic_treatment: { type: 'percentage', rate: 18, label: 'Chronic Treatment Plan' },
    naturopathy: { type: 'percentage', rate: 15, label: 'Naturopathy Package' },
    default: { type: 'percentage', rate: 20 }
  },
  
  // ============================================
  // 🧘 TAG 5// ============================================
  ayurveda: {
    consultation: { type: 'percentage', rate: 20, label: 'Consultation' },
    follow_up: { type: 'percentage', rate: 15, label: 'Follow-up' },
    panchakarma: { type: 'percentage', rate: 15, label: 'Panchakarma Package' },
    wellness_package: { type: 'percentage', rate: 18, label: 'Wellness Package' },
    medicine_order: { type: 'percentage', rate: 25, label: 'Ayurvedic Medicine' },
    product_sale: { type: 'percentage', rate: 25, label: 'Product Sale' },
    prakriti_consult: { type: 'percentage', rate: 20, label: 'Prakriti Analysis' },
    default: { type: 'percentage', rate: 20 }
  },
  
  // ============================================
  // 🏠 TAG 6// ============================================
  caregiver: {
    daily_care: { type: 'percentage', rate: 15, label: 'Daily Care' },
    monthly_retainer: { type: 'percentage', rate: 12, label: 'Monthly Retainer' },
    specialized_nursing: { type: 'percentage', rate: 18, label: 'Specialized Nursing' },
    elderly_care: { type: 'percentage', rate: 15, label: 'Elderly Care' },
    post_surgery_care: { type: 'percentage', rate: 15, label: 'Post-Surgery Care' },
    physiotherapy: { type: 'percentage', rate: 18, label: 'Physiotherapy' },
    default: { type: 'percentage', rate: 15 }
  },
  
  // ============================================
  // 💰 TAG 7EMI / FINANCING
  // ============================================
  health_emi: {
    medical_loan: { type: 'percentage', rate: 3, label: 'Medical Loan' },
    surgery_financing: { type: 'percentage', rate: 2.5, label: 'Surgery Financing' },
    diagnostic_emi: { type: 'percentage', rate: 4, label: 'Diagnostic EMI' },
    treatment_loan: { type: 'percentage', rate: 3, label: 'Treatment Loan' },
    no_cost_emi: { type: 'fixed', rate: 500, label: 'No-Cost EMI (Fixed)' },
    default: { type: 'percentage', rate: 3 }
  },
  
  // ============================================
  // 🏢 TAG 8HEALTH
  // ============================================
  corporate: {
    employee_checkup: { type: 'percentage', rate: 12, label: 'Employee Checkup' },
    wellness_program: { type: 'percentage', rate: 10, label: 'Wellness Program' },
    annual_contract: { type: 'percentage', rate: 8, label: 'Annual Contract' },
    mental_health_package: { type: 'percentage', rate: 12, label: 'Mental Health Package' },
    vaccination_drive: { type: 'percentage', rate: 10, label: 'Vaccination Drive' },
    health_camp: { type: 'fixed', rate: 5000, label: 'Health Camp (Per Camp)' },
    default: { type: 'percentage', rate: 12 }
  },
  
  // ============================================
  // 🔬 TAG 9// ============================================
  diagnostics: {
    labtest: { type: 'percentage', rate: 25, label: 'Individual Lab Test' },
    health_package: { type: 'percentage', rate: 20, label: 'Health Package' },
    radiology: { type: 'percentage', rate: 18, label: 'Radiology (MRI/CT)' },
    home_collection: { type: 'percentage', rate: 25, label: 'Home Collection' },
    corporate_testing: { type: 'percentage', rate: 15, label: 'Corporate Testing' },
    covid_test: { type: 'percentage', rate: 15, label: 'COVID/Infectious Test' },
    default: { type: 'percentage', rate: 25 }
  },
  
  // ============================================
  // 🧠 TAG 10HEALTH
  // ============================================
  mental_health: {
    individual_session: { type: 'percentage', rate: 20, label: 'Individual Session' },
    group_session: { type: 'percentage', rate: 15, label: 'Group Session' },
    couples_therapy: { type: 'percentage', rate: 18, label: 'Couples Therapy' },
    child_therapy: { type: 'percentage', rate: 20, label: 'Child Therapy' },
    corporate_wellness: { type: 'percentage', rate: 12, label: 'Corporate Wellness' },
    crisis_counseling: { type: 'percentage', rate: 10, label: 'Crisis Counseling' },
    subscription_monthly: { type: 'percentage', rate: 18, label: 'Monthly Subscription' },
    default: { type: 'percentage', rate: 20 }
  },
  
  // ============================================
  // 📱 TAG 11DOCTOR
  // ============================================
  online_doctor: {
    general_consult: { type: 'percentage', rate: 20, label: 'General Consultation' },
    specialist_consult: { type: 'percentage', rate: 20, label: 'Specialist Consultation' },
    follow_up: { type: 'percentage', rate: 15, label: 'Follow-up Visit' },
    second_opinion: { type: 'percentage', rate: 18, label: 'Second Opinion' },
    family_package: { type: 'percentage', rate: 15, label: 'Family Package' },
    quick_consult: { type: 'percentage', rate: 25, label: 'Quick Consult (10 min)' },
    default: { type: 'percentage', rate: 20 }
  },
  
  // ============================================
  // 🌍 GENERAL FALLBACK
  // ============================================
  general: {
    default: { type: 'percentage', rate: 15 }
  }
};

// ============================================
// FIXED COMMISSIONS (Per-Provider Override)
// ============================================

const FIXED_COMMISSIONS = {
  // Format: 'provider_id': { type: 'fixed', amount: 50, label: 'Special Rate' }
};

// ============================================
// TAG-SPECIFIC CONFIGURATIONS
// ============================================

const TAG_CONFIGS = {
  
  // ============================================
  // 🚑 TAG 2CONFIG
  // ============================================
  ambulance: {
    emergencyDiscount: 3,
    nightShiftDiscount: 2,
    longDistanceDiscount: 5,
    driverIncentiveShare: 40,
    minimumDriverEarning: 100,
    surgeCommissionRate: 20,
    platformFee: {
      emergency: 0,
      scheduled: 50,
      intercity: 100
    },
    peakHours: [
      { start: 9, end: 11, label: 'Morning Peak', adjustment: +2 },
      { start: 17, end: 20, label: 'Evening Peak', adjustment: +2 }
    ],
    gst: { percentage: 5, includedInPrice}
  },

  // ============================================
  // 🏥 TAG 1CONFIG
  // ============================================
  hospital: {
    platformFee: {
      opd: 30,
      admission: 100,
      emergency: 50,
      surgery: 200
    },
    performanceDiscounts: [
      { metric: 'rating', threshold: 4.5, discount: 2 },
      { metric: 'completed_bookings', threshold: 500, discount: 2 },
      { metric: 'rating', threshold: 4.8, discount: 3 }
    ],
    gst: { percentage: 5, includedInPrice},
    cancellationFee: {
      before_24h: 0,
      before_6h: 25,
      before_2h: 50
    }
  },

  // ============================================
  // 🛡️ TAG 3CONFIG
  // ============================================
  insurance: {
    platformFee: {
      new_policy: 0,    // No platform fee for insurance
      renewal: 0
    },
    renewalDiscount: 2,  // 2% less commission on renewals
    agentCommission: 50, // 50% of platform commission goes to agent
    gst: { percentage: 18, includedInPrice},
    minimumPayout: 5000,
    payoutFrequency: 'monthly'
  },

  // ============================================
  // 🌿 TAG 4CONFIG
  // ============================================
  homeopathy: {
    platformFee: {
      consultation: 30,
      follow_up: 20,
      medicine: 20
    },
    chronicDiscount: 2,     // 2% off for chronic treatment plans
    loyaltyDiscount: {
      after_5_consults: 2,
      after_10_consults: 3
    },
    gst: { percentage: 18, includedInPrice}
  },

  // ============================================
  // 🧘 TAG 5CONFIG
  // ============================================
  ayurveda: {
    platformFee: {
      consultation: 30,
      panchakarma: 100,
      medicine: 20,
      product: 20
    },
    panchakarmaDiscount: 3,  // 3% off for long-duration Panchakarma
    productMargin: 30,       // Products have 60-80% margin, platform can take 25-30%
    seasonalDiscount: 2,     // Seasonal wellness packages
    gst: { percentage: 18, includedInPrice}
  },

  // ============================================
  // 🏠 TAG 6CONFIG
  // ============================================
  caregiver: {
    platformFee: {
      daily: 50,
      monthly: 100,
      specialized: 75
    },
    longTermDiscount: {
      after_3_months: 2,
      after_6_months: 3,
      after_12_months: 5
    },
    ratingIncentive: {
      above_4_5: 2,
      above_4_8: 3
    },
    gst: { percentage: 18, includedInPrice}
  },

  // ============================================
  // 💰 TAG 7EMI CONFIG
  // ============================================
  health_emi: {
    platformFee: {
      medical_loan: 0,     // No platform fee on loans
      no_cost_emi: 500     // Fixed fee for no-cost EMI setup
    },
    lenderCommission: 70,  // 70% of commission goes to lender
    earlyRepaymentPenalty: 0,
    gst: { percentage: 18, includedInPrice}
  },

  // ============================================
  // 🏢 TAG 8HEALTH CONFIG
  // ============================================
  corporate: {
    platformFee: {
      employee_checkup: 50,
      wellness_program: 0,
      annual_contract: 0
    },
    volumeDiscount: {
      '50-100_employees': 1,
      '100-500_employees': 2,
      '500+_employees': 3
    },
    contractLengthDiscount: {
      '1_year': 0,
      '2_years': 1,
      '3_years': 2
    },
    gst: { percentage: 18, includedInPrice}
  },

  // ============================================
  // 🔬 TAG 9CONFIG
  // ============================================
  diagnostics: {
    platformFee: {
      labtest: 20,
      health_package: 30,
      radiology: 50,
      home_collection: 30
    },
    volumeDiscount: {
      monthly_50_tests: 2,
      monthly_100_tests: 3,
      monthly_500_tests: 5
    },
    corporateDiscount: 5,
    gst: { percentage: 18, includedInPrice}
  },

  // ============================================
  // 🧠 TAG 10HEALTH CONFIG
  // ============================================
  mental_health: {
    platformFee: {
      session: 30,
      group_session: 20,
      corporate: 0
    },
    sessionPackageDiscount: {
      '5_sessions': 2,
      '10_sessions': 3,
      '20_sessions': 5
    },
    subscriptionDiscount: 3,
    crisisSession: 5,  // Only 5% commission on crisis sessions
    therapistRatingIncentive: {
      above_4_5: 2,
      above_4_8: 3
    },
    gst: { percentage: 18, includedInPrice}
  },

  // ============================================
  // 📱 TAG 11DOCTOR CONFIG
  // ============================================
  online_doctor: {
    platformFee: {
      consultation: 20,
      specialist: 30,
      follow_up: 15,
      quick_consult: 10
    },
    specialistIncentive: -1,    // 1% higher commission for specialists
    followUpDiscount: 5,        // 5% discount on follow-up commission
    volumeIncentive: {
      '50_consults_month': 2,
      '100_consults_month': 3,
      '200_consults_month': 5
    },
    peakHourIncentive: 1,       // 1% less commission during peak hours
    gst: { percentage: 18, includedInPrice}
  }
};

// ============================================
// PERFORMANCE-BASED ADJUSTMENT RULES (Global)
// ============================================

const PERFORMANCE_RULES = {
  // High rating incentive
  high_rating: {
    thresholds: [
      { min: 4.5, discount: 1, label: 'Rating 4.5+' },
      { min: 4.7, discount: 2, label: 'Rating 4.7+' },
      { min: 4.9, discount: 3, label: 'Rating 4.9+' }
    ]
  },
  
  // High volume incentive
  high_volume: {
    thresholds: [
      { min: 100, discount: 1, label: '100+ bookings' },
      { min: 500, discount: 2, label: '500+ bookings' },
      { min: 1000, discount: 3, label: '1000+ bookings' },
      { min: 5000, discount: 5, label: '5000+ bookings' }
    ]
  },
  
  // Low cancellation rate incentive
  low_cancellation: {
    thresholds: [
      { max: 5, discount: 1, label: 'Cancellation <5%' },
      { max: 2, discount: 2, label: 'Cancellation <2%' },
      { max: 1, discount: 3, label: 'Cancellation <1%' }
    ]
  },
  
  // Quick response incentive (ambulance/doctor)
  quick_response: {
    thresholds: [
      { max: 60, discount: 1, label: 'Response <60s' },
      { max: 30, discount: 2, label: 'Response <30s' },
      { max: 15, discount: 3, label: 'Response <15s' }
    ]
  }
};

// ============================================
// MAPPING→ tag and sub-type
// ============================================

const BOOKING_TYPE_MAP = {
  // 🏥 Hospital
  'opd': { tag: 'hospital', subType: 'opd' },
  'admission': { tag: 'hospital', subType: 'admission' },
  'emergency_booking': { tag: 'hospital', subType: 'emergency_booking' },
  'surgery_package': { tag: 'hospital', subType: 'surgery_package' },
  
  // 🚑 Ambulance
  'ambulance': { tag: 'ambulance', subType: 'scheduled' },
  'ambulance_emergency': { tag: 'ambulance', subType: 'emergency' },
  'ambulance_intercity': { tag: 'ambulance', subType: 'intercity' },
  
  // 🛡️ Insurance
  'insurance': { tag: 'insurance', subType: 'new_policy' },
  'insurance_renewal': { tag: 'insurance', subType: 'renewal' },
  'insurance_family': { tag: 'insurance', subType: 'family_floater' },
  
  // 🌿 Homeopathy
  'homeopathy_consult': { tag: 'homeopathy', subType: 'consultation' },
  'homeopathy_followup': { tag: 'homeopathy', subType: 'follow_up' },
  'homeopathy_medicine': { tag: 'homeopathy', subType: 'medicine_order' },
  'homeopathy_chronic': { tag: 'homeopathy', subType: 'chronic_treatment' },
  
  // 🧘 Ayurveda
  'ayurveda_consultation': { tag: 'ayurveda', subType: 'consultation' },
  'ayurveda_panchakarma': { tag: 'ayurveda', subType: 'panchakarma' },
  'ayurveda_medicine': { tag: 'ayurveda', subType: 'medicine_order' },
  'ayurveda_product': { tag: 'ayurveda', subType: 'product_sale' },
  
  // 🏠 Caregiver
  'caregiver': { tag: 'caregiver', subType: 'daily_care' },
  'caregiver_monthly': { tag: 'caregiver', subType: 'monthly_retainer' },
  'caregiver_nursing': { tag: 'caregiver', subType: 'specialized_nursing' },
  
  // 💰 Health EMI
  'loan': { tag: 'health_emi', subType: 'medical_loan' },
  'health_emi': { tag: 'health_emi', subType: 'medical_loan' },
  'no_cost_emi': { tag: 'health_emi', subType: 'no_cost_emi' },
  
  // 🏢 Corporate
  'corporate_health': { tag: 'corporate', subType: 'wellness_program' },
  'corporate_checkup': { tag: 'corporate', subType: 'employee_checkup' },
  'corporate_annual': { tag: 'corporate', subType: 'annual_contract' },
  
  // 🔬 Diagnostics
  'labtest': { tag: 'diagnostics', subType: 'labtest' },
  'health_package': { tag: 'diagnostics', subType: 'health_package' },
  'radiology': { tag: 'diagnostics', subType: 'radiology' },
  
  // 🧠 Mental Health
  'mental_health': { tag: 'mental_health', subType: 'individual_session' },
  'mental_health_group': { tag: 'mental_health', subType: 'group_session' },
  'mental_health_crisis': { tag: 'mental_health', subType: 'crisis_counseling' },
  'mental_health_subscription': { tag: 'mental_health', subType: 'subscription_monthly' },
  
  // 📱 Online Doctor
  'online_consult': { tag: 'online_doctor', subType: 'general_consult' },
  'online_specialist': { tag: 'online_doctor', subType: 'specialist_consult' },
  'online_followup': { tag: 'online_doctor', subType: 'follow_up' },
  'online_quick': { tag: 'online_doctor', subType: 'quick_consult' }
};

// ============================================
// MAIN COMMISSION CALCULATION (ENHANCED)
// ============================================

const calculateCommission = (bookingType, amount, serviceId = null, metadata = {}) => {
  let commissionAmount = 0;
  let commissionRate = 0;
  let commissionType = 'percentage';
  let breakdown = [];
  let adjustments = [];
  
  // Case 1commission override
  if (serviceId && FIXED_COMMISSIONS[serviceId]) {
    const fixed = FIXED_COMMISSIONS[serviceId];
    commissionAmount = fixed.amount;
    commissionType = 'fixed';
    commissionRate = 0;
    breakdown.push({
      type: 'fixed',
      rate: 0,
      amount.amount,
      description: `Fixed commission for ${serviceId}`
    });
    return { 
      commissionAmount, 
      commissionRate, 
      commissionType, 
      breakdown,
      adjustments,
      bookingType,
      originalAmount,
      netAmount- commissionAmount
    };
  }
  
  // Case 2rate config from mapping
  const mapped = BOOKING_TYPE_MAP[bookingType];
  let rateConfig = null;
  let tagConfig = null;
  
  if (mapped) {
    const tagRates = COMMISSION_RATES[mapped.tag];
    if (tagRates) {
      rateConfig = tagRates[mapped.subType] || tagRates.default;
      tagConfig = TAG_CONFIGS[mapped.tag];
    }
  }
  
  // Case 3booking types
  if (!rateConfig) {
    if (bookingType === 'opd') rateConfig = COMMISSION_RATES.hospital.opd;
    else if (bookingType === 'admission') rateConfig = COMMISSION_RATES.hospital.admission;
    else if (bookingType === 'ambulance') rateConfig = COMMISSION_RATES.ambulance.scheduled;
    else if (bookingType === 'caregiver') rateConfig = COMMISSION_RATES.caregiver.daily_care;
    else if (bookingType === 'labtest') rateConfig = COMMISSION_RATES.diagnostics.labtest;
    else if (bookingType === 'health_package') rateConfig = COMMISSION_RATES.diagnostics.health_package;
    else if (bookingType === 'loan') rateConfig = COMMISSION_RATES.health_emi.medical_loan;
    else if (bookingType === 'insurance') rateConfig = COMMISSION_RATES.insurance.new_policy;
    else if (bookingType === 'ayurveda_consultation') rateConfig = COMMISSION_RATES.ayurveda.consultation;
    else if (bookingType === 'homeopathy_consult') rateConfig = COMMISSION_RATES.homeopathy.consultation;
    else if (bookingType === 'homeopathy_medicine') rateConfig = COMMISSION_RATES.homeopathy.medicine_order;
    else if (bookingType === 'online_consult') rateConfig = COMMISSION_RATES.online_doctor.general_consult;
    else rateConfig = COMMISSION_RATES.general.default;
  }
  
  // Get base rate
  commissionType = rateConfig.type || 'percentage';
  commissionRate = rateConfig.rate || 0;
  
  // ============================================
  // APPLY PERFORMANCE-BASED ADJUSTMENTS
  // ============================================
  
  if (metadata.providerRating) {
    const ratingRules = PERFORMANCE_RULES.high_rating.thresholds;
    for (const rule of ratingRules) {
      if (metadata.providerRating >= rule.min) {
        adjustments.push({
          type: 'performance',
          metric: 'rating',
          value: -rule.discount,
          label.label,
          reason: `High rating incentive`
        });
        commissionRate = Math.max(commissionRate - rule.discount, 1);
      }
    }
  }
  
  if (metadata.providerCompletedBookings) {
    const volumeRules = PERFORMANCE_RULES.high_volume.thresholds;
    for (const rule of volumeRules) {
      if (metadata.providerCompletedBookings >= rule.min) {
        adjustments.push({
          type: 'performance',
          metric: 'volume',
          value: -rule.discount,
          label.label,
          reason: `High volume incentive`
        });
        commissionRate = Math.max(commissionRate - rule.discount, 1);
      }
    }
  }
  
  if (metadata.cancellationRate !== undefined) {
    const cancelRules = PERFORMANCE_RULES.low_cancellation.thresholds;
    for (const rule of cancelRules) {
      if (metadata.cancellationRate <= rule.max) {
        adjustments.push({
          type: 'performance',
          metric: 'cancellation',
          value: -rule.discount,
          label.label,
          reason: `Low cancellation incentive`
        });
        commissionRate = Math.max(commissionRate - rule.discount, 1);
      }
    }
  }
  
  // ============================================
  // APPLY TAG-SPECIFIC ADJUSTMENTS
  // ============================================
  
  if (tagConfig && mapped) {
    // 🚑 Ambulance-specific
    if (mapped.tag === 'ambulance') {
      if (metadata.isEmergency) {
        commissionRate = Math.max(commissionRate - (tagConfig.emergencyDiscount || 3), 5);
        adjustments.push({ type: 'ambulance', value: -(tagConfig.emergencyDiscount || 3), reason: 'Emergency discount' });
      }
      if (metadata.isNightTime) {
        commissionRate = Math.max(commissionRate - (tagConfig.nightShiftDiscount || 2), 5);
        adjustments.push({ type: 'ambulance', value: -(tagConfig.nightShiftDiscount || 2), reason: 'Night shift discount' });
      }
      if (metadata.isLongDistance) {
        commissionRate = Math.max(commissionRate - (tagConfig.longDistanceDiscount || 5), 5);
        adjustments.push({ type: 'ambulance', value: -(tagConfig.longDistanceDiscount || 5), reason: 'Long distance discount' });
      }
    }
    
    // 🧘 Ayurveda-specific
    if (mapped.tag === 'ayurveda') {
      if (metadata.isPanchakarma && metadata.durationDays >= 14) {
        commissionRate = Math.max(commissionRate - (tagConfig.panchakarmaDiscount || 3), 5);
        adjustments.push({ type: 'ayurveda', value: -(tagConfig.panchakarmaDiscount || 3), reason: 'Extended Panchakarma discount' });
      }
      if (metadata.isSeasonal) {
        commissionRate = Math.max(commissionRate - (tagConfig.seasonalDiscount || 2), 5);
        adjustments.push({ type: 'ayurveda', value: -(tagConfig.seasonalDiscount || 2), reason: 'Seasonal wellness discount' });
      }
    }
    
    // 🧠 Mental Health-specific
    if (mapped.tag === 'mental_health') {
      if (metadata.isCrisisSession) {
        commissionRate = tagConfig.crisisSession || 5;
        adjustments.push({ type: 'mental_health', value: 'crisis_rate', reason: 'Crisis session - reduced rate' });
      }
      if (metadata.sessionPackage > 1) {
        const discountKey = `${metadata.sessionPackage}_sessions`;
        const discount = tagConfig.sessionPackageDiscount?.[discountKey] || 0;
        if (discount > 0) {
          commissionRate = Math.max(commissionRate - discount, 5);
          adjustments.push({ type: 'mental_health', value: -discount, reason: `${metadata.sessionPackage}-session package discount` });
        }
      }
      if (metadata.isSubscription) {
        commissionRate = Math.max(commissionRate - (tagConfig.subscriptionDiscount || 3), 5);
        adjustments.push({ type: 'mental_health', value: -(tagConfig.subscriptionDiscount || 3), reason: 'Subscription discount' });
      }
    }
    
    // 🏢 Corporate-specific
    if (mapped.tag === 'corporate') {
      if (metadata.employeeCount >= 500) {
        commissionRate = Math.max(commissionRate - (tagConfig.volumeDiscount?.['500+_employees'] || 3), 3);
        adjustments.push({ type: 'corporate', value: -(tagConfig.volumeDiscount?.['500+_employees'] || 3), reason: 'Large enterprise discount' });
      } else if (metadata.employeeCount >= 100) {
        commissionRate = Math.max(commissionRate - (tagConfig.volumeDiscount?.['100-500_employees'] || 2), 3);
        adjustments.push({ type: 'corporate', value: -(tagConfig.volumeDiscount?.['100-500_employees'] || 2), reason: 'Mid-size company discount' });
      }
      if (metadata.contractYears >= 3) {
        commissionRate = Math.max(commissionRate - (tagConfig.contractLengthDiscount?.['3_years'] || 2), 3);
        adjustments.push({ type: 'corporate', value: -(tagConfig.contractLengthDiscount?.['3_years'] || 2), reason: '3-year contract discount' });
      }
    }
    
    // 🔬 Diagnostics-specific
    if (mapped.tag === 'diagnostics') {
      if (metadata.isCorporateClient) {
        commissionRate = Math.max(commissionRate - (tagConfig.corporateDiscount || 5), 5);
        adjustments.push({ type: 'diagnostics', value: -(tagConfig.corporateDiscount || 5), reason: 'Corporate client discount' });
      }
      if (metadata.monthlyTestVolume >= 500) {
        commissionRate = Math.max(commissionRate - (tagConfig.volumeDiscount?.monthly_500_tests || 5), 5);
        adjustments.push({ type: 'diagnostics', value: -(tagConfig.volumeDiscount?.monthly_500_tests || 5), reason: 'High volume discount' });
      }
    }
    
    // 📱 Online Doctor-specific
    if (mapped.tag === 'online_doctor') {
      if (metadata.isFollowUp) {
        commissionRate = Math.max(commissionRate - (tagConfig.followUpDiscount || 5), 5);
        adjustments.push({ type: 'online_doctor', value: -(tagConfig.followUpDiscount || 5), reason: 'Follow-up discount' });
      }
      if (metadata.monthlyConsultVolume >= 200) {
        commissionRate = Math.max(commissionRate - (tagConfig.volumeIncentive?.['200_consults_month'] || 5), 5);
        adjustments.push({ type: 'online_doctor', value: -(tagConfig.volumeIncentive?.['200_consults_month'] || 5), reason: 'High volume incentive' });
      }
    }
    
    // 🏠 Caregiver-specific
    if (mapped.tag === 'caregiver') {
      if (metadata.monthsOfService >= 12) {
        commissionRate = Math.max(commissionRate - (tagConfig.longTermDiscount?.after_12_months || 5), 5);
        adjustments.push({ type: 'caregiver', value: -(tagConfig.longTermDiscount?.after_12_months || 5), reason: '12-month loyalty discount' });
      } else if (metadata.monthsOfService >= 6) {
        commissionRate = Math.max(commissionRate - (tagConfig.longTermDiscount?.after_6_months || 3), 5);
        adjustments.push({ type: 'caregiver', value: -(tagConfig.longTermDiscount?.after_6_months || 3), reason: '6-month loyalty discount' });
      }
    }
    
    // 🌿 Homeopathy-specific
    if (mapped.tag === 'homeopathy') {
      if (metadata.isChronicTreatment) {
        commissionRate = Math.max(commissionRate - (tagConfig.chronicDiscount || 2), 5);
        adjustments.push({ type: 'homeopathy', value: -(tagConfig.chronicDiscount || 2), reason: 'Chronic treatment discount' });
      }
      if (metadata.patientConsultCount >= 10) {
        commissionRate = Math.max(commissionRate - (tagConfig.loyaltyDiscount?.after_10_consults || 3), 5);
        adjustments.push({ type: 'homeopathy', value: -(tagConfig.loyaltyDiscount?.after_10_consults || 3), reason: 'Patient loyalty discount' });
      }
    }
  }
  
  // Calculate final commission
  commissionRate = Math.max(commissionRate, 1); // Minimum 1%
  
  if (commissionType === 'percentage') {
    commissionAmount = Math.round((amount * commissionRate) / 100 * 100) / 100;
  } else if (commissionType === 'fixed') {
    commissionAmount = commissionRate;
  }
  
  // Build breakdown
  breakdown.push({
    type,
    baseRate.rate,
    effectiveRate,
    amount,
    adjustments.map(a => a.reason),
    description: `${bookingType} commission`
  });
  
  return {
    commissionAmount,
    commissionRate,
    baseRate.rate,
    effectiveRate,
    commissionType,
    breakdown,
    adjustments,
    bookingType,
    tag?.tag || 'general',
    subType?.subType || 'default',
    originalAmount,
    netAmount- commissionAmount
  };
};

// ============================================
// CALCULATE PLATFORM FEE
// ============================================

const calculatePlatformFee = (bookingType, metadata = {}) => {
  const mapped = BOOKING_TYPE_MAP[bookingType];
  if (!mapped) return 30; // Default platform fee
  
  const tagConfig = TAG_CONFIGS[mapped.tag];
  if (!tagConfig?.platformFee) return 30;
  
  const fee = tagConfig.platformFee[mapped.subType] || tagConfig.platformFee.default || 30;
  
  // 🚑 Emergency ambulance - waive fee
  if (mapped.tag === 'ambulance' && metadata.isEmergency) return 0;
  
  // 🧠 Crisis counseling - waive fee
  if (mapped.tag === 'mental_health' && metadata.isCrisisSession) return 0;
  
  return fee;
};

// ============================================
// CALCULATE COMMISSION FOR BOOKING
// ============================================

const calculateBookingCommission = (booking) => {
  const bookingType = booking.bookingType || 'general';
  const amount = booking.finalAmount || booking.originalAmount || 0;
  const serviceId = booking.hospitalId || booking.providerId || booking.caregiverId;
  
  return calculateCommission(bookingType, amount, serviceId, {
    bookingId.bookingId,
    patientName.patientName,
    providerName.hospitalName || booking.providerName,
    // Performance metadata
    providerRating.driverRating || booking.providerRating || 0,
    providerCompletedBookings.providerCompletedTrips || 0,
    cancellationRate.providerCancellationRate,
    // 🚑 Ambulance metadata
    emergencyType.emergencyType,
    isEmergency.emergencyType === 'blitz' || booking.emergencyType === 'emergency',
    isNightTime.isPeakHour || false,
    isLongDistance.digitalTripSheet?.distance > 50 || false,
    // 🧘 Ayurveda metadata
    isPanchakarma=== 'ayurveda_panchakarma',
    durationDays.durationDays || 0,
    isSeasonal.isSeasonal || false,
    // 🧠 Mental Health metadata
    isCrisisSession.isCrisisSession || false,
    sessionPackage.sessionPackage || 1,
    isSubscription.isSubscription || false,
    // 🏢 Corporate metadata
    employeeCount.employeeCount || 0,
    contractYears.contractYears || 1,
    // 🔬 Diagnostics metadata
    isCorporateClient.isCorporateClient || false,
    monthlyTestVolume.monthlyTestVolume || 0,
    // 📱 Online Doctor metadata
    isFollowUp.isFollowUp || false,
    monthlyConsultVolume.monthlyConsultVolume || 0,
    // 🏠 Caregiver metadata
    monthsOfService.monthsOfService || 0,
    // 🌿 Homeopathy metadata
    isChronicTreatment.isChronicTreatment || false,
    patientConsultCount.patientConsultCount || 0
  });
};

// ============================================
// CALCULATE COMMISSION FOR LOAN
// ============================================

const calculateLoanCommission = (loanApplication) => {
  const amount = loanApplication.disbursedAmount || loanApplication.estimatedAmount || 0;
  return calculateCommission('loan', amount, loanApplication.lenderId, {
    applicationId.applicationId,
    lenderName.lender
  });
};

// ============================================
// TAG-SPECIFIC COMMISSION CALCULATORS
// ============================================

// 🚑 Ambulance
const calculateAmbulanceCommission = (bookingData) => {
  return calculateCommission('ambulance', bookingData.amount, bookingData.providerId, {
    ...bookingData,
    isEmergency.emergencyType === 'blitz',
    isNightTime.isNightTime || false,
    isLongDistance.isLongDistance || false
  });
};

// 🏥 Hospital
const calculateHospitalCommission = (bookingData) => {
  const subType = bookingData.bookingType === 'admission' ? 'admission' : 'opd';
  return calculateCommission(subType, bookingData.amount, bookingData.hospitalId, bookingData);
};

// 🛡️ Insurance
const calculateInsuranceCommission = (bookingData) => {
  const subType = bookingData.isRenewal ? 'insurance_renewal' : 'insurance';
  return calculateCommission(subType, bookingData.amount, bookingData.providerId, bookingData);
};

// 🧘 Ayurveda
const calculateAyurvedaCommission = (bookingData) => {
  return calculateCommission('ayurveda_consultation', bookingData.amount, bookingData.providerId, {
    ...bookingData,
    isPanchakarma.subType === 'panchakarma',
    durationDays.durationDays || 0
  });
};

// 🧠 Mental Health
const calculateMentalHealthCommission = (bookingData) => {
  let subType = 'mental_health';
  if (bookingData.isCrisisSession) subType = 'mental_health_crisis';
  else if (bookingData.isGroupSession) subType = 'mental_health_group';
  else if (bookingData.isSubscription) subType = 'mental_health_subscription';
  
  return calculateCommission(subType, bookingData.amount, bookingData.providerId, bookingData);
};

// 🔬 Diagnostics
const calculateDiagnosticsCommission = (bookingData) => {
  return calculateCommission('labtest', bookingData.amount, bookingData.providerId, bookingData);
};

// 📱 Online Doctor
const calculateOnlineDoctorCommission = (bookingData) => {
  let subType = 'online_consult';
  if (bookingData.isFollowUp) subType = 'online_followup';
  else if (bookingData.isSpecialist) subType = 'online_specialist';
  
  return calculateCommission(subType, bookingData.amount, bookingData.providerId, bookingData);
};

// 🏠 Caregiver
const calculateCaregiverCommission = (bookingData) => {
  return calculateCommission('caregiver', bookingData.amount, bookingData.providerId, bookingData);
};

// 🌿 Homeopathy
const calculateHomeopathyCommission = (bookingData) => {
  const subType = bookingData.isMedicine ? 'homeopathy_medicine' : 'homeopathy_consult';
  return calculateCommission(subType, bookingData.amount, bookingData.providerId, bookingData);
};

// 🏢 Corporate
const calculateCorporateCommission = (bookingData) => {
  return calculateCommission('corporate_health', bookingData.amount, bookingData.providerId, bookingData);
};

// 💰 Health EMI
const calculateHealthEMICommission = (bookingData) => {
  return calculateCommission('health_emi', bookingData.amount, bookingData.providerId, bookingData);
};

// ============================================
// GET COMMISSION RATE (For Display)
// ============================================

const getCommissionRate = (bookingType, subType = 'default', providerId = null) => {
  // Check fixed commissions first
  if (providerId && FIXED_COMMISSIONS[providerId]) {
    return FIXED_COMMISSIONS[providerId];
  }
  
  // Check mapped types
  const mapped = BOOKING_TYPE_MAP[bookingType];
  if (mapped && COMMISSION_RATES[mapped.tag]) {
    return COMMISSION_RATES[mapped.tag][subType] || COMMISSION_RATES[mapped.tag].default;
  }
  
  // Legacy fallback
  if (bookingType === 'opd') return COMMISSION_RATES.hospital.opd;
  if (bookingType === 'admission') return COMMISSION_RATES.hospital.admission;
  if (bookingType === 'ambulance') return COMMISSION_RATES.ambulance.default;
  if (bookingType === 'ambulance_emergency') return COMMISSION_RATES.ambulance.emergency;
  if (bookingType === 'caregiver') return COMMISSION_RATES.caregiver.default;
  if (bookingType === 'labtest') return COMMISSION_RATES.diagnostics.labtest;
  if (bookingType === 'health_package') return COMMISSION_RATES.diagnostics.health_package;
  if (bookingType === 'loan') return COMMISSION_RATES.health_emi.default;
  if (bookingType === 'insurance') return COMMISSION_RATES.insurance.default;
  if (bookingType === 'ayurveda_consultation') return COMMISSION_RATES.ayurveda.default;
  if (bookingType === 'homeopathy_consult') return COMMISSION_RATES.homeopathy.default;
  if (bookingType === 'online_consult') return COMMISSION_RATES.online_doctor.default;
  
  return COMMISSION_RATES.general.default;
};

// ============================================
// GET ALL RATES (Admin Panel)
// ============================================

const getAllCommissionRates = () => {
  return {
    rates_RATES,
    configs_CONFIGS,
    performanceRules_RULES,
    bookingTypeMap_TYPE_MAP,
    fixedCommissions_COMMISSIONS
  };
};

// ============================================
// GET TAG SUMMARY
// ============================================

const getTagSummary = () => {
  const summary = {};
  
  for (const [tag, rates] of Object.entries(COMMISSION_RATES)) {
    if (tag === 'general') continue;
    
    const config = TAG_CONFIGS[tag] || {};
    const tagRates = {};
    
    for (const [subType, rateInfo] of Object.entries(rates)) {
      if (subType === 'default') continue;
      tagRates[subType] = {
        rate.rate,
        type.type,
        label.label,
        platformFee.platformFee?.[subType] || 0,
        gst.gst?.percentage || 18
      };
    }
    
    summary[tag] = {
      label(tag),
      rates,
      defaultRate.default.rate,
      platformFee.platformFee || {},
      performanceRules.performanceDiscounts || []
    };
  }
  
  return summary;
};

const getTagLabel = (tag) => {
  const labels = {
    hospital: '🏥 Hospitals',
    ambulance: '🚑 Ambulance',
    insurance: '🛡️ Health Insurance',
    homeopathy: '🌿 Homeopathy',
    ayurveda: '🧘 Ayurveda',
    caregiver: '🏠 Caregivers',
    health_emi: '💰 Health EMI',
    corporate: '🏢 Corporate Health',
    diagnostics: '🔬 Diagnostics',
    mental_health: '🧠 Mental Health',
    online_doctor: '📱 Online Doctor'
  };
  return labels[tag] || tag;
};

// ============================================
// UPDATE COMMISSION RATE (Admin)
// ============================================

const updateCommissionRate = (tag, subType, rateConfig) => {
  if (COMMISSION_RATES[tag]) {
    if (subType && COMMISSION_RATES[tag][subType]) {
      COMMISSION_RATES[tag][subType] = {
        ...COMMISSION_RATES[tag][subType],
        ...rateConfig
      };
      return { 
        success, 
        message: `${tag}.${subType} updated to ${rateConfig.rate}%` 
      };
    }
    if (!subType) {
      COMMISSION_RATES[tag].default = {
        ...COMMISSION_RATES[tag].default,
        ...rateConfig
      };
      return { 
        success, 
        message: `${tag} default updated to ${rateConfig.rate}%` 
      };
    }
  }
  return { success, message: `Tag ${tag}.${subType} not found` };
};

// ============================================
// UPDATE TAG CONFIG (Admin)
// ============================================

const updateTagConfig = (tag, configUpdates) => {
  if (TAG_CONFIGS[tag]) {
    Object.assign(TAG_CONFIGS[tag], configUpdates);
    return { success, message: `${tag} config updated`, config_CONFIGS[tag] };
  }
  return { success, message: `Tag ${tag} not found` };
};

// ============================================
// ADD FIXED COMMISSION (Admin)
// ============================================

const addFixedCommission = (providerId, config) => {
  FIXED_COMMISSIONS[providerId] = config;
  return { success, message: `Fixed commission added for ${providerId}` };
};

const removeFixedCommission = (providerId) => {
  delete FIXED_COMMISSIONS[providerId];
  return { success, message: `Fixed commission removed for ${providerId}` };
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const isNightTimeNow = () => {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 6;
};

const getPeakHourInfo = (tag = 'ambulance') => {
  const config = TAG_CONFIGS[tag];
  if (!config?.peakHours) return { isPeakHour, currentPeriod, adjustment: 0 };
  
  const hour = new Date().getHours();
  const peakPeriod = config.peakHours.find(p => hour >= p.start && hour < p.end);
  
  return {
    isPeakHour: !!peakPeriod,
    currentPeriod|| null,
    adjustment? peakPeriod.adjustment : 0
  };
};

const getTagForBookingType = (bookingType) => {
  return BOOKING_TYPE_MAP[bookingType] || { tag: 'general', subType: 'default' };
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Main functions
  calculateCommission,
  calculateBookingCommission,
  calculateLoanCommission,
  calculatePlatformFee,
  
  // Tag-specific calculators
  calculateAmbulanceCommission,
  calculateHospitalCommission,
  calculateInsuranceCommission,
  calculateAyurvedaCommission,
  calculateMentalHealthCommission,
  calculateDiagnosticsCommission,
  calculateOnlineDoctorCommission,
  calculateCaregiverCommission,
  calculateHomeopathyCommission,
  calculateCorporateCommission,
  calculateHealthEMICommission,
  
  // Admin functions
  getCommissionRate,
  getAllCommissionRates,
  getTagSummary,
  updateCommissionRate,
  updateTagConfig,
  addFixedCommission,
  removeFixedCommission,
  
  // Data exports
  COMMISSION_RATES,
  FIXED_COMMISSIONS,
  TAG_CONFIGS,
  PERFORMANCE_RULES,
  BOOKING_TYPE_MAP,
  
  // Helpers
  isNightTimeNow,
  getPeakHourInfo,
  getTagForBookingType
};


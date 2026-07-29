const mongoose = require('mongoose');

// ============================================
// TRANSACTION MODEL - Updated with Full Healthcare Support
// ============================================

const transactionSchema = new mongoose.Schema({
  // ============================================
  // YOUR EXISTING FIELDS (ALL PRESERVED)
  // ============================================
  
  transactionId: { type, unique, required},
  applicationId: { type, required},
  lenderId: { type, required},
  
  type: { 
    type, 
    enum: [
      'disbursal', 
      'commission_payment', 
      'refund', 
      'booking_payment', 
      'subscription', 
      'payout',
      'insurance_premium',
      'opd_booking',
      'admission_booking',
      'advance_payment',
      'settlement_payment',
      // 🚑 NEWtransaction types
      'ambulance_emergency',
      'ambulance_scheduled',
      'ambulance_payout',
      'ambulance_refund'
    ] 
  },
  amount,
  commissionAmount,
  
  status: { 
    type, 
    enum: [
      'pending', 'completed', 'failed', 'initiated', 
      'captured', 'refunded', 'partially_refunded',
      'processing', 'settled'
    ], 
    default: 'pending' 
  },
  
  // Payment details
  paymentGateway,
  gatewayReferenceId,
  utrNumber,
  
  // Bank account details
  fromAccount: {
    bankName,
    accountNumber,
    ifsc},
  toAccount: {
    bankName,
    accountNumber,
    ifsc},
  
  initiatedAt,
  completedAt,
  
  webhookReceived: { type, default},
  
  // ============================================
  // EXISTING PAYMENT FIELDS (PRESERVED)
  // ============================================
  
  orderId: { type},
  paymentId: { type},
  refundId: { type},
  razorpaySignature: { type},
  
  bookingId: { type.Schema.Types.ObjectId, ref: 'Booking' },
  bookingType: { 
    type, 
    enum: [
      'opd', 
      'admission', 
      'ambulance', 
      'ambulance_emergency',  // 🚑 NEWambulance booking
      'labtest', 
      'health_package', 
      'caregiver', 
      'loan',
      'insurance'
    ] 
  },
  userId: { type},
  providerId: { type.Schema.Types.ObjectId, ref: 'Provider' },
  
  // Amount details
  originalAmount: { type},
  discountAmount: { type, default: 0 },
  taxAmount: { type, default: 0 },
  gstAmount: { type, default: 0 },
  convenienceFee: { type, default: 0 },
  netAmount: { type},
  refundAmount: { type, default: 0 },
  
  // Payment method
  paymentMethod: { type, enum: ['card', 'upi', 'netbanking', 'wallet', 'emi', 'bank_transfer', 'cod'] },
  
  // Discount details
  discountCode: { type},
  discountType: { type, enum: ['percentage', 'fixed'] },
  discountValue: { type},
  
  // Commission & Settlement
  platformCommission: { type, default: 0 },
  providerAmount: { type, default: 0 },
  commissionStatus: { type, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  commissionPaidAt: { type},
  commissionPaymentId: { type},
  
  settledToProvider: { type, default},
  settledAt: { type},
  settlementId: { type},
  settlementAmount: { type},
  
  // Payment failure details
  failureReason: { type},
  failureCode: { type},
  paymentAttempts: { type, default: 0 },
  
  // Timestamps
  paidAt: { type},
  refundedAt: { type},
  updatedAt: { type, default.now },
  createdAt: { type, default.now },
  
  // Metadata
  notes: { type},
  metadata: { type.Schema.Types.Mixed },
  webhookPayload: { type.Schema.Types.Mixed },

  // ============================================
  // EXISTING INSURANCE FIELDS (PRESERVED)
  // ============================================
  
  insurancePolicyId: { type.Schema.Types.ObjectId, ref: 'InsurancePolicy' },
  insurancePlanId: { type.Schema.Types.ObjectId, ref: 'InsurancePlan' },
  
  premiumAmount: { type},
  totalPremium: { type},
  policyNumber: { type},
  
  insuranceCommissionRate: { type, default: 15 },
  insurancePlatformCommission: { type, default: 0 },
  insurancePayoutToCompany: { type, default: 0 },
  
  insuranceSettlementStatus: { 
    type, 
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  insuranceSettlementDate: { type},
  insuranceSettlementTransactionId: { type},
  
  claimPaymentId: { type},
  claimAmount: { type},
  claimSettlementDate: { type},
  
  isRenewal: { type, default},
  previousPolicyNumber: { type},
  renewalYear: { type},

  // ============================================
  // HOSPITAL/OPD/ADMISSION SPECIFIC FIELDS
  // ============================================
  
  // Hospital reference
  hospitalId: { type.Schema.Types.ObjectId, ref: 'Hospital' },
  hospitalName: { type},
  
  // Doctor details
  doctorName: { type},
  doctorSpecialization: { type},
  
  // Patient details
  patientName: { type},
  patientPhone: { type},
  
  // Admission specific
  roomType: { type},
  numberOfDays: { type},
  advancePercentage: { type, default: 25 },
  
  // GST breakdown
  gst: {
    cgst: { type, default: 0 },
    sgst: { type, default: 0 },
    igst: { type, default: 0 },
    totalGst: { type, default: 0 }
  },

  // ============================================
  // 🚑 AMBULANCE TRIP SPECIFIC FIELDS (NEW)
  // ============================================

  // Ambulance reference
  ambulanceId: { type},
  ambulanceProviderId: { type},
  ambulanceProviderName: { type},
  ambulanceDriverId: { type},
  ambulanceDriverName: { type},
  ambulanceVehicleNumber: { type},
  ambulanceType: { 
    type,
    enum: ['basic', 'cardiac', 'ventilator', 'neonatal', 'mortuary', 'wheelchair']
  },

  // Ambulance trip details
  ambulanceTripDetails: {
    tripId: { type},
    tripType: { type, enum: ['emergency', 'scheduled', 'intercity'] },
    pickupAddress: { type},
    dropAddress: { type},
    hospitalDestination: { type},
    distance: { type},          // km
    duration: { type},          // minutes
    responseTime: { type},      // seconds (emergency only)
    pickupTime: { type},
    dropTime: { type},
    isEmergency: { type, default},
    oxygenAdministered: { type, default}
  },

  // 🚑 Ambulance fare breakdown
  ambulanceFareBreakdown: {
    baseFare: { type, default: 0 },
    distanceCharge: { type, default: 0 },
    waitingCharge: { type, default: 0 },
    nightCharge: { type, default: 0 },
    oxygenCharge: { type, default: 0 },
    equipmentCharge: { type, default: 0 },
    surgeCharge: { type, default: 0 },
    surgeMultiplier: { type, default: 1.0 },
    platformFee: { type, default: 0 },
    gstAmount: { type, default: 0 },
    totalFare: { type, default: 0 }
  },

  // 🚑 Ambulance commission details
  ambulanceCommission: {
    commissionRate: { type, default: 15 },    // Platform commission percentage
    commissionAmount: { type, default: 0 },    // Actual commission amount
    driverEarnings: { type, default: 0 },      // Driver's share
    providerEarnings: { type, default: 0 },    // Provider's share after commission
    emergencyDiscount: { type, default: 0 },   // Emergency commission discount
    surgeCommission: { type, default: 0 }      // Extra commission from surge
  },

  // 🚑 Ambulance driver payout
  ambulanceDriverPayout: {
    driverId: { type},
    driverName: { type},
    driverAmount: { type, default: 0 },
    payoutStatus: { type, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    payoutDate: { type},
    payoutReference: { type}
  },

  // 🚑 Ambulance provider settlement
  ambulanceProviderSettlement: {
    providerId: { type},
    providerName: { type},
    providerAmount: { type, default: 0 },
    settlementStatus: { type, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    settlementDate: { type},
    settlementReference: { type},
    settlementMode: { type, enum: ['neft', 'rtgs', 'imps', 'upi', 'bank_transfer'] }
  },

  // 🚑 Ambulance emergency surcharge tracking
  ambulanceSurgeDetails: {
    isPeakHour: { type, default},
    peakHourMultiplier: { type, default: 1.0 },
    demandMultiplier: { type, default: 1.0 },
    weatherMultiplier: { type, default: 1.0 },
    finalMultiplier: { type, default: 1.0 },
    surgeReason: { type}
  },

  // 🚑 Ambulance cancellation/refund
  ambulanceRefund: {
    isEmergencyCancellation: { type, default},
    driverReachedBeforeCancel: { type, default},
    cancellationFee: { type, default: 0 },
    driverCancellationPenalty: { type, default: 0 },
    refundToPatient: { type, default: 0 },
    refundStatus: { type, enum: ['pending', 'processed', 'failed', 'not_applicable'], default: 'not_applicable' }
  },

  // 🚑 Ambulance digital trip sheet reference
  ambulanceTripSheetId: { type},
  ambulanceTripSheetUrl: { type},

  // ============================================
  // REFUND BREAKDOWN
  // ============================================
  
  refund: {
    initiatedBy: { type, enum: ['patient', 'provider', 'admin', 'system'] },
    initiatedAt: { type},
    reason: { type},
    refundType: { type, enum: ['full', 'partial', 'advance_only'] },
    refundPercentage: { type},
    cancellationFee: { type, default: 0 },
    platformFeeRefunded: { type, default: 0 },
    gstRefunded: { type, default: 0 },
    processedBy: { type},
    processedAt: { type},
    refundMode: { type, enum: ['auto', 'manual', 'gateway'] },
    gatewayRefundId: { type},
    gatewayRefundStatus: { type}
  },
  
  // ============================================
  // INVOICE DETAILS
  // ============================================
  
  invoice: {
    invoiceNumber: { type},
    invoiceDate: { type},
    invoiceUrl: { type},
    gstin: { type},
    hsnCode: { type},
    placeOfSupply: { type}
  },
  
  // ============================================
  // SETTLEMENT TRACKING
  // ============================================
  
  settlement: {
    scheduledDate: { type},
    actualSettlementDate: { type},
    settlementMode: { type, enum: ['neft', 'rtgs', 'imps', 'upi', 'bank_transfer'] },
    settlementReference: { type},
    settlementStatus: { type, enum: ['pending', 'processing', 'completed', 'failed', 'on_hold'] },
    holdReason: { type},
    settlementNotes: { type}
  },
  
  // ============================================
  // RECONCILIATION FIELDS
  // ============================================
  
  reconciliation: {
    status: { type, enum: ['pending', 'matched', 'mismatch', 'not_required'] },
    reconciledAt: { type},
    reconciledBy: { type},
    mismatchReason: { type},
    adjustmentAmount: { type, default: 0 },
    adjustmentNote: { type}
  }
});

// ============================================
// INDEXES (PRESERVED + NEW)
// ============================================

transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ applicationId: 1 });
transactionSchema.index({ lenderId: 1 });
transactionSchema.index({ orderId: 1 });
transactionSchema.index({ paymentId: 1 });
transactionSchema.index({ bookingId: 1 });
transactionSchema.index({ userId: 1 });
transactionSchema.index({ providerId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ insurancePolicyId: 1 });
transactionSchema.index({ policyNumber: 1 });
transactionSchema.index({ insuranceSettlementStatus: 1 });
transactionSchema.index({ hospitalId: 1 });
transactionSchema.index({ 'refund.gatewayRefundId': 1 });
transactionSchema.index({ 'settlement.settlementStatus': 1 });
transactionSchema.index({ 'invoice.invoiceNumber': 1 });
transactionSchema.index({ paidAt: -1 });
transactionSchema.index({ refundedAt: -1 });
// 🚑 NEWindexes
transactionSchema.index({ ambulanceId: 1 });
transactionSchema.index({ ambulanceProviderId: 1 });
transactionSchema.index({ ambulanceDriverId: 1 });
transactionSchema.index({ 'ambulanceTripDetails.tripId': 1 });
transactionSchema.index({ 'ambulanceProviderSettlement.settlementStatus': 1 });
transactionSchema.index({ 'ambulanceDriverPayout.payoutStatus': 1 });
transactionSchema.index({ 'ambulanceTripDetails.isEmergency': 1, createdAt: -1 });
transactionSchema.index({ type: 1, createdAt: -1 });

// ============================================
// VIRTUAL FIELDS (PRESERVED + NEW)
// ============================================

transactionSchema.virtual('isSuccessful').get(function() {
  return this.status === 'completed' || this.status === 'captured';
});

transactionSchema.virtual('isRefunded').get(function() {
  return this.status === 'refunded' || this.status === 'partially_refunded';
});

transactionSchema.virtual('isPending').get(function() {
  return this.status === 'initiated' || this.status === 'pending';
});

transactionSchema.virtual('balanceDue').get(function() {
  if (this.status === 'completed' || this.status === 'refunded') {
    return 0;
  }
  return this.amount || this.netAmount || 0;
});

transactionSchema.virtual('isInsuranceTransaction').get(function() {
  return this.bookingType === 'insurance' || this.type === 'insurance_premium';
});

transactionSchema.virtual('netPayoutToCompany').get(function() {
  if (!this.isInsuranceTransaction) return 0;
  return this.totalPremium - this.insurancePlatformCommission;
});

transactionSchema.virtual('isHospitalBooking').get(function() {
  return ['opd', 'admission'].includes(this.bookingType);
});

transactionSchema.virtual('refundableAmount').get(function() {
  if (!this.refundAmount) return this.netAmount || this.amount || 0;
  return this.refundAmount;
});

transactionSchema.virtual('platformEarning').get(function() {
  return this.platformCommission + (this.convenienceFee || 0);
});

transactionSchema.virtual('providerEarning').get(function() {
  return (this.netAmount || this.amount || 0) - (this.platformCommission || 0) - (this.convenienceFee || 0);
});

// ============================================
// 🚑 AMBULANCE VIRTUAL FIELDS (NEW)
// ============================================

transactionSchema.virtual('isAmbulanceTransaction').get(function() {
  return this.bookingType === 'ambulance' || 
         this.bookingType === 'ambulance_emergency' ||
         ['ambulance_emergency', 'ambulance_scheduled', 'ambulance_payout', 'ambulance_refund'].includes(this.type);
});

transactionSchema.virtual('isEmergencyAmbulance').get(function() {
  return this.bookingType === 'ambulance_emergency' || 
         this.type === 'ambulance_emergency' ||
         (this.ambulanceTripDetails && this.ambulanceTripDetails.isEmergency);
});

transactionSchema.virtual('ambulanceTotalFare').get(function() {
  if (!this.ambulanceFareBreakdown) return this.netAmount || this.amount || 0;
  return this.ambulanceFareBreakdown.totalFare || this.netAmount || this.amount || 0;
});

transactionSchema.virtual('ambulancePlatformEarning').get(function() {
  if (!this.ambulanceCommission) return this.platformCommission || 0;
  return this.ambulanceCommission.commissionAmount || this.platformCommission || 0;
});

transactionSchema.virtual('ambulanceDriverEarning').get(function() {
  if (!this.ambulanceCommission) return 0;
  return this.ambulanceCommission.driverEarnings || 0;
});

transactionSchema.virtual('ambulanceProviderNetEarning').get(function() {
  if (!this.ambulanceCommission) return this.providerAmount || 0;
  return this.ambulanceCommission.providerEarnings || this.providerAmount || 0;
});

transactionSchema.virtual('ambulanceEffectiveCommissionRate').get(function() {
  if (!this.ambulanceCommission) return 15;
  const rate = this.ambulanceCommission.commissionRate || 15;
  const emergencyDiscount = this.ambulanceCommission.emergencyDiscount || 0;
  return Math.max(rate - emergencyDiscount, 5); // Minimum 5% commission
});

// ============================================
// METHODS (PRESERVED + NEW)
// ============================================

// Existing methods
transactionSchema.methods.markAsCompleted = function(gatewayReferenceId) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.gatewayReferenceId = gatewayReferenceId || this.gatewayReferenceId;
  this.webhookReceived = true;
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.failureReason = reason;
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.markAsPaid = function(paymentId, method) {
  this.status = 'completed';
  this.paymentId = paymentId;
  this.paidAt = new Date();
  this.paymentMethod = method || this.paymentMethod;
  this.completedAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.markAsRefunded = function(refundId, amount) {
  this.status = 'refunded';
  this.refundId = refundId;
  this.refundAmount = amount || this.amount;
  this.refundedAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.markCommissionPaid = function(paymentId) {
  this.commissionStatus = 'paid';
  this.commissionPaidAt = new Date();
  this.commissionPaymentId = paymentId;
  this.updatedAt = new Date();
  return this.save();
};

// Insurance methods
transactionSchema.methods.markInsuranceSettlementCompleted = function(transactionId) {
  this.insuranceSettlementStatus = 'completed';
  this.insuranceSettlementDate = new Date();
  this.insuranceSettlementTransactionId = transactionId;
  this.settledToProvider = true;
  this.settledAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.markInsuranceCommissionPaid = function(paymentId) {
  this.commissionStatus = 'paid';
  this.commissionPaidAt = new Date();
  this.commissionPaymentId = paymentId;
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.calculateInsuranceCommission = function() {
  if (!this.isInsuranceTransaction) return 0;
  const rate = this.insuranceCommissionRate || 15;
  this.insurancePlatformCommission = (this.totalPremium * rate) / 100;
  this.insurancePayoutToCompany = this.totalPremium - this.insurancePlatformCommission;
  this.platformCommission = this.insurancePlatformCommission;
  this.providerAmount = this.insurancePayoutToCompany;
  return {
    platformCommission.insurancePlatformCommission,
    payoutToCompany.insurancePayoutToCompany,
    commissionRate};
};

// Hospital methods
transactionSchema.methods.calculateHospitalCommission = function(commissionRate = 10) {
  const amount = this.netAmount || this.amount || 0;
  this.platformCommission = Math.round((amount * commissionRate) / 100);
  this.providerAmount = amount - this.platformCommission;
  return {
    platformCommission.platformCommission,
    providerAmount.providerAmount,
    commissionRate
  };
};

transactionSchema.methods.processRefund = function(refundData) {
  this.status = refundData.refundType === 'full' ? 'refunded' : 'partially_refunded';
  this.refundAmount = refundData.refundAmount || this.netAmount || this.amount;
  this.refundedAt = new Date();
  this.refundId = refundData.gatewayRefundId || this.refundId;
  
  this.refund = {
    initiatedBy.initiatedBy || 'system',
    initiatedAtDate(),
    reason.reason || 'Refund processed',
    refundType.refundType || 'full',
    refundPercentage.refundPercentage || 100,
    cancellationFee.cancellationFee || 0,
    platformFeeRefunded.platformFeeRefunded || 0,
    gstRefunded.gstRefunded || 0,
    processedBy.processedBy || 'system',
    processedAtDate(),
    refundMode.refundMode || 'gateway',
    gatewayRefundId.gatewayRefundId,
    gatewayRefundStatus: 'completed'
  };
  
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.generateInvoice = function(invoiceData) {
  this.invoice = {
    invoiceNumber.invoiceNumber || `INV-${this.transactionId}`,
    invoiceDateDate(),
    invoiceUrl.invoiceUrl || '',
    gstin.gstin || '',
    hsnCode.hsnCode || '999311',
    placeOfSupply.placeOfSupply || ''
  };
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.markSettlementCompleted = function(reference) {
  this.settlement = {
    ...this.settlement,
    actualSettlementDateDate(),
    settlementReference,
    settlementStatus: 'completed'
  };
  this.settledToProvider = true;
  this.settledAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.reconcile = function(status, notes) {
  this.reconciliation = {
    status|| 'matched',
    reconciledAtDate(),
    reconciledBy: 'system',
    mismatchReason=== 'mismatch' ? notes : '',
    adjustmentAmount: 0
  };
  this.updatedAt = new Date();
  return this.save();
};

// ============================================
// 🚑 AMBULANCE METHODS (NEW)
// ============================================

// Calculate ambulance fare breakdown
transactionSchema.methods.calculateAmbulanceFare = function(fareData) {
  const {
    baseFare = 500,
    distance = 0,
    perKmRate = 25,
    waitingMinutes = 0,
    waitingRatePerMin = 5,
    isNightTime = false,
    nightMultiplier = 1.5,
    oxygenAdministered = false,
    oxygenCharge = 200,
    equipmentUsed = [],
    equipmentCharge = 0,
    surgeMultiplier = 1.0,
    platformFee = 50
  } = fareData;

  const distanceCharge = Math.round(distance * perKmRate);
  const waitingCharge = Math.round(waitingMinutes * waitingRatePerMin);
  const nightCharge = isNightTime ? Math.round(baseFare * (nightMultiplier - 1)) : 0;
  const oxyCharge = oxygenAdministered ? oxygenCharge : 0;
  const surgeCharge = surgeMultiplier > 1 ? Math.round((baseFare + distanceCharge) * (surgeMultiplier - 1)) : 0;
  
  const subTotal = baseFare + distanceCharge + waitingCharge + nightCharge + oxyCharge + equipmentCharge + surgeCharge;
  const gstAmount = Math.round(subTotal * 0.05); // 5% GST on ambulance
  const totalFare = subTotal + gstAmount + platformFee;

  this.ambulanceFareBreakdown = {
    baseFare,
    distanceCharge,
    waitingCharge,
    nightCharge,
    oxygenCharge,
    equipmentCharge,
    surgeCharge,
    surgeMultiplier,
    platformFee,
    gstAmount,
    totalFare
  };

  this.netAmount = totalFare;
  this.originalAmount = totalFare;
  this.gstAmount = gstAmount;
  this.convenienceFee = platformFee;

  return this.ambulanceFareBreakdown;
};

// Calculate ambulance commission
transactionSchema.methods.calculateAmbulanceCommission = function(commissionRate = 15, isEmergency = false) {
  const totalFare = this.ambulanceFareBreakdown?.totalFare || this.netAmount || this.amount || 0;
  
  // Emergency bookings get 3% commission discount (12% instead of 15%)
  const emergencyDiscount = isEmergency ? 3 : 0;
  const effectiveRate = commissionRate - emergencyDiscount;
  
  const commissionAmount = Math.round((totalFare * effectiveRate) / 100);
  const driverShare = Math.round(commissionAmount * 0.4); // 40% of commission to driver
  const providerAmount = totalFare - commissionAmount;

  this.ambulanceCommission = {
    commissionRate,
    commissionAmount,
    driverEarnings,
    providerEarnings- driverShare,
    emergencyDiscount,
    surgeCommission: 0
  };

  this.platformCommission = commissionAmount;
  this.providerAmount = providerAmount;

  return this.ambulanceCommission;
};

// Process ambulance driver payout
transactionSchema.methods.processDriverPayout = function(payoutData) {
  this.ambulanceDriverPayout = {
    driverId.driverId,
    driverName.driverName,
    driverAmount.amount || this.ambulanceCommission?.driverEarnings || 0,
    payoutStatus: 'completed',
    payoutDateDate(),
    payoutReference.reference || `PAY-${Date.now()}`
  };
  this.updatedAt = new Date();
  return this.save();
};

// Process ambulance provider settlement
transactionSchema.methods.processProviderSettlement = function(settlementData) {
  this.ambulanceProviderSettlement = {
    providerId.providerId,
    providerName.providerName,
    providerAmount.amount || this.ambulanceCommission?.providerEarnings || 0,
    settlementStatus: 'completed',
    settlementDateDate(),
    settlementReference.reference || `SET-${Date.now()}`,
    settlementMode.mode || 'bank_transfer'
  };
  
  this.settledToProvider = true;
  this.settledAt = new Date();
  this.settlementAmount = this.ambulanceProviderSettlement.providerAmount;
  this.updatedAt = new Date();
  
  return this.save();
};

// Process ambulance refund
transactionSchema.methods.processAmbulanceRefund = function(refundData) {
  const isEmergency = this.isEmergencyAmbulance;
  const driverReached = refundData.driverReachedBeforeCancel || false;
  
  // If driver already reached, charge cancellation fee
  let cancellationFee = 0;
  if (driverReached && isEmergency) {
    cancellationFee = Math.round((this.netAmount || this.amount || 0) * 0.3); // 30% fee
  } else if (driverReached) {
    cancellationFee = Math.round((this.netAmount || this.amount || 0) * 0.2); // 20% for scheduled
  }
  
  const refundToPatient = (this.netAmount || this.amount || 0) - cancellationFee;
  
  this.status = refundToPatient > 0 ? 'partially_refunded' : 'refunded';
  this.refundAmount = refundToPatient;
  this.refundedAt = new Date();
  
  this.ambulanceRefund = {
    isEmergencyCancellation,
    driverReachedBeforeCancel,
    cancellationFee,
    driverCancellationPenalty: 0,
    refundToPatient,
    refundStatus: 'processed'
  };
  
  this.updatedAt = new Date();
  return this.save();
};

// Apply surge pricing
transactionSchema.methods.applySurgePricing = function(surgeData) {
  const {
    isPeakHour = false,
    peakHourMultiplier = 1.0,
    demandMultiplier = 1.0,
    weatherMultiplier = 1.0,
    reason = ''
  } = surgeData;

  const finalMultiplier = Math.max(peakHourMultiplier, demandMultiplier, weatherMultiplier, 1.0);
  
  this.ambulanceSurgeDetails = {
    isPeakHour,
    peakHourMultiplier,
    demandMultiplier,
    weatherMultiplier,
    finalMultiplier,
    surgeReason};

  // Recalculate fare with surge
  if (finalMultiplier > 1.0) {
    return this.calculateAmbulanceFare({
      ...this.ambulanceFareBreakdown,
      surgeMultiplier});
  }
  
  return this.ambulanceFareBreakdown;
};

// Mark ambulance trip as completed
transactionSchema.methods.completeAmbulanceTrip = function(tripData) {
  this.status = 'completed';
  this.completedAt = new Date();
  
  if (tripData) {
    this.ambulanceTripDetails = {
      ...this.ambulanceTripDetails,
      ...tripData,
      dropTimeDate()
    };
  }
  
  this.updatedAt = new Date();
  return this.save();
};

// Attach digital trip sheet
transactionSchema.methods.attachTripSheet = function(tripSheetId, tripSheetUrl) {
  this.ambulanceTripSheetId = tripSheetId;
  this.ambulanceTripSheetUrl = tripSheetUrl;
  this.updatedAt = new Date();
  return this.save();
};

// ============================================
// STATIC METHODS (PRESERVED + NEW)
// ============================================

transactionSchema.statics.generateTransactionId = function() {
  const prefix = 'TXN';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}_${timestamp}_${random}`;
};

transactionSchema.statics.getInsuranceTransactions = function(userId) {
  return this.find({ 
    userId, 
    bookingType: 'insurance' 
  }).sort({ createdAt: -1 });
};

transactionSchema.statics.getInsuranceSettlements = function(status) {
  const query = { bookingType: 'insurance' };
  if (status) {
    query.insuranceSettlementStatus = status;
  }
  return this.find(query).sort({ createdAt: -1 });
};

transactionSchema.statics.getHospitalTransactions = function(hospitalId, filters = {}) {
  const query = { hospitalId, ...filters };
  return this.find(query).sort({ createdAt: -1 });
};

transactionSchema.statics.getPendingSettlements = function() {
  return this.find({
    settledToProvider,
    status: { $in: ['completed', 'captured'] },
    providerAmount: { $gt: 0 }
  }).sort({ createdAt: 1 });
};

transactionSchema.statics.getDailyRevenue = function(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte, $lte},
        status: { $in: ['completed', 'captured'] }
      }
    },
    {
      $group: {
        _id: '$bookingType',
        totalAmount: { $sum: '$netAmount' },
        totalCommission: { $sum: '$platformCommission' },
        count: { $sum: 1 }
      }
    }
  ]);
};

transactionSchema.statics.getProviderRevenue = function(providerId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        providerId.Types.ObjectId(providerId),
        status: { $in: ['completed', 'captured'] },
        createdAt: { $gteDate(startDate), $lteDate(endDate) }
      }
    },
    {
      $group: {
        _id: '$bookingType',
        totalRevenue: { $sum: '$netAmount' },
        totalCommission: { $sum: '$platformCommission' },
        netEarnings: { $sum: '$providerAmount' },
        bookingCount: { $sum: 1 }
      }
    }
  ]);
};

// ============================================
// 🚑 AMBULANCE STATIC METHODS (NEW)
// ============================================

// Get ambulance transactions by provider
transactionSchema.statics.getAmbulanceProviderTransactions = function(providerId, filters = {}) {
  const query = { 
    ambulanceProviderId,
    type: { $in: ['ambulance_emergency', 'ambulance_scheduled', 'ambulance_payout'] },
    ...filters 
  };
  return this.find(query).sort({ createdAt: -1 });
};

// Get ambulance transactions by driver
transactionSchema.statics.getAmbulanceDriverTransactions = function(driverId, filters = {}) {
  const query = { 
    ambulanceDriverId,
    type: { $in: ['ambulance_emergency', 'ambulance_scheduled'] },
    ...filters 
  };
  return this.find(query).sort({ createdAt: -1 });
};

// Get emergency ambulance transactions
transactionSchema.statics.getEmergencyAmbulanceTransactions = function(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    type: 'ambulance_emergency',
    createdAt: { $gte, $lte},
    status: { $in: ['completed', 'captured'] }
  }).sort({ createdAt: -1 });
};

// Get ambulance daily revenue
transactionSchema.statics.getAmbulanceDailyRevenue = function(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.aggregate([
    {
      $match: {
        type: { $in: ['ambulance_emergency', 'ambulance_scheduled'] },
        createdAt: { $gte, $lte},
        status: { $in: ['completed', 'captured'] }
      }
    },
    {
      $group: {
        _id: '$type',
        totalRevenue: { $sum: '$netAmount' },
        totalCommission: { $sum: '$platformCommission' },
        tripCount: { $sum: 1 },
        avgFare: { $avg: '$netAmount' },
        totalSurgeRevenue: { $sum: '$ambulanceFareBreakdown.surgeCharge' }
      }
    }
  ]);
};

// Get pending ambulance driver payouts
transactionSchema.statics.getPendingDriverPayouts = function() {
  return this.find({
    type: { $in: ['ambulance_emergency', 'ambulance_scheduled'] },
    status: 'completed',
    'ambulanceDriverPayout.payoutStatus': 'pending',
    'ambulanceCommission.driverEarnings': { $gt: 0 }
  }).sort({ createdAt: 1 });
};

// Get pending ambulance provider settlements
transactionSchema.statics.getPendingProviderSettlements = function() {
  return this.find({
    type: { $in: ['ambulance_emergency', 'ambulance_scheduled'] },
    status: 'completed',
    'ambulanceProviderSettlement.settlementStatus': 'pending',
    'ambulanceCommission.providerEarnings': { $gt: 0 }
  }).sort({ createdAt: 1 });
};

// Get ambulance surge pricing analytics
transactionSchema.statics.getSurgeAnalytics = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        type: 'ambulance_emergency',
        createdAt: { $gteDate(startDate), $lteDate(endDate) },
        'ambulanceSurgeDetails.finalMultiplier': { $gt: 1.0 }
      }
    },
    {
      $group: {
        _id: {
          hour: { $hour: '$createdAt' },
          isPeakHour: '$ambulanceSurgeDetails.isPeakHour'
        },
        avgMultiplier: { $avg: '$ambulanceSurgeDetails.finalMultiplier' },
        tripCount: { $sum: 1 },
        totalSurgeRevenue: { $sum: '$ambulanceFareBreakdown.surgeCharge' }
      }
    },
    { $sort: { '_id.hour': 1 } }
  ]);
};

// ============================================
// PRE-SAVE HOOK (PRESERVED + ENHANCED)
// ============================================

transactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-generate transaction ID if not provided
  if (!this.transactionId) {
    this.transactionId = this.constructor.generateTransactionId();
  }
  
  // Auto-calculate net amount
  if ((this.amount || this.originalAmount) && !this.netAmount) {
    const baseAmount = this.amount || this.originalAmount || 0;
    this.netAmount = baseAmount - (this.discountAmount || 0) + (this.taxAmount || 0) + (this.convenienceFee || 0);
  }
  
  // Auto-calculate GST if tax amount exists
  if (this.taxAmount && this.taxAmount > 0 && this.gst && this.gst.totalGst === 0) {
    const gstRate = 0.18;
    const taxableAmount = (this.netAmount || this.amount) / (1 + gstRate);
    const totalGst = (this.netAmount || this.amount) - taxableAmount;
    
    this.gst = {
      cgst.round(totalGst / 2 * 100) / 100,
      sgst.round(totalGst / 2 * 100) / 100,
      igst: 0,
      totalGst.round(totalGst * 100) / 100
    };
  }
  
  // 🚑 Auto-set ambulance transaction type based on booking type
  if (this.bookingType === 'ambulance_emergency' && !this.type) {
    this.type = 'ambulance_emergency';
  } else if (this.bookingType === 'ambulance' && !this.type) {
    this.type = 'ambulance_scheduled';
  }
  
  // 🚑 Auto-set emergency flag
  if (this.type === 'ambulance_emergency' && this.ambulanceTripDetails) {
    this.ambulanceTripDetails.isEmergency = true;
  }
  
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);


const mongoose = require('mongoose');

const MentalHealthBookingSchema = new mongoose.Schema({
  therapistId: { type.Schema.Types.ObjectId, ref: 'MentalHealthTherapist', required},
  patientId: { type.Schema.Types.ObjectId, ref: 'User', required},
  
  // Booking Details
  bookingType: {
    type,
    enum: ['video', 'audio', 'text', 'anonymous', 'emergency', 'couples', 'family'],
    required},
  sessionType: {
    type,
    enum: ['individual', 'couples', 'family', 'group'],
    default: 'individual'
  },
  
  // Scheduling
  scheduledDate: { type, required},
  scheduledTime: { type, required},
  duration: { type, default: 60 }, // minutes
  
  // ============================================
  // PRICING & FINANCE (MODIFIED - Added Fields)
  // ============================================
  
  // Original pricing fields (preserved)
  amount: { type, required},
  platformCommission: { type, default: 0 },
  therapistEarning: { type, default: 0 },
  
  // NEW FINANCE FIELDS (Added for revenue & payout system)
  patientAmount: {
    type,
    required,
    min: 0
  },
  commissionRate: {
    type,
    default: 15,
    min: 0,
    max: 100
  },
  commissionRuleId: {
    type.Schema.Types.ObjectId,
    ref: 'CommissionRule'
  },
  
  // Payment Status (Enhanced)
  paymentStatus: {
    type,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  paymentId: { type},
  orderId: { type},
  paymentMethod: {
    type,
    enum: ['card', 'upi', 'netbanking', 'wallet', 'corporate', 'insurance'],
    default: 'card'
  },
  paidAt: { type},
  
  // Payout Status (NEW)
  payoutStatus: {
    type,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  payoutId: {
    type.Schema.Types.ObjectId,
    ref: 'TherapistPayout'
  },
  payoutRequestedAt: { type},
  payoutCompletedAt: { type},
  
  // Refund Details (NEW)
  refundAmount: {
    type,
    default: 0
  },
  refundId: {
    type},
  refundStatus: {
    type,
    enum: ['none', 'pending', 'completed', 'failed'],
    default: 'none'
  },
  refundedAt: { type},
  refundReason: { type},
  
  // Corporate/Insurance Billing (NEW)
  isCorporateBooking: {
    type,
    default},
  corporateId: {
    type.Schema.Types.ObjectId,
    ref: 'CorporateEmployee'
  },
  insuranceClaimId: {
    type.Schema.Types.ObjectId,
    ref: 'InsuranceClaim'
  },
  billingType: {
    type,
    enum: ['self_pay', 'corporate', 'insurance'],
    default: 'self_pay'
  },
  
  // ============================================
  // EXISTING FIELDS (PRESERVED)
  // ============================================
  
  // Status
  status: {
    type,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'pending'
  },
  
  // Session Details
  isAnonymous: { type, default},
  anonymousId: { type}, // Random ID for anonymous sessions
  
  // Emergency Flag
  isEmergency: { type, default},
  emergencyLevel: { type, enum: ['low', 'medium', 'high', 'critical'] },
  crisisNotes: { type},
  
  // Patient Details (for emergency)
  emergencyContact: {
    name,
    phone,
    relation},
  
  // Couples/Family Therapy
  participants: [{
    name,
    age,
    relation,
    email}],
  
  // Notes
  patientNotes: { type},
  therapistNotes: { type}, // Added after session
  cancellationReason: { type},
  
  // Session Link (for video)
  sessionLink: { type},
  
  // Feedback
  feedback: {
    rating: { type, min: 1, max: 5 },
    review: { type},
    submittedAt: { type}
  },
  
  // Follow-up
  followUpScheduled: { type, default},
  followUpDate: { type},
  
  createdAt: { type, default.now },
  updatedAt: { type, default.now }
});

// ============================================
// INDEXES (PRESERVED + NEW)
// ============================================

// Existing indexes
MentalHealthBookingSchema.index({ therapistId: 1, scheduledDate: 1 });
MentalHealthBookingSchema.index({ patientId: 1 });
MentalHealthBookingSchema.index({ status: 1 });
MentalHealthBookingSchema.index({ isEmergency: 1 });

// NEW INDEXES for revenue & payout
MentalHealthBookingSchema.index({ paymentStatus: 1, payoutStatus: 1 });
MentalHealthBookingSchema.index({ patientAmount: 1, platformCommission: 1 });
MentalHealthBookingSchema.index({ isCorporateBooking: 1 });
MentalHealthBookingSchema.index({ billingType: 1 });
MentalHealthBookingSchema.index({ payoutId: 1 });

// ============================================
// VIRTUALS (PRESERVED + NEW)
// ============================================

// Existing virtuals
MentalHealthBookingSchema.virtual('isActive').get(function() {
  return ['pending', 'confirmed', 'in_progress'].includes(this.status);
});

MentalHealthBookingSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

// NEW VIRTUALS for finance
MentalHealthBookingSchema.virtual('netEarnings').get(function() {
  return this.therapistEarning || (this.amount - this.platformCommission);
});

MentalHealthBookingSchema.virtual('commissionPercentage').get(function() {
  if (this.amount === 0) return 0;
  return ((this.platformCommission / this.amount) * 100).toFixed(2);
});

MentalHealthBookingSchema.virtual('isPaid').get(function() {
  return this.paymentStatus === 'paid' || this.paymentStatus === 'completed';
});

MentalHealthBookingSchema.virtual('isPayoutCompleted').get(function() {
  return this.payoutStatus === 'completed';
});

// ============================================
// METHODS (PRESERVED + NEW)
// ============================================

// Existing methods
MentalHealthBookingSchema.methods.cancel = function(reason) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  return this.save();
};

MentalHealthBookingSchema.methods.complete = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

MentalHealthBookingSchema.methods.addFeedback = function(rating, review) {
  this.feedback = { rating, review, submittedAtDate() };
  return this.save();
};

// ============================================
// NEW METHODS for revenue & payout
// ============================================

// Mark payment as completed
MentalHealthBookingSchema.methods.markPaymentCompleted = function(paymentId, paymentMethod = 'card') {
  this.paymentStatus = 'paid';
  this.paymentId = paymentId;
  this.paymentMethod = paymentMethod;
  this.paidAt = new Date();
  this.status = 'confirmed';
  return this.save();
};

// Mark payment as failed
MentalHealthBookingSchema.methods.markPaymentFailed = function(reason) {
  this.paymentStatus = 'failed';
  this.cancellationReason = reason;
  this.status = 'cancelled';
  return this.save();
};

// Request payout for this booking
MentalHealthBookingSchema.methods.requestPayout = function(payoutId) {
  this.payoutStatus = 'processing';
  this.payoutId = payoutId;
  this.payoutRequestedAt = new Date();
  return this.save();
};

// Complete payout for this booking
MentalHealthBookingSchema.methods.completePayout = function() {
  this.payoutStatus = 'completed';
  this.payoutCompletedAt = new Date();
  return this.save();
};

// Process refund
MentalHealthBookingSchema.methods.processRefund = function(amount, refundId, reason = '') {
  this.refundAmount = amount;
  this.refundId = refundId;
  this.refundStatus = 'completed';
  this.refundedAt = new Date();
  this.refundReason = reason;
  this.paymentStatus = 'refunded';
  return this.save();
};

// ============================================
// STATIC METHODS (NEW)
// ============================================

MentalHealthBookingSchema.statics = {
  // Get revenue summary for a therapist
  async getTherapistRevenueSummary(therapistId, startDate, endDate) {
    const match = { therapistId };
    if (startDate) match.scheduledDate = { $gteDate(startDate) };
    if (endDate) match.scheduledDate = { ...match.scheduledDate, $lteDate(endDate) };
    match.paymentStatus = 'paid';
    
    const result = await this.aggregate([
      { $match},
      {
        $group: {
          _id,
          totalRevenue: { $sum: '$patientAmount' },
          totalCommission: { $sum: '$platformCommission' },
          totalEarnings: { $sum: '$therapistEarning' },
          totalSessions: { $sum: 1 }
        }
      }
    ]);
    
    return result[0] || { totalRevenue: 0, totalCommission: 0, totalEarnings: 0, totalSessions: 0 };
  },
  
  // Get platform revenue summary (admin)
  async getPlatformRevenueSummary(startDate, endDate) {
    const match = {};
    if (startDate) match.scheduledDate = { $gteDate(startDate) };
    if (endDate) match.scheduledDate = { ...match.scheduledDate, $lteDate(endDate) };
    match.paymentStatus = 'paid';
    
    const result = await this.aggregate([
      { $match},
      {
        $group: {
          _id,
          totalRevenue: { $sum: '$patientAmount' },
          totalCommission: { $sum: '$platformCommission' },
          totalSessions: { $sum: 1 },
          totalTherapistPayout: { $sum: '$therapistEarning' }
        }
      }
    ]);
    
    return result[0] || { totalRevenue: 0, totalCommission: 0, totalSessions: 0, totalTherapistPayout: 0 };
  },
  
  // Get pending payouts for admin
  async getPendingPayouts(limit = 100) {
    return this.find({
      payoutStatus: 'pending',
      paymentStatus: 'paid'
    })
      .populate('therapistId', 'name email phone')
      .populate('patientId', 'name email phone')
      .sort({ scheduledDate: 1 })
      .limit(limit);
  },
  
  // Get booking with finance details for therapist
  async getTherapistBookingsWithFinance(therapistId, status = null, limit = 50, skip = 0) {
    const query = { therapistId };
    if (status) query.status = status;
    
    const [bookings, total] = await Promise.all([
      this.find(query)
        .populate('patientId', 'name email phone')
        .sort({ scheduledDate: -1 })
        .skip(skip)
        .limit(limit)
        .select('patientId scheduledDate scheduledTime amount platformCommission therapistEarning paymentStatus payoutStatus status feedback'),
      this.countDocuments(query)
    ]);
    
    return { bookings, total };
  }
};

// ============================================
// PRE-SAVE MIDDLEWARE (NEW)
// ============================================

MentalHealthBookingSchema.pre('save', function(next) {
  // Auto-calculate earnings if not set
  if (this.amount && !this.therapistEarning) {
    this.therapistEarning = this.amount - (this.platformCommission || 0);
  }
  
  // Sync patientAmount with amount for consistency
  if (this.amount && !this.patientAmount) {
    this.patientAmount = this.amount;
  }
  
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('MentalHealthBooking', MentalHealthBookingSchema);


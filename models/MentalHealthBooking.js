const mongoose = require('mongoose');

const MentalHealthBookingSchema = new mongoose.Schema({
  therapistId: { type: mongoose.Schema.Types.ObjectId, ref: 'MentalHealthTherapist', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Booking Details
  bookingType: {
    type: String,
    enum: ['video', 'audio', 'text', 'anonymous', 'emergency', 'couples', 'family'],
    required: true
  },
  sessionType: {
    type: String,
    enum: ['individual', 'couples', 'family', 'group'],
    default: 'individual'
  },
  
  // Scheduling
  scheduledDate: { type: Date, required: true },
  scheduledTime: { type: String, required: true },
  duration: { type: Number, default: 60 }, // minutes
  
  // ============================================
  // PRICING & FINANCE (MODIFIED - Added Fields)
  // ============================================
  
  // Original pricing fields (preserved)
  amount: { type: Number, required: true },
  platformCommission: { type: Number, default: 0 },
  therapistEarning: { type: Number, default: 0 },
  
  // NEW FINANCE FIELDS (Added for revenue & payout system)
  patientAmount: {
    type: Number,
    required: true,
    min: 0
  },
  commissionRate: {
    type: Number,
    default: 15,
    min: 0,
    max: 100
  },
  commissionRuleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommissionRule'
  },
  
  // Payment Status (Enhanced)
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  paymentId: { type: String },
  orderId: { type: String },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet', 'corporate', 'insurance'],
    default: 'card'
  },
  paidAt: { type: Date },
  
  // Payout Status (NEW)
  payoutStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  payoutId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TherapistPayout'
  },
  payoutRequestedAt: { type: Date },
  payoutCompletedAt: { type: Date },
  
  // Refund Details (NEW)
  refundAmount: {
    type: Number,
    default: 0
  },
  refundId: {
    type: String
  },
  refundStatus: {
    type: String,
    enum: ['none', 'pending', 'completed', 'failed'],
    default: 'none'
  },
  refundedAt: { type: Date },
  refundReason: { type: String },
  
  // Corporate/Insurance Billing (NEW)
  isCorporateBooking: {
    type: Boolean,
    default: false
  },
  corporateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CorporateEmployee'
  },
  insuranceClaimId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsuranceClaim'
  },
  billingType: {
    type: String,
    enum: ['self_pay', 'corporate', 'insurance'],
    default: 'self_pay'
  },
  
  // ============================================
  // EXISTING FIELDS (PRESERVED)
  // ============================================
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'pending'
  },
  
  // Session Details
  isAnonymous: { type: Boolean, default: false },
  anonymousId: { type: String }, // Random ID for anonymous sessions
  
  // Emergency Flag
  isEmergency: { type: Boolean, default: false },
  emergencyLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  crisisNotes: { type: String },
  
  // Patient Details (for emergency)
  emergencyContact: {
    name: String,
    phone: String,
    relation: String
  },
  
  // Couples/Family Therapy
  participants: [{
    name: String,
    age: Number,
    relation: String,
    email: String
  }],
  
  // Notes
  patientNotes: { type: String },
  therapistNotes: { type: String }, // Added after session
  cancellationReason: { type: String },
  
  // Session Link (for video)
  sessionLink: { type: String },
  
  // Feedback
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String },
    submittedAt: { type: Date }
  },
  
  // Follow-up
  followUpScheduled: { type: Boolean, default: false },
  followUpDate: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
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
  this.feedback = { rating, review, submittedAt: new Date() };
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
    if (startDate) match.scheduledDate = { $gte: new Date(startDate) };
    if (endDate) match.scheduledDate = { ...match.scheduledDate, $lte: new Date(endDate) };
    match.paymentStatus = 'paid';
    
    const result = await this.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
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
    if (startDate) match.scheduledDate = { $gte: new Date(startDate) };
    if (endDate) match.scheduledDate = { ...match.scheduledDate, $lte: new Date(endDate) };
    match.paymentStatus = 'paid';
    
    const result = await this.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
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
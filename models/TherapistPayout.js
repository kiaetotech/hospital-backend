const mongoose = require('mongoose');

const therapistPayoutSchema = new mongoose.Schema({
  therapistId: {
    type.Schema.Types.ObjectId,
    ref: 'MentalHealthTherapist',
    required,
    index},
  walletId: {
    type.Schema.Types.ObjectId,
    ref: 'TherapistWallet',
    required},
  
  // Payout Details
  amount: {
    type,
    required,
    min: 0
  },
  platformCommission: {
    type,
    default: 0
  },
  netAmount: {
    type,
    required},
  
  // Booking References
  bookingIds: [{
    type.Schema.Types.ObjectId,
    ref: 'MentalHealthBooking'
  }],
  
  // Payout Method
  method: {
    type,
    enum: ['bank_transfer', 'upi', 'razorpay_payout', 'cheque'],
    required},
  
  // Bank/UPI Details
  bankDetails: {
    accountNumber,
    accountHolderName,
    ifscCode,
    bankName,
    upiId,
    razorpayPayoutId},
  
  // Status Tracking
  status: {
    type,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  
  // Razorpay Payout Response
  razorpayResponse: {
    payoutId,
    status,
    utr,
    failureReason,
    response.Schema.Types.Mixed
  },
  
  // Timeline
  requestedAt: {
    type,
    default.now
  },
  processedAt,
  completedAt,
  failedAt,
  
  // Notes
  notes,
  adminNotes,
  
  // Processed By
  processedBy: {
    type.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps});

// Indexes
therapistPayoutSchema.index({ therapistId: 1, status: 1 });
therapistPayoutSchema.index({ status: 1, requestedAt: -1 });
therapistPayoutSchema.index({ 'razorpayResponse.utr': 1 }, { sparse});

// Virtuals
therapistPayoutSchema.virtual('statusLabel').get(function() {
  const labels = {
    'pending': 'Pending',
    'processing': 'Processing',
    'completed': 'Completed',
    'failed': 'Failed',
    'cancelled': 'Cancelled',
    'refunded': 'Refunded'
  };
  return labels[this.status] || this.status;
});

// Static methods
therapistPayoutSchema.statics = {
  // Get pending payouts
  async getPendingPayouts(limit = 50) {
    return this.find({ status: 'pending' })
      .sort({ requestedAt: 1 })
      .limit(limit)
      .populate('therapistId', 'name email phone')
      .populate('walletId', 'bankDetails');
  },
  
  // Get payouts by therapist
  async getByTherapist(therapistId, status = null, limit = 50, skip = 0) {
    const query = { therapistId };
    if (status) query.status = status;
    
    const [payouts, total] = await Promise.all([
      this.find(query)
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('bookingIds', 'date timeSlot amount'),
      this.countDocuments(query)
    ]);
    
    return { payouts, total };
  },
  
  // Get payout summary
  async getSummary(therapistId) {
    const summary = await this.aggregate([
      { $match: { therapistId } },
      {
        $group: {
          _id,
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, '$netAmount', 0]
            }
          },
          totalPending: {
            $sum: {
              $cond: [{ $in: ['$status', ['pending', 'processing']] }, '$netAmount', 0]
            }
          },
          totalFailed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'failed'] }, '$netAmount', 0]
            }
          },
          count: { $sum: 1 },
          pendingCount: {
            $sum: {
              $cond: [{ $in: ['$status', ['pending', 'processing']] }, 1, 0]
            }
          }
        }
      }
    ]);
    
    return summary[0] || {
      totalPaid: 0,
      totalPending: 0,
      totalFailed: 0,
      count: 0,
      pendingCount: 0
    };
  }
};

// Instance methods
therapistPayoutSchema.methods = {
  // Mark as processing
  markProcessing() {
    this.status = 'processing';
    this.processedAt = new Date();
    return this.save();
  },
  
  // Mark as completed
  markCompleted(razorpayResponse) {
    this.status = 'completed';
    this.completedAt = new Date();
    if (razorpayResponse) {
      this.razorpayResponse = {
        payoutId.id,
        status.status,
        utr.utr,
        response};
    }
    return this.save();
  },
  
  // Mark as failed
  markFailed(reason, razorpayResponse) {
    this.status = 'failed';
    this.failedAt = new Date();
    this.notes = reason;
    if (razorpayResponse) {
      this.razorpayResponse = {
        failureReason.failure_reason,
        response};
    }
    return this.save();
  }
};

// Pre-save middleware
therapistPayoutSchema.pre('save', function(next) {
  // Calculate net amount if not set
  if (!this.netAmount) {
    this.netAmount = this.amount - (this.platformCommission || 0);
  }
  next();
});

const TherapistPayout = mongoose.model('TherapistPayout', therapistPayoutSchema);

module.exports = TherapistPayout;


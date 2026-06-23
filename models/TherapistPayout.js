const mongoose = require('mongoose');

const therapistPayoutSchema = new mongoose.Schema({
  therapistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MentalHealthTherapist',
    required: true,
    index: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TherapistWallet',
    required: true
  },
  
  // Payout Details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  platformCommission: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number,
    required: true
  },
  
  // Booking References
  bookingIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MentalHealthBooking'
  }],
  
  // Payout Method
  method: {
    type: String,
    enum: ['bank_transfer', 'upi', 'razorpay_payout', 'cheque'],
    required: true
  },
  
  // Bank/UPI Details
  bankDetails: {
    accountNumber: String,
    accountHolderName: String,
    ifscCode: String,
    bankName: String,
    upiId: String,
    razorpayPayoutId: String
  },
  
  // Status Tracking
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  
  // Razorpay Payout Response
  razorpayResponse: {
    payoutId: String,
    status: String,
    utr: String,
    failureReason: String,
    response: mongoose.Schema.Types.Mixed
  },
  
  // Timeline
  requestedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
  completedAt: Date,
  failedAt: Date,
  
  // Notes
  notes: String,
  adminNotes: String,
  
  // Processed By
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
therapistPayoutSchema.index({ therapistId: 1, status: 1 });
therapistPayoutSchema.index({ status: 1, requestedAt: -1 });
therapistPayoutSchema.index({ 'razorpayResponse.utr': 1 }, { sparse: true });

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
          _id: null,
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
        payoutId: razorpayResponse.id,
        status: razorpayResponse.status,
        utr: razorpayResponse.utr,
        response: razorpayResponse
      };
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
        failureReason: razorpayResponse.failure_reason,
        response: razorpayResponse
      };
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
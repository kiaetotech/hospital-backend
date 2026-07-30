const mongoose = require('mongoose');

const corporateBillingSchema = new mongoose.Schema({
  // Company Reference
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CorporatePlan',
    required: true,
    index: true
  },
  hrId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CorporateHR',
    required: true
  },

  // Billing Period
  billingPeriod: {
    type: String,
    enum: ['monthly', 'quarterly', 'half_yearly', 'yearly'],
    default: 'monthly'
  },
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },

  // Amount Breakdown
  baseAmount: {
    type: Number,
    required: true,
    min: 0
  },
  perEmployeeAmount: {
    type: Number,
    default: 0
  },
  totalEmployees: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true,
    min: 0
  },

  // Invoice Details
  invoiceNumber: {
    type: String,
    unique: true,
    required: true
  },
  invoiceUrl: {
    type: String
  },
  notes: {
    type: String
  },

  // Payment Status
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paymentId: {
    type: String
  },
  paymentDate: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'bank_transfer', 'cheque', 'upi'],
    default: 'razorpay'
  },

  // Usage Breakdown
  usage: {
    consultations: {
      type: Number,
      default: 0
    },
    checkups: {
      type: Number,
      default: 0
    },
    wellnessSessions: {
      type: Number,
      default: 0
    },
    claimsFiled: {
      type: Number,
      default: 0
    },
    claimsSettled: {
      type: Number,
      default: 0
    }
  },

  // Payment Reminders
  reminders: [{
    sentAt: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['email', 'sms', 'whatsapp']
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'opened']
    }
  }],

  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }

}, {
  timestamps: true
});

// Indexes
corporateBillingSchema.index({ companyId: 1, status: 1 });
corporateBillingSchema.index({ invoiceNumber: 1 });
corporateBillingSchema.index({ dueDate: 1 });
corporateBillingSchema.index({ periodStart: 1, periodEnd: 1 });

// Virtuals
corporateBillingSchema.virtual('isOverdue').get(function() {
  return this.status === 'pending' && new Date() > this.dueDate;
});

corporateBillingSchema.virtual('statusLabel').get(function() {
  const labels = {
    'pending': 'Pending',
    'paid': 'Paid',
    'overdue': 'Overdue',
    'cancelled': 'Cancelled',
    'refunded': 'Refunded'
  };
  return labels[this.status] || this.status;
});

// Static methods
corporateBillingSchema.statics = {
  // Generate invoice number
  async generateInvoiceNumber() {
    const count = await this.countDocuments();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `INV-${year}${month}-${String(count + 1).padStart(6, '0')}`;
  },

  // Get billing summary for a company
  async getCompanyBillingSummary(companyId) {
    const summary = await this.aggregate([
      { $match: { companyId } },
      {
        $group: {
          _id: null,
          totalBilled: { $sum: '$finalAmount' },
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ['$status', 'paid'] }, '$finalAmount', 0]
            }
          },
          totalPending: {
            $sum: {
              $cond: [{ $in: ['$status', ['pending', 'overdue']] }, '$finalAmount', 0]
            }
          },
          totalOverdue: {
            $sum: {
              $cond: [{ $eq: ['$status', 'overdue'] }, '$finalAmount', 0]
            }
          },
          count: { $sum: 1 },
          pendingCount: {
            $sum: {
              $cond: [{ $in: ['$status', ['pending', 'overdue']] }, 1, 0]
            }
          }
        }
      }
    ]);

    return summary[0] || {
      totalBilled: 0,
      totalPaid: 0,
      totalPending: 0,
      totalOverdue: 0,
      count: 0,
      pendingCount: 0
    };
  },

  // Get overdue invoices
  async getOverdueInvoices() {
    return this.find({
      status: 'pending',
      dueDate: { $lt: new Date() }
    }).populate('companyId', 'companyName email')
      .sort({ dueDate: 1 });
  }
};

// Instance methods
corporateBillingSchema.methods = {
  // Mark as paid
  markAsPaid(paymentId, paymentMethod = 'razorpay') {
    this.status = 'paid';
    this.paymentId = paymentId;
    this.paymentDate = new Date();
    this.paymentMethod = paymentMethod;
    return this.save();
  },

  // Mark as overdue
  markAsOverdue() {
    if (this.status === 'pending' && new Date() > this.dueDate) {
      this.status = 'overdue';
      return this.save();
    }
    return this;
  },

  // Add reminder
  addReminder(type, status = 'sent') {
    this.reminders.push({
      sentAt: new Date(),
      type,
      status
    });
    return this.save();
  },

  // Calculate final amount
  calculateFinalAmount() {
    this.finalAmount = this.totalAmount + (this.taxAmount || 0) - (this.discountAmount || 0);
    return this;
  }
};

// Pre-save middleware
corporateBillingSchema.pre('save', function(next) {
  // Auto-generate invoice number
  if (!this.invoiceNumber) {
    this.invoiceNumber = generateInvoiceNumber();
  }

  // Calculate final amount
  if (this.totalAmount !== undefined) {
    this.finalAmount = this.totalAmount + (this.taxAmount || 0) - (this.discountAmount || 0);
  }

  next();
});

const CorporateBilling = mongoose.model('CorporateBilling', corporateBillingSchema);

module.exports = CorporateBilling;
const mongoose = require('mongoose');

const corporateBillingSchema = new mongoose.Schema({
  // Company Reference
  companyId: {
    type.Schema.Types.ObjectId,
    ref: 'CorporatePlan',
    required,
    index},
  hrId: {
    type.Schema.Types.ObjectId,
    ref: 'CorporateHR',
    required},

  // Billing Period
  billingPeriod: {
    type,
    enum: ['monthly', 'quarterly', 'half_yearly', 'yearly'],
    default: 'monthly'
  },
  periodStart: {
    type,
    required},
  periodEnd: {
    type,
    required},
  dueDate: {
    type,
    required},

  // Amount Breakdown
  baseAmount: {
    type,
    required,
    min: 0
  },
  perEmployeeAmount: {
    type,
    default: 0
  },
  totalEmployees: {
    type,
    default: 0
  },
  totalAmount: {
    type,
    required,
    min: 0
  },
  taxAmount: {
    type,
    default: 0
  },
  discountAmount: {
    type,
    default: 0
  },
  finalAmount: {
    type,
    required,
    min: 0
  },

  // Invoice Details
  invoiceNumber: {
    type,
    unique,
    required},
  invoiceUrl: {
    type},
  notes: {
    type},

  // Payment Status
  status: {
    type,
    enum: ['pending', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paymentId: {
    type},
  paymentDate: {
    type},
  paymentMethod: {
    type,
    enum: ['razorpay', 'bank_transfer', 'cheque', 'upi'],
    default: 'razorpay'
  },

  // Usage Breakdown
  usage: {
    consultations: {
      type,
      default: 0
    },
    checkups: {
      type,
      default: 0
    },
    wellnessSessions: {
      type,
      default: 0
    },
    claimsFiled: {
      type,
      default: 0
    },
    claimsSettled: {
      type,
      default: 0
    }
  },

  // Payment Reminders
  reminders: [{
    sentAt: {
      type,
      default.now
    },
    type: {
      type,
      enum: ['email', 'sms', 'whatsapp']
    },
    status: {
      type,
      enum: ['sent', 'failed', 'opened']
    }
  }],

  // Audit
  createdBy: {
    type.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type.Schema.Types.ObjectId,
    ref: 'User'
  }

}, {
  timestamps});

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
          _id,
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
      dueDate: { $ltDate() }
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
      sentAtDate(),
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


const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  payoutId: { type: String, unique: true, required: true, index: true },
  
  providerType: { 
    type: String, 
    enum: [
      'doctor', 'center',
      'ayurveda_doctor', 'wellness_center',
      'hospital', 'ambulance_provider', 'ambulance_driver',
      'caregiver', 'diagnostics_lab', 'insurance_company',
      'lender', 'online_doctor', 'homeopathy_doctor',
      'therapist', 'corporate_hr'
    ], 
    required: true,
    index: true
  },
  
  providerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  providerName: { type: String, required: true },
  
  // Immutable snapshot of provider at payout creation time
  providerSnapshot: {
    name: { type: String, default: '' },
    city: { type: String, default: 'Unknown' },
    state: { type: String, default: '' },
    phone: { type: String, default: '' },
    capturedAt: { type: Date, default: Date.now }
  },
  
  // Denormalized city for fast aggregation
  providerCity: { 
    type: String, 
    default: 'Unknown', 
    index: true,
    trim: true
  },
  
  amount: { type: Number, required: true, min: 0 },
  commissionDeducted: { type: Number, default: 0 },
  tdsDeducted: { type: Number, default: 0 },
  netAmount: { type: Number, required: true, min: 0 },
  
  bookingCount: { type: Number, default: 0 },
  period: { 
    type: String, 
    enum: ['weekly', 'monthly', 'manual', 'daily', 'biweekly'] 
  },
  periodStart: Date,
  periodEnd: Date,
  
  status: { 
    type: String, 
    enum: ['pending', 'requested', 'approved', 'processing', 'paid', 'failed', 'rejected', 'on_hold'], 
    default: 'pending',
    index: true
  },
  
  transactionId: String,
  paidAt: Date,
  approvedAt: Date,
  rejectedAt: Date,
  rejectionReason: String,
  adminNote: String,
  
  bookingIds: [{ type: mongoose.Schema.Types.ObjectId }],
  
  bankDetails: {
    accountHolder: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String
  },
  
  createdAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
payoutSchema.index({ providerId: 1, providerType: 1 });
payoutSchema.index({ status: 1, createdAt: -1 });
payoutSchema.index({ providerCity: 1, status: 1, createdAt: -1 });
payoutSchema.index({ providerType: 1, status: 1, createdAt: -1 });

// Virtuals
payoutSchema.virtual('isPendingApproval').get(function() {
  return this.status === 'requested';
});

payoutSchema.virtual('isSettled').get(function() {
  return this.status === 'paid';
});

module.exports = mongoose.model('Payout', payoutSchema);
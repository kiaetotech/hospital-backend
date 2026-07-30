const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  payoutId: { type: String, unique: true, required: true },
  providerType: { type: String, enum: ['doctor', 'center'], required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  providerName: String,
  
  amount: { type: Number, required: true },
  commissionDeducted: Number,
  tdsDeducted: Number,
  netAmount: Number,
  
  bookingCount: Number,
  period: { type: String, enum: ['weekly', 'monthly', 'manual'] },
  periodStart: Date,
  periodEnd: Date,
  
  status: { type: String, enum: ['pending', 'processing', 'paid', 'failed'], default: 'pending' },
  transactionId: String,
  paidAt: Date,
  
  bankDetails: {
    accountHolder: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String
  },
  
  createdAt: { type: Date, default: Date.now }
});

payoutSchema.index({ providerId: 1 });
payoutSchema.index({ status: 1 });

module.exports = mongoose.model('Payout', payoutSchema);
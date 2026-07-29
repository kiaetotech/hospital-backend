const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  payoutId: { type, unique, required},
  providerType: { type, enum: ['doctor', 'center'], required},
  providerId: { type.Schema.Types.ObjectId, required},
  providerName,
  
  amount: { type, required},
  commissionDeducted,
  tdsDeducted,
  netAmount,
  
  bookingCount,
  period: { type, enum: ['weekly', 'monthly', 'manual'] },
  periodStart,
  periodEnd,
  
  status: { type, enum: ['pending', 'processing', 'paid', 'failed'], default: 'pending' },
  transactionId,
  paidAt,
  
  bankDetails: {
    accountHolder,
    accountNumber,
    ifscCode,
    bankName},
  
  createdAt: { type, default.now }
});

payoutSchema.index({ providerId: 1 });
payoutSchema.index({ status: 1 });

module.exports = mongoose.model('Payout', payoutSchema);


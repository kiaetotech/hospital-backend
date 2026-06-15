const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, unique: true, required: true },
  applicationId: { type: String, required: true },
  lenderId: { type: String, required: true },
  
  type: { type: String, enum: ['disbursal', 'commission_payment', 'refund'] },
  amount: Number,
  commissionAmount: Number,  // Platform commission from this transaction
  
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  
  // Payment details
  paymentGateway: String,  // 'razorpay', 'bank_transfer', etc.
  gatewayReferenceId: String,
  utrNumber: String,
  
  // Bank account details
  fromAccount: {
    bankName: String,
    accountNumber: String,
    ifsc: String
  },
  toAccount: {
    bankName: String,
    accountNumber: String,
    ifsc: String
  },
  
  initiatedAt: Date,
  completedAt: Date,
  
  webhookReceived: { type: Boolean, default: false }
});

module.exports = mongoose.model('Transaction', transactionSchema);
const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  payoutId: { type: String, unique: true, required: true },
  
  providerType: { 
    type: String, 
    enum: [
      'doctor',                    // Existing (keep)
      'center',                    // Existing (keep)
      'ayurveda_doctor',           // NEW
      'wellness_center',           // NEW
      'hospital',                  // NEW
      'ambulance_provider',        // NEW
      'ambulance_driver',          // NEW
      'caregiver',                 // NEW
      'diagnostics_lab',           // NEW
      'insurance_company',         // NEW
      'lender',                    // NEW
      'online_doctor',             // NEW
      'homeopathy_doctor',         // NEW
      'therapist',                 // NEW
      'corporate_hr'               // NEW
    ], 
    required: true 
  },
  
  providerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  providerName: String,
  
  amount: { type: Number, required: true },
  commissionDeducted: Number,
  tdsDeducted: Number,
  netAmount: Number,
  
  bookingCount: Number,
  period: { type: String, enum: ['weekly', 'monthly', 'manual', 'daily', 'biweekly'] },
  periodStart: Date,
  periodEnd: Date,
  
  status: { 
    type: String, 
    enum: ['pending', 'requested', 'approved', 'processing', 'paid', 'failed', 'rejected', 'on_hold'], 
    default: 'pending' 
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
  
  createdAt: { type: Date, default: Date.now }
});

payoutSchema.index({ providerId: 1 });
payoutSchema.index({ providerType: 1 });
payoutSchema.index({ status: 1 });

module.exports = mongoose.model('Payout', payoutSchema);
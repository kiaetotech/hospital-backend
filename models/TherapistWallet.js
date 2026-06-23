const mongoose = require('mongoose');

const therapistWalletSchema = new mongoose.Schema({
  therapistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MentalHealthTherapist',
    required: true,
    unique: true,
    index: true
  },
  
  // Balance
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  pendingBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  totalEarned: {
    type: Number,
    default: 0
  },
  totalWithdrawn: {
    type: Number,
    default: 0
  },
  
  // Payout Settings
  payoutMethod: {
    type: String,
    enum: ['bank_transfer', 'upi', 'razorpay'],
    default: 'bank_transfer'
  },
  bankDetails: {
    accountNumber: String,
    accountHolderName: String,
    ifscCode: String,
    bankName: String,
    upiId: String,
    razorpayAccountId: String
  },
  
  // Payout Schedule
  payoutSchedule: {
    type: String,
    enum: ['weekly', 'biweekly', 'monthly', 'manual'],
    default: 'manual'
  },
  minimumPayout: {
    type: Number,
    default: 500
  },
  lastPayoutDate: Date,
  nextPayoutDate: Date,
  
  // Transactions
  transactions: [{
    type: {
      type: String,
      enum: ['credit', 'debit', 'hold', 'release']
    },
    amount: Number,
    description: String,
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MentalHealthBooking'
    },
    payoutId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TherapistPayout'
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Auto-payout Settings
  autoPayout: {
    enabled: {
      type: Boolean,
      default: false
    },
    threshold: {
      type: Number,
      default: 5000
    },
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
      default: 0 // Monday
    }
  }
}, {
  timestamps: true
});

// Indexes
therapistWalletSchema.index({ therapistId: 1, 'transactions.createdAt': -1 });
therapistWalletSchema.index({ pendingBalance: 1 });

// Static methods
therapistWalletSchema.statics = {
  // Get or create wallet
  async getOrCreate(therapistId) {
    let wallet = await this.findOne({ therapistId });
    if (!wallet) {
      wallet = await this.create({
        therapistId,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        transactions: []
      });
    }
    return wallet;
  },
  
  // Add earnings to pending balance
  async addEarnings(therapistId, amount, bookingId, description = '') {
    const wallet = await this.getOrCreate(therapistId);
    
    wallet.pendingBalance += amount;
    wallet.totalEarned += amount;
    wallet.transactions.push({
      type: 'credit',
      amount,
      description: description || `Session payment for booking ${bookingId}`,
      bookingId,
      status: 'pending'
    });
    
    await wallet.save();
    
    // Check if auto-payout should be triggered
    if (wallet.autoPayout.enabled && wallet.pendingBalance >= wallet.autoPayout.threshold) {
      await this.triggerPayout(therapistId);
    }
    
    return wallet;
  },
  
  // Release pending earnings to balance
  async releaseEarnings(therapistId, amount, bookingId) {
    const wallet = await this.findOne({ therapistId });
    if (!wallet) throw new Error('Wallet not found');
    
    // Move from pending to balance
    wallet.pendingBalance -= amount;
    wallet.balance += amount;
    
    // Update transaction status
    const transaction = wallet.transactions.find(
      t => t.bookingId?.toString() === bookingId?.toString()
    );
    if (transaction) {
      transaction.status = 'completed';
    }
    
    await wallet.save();
    return wallet;
  },
  
  // Process payout request
  async requestPayout(therapistId, amount, payoutMethod = 'bank_transfer') {
    const wallet = await this.findOne({ therapistId });
    if (!wallet) throw new Error('Wallet not found');
    
    if (wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }
    
    if (amount < wallet.minimumPayout) {
      throw new Error(`Minimum payout amount is ₹${wallet.minimumPayout}`);
    }
    
    wallet.balance -= amount;
    wallet.totalWithdrawn += amount;
    wallet.transactions.push({
      type: 'debit',
      amount,
      description: `Payout request - ${payoutMethod}`,
      status: 'pending'
    });
    
    await wallet.save();
    return wallet;
  },
  
  // Confirm payout completion
  async confirmPayout(therapistId, payoutId, amount) {
    const wallet = await this.findOne({ therapistId });
    if (!wallet) throw new Error('Wallet not found');
    
    const transaction = wallet.transactions.find(
      t => t.payoutId?.toString() === payoutId?.toString()
    );
    if (transaction) {
      transaction.status = 'completed';
    }
    
    wallet.lastPayoutDate = new Date();
    await wallet.save();
    return wallet;
  },
  
  // Get wallet summary
  async getSummary(therapistId) {
    const wallet = await this.findOne({ therapistId });
    if (!wallet) {
      return {
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        availableBalance: 0
      };
    }
    
    return {
      balance: wallet.balance,
      pendingBalance: wallet.pendingBalance,
      totalEarned: wallet.totalEarned,
      totalWithdrawn: wallet.totalWithdrawn,
      availableBalance: wallet.balance + wallet.pendingBalance,
      bankDetails: wallet.bankDetails,
      lastPayoutDate: wallet.lastPayoutDate
    };
  },
  
  // Get transaction history
  async getTransactions(therapistId, limit = 50, skip = 0) {
    const wallet = await this.findOne({ therapistId });
    if (!wallet) return { transactions: [], total: 0 };
    
    const transactions = wallet.transactions
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(skip, skip + limit);
    
    return {
      transactions,
      total: wallet.transactions.length,
      pending: wallet.transactions.filter(t => t.status === 'pending').length
    };
  }
};

// Instance methods
therapistWalletSchema.methods = {
  // Set bank details for payout
  setBankDetails(details) {
    this.bankDetails = {
      accountNumber: details.accountNumber,
      accountHolderName: details.accountHolderName,
      ifscCode: details.ifscCode,
      bankName: details.bankName,
      upiId: details.upiId,
      razorpayAccountId: details.razorpayAccountId
    };
    return this.save();
  },
  
  // Enable/disable auto-payout
  setAutoPayout(enabled, threshold, dayOfWeek) {
    this.autoPayout = {
      enabled,
      threshold: threshold || this.autoPayout.threshold,
      dayOfWeek: dayOfWeek || this.autoPayout.dayOfWeek
    };
    return this.save();
  }
};

const TherapistWallet = mongoose.model('TherapistWallet', therapistWalletSchema);

module.exports = TherapistWallet;
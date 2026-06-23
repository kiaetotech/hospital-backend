const express = require('express');
const router = express.Router();
const TherapistWallet = require('../models/TherapistWallet');
const TherapistPayout = require('../models/TherapistPayout');
const MentalHealthBooking = require('../models/MentalHealthBooking');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// THERAPIST WALLET ROUTES
// ============================================

// Get wallet summary
router.get('/wallet/summary', authenticateToken, async (req, res) => {
  try {
    const therapistId = req.user.id || req.user._id;
    const summary = await TherapistWallet.getSummary(therapistId);
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get transaction history
router.get('/wallet/transactions', authenticateToken, async (req, res) => {
  try {
    const therapistId = req.user.id || req.user._id;
    const { limit = 50, skip = 0 } = req.query;
    const result = await TherapistWallet.getTransactions(therapistId, parseInt(limit), parseInt(skip));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set bank details
router.post('/wallet/bank-details', authenticateToken, async (req, res) => {
  try {
    const therapistId = req.user.id || req.user._id;
    const { accountNumber, accountHolderName, ifscCode, bankName, upiId } = req.body;
    
    if (!accountNumber || !accountHolderName || !ifscCode) {
      return res.status(400).json({ error: 'Account number, holder name, and IFSC are required' });
    }
    
    const wallet = await TherapistWallet.getOrCreate(therapistId);
    await wallet.setBankDetails({ accountNumber, accountHolderName, ifscCode, bankName, upiId });
    
    res.json({ success: true, message: 'Bank details updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Request payout
router.post('/payout/request', authenticateToken, async (req, res) => {
  try {
    const therapistId = req.user.id || req.user._id;
    const { amount, method = 'bank_transfer' } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    
    const wallet = await TherapistWallet.getOrCreate(therapistId);
    
    if (wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    if (amount < wallet.minimumPayout) {
      return res.status(400).json({ error: `Minimum payout amount is ₹${wallet.minimumPayout}` });
    }
    
    await wallet.requestPayout(therapistId, amount, method);
    
    const payout = new TherapistPayout({
      therapistId,
      walletId: wallet._id,
      amount: amount,
      netAmount: amount,
      method: method,
      bankDetails: wallet.bankDetails,
      status: 'pending'
    });
    await payout.save();
    
    const updatedWallet = await TherapistWallet.findOne({ therapistId });
    const transaction = updatedWallet.transactions.find(t => t.amount === amount && t.type === 'debit' && t.status === 'pending');
    if (transaction) {
      transaction.payoutId = payout._id;
      await updatedWallet.save();
    }
    
    res.json({
      success: true,
      data: {
        payout,
        message: 'Payout request submitted successfully'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payout history
router.get('/payout/history', authenticateToken, async (req, res) => {
  try {
    const therapistId = req.user.id || req.user._id;
    const { status, limit = 50, skip = 0 } = req.query;
    
    const result = await TherapistPayout.getByTherapist(
      therapistId,
      status,
      parseInt(limit),
      parseInt(skip)
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payout summary
router.get('/payout/summary', authenticateToken, async (req, res) => {
  try {
    const therapistId = req.user.id || req.user._id;
    const summary = await TherapistPayout.getSummary(therapistId);
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Get all pending payouts (Admin only)
router.get('/admin/pending', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const payouts = await TherapistPayout.getPendingPayouts();
    res.json({ success: true, data: payouts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process payout (Admin only)
router.post('/admin/process/:payoutId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const payout = await TherapistPayout.findById(req.params.payoutId);
    if (!payout) {
      return res.status(404).json({ error: 'Payout not found' });
    }
    
    if (payout.status !== 'pending') {
      return res.status(400).json({ error: 'Payout is not in pending status' });
    }
    
    await payout.markProcessing();
    
    // Simulate payout processing
    setTimeout(async () => {
      await payout.markCompleted({
        id: 'payout_' + Date.now(),
        status: 'processed',
        utr: 'UTR' + Date.now()
      });
      
      await TherapistWallet.confirmPayout(
        payout.therapistId,
        payout._id,
        payout.amount
      );
    }, 2000);
    
    res.json({
      success: true,
      data: payout,
      message: 'Payout processing initiated'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark payout as completed (Admin only)
router.post('/admin/complete/:payoutId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const payout = await TherapistPayout.findById(req.params.payoutId);
    if (!payout) {
      return res.status(404).json({ error: 'Payout not found' });
    }
    
    if (payout.status !== 'processing') {
      return res.status(400).json({ error: 'Payout is not in processing status' });
    }
    
    await payout.markCompleted(req.body.razorpayResponse || {});
    
    await TherapistWallet.confirmPayout(
      payout.therapistId,
      payout._id,
      payout.amount
    );
    
    await MentalHealthBooking.updateMany(
      { _id: { $in: payout.bookingIds } },
      { payoutStatus: 'completed', payoutCompletedAt: new Date() }
    );
    
    res.json({
      success: true,
      data: payout,
      message: 'Payout marked as completed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark payout as failed (Admin only)
router.post('/admin/fail/:payoutId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const payout = await TherapistPayout.findById(req.params.payoutId);
    if (!payout) {
      return res.status(404).json({ error: 'Payout not found' });
    }
    
    const { reason } = req.body;
    await payout.markFailed(reason);
    
    const wallet = await TherapistWallet.findOne({ therapistId: payout.therapistId });
    if (wallet) {
      wallet.balance += payout.amount;
      wallet.transactions.push({
        type: 'credit',
        amount: payout.amount,
        description: `Payout reverted - ${reason}`,
        status: 'completed'
      });
      await wallet.save();
    }
    
    res.json({
      success: true,
      data: payout,
      message: 'Payout marked as failed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AUTO-PAYOUT SETTINGS
// ============================================

router.post('/wallet/auto-payout', authenticateToken, async (req, res) => {
  try {
    const therapistId = req.user.id || req.user._id;
    const { enabled, threshold, dayOfWeek } = req.body;
    
    const wallet = await TherapistWallet.getOrCreate(therapistId);
    await wallet.setAutoPayout(enabled, threshold, dayOfWeek);
    
    res.json({
      success: true,
      data: wallet.autoPayout,
      message: 'Auto-payout settings updated'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const TherapistWallet = require('../models/TherapistWallet');
const TherapistPayout = require('../models/TherapistPayout');
const MentalHealthBooking = require('../models/MentalHealthBooking');

// ============================================
// THERAPIST WALLET ROUTES
// ============================================

// Get wallet summary
router.get('/wallet/summary', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. Please login first.' });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    const therapistId = decoded.id || decoded._id;
    
    const summary = await TherapistWallet.getSummary(therapistId);
    res.json({ success, data});
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    res.status(500).json({ error.message });
  }
});

// Get transaction history
router.get('/wallet/transactions', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. Please login first.' });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    const therapistId = decoded.id || decoded._id;
    
    const { limit = 50, skip = 0 } = req.query;
    const result = await TherapistWallet.getTransactions(therapistId, parseInt(limit), parseInt(skip));
    res.json({ success, data});
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    res.status(500).json({ error.message });
  }
});

// Set bank details
router.post('/wallet/bank-details', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. Please login first.' });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    const therapistId = decoded.id || decoded._id;
    
    const { accountNumber, accountHolderName, ifscCode, bankName, upiId } = req.body;
    
    if (!accountNumber || !accountHolderName || !ifscCode) {
      return res.status(400).json({ error: 'Account number, holder name, and IFSC are required' });
    }
    
    const wallet = await TherapistWallet.getOrCreate(therapistId);
    await wallet.setBankDetails({ accountNumber, accountHolderName, ifscCode, bankName, upiId });
    
    res.json({ success, message: 'Bank details updated successfully' });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    res.status(500).json({ error.message });
  }
});

// Request payout
router.post('/payout/request', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. Please login first.' });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    const therapistId = decoded.id || decoded._id;
    
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
      walletId._id,
      amount,
      netAmount,
      method,
      bankDetails.bankDetails,
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
      success,
      data: {
        payout,
        message: 'Payout request submitted successfully'
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    res.status(500).json({ error.message });
  }
});

// Get payout history
router.get('/payout/history', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. Please login first.' });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    const therapistId = decoded.id || decoded._id;
    
    const { status, limit = 50, skip = 0 } = req.query;
    
    const result = await TherapistPayout.getByTherapist(
      therapistId,
      status,
      parseInt(limit),
      parseInt(skip)
    );
    
    res.json({ success, data});
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    res.status(500).json({ error.message });
  }
});

// Get payout summary
router.get('/payout/summary', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. Please login first.' });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    const therapistId = decoded.id || decoded._id;
    
    const summary = await TherapistPayout.getSummary(therapistId);
    res.json({ success, data});
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    res.status(500).json({ error.message });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Get all pending payouts (Admin only)
router.get('/admin/pending', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. Please login first.' });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const payouts = await TherapistPayout.getPendingPayouts();
    res.json({ success, data});
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    res.status(500).json({ error.message });
  }
});

// Process payout (Admin only)
router.post('/admin/process/', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. Please login first.' });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
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
      success,
      data,
      message: 'Payout processing initiated'
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    res.status(500).json({ error.message });
  }
});

// Mark payout as completed (Admin only)
router.post('/admin/complete/', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. Please login first.' });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
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
      { _id: { $in.bookingIds } },
      { payoutStatus: 'completed', payoutCompletedAtDate() }
    );
    
    res.json({
      success,
      data,
      message: 'Payout marked as completed'
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    res.status(500).json({ error.message });
  }
});

// Mark payout as failed (Admin only)
router.post('/admin/fail/', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. Please login first.' });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const payout = await TherapistPayout.findById(req.params.payoutId);
    if (!payout) {
      return res.status(404).json({ error: 'Payout not found' });
    }
    
    const { reason } = req.body;
    await payout.markFailed(reason);
    
    const wallet = await TherapistWallet.findOne({ therapistId.therapistId });
    if (wallet) {
      wallet.balance += payout.amount;
      wallet.transactions.push({
        type: 'credit',
        amount.amount,
        description: `Payout reverted - ${reason}`,
        status: 'completed'
      });
      await wallet.save();
    }
    
    res.json({
      success,
      data,
      message: 'Payout marked as failed'
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    res.status(500).json({ error.message });
  }
});

// ============================================
// AUTO-PAYOUT SETTINGS
// ============================================

router.post('/wallet/auto-payout', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. Please login first.' });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    const therapistId = decoded.id || decoded._id;
    
    const { enabled, threshold, dayOfWeek } = req.body;
    
    const wallet = await TherapistWallet.getOrCreate(therapistId);
    await wallet.setAutoPayout(enabled, threshold, dayOfWeek);
    
    res.json({
      success,
      data.autoPayout,
      message: 'Auto-payout settings updated'
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    res.status(500).json({ error.message });
  }
});

module.exports = router;


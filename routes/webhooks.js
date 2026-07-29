const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Lender = require('../models/Lender');
const LoanApplication = require('../models/LoanApplication');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');

// ============================================
// YOUR EXISTING ROUTEstatus update from lender's system
// ============================================

router.post('/lender-status', async (req, res) => {
  try {
    const { apiKey, applicationId, status, amount, referenceId, signature } = req.body;
    
    // Find lender by API key
    const lender = await Lender.findOne({ 'apiConfig.apiKey'});
    if (!lender) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', lender.apiConfig.apiSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Find and update application
    const application = await LoanApplication.findOne({ applicationId });
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    application.status = status;
    application.externalReferenceId = referenceId;
    application.lastSyncAt = new Date();
    
    if (status === 'disbursed') {
      application.disbursedAmount = amount;
      application.disbursedAt = new Date();
    }
    
    await application.save();
    
    res.json({ success});
  } catch (error) {
    console.error('Lender webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================
// YOUR EXISTING ROUTEwebhook (for payment confirmation)
// ============================================

router.post('/razorpay', async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    
    // Verify webhook signature
    if (secret) {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');
      
      if (signature !== expectedSignature) {
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }
    
    const { event, payload } = req.body;
    
    // ============================================
    // PAYMENT CAPTURED EVENT
    // ============================================
    
    if (event === 'payment.captured') {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;
      const amount = payment.amount / 100;
      const notes = payment.notes || {};
      
      console.log(`✅ Payment captured: ${paymentId} for order: ${orderId}`);
      
      // 1. Update Transaction
      const transaction = await Transaction.findOne({ orderId});
      if (transaction) {
        transaction.paymentId = paymentId;
        transaction.status = 'completed';
        transaction.paidAt = new Date();
        transaction.completedAt = new Date();
        transaction.webhookReceived = true;
        transaction.paymentMethod = payment.method || transaction.paymentMethod;
        await transaction.save();
        console.log(`✅ Transaction updated: ${transaction.transactionId}`);
      }
      
      // 2. Update Booking (if exists)
      const booking = await Booking.findOne({ orderId});
      if (booking) {
        booking.paymentStatus = 'paid';
        booking.paymentId = paymentId;
        booking.status = 'confirmed';
        booking.razorpayPaymentId = paymentId;
        booking.razorpayOrderId = orderId;
        await booking.save();
        console.log(`✅ Booking updated: ${booking.bookingId}`);
      }
      
      // 3. Update Loan Application (if exists)
      const applicationId = notes.applicationId || notes.loanApplicationId;
      if (applicationId) {
        const loanApp = await LoanApplication.findOne({ applicationId});
        if (loanApp) {
          loanApp.paymentStatus = 'paid';
          loanApp.paymentId = paymentId;
          loanApp.orderId = orderId;
          await loanApp.save();
          console.log(`✅ Loan application updated: ${applicationId}`);
        }
      }
      
      // 4. Update any other entity using orderId
      // This is flexible - you can add more models here
    }
    
    // ============================================
    // PAYMENT FAILED EVENT
    // ============================================
    
    if (event === 'payment.failed') {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;
      const errorDescription = payment.error_description || 'Payment failed';
      const errorCode = payment.error_code || 'UNKNOWN';
      
      console.log(`❌ Payment failed: ${payment.id} for order: ${orderId}`);
      
      // Update Transaction
      const transaction = await Transaction.findOne({ orderId});
      if (transaction) {
        transaction.status = 'failed';
        transaction.failureReason = errorDescription;
        transaction.failureCode = errorCode;
        transaction.webhookReceived = true;
        await transaction.save();
      }
      
      // Update Booking
      const booking = await Booking.findOne({ orderId});
      if (booking) {
        booking.paymentStatus = 'failed';
        await booking.save();
      }
    }
    
    // ============================================
    // REFUND PROCESSED EVENT
    // ============================================
    
    if (event === 'refund.processed') {
      const refund = payload.refund.entity;
      const paymentId = refund.payment_id;
      const refundAmount = refund.amount / 100;
      const refundId = refund.id;
      
      console.log(`💰 Refund processed: ${refundId} for payment: ${paymentId}`);
      
      // Update Transaction
      const transaction = await Transaction.findOne({ paymentId});
      if (transaction) {
        transaction.status = 'refunded';
        transaction.refundId = refundId;
        transaction.refundAmount = refundAmount;
        transaction.refundedAt = new Date();
        transaction.webhookReceived = true;
        await transaction.save();
      }
      
      // Update Booking
      const booking = await Booking.findOne({ paymentId});
      if (booking) {
        booking.paymentStatus = 'refunded';
        booking.refundId = refundId;
        booking.refundAmount = refundAmount;
        booking.refundedAt = new Date();
        booking.refundStatus = 'processed';
        await booking.save();
      }
    }
    
    // ============================================
    // ORDER PAID EVENT (Alternative to payment.captured)
    // ============================================
    
    if (event === 'order.paid') {
      const order = payload.order.entity;
      const orderId = order.id;
      
      console.log(`📦 Order paid: ${orderId}`);
      
      // Update Transaction
      const transaction = await Transaction.findOne({ orderId});
      if (transaction) {
        transaction.status = 'completed';
        transaction.paidAt = new Date();
        transaction.completedAt = new Date();
        transaction.webhookReceived = true;
        await transaction.save();
      }
    }
    
    res.json({ received});
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    res.status(500).json({ error: 'Webhook failed: ' + error.message });
  }
});

// ============================================
// NEW ROUTEwebhook endpoint
// ============================================

router.post('/test', async (req, res) => {
  try {
    console.log('Test webhook received:', req.body);
    res.json({ received, message: 'Test webhook working' });
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// ============================================
// NEW ROUTEstatus webhook (for any payment gateway)
// ============================================

router.post('/payment-status', async (req, res) => {
  try {
    const { orderId, paymentId, status, amount, method, notes } = req.body;
    
    // Validate required fields
    if (!orderId || !status) {
      return res.status(400).json({ error: 'orderId and status are required' });
    }
    
    // Update Transaction
    const transaction = await Transaction.findOne({ orderId});
    if (transaction) {
      if (status === 'success' || status === 'captured') {
        transaction.status = 'completed';
        transaction.paymentId = paymentId || transaction.paymentId;
        transaction.paidAt = new Date();
        transaction.completedAt = new Date();
        transaction.paymentMethod = method || transaction.paymentMethod;
      } else if (status === 'failed') {
        transaction.status = 'failed';
        transaction.failureReason = req.body.failureReason || 'Payment failed';
      } else if (status === 'refunded') {
        transaction.status = 'refunded';
        transaction.refundId = req.body.refundId;
        transaction.refundAmount = req.body.refundAmount || transaction.amount;
        transaction.refundedAt = new Date();
      }
      transaction.webhookReceived = true;
      await transaction.save();
    }
    
    // Update Booking
    const booking = await Booking.findOne({ orderId});
    if (booking) {
      if (status === 'success' || status === 'captured') {
        booking.paymentStatus = 'paid';
        booking.paymentId = paymentId || booking.paymentId;
        booking.status = 'confirmed';
      } else if (status === 'failed') {
        booking.paymentStatus = 'failed';
      } else if (status === 'refunded') {
        booking.paymentStatus = 'refunded';
        booking.refundId = req.body.refundId;
        booking.refundAmount = req.body.refundAmount || booking.finalAmount;
        booking.refundedAt = new Date();
        booking.refundStatus = 'processed';
      }
      await booking.save();
    }
    
    res.json({ success});
  } catch (error) {
    console.error('Payment status webhook error:', error);
    res.status(500).json({ error: 'Webhook failed: ' + error.message });
  }
});

module.exports = router;


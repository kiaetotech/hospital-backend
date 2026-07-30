const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Lender = require('../models/Lender');
const LoanApplication = require('../models/LoanApplication');

// Receive status update from lender's system
router.post('/lender-status', async (req, res) => {
  try {
    const { apiKey, applicationId, status, amount, referenceId, utrNumber, signature } = req.body;
    
    // Find lender by API key
    const lender = await Lender.findOne({ 'apiConfig.apiKey': apiKey });
    if (!lender) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    // Verify signature for security
    if (signature && lender.apiConfig.apiSecret) {
      const payload = { apiKey, applicationId, status, amount, referenceId };
      const expectedSignature = crypto
        .createHmac('sha256', lender.apiConfig.apiSecret)
        .update(JSON.stringify(payload))
        .digest('hex');
      
      if (signature !== expectedSignature) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    
    // Find application
    const application = await LoanApplication.findOne({ applicationId });
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Update status
    const oldStatus = application.status;
    application.status = status;
    application.externalReferenceId = referenceId;
    application.lastSyncAt = new Date();
    application.lastSyncStatus = 'synced';
    
    if (status === 'disbursed' && amount) {
      application.disbursedAmount = amount;
      application.disbursalUtrNumber = utrNumber;
      application.disbursedAt = new Date();
    }
    
    if (status === 'approved' && amount) {
      application.sanctionedAmount = amount;
      application.approvedAt = new Date();
    }
    
    if (status === 'rejected') {
      application.rejectedAt = new Date();
    }
    
    application.statusHistory.push({
      status,
      note: `Status updated via webhook from lender. Old status: ${oldStatus}`,
      updatedBy: 'system',
      timestamp: new Date()
    });
    
    await application.save();
    
    // Log webhook receipt
    console.log(`📡 Webhook received: ${applicationId} -> ${status}`);
    
    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Receive payment confirmation from Razorpay
router.post('/razorpay', async (req, res) => {
  try {
    const { event, payload } = req.body;
    
    // Verify webhook signature (in production)
    // const signature = req.headers['x-razorpay-signature'];
    // const expectedSignature = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(JSON.stringify(req.body)).digest('hex');
    // if (signature !== expectedSignature) return res.status(401).json({ error: 'Invalid signature' });
    
    if (event === 'payment.captured') {
      const paymentId = payload.payment.entity.id;
      const applicationId = payload.payment.entity.notes?.applicationId;
      const amount = payload.payment.entity.amount / 100; // Convert from paise
      
      if (applicationId) {
        // Update commission payment status
        await LoanApplication.findOneAndUpdate(
          { applicationId },
          { 
            commissionPaid: true,
            commissionPaidAt: new Date(),
            commissionPaymentId: paymentId,
            commissionAmount: amount
          }
        );
        console.log(`💰 Commission payment received for ${applicationId}: ₹${amount}`);
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Health check endpoint for webhook testing
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Webhook endpoint is active' });
});

module.exports = router;
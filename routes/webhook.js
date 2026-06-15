const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Lender = require('../models/Lender');
const LoanApplication = require('../models/LoanApplication');

// Receive status update from lender's system
router.post('/lender-status', async (req, res) => {
  try {
    const { apiKey, applicationId, status, amount, referenceId, signature } = req.body;
    
    // Find lender by API key
    const lender = await Lender.findOne({ 'apiConfig.apiKey': apiKey });
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
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Razorpay webhook (for payment confirmation)
router.post('/razorpay', async (req, res) => {
  try {
    const { event, payload } = req.body;
    
    if (event === 'payment.captured') {
      const transactionId = payload.payment.entity.id;
      const applicationId = payload.payment.entity.notes.applicationId;
      
      // Update transaction status
      // await Transaction.findOneAndUpdate(
      //   { transactionId },
      //   { status: 'completed', completedAt: new Date() }
      // );
      
      // Update application
      await LoanApplication.findOneAndUpdate(
        { applicationId },
        { commissionPaid: true }
      );
    }
    
    res.json({ received: true });
  } catch (error) {
    res.status(500).json({ error: 'Webhook failed' });
  }
});

module.exports = router;
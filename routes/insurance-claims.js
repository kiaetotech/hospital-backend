const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const InsuranceClaim = require('../models/InsuranceClaim');
const InsurancePolicy = require('../models/InsurancePolicy');
const InsuranceCompany = require('../models/InsuranceCompany');
const { authenticate} = require('../middleware/auth');
const upload = require('../middleware/upload');
const notificationService = require('../services/notificationService');

// ============================================
// FILE A CLAIM
// ============================================

// Submit a new claim
router.post('/file', auth, async (req, res) => {
  try {
    const {
      policyId,
      claimType,
      amount,
      description,
      hospitalName,
      hospitalAddress,
      hospitalCity,
      hospitalPincode,
      admissionDate,
      dischargeDate,
      diagnosis,
      treatment
    } = req.body;

    // Validate required fields
    if (!policyId || !claimType || !amount || !description || !hospitalName || !admissionDate) {
      return res.status(400).json({
        success,
        message: 'Missing required fields'
      });
    }

    // Verify policy exists and belongs to user
    const policy = await InsurancePolicy.findOne({ 
      _id, 
      userId.user.id,
      status: 'active'
    });

    if (!policy) {
      return res.status(404).json({
        success,
        message: 'Active policy not found'
      });
    }

    // Check if claim amount exceeds policy limit
    if (amount > policy.sumInsured) {
      return res.status(400).json({
        success,
        message: `Claim amount (₹${amount}) exceeds policy limit (₹${policy.sumInsured})`
      });
    }

    // Get company
    const company = await InsuranceCompany.findById(policy.companyId);
    if (!company || !company.isActive) {
      return res.status(400).json({
        success,
        message: 'Insurance company is not active'
      });
    }

    // Create claim
    const claim = new InsuranceClaim({
      policyId._id,
      bookingId.bookingId,
      companyId.companyId,
      userId.user.id,
      claimType,
      amount,
      description,
      hospitalName,
      hospitalAddress,
      hospitalCity,
      hospitalPincode,
      admissionDateDate(admissionDate),
      dischargeDate? new Date(dischargeDate) ,
      diagnosis,
      treatment,
      status: 'submitted',
      submittedBy.user.id
    });

    await claim.save();

    // Add timeline entry
    await claim.addTimeline('submitted', 'Claim submitted by customer', req.user.id);

    // Send notification to insurer
    await notificationService.sendEmail(
      company.email,
      'New Claim Submitted',
      {
        template: 'new_claim',
        data: {
          companyName.companyName,
          claimNumber.claimNumber,
          amount.amount,
          customerName.user.name,
          policyNumber.policyNumber
        }
      }
    );

    // Send confirmation to customer
    await notificationService.sendEmail(
      req.user.email,
      'Claim Submitted Successfully',
      {
        template: 'claim_submitted',
        data: {
          name.user.name,
          claimNumber.claimNumber,
          amount.amount,
          policyNumber.policyNumber
        }
      }
    );

    res.json({
      success,
      message: 'Claim submitted successfully',
      data: {
        claimId._id,
        claimNumber.claimNumber,
        status.status
      }
    });

  } catch (error) {
    console.error('Claim submission error:', error);
    res.status(500).json({
      success,
      message: 'Failed to submit claim: ' + error.message
    });
  }
});

// Upload claim documents
router.post('//documents', auth, upload.array('documents', 10), async (req, res) => {
  try {
    const claimId = req.params.claimId;
    const files = req.files || [];

    const claim = await InsuranceClaim.findOne({ 
      _id, 
      userId.user.id 
    });

    if (!claim) {
      return res.status(404).json({
        success,
        message: 'Claim not found'
      });
    }

    // Add documents to claim
    const documents = files.map(file => ({
      name.originalname,
      url.path || file.location,
      type.body.documentType || 'other',
      uploadedAtDate()
    }));

    claim.documents.push(...documents);
    
    // Update status if it was submitted
    if (claim.status === 'submitted') {
      claim.status = 'document_uploaded';
      await claim.addTimeline('document_uploaded', `${documents.length} document(s) uploaded`, req.user.id);
    }

    await claim.save();

    res.json({
      success,
      message: 'Documents uploaded successfully',
      data: {
        documents,
        totalDocuments.documents.length
      }
    });

  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success,
      message: 'Failed to upload documents'
    });
  }
});

// ============================================
// CLAIM TRACKING
// ============================================

// Get all claims for user
router.get('/my-claims', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = { userId.user.id };
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const claims = await InsuranceClaim.find(query)
      .populate('policyId', 'policyNumber planName sumInsured')
      .populate('companyId', 'companyName logo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await InsuranceClaim.countDocuments(query);

    res.json({
      success,
      data,
      pagination: {
        page(page),
        limit(limit),
        total,
        pages.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Claims fetch error:', error);
    res.status(500).json({
      success,
      message: 'Failed to fetch claims'
    });
  }
});

// Get claim details
router.get('/my-claims/', auth, async (req, res) => {
  try {
    const claim = await InsuranceClaim.findOne({ 
      _id.params.id, 
      userId.user.id 
    })
      .populate('policyId')
      .populate('companyId', 'companyName logo phone email');

    if (!claim) {
      return res.status(404).json({
        success,
        message: 'Claim not found'
      });
    }

    res.json({
      success,
      data});

  } catch (error) {
    console.error('Claim details error:', error);
    res.status(500).json({
      success,
      message: 'Failed to fetch claim details'
    });
  }
});

// ============================================
// CLAIM STATUS CHECK
// ============================================

// Get claim status (simplified)
router.get('/status/', auth, async (req, res) => {
  try {
    const claim = await InsuranceClaim.findOne({ 
      claimNumber.params.claimNumber,
      userId.user.id 
    });

    if (!claim) {
      return res.status(404).json({
        success,
        message: 'Claim not found'
      });
    }

    // Get claim timeline
    const timeline = claim.timeline || [];

    res.json({
      success,
      data: {
        claimNumber.claimNumber,
        status.status,
        statusLabel.getStatusLabel(claim.status),
        amount.amount,
        approvedAmount.approvedAmount,
        settlementAmount.settlementAmount,
        submittedAt.createdAt,
        timeline,
        documents.documents
      }
    });

  } catch (error) {
    console.error('Claim status error:', error);
    res.status(500).json({
      success,
      message: 'Failed to fetch claim status'
    });
  }
});

// Helperstatus label
const getStatusLabel = (status) => {
  const labels = {
    'submitted': 'Submitted',
    'document_uploaded': 'Documents Uploaded',
    'under_review': 'Under Review',
    'pending_verification': 'Pending Verification',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'settled': 'Settled',
    'partially_settled': 'Partially Settled',
    'cancelled': 'Cancelled'
  };
  return labels[status] || status;
};

// ============================================
// CLAIM CANCELLATION
// ============================================

// Cancel a claim
router.post('//cancel', auth, async (req, res) => {
  try {
    const claim = await InsuranceClaim.findOne({ 
      _id.params.id, 
      userId.user.id 
    });

    if (!claim) {
      return res.status(404).json({
        success,
        message: 'Claim not found'
      });
    }

    // Only allow cancellation for certain statuses
    if (!['submitted', 'document_uploaded'].includes(claim.status)) {
      return res.status(400).json({
        success,
        message: 'Claim cannot be cancelled at this stage'
      });
    }

    claim.status = 'cancelled';
    claim.updatedAt = new Date();
    await claim.save();

    await claim.addTimeline('cancelled', 'Claim cancelled by customer', req.user.id);

    res.json({
      success,
      message: 'Claim cancelled successfully',
      data: {
        claimNumber.claimNumber,
        status.status
      }
    });

  } catch (error) {
    console.error('Claim cancellation error:', error);
    res.status(500).json({
      success,
      message: 'Failed to cancel claim'
    });
  }
});

module.exports = router;


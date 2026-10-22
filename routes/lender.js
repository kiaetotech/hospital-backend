const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Lender = require('../models/Lender');
const LoanApplication = require('../models/LoanApplication');
const { authenticate, authenticateLender } = require('../middleware/auth');
const generateId = require('../utils/generateId');
const loanCommissionService = require('../services/loan/loanCommissionService');
const loanStateService = require('../services/loan/loanStateService');

const JWT_SECRET = process.env.JWT_SECRET;

// Generate lender token
const generateLenderToken = (lenderId, email) => {
  return jwt.sign({ lenderId, email, role: 'lender' }, JWT_SECRET, { expiresIn: '7d' });
};

// ============================================
// LENDER REGISTRATION & AUTH
// ============================================

// Lender self-registration
router.post('/register', async (req, res) => {
  try {
    const {
      businessName,
      registrationNumber,
      email,
      phone,
      password,
      address,
      loanProducts,
      commissionRate
    } = req.body;
    
    const existing = await Lender.findOne({ $or: [{ email }, { registrationNumber }] });
    if (existing) {
      return res.status(400).json({ error: 'Lender already registered with this email or registration number' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const lenderId = generateId('LDR');
    
    const lender = new Lender({
      lenderId,
      businessName,
      registrationNumber,
      email,
      phone,
      password: hashedPassword,
      address,
      loanProducts: loanProducts || [],
      commissionRate: commissionRate || 2,
      status: 'pending',
      createdAt: new Date()
    });
    
    await lender.save();
    
    res.json({
      success: true,
      lenderId,
      message: 'Registration submitted for admin approval.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Lender login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const lender = await Lender.findOne({ email });
    if (!lender) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, lender.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (lender.status !== 'active') {
      return res.status(403).json({ error: `Account is ${lender.status}. Please contact support.` });
    }
    
    const token = generateLenderToken(lender.lenderId, lender.email);
    
    res.json({
      success: true,
      token,
      lender: {
        lenderId: lender.lenderId,
        businessName: lender.businessName,
        email: lender.email,
        status: lender.status,
        commissionRate: lender.commissionRate
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get lender profile
router.get('/profile', authenticate, authenticateLender, async (req, res) => {
  try {
    const lender = await Lender.findOne({ lenderId: req.user.lenderId }).select('-password');
    if (!lender) {
      return res.status(404).json({ error: 'Lender not found' });
    }
    res.json(lender);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ============================================
// LENDER DASHBOARD & APPLICATIONS
// ============================================

// Get applications assigned to this lender
router.get('/applications', authenticate, authenticateLender, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = { lenderId: req.user.lenderId };
    if (status) query.status = status;
    
    const applications = await LoanApplication.find(query)
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await LoanApplication.countDocuments(query);
    
    res.json({
      applications,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get single application details
router.get('/applications/:applicationId', authenticate, authenticateLender, async (req, res) => {
  try {
    const application = await LoanApplication.findOne({
      applicationId: req.params.applicationId,
      lenderId: req.user.lenderId
    });
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    res.json(application);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// Update application status (approve/reject)
// Update application status (approve/reject)
router.put('/applications/:applicationId/status', authenticate, authenticateLender, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status, note, sanctionedAmount, tenure, interestRate } = req.body;
    
    const application = await LoanApplication.findOne({
      applicationId,
      lenderId: req.user.lenderId
    });
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // State transition via centralized service (validates transitions + role + writes audit)
    await loanStateService.transition({
      applicationId,
      toStatus: status,
      actor: req.user.email || req.user.lenderId,
      actorRole: 'lender_underwriter',
      reason: status === 'rejected' ? (note || 'Rejected by lender') : null,
      note: note || `Status changed to ${status}`,
    });
    
    // If approving, apply loan terms (data, not state)
    if (status === 'approved' && interestRate && tenure) {
      const sanctioned = sanctionedAmount || application.estimatedAmount;
      const monthlyRate = interestRate / 100 / 12;
      const emi = sanctioned * monthlyRate * Math.pow(1 + monthlyRate, tenure) / (Math.pow(1 + monthlyRate, tenure) - 1);
      
      await LoanApplication.updateOne(
        { applicationId },
        {
          $set: {
            sanctionedAmount: sanctioned,
            tenure,
            interestRate,
            emi: Math.round(emi),
          },
        }
      );
    }
    
    const updated = await LoanApplication.findOne({ applicationId });
    res.json({ success: true, application: updated });
  } catch (error) {
    if (error.name === 'LoanStateError') {
      return res.status(400).json({ error: error.message, code: error.code });
    }
    console.error('updateStatus error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Request additional documents from patient
// Request additional documents from patient
router.post('/applications/:applicationId/request-document', authenticate, authenticateLender, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { documentType, description } = req.body;
    
    const application = await LoanApplication.findOne({
      applicationId,
      lenderId: req.user.lenderId
    });
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // 1. Save document request on the application
    const requestId = generateId('REQ');
    application.lenderRequests.push({
      requestId,
      requestType: 'document',
      description: `${documentType}: ${description}`,
      requestedAt: new Date(),
      status: 'pending'
    });
    await application.save();
    
    // 2. Transition state via centralized service
    try {
      await loanStateService.transition({
        applicationId,
        toStatus: 'document_pending',
        actor: req.user.email || req.user.lenderId,
        actorRole: 'lender_ops',
        note: `Document requested: ${documentType}`,
      });
    } catch (stateErr) {
      if (stateErr.name === 'LoanStateError') {
        return res.status(400).json({
          error: stateErr.message,
          code: stateErr.code,
          requestId,
          note: 'Document request saved but state transition failed',
        });
      }
      throw stateErr;
    }
    
    res.json({ success: true, requestId });
  } catch (error) {
    console.error('request-document error:', error);
    res.status(500).json({ error: 'Failed to request document' });
  }
});

// Mark loan as disbursed
// Mark loan as disbursed
router.post('/applications/:applicationId/disburse', authenticate, authenticateLender, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { disbursedAmount, transactionId } = req.body;
    
    const application = await LoanApplication.findOne({
      applicationId,
      lenderId: req.user.lenderId
    });
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    if (!application.finalBillAmount) {
      return res.status(400).json({ error: 'Final bill not submitted yet' });
    }
    
    const actualDisbursedAmount = Math.min(application.sanctionedAmount, application.finalBillAmount);
    
    // 1. Persist disbursement data (not state)
    await LoanApplication.updateOne(
      { applicationId },
      { $set: { disbursedAmount: actualDisbursedAmount } }
    );
    
    // 2. Transition state via centralized service
    await loanStateService.transition({
      applicationId,
      toStatus: 'disbursed',
      actor: req.user.email || req.user.lenderId,
      actorRole: 'lender_ops',
      note: `Amount ₹${actualDisbursedAmount} disbursed to hospital`,
      metadata: {
        transactionId: transactionId || null,
        disbursedAmount: actualDisbursedAmount,
      },
    });
    
    // 3. Post commission via loanCommissionService (creates real Transaction row + idempotent)
    const commissionResult = await loanCommissionService.postCommission({
      applicationId,
      disbursedAmount: actualDisbursedAmount,
      updatedBy: req.user.email || req.user.lenderId,
      updatedByRole: 'lender',
    });
    
    res.json({
      success: true,
      disbursedAmount: actualDisbursedAmount,
      commissionAmount: commissionResult.commission.commissionAmount,
      commissionCreated: commissionResult.created,
      commissionTransactionId: commissionResult.transaction?.transactionId || null,
      message: `Disbursed ₹${actualDisbursedAmount} to hospital. Platform commission: ₹${commissionResult.commission.commissionAmount}`,
    });
  } catch (error) {
    if (error.name === 'LoanStateError') {
      return res.status(400).json({ error: error.message, code: error.code });
    }
    if (error.name === 'LoanCommissionError') {
      return res.status(400).json({ error: error.message, code: error.code });
    }
    console.error('disburse error:', error);
    res.status(500).json({ error: 'Failed to disburse loan' });
  }
});

// Get lender dashboard stats
router.get('/stats', authenticate, authenticateLender, async (req, res) => {
  try {
    const { lenderId } = req.user;
    
    const totalApplications = await LoanApplication.countDocuments({ lenderId });
    const pendingApplications = await LoanApplication.countDocuments({ lenderId, status: 'submitted' });
    const approvedApplications = await LoanApplication.countDocuments({ lenderId, status: 'approved' });
    const disbursedApplications = await LoanApplication.countDocuments({ lenderId, status: 'disbursed' });
    const rejectedApplications = await LoanApplication.countDocuments({ lenderId, status: 'rejected' });
    
    const disbursedLoans = await LoanApplication.find({ lenderId, status: 'disbursed' });
    const totalDisbursedAmount = disbursedLoans.reduce((sum, loan) => sum + (loan.disbursedAmount || 0), 0);
    const totalCommission = disbursedLoans.reduce((sum, loan) => sum + (loan.platformCommission || 0), 0);
    
    res.json({
      totalApplications,
      pendingApplications,
      approvedApplications,
      disbursedApplications,
      rejectedApplications,
      totalDisbursedAmount,
      totalCommission
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
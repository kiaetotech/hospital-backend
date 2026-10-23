// D:\hospital backend\routes\loanRoutes.js
// ============================================
// CONSOLIDATED LOAN ROUTES (v2)
// ============================================
// Single entry point for all NEW loan endpoints built in Tasks 10+.
// Coexists with existing /api/loan/* routes (lender.js, loanPatient.js, loanAdmin.js).
// Will eventually replace them once stable.
//
// Mounted at: /api/loan/v2
//
// Endpoints filled in progressively:
//   Task 10: Loan Products CRUD
//   Task 11: Offers lifecycle
//   Task 12: Agreements + eSign
//   Task 13: Disbursements
//   Task 14: Repayment + mandate
//   Task 15: Refunds
//   Task 16: Reconciliation
//   Task 17: Audit
// ============================================

const express = require('express');
const router = express.Router();

// ============================================
// DEPENDENCIES
// ============================================
const { authenticate, authenticateLender } = require('../middleware/auth');
const loanStateService = require('../services/loan/loanStateService');
const loanCommissionService = require('../services/loan/loanCommissionService');
const loanBookingLinkService = require('../services/loan/loanBookingLinkService');

// Lazy-load models (safer than top-level require — prevents circular deps)
const getLoanProductModel = () => require('../models/LoanProduct');
const getLoanWorkflowModel = () => require('../models/LoanWorkflow');
const getLoanApplicationModel = () => require('../models/LoanApplication');

// ============================================
// HEALTH CHECK
// ============================================
router.get('/health', (req, res) => {
  res.json({
    success: true,
    module: 'Loan V2',
    status: 'active',
    version: '2.0',
    note: 'New consolidated loan endpoints. Existing /api/loan/* still active.',
    taskStatus: {
      task9: 'done — scaffolding',
      task10: 'pending — Loan Products CRUD',
      task11: 'pending — Offers lifecycle',
      task12: 'pending — Agreements + eSign',
      task13: 'pending — Disbursements',
      task14: 'pending — Repayment + mandate',
      task15: 'pending — Refunds',
      task16: 'pending — Reconciliation',
      task17: 'pending — Audit',
    },
  });
});

// ============================================
// LOAN PRODUCTS (Task 10 placeholder)
// ============================================
router.get('/products', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanProduct = getLoanProductModel();
    const products = await LoanProduct.getActiveByLender(req.user.lenderId);
    res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (err) {
    console.error('[loanRoutes] GET /products error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/products/:productId', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanProduct = getLoanProductModel();
    const product = await LoanProduct.findOne({
      productId: req.params.productId,
      lenderId: req.user.id,
    });
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, product });
  } catch (err) {
    console.error('[loanRoutes] GET /products/:id error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/products', authenticate, authenticateLender, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'POST /products will be implemented in Task 10',
  });
});

router.put('/products/:productId', authenticate, authenticateLender, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'PUT /products/:id will be implemented in Task 10',
  });
});

router.post('/products/:productId/activate', authenticate, authenticateLender, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'Product activation will be implemented in Task 10',
  });
});

router.post('/products/:productId/deactivate', authenticate, authenticateLender, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'Product deactivation will be implemented in Task 10',
  });
});

// ============================================
// OFFERS (Task 11 placeholder)
// ============================================
router.get('/offers/:applicationId', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const workflow = await LoanWorkflow.findByApplication(req.params.applicationId);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found for this application',
      });
    }
    res.json({
      success: true,
      applicationId: req.params.applicationId,
      currentOfferId: workflow.currentOfferId,
      count: workflow.offers.length,
      offers: workflow.offers,
    });
  } catch (err) {
    console.error('[loanRoutes] GET /offers error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/offers', authenticate, authenticateLender, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'POST /offers will be implemented in Task 11',
  });
});

router.post('/offers/:offerId/accept', authenticate, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'Offer acceptance will be implemented in Task 11',
  });
});

router.post('/offers/:offerId/decline', authenticate, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'Offer decline will be implemented in Task 11',
  });
});

// ============================================
// AGREEMENTS (Task 12 placeholder)
// ============================================
router.get('/agreements/:applicationId', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const workflow = await LoanWorkflow.findByApplication(req.params.applicationId);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.json({
      success: true,
      applicationId: req.params.applicationId,
      currentAgreementId: workflow.currentAgreementId,
      count: workflow.agreements.length,
      agreements: workflow.agreements,
    });
  } catch (err) {
    console.error('[loanRoutes] GET /agreements error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/agreements', authenticate, authenticateLender, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'POST /agreements will be implemented in Task 12',
  });
});

router.post('/agreements/:agreementId/sign', authenticate, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'eSign will be implemented in Task 12',
  });
});

// ============================================
// DISBURSEMENTS (Task 13 placeholder)
// ============================================
router.get('/disbursements/:applicationId', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const workflow = await LoanWorkflow.findByApplication(req.params.applicationId);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.json({
      success: true,
      applicationId: req.params.applicationId,
      currentDisbursementId: workflow.currentDisbursementId,
      count: workflow.disbursements.length,
      disbursements: workflow.disbursements,
    });
  } catch (err) {
    console.error('[loanRoutes] GET /disbursements error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/disbursements', authenticate, authenticateLender, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'POST /disbursements will be implemented in Task 13',
  });
});

router.post('/disbursements/:disbursementId/confirm', authenticate, authenticateLender, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'Disbursement confirm will be implemented in Task 13',
  });
});

router.post('/disbursements/:disbursementId/reconcile', authenticate, authenticateLender, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'Disbursement reconcile will be implemented in Task 13',
  });
});

// ============================================
// REPAYMENT (Task 14 placeholder)
// ============================================
router.get('/repayment/:applicationId', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const workflow = await LoanWorkflow.findByApplication(req.params.applicationId);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.json({
      success: true,
      applicationId: req.params.applicationId,
      currentMandateId: workflow.currentMandateId,
      count: workflow.mandates.length,
      mandates: workflow.mandates,
    });
  } catch (err) {
    console.error('[loanRoutes] GET /repayment error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/repayment/mandate', authenticate, authenticateLender, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'Mandate creation will be implemented in Task 14',
  });
});

router.get('/repayment/:applicationId/schedule', authenticate, authenticateLender, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'EMI schedule will be implemented in Task 14',
  });
});

// ============================================
// REFUNDS (Task 15 placeholder)
// ============================================
router.get('/refunds/:applicationId', authenticate, authenticateLender, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'Refunds will be implemented in Task 15',
  });
});

router.post('/refunds', authenticate, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'Refund request will be implemented in Task 15',
  });
});

// ============================================
// RECONCILIATION (Task 16 placeholder)
// ============================================
router.get('/reconciliation', authenticate, authenticateLender, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'Reconciliation will be implemented in Task 16',
  });
});

router.post('/reconciliation/upload', authenticate, authenticateLender, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'File upload will be implemented in Task 16',
  });
});

// ============================================
// AUDIT (Task 17 — mostly done, uses existing statusHistory)
// ============================================
router.get('/audit/:applicationId', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanApplication = getLoanApplicationModel();
    const application = await LoanApplication.findOne({
      applicationId: req.params.applicationId,
      lenderId: req.user.lenderId,
    }).select('applicationId status statusHistory platformCommission disbursedAmount submittedAt disbursedAt');
    
    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    res.json({
      success: true,
      applicationId: application.applicationId,
      currentStatus: application.status,
      disbursedAmount: application.disbursedAmount || 0,
      platformCommission: application.platformCommission || 0,
      submittedAt: application.submittedAt,
      disbursedAt: application.disbursedAt,
      eventCount: (application.statusHistory || []).length,
      history: application.statusHistory || [],
    });
  } catch (err) {
    console.error('[loanRoutes] GET /audit error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
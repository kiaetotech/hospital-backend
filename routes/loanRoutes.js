// D:\hospital backend\routes\loanRoutes.js
// ============================================
// CONSOLIDATED LOAN ROUTES (v2)
// ============================================
// Single entry point for all NEW loan endpoints.
// Coexists with existing /api/loan/* routes.
// Mounted at: /api/loan/v2
//
// Status:
//   Task 9  ✅ Scaffolding + health
//   Task 10 ✅ Loan Products CRUD (create/edit/activate/deactivate/version)
//   Task 11 ⏳ Offers lifecycle
//   Task 12 ⏳ Agreements + eSign
//   Task 13 ⏳ Disbursements
//   Task 14 ⏳ Repayment + mandate
//   Task 15 ⏳ Refunds
//   Task 16 ⏳ Reconciliation
//   Task 17 ⏳ Audit
// ============================================

const express = require('express');
const router = express.Router();

// ============================================
// DEPENDENCIES
// ============================================
const { authenticate, authenticateLender } = require('../middleware/auth');

// Lazy-load models (prevents circular deps)
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
      task10: 'done — Loan Products CRUD',
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
// LOAN PRODUCTS
// ============================================

// GET /products — list active products for authenticated lender
router.get('/products', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanProduct = getLoanProductModel();
    const products = await LoanProduct.getActiveByLender(req.user.id);
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

// GET /products/:productId — single product
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

// POST /products — create product draft
router.post('/products', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanProduct = getLoanProductModel();
    
    const {
      productCode,
      productName,
      productCategory,
      description,
      minAmount,
      maxAmount,
      interestRate,
      interestType,
      minTenureMonths,
      maxTenureMonths,
      processingFeeType,
      processingFeePercent,
      processingFeeFixed,
      processingFeeMin,
      processingFeeMax,
      gstOnProcessingFee,
      documentationCharge,
      stampDutyPercent,
      insurancePercent,
      prepaymentPenaltyPercent,
      latePaymentFeeFixed,
      latePaymentFeePercent,
      cancellationCharge,
      minCibilScore,
      minAge,
      maxAge,
      minMonthlyIncome,
      employmentTypesAllowed,
      requiresCollateral,
      collateralTypes,
      requiresGuarantor,
      approvalTimeHours,
    } = req.body;
    
    // ─── Validation ───
    const errors = [];
    
    if (!productCode || typeof productCode !== 'string' || productCode.trim().length < 2) {
      errors.push('productCode is required (min 2 chars)');
    }
    if (!productName || typeof productName !== 'string' || productName.trim().length < 3) {
      errors.push('productName is required (min 3 chars)');
    }
    if (!productCategory || !['medical_loan', 'surgery_financing', 'diagnostic_emi', 'treatment_loan', 'no_cost_emi', 'corporate_loan'].includes(productCategory)) {
      errors.push('productCategory must be one of: medical_loan, surgery_financing, diagnostic_emi, treatment_loan, no_cost_emi, corporate_loan');
    }
    if (typeof minAmount !== 'number' || minAmount <= 0) {
      errors.push('minAmount must be > 0');
    }
    if (typeof maxAmount !== 'number' || maxAmount <= 0) {
      errors.push('maxAmount must be > 0');
    }
    if (minAmount && maxAmount && minAmount >= maxAmount) {
      errors.push('minAmount must be less than maxAmount');
    }
    if (typeof interestRate !== 'number' || interestRate < 0 || interestRate > 100) {
      errors.push('interestRate must be between 0 and 100');
    }
    if (typeof minTenureMonths !== 'number' || minTenureMonths < 1) {
      errors.push('minTenureMonths must be >= 1');
    }
    if (typeof maxTenureMonths !== 'number' || maxTenureMonths < 1) {
      errors.push('maxTenureMonths must be >= 1');
    }
    if (minTenureMonths && maxTenureMonths && minTenureMonths >= maxTenureMonths) {
      errors.push('minTenureMonths must be less than maxTenureMonths');
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }
    
    // ─── Duplicate check ───
    const existing = await LoanProduct.findOne({
      lenderId: req.user.id,
      productCode: productCode.trim(),
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: `Product with code "${productCode}" already exists for this lender`,
        code: 'DUPLICATE_PRODUCT_CODE',
      });
    }
    
    // ─── Create product ───
    const product = new LoanProduct({
      lenderId: req.user.id,
      productCode: productCode.trim(),
      productName: productName.trim(),
      productCategory,
      description: description || '',
      minAmount,
      maxAmount,
      interestRate,
      interestType: interestType || 'reducing',
      minTenureMonths,
      maxTenureMonths,
      processingFeeType: processingFeeType || 'percentage',
      processingFeePercent: processingFeePercent || 0,
      processingFeeFixed: processingFeeFixed || 0,
      processingFeeMin: processingFeeMin || 0,
      processingFeeMax: processingFeeMax !== undefined ? processingFeeMax : null,
      gstOnProcessingFee: gstOnProcessingFee !== undefined ? gstOnProcessingFee : 18,
      documentationCharge: documentationCharge || 0,
      stampDutyPercent: stampDutyPercent || 0,
      insurancePercent: insurancePercent || 0,
      prepaymentPenaltyPercent: prepaymentPenaltyPercent || 0,
      latePaymentFeeFixed: latePaymentFeeFixed || 0,
      latePaymentFeePercent: latePaymentFeePercent || 0,
      cancellationCharge: cancellationCharge || 0,
      minCibilScore: minCibilScore || 650,
      minAge: minAge || 21,
      maxAge: maxAge || 65,
      minMonthlyIncome: minMonthlyIncome || 0,
      employmentTypesAllowed: employmentTypesAllowed || ['any'],
      requiresCollateral: requiresCollateral || false,
      collateralTypes: collateralTypes || [],
      requiresGuarantor: requiresGuarantor || false,
      approvalTimeHours: approvalTimeHours || 24,
      status: 'draft',
      createdBy: req.user.lenderId || req.user.email || 'lender',
    });
    
    await product.save();
    
    res.status(201).json({
      success: true,
      product,
      message: 'Product draft created. Use /activate to publish.',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate product code',
        code: 'DUPLICATE_PRODUCT_CODE',
      });
    }
    console.error('[loanRoutes] POST /products error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /products/:productId — edit product draft
router.put('/products/:productId', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanProduct = getLoanProductModel();
    
    const product = await LoanProduct.findOne({
      productId: req.params.productId,
      lenderId: req.user.id,
    });
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    if (product.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: `Cannot edit product in status "${product.status}". Only drafts can be edited. Use POST /:id/version to create a new version of active products.`,
        code: 'PRODUCT_NOT_DRAFT',
      });
    }
    
    const allowedFields = [
      'productName', 'productCategory', 'description',
      'minAmount', 'maxAmount', 'interestRate', 'interestType',
      'minTenureMonths', 'maxTenureMonths',
      'processingFeeType', 'processingFeePercent', 'processingFeeFixed',
      'processingFeeMin', 'processingFeeMax', 'gstOnProcessingFee',
      'documentationCharge', 'stampDutyPercent', 'insurancePercent',
      'prepaymentPenaltyPercent', 'latePaymentFeeFixed', 'latePaymentFeePercent',
      'cancellationCharge', 'minCibilScore', 'minAge', 'maxAge',
      'minMonthlyIncome', 'employmentTypesAllowed',
      'requiresCollateral', 'collateralTypes', 'requiresGuarantor',
      'approvalTimeHours',
    ];
    
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
        allowedFields,
      });
    }
    
    if (updates.minAmount !== undefined && (updates.minAmount <= 0)) {
      return res.status(400).json({ success: false, error: 'minAmount must be > 0' });
    }
    if (updates.maxAmount !== undefined && (updates.maxAmount <= 0)) {
      return res.status(400).json({ success: false, error: 'maxAmount must be > 0' });
    }
    if (updates.interestRate !== undefined && (updates.interestRate < 0 || updates.interestRate > 100)) {
      return res.status(400).json({ success: false, error: 'interestRate must be between 0 and 100' });
    }
    
    Object.assign(product, updates);
    product.updatedBy = req.user.lenderId || req.user.email || 'lender';
    await product.save();
    
    res.json({
      success: true,
      product,
      message: 'Product draft updated',
    });
  } catch (error) {
    console.error('[loanRoutes] PUT /products error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /products/:productId/activate — publish draft
router.post('/products/:productId/activate', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanProduct = getLoanProductModel();
    
    const product = await LoanProduct.findOne({
      productId: req.params.productId,
      lenderId: req.user.id,
    });
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    if (product.status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'Product is already active',
        code: 'ALREADY_ACTIVE',
      });
    }
    
    if (product.status === 'archived' || product.status === 'suspended') {
      return res.status(400).json({
        success: false,
        error: `Cannot activate product in status "${product.status}"`,
        code: 'PRODUCT_NOT_DRAFT',
      });
    }
    
    const requiredFields = [
      'productName', 'productCategory', 'minAmount', 'maxAmount',
      'interestRate', 'minTenureMonths', 'maxTenureMonths',
    ];
    const missing = requiredFields.filter(f => !product[f]);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Product is missing required fields',
        missing,
      });
    }
    
    product.status = 'active';
    product.publishedAt = new Date();
    product.activatedAt = new Date();
    product.effectiveFrom = new Date();
    product.updatedBy = req.user.lenderId || req.user.email || 'lender';
    await product.save();
    
    res.json({
      success: true,
      product,
      message: 'Product activated. Now visible to patients.',
    });
  } catch (error) {
    console.error('[loanRoutes] POST /products/:id/activate error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /products/:productId/deactivate — stop accepting new applications
router.post('/products/:productId/deactivate', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanProduct = getLoanProductModel();
    
    const { reason } = req.body;
    
    const product = await LoanProduct.findOne({
      productId: req.params.productId,
      lenderId: req.user.id,
    });
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    if (product.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Product is not active (current: ${product.status})`,
        code: 'PRODUCT_NOT_ACTIVE',
      });
    }
    
    // Safety check: warn if applications exist
    const LoanApplication = getLoanApplicationModel();
    const liveApplicationCount = await LoanApplication.countDocuments({
      productId: product.productId,
      status: { $nin: ['completed', 'rejected', 'withdrawn', 'cancelled'] },
    });
    
    if (liveApplicationCount > 0 && !req.body.force) {
      return res.status(400).json({
        success: false,
        error: `Cannot deactivate: ${liveApplicationCount} live applications use this product. Add "force: true" to deactivate anyway (existing applications continue, only new applications blocked).`,
        code: 'LIVE_APPLICATIONS_EXIST',
        liveApplicationCount,
      });
    }
    
    product.status = 'inactive';
    product.deactivatedAt = new Date();
    product.deactivationReason = reason || 'No reason provided';
    product.updatedBy = req.user.lenderId || req.user.email || 'lender';
    await product.save();
    
    res.json({
      success: true,
      product,
      message: `Product deactivated.${liveApplicationCount > 0 ? ` ${liveApplicationCount} live applications will continue to completion.` : ''}`,
    });
  } catch (error) {
    console.error('[loanRoutes] POST /products/:id/deactivate error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /products/:productId/version — create new version of active product
router.post('/products/:productId/version', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanProduct = getLoanProductModel();
    
    const oldProduct = await LoanProduct.findOne({
      productId: req.params.productId,
      lenderId: req.user.id,
    });
    
    if (!oldProduct) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    if (oldProduct.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Can only version active products (current: ${oldProduct.status})`,
        code: 'PRODUCT_NOT_ACTIVE',
      });
    }
    
    oldProduct.status = 'inactive';
    oldProduct.effectiveUntil = new Date();
    oldProduct.updatedBy = req.user.lenderId || req.user.email || 'lender';
    await oldProduct.save();
    
    const newProductData = oldProduct.toObject();
    delete newProductData._id;
    delete newProductData.productId;
    delete newProductData.createdAt;
    
    const allowedFields = [
      'interestRate', 'processingFeePercent', 'processingFeeFixed',
      'minAmount', 'maxAmount', 'minTenureMonths', 'maxTenureMonths',
      'prepaymentPenaltyPercent', 'latePaymentFeeFixed', 'latePaymentFeePercent',
      'cancellationCharge', 'minCibilScore', 'minAge', 'maxAge',
      'minMonthlyIncome', 'employmentTypesAllowed',
      'requiresCollateral', 'collateralTypes', 'requiresGuarantor',
      'approvalTimeHours', 'description',
    ];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        newProductData[field] = req.body[field];
      }
    }
    
    const newProduct = new LoanProduct({
      ...newProductData,
      version: oldProduct.version + 1,
      previousVersionId: oldProduct._id,
      status: 'draft',
      publishedAt: null,
      activatedAt: null,
      deactivatedAt: null,
      deactivationReason: '',
      effectiveFrom: new Date(),
      effectiveUntil: null,
      createdBy: req.user.lenderId || req.user.email || 'lender',
      updatedBy: req.user.lenderId || req.user.email || 'lender',
      changeReason: req.body.changeReason || `Version ${oldProduct.version + 1} of ${oldProduct.productName}`,
    });
    
    await newProduct.save();
    
    res.status(201).json({
      success: true,
      oldVersion: {
        productId: oldProduct.productId,
        version: oldProduct.version,
        status: oldProduct.status,
      },
      newVersion: {
        productId: newProduct.productId,
        version: newProduct.version,
        status: newProduct.status,
        previousVersionId: newProduct.previousVersionId,
      },
      product: newProduct,
      message: `Version ${newProduct.version} created as draft. Use /activate to publish.`,
    });
  } catch (error) {
    console.error('[loanRoutes] POST /products/:id/version error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// OFFERS (Task 11 placeholder)
// ============================================
router.get('/offers/:applicationId', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const workflow = await LoanWorkflow.findByApplication(req.params.applicationId);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found for this application' });
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
// AUDIT
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
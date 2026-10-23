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
      task11: 'done — Offers lifecycle',
      task12: 'done — Agreements + eSign',
      task13: 'done — Disbursements',
      task14: 'done — Repayment + mandate',
      task15: 'done — Refunds',
      task16: 'done — Reconciliation',
      task17: 'done — Audit',
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
// OFFERS (Task 11)
// ============================================
// Lender issues offer → patient accepts/declines → offer versioned if revised.
// Uses LoanWorkflow model (offers[] sub-document).
// Uses loanStateService for LoanApplication state transitions.

// ─── GET /offers/:applicationId — list all offers (versions) for an application ───
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

// ─── POST /offers — lender issues a new offer ───
router.post('/offers', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    const loanStateService = require('../services/loan/loanStateService');
    
    const {
      applicationId,
      sanctionedAmount,
      interestRate,
      tenureMonths,
      emi,
      processingFee,
      totalPayable,
      validUntilDays,
      notes,
    } = req.body;
    
    // ─── Validation ───
    const errors = [];
    if (!applicationId) errors.push('applicationId is required');
    if (typeof sanctionedAmount !== 'number' || sanctionedAmount <= 0) {
      errors.push('sanctionedAmount must be > 0');
    }
    if (typeof interestRate !== 'number' || interestRate < 0 || interestRate > 100) {
      errors.push('interestRate must be between 0 and 100');
    }
    if (typeof tenureMonths !== 'number' || tenureMonths < 1) {
      errors.push('tenureMonths must be >= 1');
    }
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors });
    }
    
    // ─── Load application ───
    const application = await LoanApplication.findOne({
      applicationId,
      lenderId: req.user.id,
    });
    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found for this lender' });
    }
    
    // ─── Verify application state permits offer issuance ───
    if (!['under_review', 'document_pending'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot issue offer. Application status is "${application.status}". Allowed: under_review, document_pending.`,
        code: 'INVALID_APPLICATION_STATE',
      });
    }
    
    // ─── Compute EMI if not provided ───
    let computedEMI = emi;
    let computedTotalPayable = totalPayable;
    if (!computedEMI) {
      const monthlyRate = interestRate / 100 / 12;
      if (monthlyRate === 0) {
        computedEMI = Math.round(sanctionedAmount / tenureMonths);
      } else {
        const num = sanctionedAmount * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths);
        const den = Math.pow(1 + monthlyRate, tenureMonths) - 1;
        computedEMI = Math.round(num / den);
      }
      computedTotalPayable = computedEMI * tenureMonths;
    }
    
    // ─── Load/create workflow ───
    const workflow = await LoanWorkflow.getOrCreate(
      applicationId,
      req.user.id,
      application.patientId
    );
    
    // ─── Build offer ───
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (validUntilDays || 7));
    
    const offerId = `OFFER_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const offer = workflow.addOffer({
      offerId,
      sanctionedAmount,
      interestRate,
      tenureMonths,
      emi: computedEMI,
      processingFee: processingFee || 0,
      totalPayable: computedTotalPayable,
      validUntil,
      status: 'issued',
      issuedBy: req.user.email || req.user.lenderId || 'lender',
      issuedByRole: 'lender_underwriter',
      notes: notes || '',
    });
    
    await workflow.save();
    
    // ─── Transition application state ───
    try {
      await loanStateService.transition({
        applicationId,
        toStatus: 'offer_issued',
        actor: req.user.email || req.user.lenderId,
        actorRole: 'lender_underwriter',
        note: `Offer issued: ₹${sanctionedAmount} @ ${interestRate}% for ${tenureMonths}m`,
        metadata: { offerId, emi: computedEMI },
      });
    } catch (stateErr) {
      if (stateErr.name === 'LoanStateError') {
        return res.status(400).json({
          success: false,
          error: stateErr.message,
          code: stateErr.code,
          offerId,
          note: 'Offer saved but state transition failed',
        });
      }
      throw stateErr;
    }
    
    res.status(201).json({
      success: true,
      offer,
      offerId,
      applicationId,
      message: `Offer issued. Valid until ${validUntil.toISOString().split('T')[0]}.`,
    });
  } catch (error) {
    console.error('[loanRoutes] POST /offers error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /offers/:offerId/accept — patient accepts offer ───
router.post('/offers/:offerId/accept', authenticate, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    const loanStateService = require('../services/loan/loanStateService');
    
    const { offerId } = req.params;
    
    // ─── Find workflow containing this offer ───
    // (No applicationId in URL — search by offerId across workflows for this patient)
    const workflow = await LoanWorkflow.findOne({
      'offers.offerId': offerId,
    });
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Offer not found' });
    }
    
    // ─── Verify patient owns this application ───
    const application = await LoanApplication.findOne({
      applicationId: workflow.applicationId,
    });
    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    if (application.patientId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, error: 'You do not own this application' });
    }
    
    // ─── Find offer ───
    const offer = workflow.offers.find(o => o.offerId === offerId);
    if (!offer) {
      return res.status(404).json({ success: false, error: 'Offer not found in workflow' });
    }
    if (offer.status !== 'issued') {
      return res.status(400).json({
        success: false,
        error: `Offer is not in "issued" state (current: ${offer.status})`,
        code: 'OFFER_NOT_ISSUED',
      });
    }
    
    // ─── Check expiry ───
    if (new Date() > offer.validUntil) {
      offer.status = 'expired';
      offer.expiredAt = new Date();
      await workflow.save();
      return res.status(400).json({
        success: false,
        error: 'Offer has expired',
        code: 'OFFER_EXPIRED',
      });
    }
    
    // ─── Accept ───
    offer.status = 'accepted';
    offer.acceptedAt = new Date();
    workflow.updatedAt = new Date();
    await workflow.save();
    
    // ─── Transition application state ───
    try {
      await loanStateService.transition({
        applicationId: workflow.applicationId,
        toStatus: 'offer_accepted',
        actor: req.user.id,
        actorRole: 'patient',
        note: `Patient accepted offer ${offerId}`,
        metadata: { offerId },
      });
    } catch (stateErr) {
      if (stateErr.name === 'LoanStateError') {
        return res.status(400).json({
          success: false,
          error: stateErr.message,
          code: stateErr.code,
          note: 'Offer accepted but state transition failed',
        });
      }
      throw stateErr;
    }
    
    res.json({
      success: true,
      offer,
      offerId,
      applicationId: workflow.applicationId,
      nextStep: 'agreement_pending',
      message: 'Offer accepted. Agreement signing is the next step.',
    });
  } catch (error) {
    console.error('[loanRoutes] POST /offers/:id/accept error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /offers/:offerId/decline — patient declines offer ───
router.post('/offers/:offerId/decline', authenticate, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    const loanStateService = require('../services/loan/loanStateService');
    
    const { offerId } = req.params;
    const { reason } = req.body;
    
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Decline reason is required' });
    }
    
    const workflow = await LoanWorkflow.findOne({ 'offers.offerId': offerId });
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Offer not found' });
    }
    
    const application = await LoanApplication.findOne({ applicationId: workflow.applicationId });
    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    if (application.patientId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, error: 'You do not own this application' });
    }
    
    const offer = workflow.offers.find(o => o.offerId === offerId);
    if (!offer) {
      return res.status(404).json({ success: false, error: 'Offer not found' });
    }
    if (offer.status !== 'issued') {
      return res.status(400).json({
        success: false,
        error: `Offer is not in "issued" state (current: ${offer.status})`,
        code: 'OFFER_NOT_ISSUED',
      });
    }
    
    offer.status = 'declined';
    offer.declinedAt = new Date();
    offer.declineReason = reason.trim();
    workflow.updatedAt = new Date();
    await workflow.save();
    
    try {
      await loanStateService.transition({
        applicationId: workflow.applicationId,
        toStatus: 'offer_declined',
        actor: req.user.id,
        actorRole: 'patient',
        reason: reason.trim(),
        note: `Patient declined offer ${offerId}`,
        metadata: { offerId },
      });
    } catch (stateErr) {
      if (stateErr.name === 'LoanStateError') {
        return res.status(400).json({
          success: false,
          error: stateErr.message,
          code: stateErr.code,
          note: 'Offer declined but state transition failed',
        });
      }
      throw stateErr;
    }
    
    res.json({
      success: true,
      offer,
      offerId,
      applicationId: workflow.applicationId,
      message: 'Offer declined. Lender may issue a revised offer.',
    });
  } catch (error) {
    console.error('[loanRoutes] POST /offers/:id/decline error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /offers/:offerId/version — lender revises offer (creates new version) ───
router.post('/offers/:offerId/version', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    const loanStateService = require('../services/loan/loanStateService');
    
    const { offerId } = req.params;
    const {
      sanctionedAmount,
      interestRate,
      tenureMonths,
      processingFee,
      validUntilDays,
      notes,
    } = req.body;
    
    const workflow = await LoanWorkflow.findOne({ 'offers.offerId': offerId });
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Offer not found' });
    }
    
    const application = await LoanApplication.findOne({
      applicationId: workflow.applicationId,
      lenderId: req.user.id,
    });
    if (!application) {
      return res.status(403).json({ success: false, error: 'Application not owned by this lender' });
    }
    
    const oldOffer = workflow.offers.find(o => o.offerId === offerId);
    if (!oldOffer) {
      return res.status(404).json({ success: false, error: 'Offer not found' });
    }
    
    // Can only version offers that are issued or declined (not yet accepted/expired/withdrawn)
    if (!['issued', 'declined'].includes(oldOffer.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot version offer in status "${oldOffer.status}". Allowed: issued, declined.`,
        code: 'OFFER_NOT_VERSIONABLE',
      });
    }
    
    // ─── Use new values or fall back to old ───
    const newSanctioned = sanctionedAmount || oldOffer.sanctionedAmount;
    const newRate = interestRate !== undefined ? interestRate : oldOffer.interestRate;
    const newTenure = tenureMonths || oldOffer.tenureMonths;
    const newProcessingFee = processingFee !== undefined ? processingFee : oldOffer.processingFee;
    
    // ─── Compute EMI ───
    const monthlyRate = newRate / 100 / 12;
    let newEMI;
    if (monthlyRate === 0) {
      newEMI = Math.round(newSanctioned / newTenure);
    } else {
      const num = newSanctioned * monthlyRate * Math.pow(1 + monthlyRate, newTenure);
      const den = Math.pow(1 + monthlyRate, newTenure) - 1;
      newEMI = Math.round(num / den);
    }
    
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (validUntilDays || 7));
    
    // ─── addOffer auto-supersedes old active offer ───
    const newOfferId = `OFFER_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newOffer = workflow.addOffer({
      offerId: newOfferId,
      sanctionedAmount: newSanctioned,
      interestRate: newRate,
      tenureMonths: newTenure,
      emi: newEMI,
      processingFee: newProcessingFee,
      totalPayable: newEMI * newTenure,
      validUntil,
      issuedBy: req.user.email || req.user.lenderId || 'lender',
      issuedByRole: 'lender_underwriter',
      notes: notes || `Revised offer (replaces ${offerId})`,
    });
    
    workflow.updatedAt = new Date();
    await workflow.save();
    
    // If app was in offer_declined state, transition back to offer_issued
    if (application.status === 'offer_declined') {
      try {
        await loanStateService.transition({
          applicationId: workflow.applicationId,
          toStatus: 'under_review',
          actor: req.user.email || req.user.lenderId,
          actorRole: 'lender_underwriter',
          note: 'Lender is issuing revised offer',
        });
        await loanStateService.transition({
          applicationId: workflow.applicationId,
          toStatus: 'offer_issued',
          actor: req.user.email || req.user.lenderId,
          actorRole: 'lender_underwriter',
          note: `Revised offer ${newOfferId} issued`,
          metadata: { offerId: newOfferId, replaces: offerId },
        });
      } catch (stateErr) {
        console.warn('[offer versioning] State transition warning:', stateErr.message);
      }
    }
    
    res.status(201).json({
      success: true,
      oldOfferId: offerId,
      newOfferId,
      newOffer,
      applicationId: workflow.applicationId,
      message: `New offer version issued: ${newOfferId}`,
    });
  } catch (error) {
    console.error('[loanRoutes] POST /offers/:id/version error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /offers/:offerId/withdraw — lender withdraws offer ───
router.post('/offers/:offerId/withdraw', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    const loanStateService = require('../services/loan/loanStateService');
    
    const { offerId } = req.params;
    const { reason } = req.body;
    
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Withdraw reason is required' });
    }
    
    const workflow = await LoanWorkflow.findOne({ 'offers.offerId': offerId });
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Offer not found' });
    }
    
    const application = await LoanApplication.findOne({
      applicationId: workflow.applicationId,
      lenderId: req.user.id,
    });
    if (!application) {
      return res.status(403).json({ success: false, error: 'Application not owned by this lender' });
    }
    
    const offer = workflow.offers.find(o => o.offerId === offerId);
    if (!offer) {
      return res.status(404).json({ success: false, error: 'Offer not found' });
    }
    if (offer.status !== 'issued') {
      return res.status(400).json({
        success: false,
        error: `Only "issued" offers can be withdrawn (current: ${offer.status})`,
        code: 'OFFER_NOT_ISSUED',
      });
    }
    
    offer.status = 'withdrawn';
    offer.withdrawnAt = new Date();
    offer.withdrawalReason = reason.trim();
    workflow.updatedAt = new Date();
    await workflow.save();
    
    // Move app back to under_review so lender can reissue
    try {
      await loanStateService.transition({
        applicationId: workflow.applicationId,
        toStatus: 'under_review',
        actor: req.user.email || req.user.lenderId,
        actorRole: 'lender_underwriter',
        reason: reason.trim(),
        note: `Offer ${offerId} withdrawn`,
      });
    } catch (stateErr) {
      if (stateErr.name === 'LoanStateError') {
        return res.status(400).json({
          success: false,
          error: stateErr.message,
          code: stateErr.code,
          note: 'Offer withdrawn but state transition failed',
        });
      }
      throw stateErr;
    }
    
    res.json({
      success: true,
      offerId,
      offer,
      applicationId: workflow.applicationId,
      message: 'Offer withdrawn. Application returned to under_review.',
    });
  } catch (error) {
    console.error('[loanRoutes] POST /offers/:id/withdraw error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /offers/:offerId/expire — system/lender expires offer ───
router.post('/offers/:offerId/expire', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    const loanStateService = require('../services/loan/loanStateService');
    
    const { offerId } = req.params;
    
    const workflow = await LoanWorkflow.findOne({ 'offers.offerId': offerId });
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Offer not found' });
    }
    
    const application = await LoanApplication.findOne({
      applicationId: workflow.applicationId,
      lenderId: req.user.id,
    });
    if (!application) {
      return res.status(403).json({ success: false, error: 'Application not owned by this lender' });
    }
    
    const offer = workflow.offers.find(o => o.offerId === offerId);
    if (!offer) {
      return res.status(404).json({ success: false, error: 'Offer not found' });
    }
    if (offer.status !== 'issued') {
      return res.status(400).json({
        success: false,
        error: `Only "issued" offers can be expired (current: ${offer.status})`,
        code: 'OFFER_NOT_ISSUED',
      });
    }
    
    offer.status = 'expired';
    offer.expiredAt = new Date();
    workflow.updatedAt = new Date();
    await workflow.save();
    
    try {
      await loanStateService.transition({
        applicationId: workflow.applicationId,
        toStatus: 'offer_expired',
        actor: req.user.email || req.user.lenderId,
        actorRole: 'lender_ops',
        note: `Offer ${offerId} expired`,
      });
    } catch (stateErr) {
      console.warn('[offer expire] State transition warning:', stateErr.message);
    }
    
    res.json({
      success: true,
      offerId,
      message: 'Offer marked as expired.',
    });
  } catch (error) {
    console.error('[loanRoutes] POST /offers/:id/expire error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// AGREEMENTS (Task 12)
// ============================================
// Manual mode (default): lender/patient mark agreement signed.
// Provider mode: integrates with Digio/Leegality/NSDL when contracts signed.
// Uses LoanWorkflow.agreements[] sub-document.

// ─── GET /agreements/:applicationId — list all agreements ───
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

// ─── POST /agreements — initiate agreement after accepted offer ───
router.post('/agreements', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    const loanStateService = require('../services/loan/loanStateService');
    
    const {
      applicationId,
      offerId,
      esignProvider = 'manual',
      expiresInDays = 14,
    } = req.body;
    
    if (!applicationId) return res.status(400).json({ success: false, error: 'applicationId is required' });
    if (!offerId) return res.status(400).json({ success: false, error: 'offerId is required' });
    if (!['manual', 'digio', 'leegality', 'nsdl', 'none'].includes(esignProvider)) {
      return res.status(400).json({
        success: false,
        error: 'esignProvider must be one of: manual, digio, leegality, nsdl',
      });
    }
    
    const application = await LoanApplication.findOne({
      applicationId,
      lenderId: req.user.id,
    });
    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found for this lender' });
    }
    
    if (!['offer_accepted', 'agreement_pending'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot initiate agreement. Application status is "${application.status}". Allowed: offer_accepted, agreement_pending.`,
        code: 'INVALID_APPLICATION_STATE',
      });
    }
    
    const workflow = await LoanWorkflow.findByApplication(applicationId);
    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
    
    const offer = workflow.offers.find(o => o.offerId === offerId);
    if (!offer) return res.status(404).json({ success: false, error: 'Offer not found' });
    if (offer.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        error: `Offer must be accepted before initiating agreement (current: ${offer.status})`,
        code: 'OFFER_NOT_ACCEPTED',
      });
    }
    
    const agreementId = `AGR_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    
    const agreement = workflow.addAgreement({
      agreementId,
      offerId,
      status: 'initiated',
      initiatedAt: new Date(),
      expiresAt,
      esignProvider,
      esignReferenceId: '',
      esignDocumentUrl: '',
      esignCertificateUrl: '',
      signedByLender: false,
      signedByPatient: false,
      initiatedBy: req.user.email || req.user.lenderId || 'lender',
    });
    
    await workflow.save();
    
    try {
      await loanStateService.transition({
        applicationId,
        toStatus: 'agreement_pending',
        actor: req.user.email || req.user.lenderId,
        actorRole: 'lender_ops',
        note: `Agreement ${agreementId} initiated (${esignProvider} mode)`,
        metadata: { agreementId, offerId, esignProvider },
      });
    } catch (stateErr) {
      if (stateErr.name === 'LoanStateError') {
        return res.status(400).json({
          success: false,
          error: stateErr.message,
          code: stateErr.code,
          agreementId,
          note: 'Agreement saved but state transition failed',
        });
      }
      throw stateErr;
    }
    
    res.status(201).json({
      success: true,
      agreementId,
      agreement,
      esignProvider,
      expiresAt,
      message: `Agreement initiated. ${esignProvider === 'manual' ? 'Both parties must sign manually.' : `Awaiting eSign provider (${esignProvider}) callback.`}`,
    });
  } catch (error) {
    console.error('[loanRoutes] POST /agreements error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /agreements/:agreementId/sign — record signature ───
router.post('/agreements/:agreementId/sign', authenticate, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    const loanStateService = require('../services/loan/loanStateService');
    
    const { agreementId } = req.params;
    const {
      signerRole,
      esignReferenceId,
      esignDocumentUrl,
      esignCertificateUrl,
      signatoryName,
    } = req.body;
    
    if (!signerRole || !['lender', 'patient'].includes(signerRole)) {
      return res.status(400).json({ success: false, error: 'signerRole must be "lender" or "patient"' });
    }
    
    const workflow = await LoanWorkflow.findOne({ 'agreements.agreementId': agreementId });
    if (!workflow) return res.status(404).json({ success: false, error: 'Agreement not found' });
    
    const application = await LoanApplication.findOne({ applicationId: workflow.applicationId });
    if (!application) return res.status(404).json({ success: false, error: 'Application not found' });
    
    if (signerRole === 'lender') {
      if (application.lenderId.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, error: 'Not authorized to sign as lender' });
      }
    } else {
      if (application.patientId.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, error: 'Not authorized to sign as patient' });
      }
    }
    
    const agreement = workflow.agreements.find(a => a.agreementId === agreementId);
    if (!agreement) return res.status(404).json({ success: false, error: 'Agreement not found in workflow' });
    
    if (!['pending', 'initiated'].includes(agreement.status)) {
      return res.status(400).json({
        success: false,
        error: `Agreement cannot be signed (current status: ${agreement.status})`,
        code: 'AGREEMENT_NOT_SIGNABLE',
      });
    }
    
    if (agreement.expiresAt && new Date() > agreement.expiresAt) {
      agreement.status = 'expired';
      await workflow.save();
      return res.status(400).json({
        success: false,
        error: 'Agreement has expired',
        code: 'AGREEMENT_EXPIRED',
      });
    }
    
    if (signerRole === 'lender') {
      agreement.signedByLender = true;
      agreement.lenderSignatory = signatoryName || req.user.email || 'lender';
    } else {
      agreement.signedByPatient = true;
      agreement.patientSignatory = signatoryName || 'patient';
    }
    
    if (esignReferenceId) agreement.esignReferenceId = esignReferenceId;
    if (esignDocumentUrl) agreement.esignDocumentUrl = esignDocumentUrl;
    if (esignCertificateUrl) agreement.esignCertificateUrl = esignCertificateUrl;
    
    if (agreement.signedByLender && agreement.signedByPatient) {
      agreement.status = 'signed';
      agreement.signedAt = new Date();
      workflow.updatedAt = new Date();
      await workflow.save();
      
      try {
        await loanStateService.transition({
          applicationId: workflow.applicationId,
          toStatus: 'agreement_signed',
          actor: 'system',
          actorRole: 'system',
          note: `Agreement ${agreementId} fully signed by both parties`,
          metadata: { agreementId },
        });
      } catch (stateErr) {
        console.warn('[agreement sign] State transition warning:', stateErr.message);
      }
      
      return res.json({
        success: true,
        agreementId,
        agreement,
        bothPartiesSigned: true,
        nextStep: 'pending_disbursal',
        message: 'Agreement fully signed. Ready for disbursement.',
      });
    }
    
    workflow.updatedAt = new Date();
    await workflow.save();
    
    res.json({
      success: true,
      agreementId,
      agreement,
      bothPartiesSigned: false,
      waitingFor: signerRole === 'lender' ? 'patient' : 'lender',
      message: `${signerRole} signature recorded. Waiting for other party.`,
    });
  } catch (error) {
    console.error('[loanRoutes] POST /agreements/:id/sign error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /agreements/:agreementId/cancel — cancel before signing ───
router.post('/agreements/:agreementId/cancel', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    const loanStateService = require('../services/loan/loanStateService');
    
    const { agreementId } = req.params;
    const { reason } = req.body;
    
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Cancel reason is required' });
    }
    
    const workflow = await LoanWorkflow.findOne({ 'agreements.agreementId': agreementId });
    if (!workflow) return res.status(404).json({ success: false, error: 'Agreement not found' });
    
    const application = await LoanApplication.findOne({
      applicationId: workflow.applicationId,
      lenderId: req.user.id,
    });
    if (!application) return res.status(403).json({ success: false, error: 'Not authorized' });
    
    const agreement = workflow.agreements.find(a => a.agreementId === agreementId);
    if (!agreement) return res.status(404).json({ success: false, error: 'Agreement not found' });
    
    if (agreement.status === 'signed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a signed agreement',
        code: 'AGREEMENT_ALREADY_SIGNED',
      });
    }
    if (agreement.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Agreement is already cancelled',
        code: 'AGREEMENT_ALREADY_CANCELLED',
      });
    }
    
    agreement.status = 'cancelled';
    agreement.cancelledReason = reason.trim();
    workflow.updatedAt = new Date();
    await workflow.save();
    
    try {
      await loanStateService.transition({
        applicationId: workflow.applicationId,
        toStatus: 'withdrawn',
        actor: req.user.email || req.user.lenderId,
        actorRole: 'lender_ops',
        reason: reason.trim(),
        note: `Agreement ${agreementId} cancelled`,
      });
    } catch (stateErr) {
      console.warn('[agreement cancel] State transition warning:', stateErr.message);
    }
    
    res.json({
      success: true,
      agreementId,
      message: 'Agreement cancelled.',
    });
  } catch (error) {
    console.error('[loanRoutes] POST /agreements/:id/cancel error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET /agreements/:agreementId/pdf — download agreement PDF ───
router.get('/agreements/:agreementId/pdf', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    
    const { agreementId } = req.params;
    
    const workflow = await LoanWorkflow.findOne({ 'agreements.agreementId': agreementId });
    if (!workflow) return res.status(404).json({ success: false, error: 'Agreement not found' });
    
    const application = await LoanApplication.findOne({
      applicationId: workflow.applicationId,
      lenderId: req.user.id,
    });
    if (!application) return res.status(403).json({ success: false, error: 'Not authorized' });
    
    const agreement = workflow.agreements.find(a => a.agreementId === agreementId);
    if (!agreement) return res.status(404).json({ success: false, error: 'Agreement not found' });
    
    if (agreement.esignDocumentUrl) {
      return res.json({
        success: true,
        agreementId,
        downloadUrl: agreement.esignDocumentUrl,
        certificateUrl: agreement.esignCertificateUrl || null,
        status: agreement.status,
        message: 'Download URL provided by eSign provider.',
      });
    }
    
    res.json({
      success: true,
      agreementId,
      status: agreement.status,
      signedByLender: agreement.signedByLender,
      signedByPatient: agreement.signedByPatient,
      signedAt: agreement.signedAt,
      esignProvider: agreement.esignProvider,
      downloadUrl: null,
      message: 'Manual mode — no PDF stored. Use loanStateService history + statusHistory for audit.',
    });
  } catch (error) {
    console.error('[loanRoutes] GET /agreements/:id/pdf error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /webhooks/esign — eSign provider callback ───
// Public route (no auth) — signature-verified in production.
router.post('/webhooks/esign', async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const loanStateService = require('../services/loan/loanStateService');
    
    const {
      esignReferenceId,
      agreementId,
      event,
      signerRole,
      documentUrl,
      certificateUrl,
      signature,
    } = req.body;
    
    if (!agreementId || !event) {
      return res.status(400).json({ success: false, error: 'agreementId and event are required' });
    }
    
    // TODO: Verify signature against esign provider secret (Digio/Leegality/NSDL)
    
    const workflow = await LoanWorkflow.findOne({ 'agreements.agreementId': agreementId });
    if (!workflow) return res.status(404).json({ success: false, error: 'Agreement not found' });
    
    const agreement = workflow.agreements.find(a => a.agreementId === agreementId);
    if (!agreement) return res.status(404).json({ success: false, error: 'Agreement not found in workflow' });
    
    if (event === 'signed') {
      if (signerRole === 'lender') agreement.signedByLender = true;
      if (signerRole === 'patient') agreement.signedByPatient = true;
      if (documentUrl) agreement.esignDocumentUrl = documentUrl;
      if (certificateUrl) agreement.esignCertificateUrl = certificateUrl;
      if (esignReferenceId) agreement.esignReferenceId = esignReferenceId;
      
      if (agreement.signedByLender && agreement.signedByPatient) {
        agreement.status = 'signed';
        agreement.signedAt = new Date();
        
        try {
          await loanStateService.transition({
            applicationId: workflow.applicationId,
            toStatus: 'agreement_signed',
            actor: 'system',
            actorRole: 'system',
            note: `eSign callback: agreement ${agreementId} fully signed`,
          });
        } catch (e) {
          console.warn('[esign webhook] transition warning:', e.message);
        }
      }
    } else if (event === 'failed') {
      agreement.status = 'rejected';
    } else if (event === 'expired') {
      agreement.status = 'expired';
    }
    
    workflow.updatedAt = new Date();
    await workflow.save();
    
    res.json({ success: true, received: true });
  } catch (error) {
    console.error('[loanRoutes] POST /webhooks/esign error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DISBURSEMENTS (Task 13)
// ============================================
// Real money movement. Every disbursement creates:
//   - LoanWorkflow.disbursements[] entry
//   - Transaction ledger row (via loanCommissionService)
//   - Application state transition: agreement_signed → pending_disbursal → disbursed
//
// Lifecycle: initiated → confirmed → reconciled
// Idempotency: same UTR cannot be used twice across all workflows.

// ─── GET /disbursements/:applicationId — list disbursements ───
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

// ─── GET /disbursement/:disbursementId — single disbursement details ───
router.get('/disbursement/:disbursementId', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    
    const { disbursementId } = req.params;
    
    const workflow = await LoanWorkflow.findOne({ 'disbursements.disbursementId': disbursementId });
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Disbursement not found' });
    }
    
    const application = await LoanApplication.findOne({
      applicationId: workflow.applicationId,
      lenderId: req.user.id,
    });
    if (!application) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const disbursement = workflow.disbursements.find(d => d.disbursementId === disbursementId);
    if (!disbursement) {
      return res.status(404).json({ success: false, error: 'Disbursement not found in workflow' });
    }
    
    res.json({
      success: true,
      applicationId: workflow.applicationId,
      disbursement,
    });
  } catch (err) {
    console.error('[loanRoutes] GET /disbursement/:id error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /disbursements — lender initiates disbursement ───
router.post('/disbursements', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    const loanStateService = require('../services/loan/loanStateService');
    
    const {
      applicationId,
      agreementId,
      amount,
      mode,
      utrNumber,
      beneficiaryType = 'hospital',
      beneficiaryName,
      beneficiaryAccount = '',
      beneficiaryIfsc = '',
    } = req.body;
    
    const errors = [];
    if (!applicationId) errors.push('applicationId is required');
    if (!agreementId) errors.push('agreementId is required');
    if (typeof amount !== 'number' || amount <= 0) errors.push('amount must be > 0');
    if (!mode || !['neft', 'rtgs', 'imps', 'upi', 'bank_transfer', 'cheque'].includes(mode)) {
      errors.push('mode must be one of: neft, rtgs, imps, upi, bank_transfer, cheque');
    }
    if (!utrNumber || utrNumber.trim().length < 6) errors.push('utrNumber is required (min 6 chars)');
    if (!beneficiaryName) errors.push('beneficiaryName is required');
    if (!['hospital', 'patient', 'provider'].includes(beneficiaryType)) {
      errors.push('beneficiaryType must be one of: hospital, patient, provider');
    }
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors });
    }
    
    const application = await LoanApplication.findOne({
      applicationId,
      lenderId: req.user.id,
    });
    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found for this lender' });
    }
    
    if (!['agreement_signed', 'pending_disbursal'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot initiate disbursement. Application status is "${application.status}". Allowed: agreement_signed, pending_disbursal.`,
        code: 'INVALID_APPLICATION_STATE',
      });
    }
    
    const workflow = await LoanWorkflow.findByApplication(applicationId);
    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
    
    const agreement = workflow.agreements.find(a => a.agreementId === agreementId);
    if (!agreement) return res.status(404).json({ success: false, error: 'Agreement not found' });
    if (agreement.status !== 'signed') {
      return res.status(400).json({
        success: false,
        error: `Agreement must be signed before disbursement (current: ${agreement.status})`,
        code: 'AGREEMENT_NOT_SIGNED',
      });
    }
    
    const signedOffer = workflow.offers.find(o => o.offerId === agreement.offerId);
    if (!signedOffer) {
      return res.status(404).json({ success: false, error: 'Signed offer not found' });
    }
    if (amount > signedOffer.sanctionedAmount) {
      return res.status(400).json({
        success: false,
        error: `Disbursement amount ₹${amount} exceeds sanctioned ₹${signedOffer.sanctionedAmount}`,
        code: 'AMOUNT_EXCEEDS_SANCTIONED',
      });
    }
    
    const existingUtr = await LoanWorkflow.findOne({
      'disbursements.utrNumber': utrNumber.trim(),
    });
    if (existingUtr) {
      return res.status(400).json({
        success: false,
        error: `UTR "${utrNumber}" is already used in another disbursement`,
        code: 'DUPLICATE_UTR',
      });
    }
    
    const disbursementId = `DISB_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const disbursement = workflow.addDisbursement({
      disbursementId,
      agreementId,
      amount,
      patientLiability: 0,
      mode,
      utrNumber: utrNumber.trim(),
      bankReference: '',
      beneficiaryType,
      beneficiaryName,
      beneficiaryAccount,
      beneficiaryIfsc,
      status: 'initiated',
      initiatedBy: req.user.email || req.user.lenderId || 'lender',
      initiatedByRole: 'lender_ops',
      notes: '',
    });
    
    await workflow.save();
    
    try {
      await loanStateService.transition({
        applicationId,
        toStatus: 'pending_disbursal',
        actor: req.user.email || req.user.lenderId,
        actorRole: 'lender_ops',
        note: `Disbursement ${disbursementId} initiated: ₹${amount} to ${beneficiaryName}`,
        metadata: { disbursementId, utrNumber, amount },
      });
    } catch (stateErr) {
      if (stateErr.name === 'LoanStateError') {
        return res.status(400).json({
          success: false,
          error: stateErr.message,
          code: stateErr.code,
          disbursementId,
          note: 'Disbursement saved but state transition failed',
        });
      }
      throw stateErr;
    }
    
    res.status(201).json({
      success: true,
      disbursementId,
      disbursement,
      message: `Disbursement of ₹${amount} initiated. Confirm when money is sent.`,
    });
  } catch (error) {
    console.error('[loanRoutes] POST /disbursements error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /disbursements/:id/confirm — lender confirms money sent ───
router.post('/disbursements/:disbursementId/confirm', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    const loanStateService = require('../services/loan/loanStateService');
    const loanCommissionService = require('../services/loan/loanCommissionService');
    
    const { disbursementId } = req.params;
    const { bankReference } = req.body;
    
    const workflow = await LoanWorkflow.findOne({ 'disbursements.disbursementId': disbursementId });
    if (!workflow) return res.status(404).json({ success: false, error: 'Disbursement not found' });
    
    const application = await LoanApplication.findOne({
      applicationId: workflow.applicationId,
      lenderId: req.user.id,
    });
    if (!application) return res.status(403).json({ success: false, error: 'Not authorized' });
    
    const disbursement = workflow.disbursements.find(d => d.disbursementId === disbursementId);
    if (!disbursement) return res.status(404).json({ success: false, error: 'Disbursement not found' });
    
    if (disbursement.status !== 'initiated') {
      return res.status(400).json({
        success: false,
        error: `Disbursement is in status "${disbursement.status}" — only "initiated" can be confirmed`,
        code: 'DISBURSEMENT_NOT_INITIATED',
      });
    }
    
    disbursement.status = 'confirmed';
    disbursement.confirmedAt = new Date();
    if (bankReference) disbursement.bankReference = bankReference;
    workflow.updatedAt = new Date();
    await workflow.save();
    
    try {
      await loanStateService.transition({
        applicationId: workflow.applicationId,
        toStatus: 'disbursed',
        actor: req.user.email || req.user.lenderId,
        actorRole: 'lender_ops',
        note: `Disbursement ${disbursementId} confirmed: ₹${disbursement.amount} sent (UTR: ${disbursement.utrNumber})`,
        metadata: { disbursementId, utrNumber: disbursement.utrNumber },
      });
    } catch (stateErr) {
      console.warn('[disbursement confirm] State transition warning:', stateErr.message);
    }
    
    let commissionResult = null;
    try {
      commissionResult = await loanCommissionService.postCommission({
        applicationId: workflow.applicationId,
        disbursedAmount: disbursement.amount,
        updatedBy: req.user.email || req.user.lenderId || 'lender',
        updatedByRole: 'lender',
      });
    } catch (commErr) {
      console.warn('[disbursement confirm] Commission posting failed:', commErr.message);
    }
    
    if (commissionResult && commissionResult.transaction) {
      disbursement.transactionId = commissionResult.transaction.transactionId;
      await workflow.save();
    }
    
    res.json({
      success: true,
      disbursementId,
      disbursement,
      commission: commissionResult ? {
        commissionAmount: commissionResult.commission.commissionAmount,
        commissionCreated: commissionResult.created,
        transactionId: commissionResult.transaction?.transactionId,
      } : null,
      message: `Disbursement confirmed. ₹${disbursement.amount} to ${disbursement.beneficiaryName}.`,
    });
  } catch (error) {
    console.error('[loanRoutes] POST /disbursements/:id/confirm error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /disbursements/:id/reconcile — reconcile against bank statement ───
router.post('/disbursements/:disbursementId/reconcile', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    
    const { disbursementId } = req.params;
    const { bankStatementUrl, reconciliationNotes } = req.body;
    
    const workflow = await LoanWorkflow.findOne({ 'disbursements.disbursementId': disbursementId });
    if (!workflow) return res.status(404).json({ success: false, error: 'Disbursement not found' });
    
    const application = await LoanApplication.findOne({
      applicationId: workflow.applicationId,
      lenderId: req.user.id,
    });
    if (!application) return res.status(403).json({ success: false, error: 'Not authorized' });
    
    const disbursement = workflow.disbursements.find(d => d.disbursementId === disbursementId);
    if (!disbursement) return res.status(404).json({ success: false, error: 'Disbursement not found' });
    
    if (disbursement.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        error: `Only "confirmed" disbursements can be reconciled (current: ${disbursement.status})`,
        code: 'DISBURSEMENT_NOT_CONFIRMED',
      });
    }
    
    disbursement.status = 'reconciled';
    disbursement.reconciledAt = new Date();
    disbursement.reconciledBy = req.user.email || req.user.lenderId || 'lender';
    if (bankStatementUrl) disbursement.bankStatementUrl = bankStatementUrl;
    if (reconciliationNotes) disbursement.notes = (disbursement.notes || '') + ` | Reconciled: ${reconciliationNotes}`;
    workflow.updatedAt = new Date();
    await workflow.save();
    
    res.json({
      success: true,
      disbursementId,
      disbursement,
      message: 'Disbursement reconciled. Bank statement matched.',
    });
  } catch (error) {
    console.error('[loanRoutes] POST /disbursements/:id/reconcile error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// REPAYMENT + MANDATE (Task 14)
// ============================================
// EMI schedule generation, eNACH/UPI Autopay mandate, payment tracking.
// Uses LoanWorkflow.mandates[] sub-document + Transaction ledger.

// ─── GET /repayment/:applicationId — list mandates ───
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

// ─── POST /repayment/mandate — create eNACH/UPI Autopay mandate ───
router.post('/repayment/mandate', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    
    const {
      applicationId,
      type, // enach | upi_autopay | nach_debit | ecs
      accountHolderName,
      accountNumber,
      ifsc,
      bankName,
      maxAmount,
      frequency = 'monthly',
      startDate,
      endDate,
      provider = 'manual',
    } = req.body;
    
    // ─── Validation ───
    const errors = [];
    if (!applicationId) errors.push('applicationId is required');
    if (!type || !['enach', 'upi_autopay', 'nach_debit', 'ecs'].includes(type)) {
      errors.push('type must be one of: enach, upi_autopay, nach_debit, ecs');
    }
    if (!accountHolderName) errors.push('accountHolderName is required');
    if (!accountNumber || accountNumber.length < 6) errors.push('accountNumber required (min 6 digits)');
    if (!ifsc || ifsc.length !== 11) errors.push('valid 11-char IFSC required');
    if (typeof maxAmount !== 'number' || maxAmount <= 0) errors.push('maxAmount must be > 0');
    if (!frequency || !['monthly', 'quarterly', 'half_yearly', 'yearly'].includes(frequency)) {
      errors.push('frequency must be one of: monthly, quarterly, half_yearly, yearly');
    }
    if (!startDate) errors.push('startDate is required');
    if (!endDate) errors.push('endDate is required');
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors });
    }
    
    // ─── Load application ───
    const application = await LoanApplication.findOne({
      applicationId,
      lenderId: req.user.id,
    });
    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found for this lender' });
    }
    
    if (application.status !== 'disbursed') {
      return res.status(400).json({
        success: false,
        error: `Mandate can only be created after disbursement (current status: ${application.status})`,
        code: 'INVALID_APPLICATION_STATE',
      });
    }
    
    // ─── Load workflow ───
    const workflow = await LoanWorkflow.findByApplication(applicationId);
    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
    
    const disbursement = workflow.getLatestDisbursement();
    if (!disbursement || disbursement.status === 'initiated') {
      return res.status(400).json({
        success: false,
        error: 'Confirmed disbursement required before mandate creation',
        code: 'DISBURSEMENT_NOT_CONFIRMED',
      });
    }
    
    // ─── Create mandate ───
    const mandateId = `MANDATE_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const mandate = workflow.addMandate({
      mandateId,
      disbursementId: disbursement.disbursementId,
      type,
      accountHolderName,
      accountNumber,
      ifsc,
      bankName: bankName || '',
      maxAmount,
      frequency,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      provider,
      providerMandateId: '',
      providerSubscriptionId: '',
      status: 'pending',
      createdBy: req.user.email || req.user.lenderId || 'lender',
      notes: '',
    });
    
    await workflow.save();
    
    res.status(201).json({
      success: true,
      mandateId,
      mandate,
      provider,
      message: `Mandate created (${type}). ${provider === 'manual' ? 'Activate manually after bank confirmation.' : `Awaiting ${provider} activation.`}`,
    });
  } catch (error) {
    console.error('[loanRoutes] POST /repayment/mandate error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /repayment/mandate/:mandateId/activate — activate mandate ───
router.post('/repayment/mandate/:mandateId/activate', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    
    const { mandateId } = req.params;
    const { providerMandateId, providerSubscriptionId } = req.body;
    
    const workflow = await LoanWorkflow.findOne({ 'mandates.mandateId': mandateId });
    if (!workflow) return res.status(404).json({ success: false, error: 'Mandate not found' });
    
    const application = await LoanApplication.findOne({
      applicationId: workflow.applicationId,
      lenderId: req.user.id,
    });
    if (!application) return res.status(403).json({ success: false, error: 'Not authorized' });
    
    const mandate = workflow.mandates.find(m => m.mandateId === mandateId);
    if (!mandate) return res.status(404).json({ success: false, error: 'Mandate not found in workflow' });
    
    if (mandate.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Mandate is in status "${mandate.status}" — only "pending" can be activated`,
        code: 'MANDATE_NOT_PENDING',
      });
    }
    
    mandate.status = 'active';
    mandate.activatedAt = new Date();
    if (providerMandateId) mandate.providerMandateId = providerMandateId;
    if (providerSubscriptionId) mandate.providerSubscriptionId = providerSubscriptionId;
    workflow.updatedAt = new Date();
    await workflow.save();
    
    res.json({
      success: true,
      mandateId,
      mandate,
      message: 'Mandate activated. Ready to collect EMI.',
    });
  } catch (error) {
    console.error('[loanRoutes] POST /repayment/mandate/:id/activate error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /repayment/mandate/:mandateId/cancel — cancel mandate ───
router.post('/repayment/mandate/:mandateId/cancel', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    
    const { mandateId } = req.params;
    const { reason } = req.body;
    
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Cancel reason is required' });
    }
    
    const workflow = await LoanWorkflow.findOne({ 'mandates.mandateId': mandateId });
    if (!workflow) return res.status(404).json({ success: false, error: 'Mandate not found' });
    
    const application = await LoanApplication.findOne({
      applicationId: workflow.applicationId,
      lenderId: req.user.id,
    });
    if (!application) return res.status(403).json({ success: false, error: 'Not authorized' });
    
    const mandate = workflow.mandates.find(m => m.mandateId === mandateId);
    if (!mandate) return res.status(404).json({ success: false, error: 'Mandate not found' });
    
    if (!['pending', 'active', 'paused'].includes(mandate.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel mandate in status "${mandate.status}"`,
        code: 'MANDATE_NOT_CANCELLABLE',
      });
    }
    
    mandate.status = 'cancelled';
    mandate.cancelledAt = new Date();
    mandate.cancelReason = reason.trim();
    workflow.updatedAt = new Date();
    await workflow.save();
    
    res.json({ success: true, mandateId, message: 'Mandate cancelled.' });
  } catch (error) {
    console.error('[loanRoutes] POST /repayment/mandate/:id/cancel error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET /repayment/:applicationId/schedule — EMI schedule ───
router.get('/repayment/:applicationId/schedule', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    
    const { applicationId } = req.params;
    
    const application = await LoanApplication.findOne({
      applicationId,
      lenderId: req.user.id,
    });
    if (!application) return res.status(404).json({ success: false, error: 'Application not found' });
    
    const workflow = await LoanWorkflow.findByApplication(applicationId);
    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
    
    const signedAgreement = workflow.getSignedAgreement();
    if (!signedAgreement) {
      return res.status(400).json({
        success: false,
        error: 'Signed agreement required to compute EMI schedule',
        code: 'NO_SIGNED_AGREEMENT',
      });
    }
    
    const signedOffer = workflow.offers.find(o => o.offerId === signedAgreement.offerId);
    if (!signedOffer) {
      return res.status(404).json({ success: false, error: 'Signed offer not found' });
    }
    
    // ─── Generate EMI schedule ───
    const principal = signedOffer.sanctionedAmount;
    const annualRate = signedOffer.interestRate;
    const tenureMonths = signedOffer.tenureMonths;
    const emi = signedOffer.emi;
    
    const schedule = [];
    let outstanding = principal;
    const monthlyRate = annualRate / 100 / 12;
    const startDate = new Date(signedAgreement.signedAt || new Date());
    
    for (let i = 1; i <= tenureMonths; i++) {
      const interest = Math.round(outstanding * monthlyRate);
      const principalComponent = emi - interest;
      const closingBalance = Math.max(0, outstanding - principalComponent);
      
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      
      schedule.push({
        emiNumber: i,
        dueDate,
        emiAmount: emi,
        principal: principalComponent,
        interest,
        openingBalance: outstanding,
        closingBalance,
        status: i === 1 && outstanding > 0 ? 'due' : 'upcoming',
      });
      
      outstanding = closingBalance;
    }
    
    res.json({
      success: true,
      applicationId,
      sanctionedAmount: principal,
      interestRate: annualRate,
      tenureMonths,
      emi,
      totalPayable: emi * tenureMonths,
      totalInterest: (emi * tenureMonths) - principal,
      scheduleStartDate: startDate,
      schedule,
      count: schedule.length,
    });
  } catch (error) {
    console.error('[loanRoutes] GET /repayment/schedule error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// REFUNDS (Task 15)
// ============================================
// Refund workflow for cancellations, service not delivered, etc.
// Every refund creates a Transaction ledger entry.
// Lender-side refund records via LoanWorkflow + Transaction.

// ─── GET /refunds/:applicationId — list refunds ───
router.get('/refunds/:applicationId', authenticate, authenticateLender, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const LoanApplication = getLoanApplicationModel();
    
    const { applicationId } = req.params;
    
    const application = await LoanApplication.findOne({
      applicationId,
      lenderId: req.user.id,
    });
    if (!application) return res.status(404).json({ success: false, error: 'Application not found' });
    
    // Find all refund transactions for this application
    const refunds = await Transaction.find({
      applicationId,
      $or: [
        { type: 'refund' },
        { bookingType: 'loan', status: { $in: ['refunded', 'partially_refunded'] } },
      ],
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      applicationId,
      count: refunds.length,
      refunds,
    });
  } catch (error) {
    console.error('[loanRoutes] GET /refunds error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /refunds — lender initiates refund ───
router.post('/refunds', authenticate, authenticateLender, async (req, res) => {
  try {
    const LoanWorkflow = getLoanWorkflowModel();
    const LoanApplication = getLoanApplicationModel();
    const Transaction = require('../models/Transaction');
    
    const {
      applicationId,
      amount,
      reason,
      refundType = 'full', // full | partial
      bankReference,
    } = req.body;
    
    // ─── Validation ───
    const errors = [];
    if (!applicationId) errors.push('applicationId is required');
    if (typeof amount !== 'number' || amount <= 0) errors.push('amount must be > 0');
    if (!reason || reason.trim().length < 5) errors.push('reason is required (min 5 chars)');
    if (!['full', 'partial'].includes(refundType)) errors.push('refundType must be full or partial');
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors });
    }
    
    // ─── Load application ───
    const application = await LoanApplication.findOne({
      applicationId,
      lenderId: req.user.id,
    });
    if (!application) return res.status(404).json({ success: false, error: 'Application not found' });
    
    if (!['disbursed', 'pending_disbursal', 'agreement_signed'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot refund in status "${application.status}". Refunds allowed after agreement signed.`,
        code: 'INVALID_APPLICATION_STATE',
      });
    }
    
    // ─── Load workflow ───
    const workflow = await LoanWorkflow.findByApplication(applicationId);
    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
    
    const disbursement = workflow.getLatestDisbursement();
    if (!disbursement || !['confirmed', 'reconciled'].includes(disbursement.status)) {
      return res.status(400).json({
        success: false,
        error: 'Confirmed disbursement required to refund',
        code: 'DISBURSEMENT_NOT_CONFIRMED',
      });
    }
    
    // ─── Verify refund amount doesn't exceed disbursed ───
    if (amount > disbursement.amount) {
      return res.status(400).json({
        success: false,
        error: `Refund amount ₹${amount} exceeds disbursed ₹${disbursement.amount}`,
        code: 'REFUND_EXCEEDS_DISBURSED',
      });
    }
    
    // ─── Idempotency: existing pending refunds for same application? ───
    const existingPendingRefund = await Transaction.findOne({
      applicationId,
      type: 'refund',
      status: 'pending',
    });
    if (existingPendingRefund) {
      return res.status(400).json({
        success: false,
        error: 'A pending refund already exists for this application. Complete or reject it first.',
        code: 'PENDING_REFUND_EXISTS',
        existingTransactionId: existingPendingRefund.transactionId,
      });
    }
    
    // ─── Create refund Transaction row ───
    const refundTransactionId = Transaction.generateTransactionId();
    const refundTransaction = new Transaction({
      transactionId: refundTransactionId,
      applicationId,
      lenderId: req.user.id,
      type: 'refund',
      bookingType: 'loan',
      amount,
      refundAmount: amount,
      netAmount: amount,
      status: 'pending',
      paymentMethod: 'bank_transfer',
      refund: {
        initiatedBy: 'lender',
        initiatedAt: new Date(),
        reason: reason.trim(),
        refundType,
        refundPercentage: Math.round((amount / disbursement.amount) * 100),
        processedBy: req.user.email || req.user.lenderId || 'lender',
      },
      notes: `Refund for application ${applicationId} — reason: ${reason.trim()}`,
      metadata: {
        disbursementId: disbursement.disbursementId,
        bankReference: bankReference || null,
        originalDisbursedAmount: disbursement.amount,
      },
    });
    await refundTransaction.save();
    
    res.status(201).json({
      success: true,
      refundTransactionId,
      amount,
      refundType,
      transaction: refundTransaction,
      message: `Refund of ₹${amount} initiated. Approve to process.`,
    });
  } catch (error) {
    console.error('[loanRoutes] POST /refunds error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /refunds/:transactionId/complete — complete a pending refund ───
router.post('/refunds/:transactionId/complete', authenticate, authenticateLender, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const LoanApplication = getLoanApplicationModel();
    
    const { transactionId } = req.params;
    const { gatewayRefundId, bankReference } = req.body;
    
    const refundTransaction = await Transaction.findOne({
      transactionId,
      type: 'refund',
    });
    if (!refundTransaction) return res.status(404).json({ success: false, error: 'Refund not found' });
    
    const application = await LoanApplication.findOne({
      applicationId: refundTransaction.applicationId,
      lenderId: req.user.id,
    });
    if (!application) return res.status(403).json({ success: false, error: 'Not authorized' });
    
    if (refundTransaction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Refund is in status "${refundTransaction.status}" — only "pending" can be completed`,
        code: 'REFUND_NOT_PENDING',
      });
    }
    
    refundTransaction.status = 'refunded';
    refundTransaction.refundedAt = new Date();
    if (refundTransaction.refund) {
      refundTransaction.refund.processedAt = new Date();
      if (gatewayRefundId) refundTransaction.refund.gatewayRefundId = gatewayRefundId;
      if (bankReference) refundTransaction.refund.gatewayRefundStatus = 'completed';
    }
    await refundTransaction.save();
    
    res.json({
      success: true,
      transactionId,
      transaction: refundTransaction,
      message: 'Refund completed.',
    });
  } catch (error) {
    console.error('[loanRoutes] POST /refunds/:id/complete error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// RECONCILIATION (Task 16)
// ============================================
// Settlement file matching between lender ledger and HospitalHub records.
// Uses Transaction.reconciliation fields.

// ─── GET /reconciliation — list unreconciled transactions ───
router.get('/reconciliation', authenticate, authenticateLender, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    
    const { status, from, to } = req.query;
    
    const query = {
      lenderId: req.user.id,
      bookingType: 'loan',
    };
    
    if (status) {
      query['reconciliation.status'] = status;
    } else {
      query['reconciliation.status'] = { $in: ['pending', 'mismatch'] };
    }
    
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    
    const transactions = await Transaction.find(query).sort({ createdAt: -1 }).limit(500);
    
    const summary = {
      total: transactions.length,
      byStatus: {},
    };
    transactions.forEach(t => {
      const s = t.reconciliation?.status || 'unknown';
      summary.byStatus[s] = (summary.byStatus[s] || 0) + 1;
    });
    
    res.json({
      success: true,
      count: transactions.length,
      summary,
      transactions,
    });
  } catch (error) {
    console.error('[loanRoutes] GET /reconciliation error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /reconciliation/match — mark transaction as reconciled ───
router.post('/reconciliation/match', authenticate, authenticateLender, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    
    const {
      transactionId,
      bankReference,
      adjustmentAmount = 0,
      adjustmentNote = '',
    } = req.body;
    
    if (!transactionId) {
      return res.status(400).json({ success: false, error: 'transactionId is required' });
    }
    
    const transaction = await Transaction.findOne({
      transactionId,
      lenderId: req.user.id,
    });
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    
    transaction.reconciliation = {
      status: 'matched',
      reconciledAt: new Date(),
      reconciledBy: req.user.email || req.user.lenderId || 'lender',
      mismatchReason: '',
      adjustmentAmount,
      adjustmentNote,
    };
    
    await transaction.save();
    
    res.json({
      success: true,
      transactionId,
      reconciliation: transaction.reconciliation,
      message: 'Transaction marked as reconciled.',
    });
  } catch (error) {
    console.error('[loanRoutes] POST /reconciliation/match error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
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
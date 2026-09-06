const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const InsuranceCompany = require('../models/InsuranceCompany');
const InsurancePlan = require('../models/InsurancePlan');
const InsurancePolicy = require('../models/InsurancePolicy');
const InsuranceClaim = require('../models/InsuranceClaim');
const Transaction = require('../models/Transaction');
const { authenticate: auth } = require('../middleware/auth');

// ============================================
// MIDDLEWARE - Check if user is an insurer
// ============================================

const checkInsurer = async (req, res, next) => {
  try {
    let company = await InsuranceCompany.findOne({ userId: req.user.id, isActive: true });
    if (!company && req.user.email) {
      company = await InsuranceCompany.findOne({ email: req.user.email, isActive: true });
      if (company && !company.userId) {
        company.userId = req.user.id;
        await company.save();
      }
    }
    
    if (!company) {
      return res.status(403).json({
        success: false,
        message: 'Insurance company access required'
      });
    }
    
    req.insuranceCompany = company;
    next();
  } catch (error) {
    console.error('Insurer check error:', error);
    res.status(500).json({
      success: false,
      message: 'Authorization error'
    });
  }
};

// ============================================
// INSURANCE COMPANY AUTHENTICATION
// ============================================

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    const User = require('../models/User');
    const user = await User.findOne({ email }).select('+password');
    if (!user || user.role !== 'insurance_company') return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const company = await InsuranceCompany.findOne({ userId: user._id });
    if (!company) return res.status(403).json({ success: false, message: 'Insurance company profile not found' });
    if (!company.isActive || company.status === 'suspended' || company.status === 'inactive') return res.status(403).json({ success: false, message: 'Insurance company account is not active' });

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ success: false, message: 'JWT_SECRET is not configured' });
    const token = jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role }, company: { id: company._id, name: company.companyName, status: company.status, isVerified: company.isVerified } });
  } catch (error) {
    console.error('Insurance company login error:', error);
    res.status(500).json({ success: false, message: 'Unable to login' });
  }
});

router.get('/auth/verify', auth, checkInsurer, async (req, res) => {
  res.json({
    success: true,
    authenticated: true,
    user: { id: req.user.id, role: req.user.role },
    company: { id: req.insuranceCompany._id, name: req.insuranceCompany.companyName, status: req.insuranceCompany.status, isVerified: req.insuranceCompany.isVerified }
  });
});

router.post('/logout', auth, async (req, res) => {
  // JWTs are stateless; the client removes its token. Keep this endpoint for portal consistency.
  res.json({ success: true, message: 'Logged out successfully' });
});

// ============================================
// DASHBOARD
// ============================================

// Get insurer dashboard stats
router.get('/dashboard', auth, checkInsurer, async (req, res) => {
  try {
    const company = req.insuranceCompany;
    const companyId = req.user.id;

    // Get all plans
    const plans = await InsurancePlan.find({ companyId });
    const activePlans = plans.filter(p => p.isActive);

    // Get all policies
    const policies = await InsurancePolicy.find({ companyId });
    const activePolicies = policies.filter(p => p.status === 'active');
    const pendingPolicies = policies.filter(p => p.status === 'pending');

    // Get claims
    const claims = await InsuranceClaim.find({ companyId });
    const pendingClaims = claims.filter(c => c.status === 'under_review' || c.status === 'submitted');
    const approvedClaims = claims.filter(c => c.status === 'approved');
    const settledClaims = claims.filter(c => c.status === 'settled');

    // Get transactions
    const transactions = await Transaction.find({ 
      insurancePolicyId: { $in: policies.map(p => p._id) },
      status: 'completed'
    });

    const totalPremium = transactions.reduce((sum, t) => sum + (t.premiumAmount || 0), 0);
    const totalCommission = transactions.reduce((sum, t) => sum + (t.insurancePlatformCommission || 0), 0);
    const totalPayout = transactions.reduce((sum, t) => sum + (t.insurancePayoutToCompany || 0), 0);

    // Monthly data (last 12 months)
    const monthlyData = await Transaction.aggregate([
      {
        $match: {
          insurancePolicyId: { $in: policies.map(p => p._id) },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          premium: { $sum: '$premiumAmount' },
          commission: { $sum: '$insurancePlatformCommission' },
          payout: { $sum: '$insurancePayoutToCompany' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalPlans: plans.length,
          activePlans: activePlans.length,
          totalPolicies: policies.length,
          activePolicies: activePolicies.length,
          pendingPolicies: pendingPolicies.length,
          totalClaims: claims.length,
          pendingClaims: pendingClaims.length,
          approvedClaims: approvedClaims.length,
          settledClaims: settledClaims.length,
          totalPremium,
          totalCommission,
          totalPayout
        },
        monthlyData,
        recentPolicies: policies.slice(0, 5).map(p => ({ ...p.toObject(), customerName: p.primaryInsured?.name || '', planName: p.policyName, premium: p.premiumAmount })),
        recentClaims: claims.slice(0, 5).map(c => ({ ...c.toObject(), claimId: c.claimNumber || c.claimId, policyNumber: c.policyNumber, date: c.createdAt })),
        company: {
          id: company._id,
          name: company.companyName,
          status: company.status,
          isVerified: company.isVerified
        }
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
});

// ============================================
// PLAN MANAGEMENT
// ============================================

// Get all plans
router.get('/plans', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { companyId };
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;

    const skip = (page - 1) * limit;
    const plans = await InsurancePlan.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await InsurancePlan.countDocuments(query);

    res.json({
      success: true,
      data: plans,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Plans fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plans'
    });
  }
});

// Create new plan
router.post('/plans', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const planData = req.body;

    // Validate company is verified
    if (!req.insuranceCompany.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Company must be verified to create plans'
      });
    }

    // Create plan
    const plan = new InsurancePlan({
      ...planData,
      companyId,
      createdBy: req.user.id,
      isVerified: req.insuranceCompany.autoApprovePlans || false,
      verificationDate: req.insuranceCompany.autoApprovePlans ? new Date() : null
    });

    await plan.save();

    // Update company plan count
    await InsuranceCompany.findByIdAndUpdate(companyId, {
      $inc: { totalPlans: 1 }
    });

    res.json({
      success: true,
      message: 'Plan created successfully',
      data: plan
    });

  } catch (error) {
    console.error('Plan creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create plan: ' + error.message
    });
  }
});

// Update plan
router.put('/plans/:id', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const planId = req.params.id;

    const plan = await InsurancePlan.findOne({ _id: planId, companyId });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    const updatedPlan = await InsurancePlan.findByIdAndUpdate(
      planId,
      {
        ...req.body,
        updatedBy: req.user.id,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Plan updated successfully',
      data: updatedPlan
    });

  } catch (error) {
    console.error('Plan update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update plan: ' + error.message
    });
  }
});

// Delete plan (soft delete)
router.delete('/plans/:id', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const planId = req.params.id;

    const plan = await InsurancePlan.findOne({ _id: planId, companyId });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    // Check if plan has active policies
    const activePolicies = await InsurancePolicy.countDocuments({
      planId,
      status: 'active'
    });

    if (activePolicies > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete plan with active policies. Deactivate it instead.'
      });
    }

    plan.isActive = false;
    plan.updatedBy = req.user.id;
    plan.updatedAt = new Date();
    await plan.save();

    res.json({
      success: true,
      message: 'Plan deactivated successfully'
    });

  } catch (error) {
    console.error('Plan deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete plan'
    });
  }
});

// ============================================
// POLICY MANAGEMENT
// ============================================

// Get all policies
router.get('/policies', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;

    const query = { companyId };
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const policies = await InsurancePolicy.find(query)
      .populate('planId', 'planName planType')
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await InsurancePolicy.countDocuments(query);

    res.json({
      success: true,
      data: policies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Policies fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policies'
    });
  }
});

// Get policy details
router.get('/policies/:id', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const policyId = req.params.id;

    const policy = await InsurancePolicy.findOne({ _id: policyId, companyId })
      .populate('planId')
      .populate('userId', 'name email phone address');

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
    }

    res.json({
      success: true,
      data: policy
    });

  } catch (error) {
    console.error('Policy details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policy details'
    });
  }
});

// ============================================
// CLAIM MANAGEMENT
// ============================================

// Get all claims
router.get('/claims', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { companyId };
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const claims = await InsuranceClaim.find(query)
      .populate('policyId', 'policyNumber planName')
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await InsuranceClaim.countDocuments(query);

    res.json({
      success: true,
      data: claims,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Claims fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claims'
    });
  }
});

// Get claim details
router.get('/claims/:id', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const claimId = req.params.id;

    const claim = await InsuranceClaim.findOne({ _id: claimId, companyId })
      .populate('policyId')
      .populate('userId', 'name email phone address');

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    res.json({
      success: true,
      data: claim
    });

  } catch (error) {
    console.error('Claim details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claim details'
    });
  }
});

// Update claim status
router.put('/claims/:id/status', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const claimId = req.params.id;
    const { status, note, amount } = req.body;
    const allowedStatuses = ['submitted', 'document_uploaded', 'under_review', 'pending_verification', 'approved', 'rejected', 'settled', 'partially_settled', 'cancelled'];
    if (!allowedStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid claim status' });

    const claim = await InsuranceClaim.findOne({ _id: claimId, companyId });
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    const policy = await InsurancePolicy.findById(claim.policyId);
    const numericAmount = amount == null ? null : Number(amount);
    if (numericAmount != null && (!Number.isFinite(numericAmount) || numericAmount < 0)) return res.status(400).json({ success: false, message: 'Invalid amount' });
    if (numericAmount != null && policy && numericAmount > policy.sumInsured) return res.status(400).json({ success: false, message: 'Amount exceeds policy sum insured' });
    // Update status
    claim.status = status;
    claim.updatedAt = new Date();

    if (status === 'approved') {
      claim.approvedAmount = numericAmount ?? claim.amount;
      claim.approvedBy = req.user.id;
      claim.approvedAt = new Date();
    }

    if (status === 'rejected') {
      claim.rejectedReason = note || 'Claim rejected';
      claim.rejectedAt = new Date();
    }

    if (status === 'settled' || status === 'partially_settled') {
      claim.settlementAmount = numericAmount ?? claim.approvedAmount ?? claim.amount;
      if (status === 'partially_settled' && claim.settlementAmount >= claim.amount) return res.status(400).json({ success: false, message: 'Partial settlement must be less than claim amount' });
      claim.settlementDate = new Date();
      claim.settlementReference = `SETTLE_${Date.now()}`;
    }

    await claim.save();

    // Add timeline entry
    await claim.addTimeline(status, note || `Status updated to ${status}`, req.user.id);

    res.json({
      success: true,
      message: 'Claim status updated successfully',
      data: claim
    });

  } catch (error) {
    console.error('Claim status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update claim status'
    });
  }
});

// ============================================
// SETTLEMENT MANAGEMENT
// ============================================

// Get settlements
router.get('/settlements', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { 
      providerId: companyId,
      bookingType: 'insurance',
      insuranceSettlementStatus: status === 'paid' ? 'completed' : { $ne: 'completed' }
    };

    const transactions = await Transaction.find(query)
      .populate('bookingId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Settlements fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settlements'
    });
  }
});

// ============================================
// PROFILE MANAGEMENT
// ============================================

// Get company profile
router.get('/profile', auth, checkInsurer, async (req, res) => {
  try {
    const company = await InsuranceCompany.findById(req.insuranceCompany._id)
      .select('-apiConfig.apiSecret');

    res.json({
      success: true,
      data: company
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// Update company profile
router.put('/profile', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const updateData = req.body;

    // Remove sensitive fields
    delete updateData.apiConfig?.apiSecret;

    const updatedCompany = await InsuranceCompany.findByIdAndUpdate(
      companyId,
      {
        ...updateData,
        updatedAt: new Date(),
        updatedBy: req.user.id
      },
      { new: true, runValidators: true }
    ).select('-apiConfig.apiSecret');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedCompany
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// ============================================
// REPORTS
// ============================================

// Get sales report
router.get('/reports/sales', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const { startDate, endDate } = req.query;

    const match = {
      providerId: companyId,
      bookingType: 'insurance',
      status: 'completed'
    };

    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const report = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalPolicies: { $sum: 1 },
          totalPremium: { $sum: '$premiumAmount' },
          totalCommission: { $sum: '$insurancePlatformCommission' },
          totalPayout: { $sum: '$insurancePayoutToCompany' },
          averagePremium: { $avg: '$premiumAmount' }
        }
      }
    ]);

    // Get policy type breakdown
    const typeBreakdown = await InsurancePolicy.aggregate([
      { $match: { companyId } },
      {
        $group: {
          _id: '$policyType',
          count: { $sum: 1 },
          premium: { $sum: '$premiumAmount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: report[0] || {
          totalPolicies: 0,
          totalPremium: 0,
          totalCommission: 0,
          totalPayout: 0,
          averagePremium: 0
        },
        typeBreakdown
      }
    });

  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate sales report'
    });
  }
});

module.exports = router;
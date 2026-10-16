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
// HELPER — escape user input for use in regex
// ============================================
const escapeRegex = (str) => String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  res.json({ success: true, message: 'Logged out successfully' });
});


// Alias for frontend
router.get('/stats', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const [plans, policies, claims, transactions] = await Promise.all([
      InsurancePlan.find({ companyId }),
      InsurancePolicy.find({ companyId }),
      InsuranceClaim.find({ companyId }),
      Transaction.find({ providerId: companyId, status: 'completed' }),
    ]);

    const totalPremium = transactions.reduce((s, t) => s + (t.premiumAmount || 0), 0);
    const totalCommission = transactions.reduce((s, t) => s + (t.insurancePlatformCommission || 0), 0);
    const totalPayout = transactions.reduce((s, t) => s + (t.insurancePayoutToCompany || 0), 0);

    res.json({
      success: true,
      data: {
        stats: {
          totalPlans: plans.length,
          activePlans: plans.filter(p => p.isActive).length,
          totalPolicies: policies.length,
          activePolicies: policies.filter(p => p.status === 'active').length,
          pendingPolicies: policies.filter(p => p.status === 'pending').length,
          totalClaims: claims.length,
          pendingClaims: claims.filter(c => ['submitted', 'under_review'].includes(c.status)).length,
          approvedClaims: claims.filter(c => c.status === 'approved').length,
          settledClaims: claims.filter(c => c.status === 'settled').length,
          totalPremium,
          totalCommission,
          totalPayout,
        },
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// ============================================
// DASHBOARD
// ============================================

router.get('/dashboard', auth, checkInsurer, async (req, res) => {
  try {
    const company = req.insuranceCompany;
    const companyId = req.user.id;

    const plans = await InsurancePlan.find({ companyId });
    const activePlans = plans.filter(p => p.isActive);

    const policies = await InsurancePolicy.find({ companyId });
    const activePolicies = policies.filter(p => p.status === 'active');
    const pendingPolicies = policies.filter(p => p.status === 'pending');

    const claims = await InsuranceClaim.find({ companyId });
    const pendingClaims = claims.filter(c => c.status === 'under_review' || c.status === 'submitted');
    const approvedClaims = claims.filter(c => c.status === 'approved');
    const settledClaims = claims.filter(c => c.status === 'settled');

    const transactions = await Transaction.find({ 
      insurancePolicyId: { $in: policies.map(p => p._id) },
      status: 'completed'
    });

    const totalPremium = transactions.reduce((sum, t) => sum + (t.premiumAmount || 0), 0);
    const totalCommission = transactions.reduce((sum, t) => sum + (t.insurancePlatformCommission || 0), 0);
    const totalPayout = transactions.reduce((sum, t) => sum + (t.insurancePayoutToCompany || 0), 0);

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

router.post('/plans', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const planData = req.body;

    if (!req.insuranceCompany.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Company must be verified to create plans'
      });
    }

    if (!planData.cancellationPolicy || !planData.cancellationPolicy.afterFreeLook || !planData.cancellationPolicy.afterFreeLook.refundType) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation policy is required. Please set afterFreeLook.refundType (pro_rata / slab / none).'
      });
    }

    const cp = planData.cancellationPolicy;
    if (cp.freeLookDays && cp.freeLookDays < 15) {
      return res.status(400).json({
        success: false,
        message: 'Free-look period must be at least 15 days (IRDAI mandate).'
      });
    }

    if (cp.afterFreeLook.refundType === 'slab' && (!cp.afterFreeLook.slabs || cp.afterFreeLook.slabs.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Slab refund type requires at least one slab.'
      });
    }

    const plan = new InsurancePlan({
      ...planData,
      companyId,
      createdBy: req.user.id,
      isVerified: req.insuranceCompany.autoApprovePlans || false,
      verificationDate: req.insuranceCompany.autoApprovePlans ? new Date() : null
    });

    await plan.save();

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

// Get all policies (with search + filters + server-side pagination)
router.get('/policies', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const {
      status,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const query = { companyId };

    if (status && status !== 'all') query.status = status;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Search across policyNumber, planName, and customer name/email/phone
    if (search && String(search).trim()) {
      const safe = escapeRegex(search.trim());
      const rx = new RegExp(safe, 'i');

      // Find matching user IDs first (customer search)
      const User = require('../models/User');
      const matchingUsers = await User.find({
        $or: [{ name: rx }, { email: rx }, { phone: rx }],
      }).select('_id').limit(500).lean();
      const userIds = matchingUsers.map(u => u._id);

      query.$or = [
        { policyNumber: rx },
        { policyName: rx },
        { planName: rx },
        { userId: { $in: userIds } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [policies, total] = await Promise.all([
      InsurancePolicy.find(query)
        .populate('planId', 'planName planType')
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      InsurancePolicy.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: policies,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });

  } catch (error) {
    console.error('Policies fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policies'
    });
  }
});

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

// Get all claims (with search + date range + pagination)
router.get('/claims', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const {
      status,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const query = { companyId };

    if (status && status !== 'all') query.status = status;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search && String(search).trim()) {
      const safe = escapeRegex(search.trim());
      const rx = new RegExp(safe, 'i');

      const User = require('../models/User');
      const matchingUsers = await User.find({
        $or: [{ name: rx }, { email: rx }, { phone: rx }],
      }).select('_id').limit(500).lean();
      const userIds = matchingUsers.map(u => u._id);

      query.$or = [
        { claimNumber: rx },
        { claimId: rx },
        { policyNumber: rx },
        { userId: { $in: userIds } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [claims, total] = await Promise.all([
      InsuranceClaim.find(query)
        .populate('policyId', 'policyNumber planName')
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      InsuranceClaim.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: claims,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });

  } catch (error) {
    console.error('Claims fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claims'
    });
  }
});

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

    const prevStatus = claim.status;

    const policy = await InsurancePolicy.findById(claim.policyId);
    const numericAmount = amount == null ? null : Number(amount);
    if (numericAmount != null && (!Number.isFinite(numericAmount) || numericAmount < 0)) return res.status(400).json({ success: false, message: 'Invalid amount' });
    if (numericAmount != null && policy && numericAmount > policy.sumInsured) return res.status(400).json({ success: false, message: 'Amount exceeds policy sum insured' });

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

    await claim.addTimeline(status, note || `Status updated to ${status}`, req.user.id);

    try {
      if (prevStatus !== status) {
        const patient = await require('../models/User').findById(claim.userId);
        const statusLabels = {
          under_review: 'Under Review',
          pending_verification: 'Pending Verification',
          approved: 'Approved',
          rejected: 'Rejected',
          settled: 'Settled',
          partially_settled: 'Partially Settled',
        };
        const statusLabel = statusLabels[status] || status;

        if (patient?.email) {
          await require('../services/notificationService').sendEmail(
            patient.email,
            `Claim ${claim.claimNumber} — ${statusLabel}`,
            `<p>Your insurance claim status has been updated.</p>
             <ul>
               <li><strong>Claim Number:</strong> ${claim.claimNumber}</li>
               <li><strong>Status:</strong> ${statusLabel}</li>
               ${note ? `<li><strong>Note:</strong> ${note}</li>` : ''}
               ${amount ? `<li><strong>Amount:</strong> ₹${amount}</li>` : ''}
             </ul>
             <p>Log in to your policy dashboard for details.</p>`
          );
        }
        if (patient?.phone) {
          await require('../services/notificationService').sendSMS(
            patient.phone,
            `Claim ${claim.claimNumber}: ${statusLabel}. ${note ? note + '. ' : ''}Login to view details.`
          );
        }
      }
    } catch (notifyErr) {
      console.error('[claim-status] patient notify failed:', notifyErr.message);
    }

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

// Get settlements (with date range + pagination)
router.get('/settlements', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const {
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {
      providerId: companyId,
      bookingType: 'insurance',
      insuranceSettlementStatus: status === 'paid' ? 'completed' : { $ne: 'completed' },
    };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('bookingId')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Transaction.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
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

router.put('/profile', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const updateData = req.body;

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

// ============================================
// RENEWALS — expiring policies + follow-up
// ============================================
router.get('/renewals', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.user.id;
    const { days = 30 } = req.query;

    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + parseInt(days));

    const expiringPolicies = await InsurancePolicy.find({
      companyId,
      status: 'active',
      endDate: { $gte: now, $lte: threshold },
    })
      .populate('planId', 'planName')
      .populate('userId', 'name email phone')
      .sort({ endDate: 1 })
      .lean();

    const expiredPolicies = await InsurancePolicy.find({
      companyId,
      status: 'active',
      endDate: { $lt: now },
    })
      .populate('planId', 'planName')
      .populate('userId', 'name email phone')
      .sort({ endDate: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      data: {
        expiring: expiringPolicies,
        expired: expiredPolicies,
        counts: {
          expiring: expiringPolicies.length,
          expired: expiredPolicies.length,
        },
      },
    });
  } catch (error) {
    console.error('Renewals fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch renewals' });
  }
});

// ============================================
// NETWORK HOSPITALS — cashless network management
// ============================================
router.get('/network-hospitals', auth, checkInsurer, async (req, res) => {
  try {
    const company = await InsuranceCompany.findOne({ userId: req.user.id });
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    res.json({
      success: true,
      data: company.networkHospitals || [],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch network hospitals' });
  }
});

router.post('/network-hospitals', auth, checkInsurer, async (req, res) => {
  try {
    const { hospitalName, address, city, state, pincode, specialty, cashless } = req.body;
    if (!hospitalName || !city) {
      return res.status(400).json({ success: false, message: 'hospitalName and city required' });
    }

    const company = await InsuranceCompany.findOne({ userId: req.user.id });
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    company.networkHospitals = company.networkHospitals || [];
    company.networkHospitals.push({
      hospitalName,
      address: address || '',
      city,
      state: state || '',
      pincode: pincode || '',
      specialty: specialty || '',
      cashless: cashless !== false,
      addedAt: new Date(),
    });
    await company.save();

    res.json({ success: true, data: company.networkHospitals });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add hospital' });
  }
});

router.delete('/network-hospitals/:index', auth, checkInsurer, async (req, res) => {
  try {
    const company = await InsuranceCompany.findOne({ userId: req.user.id });
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const idx = parseInt(req.params.index);
    if (!company.networkHospitals || idx < 0 || idx >= company.networkHospitals.length) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    company.networkHospitals.splice(idx, 1);
    await company.save();

    res.json({ success: true, data: company.networkHospitals });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to remove hospital' });
  }
});

// ============================================
// SUSPENDED STATUS
// ============================================
router.get('/suspended-status', auth, checkInsurer, async (req, res) => {
  try {
    const company = await InsuranceCompany.findOne({ userId: req.user.id })
      .select('verificationStatus status suspendedReason suspendedAt suspendedUntil isActive');

    const isSuspended = company.verificationStatus === 'suspended' || company.status === 'suspended';

    res.json({
      success: true,
      data: {
        isSuspended,
        reason: company.suspendedReason || null,
        suspendedAt: company.suspendedAt || null,
        suspendedUntil: company.suspendedUntil || null,
        verificationStatus: company.verificationStatus || company.status,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch status' });
  }
});

// ============================================
// KYC UPDATE (post-onboarding)
// ============================================
router.post('/kyc/update', auth, checkInsurer, async (req, res) => {
  try {
    const { irdaCertificate, gstCertificate, panCard, bankProof, registrationCertificate, panNumber, gstNumber } = req.body;

    const company = await InsuranceCompany.findById(req.insuranceCompany._id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    company.documents = company.documents || {};
    if (irdaCertificate) company.documents.irdaCertificate = irdaCertificate;
    if (gstCertificate) company.documents.gstCertificate = gstCertificate;
    if (panCard) company.documents.panCard = panCard;
    if (bankProof) company.documents.bankProof = bankProof;
    if (registrationCertificate) company.documents.registrationCertificate = registrationCertificate;
    if (panNumber) company.documents.panNumber = panNumber;
    if (gstNumber) company.documents.gstNumber = gstNumber;

    company.documents.kycStatus = 'submitted';
    company.documents.submittedAt = new Date();
    company.verificationStatus = 'pending';

    await company.save();

    res.json({ success: true, message: 'KYC updated. Awaiting admin verification.' });
  } catch (error) {
    console.error('KYC update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update KYC' });
  }
});

// Renew a policy
router.post('/policies/:id/renew', auth, checkInsurer, async (req, res) => {
  try {
    const policy = await InsurancePolicy.findOne({ _id: req.params.id, companyId: req.user.id });
    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found' });
    const { newEndDate } = req.body;
    policy.previousEndDate = policy.endDate;
    policy.endDate = newEndDate ? new Date(newEndDate) : new Date(new Date(policy.endDate).setFullYear(new Date(policy.endDate).getFullYear() + 1));
    policy.status = 'active';
    policy.lastRenewedAt = new Date();
    await policy.save();
    res.json({ success: true, data: policy });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Cancel a policy
router.post('/policies/:id/cancel', auth, checkInsurer, async (req, res) => {
  try {
    const policy = await InsurancePolicy.findOne({ _id: req.params.id, companyId: req.user.id });
    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found' });
    policy.status = 'cancelled';
    policy.cancelledAt = new Date();
    policy.cancellationReason = req.body.reason || 'Cancelled by insurer';
    await policy.save();
    res.json({ success: true, data: policy });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Send renewal reminder
router.post('/policies/:id/send-renewal-reminder', auth, checkInsurer, async (req, res) => {
  try {
    const policy = await InsurancePolicy.findOne({ _id: req.params.id, companyId: req.user.id })
      .populate('userId', 'name email phone');
    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found' });

    const { customerPhone, customerEmail, policyNumber, expiryDate } = req.body;
    const notif = require('../services/notificationService');

    if (customerEmail) {
      await notif.sendEmail(customerEmail,
        `Your policy ${policyNumber} is up for renewal`,
        `<p>Hi ${policy.userId?.name || 'Customer'},</p>
         <p>Your policy <strong>${policyNumber}</strong> expires on <strong>${new Date(expiryDate).toLocaleDateString()}</strong>.</p>
         <p>Renew now to continue uninterrupted coverage.</p>`
      );
    }
    if (customerPhone) {
      await notif.sendSMS(customerPhone,
        `Your policy ${policyNumber} expires on ${new Date(expiryDate).toLocaleDateString()}. Renew now.`
      );
    }
    policy.lastReminderSentAt = new Date();
    policy.reminderCount = (policy.reminderCount || 0) + 1;
    await policy.save();
    res.json({ success: true, message: 'Reminder sent' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ============================================
// BULK POLICY OPERATIONS
// ============================================

// Renew a policy
router.post('/policies/:id/renew', auth, checkInsurer, async (req, res) => {
  try {
    const policy = await InsurancePolicy.findOne({ _id: req.params.id, companyId: req.user.id });
    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found' });
    const { newEndDate } = req.body;
    policy.previousEndDate = policy.endDate;
    policy.endDate = newEndDate
      ? new Date(newEndDate)
      : new Date(new Date(policy.endDate).setFullYear(new Date(policy.endDate).getFullYear() + 1));
    policy.status = 'active';
    policy.lastRenewedAt = new Date();
    await policy.save();
    res.json({ success: true, data: policy });
  } catch (e) {
    console.error('Policy renewal error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Cancel a policy
router.post('/policies/:id/cancel', auth, checkInsurer, async (req, res) => {
  try {
    const policy = await InsurancePolicy.findOne({ _id: req.params.id, companyId: req.user.id });
    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found' });
    policy.status = 'cancelled';
    policy.cancelledAt = new Date();
    policy.cancellationReason = req.body.reason || 'Cancelled by insurer';
    await policy.save();
    res.json({ success: true, data: policy });
  } catch (e) {
    console.error('Policy cancellation error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Send renewal reminder (SMS + Email)
router.post('/policies/:id/send-renewal-reminder', auth, checkInsurer, async (req, res) => {
  try {
    const policy = await InsurancePolicy.findOne({ _id: req.params.id, companyId: req.user.id })
      .populate('userId', 'name email phone');
    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found' });

    const { customerPhone, customerEmail, policyNumber, expiryDate } = req.body;
    const notif = require('../services/notificationService');

    if (customerEmail) {
      await notif.sendEmail(
        customerEmail,
        `Your policy ${policyNumber} is up for renewal`,
        `<p>Hi ${policy.userId?.name || 'Customer'},</p>
         <p>Your policy <strong>${policyNumber}</strong> expires on <strong>${new Date(expiryDate).toLocaleDateString()}</strong>.</p>
         <p>Renew now to continue uninterrupted coverage.</p>`
      );
    }
    if (customerPhone) {
      await notif.sendSMS(
        customerPhone,
        `Your policy ${policyNumber} expires on ${new Date(expiryDate).toLocaleDateString()}. Renew now to stay covered.`
      );
    }

    policy.lastReminderSentAt = new Date();
    policy.reminderCount = (policy.reminderCount || 0) + 1;
    await policy.save();

    res.json({ success: true, message: 'Reminder sent', reminderCount: policy.reminderCount });
  } catch (e) {
    console.error('Renewal reminder error:', e);
    res.status(500).json({ success: false, message: 'Failed to send reminder' });
  }
});

// ============================================
// PDF DOWNLOADS — insurer side
// ============================================

// Download policy PDF (insurer's own copy)
router.get('/policies/:id/pdf', auth, checkInsurer, async (req, res) => {
  try {
    const policy = await InsurancePolicy.findOne({
      _id: req.params.id,
      companyId: req.user.id,
    })
      .populate('planId')
      .populate('userId', 'name email phone address');

    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found' });

    const pdfService = require('../services/pdfService');
    const result = await pdfService.generatePolicyPDF({
      ...policy.toObject(),
      planName: policy.policyName,
      companyId: policy.companyId,
    });

    if (!result?.success || !result.pdf) {
      return res.status(503).json({ success: false, message: 'PDF generation failed' });
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${policy.policyNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    });
    res.send(result.pdf);
  } catch (error) {
    console.error('[insurer policy pdf]', error);
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
});

// Download claim settlement receipt
router.get('/claims/:id/settlement-receipt', auth, checkInsurer, async (req, res) => {
  try {
    const claim = await InsuranceClaim.findOne({
      _id: req.params.id,
      companyId: req.user.id,
    })
      .populate('policyId')
      .populate('userId', 'name email phone address');

    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    const pdfService = require('../services/pdfService');
    const result = await pdfService.generateSettlementReceipt({
      claim: claim.toObject(),
      policy: claim.policyId,
      customer: claim.userId,
    });

    if (!result?.success || !result.pdf) {
      return res.status(503).json({ success: false, message: 'PDF generation failed' });
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="settlement-${claim.claimNumber || claim._id}.pdf"`,
      'Cache-Control': 'private, no-store',
    });
    res.send(result.pdf);
  } catch (error) {
    console.error('[insurer claim pdf]', error);
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
});

module.exports = router;
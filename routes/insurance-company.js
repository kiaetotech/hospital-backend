const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const InsuranceCompany = require('../models/InsuranceCompany');
const InsurancePlan = require('../models/InsurancePlan');
const InsurancePolicy = require('../models/InsurancePolicy');
const InsuranceClaim = require('../models/InsuranceClaim');
const Transaction = require('../models/Transaction');
const { authenticate} = require('../middleware/auth');

// ============================================
// MIDDLEWARE - Check if user is an insurer
// ============================================

const checkInsurer = async (req, res, next) => {
  try {
    const company = await InsuranceCompany.findOne({ 
      userId.user.id,
      isActive});
    
    if (!company) {
      return res.status(403).json({
        success,
        message: 'Insurance company access required'
      });
    }
    
    req.insuranceCompany = company;
    next();
  } catch (error) {
    console.error('Insurer check error:', error);
    res.status(500).json({
      success,
      message: 'Authorization error'
    });
  }
};

// ============================================
// DASHBOARD
// ============================================

// Get insurer dashboard stats
router.get('/dashboard', auth, checkInsurer, async (req, res) => {
  try {
    const company = req.insuranceCompany;
    const companyId = company._id;

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
      insurancePolicyId: { $in.map(p => p._id) },
      status: 'completed'
    });

    const totalPremium = transactions.reduce((sum, t) => sum + (t.premiumAmount || 0), 0);
    const totalCommission = transactions.reduce((sum, t) => sum + (t.insurancePlatformCommission || 0), 0);
    const totalPayout = transactions.reduce((sum, t) => sum + (t.insurancePayoutToCompany || 0), 0);

    // Monthly data (last 12 months)
    const monthlyData = await Transaction.aggregate([
      {
        $match: {
          insurancePolicyId: { $in.map(p => p._id) },
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
      success,
      data: {
        stats: {
          totalPlans.length,
          activePlans.length,
          totalPolicies.length,
          activePolicies.length,
          pendingPolicies.length,
          totalClaims.length,
          pendingClaims.length,
          approvedClaims.length,
          settledClaims.length,
          totalPremium,
          totalCommission,
          totalPayout
        },
        monthlyData,
        recentPolicies.slice(0, 5),
        recentClaims.slice(0, 5),
        company: {
          id._id,
          name.companyName,
          status.status,
          isVerified.isVerified
        }
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success,
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
    const companyId = req.insuranceCompany._id;
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
    console.error('Plans fetch error:', error);
    res.status(500).json({
      success,
      message: 'Failed to fetch plans'
    });
  }
});

// Create new plan
router.post('/plans', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.insuranceCompany._id;
    const planData = req.body;

    // Validate company is verified
    if (!req.insuranceCompany.isVerified) {
      return res.status(403).json({
        success,
        message: 'Company must be verified to create plans'
      });
    }

    // Create plan
    const plan = new InsurancePlan({
      ...planData,
      companyId,
      createdBy.user.id,
      isVerified.insuranceCompany.autoApprovePlans || false,
      verificationDate.insuranceCompany.autoApprovePlans ? new Date() });

    await plan.save();

    // Update company plan count
    await InsuranceCompany.findByIdAndUpdate(companyId, {
      $inc: { totalPlans: 1 }
    });

    res.json({
      success,
      message: 'Plan created successfully',
      data});

  } catch (error) {
    console.error('Plan creation error:', error);
    res.status(500).json({
      success,
      message: 'Failed to create plan: ' + error.message
    });
  }
});

// Update plan
router.put('/plans/', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.insuranceCompany._id;
    const planId = req.params.id;

    const plan = await InsurancePlan.findOne({ _id, companyId });
    if (!plan) {
      return res.status(404).json({
        success,
        message: 'Plan not found'
      });
    }

    const updatedPlan = await InsurancePlan.findByIdAndUpdate(
      planId,
      {
        ...req.body,
        updatedBy.user.id,
        updatedAtDate()
      },
      { new, runValidators}
    );

    res.json({
      success,
      message: 'Plan updated successfully',
      data});

  } catch (error) {
    console.error('Plan update error:', error);
    res.status(500).json({
      success,
      message: 'Failed to update plan: ' + error.message
    });
  }
});

// Delete plan (soft delete)
router.delete('/plans/', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.insuranceCompany._id;
    const planId = req.params.id;

    const plan = await InsurancePlan.findOne({ _id, companyId });
    if (!plan) {
      return res.status(404).json({
        success,
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
        success,
        message: 'Cannot delete plan with active policies. Deactivate it instead.'
      });
    }

    plan.isActive = false;
    plan.updatedBy = req.user.id;
    plan.updatedAt = new Date();
    await plan.save();

    res.json({
      success,
      message: 'Plan deactivated successfully'
    });

  } catch (error) {
    console.error('Plan deletion error:', error);
    res.status(500).json({
      success,
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
    const companyId = req.insuranceCompany._id;
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
    console.error('Policies fetch error:', error);
    res.status(500).json({
      success,
      message: 'Failed to fetch policies'
    });
  }
});

// Get policy details
router.get('/policies/', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.insuranceCompany._id;
    const policyId = req.params.id;

    const policy = await InsurancePolicy.findOne({ _id, companyId })
      .populate('planId')
      .populate('userId', 'name email phone address');

    if (!policy) {
      return res.status(404).json({
        success,
        message: 'Policy not found'
      });
    }

    res.json({
      success,
      data});

  } catch (error) {
    console.error('Policy details error:', error);
    res.status(500).json({
      success,
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
    const companyId = req.insuranceCompany._id;
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
router.get('/claims/', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.insuranceCompany._id;
    const claimId = req.params.id;

    const claim = await InsuranceClaim.findOne({ _id, companyId })
      .populate('policyId')
      .populate('userId', 'name email phone address');

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

// Update claim status
router.put('/claims//status', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.insuranceCompany._id;
    const claimId = req.params.id;
    const { status, note, amount } = req.body;

    const claim = await InsuranceClaim.findOne({ _id, companyId });
    if (!claim) {
      return res.status(404).json({
        success,
        message: 'Claim not found'
      });
    }

    // Update status
    claim.status = status;
    claim.updatedAt = new Date();

    if (status === 'approved') {
      claim.approvedAmount = amount || claim.amount;
      claim.approvedBy = req.user.id;
      claim.approvedAt = new Date();
    }

    if (status === 'rejected') {
      claim.rejectedReason = note || 'Claim rejected';
      claim.rejectedAt = new Date();
    }

    if (status === 'settled') {
      claim.settlementAmount = amount || claim.approvedAmount || claim.amount;
      claim.settlementDate = new Date();
      claim.settlementReference = `SETTLE_${Date.now()}`;
    }

    await claim.save();

    // Add timeline entry
    await claim.addTimeline(status, note || `Status updated to ${status}`, req.user.id);

    res.json({
      success,
      message: 'Claim status updated successfully',
      data});

  } catch (error) {
    console.error('Claim status update error:', error);
    res.status(500).json({
      success,
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
    const companyId = req.insuranceCompany._id;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { 
      companyId,
      'commissionStatus'=== 'paid' ? 'paid' : { $ne: 'paid' }
    };

    const transactions = await Transaction.find(query)
      .populate('bookingId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

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
    console.error('Settlements fetch error:', error);
    res.status(500).json({
      success,
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
      success,
      data});

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success,
      message: 'Failed to fetch profile'
    });
  }
});

// Update company profile
router.put('/profile', auth, checkInsurer, async (req, res) => {
  try {
    const companyId = req.insuranceCompany._id;
    const updateData = req.body;

    // Remove sensitive fields
    delete updateData.apiConfig?.apiSecret;

    const updatedCompany = await InsuranceCompany.findByIdAndUpdate(
      companyId,
      {
        ...updateData,
        updatedAtDate(),
        updatedBy.user.id
      },
      { new, runValidators}
    ).select('-apiConfig.apiSecret');

    res.json({
      success,
      message: 'Profile updated successfully',
      data});

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success,
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
    const companyId = req.insuranceCompany._id;
    const { startDate, endDate } = req.query;

    const match = {
      companyId,
      status: 'completed'
    };

    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const report = await Transaction.aggregate([
      { $match},
      {
        $group: {
          _id,
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
      success,
      data: {
        summary[0] || {
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
      success,
      message: 'Failed to generate sales report'
    });
  }
});

module.exports = router;


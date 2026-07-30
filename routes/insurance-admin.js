const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const InsurancePlan = require('../models/InsurancePlan');
const InsurancePolicy = require('../models/InsurancePolicy');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { authenticate: auth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// ============================================
// ADMIN MIDDLEWARE
// ============================================

const isAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Authorization error' });
  }
};

// ============================================
// INSURANCE COMPANY MANAGEMENT
// ============================================

// Get all insurance companies (including unverified)
router.get('/companies', auth, isAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = { role: 'insurance_company' };
    if (status === 'verified') query.isVerified = true;
    if (status === 'unverified') query.isVerified = false;
    
    const skip = (page - 1) * limit;
    const companies = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: companies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch companies' });
  }
});

// Verify insurance company
router.put('/companies/:id/verify', auth, isAdmin, async (req, res) => {
  try {
    const { verified, notes } = req.body;
    
    const company = await User.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    if (company.role !== 'insurance_company') {
      return res.status(400).json({ success: false, message: 'User is not an insurance company' });
    }

    company.isVerified = verified || false;
    company.kycStatus = verified ? 'verified' : 'rejected';
    if (verified) {
      company.verificationDate = new Date();
      company.verifiedBy = req.user.id;
    }
    await company.save();

    res.json({
      success: true,
      message: verified ? 'Company verified successfully' : 'Company verification rejected',
      data: company
    });
  } catch (error) {
    console.error('Error verifying company:', error);
    res.status(500).json({ success: false, message: 'Failed to verify company' });
  }
});

// Get company details
router.get('/companies/:id', auth, isAdmin, async (req, res) => {
  try {
    const company = await User.findById(req.params.id)
      .select('-password')
      .populate('companyDocuments');
    
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    if (company.role !== 'insurance_company') {
      return res.status(400).json({ success: false, message: 'User is not an insurance company' });
    }

    // Get company stats
    const planCount = await InsurancePlan.countDocuments({ companyId: company._id });
    const policyCount = await InsurancePolicy.countDocuments({ companyId: company._id });
    const activePolicies = await InsurancePolicy.countDocuments({ 
      companyId: company._id, 
      status: 'active' 
    });
    
    // Get total premium
    const policies = await InsurancePolicy.find({ companyId: company._id });
    const totalPremium = policies.reduce((sum, p) => sum + (p.premiumAmount || 0), 0);
    const totalCommission = policies.reduce((sum, p) => sum + (p.platformCommission || 0), 0);

    res.json({
      success: true,
      data: {
        ...company.toObject(),
        stats: {
          planCount,
          policyCount,
          activePolicies,
          totalPremium,
          totalCommission
        }
      }
    });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch company' });
  }
});

// ============================================
// INSURANCE PLAN MANAGEMENT
// ============================================

// Create insurance plan
router.post('/plans', auth, isAdmin, async (req, res) => {
  try {
    const planData = req.body;
    
    // Validate company exists
    const company = await User.findById(planData.companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    if (company.role !== 'insurance_company') {
      return res.status(400).json({ success: false, message: 'Company is not an insurance company' });
    }

    // Create plan
    const plan = new InsurancePlan({
      ...planData,
      createdBy: req.user.id,
      isVerified: true,
      verificationDate: new Date(),
      verifiedBy: req.user.id
    });

    await plan.save();

    res.json({
      success: true,
      message: 'Plan created successfully',
      data: plan
    });
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({ success: false, message: 'Failed to create plan: ' + error.message });
  }
});

// Update insurance plan
router.put('/plans/:id', auth, isAdmin, async (req, res) => {
  try {
    const plan = await InsurancePlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const updatedPlan = await InsurancePlan.findByIdAndUpdate(
      req.params.id,
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
    console.error('Error updating plan:', error);
    res.status(500).json({ success: false, message: 'Failed to update plan: ' + error.message });
  }
});

// Toggle plan status (activate/deactivate)
router.patch('/plans/:id/toggle-status', auth, isAdmin, async (req, res) => {
  try {
    const plan = await InsurancePlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    plan.isActive = !plan.isActive;
    plan.updatedBy = req.user.id;
    plan.updatedAt = new Date();
    await plan.save();

    res.json({
      success: true,
      message: `Plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`,
      data: plan
    });
  } catch (error) {
    console.error('Error toggling plan status:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle plan status' });
  }
});

// Delete plan (soft delete)
router.delete('/plans/:id', auth, isAdmin, async (req, res) => {
  try {
    const plan = await InsurancePlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    // Check if there are active policies for this plan
    const activePolicies = await InsurancePolicy.countDocuments({
      planId: plan._id,
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
    console.error('Error deleting plan:', error);
    res.status(500).json({ success: false, message: 'Failed to delete plan' });
  }
});

// ============================================
// POLICY MANAGEMENT (Admin)
// ============================================

// Get all policies (with filters)
router.get('/policies', auth, isAdmin, async (req, res) => {
  try {
    const { 
      status, 
      companyId, 
      planId,
      startDate,
      endDate,
      page = 1, 
      limit = 20 
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (companyId) query.companyId = companyId;
    if (planId) query.planId = planId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const policies = await InsurancePolicy.find(query)
      .populate('planId', 'planName planType')
      .populate('companyId', 'name companyName')
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
    console.error('Error fetching policies:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch policies' });
  }
});

// Get policy details (admin view)
router.get('/policies/:id', auth, isAdmin, async (req, res) => {
  try {
    const policy = await InsurancePolicy.findById(req.params.id)
      .populate('planId')
      .populate('companyId', 'name companyName companyEmail companyPhone companyAddress')
      .populate('userId', 'name email phone');

    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    // Get related booking and transaction
    const booking = await Booking.findById(policy.bookingId);
    const transaction = await Transaction.findOne({ bookingId: policy.bookingId });

    res.json({
      success: true,
      data: {
        ...policy.toObject(),
        booking,
        transaction
      }
    });
  } catch (error) {
    console.error('Error fetching policy:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch policy' });
  }
});

// ============================================
// COMMISSION & SETTLEMENT MANAGEMENT
// ============================================

// Get all pending settlements
router.get('/settlements/pending', auth, isAdmin, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      bookingType: 'insurance',
      insuranceSettlementStatus: 'pending',
      settledToProvider: false
    })
      .populate('providerId', 'name companyName')
      .populate('bookingId')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Error fetching pending settlements:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending settlements' });
  }
});

// Process settlement
router.post('/settlements/process', auth, isAdmin, async (req, res) => {
  try {
    const { transactionIds } = req.body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Transaction IDs are required'
      });
    }

    const results = [];
    for (const transactionId of transactionIds) {
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        results.push({
          id: transactionId,
          status: 'failed',
          message: 'Transaction not found'
        });
        continue;
      }

      if (transaction.insuranceSettlementStatus === 'completed') {
        results.push({
          id: transactionId,
          status: 'skipped',
          message: 'Already settled'
        });
        continue;
      }

      // Mark as completed
      await transaction.markInsuranceSettlementCompleted('SETTLE_' + Date.now());

      // Update policy
      const policy = await InsurancePolicy.findOne({ bookingId: transaction.bookingId });
      if (policy) {
        policy.settlementStatus = 'completed';
        policy.settlementDate = new Date();
        policy.settlementTransactionId = 'SETTLE_' + Date.now();
        await policy.save();
      }

      results.push({
        id: transactionId,
        status: 'success',
        message: 'Settlement processed successfully',
        amount: transaction.insurancePayoutToCompany
      });
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error processing settlements:', error);
    res.status(500).json({ success: false, message: 'Failed to process settlements' });
  }
});

// ============================================
// REPORTING
// ============================================

// Get sales report
router.get('/reports/sales', auth, isAdmin, async (req, res) => {
  try {
    const { startDate, endDate, companyId } = req.query;

    const match = {
      bookingType: 'insurance',
      status: 'completed'
    };

    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    if (companyId) match.providerId = mongoose.Types.ObjectId(companyId);

    const report = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            companyId: '$providerId',
            month: { $month: '$createdAt' },
            year: { $year: '$createdAt' }
          },
          count: { $sum: 1 },
          totalPremium: { $sum: '$totalPremium' },
          totalCommission: { $sum: '$platformCommission' },
          totalPayout: { $sum: '$providerAmount' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id.companyId',
          foreignField: '_id',
          as: 'company'
        }
      },
      { $unwind: '$company' },
      {
        $project: {
          companyName: '$company.name',
          month: '$_id.month',
          year: '$_id.year',
          count: 1,
          totalPremium: 1,
          totalCommission: 1,
          totalPayout: 1
        }
      },
      { $sort: { year: -1, month: -1 } }
    ]);

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate sales report' });
  }
});

// Get commission report
router.get('/reports/commission', auth, isAdmin, async (req, res) => {
  try {
    const { companyId, startDate, endDate } = req.query;

    const match = {
      bookingType: 'insurance',
      status: 'completed'
    };

    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    if (companyId) match.providerId = mongoose.Types.ObjectId(companyId);

    const report = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$providerId',
          totalCommission: { $sum: '$platformCommission' },
          totalPayout: { $sum: '$providerAmount' },
          totalPremium: { $sum: '$totalPremium' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'company'
        }
      },
      { $unwind: '$company' },
      {
        $project: {
          companyName: '$company.name',
          totalCommission: 1,
          totalPayout: 1,
          totalPremium: 1,
          count: 1
        }
      },
      { $sort: { totalCommission: -1 } }
    ]);

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error generating commission report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate commission report' });
  }
});

// Get policy summary report
router.get('/reports/summary', auth, isAdmin, async (req, res) => {
  try {
    const totalPolicies = await InsurancePolicy.countDocuments();
    const activePolicies = await InsurancePolicy.countDocuments({ status: 'active' });
    const expiredPolicies = await InsurancePolicy.countDocuments({ status: 'expired' });
    const cancelledPolicies = await InsurancePolicy.countDocuments({ status: 'cancelled' });

    const totalPremium = await InsurancePolicy.aggregate([
      { $group: { _id: null, total: { $sum: '$premiumAmount' } } }
    ]);

    const totalCommission = await Transaction.aggregate([
      { $match: { bookingType: 'insurance', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$platformCommission' } } }
    ]);

    // Plans by type
    const plansByType = await InsurancePlan.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$planType', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        totalPolicies,
        activePolicies,
        expiredPolicies,
        cancelledPolicies,
        totalPremium: totalPremium[0]?.total || 0,
        totalCommission: totalCommission[0]?.total || 0,
        plansByType
      }
    });
  } catch (error) {
    console.error('Error generating summary report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate summary report' });
  }
});

module.exports = router;
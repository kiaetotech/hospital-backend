const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const InsurancePlan = require('../models/InsurancePlan');
const InsuranceCompany = require('../models/InsuranceCompany');
const InsuranceClaim = require('../models/InsuranceClaim');
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
    
    const query = {};
    if (status === 'verified') query.isVerified = true;
    if (status === 'unverified') query.isVerified = false;
    
    const skip = (page - 1) * limit;
    const companies = await InsuranceCompany.find(query).populate('userId', 'name email phone role isVerified').lean()
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await InsuranceCompany.countDocuments(query);

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

// Verify insurance company and linked platform account
router.put('/companies/:id/verify', auth, isAdmin, async (req, res) => {
  try {
    const { verified, notes } = req.body;
    if (typeof verified !== 'boolean') return res.status(400).json({ success: false, message: 'verified must be boolean' });
    const company = await InsuranceCompany.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    company.isVerified = verified;
    company.status = verified ? 'verified' : 'pending_verification';
    company.verifiedAt = verified ? new Date() : undefined;
    company.verificationDate = verified ? new Date() : undefined;
    if (!verified && notes) company.rejectionReason = String(notes).slice(0, 1000);
    company.verifiedBy = verified ? req.user.id : undefined;
    await company.save();
    if (company.userId) {
      await User.findByIdAndUpdate(company.userId, { isVerified: verified, kycStatus: verified ? 'verified' : 'pending' });
    }
    res.json({ success: true, message: verified ? 'Company verified successfully' : 'Company verification revoked', data: company });
  } catch (error) {
    console.error('Company verification error:', error);
    res.status(500).json({ success: false, message: 'Failed to update company verification' });
  }
});

// Verify insurance plan before it can be purchased
router.put('/plans/:id/verify', auth, isAdmin, async (req, res) => {
  try {
    const { verified } = req.body;
    if (typeof verified !== 'boolean') return res.status(400).json({ success: false, message: 'verified must be boolean' });
    const plan = await InsurancePlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    plan.isVerified = verified;
    plan.verificationDate = verified ? new Date() : undefined;
    plan.verifiedBy = verified ? req.user.id : undefined;
    await plan.save();
    res.json({ success: true, message: verified ? 'Plan verified successfully' : 'Plan verification revoked', data: plan });
  } catch (error) {
    console.error('Plan verification error:', error);
    res.status(500).json({ success: false, message: 'Failed to update plan verification' });
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
// CLAIM MANAGEMENT
// ============================================

router.get('/claims', auth, isAdmin, async (req, res) => {
  try {
    const { status, startDate, endDate, search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) { const d = new Date(endDate); d.setHours(23,59,59,999); query.createdAt.$lte = d; }
    }
    if (search) query.$or = [
      { claimNumber: { $regex: search, $options: 'i' } },
      { policyNumber: { $regex: search, $options: 'i' } },
      { hospitalName: { $regex: search, $options: 'i' } }
    ];
    const skip = (Number(page) - 1) * Number(limit);
    const [claims, total] = await Promise.all([
      InsuranceClaim.find(query).populate('policyId', 'policyNumber policyName').populate('userId', 'name email phone').populate('companyId', 'companyName').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      InsuranceClaim.countDocuments(query)
    ]);
    const summaryAgg = await InsuranceClaim.aggregate([
      { $match: query },
      { $group: { _id: null, totalClaims: { $sum: 1 }, pending: { $sum: { $cond: [{ $in: ['$status', ['submitted','under_review','pending_verification']] }, 1, 0] } }, approved: { $sum: { $cond: [{ $eq: ['$status','approved'] }, 1, 0] } }, totalSettled: { $sum: { $cond: [{ $in: ['$status',['settled','partially_settled']] }, '$settlementAmount', 0] } } } }
    ]);
    res.json({ success: true, data: { claims, summary: summaryAgg[0] || { totalClaims: 0, pending: 0, approved: 0, totalSettled: 0 }, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } } });
  } catch (error) {
    console.error('Admin claims fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch claims' });
  }
});

router.get('/claims/export', auth, isAdmin, async (req, res) => {
  try {
    const { status, startDate, endDate, search } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (startDate || endDate) { query.createdAt = {}; if (startDate) query.createdAt.$gte = new Date(startDate); if (endDate) { const d = new Date(endDate); d.setHours(23,59,59,999); query.createdAt.$lte = d; } }
    if (search) query.$or = [{ claimNumber: { $regex: search, $options: 'i' } }, { policyNumber: { $regex: search, $options: 'i' } }, { hospitalName: { $regex: search, $options: 'i' } }];
    const claims = await InsuranceClaim.find(query).populate('userId', 'name').sort({ createdAt: -1 });
    const header = ['Claim Number','Policy Number','Customer','Amount','Approved Amount','Settlement Amount','Status','Created At'];
    const rows = claims.map(c => [c.claimNumber || c.claimId || '', c.policyNumber || '', c.userId?.name || '', c.amount || 0, c.approvedAmount || 0, c.settlementAmount || 0, c.status || '', c.createdAt?.toISOString() || '']);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="insurance-claims.csv"', 'Cache-Control': 'private, no-store' });
    res.send(csv);
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to export claims' }); }
});

router.put('/claims/:id/status', auth, isAdmin, async (req, res) => {
  try {
    const { status, note, amount } = req.body;
    const allowed = ['submitted','under_review','approved','rejected','settled','partially_settled','cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid claim status' });
    const claim = await InsuranceClaim.findById(req.params.id);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    const policy = await InsurancePolicy.findById(claim.policyId);
    const numericAmount = amount == null ? null : Number(amount);
    if (numericAmount != null && (!Number.isFinite(numericAmount) || numericAmount < 0)) return res.status(400).json({ success: false, message: 'Invalid settlement amount' });
    if (numericAmount != null && policy && numericAmount > policy.sumInsured) return res.status(400).json({ success: false, message: 'Amount exceeds policy sum insured' });
    if (status === 'approved') { claim.approvedAmount = numericAmount ?? claim.amount; claim.approvedBy = req.user.id; claim.approvedAt = new Date(); }
    if (status === 'rejected') { claim.rejectedReason = note || 'Claim rejected'; claim.rejectedAt = new Date(); }
    if (status === 'settled' || status === 'partially_settled') { const settlement = numericAmount ?? claim.approvedAmount ?? claim.amount; if (status === 'partially_settled' && settlement >= claim.amount) return res.status(400).json({ success: false, message: 'Partial settlement must be less than the claim amount' }); claim.settlementAmount = settlement; claim.settlementDate = new Date(); claim.settlementReference = claim.settlementReference || `SETTLE_${Date.now()}_${require('crypto').randomInt(1000,10000)}`; }
    claim.status = status; claim.updatedAt = new Date(); await claim.save(); await claim.addTimeline(status, note || `Status updated to ${status}`, req.user.id);
    res.json({ success: true, message: 'Claim status updated successfully', data: claim });
  } catch (error) { console.error('Admin claim update error:', error); res.status(500).json({ success: false, message: 'Failed to update claim status' }); }
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

      if (transaction.bookingType !== 'insurance' || transaction.status !== 'completed') {
        results.push({ id: transactionId, status: 'failed', message: 'Only completed insurance transactions can be settled' });
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
      await transaction.markInsuranceSettlementCompleted('SETTLE_' + Date.now() + '_' + require('crypto').randomInt(1000, 10000));

      // Update policy
      const policy = await InsurancePolicy.findOne({ bookingId: transaction.bookingId });
      if (policy) {
        policy.settlementStatus = 'completed';
        policy.settlementDate = new Date();
        policy.settlementTransactionId = transaction.insuranceSettlementTransactionId;
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
    if (companyId) match.providerId = new mongoose.Types.ObjectId(companyId);

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
    if (companyId) match.providerId = new mongoose.Types.ObjectId(companyId);

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
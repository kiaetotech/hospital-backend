const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const InsurancePlan = require('../models/InsurancePlan');
const InsurancePolicy = require('../models/InsurancePolicy');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

// ✅ FIXED: Correctly import authenticate from auth.js
const { authenticate: auth } = require('../middleware/auth');

const razorpayService = require('../services/razorpayService');
const commissionService = require('../services/commissionService');
const notificationService = require('../services/notificationService');

// ============================================
// PUBLIC ROUTES (No Auth Required)
// ============================================

// Get all active insurance plans with filters
router.get('/plans', async (req, res) => {
  try {
    const { 
      planType, 
      minSumInsured, 
      maxSumInsured, 
      minPremium, 
      maxPremium,
      companyId,
      isFeatured,
      isPopular,
      search,
      sort,
      page = 1,
      limit = 20
    } = req.query;

    const query = { isActive: true };

    if (planType && planType !== 'all') query.planType = planType;
    if (companyId) query.companyId = companyId;
    if (isFeatured === 'true') query.isFeatured = true;
    if (isPopular === 'true') query.isPopular = true;
    
    if (minSumInsured || maxSumInsured) {
      query['sumInsured.default'] = {};
      if (minSumInsured) query['sumInsured.default'].$gte = parseInt(minSumInsured);
      if (maxSumInsured) query['sumInsured.default'].$lte = parseInt(maxSumInsured);
    }
    
    if (minPremium || maxPremium) {
      query.basePremium = {};
      if (minPremium) query.basePremium.$gte = parseInt(minPremium);
      if (maxPremium) query.basePremium.$lte = parseInt(maxPremium);
    }
    
    if (search) {
      query.$text = { $search: search };
    }

    let sortCriteria = { isFeatured: -1, rating: -1 };
    if (sort === 'popular') {
      sortCriteria = { views: -1, applications: -1 };
    } else if (sort === 'rating') {
      sortCriteria = { rating: -1, totalReviews: -1 };
    } else if (sort === 'price_low') {
      sortCriteria = { basePremium: 1 };
    } else if (sort === 'price_high') {
      sortCriteria = { basePremium: -1 };
    } else if (sort === 'sum_insured') {
      sortCriteria = { 'sumInsured.default': -1 };
    } else if (sort === 'newest') {
      sortCriteria = { createdAt: -1 };
    }

    const skip = (page - 1) * limit;
    const plans = await InsurancePlan.find(query)
      .populate('companyId', 'name companyLogo companyDescription companyPhone companyEmail isVerified')
      .sort(sortCriteria)
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
    console.error('Error fetching insurance plans:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch plans' });
  }
});

// Get featured plans
router.get('/plans/featured', async (req, res) => {
  try {
    const plans = await InsurancePlan.find({ 
      isActive: true, 
      isFeatured: true 
    })
      .populate('companyId', 'name companyLogo')
      .sort({ rating: -1 })
      .limit(10);

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error fetching featured plans:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch featured plans' });
  }
});

// Get popular plans
router.get('/plans/popular', async (req, res) => {
  try {
    const plans = await InsurancePlan.find({ 
      isActive: true, 
      isPopular: true 
    })
      .populate('companyId', 'name companyLogo')
      .sort({ views: -1, applications: -1 })
      .limit(10);

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error fetching popular plans:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch popular plans' });
  }
});

// Get single plan by ID
router.get('/plans/:id', async (req, res) => {
  try {
    const plan = await InsurancePlan.findById(req.params.id)
      .populate('companyId', 'name companyLogo companyDescription companyWebsite companyPhone companyEmail companyAddress isVerified');
    
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    await plan.incrementViews();

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch plan' });
  }
});

// Get all insurance companies
router.get('/companies', async (req, res) => {
  try {
    const companies = await User.find({ 
      role: 'insurance_company', 
      isActive: true,
      isVerified: true 
    })
      .select('name companyName companyLogo companyDescription companyPhone companyEmail companyAddress isVerified')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: companies
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch companies' });
  }
});

// Calculate premium
router.post('/calculate-premium', async (req, res) => {
  try {
    const { planId, age, sumInsured, membersCount, isSmoker } = req.body;
    
    if (!planId) {
      return res.status(400).json({ success: false, message: 'Plan ID is required' });
    }

    const plan = await InsurancePlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const calculation = plan.calculatePremium(
      parseInt(age) || 30,
      sumInsured ? parseInt(sumInsured) : undefined,
      parseInt(membersCount) || 1,
      isSmoker || false
    );

    res.json({
      success: true,
      data: calculation,
      plan: {
        id: plan._id,
        name: plan.planName,
        type: plan.planType,
        company: plan.companyId
      }
    });
  } catch (error) {
    console.error('Error calculating premium:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate premium' });
  }
});

// ============================================
// MIDDLEWARE - Check Phone Verification
// ============================================

const checkPhoneVerified = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.phoneVerified) {
      return res.status(403).json({
        success: false,
        message: 'Phone verification required. Please verify your phone number first.',
        requiresVerification: true,
        data: {
          phone: user.phone,
          type: 'insurance_application'
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking phone verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check phone verification'
    });
  }
};

// ============================================
// AUTHENTICATED ROUTES (Customer Only)
// ============================================

// Apply for insurance
router.post('/apply', auth, checkPhoneVerified, async (req, res) => {
  try {
    const {
      planId,
      sumInsured,
      members,
      startDate,
      selectedAddons,
      primaryInsured,
      nominee,
      medicalHistory,
      declarations,
      termsAccepted
    } = req.body;

    const userId = req.user.id;

    if (!planId || !sumInsured || !startDate || !primaryInsured) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: planId, sumInsured, startDate, primaryInsured'
      });
    }

    const plan = await InsurancePlan.findById(planId).populate('companyId');
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    if (!plan.isActive) {
      return res.status(400).json({ success: false, message: 'Plan is not currently active' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const age = primaryInsured.age || 30;
    const membersCount = members ? members.length + 1 : 1;
    const isSmoker = primaryInsured.isSmoker || false;
    
    const premiumCalculation = plan.calculatePremium(age, sumInsured, membersCount, isSmoker);

    let addonTotal = 0;
    if (selectedAddons && selectedAddons.length > 0) {
      const planAddons = plan.addons || [];
      selectedAddons.forEach(addon => {
        const addonId = addon._id || addon;
        const matchedAddon = planAddons.find(a => a._id.toString() === addonId.toString());
        if (matchedAddon) {
          addonTotal += matchedAddon.price || 0;
        }
      });
    }

    const finalPremium = premiumCalculation.totalPremium + addonTotal;

    const start = new Date(startDate);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);

    const bookingId = 'INS' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');

    const booking = new Booking({
      userId: userId,
      bookingType: 'insurance',
      patientName: primaryInsured.name || user.name,
      patientPhone: user.phone,
      patientEmail: user.email,
      patientAge: primaryInsured.age,
      patientGender: primaryInsured.gender,
      bookingDate: new Date(),
      appointmentDate: start,
      originalAmount: finalPremium,
      discount: premiumCalculation.discountAmount || 0,
      finalAmount: finalPremium,
      paymentStatus: 'pending',
      status: 'pending',
      providerId: plan.companyId._id,
      providerName: plan.companyId.name || 'Insurance Company',
      platformCommission: premiumCalculation.platformCommission,
      providerCommission: premiumCalculation.payoutToCompany,
      commissionStatus: 'pending',
      insurancePlanId: plan._id,
      insuranceCompanyName: plan.companyId.name,
      insurancePlanName: plan.planName,
      sumInsured: sumInsured,
      premiumAmount: finalPremium,
      insuranceMembers: members || [],
      policyStartDate: start,
      policyEndDate: end,
      policyRenewalDate: end,
      insuranceSettlementStatus: 'pending',
      bookingId: bookingId
    });

    await booking.save();

    const policy = new InsurancePolicy({
      bookingId: booking._id,
      planId: plan._id,
      companyId: plan.companyId._id,
      userId: userId,
      policyName: plan.planName,
      policyType: plan.planType,
      sumInsured: sumInsured,
      roomRentLimit: plan.roomRentLimit,
      premiumAmount: finalPremium,
      gstAmount: premiumCalculation.gstAmount || 0,
      discountAmount: premiumCalculation.discountAmount || 0,
      totalAmount: finalPremium,
      platformCommission: premiumCalculation.platformCommission,
      platformCommissionRate: premiumCalculation.commissionRate || plan.commissionRate,
      payoutToCompany: premiumCalculation.payoutToCompany,
      members: members || [],
      primaryInsured: primaryInsured,
      nominee: nominee || {},
      selectedAddons: selectedAddons || [],
      startDate: start,
      endDate: end,
      renewalDate: end,
      status: 'pending',
      paymentStatus: 'pending',
      settlementStatus: 'pending',
      termsAccepted: termsAccepted || false,
      termsAcceptedAt: termsAccepted ? new Date() : null,
      medicalHistory: medicalHistory || {},
      declarations: declarations || {}
    });

    await policy.save();

    booking.insurancePolicyId = policy._id;
    await booking.save();

    const order = await razorpayService.createOrder({
      amount: Math.round(finalPremium * 100),
      currency: 'INR',
      receipt: booking._id.toString(),
      notes: {
        bookingId: booking._id.toString(),
        policyId: policy._id.toString(),
        planId: plan._id.toString(),
        userId: userId.toString()
      }
    });

    booking.razorpayOrderId = order.id;
    booking.orderId = order.id;
    await booking.save();

    const transaction = new Transaction({
      transactionId: Transaction.generateTransactionId(),
      applicationId: booking._id.toString(),
      lenderId: plan.companyId._id.toString(),
      type: 'booking_payment',
      amount: finalPremium,
      commissionAmount: premiumCalculation.platformCommission,
      status: 'initiated',
      paymentGateway: 'razorpay',
      gatewayReferenceId: order.id,
      orderId: order.id,
      bookingId: booking._id,
      bookingType: 'insurance',
      userId: userId,
      providerId: plan.companyId._id,
      originalAmount: finalPremium,
      netAmount: finalPremium,
      platformCommission: premiumCalculation.platformCommission,
      providerAmount: premiumCalculation.payoutToCompany,
      commissionStatus: 'pending',
      settledToProvider: false,
      insurancePolicyId: policy._id,
      insurancePlanId: plan._id,
      premiumAmount: finalPremium,
      gstAmount: premiumCalculation.gstAmount || 0,
      totalPremium: finalPremium,
      insuranceCommissionRate: premiumCalculation.commissionRate || plan.commissionRate,
      insurancePlatformCommission: premiumCalculation.platformCommission,
      insurancePayoutToCompany: premiumCalculation.payoutToCompany,
      insuranceSettlementStatus: 'pending'
    });

    await transaction.save();

    if (notificationService && notificationService.sendEmail) {
      await notificationService.sendEmail(user.email, 'Insurance Application Initiated', {
        template: 'insurance_application',
        data: {
          name: user.name,
          planName: plan.planName,
          companyName: plan.companyId.name,
          premium: finalPremium,
          bookingId: booking._id
        }
      });
    }

    res.json({
      success: true,
      data: {
        bookingId: booking._id,
        policyId: policy._id,
        orderId: order.id,
        amount: finalPremium,
        razorpayKey: process.env.RAZORPAY_KEY_ID,
        policyNumber: policy.policyNumber
      }
    });

  } catch (error) {
    console.error('Error applying for insurance:', error);
    res.status(500).json({ success: false, message: 'Application failed: ' + error.message });
  }
});

// Verify payment and activate policy
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const { bookingId, paymentId, orderId, signature } = req.body;

    if (!bookingId || !paymentId || !orderId || !signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: bookingId, paymentId, orderId, signature'
      });
    }

    const isValid = razorpayService.verifyPaymentSignature({
      orderId,
      paymentId,
      signature
    });

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Payment already verified' });
    }

    booking.paymentStatus = 'paid';
    booking.status = 'policy_issued';
    booking.paymentId = paymentId;
    booking.razorpayPaymentId = paymentId;
    booking.razorpaySignature = signature;
    await booking.save();

    const transaction = await Transaction.findOne({ bookingId: booking._id });
    if (transaction) {
      transaction.status = 'completed';
      transaction.paymentId = paymentId;
      transaction.paidAt = new Date();
      transaction.completedAt = new Date();
      transaction.webhookReceived = true;
      await transaction.save();

      if (commissionService && commissionService.processInsuranceCommission) {
        await commissionService.processInsuranceCommission(transaction);
      }
    }

    const policy = await InsurancePolicy.findOne({ bookingId: booking._id });
    if (policy) {
      policy.status = 'active';
      policy.paymentStatus = 'paid';
      policy.policyDocumentUrl = `POLICY_${policy.policyNumber}.pdf`;
      await policy.save();
    }

    const user = await User.findById(booking.userId);

    if (user && notificationService && notificationService.sendEmail) {
      await notificationService.sendEmail(user.email, 'Insurance Policy Issued', {
        template: 'policy_issued',
        data: {
          name: user.name,
          policyNumber: policy?.policyNumber,
          planName: booking.insurancePlanName,
          companyName: booking.insuranceCompanyName,
          premium: booking.finalAmount,
          startDate: booking.policyStartDate,
          endDate: booking.policyEndDate
        }
      });
    }

    res.json({
      success: true,
      message: 'Payment verified and policy issued successfully',
      data: {
        bookingId: booking._id,
        policyNumber: policy?.policyNumber,
        status: 'active',
        policyUrl: policy?.policyDocumentUrl
      }
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Payment verification failed: ' + error.message });
  }
});

// Get user's insurance policies
router.get('/my-policies', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const policies = await InsurancePolicy.find({ userId })
      .populate('planId', 'planName planType sumInsured features')
      .populate('companyId', 'name companyLogo')
      .sort({ createdAt: -1 });

    const policiesWithBooking = await Promise.all(policies.map(async (policy) => {
      const booking = await Booking.findById(policy.bookingId);
      return {
        ...policy.toObject(),
        booking: booking ? {
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          createdAt: booking.createdAt
        } : null
      };
    }));

    res.json({
      success: true,
      data: policiesWithBooking
    });
  } catch (error) {
    console.error('Error fetching policies:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch policies' });
  }
});

// Get single policy details
router.get('/my-policies/:id', auth, async (req, res) => {
  try {
    const policy = await InsurancePolicy.findById(req.params.id)
      .populate('planId')
      .populate('companyId', 'name companyLogo companyEmail companyPhone companyAddress');

    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    if (policy.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const booking = await Booking.findById(policy.bookingId);

    res.json({
      success: true,
      data: {
        ...policy.toObject(),
        booking: booking ? {
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          createdAt: booking.createdAt,
          paymentId: booking.paymentId
        } : null
      }
    });
  } catch (error) {
    console.error('Error fetching policy:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch policy' });
  }
});

// Cancel policy
router.post('/cancel-policy/:id', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const policy = await InsurancePolicy.findById(req.params.id);
    
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    if (policy.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (policy.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Only active policies can be cancelled' });
    }

    const daysSincePurchase = (Date.now() - policy.createdAt) / (1000 * 60 * 60 * 24);
    if (daysSincePurchase > 15) {
      return res.status(400).json({ 
        success: false, 
        message: 'Free-look period has expired. Policy cannot be cancelled.' 
      });
    }

    await policy.cancel(reason || 'Cancelled by customer', policy.totalAmount);

    const booking = await Booking.findById(policy.bookingId);
    if (booking) {
      booking.status = 'cancelled';
      booking.paymentStatus = 'refunded';
      await booking.save();
    }

    const transaction = await Transaction.findOne({ bookingId: policy.bookingId });
    if (transaction) {
      transaction.status = 'refunded';
      transaction.refundAmount = policy.totalAmount;
      transaction.refundedAt = new Date();
      await transaction.save();
    }

    res.json({
      success: true,
      message: 'Policy cancelled successfully',
      data: {
        policyNumber: policy.policyNumber,
        refundAmount: policy.refundAmount
      }
    });

  } catch (error) {
    console.error('Error cancelling policy:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel policy' });
  }
});

// Download policy document
router.get('/download-policy/:id', auth, async (req, res) => {
  try {
    const policy = await InsurancePolicy.findById(req.params.id);
    
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    if (policy.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (!policy.policyDocumentUrl) {
      return res.status(404).json({ success: false, message: 'Policy document not available' });
    }

    res.json({
      success: true,
      data: {
        url: policy.policyDocumentUrl,
        policyNumber: policy.policyNumber
      }
    });

  } catch (error) {
    console.error('Error downloading policy:', error);
    res.status(500).json({ success: false, message: 'Failed to download policy' });
  }
});

// ============================================
// CLAIMS ROUTES
// ============================================

// Submit a claim
router.post('/claims', auth, async (req, res) => {
  try {
    const { policyId, amount, description, hospitalName, hospitalAddress, admissionDate, documents } = req.body;

    if (!policyId || !amount || !description) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: policyId, amount, description'
      });
    }

    const policy = await InsurancePolicy.findById(policyId);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    if (policy.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (policy.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Only active policies can file claims' });
    }

    await policy.addClaim({
      amount,
      description,
      hospitalName,
      hospitalAddress,
      admissionDate,
      documents: documents || []
    });

    const user = await User.findById(req.user.id);
    if (user && notificationService && notificationService.sendEmail) {
      await notificationService.sendEmail(user.email, 'Claim Submitted', {
        template: 'claim_submitted',
        data: {
          name: user.name,
          policyNumber: policy.policyNumber,
          claimAmount: amount,
          claimId: policy.claims[policy.claims.length - 1].claimId
        }
      });
    }

    res.json({
      success: true,
      message: 'Claim submitted successfully',
      data: {
        claim: policy.claims[policy.claims.length - 1]
      }
    });

  } catch (error) {
    console.error('Error submitting claim:', error);
    res.status(500).json({ success: false, message: 'Failed to submit claim' });
  }
});

// Get all claims for a policy
router.get('/claims/:policyId', auth, async (req, res) => {
  try {
    const policy = await InsurancePolicy.findById(req.params.policyId);
    
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    if (policy.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    res.json({
      success: true,
      data: policy.claims || []
    });

  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch claims' });
  }
});

// Get claim details
router.get('/claims/:policyId/:claimId', auth, async (req, res) => {
  try {
    const policy = await InsurancePolicy.findById(req.params.policyId);
    
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    if (policy.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const claim = policy.getClaim(req.params.claimId);
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    res.json({
      success: true,
      data: claim
    });

  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch claim' });
  }
});

// ============================================
// STATS ROUTES
// ============================================

// Get platform stats
router.get('/stats', async (req, res) => {
  try {
    const totalPlans = await InsurancePlan.countDocuments({ isActive: true });
    const totalCompanies = await User.countDocuments({ 
      role: 'insurance_company', 
      isActive: true,
      isVerified: true 
    });
    const totalPolicies = await InsurancePolicy.countDocuments({ status: 'active' });
    
    const plans = await InsurancePlan.find({ isActive: true });
    let avgSettlementRatio = 0;
    if (plans.length > 0) {
      const totalRatio = plans.reduce((sum, plan) => {
        return sum + (plan.claimProcess?.claimSettlementRatio || 0);
      }, 0);
      avgSettlementRatio = Math.round(totalRatio / plans.length);
    }

    res.json({
      success: true,
      data: {
        totalPlans,
        totalCompanies,
        policiesIssued: totalPolicies,
        claimSettlementRate: avgSettlementRatio || 95
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

module.exports = router;
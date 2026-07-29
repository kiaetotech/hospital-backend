const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const InsurancePlan = require('../models/InsurancePlan');
const InsurancePolicy = require('../models/InsurancePolicy');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const CorporatePlan = require('../models/CorporatePlan');
const CorporateEmployee = require('../models/CorporateEmployee');
const CorporateHR = require('../models/CorporateHR');

// ✅ FIXEDimport authenticate from auth.js
const { authenticate} = require('../middleware/auth');

const razorpayService = require('../services/razorpayService');
const commissionService = require('../services/commissionService');
const notificationService = require('../services/notificationService');

// ============================================
// AUTHENTICATE HR MIDDLEWARE
// ============================================

const authenticateHR = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success, message: 'Unauthorized. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hr = await CorporateHR.findById(decoded.id);
    if (!hr) {
      return res.status(401).json({ success, message: 'HR not found' });
    }
    if (!hr.isActive) {
      return res.status(403).json({ success, message: 'Account suspended' });
    }

    req.hr = hr;
    req.companyId = hr.companyId;
    next();
  } catch (error) {
    res.status(401).json({ success, message: 'Invalid token' });
  }
};

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
      limit = 20,
      age,
      pincode,
      members
    } = req.query;

    const query = { isActive};

    if (age) {
      const userAge = parseInt(age);
      if (userAge >= 60) {
        query.$or = [
          { planType: 'senior_citizen' },
          { planType: 'family_floater' }
        ];
      }
    }

    if (members) {
      try {
        const membersData = JSON.parse(members);
        const memberCount = Object.values(membersData).filter(v => v).length;
        if (memberCount > 1) {
          query.$or = [
            { planType: 'family_floater' },
            { planType: 'family_floater' }
          ];
        }
      } catch (e) {
        console.log('Error parsing members:', e);
      }
    }

    if (pincode) {
      console.log('Pincode filter:', pincode);
    }

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
      query.$text = { $search};
    }

    let sortCriteria = { isFeatured: -1, rating: -1 };
    
    if (members) {
      try {
        const membersData = JSON.parse(members);
        const memberCount = Object.values(membersData).filter(v => v).length;
        if (memberCount > 1) {
          sortCriteria = { planType: 1, ...sortCriteria };
        }
      } catch (e) {}
    }

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

    let personalizedPlans = plans;
    if (age) {
      const userAge = parseInt(age);
      personalizedPlans = plans.map(plan => {
        const planObj = plan.toObject();
        let personalizedPremium = plan.basePremium;
        if (userAge > 60) {
          personalizedPremium = personalizedPremium * 1.5;
        } else if (userAge > 50) {
          personalizedPremium = personalizedPremium * 1.2;
        } else if (userAge < 25) {
          personalizedPremium = personalizedPremium * 0.9;
        }
        planObj.personalizedPremium = Math.round(personalizedPremium);
        planObj.monthlyPrice = Math.round(personalizedPremium / 12);
        return planObj;
      });
    }

    res.json({
      success,
      data,
      pagination: {
        page(page),
        limit(limit),
        total,
        pages.ceil(total / limit)
      },
      searchCriteria: {
        age|| null,
        pincode|| null,
        members|| null
      }
    });
  } catch (error) {
    console.error('Error fetching insurance plans:', error);
    res.status(500).json({ success, message: 'Failed to fetch plans' });
  }
});

// Get featured plans
router.get('/plans/featured', async (req, res) => {
  try {
    const plans = await InsurancePlan.find({ 
      isActive, 
      isFeatured})
      .populate('companyId', 'name companyLogo')
      .sort({ rating: -1 })
      .limit(10);

    res.json({
      success,
      data});
  } catch (error) {
    console.error('Error fetching featured plans:', error);
    res.status(500).json({ success, message: 'Failed to fetch featured plans' });
  }
});

// Get popular plans
router.get('/plans/popular', async (req, res) => {
  try {
    const plans = await InsurancePlan.find({ 
      isActive, 
      isPopular})
      .populate('companyId', 'name companyLogo')
      .sort({ views: -1, applications: -1 })
      .limit(10);

    res.json({
      success,
      data});
  } catch (error) {
    console.error('Error fetching popular plans:', error);
    res.status(500).json({ success, message: 'Failed to fetch popular plans' });
  }
});

// Get single plan by ID
router.get('/plans/', async (req, res) => {
  try {
    const plan = await InsurancePlan.findById(req.params.id)
      .populate('companyId', 'name companyLogo companyDescription companyWebsite companyPhone companyEmail companyAddress isVerified');
    
    if (!plan) {
      return res.status(404).json({ success, message: 'Plan not found' });
    }

    await plan.incrementViews();

    res.json({
      success,
      data});
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({ success, message: 'Failed to fetch plan' });
  }
});

// Get all insurance companies
router.get('/companies', async (req, res) => {
  try {
    const companies = await User.find({ 
      role: 'insurance_company', 
      isActive,
      isVerified})
      .select('name companyName companyLogo companyDescription companyPhone companyEmail companyAddress isVerified')
      .sort({ name: 1 });

    res.json({
      success,
      data});
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ success, message: 'Failed to fetch companies' });
  }
});

// Calculate premium
router.post('/calculate-premium', async (req, res) => {
  try {
    const { planId, age, sumInsured, membersCount, isSmoker } = req.body;
    
    if (!planId) {
      return res.status(400).json({ success, message: 'Plan ID is required' });
    }

    const plan = await InsurancePlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success, message: 'Plan not found' });
    }

    const calculation = plan.calculatePremium(
      parseInt(age) || 30,
      sumInsured ? parseInt(sumInsured) ,
      parseInt(membersCount) || 1,
      isSmoker || false
    );

    calculation.monthlyPrice = Math.round(calculation.totalPremium / 12);

    res.json({
      success,
      data,
      plan: {
        id._id,
        name.planName,
        type.planType,
        company.companyId
      }
    });
  } catch (error) {
    console.error('Error calculating premium:', error);
    res.status(500).json({ success, message: 'Failed to calculate premium' });
  }
});

// ============================================
// 🆕 CORPORATE PLAN ROUTES
// ============================================

// Get all corporate plans
router.get('/plans/corporate', async (req, res) => {
  try {
    const {
      minEmployees,
      maxEmployees,
      corporateType,
      companyId,
      sort,
      page = 1,
      limit = 20
    } = req.query;

    const query = {
      isCorporate,
      isActive,
      isVerified};

    if (minEmployees) query.minEmployees = { $lte(minEmployees) };
    if (maxEmployees) query.maxEmployees = { $gte(maxEmployees) };
    if (corporateType) query.corporateType = corporateType;
    if (companyId) query.companyId = companyId;

    let sortCriteria = { rating: -1, views: -1 };
    if (sort === 'price_low') {
      sortCriteria = { 'corporatePricing.basePremiumPerEmployee': 1 };
    } else if (sort === 'price_high') {
      sortCriteria = { 'corporatePricing.basePremiumPerEmployee': -1 };
    } else if (sort === 'popular') {
      sortCriteria = { views: -1, applications: -1 };
    }

    const skip = (page - 1) * limit;
    const plans = await InsurancePlan.find(query)
      .populate('companyId', 'name companyLogo companyDescription')
      .sort(sortCriteria)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await InsurancePlan.countDocuments(query);

    const plansWithSummary = plans.map(plan => ({
      ...plan.toObject(),
      corporateSummary.getCorporateSummary()
    }));

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
    console.error('Error fetching corporate plans:', error);
    res.status(500).json({ success, message: 'Failed to fetch corporate plans' });
  }
});

// Get single corporate plan with pricing tiers
router.get('/plans/corporate/', async (req, res) => {
  try {
    const plan = await InsurancePlan.findOne({
      _id.params.id,
      isCorporate}).populate('companyId', 'name companyLogo companyDescription companyPhone companyEmail');

    if (!plan) {
      return res.status(404).json({ success, message: 'Corporate plan not found' });
    }

    const pricingTiers = [];
    const bulkDiscounts = plan.corporatePricing?.bulkDiscount?.tiers || [];
    const basePrice = plan.corporatePricing?.basePremiumPerEmployee || plan.basePremium * 0.7;

    pricingTiers.push({
      minEmployees.minEmployees || 10,
      maxEmployees.maxEmployees || 50,
      pricePerEmployee,
      discount: 0,
      totalPrice* (plan.minEmployees || 10)
    });

    bulkDiscounts.forEach(tier => {
      const discountPrice = basePrice * (1 - (tier.discountPercentage || 0) / 100);
      pricingTiers.push({
        minEmployees.minEmployees,
        maxEmployees.maxEmployees || 9999,
        pricePerEmployee,
        discount.discountPercentage || 0,
        totalPrice* tier.minEmployees
      });
    });

    pricingTiers.sort((a, b) => a.minEmployees - b.minEmployees);

    res.json({
      success,
      data: {
        ...plan.toObject(),
        corporateSummary.getCorporateSummary(),
        pricingTiers,
        corporateFeatures.corporateFeatures || plan.features
      }
    });
  } catch (error) {
    console.error('Error fetching corporate plan:', error);
    res.status(500).json({ success, message: 'Failed to fetch corporate plan' });
  }
});

// Calculate corporate premium
router.post('/plans/corporate/calculate', async (req, res) => {
  try {
    const { planId, employeeCount, coverageAmount } = req.body;

    if (!planId || !employeeCount) {
      return res.status(400).json({
        success,
        message: 'planId and employeeCount are required'
      });
    }

    const plan = await InsurancePlan.findOne({
      _id,
      isCorporate});

    if (!plan) {
      return res.status(404).json({ success, message: 'Corporate plan not found' });
    }

    const calculation = plan.calculateCorporatePremium(employeeCount, coverageAmount);

    res.json({
      success,
      data: {
        ...calculation,
        planName.planName,
        companyName.companyId?.name || 'Insurance Company',
        coverageAmount|| plan.employeeCoverage?.defaultCoverageAmount || plan.sumInsured.default
      }
    });
  } catch (error) {
    console.error('Error calculating corporate premium:', error);
    res.status(500).json({ success, message: 'Failed to calculate corporate premium' });
  }
});

// Enroll company in corporate plan
router.post('/plans/corporate/enroll', auth, async (req, res) => {
  try {
    const {
      planId,
      companyName,
      companyGST,
      companyPAN,
      employeeCount,
      hrName,
      hrEmail,
      hrPhone,
      employees
    } = req.body;

    const plan = await InsurancePlan.findOne({
      _id,
      isCorporate,
      isActive});

    if (!plan) {
      return res.status(404).json({ success, message: 'Corporate plan not found or inactive' });
    }

    const calculation = plan.calculateCorporatePremium(employeeCount);

    const corporatePlan = new CorporatePlan({
      companyId.user.id,
      planId._id,
      companyName,
      companyGST,
      companyPAN,
      employeeCount,
      planName.planName,
      planType.corporateType || 'group_health',
      coverageAmount.employeeCoverage?.defaultCoverageAmount || plan.sumInsured.default,
      premiumPerEmployee.perEmployeePremium,
      totalPremium.totalPremium,
      features.corporateFeatures || plan.features,
      inclusions.inclusions,
      exclusions.exclusions,
      startDateDate(),
      endDateDate(Date.now() + 365 * 24 * 60 * 60 * 1000),
      renewalDateDate(Date.now() + 365 * 24 * 60 * 60 * 1000),
      hrContact: { name, email, phone},
      status: 'pending',
      isVerified,
      createdBy.user.id
    });

    await corporatePlan.save();

    if (employees && employees.length > 0) {
      const addedEmployees = [];
      for (const emp of employees) {
        if (emp.name && emp.email && emp.phone) {
          const employee = new CorporateEmployee({
            companyId.user.id,
            planId._id,
            name.name,
            email.email,
            phone.phone,
            department.department || '',
            designation.designation || '',
            coverageAmount.coverageAmount,
            premiumAmount.premiumPerEmployee,
            isActive});
          await employee.save();
          addedEmployees.push(employee);
        }
      }
      corporatePlan.employees = addedEmployees.map(e => ({
        name.name,
        email.email,
        phone.phone,
        department.department,
        designation.designation,
        employeeId.employeeId
      }));
      await corporatePlan.save();
    }

    if (hrEmail) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('TempPass@123', 10);
      const hr = new CorporateHR({
        companyId._id,
        name|| 'HR Admin',
        email,
        password,
        phone|| '',
        role: 'hr_admin',
        isActive});
      await hr.save();
    }

    res.json({
      success,
      message: 'Corporate plan enrollment submitted for verification',
      data: {
        corporatePlanId._id,
        employeeCount.employees.length,
        totalPremium.totalPremium,
        status.status
      }
    });
  } catch (error) {
    console.error('Error enrolling corporate plan:', error);
    res.status(500).json({ success, message: 'Enrollment failed: ' + error.message });
  }
});

// Get HR dashboard stats
router.get('/corporate/dashboard', authenticateHR, async (req, res) => {
  try {
    const companyId = req.companyId;

    const corporatePlan = await CorporatePlan.findById(companyId);
    const employees = await CorporateEmployee.find({ companyId });

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.isActive).length;
    const totalClaims = employees.reduce((sum, e) => sum + (e.claims?.length || 0), 0);
    const pendingClaims = employees.reduce((sum, e) => sum + (e.claims?.filter(c => c.status === 'pending').length || 0), 0);

    res.json({
      success,
      data: {
        totalEmployees,
        activeEmployees,
        totalPremium?.totalPremium || 0,
        totalClaims,
        pendingClaims,
        planStatus?.status || 'pending',
        planName?.planName || 'No active plan'
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success, message: 'Failed to fetch dashboard data' });
  }
});

// Get all employees
router.get('/corporate/employees', authenticateHR, async (req, res) => {
  try {
    const companyId = req.companyId;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { companyId };
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;

    const skip = (page - 1) * limit;
    const employees = await CorporateEmployee.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CorporateEmployee.countDocuments(query);

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
    console.error('Employees fetch error:', error);
    res.status(500).json({ success, message: 'Failed to fetch employees' });
  }
});

// Add employee to corporate plan
router.post('/corporate/employees', authenticateHR, async (req, res) => {
  try {
    const companyId = req.companyId;
    const { employees } = req.body;

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ success, message: 'At least one employee required' });
    }

    const corporatePlan = await CorporatePlan.findById(companyId);
    if (!corporatePlan) {
      return res.status(404).json({ success, message: 'Corporate plan not found' });
    }

    if (corporatePlan.status !== 'active') {
      return res.status(400).json({ success, message: 'Corporate plan is not active' });
    }

    const addedEmployees = [];
    for (const emp of employees) {
      if (!emp.name || !emp.email || !emp.phone) continue;

      const existing = await CorporateEmployee.findOne({ email.email, companyId });
      if (existing) continue;

      const employee = new CorporateEmployee({
        companyId,
        planId._id,
        name.name,
        email.email,
        phone.phone,
        department.department || '',
        designation.designation || '',
        coverageAmount.coverageAmount,
        premiumAmount.premiumPerEmployee,
        isActive});

      await employee.save();

      corporatePlan.employees.push({
        name.name,
        email.email,
        phone.phone,
        department.department,
        designation.designation,
        employeeId.employeeId
      });

      addedEmployees.push(employee);
    }

    corporatePlan.employeeCount = corporatePlan.employees.length;
    corporatePlan.totalPremium = corporatePlan.employeeCount * corporatePlan.premiumPerEmployee;
    await corporatePlan.save();

    res.json({
      success,
      message: `Added ${addedEmployees.length} employees`,
      data});
  } catch (error) {
    console.error('Add employee error:', error);
    res.status(500).json({ success, message: 'Failed to add employees' });
  }
});

// Update employee
router.put('/corporate/employees/', authenticateHR, async (req, res) => {
  try {
    const companyId = req.companyId;
    const employeeId = req.params.id;
    const { isActive, department, designation, phone } = req.body;

    const employee = await CorporateEmployee.findOne({ _id, companyId });
    if (!employee) {
      return res.status(404).json({ success, message: 'Employee not found' });
    }

    if (isActive !== undefined) employee.isActive = isActive;
    if (department) employee.department = department;
    if (designation) employee.designation = designation;
    if (phone) employee.phone = phone;

    employee.updatedAt = new Date();
    await employee.save();

    res.json({
      success,
      message: 'Employee updated successfully',
      data});
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ success, message: 'Failed to update employee' });
  }
});

// Delete employee
router.delete('/corporate/employees/', authenticateHR, async (req, res) => {
  try {
    const companyId = req.companyId;
    const employeeId = req.params.id;

    const employee = await CorporateEmployee.findOne({ _id, companyId });
    if (!employee) {
      return res.status(404).json({ success, message: 'Employee not found' });
    }

    employee.isActive = false;
    employee.updatedAt = new Date();
    await employee.save();

    const corporatePlan = await CorporatePlan.findById(companyId);
    if (corporatePlan) {
      corporatePlan.employeeCount = corporatePlan.employees.filter(e => e.isActive !== false).length;
      corporatePlan.totalPremium = corporatePlan.employeeCount * corporatePlan.premiumPerEmployee;
      await corporatePlan.save();
    }

    res.json({
      success,
      message: 'Employee removed successfully'
    });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ success, message: 'Failed to remove employee' });
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
        success,
        message: 'Phone verification required. Please verify your phone number first.',
        requiresVerification,
        data: {
          phone.phone,
          type: 'insurance_application'
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking phone verification:', error);
    res.status(500).json({
      success,
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
      termsAccepted,
      phone,
      pincode
    } = req.body;

    const userId = req.user.id;

    if (!planId || !sumInsured || !startDate || !primaryInsured) {
      return res.status(400).json({
        success,
        message: 'Missing required fields, sumInsured, startDate, primaryInsured'
      });
    }

    const plan = await InsurancePlan.findById(planId).populate('companyId');
    if (!plan) {
      return res.status(404).json({ success, message: 'Plan not found' });
    }
    if (!plan.isActive) {
      return res.status(400).json({ success, message: 'Plan is not currently active' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success, message: 'User not found' });
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
      userId,
      bookingType: 'insurance',
      patientName.name || user.name,
      patientPhone|| user.phone,
      patientEmail.email,
      patientAge.age,
      patientGender.gender,
      bookingDateDate(),
      appointmentDate,
      originalAmount,
      discount.discountAmount || 0,
      finalAmount,
      paymentStatus: 'pending',
      status: 'pending',
      providerId.companyId._id,
      providerName.companyId.name || 'Insurance Company',
      platformCommission.platformCommission,
      providerCommission.payoutToCompany,
      commissionStatus: 'pending',
      insurancePlanId._id,
      insuranceCompanyName.companyId.name,
      insurancePlanName.planName,
      sumInsured,
      premiumAmount,
      insuranceMembers|| [],
      policyStartDate,
      policyEndDate,
      policyRenewalDate,
      insuranceSettlementStatus: 'pending',
      bookingId,
      homeAddress? `Pincode: ${pincode}` });

    await booking.save();

    const policy = new InsurancePolicy({
      bookingId._id,
      planId._id,
      companyId.companyId._id,
      userId,
      policyName.planName,
      policyType.planType,
      sumInsured,
      roomRentLimit.roomRentLimit,
      premiumAmount,
      gstAmount.gstAmount || 0,
      discountAmount.discountAmount || 0,
      totalAmount,
      platformCommission.platformCommission,
      platformCommissionRate.commissionRate || plan.commissionRate,
      payoutToCompany.payoutToCompany,
      members|| [],
      primaryInsured,
      nominee|| {},
      selectedAddons|| [],
      startDate,
      endDate,
      renewalDate,
      status: 'pending',
      paymentStatus: 'pending',
      settlementStatus: 'pending',
      termsAccepted|| false,
      termsAcceptedAt? new Date() ,
      medicalHistory|| {},
      declarations|| {}
    });

    await policy.save();

    booking.insurancePolicyId = policy._id;
    await booking.save();

    const order = await razorpayService.createOrder({
      amount.round(finalPremium * 100),
      currency: 'INR',
      receipt._id.toString(),
      notes: {
        bookingId._id.toString(),
        policyId._id.toString(),
        planId._id.toString(),
        userId.toString()
      }
    });

    booking.razorpayOrderId = order.id;
    booking.orderId = order.id;
    await booking.save();

    const transaction = new Transaction({
      transactionId.generateTransactionId(),
      applicationId._id.toString(),
      lenderId.companyId._id.toString(),
      type: 'booking_payment',
      amount,
      commissionAmount.platformCommission,
      status: 'initiated',
      paymentGateway: 'razorpay',
      gatewayReferenceId.id,
      orderId.id,
      bookingId._id,
      bookingType: 'insurance',
      userId,
      providerId.companyId._id,
      originalAmount,
      netAmount,
      platformCommission.platformCommission,
      providerAmount.payoutToCompany,
      commissionStatus: 'pending',
      settledToProvider,
      insurancePolicyId._id,
      insurancePlanId._id,
      premiumAmount,
      gstAmount.gstAmount || 0,
      totalPremium,
      insuranceCommissionRate.commissionRate || plan.commissionRate,
      insurancePlatformCommission.platformCommission,
      insurancePayoutToCompany.payoutToCompany,
      insuranceSettlementStatus: 'pending'
    });

    await transaction.save();

    if (notificationService && notificationService.sendEmail) {
      await notificationService.sendEmail(user.email, 'Insurance Application Initiated', {
        template: 'insurance_application',
        data: {
          name.name,
          planName.planName,
          companyName.companyId.name,
          premium,
          bookingId._id
        }
      });
    }

    if (phone && notificationService && notificationService.sendSMS) {
      try {
        await notificationService.sendSMS(phone, 'insurance_application_initiated', {
          name.name,
          planName.planName,
          bookingId._id
        });
      } catch (smsError) {
        console.log('SMS notification failed:', smsError);
      }
    }

    res.json({
      success,
      data: {
        bookingId._id,
        policyId._id,
        orderId.id,
        amount,
        razorpayKey.env.RAZORPAY_KEY_ID,
        policyNumber.policyNumber
      }
    });

  } catch (error) {
    console.error('Error applying for insurance:', error);
    res.status(500).json({ success, message: 'Application failed: ' + error.message });
  }
});

// Verify payment and activate policy
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const { bookingId, paymentId, orderId, signature } = req.body;

    if (!bookingId || !paymentId || !orderId || !signature) {
      return res.status(400).json({
        success,
        message: 'Missing required fields, paymentId, orderId, signature'
      });
    }

    const isValid = razorpayService.verifyPaymentSignature({
      orderId,
      paymentId,
      signature
    });

    if (!isValid) {
      return res.status(400).json({ success, message: 'Invalid payment signature' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success, message: 'Booking not found' });
    }

    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ success, message: 'Payment already verified' });
    }

    booking.paymentStatus = 'paid';
    booking.status = 'policy_issued';
    booking.paymentId = paymentId;
    booking.razorpayPaymentId = paymentId;
    booking.razorpaySignature = signature;
    await booking.save();

    const transaction = await Transaction.findOne({ bookingId._id });
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

    const policy = await InsurancePolicy.findOne({ bookingId._id });
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
          name.name,
          policyNumber?.policyNumber,
          planName.insurancePlanName,
          companyName.insuranceCompanyName,
          premium.finalAmount,
          startDate.policyStartDate,
          endDate.policyEndDate
        }
      });
    }

    if (user && notificationService && notificationService.sendSMS) {
      try {
        await notificationService.sendSMS(user.phone, 'policy_issued', {
          name.name,
          policyNumber?.policyNumber,
          premium.finalAmount
        });
      } catch (smsError) {
        console.log('SMS notification failed:', smsError);
      }
    }

    res.json({
      success,
      message: 'Payment verified and policy issued successfully',
      data: {
        bookingId._id,
        policyNumber?.policyNumber,
        status: 'active',
        policyUrl?.policyDocumentUrl
      }
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success, message: 'Payment verification failed: ' + error.message });
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
        booking? {
          status.status,
          paymentStatus.paymentStatus,
          createdAt.createdAt
        } };
    }));

    res.json({
      success,
      data});
  } catch (error) {
    console.error('Error fetching policies:', error);
    res.status(500).json({ success, message: 'Failed to fetch policies' });
  }
});

// Get single policy details
router.get('/my-policies/', auth, async (req, res) => {
  try {
    const policy = await InsurancePolicy.findById(req.params.id)
      .populate('planId')
      .populate('companyId', 'name companyLogo companyEmail companyPhone companyAddress');

    if (!policy) {
      return res.status(404).json({ success, message: 'Policy not found' });
    }

    if (policy.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success, message: 'Unauthorized' });
    }

    const booking = await Booking.findById(policy.bookingId);

    res.json({
      success,
      data: {
        ...policy.toObject(),
        booking? {
          status.status,
          paymentStatus.paymentStatus,
          createdAt.createdAt,
          paymentId.paymentId
        } }
    });
  } catch (error) {
    console.error('Error fetching policy:', error);
    res.status(500).json({ success, message: 'Failed to fetch policy' });
  }
});

// Cancel policy
router.post('/cancel-policy/', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const policy = await InsurancePolicy.findById(req.params.id);
    
    if (!policy) {
      return res.status(404).json({ success, message: 'Policy not found' });
    }

    if (policy.userId !== req.user.id) {
      return res.status(403).json({ success, message: 'Unauthorized' });
    }

    if (policy.status !== 'active') {
      return res.status(400).json({ success, message: 'Only active policies can be cancelled' });
    }

    const daysSincePurchase = (Date.now() - policy.createdAt) / (1000 * 60 * 60 * 24);
    if (daysSincePurchase > 15) {
      return res.status(400).json({ 
        success, 
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

    const transaction = await Transaction.findOne({ bookingId.bookingId });
    if (transaction) {
      transaction.status = 'refunded';
      transaction.refundAmount = policy.totalAmount;
      transaction.refundedAt = new Date();
      await transaction.save();
    }

    res.json({
      success,
      message: 'Policy cancelled successfully',
      data: {
        policyNumber.policyNumber,
        refundAmount.refundAmount
      }
    });

  } catch (error) {
    console.error('Error cancelling policy:', error);
    res.status(500).json({ success, message: 'Failed to cancel policy' });
  }
});

// Download policy document
router.get('/download-policy/', auth, async (req, res) => {
  try {
    const policy = await InsurancePolicy.findById(req.params.id);
    
    if (!policy) {
      return res.status(404).json({ success, message: 'Policy not found' });
    }

    if (policy.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success, message: 'Unauthorized' });
    }

    if (!policy.policyDocumentUrl) {
      return res.status(404).json({ success, message: 'Policy document not available' });
    }

    res.json({
      success,
      data: {
        url.policyDocumentUrl,
        policyNumber.policyNumber
      }
    });

  } catch (error) {
    console.error('Error downloading policy:', error);
    res.status(500).json({ success, message: 'Failed to download policy' });
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
        success,
        message: 'Missing required fields, amount, description'
      });
    }

    const policy = await InsurancePolicy.findById(policyId);
    if (!policy) {
      return res.status(404).json({ success, message: 'Policy not found' });
    }

    if (policy.userId !== req.user.id) {
      return res.status(403).json({ success, message: 'Unauthorized' });
    }

    if (policy.status !== 'active') {
      return res.status(400).json({ success, message: 'Only active policies can file claims' });
    }

    await policy.addClaim({
      amount,
      description,
      hospitalName,
      hospitalAddress,
      admissionDate,
      documents|| []
    });

    const user = await User.findById(req.user.id);
    if (user && notificationService && notificationService.sendEmail) {
      await notificationService.sendEmail(user.email, 'Claim Submitted', {
        template: 'claim_submitted',
        data: {
          name.name,
          policyNumber.policyNumber,
          claimAmount,
          claimId.claims[policy.claims.length - 1].claimId
        }
      });
    }

    res.json({
      success,
      message: 'Claim submitted successfully',
      data: {
        claim.claims[policy.claims.length - 1]
      }
    });

  } catch (error) {
    console.error('Error submitting claim:', error);
    res.status(500).json({ success, message: 'Failed to submit claim' });
  }
});

// Get all claims for a policy
router.get('/claims/', auth, async (req, res) => {
  try {
    const policy = await InsurancePolicy.findById(req.params.policyId);
    
    if (!policy) {
      return res.status(404).json({ success, message: 'Policy not found' });
    }

    if (policy.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success, message: 'Unauthorized' });
    }

    res.json({
      success,
      data.claims || []
    });

  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ success, message: 'Failed to fetch claims' });
  }
});

// Get claim details
router.get('/claims//', auth, async (req, res) => {
  try {
    const policy = await InsurancePolicy.findById(req.params.policyId);
    
    if (!policy) {
      return res.status(404).json({ success, message: 'Policy not found' });
    }

    if (policy.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success, message: 'Unauthorized' });
    }

    const claim = policy.getClaim(req.params.claimId);
    if (!claim) {
      return res.status(404).json({ success, message: 'Claim not found' });
    }

    res.json({
      success,
      data});

  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({ success, message: 'Failed to fetch claim' });
  }
});

// ============================================
// STATS ROUTES
// ============================================

// Get platform stats
router.get('/stats', async (req, res) => {
  try {
    const totalPlans = await InsurancePlan.countDocuments({ isActive});
    const totalCompanies = await User.countDocuments({ 
      role: 'insurance_company', 
      isActive,
      isVerified});
    const totalPolicies = await InsurancePolicy.countDocuments({ status: 'active' });
    
    const plans = await InsurancePlan.find({ isActive});
    let avgSettlementRatio = 0;
    if (plans.length > 0) {
      const totalRatio = plans.reduce((sum, plan) => {
        return sum + (plan.claimProcess?.claimSettlementRatio || 0);
      }, 0);
      avgSettlementRatio = Math.round(totalRatio / plans.length);
    }

    const corporateStats = await InsurancePlan.getCorporateStats();

    res.json({
      success,
      data: {
        totalPlans,
        totalCompanies,
        policiesIssued,
        claimSettlementRate|| 95,
        corporate}
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success, message: 'Failed to fetch stats' });
  }
});

// ============================================
// 🆕 SEARCH SUGGESTIONS
// ============================================

// Get search suggestions based on query
router.get('/search-suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ success, data: [] });
    }

    const suggestions = await InsurancePlan.find({
      isActive,
      $or: [
        { planName: { $regex, $options: 'i' } },
        { description: { $regex, $options: 'i' } },
        { tags: { $regex, $options: 'i' } }
      ]
    })
      .limit(5)
      .select('planName companyId description');

    res.json({
      success,
      data});
  } catch (error) {
    console.error('Error fetching search suggestions:', error);
    res.status(500).json({
      success,
      message: 'Failed to fetch search suggestions'
    });
  }
});

module.exports = router;


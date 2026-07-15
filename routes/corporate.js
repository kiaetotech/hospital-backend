const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const CorporatePlan = require('../models/CorporatePlan');
const CorporateEmployee = require('../models/CorporateEmployee');
const CorporateHR = require('../models/CorporateHR');
const User = require('../models/User');
const { authenticate: auth } = require('../middleware/auth');

// ============================================
// AUTHENTICATE HR MIDDLEWARE
// ============================================

const authenticateHR = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hr = await CorporateHR.findById(decoded.id);
    if (!hr) {
      return res.status(401).json({ success: false, message: 'HR not found' });
    }
    if (!hr.isActive) {
      return res.status(403).json({ success: false, message: 'Account suspended' });
    }

    req.hr = hr;
    req.companyId = hr.companyId;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ============================================
// PUBLIC ROUTES
// ============================================

// Get all corporate plans (Public)
router.get('/plans', async (req, res) => {
  try {
    const { minEmployees, maxEmployees, sort, page = 1, limit = 10 } = req.query;

    const query = { isActive: true, isVerified: true, status: 'active' };
    if (minEmployees) query.employeeCount = { $gte: parseInt(minEmployees) };
    if (maxEmployees) query.employeeCount = { ...query.employeeCount, $lte: parseInt(maxEmployees) };

    const sortOptions = sort === 'price_low' ? { totalPremium: 1 } : sort === 'price_high' ? { totalPremium: -1 } : { createdAt: -1 };

    const skip = (page - 1) * limit;
    const plans = await CorporatePlan.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CorporatePlan.countDocuments(query);

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
    console.error('Error fetching corporate plans:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch plans' });
  }
});

// Get single corporate plan (Public)
router.get('/plans/:id', async (req, res) => {
  try {
    const plan = await CorporatePlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch plan' });
  }
});

// Get stats (Public)
router.get('/stats', async (req, res) => {
  try {
    const companiesServed = await CorporatePlan.countDocuments({ status: 'active', isVerified: true });
    const employeesCovered = await CorporateEmployee.countDocuments({ isActive: true });
    const plansAvailable = await CorporatePlan.countDocuments({ isActive: true, isVerified: true });

    // Calculate satisfaction rate (mock for now)
    const satisfactionRate = 96;

    res.json({
      success: true,
      data: {
        companiesServed,
        employeesCovered,
        plansAvailable,
        satisfactionRate
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// ============================================
// COMPANY ENROLLMENT (Customer/Public)
// ============================================

// Register company for corporate plan
router.post('/register', auth, async (req, res) => {
  try {
    const {
      companyName,
      companyGST,
      companyPAN,
      employeeCount,
      planName,
      planType,
      coverageAmount,
      premiumPerEmployee,
      features,
      inclusions,
      exclusions,
      benefits,
      startDate,
      endDate,
      hrContact,
      employees
    } = req.body;

    // Validate required fields
    if (!companyName || !employeeCount || !planName || !coverageAmount || !premiumPerEmployee || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: companyName, employeeCount, planName, coverageAmount, premiumPerEmployee, startDate'
      });
    }

    const totalPremium = premiumPerEmployee * employeeCount;

    // Create corporate plan
    const plan = new CorporatePlan({
      companyId: req.user.id,
      companyName,
      companyGST,
      companyPAN,
      employeeCount,
      planName,
      planType: planType || 'group_health',
      coverageAmount,
      premiumPerEmployee,
      totalPremium,
      features: features || [],
      inclusions: inclusions || [],
      exclusions: exclusions || [],
      benefits: benefits || [],
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : new Date(new Date(startDate).setFullYear(new Date(startDate).getFullYear() + 1)),
      renewalDate: endDate ? new Date(endDate) : new Date(new Date(startDate).setFullYear(new Date(startDate).getFullYear() + 1)),
      hrContact: hrContact || {},
      status: 'pending',
      isVerified: false,
      createdBy: req.user.id
    });

    await plan.save();

    // Add employees if provided
    if (employees && employees.length > 0) {
      const addedEmployees = [];
      for (const emp of employees) {
        if (emp.name && emp.email && emp.phone) {
          const employee = new CorporateEmployee({
            companyId: req.user.id,
            planId: plan._id,
            name: emp.name,
            email: emp.email,
            phone: emp.phone,
            department: emp.department || '',
            designation: emp.designation || '',
            coverageAmount: coverageAmount,
            premiumAmount: premiumPerEmployee,
            isActive: true
          });
          await employee.save();
          addedEmployees.push(employee);
        }
      }
      plan.employees = addedEmployees.map(e => ({
        name: e.name,
        email: e.email,
        phone: e.phone,
        department: e.department,
        designation: e.designation,
        employeeId: e.employeeId
      }));
      await plan.save();
    }

    // Create HR account if hrContact provided
    if (hrContact && hrContact.email) {
      const existingHR = await CorporateHR.findOne({ email: hrContact.email });
      if (!existingHR) {
        const hashedPassword = await bcrypt.hash('TempPass@123', 10);
        const hr = new CorporateHR({
          companyId: plan._id,
          name: hrContact.name || 'HR Admin',
          email: hrContact.email,
          password: hashedPassword,
          phone: hrContact.phone || '',
          role: 'hr_admin',
          isActive: true
        });
        await hr.save();
      }
    }

    res.json({
      success: true,
      message: 'Corporate plan submitted for verification',
      data: {
        planId: plan._id,
        status: plan.status,
        employeeCount: plan.employees.length
      }
    });

  } catch (error) {
    console.error('Error registering corporate plan:', error);
    res.status(500).json({ success: false, message: 'Registration failed: ' + error.message });
  }
});

// ============================================
// HR LOGIN (Corporate HR)
// ============================================

// HR Login
router.post('/hr/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const hr = await CorporateHR.findOne({ email });
    if (!hr) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, hr.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!hr.isActive) {
      return res.status(403).json({ success: false, message: 'Account suspended. Please contact admin.' });
    }

    const token = jwt.sign(
      { id: hr._id, role: 'corporate_hr', companyId: hr.companyId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    hr.lastLogin = new Date();
    await hr.save();

    res.json({
      success: true,
      data: {
        token,
        id: hr._id,
        name: hr.name,
        email: hr.email,
        companyId: hr.companyId,
        role: hr.role,
        isActive: hr.isActive
      }
    });

  } catch (error) {
    console.error('HR Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed: ' + error.message });
  }
});

// Verify HR Token
router.get('/hr/verify', authenticateHR, async (req, res) => {
  try {
    const hr = await CorporateHR.findById(req.hr._id);
    if (!hr) {
      return res.status(404).json({ success: false, message: 'HR not found' });
    }
    res.json({ success: true, data: hr });
  } catch (error) {
    console.error('HR verify error:', error);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

// ============================================
// HR DASHBOARD (Authenticated HR)
// ============================================

// Get HR dashboard stats
router.get('/hr/dashboard', authenticateHR, async (req, res) => {
  try {
    const companyId = req.companyId;

    const plan = await CorporatePlan.findById(companyId);
    const employees = await CorporateEmployee.find({ companyId });

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.isActive).length;
    const totalClaims = employees.reduce((sum, e) => sum + (e.claims?.length || 0), 0);
    const pendingClaims = employees.reduce((sum, e) => sum + (e.claims?.filter(c => c.status === 'pending').length || 0), 0);

    // 🆕 Get recent bookings
    let recentBookings = [];
    try {
      recentBookings = await Booking.find({ companyId: companyId.toString() })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    } catch (e) { console.log('Bookings fetch skipped'); }

    // 🆕 Get utilization by service type
    let utilization = {};
    try {
      const utilData = await Booking.aggregate([
        { $match: { companyId: companyId.toString(), status: { $in: ['completed', 'confirmed'] } } },
        { $group: { _id: '$bookingType', count: { $sum: 1 } } }
      ]);
      utilData.forEach(u => { utilization[u._id || 'other'] = u.count; });
    } catch (e) { console.log('Utilization fetch skipped'); }

    // 🆕 Get department breakdown
    let departmentBreakdown = {};
    try {
      const deptData = await CorporateEmployee.aggregate([
        { $match: { companyId: new mongoose.Types.ObjectId(companyId), isActive: true } },
        { $group: { _id: '$department', count: { $sum: 1 } } }
      ]);
      deptData.forEach(d => { departmentBreakdown[d._id || 'Unassigned'] = d.count; });
    } catch (e) { console.log('Department breakdown skipped'); }

    res.json({
      success: true,
      data: {
        totalEmployees,
        activeEmployees,
        totalPremium: plan?.totalPremium || 0,
        walletBalance: plan?.walletBalance || 0,
        totalClaims,
        pendingClaims,
        planStatus: plan?.status || 'pending',
        planName: plan?.planName || 'No active plan',
        utilization,
        departmentBreakdown,
        recentBookings,
        monthlySpend: [],
        wellnessScores: []
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
  }
});

// Get all employees (HR view)
router.get('/hr/employees', authenticateHR, async (req, res) => {
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
      success: true,
      data: employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Employees fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employees' });
  }
});

// Add employee(s) to corporate plan
router.post('/hr/employees', authenticateHR, async (req, res) => {
  try {
    const companyId = req.companyId;
    const { employees } = req.body;

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one employee required' });
    }

    const plan = await CorporatePlan.findById(companyId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    if (plan.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Plan is not active. Please contact admin.' });
    }

    const addedEmployees = [];
    for (const emp of employees) {
      if (!emp.name || !emp.email || !emp.phone) {
        continue; // Skip incomplete entries
      }

      // Check if employee already exists
      const existing = await CorporateEmployee.findOne({ email: emp.email, companyId });
      if (existing) {
        continue; // Skip duplicate
      }

      const employee = new CorporateEmployee({
        companyId,
        planId: plan._id,
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        department: emp.department || '',
        designation: emp.designation || '',
        dateOfBirth: emp.dateOfBirth ? new Date(emp.dateOfBirth) : null,
        gender: emp.gender || 'other',
        joiningDate: emp.joiningDate ? new Date(emp.joiningDate) : new Date(),
        address: emp.address || {},
        coverageAmount: plan.coverageAmount,
        premiumAmount: plan.premiumPerEmployee,
        isActive: true
      });

      await employee.save();

      // Add to plan's employees array
      plan.employees.push({
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        department: employee.department,
        designation: employee.designation,
        employeeId: employee.employeeId
      });

      addedEmployees.push(employee);
    }

    // Update employee count
    plan.employeeCount = plan.employees.length;
    plan.totalPremium = plan.employeeCount * plan.premiumPerEmployee;
    await plan.save();

    res.json({
      success: true,
      message: `Added ${addedEmployees.length} employees`,
      data: addedEmployees,
      totalEmployees: plan.employeeCount
    });

  } catch (error) {
    console.error('Add employee error:', error);
    res.status(500).json({ success: false, message: 'Failed to add employees: ' + error.message });
  }
});

// Update employee
router.put('/hr/employees/:id', authenticateHR, async (req, res) => {
  try {
    const companyId = req.companyId;
    const employeeId = req.params.id;
    const { isActive, department, designation, phone } = req.body;

    const employee = await CorporateEmployee.findOne({ _id: employeeId, companyId });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (isActive !== undefined) employee.isActive = isActive;
    if (department) employee.department = department;
    if (designation) employee.designation = designation;
    if (phone) employee.phone = phone;

    employee.updatedAt = new Date();
    await employee.save();

    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: employee
    });

  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ success: false, message: 'Failed to update employee' });
  }
});

// Delete employee (soft delete)
router.delete('/hr/employees/:id', authenticateHR, async (req, res) => {
  try {
    const companyId = req.companyId;
    const employeeId = req.params.id;

    const employee = await CorporateEmployee.findOne({ _id: employeeId, companyId });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    employee.isActive = false;
    employee.updatedAt = new Date();
    await employee.save();

    // Update plan employee count
    const plan = await CorporatePlan.findById(companyId);
    if (plan) {
      plan.employeeCount = plan.employees.filter(e => e.isActive !== false).length;
      plan.totalPremium = plan.employeeCount * plan.premiumPerEmployee;
      await plan.save();
    }

    res.json({
      success: true,
      message: 'Employee removed successfully',
      data: employee
    });

  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove employee' });
  }
});

// ============================================
// HR REPORTS
// ============================================

// Get reports
router.get('/hr/reports', authenticateHR, async (req, res) => {
  try {
    const companyId = req.companyId;
    const { type, startDate, endDate } = req.query;

    const employees = await CorporateEmployee.find({ companyId });

    // Basic report structure
    let report = {
      companyId,
      generatedAt: new Date(),
      totalEmployees: employees.length,
      activeEmployees: employees.filter(e => e.isActive).length,
      departments: {},
      claims: {
        total: 0,
        pending: 0,
        approved: 0,
        settled: 0,
        rejected: 0,
        totalAmount: 0
      }
    };

    // Department breakdown
    employees.forEach(e => {
      const dept = e.department || 'Unassigned';
      if (!report.departments[dept]) {
        report.departments[dept] = { count: 0, active: 0 };
      }
      report.departments[dept].count++;
      if (e.isActive) report.departments[dept].active++;
    });

    // Claim breakdown
    employees.forEach(e => {
      if (e.claims) {
        e.claims.forEach(c => {
          report.claims.total++;
          report.claims.totalAmount += c.amount || 0;
          if (c.status === 'pending') report.claims.pending++;
          else if (c.status === 'approved') report.claims.approved++;
          else if (c.status === 'settled') report.claims.settled++;
          else if (c.status === 'rejected') report.claims.rejected++;
        });
      }
    });

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Get pending corporate plans (Admin only)
router.get('/admin/pending', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const plans = await CorporatePlan.find({ status: 'pending', isVerified: false })
      .populate('companyId', 'name email phone');

    res.json({
      success: true,
      data: plans
    });

  } catch (error) {
    console.error('Pending plans fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending plans' });
  }
});

// Verify corporate plan (Admin only)
router.put('/admin/verify/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { status } = req.body; // 'approved' or 'rejected'
    const plan = await CorporatePlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    plan.status = status === 'approved' ? 'active' : 'cancelled';
    plan.isVerified = status === 'approved';
    plan.verifiedBy = req.user.id;
    plan.verifiedAt = new Date();
    await plan.save();

    // If approved, activate all employees
    if (status === 'approved') {
      await CorporateEmployee.updateMany(
        { planId: plan._id },
        { isActive: true, isVerified: true }
      );
    }

    res.json({
      success: true,
      message: `Plan ${status}`,
      data: plan
    });

  } catch (error) {
    console.error('Plan verification error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify plan' });
  }
});

// Get all corporate plans (Admin only)
router.get('/admin/all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const plans = await CorporatePlan.find(query)
      .populate('companyId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CorporatePlan.countDocuments(query);

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
    console.error('Admin plans fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch plans' });
  }
});

// Delete corporate plan (Admin only)
router.delete('/admin/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const plan = await CorporatePlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    // Soft delete
    plan.isActive = false;
    plan.status = 'cancelled';
    await plan.save();

    // Deactivate all employees
    await CorporateEmployee.updateMany(
      { planId: plan._id },
      { isActive: false }
    );

    res.json({
      success: true,
      message: 'Plan deleted successfully'
    });

  } catch (error) {
    console.error('Plan deletion error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete plan' });
  }
});

// ============================================
// 🆕 COMPANY REGISTRATION (MARKETPLACE MODEL)
// ============================================
router.post('/company/register', async (req, res) => {
  try {
    const {
      companyName, companyGST, companyPAN, employeeCount, city, state,
      selectedServices, budgetPerEmployee,
      hrName, hrEmail, hrPhone, hrPassword
    } = req.body;

    if (!companyName || !employeeCount || !hrName || !hrEmail || !hrPhone || !hrPassword) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!selectedServices || selectedServices.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one service' });
    }

    const existingHR = await CorporateHR.findOne({ email: hrEmail });
    if (existingHR) {
      return res.status(400).json({ success: false, message: 'HR email already registered' });
    }

    const plan = new CorporatePlan({
      companyName, companyGST, companyPAN, employeeCount: parseInt(employeeCount),
      planName: `${companyName} Corporate Plan`,
      planType: 'group_wellness',
      coverageAmount: (parseInt(budgetPerEmployee) || 0) * parseInt(employeeCount),
      premiumPerEmployee: parseInt(budgetPerEmployee) || 0,
      totalPremium: (parseInt(budgetPerEmployee) || 0) * parseInt(employeeCount),
      features: selectedServices,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      hrContact: { name: hrName, email: hrEmail, phone: hrPhone },
      status: 'pending',
      isVerified: false,
      createdBy: null
    });

    await plan.save();

    const hashedPassword = await bcrypt.hash(hrPassword, 10);
    const hr = new CorporateHR({
      companyId: plan._id,
      name: hrName,
      email: hrEmail,
      password: hashedPassword,
      phone: hrPhone,
      role: 'hr_admin',
      isActive: true
    });
    await hr.save();

    const token = jwt.sign(
      { id: hr._id, role: 'corporate_hr', companyId: plan._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Company registered successfully',
      data: { companyId: plan._id, hrId: hr._id, token, companyName, status: 'pending' }
    });

  } catch (error) {
    console.error('Company registration error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 ANALYTICS ENDPOINTS
// ============================================

// GET /api/corporate/hr/analytics — Full analytics data
router.get('/hr/analytics', authenticateHR, async (req, res) => {
  try {
    const companyId = req.companyId;

    // Department breakdown
    const deptBreakdown = await CorporateEmployee.aggregate([
      { $match: { companyId: mongoose.Types.ObjectId(companyId), isActive: true } },
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);

    const departmentBreakdown = {};
    deptBreakdown.forEach(d => { departmentBreakdown[d._id || 'Unassigned'] = d.count; });

    // Monthly spend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlySpend = await Booking.aggregate([
      { $match: { companyId: companyId.toString(), createdAt: { $gte: sixMonthsAgo }, status: { $in: ['completed', 'confirmed'] } } },
      { $group: { _id: { $dateToString: { format: '%b', date: '$createdAt' } }, amount: { $sum: '$finalAmount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Service utilization
    const utilization = await Booking.aggregate([
      { $match: { companyId: companyId.toString(), status: { $in: ['completed', 'confirmed'] } } },
      { $group: { _id: '$bookingType', count: { $sum: 1 } } }
    ]);

    const utilizationObj = {};
    utilization.forEach(u => { utilizationObj[u._id || 'other'] = u.count; });

    // Wellness scores (mock for now — real calculation needs health data)
    const wellnessScores = await CorporateEmployee.find({ companyId, isActive: true })
      .select('name department')
      .limit(10)
      .lean();

    const wellnessWithScores = wellnessScores.map(e => ({
      name: e.name,
      department: e.department || 'General',
      score: Math.floor(Math.random() * 30) + 65 // Mock: 65-95 range
    }));

    res.json({
      success: true,
      data: {
        departmentBreakdown,
        monthlySpend: monthlySpend.map(m => ({ month: m._id, amount: m.amount, count: m.count })),
        utilization: utilizationObj,
        wellnessScores: wellnessWithScores
      }
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/corporate/hr/bulk-book — Bulk booking for employees
router.post('/hr/bulk-book', authenticateHR, async (req, res) => {
  try {
    const companyId = req.companyId;
    const { employeeIds, serviceType, providerId } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0 || !serviceType) {
      return res.status(400).json({ success: false, message: 'employeeIds and serviceType required' });
    }

    const employees = await CorporateEmployee.find({ _id: { $in: employeeIds }, companyId, isActive: true });
    if (employees.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid employees found' });
    }

    const bookings = [];
    for (const emp of employees) {
      const booking = new Booking({
        userId: emp._id,
        companyId: companyId.toString(),
        employeeName: emp.name,
        employeeEmail: emp.email,
        bookingType: serviceType,
        providerId: providerId || null,
        status: 'confirmed',
        paymentStatus: 'wallet',
        createdAt: new Date()
      });
      await booking.save();
      bookings.push({ id: booking._id, employee: emp.name });
    }

    res.json({
      success: true,
      message: `${bookings.length} bookings created`,
      data: { bookings, count: bookings.length }
    });

  } catch (error) {
    console.error('Bulk book error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/corporate/hr/bookings — All bookings for company
router.get('/hr/bookings', authenticateHR, async (req, res) => {
  try {
    const companyId = req.companyId;
    const bookings = await Booking.find({ companyId: companyId.toString() })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 WALLET MANAGEMENT
// ============================================

// Get wallet balance
router.get('/hr/wallet', authenticateHR, async (req, res) => {
  try {
    const plan = await CorporatePlan.findById(req.companyId).select('walletBalance');
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    
    res.json({ success: true, data: { balance: plan.walletBalance || 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Top-up wallet (simulated payment)
router.post('/hr/wallet/topup', authenticateHR, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid amount required' });
    
    const plan = await CorporatePlan.findById(req.companyId);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    
    plan.walletBalance = (plan.walletBalance || 0) + Number(amount);
    await plan.save();
    
    res.json({ success: true, message: `₹${amount} added`, data: { balance: plan.walletBalance } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 EMPLOYEE BOOKING WITH WALLET DEDUCTION
// ============================================

// Employee books service — wallet auto-deducted
router.post('/employee/book', async (req, res) => {
  try {
    const { employeeId, serviceType, providerId, amount, serviceName } = req.body;
    
    if (!employeeId || !serviceType || !amount) {
      return res.status(400).json({ success: false, message: 'employeeId, serviceType, amount required' });
    }
    
    // Find employee
    const employee = await CorporateEmployee.findById(employeeId);
    if (!employee || !employee.isActive) {
      return res.status(400).json({ success: false, message: 'Employee not found or inactive' });
    }
    
    // Find company plan
    const plan = await CorporatePlan.findById(employee.companyId);
    if (!plan || plan.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Company plan not active' });
    }
    
    // Check wallet balance
    if ((plan.walletBalance || 0) < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance. Contact HR.' });
    }
    
    // Deduct from wallet
    plan.walletBalance -= amount;
    await plan.save();
    
    // Create booking
    const booking = new Booking({
      userId: employee._id,
      companyId: plan._id.toString(),
      employeeName: employee.name,
      employeeEmail: employee.email,
      bookingType: serviceType,
      providerId: providerId || null,
      serviceName: serviceName || serviceType,
      finalAmount: amount,
      paymentStatus: 'wallet',
      status: 'confirmed',
      createdAt: new Date()
    });
    await booking.save();
    
    res.json({
      success: true,
      message: 'Booking confirmed. Wallet deducted.',
      data: {
        bookingId: booking._id,
        amount,
        remainingBalance: plan.walletBalance,
        employeeName: employee.name
      }
    });
    
  } catch (error) {
    console.error('Employee booking error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
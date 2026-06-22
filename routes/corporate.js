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

    res.json({
      success: true,
      data: {
        totalEmployees,
        activeEmployees,
        totalPremium: plan?.totalPremium || 0,
        totalClaims,
        pendingClaims,
        planStatus: plan?.status || 'pending',
        planName: plan?.planName || 'No active plan'
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

module.exports = router;
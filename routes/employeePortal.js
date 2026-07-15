const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const CorporateEmployee = require('../models/CorporateEmployee');
const CorporatePlan = require('../models/CorporatePlan');
const CorporateHR = require('../models/CorporateHR');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const Hospital = require('../models/Hospital');
const OnlineDoctor = require('../models/OnlineDoctor');
const DiagnosticsProvider = require('../models/DiagnosticsProvider');
const TestMaster = require('../models/TestMaster');
const Ambulance = require('../models/Ambulance');
const Caregiver = require('../models/Caregiver');
const MentalHealthTherapist = require('../models/MentalHealthTherapist');
const AyurvedaDoctor = require('../models/AyurvedaDoctor');
const HomeopathyDoctor = require('../models/HomeopathyDoctor');
const WellnessCenter = require('../models/WellnessCenter');
const commissionService = require('../services/commissionService');
const razorpayService = require('../services/razorpayService');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital_platform_secret_key_2024';

// Employee Authentication Middleware
const authenticateEmployee = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. Please login.' });
  
  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    if (decoded.role !== 'employee') return res.status(403).json({ error: 'Employee access required.' });
    
    const employee = await CorporateEmployee.findById(decoded.id).populate('corporateId');
    if (!employee || employee.status !== 'active') return res.status(403).json({ error: 'Account inactive or not found.' });
    
    req.employee = employee;
    req.corporate = employee.corporateId;
    next();
  });
};

// ============================================
// EMPLOYEE AUTH
// ============================================

// Employee Login
router.post('/login', async (req, res) => {
  try {
    const { employeeId, phone } = req.body;
    const employee = await CorporateEmployee.findOne({ 
      $or: [{ employeeId }, { phone }],
      status: 'active'
    }).populate('corporateId');
    
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found or inactive' });
    
    const token = jwt.sign({ id: employee._id, role: 'employee' }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      token,
      employee: {
        id: employee._id,
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        department: employee.department,
        designation: employee.designation,
        corporate: {
          id: employee.corporateId._id,
          name: employee.corporateId.companyName,
          walletBalance: employee.corporateId.walletBalance,
          planType: employee.corporateId.planType,
          servicesEnabled: employee.corporateId.servicesEnabled || []
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Employee Profile
router.get('/profile', authenticateEmployee, async (req, res) => {
  try {
    const employee = await CorporateEmployee.findById(req.employee._id).populate('corporateId');
    const recentBookings = await Booking.find({ userId: req.employee._id, userType: 'employee' })
      .sort({ createdAt: -1 }).limit(10).lean();
    
    res.json({
      success: true,
      employee: {
        id: employee._id,
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        department: employee.department,
        designation: employee.designation,
        walletBalance: employee.walletBalance,
        benefitsUsed: employee.benefitsUsed || 0,
        benefitsLimit: employee.benefitsLimit || 0
      },
      corporate: {
        id: employee.corporateId._id,
        name: employee.corporateId.companyName,
        planType: employee.corporateId.planType,
        walletBalance: employee.corporateId.walletBalance,
        servicesEnabled: employee.corporateId.servicesEnabled || [],
        coverageDetails: employee.corporateId.coverageDetails || {}
      },
      recentBookings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// SERVICE BROWSING (All 8 Providers)
// ============================================

// Get available services based on corporate plan
router.get('/services', authenticateEmployee, async (req, res) => {
  try {
    const servicesEnabled = req.corporate.servicesEnabled || [];
    const coverage = req.corporate.coverageDetails || {};
    
    const services = [];
    
    if (servicesEnabled.includes('hospitals')) {
      services.push({
        type: 'hospitals',
        name: 'Hospital OPD & Admissions',
        icon: '🏥',
        coverage: coverage.hospitals || {},
        link: '/employee/hospitals'
      });
    }
    if (servicesEnabled.includes('onlineDoctor')) {
      services.push({
        type: 'onlineDoctor',
        name: 'Online Doctor Consultation',
        icon: '📱',
        coverage: coverage.onlineDoctor || {},
        link: '/employee/online-doctor'
      });
    }
    if (servicesEnabled.includes('diagnostics')) {
      services.push({
        type: 'diagnostics',
        name: 'Lab Tests & Health Packages',
        icon: '🔬',
        coverage: coverage.diagnostics || {},
        link: '/employee/diagnostics'
      });
    }
    if (servicesEnabled.includes('ambulance')) {
      services.push({
        type: 'ambulance',
        name: 'Ambulance Service',
        icon: '🚑',
        coverage: coverage.ambulance || {},
        link: '/employee/ambulance'
      });
    }
    if (servicesEnabled.includes('caregivers')) {
      services.push({
        type: 'caregivers',
        name: 'Home Care Services',
        icon: '🏠',
        coverage: coverage.caregivers || {},
        link: '/employee/caregivers'
      });
    }
    if (servicesEnabled.includes('mentalHealth')) {
      services.push({
        type: 'mentalHealth',
        name: 'Mental Wellness',
        icon: '🧠',
        coverage: coverage.mentalHealth || {},
        link: '/employee/mental-health'
      });
    }
    if (servicesEnabled.includes('ayurveda')) {
      services.push({
        type: 'ayurveda',
        name: 'Ayurveda & Wellness',
        icon: '🧘',
        coverage: coverage.ayurveda || {},
        link: '/employee/ayurveda'
      });
    }
    if (servicesEnabled.includes('homeopathy')) {
      services.push({
        type: 'homeopathy',
        name: 'Homeopathy',
        icon: '🌿',
        coverage: coverage.homeopathy || {},
        link: '/employee/homeopathy'
      });
    }
    
    res.json({ success: true, services, walletBalance: req.corporate.walletBalance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// BOOKING WITH WALLET DEDUCTION
// ============================================

// Create booking with wallet payment
router.post('/book', authenticateEmployee, async (req, res) => {
  try {
    const { serviceType, providerId, serviceId, amount, bookingDetails } = req.body;
    
    // Check coverage
    const coverage = req.corporate.coverageDetails?.[serviceType] || {};
    const coveragePercent = coverage.percentage || 0;
    const maxCoverage = coverage.maxAmount || 0;
    
    let coveredAmount = Math.min((amount * coveragePercent) / 100, maxCoverage);
    let employeePayAmount = amount - coveredAmount;
    
    // Check wallet balance
    if (employeePayAmount > req.employee.walletBalance) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient wallet balance. Need ₹${employeePayAmount}, have ₹${req.employee.walletBalance}` 
      });
    }
    
    // Deduct from employee wallet
    req.employee.walletBalance -= employeePayAmount;
    await req.employee.save();
    
    // Create booking
    const booking = await Booking.create({
      userId: req.employee._id,
      userType: 'employee',
      corporateId: req.corporate._id,
      serviceType,
      providerId,
      serviceId,
      amount,
      coveredAmount,
      employeePaid: employeePayAmount,
      bookingDetails,
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'corporate_wallet'
    });
    
    // Create transaction record
    await Transaction.create({
      userId: req.employee._id,
      userType: 'employee',
      corporateId: req.corporate._id,
      bookingId: booking._id,
      type: 'debit',
      amount: employeePayAmount,
      description: `${serviceType} booking - ${bookingDetails?.name || 'Service'}`,
      status: 'completed'
    });
    
    // Commission calculation
    try {
      await commissionService.calculateAndStore(booking._id, serviceType, amount);
    } catch (e) {
      console.log('Commission calc skipped:', e.message);
    }
    
    res.json({
      success: true,
      booking,
      walletBalance: req.employee.walletBalance,
      breakdown: { total: amount, covered: coveredAmount, paid: employeePayAmount }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get employee bookings
router.get('/bookings', authenticateEmployee, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.employee._id, userType: 'employee' })
      .sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get wallet transaction history
router.get('/transactions', authenticateEmployee, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.employee._id, userType: 'employee' })
      .sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, transactions, walletBalance: req.employee.walletBalance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
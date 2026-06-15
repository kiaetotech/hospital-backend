const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Lender = require('../models/Lender');
const LoanApplication = require('../models/LoanApplication');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital_platform_secret_key_2024';

// ============================================
// HELPER FUNCTIONS
// ============================================

const generateLenderId = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `LDR_${timestamp}_${random}`;
};

const generateApiKey = () => {
  return 'LDR_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 8);
};

const generateApiSecret = () => {
  return Math.random().toString(36).substring(2, 30);
};

// ============================================
// LENDER REGISTRATION & AUTH
// ============================================

// Lender self-registration
router.post('/register', async (req, res) => {
  try {
    const {
      businessName,
      registrationNumber,
      email,
      phone,
      password,
      address,
      lenderType,
      servicePincodes,
      loanProducts,
      commissionRate
    } = req.body;
    
    // Check if already exists
    const existing = await Lender.findOne({ 
      $or: [{ email }, { registrationNumber }] 
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Lender already registered with this email or registration number' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const lenderId = generateLenderId();
    const apiKey = generateApiKey();
    const apiSecret = generateApiSecret();
    
    const lender = new Lender({
      lenderId,
      businessName,
      registrationNumber,
      email,
      phone,
      password: hashedPassword,
      address,
      lenderType: lenderType || 'regional',
      servicePincodes: servicePincodes || [],
      serviceCities: [],
      serviceStates: [],
      loanProducts: loanProducts || [],
      commissionRate: commissionRate || 2,
      apiConfig: {
        apiKey,
        apiSecret,
        webhookUrl: '',
        supportsWebhook: false
      },
      status: 'pending',
      createdAt: new Date()
    });
    
    await lender.save();
    
    res.json({
      success: true,
      lenderId,
      apiKey,
      apiSecret,
      message: 'Registration submitted for admin approval. You will receive email once verified.'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Lender login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const lender = await Lender.findOne({ email });
    if (!lender) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, lender.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (lender.status !== 'active') {
      return res.status(403).json({ error: `Account is ${lender.status}. Please contact support.` });
    }
    
    const token = jwt.sign(
      { id: lender._id, lenderId: lender.lenderId, email: lender.email, role: 'lender' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      token,
      lender: {
        lenderId: lender.lenderId,
        businessName: lender.businessName,
        email: lender.email,
        status: lender.status,
        commissionRate: lender.commissionRate
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get lender profile
router.get('/profile', global.authenticateLender, async (req, res) => {
  try {
    const lender = await Lender.findById(req.user.id).select('-password');
    if (!lender) {
      return res.status(404).json({ error: 'Lender not found' });
    }
    res.json(lender);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update lender profile
router.put('/profile', global.authenticateLender, async (req, res) => {
  try {
    const { servicePincodes, serviceCities, serviceStates, loanProducts, webhookUrl } = req.body;
    
    const lender = await Lender.findById(req.user.id);
    if (!lender) {
      return res.status(404).json({ error: 'Lender not found' });
    }
    
    if (servicePincodes) lender.servicePincodes = servicePincodes;
    if (serviceCities) lender.serviceCities = serviceCities;
    if (serviceStates) lender.serviceStates = serviceStates;
    if (loanProducts) lender.loanProducts = loanProducts;
    if (webhookUrl) lender.apiConfig.webhookUrl = webhookUrl;
    
    lender.updatedAt = new Date();
    await lender.save();
    
    res.json({ success: true, lender: lender.toObject({ getters: true, transform: (doc, ret) => { delete ret.password; return ret; } }) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ============================================
// LENDER DASHBOARD & APPLICATIONS
// ============================================

// Get dashboard stats
router.get('/stats', global.authenticateLender, async (req, res) => {
  try {
    const lenderId = req.user.id;
    
    const totalApplications = await LoanApplication.countDocuments({ lenderId });
    const pendingApplications = await LoanApplication.countDocuments({ lenderId, status: 'submitted' });
    const underReview = await LoanApplication.countDocuments({ lenderId, status: 'under_review' });
    const approvedApplications = await LoanApplication.countDocuments({ lenderId, status: 'approved' });
    const disbursedApplications = await LoanApplication.countDocuments({ lenderId, status: 'disbursed' });
    const rejectedApplications = await LoanApplication.countDocuments({ lenderId, status: 'rejected' });
    
    const disbursedLoans = await LoanApplication.find({ lenderId, status: 'disbursed' });
    const totalDisbursedAmount = disbursedLoans.reduce((sum, loan) => sum + (loan.disbursedAmount || 0), 0);
    const totalCommission = disbursedLoans.reduce((sum, loan) => sum + (loan.platformCommission || 0), 0);
    
    res.json({
      totalApplications,
      pendingApplications,
      underReview,
      approvedApplications,
      disbursedApplications,
      rejectedApplications,
      totalDisbursedAmount,
      totalCommission
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all applications for this lender
router.get('/applications', global.authenticateLender, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const lenderId = req.user.id;
    
    const query = { lenderId };
    if (status && status !== 'all') query.status = status;
    
    const applications = await LoanApplication.find(query)
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await LoanApplication.countDocuments(query);
    
    res.json({
      applications,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get single application details
router.get('/applications/:applicationId', global.authenticateLender, async (req, res) => {
  try {
    const application = await LoanApplication.findOne({
      applicationId: req.params.applicationId,
      lenderId: req.user.id
    });
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    res.json(application);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// Update application status (approve/reject)
router.put('/applications/:applicationId/status', global.authenticateLender, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status, note, sanctionedAmount, tenure, interestRate } = req.body;
    
    const application = await LoanApplication.findOne({
      applicationId,
      lenderId: req.user.id
    });
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Validate status transition
    const validTransitions = {
      'submitted': ['under_review', 'rejected'],
      'under_review': ['approved', 'rejected', 'document_pending'],
      'document_pending': ['under_review', 'rejected'],
      'approved': ['pending_disbursal', 'rejected'],
      'pending_disbursal': ['disbursed', 'rejected']
    };
    
    const currentStatus = application.status;
    if (validTransitions[currentStatus] && !validTransitions[currentStatus].includes(status)) {
      return res.status(400).json({ error: `Invalid status transition from ${currentStatus} to ${status}` });
    }
    
    application.status = status;
    application.statusHistory.push({
      status,
      note: note || `Status changed to ${status}`,
      updatedBy: 'lender',
      timestamp: new Date()
    });
    
    if (status === 'approved') {
      application.sanctionedAmount = sanctionedAmount || application.estimatedAmount;
      application.tenure = tenure || application.requestedTenure;
      application.interestRate = interestRate;
      application.approvedAt = new Date();
      
      // Calculate EMI
      const monthlyRate = (interestRate / 100) / 12;
      const emiNumerator = application.sanctionedAmount * monthlyRate * Math.pow(1 + monthlyRate, tenure);
      const emiDenominator = Math.pow(1 + monthlyRate, tenure) - 1;
      application.emi = Math.round(emiNumerator / emiDenominator);
    }
    
    if (status === 'rejected') {
      application.rejectedAt = new Date();
    }
    
    await application.save();
    
    res.json({ success: true, application });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Request additional documents from patient
router.post('/applications/:applicationId/request-document', global.authenticateLender, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { documentType, description } = req.body;
    
    const application = await LoanApplication.findOne({
      applicationId,
      lenderId: req.user.id
    });
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const requestId = `REQ_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    application.lenderRequests.push({
      requestId,
      requestType: 'document',
      description: `${documentType}: ${description}`,
      requestedAt: new Date(),
      status: 'pending'
    });
    
    application.status = 'document_pending';
    await application.save();
    
    res.json({ success: true, requestId, message: `Document request sent to patient` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to request document' });
  }
});

// Mark loan as disbursed (after final bill received)
router.post('/applications/:applicationId/disburse', global.authenticateLender, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { transactionId, utrNumber } = req.body;
    
    const application = await LoanApplication.findOne({
      applicationId,
      lenderId: req.user.id
    });
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    if (!application.finalBillAmount) {
      return res.status(400).json({ error: 'Final bill not submitted by patient yet' });
    }
    
    // Disburse based on final bill amount (not sanctioned amount)
    const actualDisbursedAmount = Math.min(application.sanctionedAmount, application.finalBillAmount);
    
    // Get lender to calculate commission
    const lender = await Lender.findById(req.user.id);
    const commissionAmount = (actualDisbursedAmount * (lender.commissionRate || 2)) / 100;
    
    application.disbursedAmount = actualDisbursedAmount;
    application.platformCommission = commissionAmount;
    application.commissionPaid = false;
    application.status = 'disbursed';
    application.disbursedAt = new Date();
    application.disbursalTransactionId = transactionId;
    application.disbursalUtrNumber = utrNumber;
    
    application.statusHistory.push({
      status: 'disbursed',
      note: `Amount ₹${actualDisbursedAmount} disbursed to hospital. Platform commission: ₹${commissionAmount}`,
      updatedBy: 'lender',
      timestamp: new Date()
    });
    
    await application.save();
    
    res.json({
      success: true,
      disbursedAmount: actualDisbursedAmount,
      commissionAmount,
      message: `Disbursed ₹${actualDisbursedAmount} to hospital. Platform commission of ₹${commissionAmount} will be collected.`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to disburse loan' });
  }
});

// Generate daily report
router.get('/reports/daily', global.authenticateLender, async (req, res) => {
  try {
    const { date } = req.query;
    const lenderId = req.user.id;
    
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    const applications = await LoanApplication.find({
      lenderId,
      submittedAt: { $gte: startDate, $lte: endDate }
    });
    
    const report = {
      date,
      totalApplications: applications.length,
      submitted: applications.filter(a => a.status === 'submitted').length,
      approved: applications.filter(a => a.status === 'approved').length,
      rejected: applications.filter(a => a.status === 'rejected').length,
      disbursed: applications.filter(a => a.status === 'disbursed').length,
      totalDisbursedAmount: applications
        .filter(a => a.status === 'disbursed')
        .reduce((sum, a) => sum + (a.disbursedAmount || 0), 0),
      totalCommission: applications
        .filter(a => a.status === 'disbursed')
        .reduce((sum, a) => sum + (a.platformCommission || 0), 0),
      applicationsList: applications.map(a => ({
        applicationId: a.applicationId,
        patientName: a.patientDetails?.fullName,
        amount: a.estimatedAmount,
        status: a.status,
        submittedAt: a.submittedAt
      }))
    };
    
    res.json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Generate monthly report
router.get('/reports/monthly', global.authenticateLender, async (req, res) => {
  try {
    const { year, month } = req.query;
    const lenderId = req.user.id;
    
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);
    
    const applications = await LoanApplication.find({
      lenderId,
      submittedAt: { $gte: startDate, $lte: endDate }
    });
    
    // Group by day
    const dailyData = {};
    const daysInMonth = endDate.getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      dailyData[i] = { submitted: 0, approved: 0, disbursed: 0, amount: 0, commission: 0 };
    }
    
    applications.forEach(app => {
      const day = new Date(app.submittedAt).getDate();
      dailyData[day].submitted++;
      if (app.status === 'approved') dailyData[day].approved++;
      if (app.status === 'disbursed') {
        dailyData[day].disbursed++;
        dailyData[day].amount += app.disbursedAmount || 0;
        dailyData[day].commission += app.platformCommission || 0;
      }
    });
    
    res.json({
      year,
      month,
      dailyData,
      totalApplications: applications.length,
      totalDisbursedAmount: applications
        .filter(a => a.status === 'disbursed')
        .reduce((sum, a) => sum + (a.disbursedAmount || 0), 0),
      totalCommission: applications
        .filter(a => a.status === 'disbursed')
        .reduce((sum, a) => sum + (a.platformCommission || 0), 0)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;
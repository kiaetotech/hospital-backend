const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Patient = require('../models/Patient');
const Lender = require('../models/Lender');
const LoanApplication = require('../models/LoanApplication');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital_platform_secret_key_2024';

// ============================================
// HELPER FUNCTIONS
// ============================================

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTP temporarily (in production, use Redis)
const otpStore = new Map();

const saveOTP = (mobile, otp) => {
  otpStore.set(mobile, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
  setTimeout(() => otpStore.delete(mobile), 10 * 60 * 1000);
};

const verifyOTP = (mobile, otp) => {
  const record = otpStore.get(mobile);
  if (!record) return false;
  if (record.expiresAt < Date.now()) return false;
  return record.otp === otp;
};

// Generate application ID
const generateApplicationId = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `APP_${timestamp}_${random}`;
};

// ============================================
// PATIENT AUTHENTICATION (OTP BASED)
// ============================================

// Send OTP for login/registration
router.post('/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;
    
    if (!mobile || mobile.length !== 10) {
      return res.status(400).json({ error: 'Valid 10-digit mobile number required' });
    }
    
    const otp = generateOTP();
    saveOTP(mobile, otp);
    
    // In production, send actual SMS here
    console.log(`📱 OTP for ${mobile}: ${otp}`);
    
    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      demoOtp: otp  // Remove in production
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP and login/register
router.post('/verify-otp', async (req, res) => {
  try {
    const { mobile, otp, fullName, email } = req.body;
    
    if (!verifyOTP(mobile, otp)) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }
    
    // Find or create patient
    let patient = await Patient.findOne({ phone: mobile });
    
    if (!patient) {
      // Create new patient
      patient = new Patient({
        fullName: fullName || '',
        phone: mobile,
        email: email || '',
        isPhoneVerified: true,
        serviceAddress: {
          address: '',
          city: '',
          state: '',
          pincode: ''
        },
        emergencyContact: {
          name: '',
          phone: ''
        },
        patientDetails: {
          requiredServiceType: 'personal'
        }
      });
      await patient.save();
    } else {
      // Update existing patient
      patient.isPhoneVerified = true;
      if (fullName) patient.fullName = fullName;
      if (email) patient.email = email;
      await patient.save();
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: patient._id, 
        phone: patient.phone,
        role: 'patient' 
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({
      success: true,
      token,
      patient: {
        id: patient._id,
        fullName: patient.fullName,
        phone: patient.phone,
        email: patient.email,
        isPhoneVerified: patient.isPhoneVerified
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Get patient profile
router.get('/profile', global.authenticatePatient, async (req, res) => {
  try {
    const patient = await Patient.findById(req.user.id).select('-password');
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update patient profile (KYC details)
router.put('/profile', global.authenticatePatient, async (req, res) => {
  try {
    const { fullName, email, pan, aadhaar, address, city, state, pincode } = req.body;
    
    const patient = await Patient.findById(req.user.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    if (fullName) patient.fullName = fullName;
    if (email) patient.email = email;
    
    // Store KYC in patientDetails (add these fields to schema if needed)
    if (pan) patient.pan = pan;
    if (aadhaar) patient.aadhaar = aadhaar;
    
    if (address) {
      patient.serviceAddress.address = address;
      patient.serviceAddress.city = city || patient.serviceAddress.city;
      patient.serviceAddress.state = state || patient.serviceAddress.state;
      patient.serviceAddress.pincode = pincode || patient.serviceAddress.pincode;
    }
    
    await patient.save();
    
    res.json({ success: true, patient });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ============================================
// LOAN APPLICATION
// ============================================

// Get available lenders by location (PIN code)
router.get('/lenders', async (req, res) => {
  try {
    const { pincode, city, state } = req.query;
    
    let query = { status: 'active' };
    
    if (pincode) {
      query = {
        status: 'active',
        $or: [
          { servicePincodes: pincode },
          { lenderType: 'national' }
        ]
      };
    }
    
    const lenders = await Lender.find(query).select('-password -apiConfig');
    
    res.json({ lenders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch lenders' });
  }
});

// Submit loan application
router.post('/applications', global.authenticatePatient, async (req, res) => {
  try {
    const {
      treatmentType,
      hospitalName,
      hospitalAddress,
      estimatedAmount,
      lenderId,
      documents,
      tenure,
      collateral
    } = req.body;
    
    const patient = await Patient.findById(req.user.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    const lender = await Lender.findOne({ lenderId: lenderId, status: 'active' });
    if (!lender) {
      return res.status(404).json({ error: 'Lender not found or inactive' });
    }
    
    const applicationId = generateApplicationId();
    
    const application = new LoanApplication({
      applicationId,
      patientId: patient._id,
      lenderId: lender._id,
      patientDetails: {
        fullName: patient.fullName,
        phone: patient.phone,
        email: patient.email,
        pan: patient.pan,
        aadhaar: patient.aadhaar,
        address: patient.serviceAddress?.address,
        pincode: patient.serviceAddress?.pincode
      },
      treatmentType,
      hospitalName,
      hospitalAddress,
      estimatedAmount,
      requestedTenure: tenure,
      documents: documents || {},
      collateral: collateral || null,
      status: 'submitted',
      statusHistory: [{
        status: 'submitted',
        note: 'Application submitted successfully',
        updatedBy: 'patient',
        timestamp: new Date()
      }],
      submittedAt: new Date()
    });
    
    await application.save();
    
    res.json({
      success: true,
      applicationId: application.applicationId,
      message: 'Application submitted successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Get all applications for logged-in patient
router.get('/applications', global.authenticatePatient, async (req, res) => {
  try {
    const applications = await LoanApplication.find({ patientId: req.user.id })
      .sort({ submittedAt: -1 })
      .populate('lenderId', 'businessName lenderType logo');
    
    res.json({ applications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get single application details
router.get('/applications/:applicationId', global.authenticatePatient, async (req,res) => {
  try {
    const application = await LoanApplication.findOne({
      applicationId: req.params.applicationId,
      patientId: req.user.id
    }).populate('lenderId', 'businessName lenderType logo commissionRate');
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    res.json({ application });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// Upload final bill after treatment
router.post('/applications/:applicationId/final-bill', global.authenticatePatient, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { finalBillUrl, finalBillAmount, hospitalFinalBillNumber } = req.body;
    
    const application = await LoanApplication.findOne({
      applicationId,
      patientId: req.user.id
    });
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    if (application.status !== 'approved') {
      return res.status(400).json({ error: 'Loan must be approved before submitting final bill' });
    }
    
    application.documents.finalBill = finalBillUrl;
    application.finalBillAmount = finalBillAmount;
    application.hospitalFinalBillNumber = hospitalFinalBillNumber;
    application.status = 'pending_disbursal';
    application.statusHistory.push({
      status: 'pending_disbursal',
      note: `Final bill of ₹${finalBillAmount} submitted`,
      updatedBy: 'patient',
      timestamp: new Date()
    });
    
    await application.save();
    
    res.json({ success: true, message: 'Final bill submitted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to upload final bill' });
  }
});

// Upload additional documents
router.post('/applications/:applicationId/documents', global.authenticatePatient, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { documentType, documentUrl } = req.body;
    
    const application = await LoanApplication.findOne({
      applicationId,
      patientId: req.user.id
    });
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const validDocTypes = ['tentativeEstimate', 'panCard', 'aadhaarCard', 'salarySlip', 'bankStatement'];
    if (!validDocTypes.includes(documentType)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }
    
    application.documents[documentType] = documentUrl;
    await application.save();
    
    res.json({ success: true, message: `${documentType} uploaded successfully` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Cancel application (only if in draft or submitted status)
router.delete('/applications/:applicationId', global.authenticatePatient, async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    const application = await LoanApplication.findOne({
      applicationId,
      patientId: req.user.id
    });
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    if (!['draft', 'submitted'].includes(application.status)) {
      return res.status(400).json({ error: 'Application cannot be cancelled at this stage' });
    }
    
    application.status = 'cancelled';
    application.statusHistory.push({
      status: 'cancelled',
      note: 'Application cancelled by patient',
      updatedBy: 'patient',
      timestamp: new Date()
    });
    
    await application.save();
    
    res.json({ success: true, message: 'Application cancelled' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to cancel application' });
  }
});

module.exports = router;
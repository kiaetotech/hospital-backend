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

// Store OTP temporarily
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
// LOCATION-BASED LENDER ASSIGNMENT FUNCTIONS
// ============================================

// Find nearest branch for a given lender and patient location
const findNearestBranch = async (lenderId, patientPincode, patientDistrict, patientCity, patientState) => {
  const lender = await Lender.findById(lenderId);
  if (!lender) return null;
  
  // If lender has branches, find the best match
  if (lender.branches && lender.branches.length > 0) {
    // Priority 1: Exact pincode match
    let matchedBranch = lender.branches.find(b => b.pincode === patientPincode && b.isActive);
    if (matchedBranch) return { branch: matchedBranch, reason: 'exact_pincode_match' };
    
    // Priority 2: District match
    if (patientDistrict) {
      matchedBranch = lender.branches.find(b => b.district === patientDistrict && b.isActive);
      if (matchedBranch) return { branch: matchedBranch, reason: 'district_match' };
    }
    
    // Priority 3: City match
    if (patientCity) {
      matchedBranch = lender.branches.find(b => b.city === patientCity && b.isActive);
      if (matchedBranch) return { branch: matchedBranch, reason: 'city_match' };
    }
    
    // Priority 4: State match
    if (patientState) {
      matchedBranch = lender.branches.find(b => b.state === patientState && b.isActive);
      if (matchedBranch) return { branch: matchedBranch, reason: 'state_match' };
    }
    
    // Priority 5: First active branch
    const activeBranch = lender.branches.find(b => b.isActive);
    if (activeBranch) return { branch: activeBranch, reason: 'default_branch' };
  }
  
  return null;
};

// Get available lenders based on patient location
const getAvailableLenders = async (pincode, city, district, state) => {
  const locationConditions = [];
  
  // National lenders (serve all India)
  locationConditions.push({ lenderType: 'national', status: 'active' });
  
  // Regional lenders (serve state)
  if (state) {
    locationConditions.push({ serviceStates: state, status: 'active' });
  }
  
  // Local lenders (serve district/city)
  if (district) {
    locationConditions.push({ serviceDistricts: district, status: 'active' });
  }
  if (city) {
    locationConditions.push({ serviceCities: city, status: 'active' });
  }
  
  // Pincode specific lenders
  if (pincode) {
    locationConditions.push({ servicePincodes: pincode, status: 'active' });
  }
  
  const lenders = await Lender.find({ $or: locationConditions }).select('-password -apiConfig');
  
  // For each lender, find the nearest branch
  const lendersWithBranches = await Promise.all(lenders.map(async (lender) => {
    const branchInfo = await findNearestBranch(lender._id, pincode, district, city, state);
    return {
      ...lender.toObject(),
      nearestBranch: branchInfo?.branch || null,
      assignmentReason: branchInfo?.reason || 'head_office',
      assignedBranchId: branchInfo?.branch?.branchId || null,
      assignedBranchName: branchInfo?.branch?.branchName || lender.registeredOffice?.city || 'Head Office'
    };
  }));
  
  return lendersWithBranches;
};

// Assign application to specific lender branch
const assignApplicationToBranch = async (application, patientPincode, patientDistrict, patientCity, patientState) => {
  const lender = await Lender.findById(application.lenderId);
  if (!lender) {
    throw new Error('Lender not found');
  }
  
  const branchInfo = await findNearestBranch(lender._id, patientPincode, patientDistrict, patientCity, patientState);
  
  if (branchInfo?.branch) {
    application.assignedBranchId = branchInfo.branch.branchId;
    application.assignedBranchName = branchInfo.branch.branchName;
    application.assignedBranchAddress = branchInfo.branch.address;
    application.assignedBranchPincode = branchInfo.branch.pincode;
    application.assignedBranchManager = branchInfo.branch.managerName || '';
    application.assignmentReason = branchInfo.reason;
  } else {
    // Use registered office as default
    application.assignedBranchId = null;
    application.assignedBranchName = lender.registeredOffice?.city || 'Head Office';
    application.assignedBranchAddress = lender.registeredOffice?.address || '';
    application.assignedBranchPincode = lender.registeredOffice?.pincode || '';
    application.assignmentReason = 'head_office';
  }
  
  application.assignedAt = new Date();
  await application.save();
  
  return application;
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
    
    console.log(`📱 OTP for ${mobile}: ${otp}`);
    
    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      demoOtp: otp
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
    
    // Accept any 6-digit OTP for demo
    if (!otp || otp.length !== 6) {
      return res.status(400).json({ error: 'Valid OTP required' });
    }
    
    // Find or create patient with default values
    let patient = await Patient.findOne({ phone: mobile });
    
    if (!patient) {
      patient = new Patient({
        fullName: fullName || 'Patient',
        phone: mobile,
        email: email || 'patient@example.com',
        isPhoneVerified: true,
        serviceAddress: {
          address: 'Address',
          city: 'City',
          state: 'State',
          pincode: '000000'
        },
        emergencyContact: {
          name: 'Emergency Contact',
          phone: '0000000000'
        },
        patientDetails: {
          requiredServiceType: 'personal'
        }
      });
      await patient.save();
    }
    
    const token = jwt.sign(
      { id: patient._id, phone: patient.phone, role: 'patient' },
      process.env.JWT_SECRET || 'hospital_platform_secret_key_2024',
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
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed: ' + error.message });
  }
});

// Get patient profile
router.get('/profile', global.authenticatePatient, async (req, res) => {
  try {
    const patient = await Patient.findById(req.user.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update patient profile (KYC details including location)
router.put('/profile', global.authenticatePatient, async (req, res) => {
  try {
    const { fullName, email, pan, aadhaar, address, city, state, pincode, district, monthlyIncome, employmentType } = req.body;
    
    const patient = await Patient.findById(req.user.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    if (fullName) patient.fullName = fullName;
    if (email) patient.email = email;
    if (pan) patient.pan = pan;
    if (aadhaar) patient.aadhaar = aadhaar;
    if (monthlyIncome) patient.monthlyIncome = monthlyIncome;
    if (employmentType) patient.employmentType = employmentType;
    
    if (address) {
      patient.serviceAddress.address = address;
      patient.serviceAddress.city = city || patient.serviceAddress.city;
      patient.serviceAddress.state = state || patient.serviceAddress.state;
      patient.serviceAddress.pincode = pincode || patient.serviceAddress.pincode;
    }
    
    // Update location details for lender assignment
    if (pincode || city || district || state) {
      patient.locationDetails = {
        pincode: pincode || patient.serviceAddress.pincode,
        city: city || patient.serviceAddress.city,
        district: district || '',
        state: state || patient.serviceAddress.state
      };
    }
    
    patient.updatedAt = new Date();
    await patient.save();
    
    res.json({ success: true, patient });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ============================================
// LOCATION-BASED LENDER DISCOVERY
// ============================================

// Get available lenders by patient location
router.post('/lenders/nearby', async (req, res) => {
  try {
    const { pincode, city, district, state } = req.body;
    
    if (!pincode && !city && !district && !state) {
      return res.status(400).json({ error: 'At least one location parameter required' });
    }
    
    const lenders = await getAvailableLenders(pincode, city, district, state);
    
    res.json({
      success: true,
      count: lenders.length,
      lenders,
      patientLocation: { pincode, city, district, state }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch lenders' });
  }
});

// Get available lenders by PIN code (simple query)
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

// ============================================
// LOAN APPLICATION WITH LOCATION ASSIGNMENT
// ============================================

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
      collateral,
      patientLocation
    } = req.body;
    
    const patient = await Patient.findById(req.user.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    const lender = await Lender.findById(lenderId);
    if (!lender || lender.status !== 'active') {
      return res.status(404).json({ error: 'Lender not found or inactive' });
    }
    
    const applicationId = generateApplicationId();
    
    // Get patient location from request or profile
    const finalPatientLocation = patientLocation || patient.locationDetails || {
      pincode: patient.serviceAddress?.pincode,
      city: patient.serviceAddress?.city,
      state: patient.serviceAddress?.state
    };
    
    const application = new LoanApplication({
      applicationId,
      patientId: patient._id,
      lenderId: lender._id,
      patientLocation: {
        pincode: finalPatientLocation.pincode,
        city: finalPatientLocation.city,
        district: finalPatientLocation.district,
        state: finalPatientLocation.state
      },
      patientDetails: {
        fullName: patient.fullName,
        phone: patient.phone,
        email: patient.email,
        pan: patient.pan,
        aadhaar: patient.aadhaar,
        address: patient.serviceAddress?.address,
        pincode: patient.serviceAddress?.pincode,
        city: patient.serviceAddress?.city,
        state: patient.serviceAddress?.state
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
        updatedBy: patient.fullName,
        updatedByRole: 'patient',
        timestamp: new Date()
      }],
      submittedAt: new Date()
    });
    
    await application.save();
    
    // Auto-assign to nearest lender branch based on location
    const assignedApplication = await assignApplicationToBranch(
      application,
      finalPatientLocation.pincode,
      finalPatientLocation.district,
      finalPatientLocation.city,
      finalPatientLocation.state
    );
    
    res.json({
      success: true,
      applicationId: assignedApplication.applicationId,
      assignedBranch: {
        branchId: assignedApplication.assignedBranchId,
        branchName: assignedApplication.assignedBranchName,
        branchAddress: assignedApplication.assignedBranchAddress,
        branchPincode: assignedApplication.assignedBranchPincode,
        branchManager: assignedApplication.assignedBranchManager,
        assignmentReason: assignedApplication.assignmentReason
      },
      message: `Application submitted and assigned to ${assignedApplication.assignedBranchName}`
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
      .populate('lenderId', 'businessName lenderType');
    
    res.json({ applications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get single application details with branch info
router.get('/applications/:applicationId', global.authenticatePatient, async (req, res) => {
  try {
    const application = await LoanApplication.findOne({
      applicationId: req.params.applicationId,
      patientId: req.user.id
    }).populate('lenderId', 'businessName lenderType commissionRate');
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    res.json({
      application,
      assignedBranch: {
        branchId: application.assignedBranchId,
        branchName: application.assignedBranchName,
        branchAddress: application.assignedBranchAddress,
        branchPincode: application.assignedBranchPincode,
        branchManager: application.assignedBranchManager,
        assignmentReason: application.assignmentReason,
        assignedAt: application.assignedAt
      }
    });
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
      updatedBy: application.patientDetails.fullName,
      updatedByRole: 'patient',
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

// Cancel application
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
      updatedBy: application.patientDetails.fullName,
      updatedByRole: 'patient',
      timestamp: new Date()
    });
    
    await application.save();
    
    res.json({ success: true, message: 'Application cancelled' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to cancel application' });
  }
});

// Add this test route to check if the file is loading
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Loan patient routes are working!',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// SEND OTP
// ============================================
router.post('/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;
    
    if (!mobile || mobile.length !== 10) {
      return res.status(400).json({ error: 'Valid 10-digit mobile number required' });
    }
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP (in production, use Redis or database)
    // For demo, just log it
    console.log(`📱 OTP for ${mobile}: ${otp}`);
    
    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      demoOtp: otp  // Remove in production
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// ============================================
// VERIFY OTP
// ============================================
router.post('/verify-otp', async (req, res) => {
  try {
    const { mobile, otp, fullName, email } = req.body;
    
    // For demo, accept any 6-digit OTP
    if (!otp || otp.length !== 6) {
      return res.status(400).json({ error: 'Valid OTP required' });
    }
    
    // For demo, accept any OTP (in production, verify against stored OTP)
    // For testing, use any 6-digit number
    
    // Create patient (simplified for demo)
    let patient = await Patient.findOne({ phone: mobile });
    
    if (!patient) {
      patient = new Patient({
        fullName: fullName || 'Patient',
        phone: mobile,
        email: email || '',
        isPhoneVerified: true,
        serviceAddress: {
          address: 'Address',
          city: 'City',
          state: 'State',
          pincode: '000000'
        },
        emergencyContact: {
          name: 'Emergency Contact',
          phone: '0000000000'
        },
        patientDetails: {
          requiredServiceType: 'personal'
        }
      });
      await patient.save();
    } else {
      patient.isPhoneVerified = true;
      if (fullName) patient.fullName = fullName;
      if (email) patient.email = email;
      await patient.save();
    }
    
    const token = jwt.sign(
      { id: patient._id, phone: patient.phone, role: 'patient' },
      JWT_SECRET || 'hospital_platform_secret_key_2024',
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
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
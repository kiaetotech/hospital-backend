const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Patient = require('../models/Patient');
const Lender = require('../models/Lender');
const LoanApplication = require('../models/LoanApplication');

// ============================================
// SMS SERVICE (Provider Agnostic)
// ============================================
const { sendOTP, verifyOTP } = require('../services/smsService');

// ============================================
// CLOUDINARY UPLOAD
// ============================================
const { uploadDocuments } = require('../middleware/upload');
const { uploadMultipleFiles, deleteFile } = require('../services/cloudinaryService');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital_platform_secret_key_2024';

// ============================================
// HELPER FUNCTIONS
// ============================================

// Generate 6-digit OTP (Backup)
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTP temporarily (Backup)
const otpStore = new Map();

const saveOTP = (mobile, otp) => {
  otpStore.set(mobile, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
  setTimeout(() => otpStore.delete(mobile), 10 * 60 * 1000);
};

const verifyOTPBackup = (mobile, otp) => {
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
// PATIENT AUTHENTICATION (OTP BASED WITH SMS)
// ============================================

// Send OTP for login/registration (WITH REAL SMS)
router.post('/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;
    
    if (!mobile || mobile.length !== 10) {
      return res.status(400).json({ error: 'Valid 10-digit mobile number required' });
    }
    
    // Send OTP via SMS Service (Provider Agnostic)
    const result = await sendOTP(mobile, 'Your KiaetoCare OTP is');
    
    // In production, NEVER return the OTP in response
    if (process.env.NODE_ENV === 'production') {
      res.json({ 
        success: true, 
        message: 'OTP sent successfully to your registered mobile number'
      });
    } else {
      // For development, include OTP for testing
      res.json({ 
        success: true, 
        message: 'OTP sent successfully',
        demoOtp: result.otp // Remove in production
      });
    }
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP and login/register
router.post('/verify-otp', async (req, res) => {
  try {
    const { mobile, otp, fullName, email } = req.body;
    
    // Validate OTP
    if (!otp || otp.length !== 6) {
      return res.status(400).json({ error: 'Valid 6-digit OTP required' });
    }
    
    // Verify OTP using SMS Service
    const verification = verifyOTP(mobile, otp);
    if (!verification.valid) {
      return res.status(401).json({ error: verification.reason });
    }
    
    // Find or create patient
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
    } else {
      patient.isPhoneVerified = true;
      if (fullName) patient.fullName = fullName;
      if (email) patient.email = email;
      await patient.save();
    }
    
    const token = jwt.sign(
      { id: patient._id, phone: patient.phone, role: 'patient' },
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
    
    // For demo, accept any lenderId
    const applicationId = generateApplicationId();
    
    const finalPatientLocation = patientLocation || patient.locationDetails || {
      pincode: patient.serviceAddress?.pincode,
      city: patient.serviceAddress?.city,
      state: patient.serviceAddress?.state
    };
    
    const application = new LoanApplication({
      applicationId,
      patientId: patient._id,
      lenderId: lenderId || 'demo_lender',
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
    
    res.json({
      success: true,
      applicationId: application.applicationId,
      assignedBranch: {
        branchId: null,
        branchName: 'Demo Lender',
        branchAddress: 'Demo Address',
        branchPincode: '000000',
        branchManager: 'Demo Manager',
        assignmentReason: 'demo'
      },
      message: 'Application submitted successfully'
    });
  } catch (error) {
    console.error('Application submission error:', error);
    res.status(500).json({ error: 'Failed to submit application: ' + error.message });
  }
});

// ============================================
// GET APPLICATIONS
// ============================================

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

// ============================================
// DOCUMENT UPLOAD - CLOUDINARY
// ============================================

// Upload documents to Cloudinary
router.post('/applications/:applicationId/upload-documents', 
  global.authenticatePatient, 
  uploadDocuments, 
  async (req, res) => {
    try {
      const { applicationId } = req.params;
      
      const application = await LoanApplication.findOne({
        applicationId,
        patientId: req.user.id
      });
      
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }
      
      const files = req.files || {};
      const uploadedDocs = {};
      
      // Upload each document
      const documentTypes = [
        'tentativeEstimate', 'finalBill', 'panCard', 
        'aadhaarCard', 'salarySlip', 'bankStatement'
      ];
      
      for (const docType of documentTypes) {
        if (files[docType] && files[docType].length > 0) {
          const file = files[docType][0];
          const result = await uploadMultipleFiles([file]);
          uploadedDocs[docType] = result[0].url;
        }
      }
      
      // Update application with document URLs
      application.documents = {
        ...application.documents,
        ...uploadedDocs
      };
      
      await application.save();
      
      res.json({
        success: true,
        message: 'Documents uploaded successfully',
        documents: uploadedDocs
      });
      
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload documents: ' + error.message });
    }
  }
);

// Delete document from Cloudinary
router.delete('/applications/:applicationId/documents/:docType', 
  global.authenticatePatient, 
  async (req, res) => {
    try {
      const { applicationId, docType } = req.params;
      
      const application = await LoanApplication.findOne({
        applicationId,
        patientId: req.user.id
      });
      
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }
      
      if (!application.documents[docType]) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      // Delete from Cloudinary (extract public_id from URL)
      const url = application.documents[docType];
      const publicId = url.split('/').pop().split('.')[0];
      await deleteFile(`${process.env.CLOUDINARY_FOLDER || 'hospital_documents'}/${publicId}`);
      
      // Remove from database
      application.documents[docType] = null;
      await application.save();
      
      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
      
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  }
);

// ============================================
// FINAL BILL UPLOAD
// ============================================

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

// ============================================
// ADDITIONAL DOCUMENTS UPLOAD
// ============================================

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

// ============================================
// CANCEL APPLICATION
// ============================================

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

// ============================================
// TEST ROUTE
// ============================================
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Loan patient routes are working!',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
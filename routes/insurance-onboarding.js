const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const InsuranceCompany = require('../models/InsuranceCompany');
const User = require('../models/User');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload').upload;
const notificationService = require('../services/notificationService');

// ============================================
// INSURER REGISTRATION (PUBLIC)
// ============================================

// Register new insurance company
router.post('/register', async (req, res) => {
  try {
    const {
      companyName,
      legalName,
      registrationNumber,
      irdaRegistration,
      gstNumber,
      panNumber,
      email,
      phone,
      website,
      address,
      bankDetails,
      password,
      contactPerson
    } = req.body;

    // Validate required fields
    if (!companyName || !email || !phone || !password || !irdaRegistration) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Check if IRDAI registration already exists
    const existingCompany = await InsuranceCompany.findOne({ irdaRegistration });
    if (existingCompany) {
      return res.status(400).json({
        success: false,
        message: 'IRDAI registration number already registered'
      });
    }

    // Create user account
    const user = new User({
      name: contactPerson || companyName,
      email,
      phone,
      password,
      role: 'insurance_company',
      phoneVerified: true,
      emailVerified: true
    });
    await user.save();

    // Create insurance company profile
    const company = new InsuranceCompany({
      companyName,
      legalName: legalName || companyName,
      registrationNumber,
      irdaRegistration,
      gstNumber,
      panNumber,
      email,
      phone,
      website,
      address,
      bankDetails,
      userId: user._id,
      status: 'pending_verification',
      createdBy: user._id
    });

    await company.save();

    // Send notification to admin
    await notificationService.sendEmail(
      process.env.ADMIN_EMAIL || 'admin@yourplatform.com',
      'New Insurance Company Registration',
      {
        template: 'new_insurer_registration',
        data: {
          companyName,
          email,
          phone,
          irdaRegistration,
          registrationNumber
        }
      }
    );

    // Send confirmation to insurer
    await notificationService.sendEmail(
      email,
      'Registration Successful',
      {
        template: 'insurer_registration_confirmation',
        data: {
          companyName,
          registrationNumber,
          status: 'Pending Verification'
        }
      }
    );

    res.json({
      success: true,
      message: 'Registration submitted for verification',
      data: {
        companyId: company._id,
        userId: user._id,
        status: 'pending_verification'
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed: ' + error.message
    });
  }
});

// ============================================
// DOCUMENT UPLOAD (AUTHENTICATED)
// ============================================

router.post('/documents', auth, upload.array('documents', 10), async (req, res) => {
  try {
    const company = await InsuranceCompany.findOne({ userId: req.user.id });
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const files = req.files || [];
    const documents = files.map(file => ({
      name: file.originalname,
      url: file.path || file.location,
      type: req.body.documentType,
      uploadedAt: new Date()
    }));

    company.documents.push(...documents);
    await company.save();

    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      data: {
        documents: documents,
        totalDocuments: company.documents.length
      }
    });

  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload documents'
    });
  }
});

// ============================================
// VERIFICATION STATUS (AUTHENTICATED)
// ============================================

router.get('/status', auth, async (req, res) => {
  try {
    const company = await InsuranceCompany.findOne({ userId: req.user.id });
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const documentStatus = company.documents.map(doc => ({
      type: doc.type,
      uploaded: true,
      verified: doc.verified || false
    }));

    res.json({
      success: true,
      data: {
        companyId: company._id,
        companyName: company.companyName,
        status: company.status,
        isVerified: company.isVerified,
        registeredAt: company.createdAt,
        documentStatus: documentStatus,
        documentsRequired: [
          'irda_certificate',
          'gst_certificate',
          'pan_card',
          'bank_proof',
          'registration_certificate'
        ]
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get status'
    });
  }
});

// ============================================
// ADMIN VERIFICATION
// ============================================

// Get pending registrations (Admin only)
router.get('/admin/pending', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const companies = await InsuranceCompany.find({
      status: 'pending_verification'
    }).populate('userId', 'name email phone');

    res.json({
      success: true,
      data: companies
    });

  } catch (error) {
    console.error('Pending registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending registrations'
    });
  }
});

// Verify company (Admin only)
router.post('/admin/verify/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { approved, notes } = req.body;
    const company = await InsuranceCompany.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    if (approved) {
      company.isVerified = true;
      company.verifiedAt = new Date();
      company.verifiedBy = req.user.id;
      company.status = 'verified';
      
      // Activate if auto-approve is enabled
      if (company.autoApprovePlans) {
        company.status = 'active';
        company.isActive = true;
      }
      
      await company.save();

      // Update user role
      await User.findByIdAndUpdate(company.userId, {
        isVerified: true
      });

      // Send notification
      await notificationService.sendEmail(
        company.email,
        'Company Verified',
        {
          template: 'company_verified',
          data: {
            companyName: company.companyName,
            status: 'Verified',
            nextSteps: 'You can now create and manage insurance plans.'
          }
        }
      );

    } else {
      company.status = 'rejected';
      company.rejectionReason = notes || 'Verification failed';
      await company.save();

      // Send rejection notification
      await notificationService.sendEmail(
        company.email,
        'Company Verification Failed',
        {
          template: 'company_rejected',
          data: {
            companyName: company.companyName,
            reason: notes || 'Verification failed. Please contact support.'
          }
        }
      );
    }

    res.json({
      success: true,
      message: approved ? 'Company verified successfully' : 'Company verification rejected',
      data: company
    });

  } catch (error) {
    console.error('Company verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify company'
    });
  }
});

module.exports = router;
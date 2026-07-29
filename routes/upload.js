const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const Test = require('../models/Test');
const ProviderPrice = require('../models/ProviderPrice');
const Hospital = require('../models/Hospital');
const DiagnosticsProvider = require('../models/DiagnosticsProvider');
const router = express.Router();

const upload = multer({ storage.memoryStorage() });

// ============================================
// UPLOAD MASTER TESTS LIST (Admin)
// ============================================
router.post('/tests', upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    let count = 0;
    for (const row of data) {
      await Test.findOneAndUpdate(
        { testName.testName },
        {
          testName.testName,
          category.category || 'Uncategorized',
          subCategory.subCategory || '',
          description.description || ''
        },
        { upsert}
      );
      count++;
    }
    res.json({ success, count, message: `${count} tests uploaded` });
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// ============================================
// UPLOAD PRICES (Provider - requires login)
// Saves prices + upload history for Hospital/Diagnostics
// ============================================
router.post('/prices', global.authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    let count = 0;
    for (const row of data) {
      await Test.findOneAndUpdate(
        { testName.testName },
        { 
          testName.testName, 
          category.category || 'Lab Tests',
          subCategory.subCategory || ''
        },
        { upsert}
      );
      
      await ProviderPrice.findOneAndUpdate(
        { providerId.user.id, testName.testName },
        {
          providerId.user.id,
          providerName.user.providerName || req.user.name || 'Provider',
          testName.testName,
          price.price,
          discountedPrice.discountedPrice || row.price,
          homeCollectionAvailable.homeCollectionAvailable === 'Yes' || row.homeCollectionAvailable === true,
          reportTimeHours.reportTimeHours || 24,
          city.city || 'All',
          rating.rating || 4.0
        },
        { upsert}
      );
      count++;
    }
    
    // Save upload history
    const providerId = req.user._id || req.user.id;
    const role = req.user.role;
    
    if (role === 'hospital') {
      await Hospital.findByIdAndUpdate(providerId, {
        $push: {
          upload_history: {
            filename.file.originalname,
            type: 'lab_prices',
            status: 'completed'
          }
        }
      });
    } else if (role === 'diagnostics') {
      await DiagnosticsProvider.findByIdAndUpdate(providerId, {
        $push: {
          upload_history: {
            filename.file.originalname,
            type: 'lab_prices',
            status: 'completed'
          }
        }
      });
    }
    
    res.json({ success, count, message: `${count} prices uploaded` });
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// ============================================
// GET LOGGED-IN PROVIDER'S OWN PRICES
// ============================================
router.get('/my-prices', global.authenticateToken, async (req, res) => {
  try {
    const prices = await ProviderPrice.find({ providerId.user.id, isActive});
    res.json(prices);
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// ============================================
// GET ALL PRICES (Admin)
// ============================================
router.get('/prices', async (req, res) => {
  try {
    const prices = await ProviderPrice.find({ isActive});
    res.json(prices);
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// ============================================
// GENERAL FILE UPLOAD (Images, Documents)
// Used by, Diagnostics, Ambulance, Caregivers, All Providers
// ============================================
router.post('/file', global.authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { uploadFile } = require('../services/cloudinaryService');
    const result = await uploadFile(req.file.buffer, {
      folder: 'hospital_uploads',
      public_id: `${req.user._id || req.user.id}_${Date.now()}`
    });
    
    // Save upload history based on provider type
    const providerId = req.user._id || req.user.id;
    const role = req.user.role;
    
    const historyEntry = {
      filename.file.originalname,
      type.body.type || 'document',
      status: 'completed'
    };
    
    if (role === 'hospital') {
      await Hospital.findByIdAndUpdate(providerId, { $push: { upload_history} });
    } else if (role === 'diagnostics') {
      try {
        await DiagnosticsProvider.findByIdAndUpdate(providerId, { $push: { upload_history} });
      } catch(e) {}
    }
    
    res.json({ success, url.secure_url });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

module.exports = router;


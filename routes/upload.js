const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const Test = require('../models/Test');
const ProviderPrice = require('../models/ProviderPrice');
const Hospital = require('../models/Hospital');
const DiagnosticsProvider = require('../models/DiagnosticsProvider');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

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
        { testName: row.testName },
        {
          testName: row.testName,
          category: row.category || 'Uncategorized',
          subCategory: row.subCategory || '',
          description: row.description || ''
        },
        { upsert: true }
      );
      count++;
    }
    res.json({ success: true, count, message: `${count} tests uploaded` });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
        { testName: row.testName },
        { 
          testName: row.testName, 
          category: row.category || 'Lab Tests',
          subCategory: row.subCategory || ''
        },
        { upsert: true }
      );
      
      await ProviderPrice.findOneAndUpdate(
        { providerId: req.user.id, testName: row.testName },
        {
          providerId: req.user.id,
          providerName: req.user.providerName || req.user.name || 'Provider',
          testName: row.testName,
          price: row.price,
          discountedPrice: row.discountedPrice || row.price,
          homeCollectionAvailable: row.homeCollectionAvailable === 'Yes' || row.homeCollectionAvailable === true,
          reportTimeHours: row.reportTimeHours || 24,
          city: row.city || 'All',
          rating: row.rating || 4.0
        },
        { upsert: true }
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
            filename: req.file.originalname,
            type: 'lab_prices',
            status: 'completed'
          }
        }
      });
    } else if (role === 'diagnostics') {
      await DiagnosticsProvider.findByIdAndUpdate(providerId, {
        $push: {
          upload_history: {
            filename: req.file.originalname,
            type: 'lab_prices',
            status: 'completed'
          }
        }
      });
    }
    
    res.json({ success: true, count, message: `${count} prices uploaded` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET LOGGED-IN PROVIDER'S OWN PRICES
// ============================================
router.get('/my-prices', global.authenticateToken, async (req, res) => {
  try {
    const prices = await ProviderPrice.find({ providerId: req.user.id, isActive: true });
    res.json(prices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET ALL PRICES (Admin)
// ============================================
router.get('/prices', async (req, res) => {
  try {
    const prices = await ProviderPrice.find({ isActive: true });
    res.json(prices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GENERAL FILE UPLOAD (Images, Documents)
// Used by: Hospitals, Diagnostics, Ambulance, Caregivers, All Providers
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
      filename: req.file.originalname,
      type: req.body.type || 'document',
      status: 'completed'
    };
    
    if (role === 'hospital') {
      await Hospital.findByIdAndUpdate(providerId, { $push: { upload_history: historyEntry } });
    } else if (role === 'diagnostics') {
      try {
        await DiagnosticsProvider.findByIdAndUpdate(providerId, { $push: { upload_history: historyEntry } });
      } catch(e) {}
    }
    
    res.json({ success: true, url: result.secure_url });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
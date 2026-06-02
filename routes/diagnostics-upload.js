const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const TestMaster = require('../models/TestMaster');
const LabTestCategory = require('../models/LabTestCategory');
const DiagnosticsProvider = require('../models/DiagnosticsProvider');
const TestPricing = require('../models/TestPricing');
const HealthPackage = require('../models/HealthPackage');

const upload = multer({ dest: 'uploads/' });

// Upload Single Excel File with Multiple Sheets
router.post('/full', upload.single('file'), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const results = {};

    // 1. Process Categories Sheet
    if (workbook.SheetNames.includes('Categories')) {
      const sheet = workbook.Sheets['Categories'];
      const data = xlsx.utils.sheet_to_json(sheet);
      for (const row of data) {
        await LabTestCategory.findOneAndUpdate(
          { category_code: row.category_code },
          {
            category_code: row.category_code,
            category_name: row.category_name,
            color: row.color,
            display_order: row.display_order,
            icon: row.icon,
            is_active: true
          },
          { upsert: true }
        );
      }
      results.categories = data.length;
    }

    // 2. Process Providers Sheet
    if (workbook.SheetNames.includes('Providers')) {
      const sheet = workbook.Sheets['Providers'];
      const data = xlsx.utils.sheet_to_json(sheet);
      for (const row of data) {
        await DiagnosticsProvider.findOneAndUpdate(
          { provider_id: row.provider_id },
          {
            provider_id: row.provider_id,
            provider_name: row.provider_name,
            provider_type: row.provider_type,
            city: row.city,
            location: row.latitude && row.longitude ? { lat: row.latitude, lng: row.longitude } : {},
            rating: row.rating,
            total_reviews: row.total_reviews || 0,
            is_nabl_accredited: row.is_nabl_accredited === 'Yes',
            is_home_collection_available: row.home_collection === 'Yes',
            is_active: true
          },
          { upsert: true }
        );
      }
      results.providers = data.length;
    }

    // 3. Process Tests Sheet
    if (workbook.SheetNames.includes('Tests')) {
      const sheet = workbook.Sheets['Tests'];
      const data = xlsx.utils.sheet_to_json(sheet);
      for (const row of data) {
        await TestMaster.findOneAndUpdate(
          { test_id: row.test_id },
          {
            test_id: row.test_id,
            test_name: row.test_name,
            test_short_name: row.test_short_name,
            major_category: row.major_category,
            major_category_name: row.major_category_name,
            sub_category: row.sub_category,
            requires_fasting: row.requires_fasting === 'Yes',
            sample_type: row.sample_type,
            turnaround_time_default_hours: row.turnaround_time_hours,
            home_collection_possible: row.home_collection === 'Yes',
            is_active: true
          },
          { upsert: true }
        );
      }
      results.tests = data.length;
    }

    // 4. Process Pricing Sheet
    if (workbook.SheetNames.includes('Pricing')) {
      const sheet = workbook.Sheets['Pricing'];
      const data = xlsx.utils.sheet_to_json(sheet);
      for (const row of data) {
        const test = await TestMaster.findOne({ test_id: row.test_id });
        const provider = await DiagnosticsProvider.findOne({ provider_name: row.provider_name });
        
        if (test && provider) {
          await TestPricing.findOneAndUpdate(
            { test_id: test._id, provider_id: provider._id },
            {
              test_id: test._id,
              provider_id: provider._id,
              mrp: row.mrp,
              discounted_price: row.discounted_price,
              home_collection_available: row.home_collection === 'Yes',
              report_time_hours: row.report_time_hours,
              is_active: true
            },
            { upsert: true }
          );
        }
      }
      results.pricing = data.length;
    }

    // 5. Process Packages Sheet
    if (workbook.SheetNames.includes('Packages')) {
      const sheet = workbook.Sheets['Packages'];
      const data = xlsx.utils.sheet_to_json(sheet);
      for (const row of data) {
        const provider = await DiagnosticsProvider.findOne({ provider_name: row.provider_name });
        
        if (provider) {
          await HealthPackage.findOneAndUpdate(
            { package_id: row.package_id },
            {
              package_id: row.package_id,
              provider_id: provider._id,
              package_name: row.package_name,
              package_description: row.package_description,
              mrp: row.mrp,
              discounted_price: row.discounted_price,
              home_collection_available: row.home_collection === 'Yes',
              report_time_hours: row.report_time_hours,
              is_popular: row.is_popular === 'Yes',
              tags: row.tags,
              is_active: true
            },
            { upsert: true }
          );
        }
      }
      results.packages = data.length;
    }

    res.json({ 
      success: true, 
      message: 'Upload successful!',
      details: results
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
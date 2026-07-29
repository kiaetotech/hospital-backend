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
          { category_code.category_code },
          {
            category_code.category_code,
            category_name.category_name,
            color.color,
            display_order.display_order,
            icon.icon,
            is_active},
          { upsert}
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
          { provider_id.provider_id },
          {
            provider_id.provider_id,
            provider_name.provider_name,
            provider_type.provider_type,
            city.city,
            location.latitude && row.longitude ? { lat.latitude, lng.longitude } : {},
            rating.rating,
            total_reviews.total_reviews || 0,
            is_nabl_accredited.is_nabl_accredited === 'Yes',
            is_home_collection_available.home_collection === 'Yes',
            is_active},
          { upsert}
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
          { test_id.test_id },
          {
            test_id.test_id,
            test_name.test_name,
            test_short_name.test_short_name,
            major_category.major_category,
            major_category_name.major_category_name,
            sub_category.sub_category,
            requires_fasting.requires_fasting === 'Yes',
            sample_type.sample_type,
            turnaround_time_default_hours.turnaround_time_hours,
            home_collection_possible.home_collection === 'Yes',
            is_active},
          { upsert}
        );
      }
      results.tests = data.length;
    }

    // 4. Process Pricing Sheet
    if (workbook.SheetNames.includes('Pricing')) {
      const sheet = workbook.Sheets['Pricing'];
      const data = xlsx.utils.sheet_to_json(sheet);
      for (const row of data) {
        const test = await TestMaster.findOne({ test_id.test_id });
        const provider = await DiagnosticsProvider.findOne({ provider_name.provider_name });
        
        if (test && provider) {
          await TestPricing.findOneAndUpdate(
            { test_id._id, provider_id._id },
            {
              test_id._id,
              provider_id._id,
              mrp.mrp,
              discounted_price.discounted_price,
              home_collection_available.home_collection === 'Yes',
              report_time_hours.report_time_hours,
              is_active},
            { upsert}
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
        const provider = await DiagnosticsProvider.findOne({ provider_name.provider_name });
        
        if (provider) {
          await HealthPackage.findOneAndUpdate(
            { package_id.package_id },
            {
              package_id.package_id,
              provider_id._id,
              package_name.package_name,
              package_description.package_description,
              mrp.mrp,
              discounted_price.discounted_price,
              home_collection_available.home_collection === 'Yes',
              report_time_hours.report_time_hours,
              is_popular.is_popular === 'Yes',
              tags.tags,
              is_active},
            { upsert}
          );
        }
      }
      results.packages = data.length;
    }

    res.json({ 
      success, 
      message: 'Upload successful!',
      details});
  } catch (error) {
    console.error(error);
    res.status(500).json({ success, message.message });
  }
});

module.exports = router;


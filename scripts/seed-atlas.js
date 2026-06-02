const mongoose = require('mongoose');

// ⚠️ IMPORTANT: REPLACE THIS WITH YOUR ACTUAL MONGODB ATLAS CONNECTION STRING
const DB_URI = 'mongodb+srv://kiaetotech:YOUR_PASSWORD@cluster0.4vjxrfm.mongodb.net/';

const LabTestCategorySchema = new mongoose.Schema({
  category_code: String, category_name: String, color: String, display_order: Number, icon: String, is_active: Boolean
});
const TestMasterSchema = new mongoose.Schema({
  test_id: Number, test_name: String, test_short_name: String, major_category: String, major_category_name: String,
  sub_category: String, requires_fasting: Boolean, sample_type: String, turnaround_time_default_hours: Number,
  home_collection_possible: Boolean, is_active: Boolean
});
const DiagnosticsProviderSchema = new mongoose.Schema({
  provider_id: Number, provider_name: String, provider_type: String, city: String,
  location: { lat: Number, lng: Number }, rating: Number, total_reviews: Number,
  is_nabl_accredited: Boolean, is_home_collection_available: Boolean, is_active: Boolean
});
const TestPricingSchema = new mongoose.Schema({
  provider_id: mongoose.Schema.Types.ObjectId, test_id: mongoose.Schema.Types.ObjectId,
  mrp: Number, discounted_price: Number, home_collection_available: Boolean, report_time_hours: Number, is_active: Boolean
});
const HealthPackageSchema = new mongoose.Schema({
  package_id: Number, provider_id: mongoose.Schema.Types.ObjectId, package_name: String,
  package_description: String, mrp: Number, discounted_price: Number,
  home_collection_available: Boolean, report_time_hours: Number, is_popular: Boolean, tags: String, is_active: Boolean
});

const LabTestCategory = mongoose.model('LabTestCategory', LabTestCategorySchema);
const TestMaster = mongoose.model('TestMaster', TestMasterSchema);
const DiagnosticsProvider = mongoose.model('DiagnosticsProvider', DiagnosticsProviderSchema);
const TestPricing = mongoose.model('TestPricing', TestPricingSchema);
const HealthPackage = mongoose.model('HealthPackage', HealthPackageSchema);

async function seedAtlas() {
  try {
    await mongoose.connect(DB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    // Clear existing data
    await LabTestCategory.deleteMany({});
    await TestMaster.deleteMany({});
    await DiagnosticsProvider.deleteMany({});
    await TestPricing.deleteMany({});
    await HealthPackage.deleteMany({});
    console.log('✅ Cleared existing data');

    // 1. Add Categories
    const categories = [
      { category_code: 'BLD', category_name: 'Blood Tests', color: '#e74c3c', display_order: 1, icon: '🩸', is_active: true },
      { category_code: 'IMG', category_name: 'Medical Imaging', color: '#3498db', display_order: 2, icon: '📷', is_active: true },
      { category_code: 'CRD', category_name: 'Cardiac Diagnostics', color: '#e67e22', display_order: 3, icon: '❤️', is_active: true },
      { category_code: 'URN', category_name: 'Urine Tests', color: '#f39c12', display_order: 4, icon: '💧', is_active: true },
      { category_code: 'STL', category_name: 'Stool Tests', color: '#27ae60', display_order: 5, icon: '🧫', is_active: true }
    ];
    await LabTestCategory.insertMany(categories);
    console.log('✅ 5 Categories added');

    // 2. Add Tests
    const tests = [
      { test_id: 1001, test_name: 'Complete Blood Count', test_short_name: 'CBC', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Hematology', requires_fasting: false, sample_type: 'Blood', turnaround_time_default_hours: 4, home_collection_possible: true, is_active: true },
      { test_id: 1002, test_name: 'Liver Function Test', test_short_name: 'LFT', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Biochemistry', requires_fasting: true, sample_type: 'Blood', turnaround_time_default_hours: 6, home_collection_possible: true, is_active: true },
      { test_id: 1003, test_name: 'Thyroid Profile', test_short_name: 'TSH', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Hormones', requires_fasting: false, sample_type: 'Blood', turnaround_time_default_hours: 8, home_collection_possible: true, is_active: true },
      { test_id: 1004, test_name: 'Vitamin D', test_short_name: 'Vitamin D', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Vitamins', requires_fasting: false, sample_type: 'Blood', turnaround_time_default_hours: 24, home_collection_possible: true, is_active: true },
      { test_id: 1005, test_name: 'Lipid Profile', test_short_name: 'Lipid', major_category: 'BLD', major_category_name: 'Blood Tests', sub_category: 'Biochemistry', requires_fasting: true, sample_type: 'Blood', turnaround_time_default_hours: 6, home_collection_possible: true, is_active: true },
      { test_id: 2001, test_name: 'Chest X-Ray', test_short_name: 'X-Ray Chest', major_category: 'IMG', major_category_name: 'Medical Imaging', sub_category: 'X-Ray', requires_fasting: false, sample_type: 'Other', turnaround_time_default_hours: 2, home_collection_possible: false, is_active: true },
      { test_id: 2002, test_name: 'ECG', test_short_name: 'ECG', major_category: 'CRD', major_category_name: 'Cardiac Diagnostics', sub_category: 'ECG', requires_fasting: false, sample_type: 'Other', turnaround_time_default_hours: 1, home_collection_possible: true, is_active: true }
    ];
    const insertedTests = await TestMaster.insertMany(tests);
    console.log('✅ 7 Tests added');

    const testMap = new Map();
    for (const test of insertedTests) testMap.set(test.test_id, test._id);

    // 3. Add Providers
    const providers = [
      { provider_id: 1, provider_name: 'ABC Diagnostics', provider_type: 'Lab', city: 'Mumbai', location: { lat: 19.0760, lng: 72.8777 }, rating: 4.5, total_reviews: 1250, is_nabl_accredited: true, is_home_collection_available: true, is_active: true },
      { provider_id: 2, provider_name: 'City Hospital Lab', provider_type: 'Hospital', city: 'Mumbai', location: { lat: 19.0820, lng: 72.8820 }, rating: 4.3, total_reviews: 890, is_nabl_accredited: false, is_home_collection_available: false, is_active: true },
      { provider_id: 3, provider_name: 'HealthCare Diagnostics', provider_type: 'Lab', city: 'Mumbai', location: { lat: 19.0700, lng: 72.8700 }, rating: 4.7, total_reviews: 2100, is_nabl_accredited: true, is_home_collection_available: true, is_active: true }
    ];
    const insertedProviders = await DiagnosticsProvider.insertMany(providers);
    console.log('✅ 3 Providers added');

    // 4. Add Pricing
    const pricingData = [
      { provider_id: insertedProviders[0]._id, test_id: testMap.get(1001), mrp: 399, discounted_price: 199, home_collection_available: true, report_time_hours: 4, is_active: true },
      { provider_id: insertedProviders[0]._id, test_id: testMap.get(1002), mrp: 499, discounted_price: 299, home_collection_available: true, report_time_hours: 6, is_active: true },
      { provider_id: insertedProviders[0]._id, test_id: testMap.get(1003), mrp: 599, discounted_price: 399, home_collection_available: true, report_time_hours: 8, is_active: true },
      { provider_id: insertedProviders[0]._id, test_id: testMap.get(1004), mrp: 999, discounted_price: 699, home_collection_available: true, report_time_hours: 24, is_active: true },
      { provider_id: insertedProviders[0]._id, test_id: testMap.get(1005), mrp: 499, discounted_price: 299, home_collection_available: true, report_time_hours: 6, is_active: true },
      { provider_id: insertedProviders[1]._id, test_id: testMap.get(1001), mrp: 350, discounted_price: 199, home_collection_available: false, report_time_hours: 6, is_active: true },
      { provider_id: insertedProviders[1]._id, test_id: testMap.get(1002), mrp: 450, discounted_price: 299, home_collection_available: false, report_time_hours: 8, is_active: true },
      { provider_id: insertedProviders[2]._id, test_id: testMap.get(1001), mrp: 450, discounted_price: 249, home_collection_available: true, report_time_hours: 3, is_active: true },
      { provider_id: insertedProviders[2]._id, test_id: testMap.get(1002), mrp: 550, discounted_price: 349, home_collection_available: true, report_time_hours: 5, is_active: true },
      { provider_id: insertedProviders[2]._id, test_id: testMap.get(1003), mrp: 650, discounted_price: 449, home_collection_available: true, report_time_hours: 6, is_active: true }
    ];
    await TestPricing.insertMany(pricingData);
    console.log('✅ 10 Pricing entries added');

    // 5. Add Packages
    const packages = [
      { package_id: 1, provider_id: insertedProviders[0]._id, package_name: 'Full Body Checkup', package_description: 'Complete health checkup with 65+ tests', mrp: 2500, discounted_price: 1299, home_collection_available: true, report_time_hours: 24, is_popular: true, tags: 'fullbody,comprehensive', is_active: true },
      { package_id: 2, provider_id: insertedProviders[0]._id, package_name: 'Cardiac Care Package', package_description: 'Heart health checkup', mrp: 1800, discounted_price: 999, home_collection_available: true, report_time_hours: 12, tags: 'cardiac,heart', is_active: true },
      { package_id: 3, provider_id: insertedProviders[2]._id, package_name: 'Diabetes Profile', package_description: 'Complete diabetes screening', mrp: 1200, discounted_price: 699, home_collection_available: true, report_time_hours: 8, tags: 'diabetes,sugar', is_active: true }
    ];
    await HealthPackage.insertMany(packages);
    console.log('✅ 3 Packages added');

    console.log('🎉 DATABASE SEEDED SUCCESSFULLY!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

seedAtlas();
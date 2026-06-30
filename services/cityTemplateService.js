// ============================================
// CITY TEMPLATE SERVICE - Pre-filled Data by City
// ============================================

const CITY_TEMPLATES = {
  'Mumbai': {
    commonAccreditations: ['NABH', 'NABL'],
    optionalAccreditations: ['JCI', 'ISO', 'NABH Nursing Excellence'],
    commonFacilities: [
      { name: 'MRI 3T', category: 'Imaging', available24x7: false, description: '3 Tesla MRI machine' },
      { name: 'CT 128 Slice', category: 'Imaging', available24x7: true, description: '128 slice CT scanner' },
      { name: 'Cath Lab', category: 'Cardiac', available24x7: true, description: 'Cardiac catheterization lab' },
      { name: 'Pathology Lab', category: 'Laboratory', available24x7: true, description: 'In-house pathology lab' },
      { name: 'Pharmacy', category: 'Pharmacy', available24x7: true, description: '24x7 pharmacy' },
      { name: 'ICU', category: 'Critical Care', available24x7: true, description: 'Intensive Care Unit' },
      { name: 'NICU', category: 'Critical Care', available24x7: false, description: 'Neonatal ICU' },
      { name: 'Ambulance', category: 'Transport', available24x7: true, description: 'Ambulance service' },
      { name: 'Blood Bank', category: 'Laboratory', available24x7: true, description: 'In-house blood bank' },
      { name: 'Parking', category: 'Amenity', available24x7: true, description: 'Parking facility' },
      { name: 'WiFi', category: 'Amenity', available24x7: true, description: 'Free WiFi for patients' },
      { name: 'Cafeteria', category: 'Amenity', available24x7: false, description: 'Food court' }
    ],
    commonInsurance: [
      { company: 'Star Health Insurance', cashless: true, tpaDesk: true, tpaName: 'MediAssist' },
      { company: 'ICICI Lombard', cashless: true, tpaDesk: true, tpaName: '' },
      { company: 'HDFC Ergo', cashless: true, tpaDesk: false, tpaName: '' },
      { company: 'Bajaj Allianz', cashless: true, tpaDesk: true, tpaName: 'Health India' },
      { company: 'Max Bupa', cashless: true, tpaDesk: false, tpaName: '' },
      { company: 'New India Assurance', cashless: true, tpaDesk: false, tpaName: '' },
      { company: 'Oriental Insurance', cashless: true, tpaDesk: false, tpaName: '' },
      { company: 'United India Insurance', cashless: true, tpaDesk: false, tpaName: '' },
      { company: 'Tata AIG', cashless: true, tpaDesk: true, tpaName: 'Paramount' }
    ],
    commonSchemes: [
      { code: 'ayushman', name: 'Ayushman Bharat (PM-JAY)' },
      { code: 'cghs', name: 'CGHS' },
      { code: 'esi', name: 'ESI' },
      { code: 'echs', name: 'ECHS' },
      { code: 'state_scheme', name: 'Maharashtra State Health Scheme' }
    ],
    commonTests: [
      { name: 'Complete Blood Count (CBC)', category: 'Hematology', price: 400, homeCollection: true, fastingRequired: false, reportTime: 24, sampleType: 'Blood' },
      { name: 'Lipid Profile', category: 'Biochemistry', price: 600, homeCollection: true, fastingRequired: true, reportTime: 24, sampleType: 'Blood' },
      { name: 'Liver Function Test (LFT)', category: 'Biochemistry', price: 700, homeCollection: true, fastingRequired: true, reportTime: 24, sampleType: 'Blood' },
      { name: 'Kidney Function Test (KFT)', category: 'Biochemistry', price: 600, homeCollection: true, fastingRequired: true, reportTime: 24, sampleType: 'Blood' },
      { name: 'Thyroid Profile (T3,T4,TSH)', category: 'Endocrinology', price: 500, homeCollection: true, fastingRequired: false, reportTime: 24, sampleType: 'Blood' },
      { name: 'HbA1c', category: 'Diabetes', price: 500, homeCollection: true, fastingRequired: false, reportTime: 24, sampleType: 'Blood' },
      { name: 'Blood Sugar Fasting', category: 'Diabetes', price: 150, homeCollection: true, fastingRequired: true, reportTime: 8, sampleType: 'Blood' },
      { name: 'ECG', category: 'Cardiology', price: 300, homeCollection: false, fastingRequired: false, reportTime: 2, sampleType: '-' },
      { name: 'Chest X-Ray', category: 'Radiology', price: 350, homeCollection: false, fastingRequired: false, reportTime: 4, sampleType: '-' },
      { name: 'MRI Brain', category: 'Radiology', price: 8000, homeCollection: false, fastingRequired: false, reportTime: 48, sampleType: '-' },
      { name: 'Ultrasound Whole Abdomen', category: 'Radiology', price: 1500, homeCollection: false, fastingRequired: true, reportTime: 4, sampleType: '-' },
      { name: 'Urine Routine', category: 'Pathology', price: 200, homeCollection: true, fastingRequired: false, reportTime: 24, sampleType: 'Urine' },
      { name: 'Dengue Test', category: 'Microbiology', price: 800, homeCollection: true, fastingRequired: false, reportTime: 24, sampleType: 'Blood' },
      { name: 'COVID RT-PCR', category: 'Microbiology', price: 500, homeCollection: true, fastingRequired: false, reportTime: 24, sampleType: 'Nasal Swab' }
    ],
    commonPackages: [
      { name: 'Executive Health Checkup', includedTests: ['CBC', 'Lipid Profile', 'LFT', 'KFT', 'Thyroid', 'Blood Sugar', 'ECG', 'Chest X-Ray', 'Urine'], price: 4999, discount: 20, forGender: 'All', validDays: 365 },
      { name: 'Women Wellness', includedTests: ['CBC', 'Thyroid', 'Blood Sugar', 'Pap Smear', 'Ultrasound'], price: 3499, discount: 15, forGender: 'Female', validDays: 365 },
      { name: 'Cardiac Care', includedTests: ['Lipid Profile', 'ECG', 'HbA1c', 'Blood Sugar'], price: 3999, discount: 10, forGender: 'All', validDays: 365 },
      { name: 'Diabetes Care', includedTests: ['Blood Sugar Fasting', 'HbA1c', 'KFT', 'Lipid Profile'], price: 2499, discount: 10, forGender: 'All', validDays: 180 },
      { name: 'Senior Citizen', includedTests: ['CBC', 'Lipid Profile', 'LFT', 'KFT', 'Thyroid', 'Blood Sugar', 'ECG', 'Chest X-Ray'], price: 6999, discount: 25, forGender: 'All', validDays: 365 }
    ]
  },
  'Delhi': {
    commonAccreditations: ['NABH', 'NABL'],
    optionalAccreditations: ['JCI', 'ISO'],
    commonFacilities: [
      { name: 'MRI 3T', category: 'Imaging', available24x7: false },
      { name: 'CT Scan', category: 'Imaging', available24x7: true },
      { name: 'Pathology Lab', category: 'Laboratory', available24x7: true },
      { name: 'Pharmacy', category: 'Pharmacy', available24x7: true },
      { name: 'ICU', category: 'Critical Care', available24x7: true },
      { name: 'Ambulance', category: 'Transport', available24x7: true },
      { name: 'Parking', category: 'Amenity', available24x7: true },
      { name: 'WiFi', category: 'Amenity', available24x7: true }
    ],
    commonInsurance: [
      { company: 'Star Health Insurance', cashless: true, tpaDesk: true, tpaName: 'MediAssist' },
      { company: 'ICICI Lombard', cashless: true, tpaDesk: false },
      { company: 'HDFC Ergo', cashless: true, tpaDesk: false },
      { company: 'Bajaj Allianz', cashless: true, tpaDesk: true, tpaName: 'Health India' },
      { company: 'Max Bupa', cashless: true, tpaDesk: false },
      { company: 'New India Assurance', cashless: true, tpaDesk: false },
      { company: 'Tata AIG', cashless: true, tpaDesk: true, tpaName: 'Paramount' }
    ],
    commonSchemes: [
      { code: 'ayushman', name: 'Ayushman Bharat (PM-JAY)' },
      { code: 'cghs', name: 'CGHS' },
      { code: 'esi', name: 'ESI' },
      { code: 'echs', name: 'ECHS' },
      { code: 'state_scheme', name: 'Delhi State Health Scheme' }
    ],
    commonTests: [
      { name: 'Complete Blood Count (CBC)', category: 'Hematology', price: 350, homeCollection: true, fastingRequired: false, reportTime: 24, sampleType: 'Blood' },
      { name: 'Lipid Profile', category: 'Biochemistry', price: 550, homeCollection: true, fastingRequired: true, reportTime: 24, sampleType: 'Blood' },
      { name: 'Liver Function Test (LFT)', category: 'Biochemistry', price: 650, homeCollection: true, fastingRequired: true, reportTime: 24, sampleType: 'Blood' },
      { name: 'Kidney Function Test (KFT)', category: 'Biochemistry', price: 550, homeCollection: true, fastingRequired: true, reportTime: 24, sampleType: 'Blood' },
      { name: 'Thyroid Profile', category: 'Endocrinology', price: 450, homeCollection: true, fastingRequired: false, reportTime: 24, sampleType: 'Blood' },
      { name: 'HbA1c', category: 'Diabetes', price: 450, homeCollection: true, fastingRequired: false, reportTime: 24, sampleType: 'Blood' },
      { name: 'ECG', category: 'Cardiology', price: 250, homeCollection: false, fastingRequired: false, reportTime: 2, sampleType: '-' },
      { name: 'Chest X-Ray', category: 'Radiology', price: 300, homeCollection: false, fastingRequired: false, reportTime: 4, sampleType: '-' },
      { name: 'COVID RT-PCR', category: 'Microbiology', price: 400, homeCollection: true, fastingRequired: false, reportTime: 24, sampleType: 'Nasal Swab' }
    ],
    commonPackages: [
      { name: 'Executive Health Checkup', includedTests: ['CBC', 'Lipid Profile', 'LFT', 'KFT', 'Thyroid', 'Blood Sugar', 'ECG', 'Chest X-Ray'], price: 4499, discount: 15, forGender: 'All', validDays: 365 },
      { name: 'Women Wellness', includedTests: ['CBC', 'Thyroid', 'Blood Sugar'], price: 2999, discount: 10, forGender: 'Female', validDays: 365 },
      { name: 'Senior Citizen', includedTests: ['CBC', 'Lipid Profile', 'LFT', 'KFT', 'Thyroid', 'ECG', 'Chest X-Ray'], price: 5999, discount: 20, forGender: 'All', validDays: 365 }
    ]
  },
  'Bangalore': {
    commonAccreditations: ['NABH', 'NABL'],
    optionalAccreditations: ['JCI', 'ISO'],
    commonFacilities: [
      { name: 'MRI 3T', category: 'Imaging', available24x7: false },
      { name: 'CT Scan', category: 'Imaging', available24x7: true },
      { name: 'Pathology Lab', category: 'Laboratory', available24x7: true },
      { name: 'Pharmacy', category: 'Pharmacy', available24x7: true },
      { name: 'ICU', category: 'Critical Care', available24x7: true },
      { name: 'Ambulance', category: 'Transport', available24x7: true },
      { name: 'Parking', category: 'Amenity', available24x7: true },
      { name: 'WiFi', category: 'Amenity', available24x7: true }
    ],
    commonInsurance: [
      { company: 'Star Health Insurance', cashless: true, tpaDesk: true },
      { company: 'ICICI Lombard', cashless: true, tpaDesk: false },
      { company: 'HDFC Ergo', cashless: true, tpaDesk: false },
      { company: 'Bajaj Allianz', cashless: true, tpaDesk: true },
      { company: 'Max Bupa', cashless: true, tpaDesk: false },
      { company: 'New India Assurance', cashless: true, tpaDesk: false }
    ],
    commonSchemes: [
      { code: 'ayushman', name: 'Ayushman Bharat (PM-JAY)' },
      { code: 'cghs', name: 'CGHS' },
      { code: 'esi', name: 'ESI' },
      { code: 'echs', name: 'ECHS' },
      { code: 'state_scheme', name: 'Karnataka State Health Scheme' }
    ],
    commonTests: [
      { name: 'Complete Blood Count (CBC)', category: 'Hematology', price: 350, homeCollection: true, fastingRequired: false, reportTime: 24, sampleType: 'Blood' },
      { name: 'Lipid Profile', category: 'Biochemistry', price: 500, homeCollection: true, fastingRequired: true, reportTime: 24, sampleType: 'Blood' },
      { name: 'Thyroid Profile', category: 'Endocrinology', price: 450, homeCollection: true, fastingRequired: false, reportTime: 24, sampleType: 'Blood' },
      { name: 'HbA1c', category: 'Diabetes', price: 450, homeCollection: true, fastingRequired: false, reportTime: 24, sampleType: 'Blood' },
      { name: 'ECG', category: 'Cardiology', price: 250, homeCollection: false, fastingRequired: false, reportTime: 2, sampleType: '-' }
    ],
    commonPackages: [
      { name: 'Executive Health Checkup', includedTests: ['CBC', 'Lipid Profile', 'LFT', 'KFT', 'Thyroid', 'ECG'], price: 3999, discount: 15, forGender: 'All', validDays: 365 },
      { name: 'Women Wellness', includedTests: ['CBC', 'Thyroid'], price: 2499, discount: 10, forGender: 'Female', validDays: 365 }
    ]
  }
};

// Default template for cities not in the list
const DEFAULT_TEMPLATE = {
  commonAccreditations: ['NABH'],
  optionalAccreditations: ['NABL', 'ISO'],
  commonFacilities: [
    { name: 'Pathology Lab', category: 'Laboratory', available24x7: true },
    { name: 'Pharmacy', category: 'Pharmacy', available24x7: true },
    { name: 'ICU', category: 'Critical Care', available24x7: true },
    { name: 'Ambulance', category: 'Transport', available24x7: true },
    { name: 'Parking', category: 'Amenity', available24x7: true },
    { name: 'WiFi', category: 'Amenity', available24x7: true }
  ],
  commonInsurance: [
    { company: 'Star Health Insurance', cashless: true, tpaDesk: false },
    { company: 'ICICI Lombard', cashless: true, tpaDesk: false },
    { company: 'HDFC Ergo', cashless: true, tpaDesk: false },
    { company: 'New India Assurance', cashless: true, tpaDesk: false }
  ],
  commonSchemes: [
    { code: 'ayushman', name: 'Ayushman Bharat (PM-JAY)' },
    { code: 'cghs', name: 'CGHS' },
    { code: 'esi', name: 'ESI' }
  ],
  commonTests: [
    { name: 'Complete Blood Count (CBC)', category: 'Hematology', price: 400, homeCollection: true, fastingRequired: false, reportTime: 24, sampleType: 'Blood' },
    { name: 'Lipid Profile', category: 'Biochemistry', price: 600, homeCollection: true, fastingRequired: true, reportTime: 24, sampleType: 'Blood' },
    { name: 'Thyroid Profile', category: 'Endocrinology', price: 500, homeCollection: true, fastingRequired: false, reportTime: 24, sampleType: 'Blood' },
    { name: 'ECG', category: 'Cardiology', price: 300, homeCollection: false, fastingRequired: false, reportTime: 2, sampleType: '-' }
  ],
  commonPackages: [
    { name: 'Executive Health Checkup', includedTests: ['CBC', 'Lipid Profile', 'LFT', 'KFT', 'Thyroid', 'ECG'], price: 4999, discount: 10, forGender: 'All', validDays: 365 }
  ]
};

// Get all available cities
const getAvailableCities = () => {
  return Object.keys(CITY_TEMPLATES);
};

// Get template for a specific city
const getCityTemplate = (city) => {
  const template = CITY_TEMPLATES[city];
  if (template) {
    return { ...template, city, isCustomTemplate: true };
  }
  return { ...DEFAULT_TEMPLATE, city: city || 'Unknown', isCustomTemplate: false, message: 'Using default template for this city' };
};

// Get partial template - hospital selects what they want
const getPartialTemplate = (city, sections = []) => {
  const fullTemplate = getCityTemplate(city);
  
  // If no sections specified, return everything
  if (!sections || sections.length === 0) {
    return fullTemplate;
  }
  
  const partial = { city: fullTemplate.city };
  
  sections.forEach(section => {
    switch(section) {
      case 'accreditations':
        partial.accreditations = fullTemplate.commonAccreditations;
        partial.optionalAccreditations = fullTemplate.optionalAccreditations;
        break;
      case 'facilities':
        partial.facilities = fullTemplate.commonFacilities;
        break;
      case 'insurance':
        partial.insurance = fullTemplate.commonInsurance;
        break;
      case 'schemes':
        partial.schemes = fullTemplate.commonSchemes;
        break;
      case 'tests':
        partial.tests = fullTemplate.commonTests;
        break;
      case 'packages':
        partial.packages = fullTemplate.commonPackages;
        break;
    }
  });
  
  return partial;
};

// Apply template to hospital - auto-fill data
const applyTemplate = async (hospitalId, city, sections = []) => {
  const template = getPartialTemplate(city, sections);
  const Hospital = require('../models/Hospital');
  const hospital = await Hospital.findById(hospitalId);
  
  if (!hospital) {
    throw new Error('Hospital not found');
  }
  
  // Apply each section
  if (template.accreditations) {
    hospital.accreditations = template.accreditations;
  }
  
  if (template.facilities) {
    hospital.facilities = template.facilities.map(f => ({
      name: f.name,
      category: f.category || 'General',
      available_24x7: f.available24x7 !== false,
      description: f.description || ''
    }));
  }
  
  if (template.insurance) {
    hospital.insurance_accepted = template.insurance.map(i => i.company);
    hospital.cashless_available = template.insurance.some(i => i.cashless);
    hospital.tpa_desk_available = template.insurance.some(i => i.tpaDesk);
    hospital.tpa_partners = template.insurance
      .filter(i => i.tpaName)
      .map(i => i.tpaName);
  }
  
  if (template.schemes) {
    hospital.schemes_accepted = template.schemes.map(s => s.code);
    hospital.scheme_details = template.schemes.map(s => ({
      code: s.code,
      name: s.name,
      active: true
    }));
  }
  
  if (template.tests) {
    hospital.diagnostics = hospital.diagnostics || {};
    hospital.diagnostics.tests = template.tests.map(t => ({
      name: t.name,
      category: t.category,
      price: t.price,
      home_collection: t.homeCollection,
      fasting_required: t.fastingRequired,
      report_time: t.reportTime,
      sample_type: t.sampleType
    }));
  }
  
  if (template.packages) {
    hospital.pricing = hospital.pricing || {};
    hospital.pricing.health_packages = template.packages.map(p => ({
      name: p.name,
      included_tests: p.includedTests,
      price: p.price,
      discount: p.discount || 0,
      for_gender: p.forGender || 'All',
      valid_days: p.validDays || 365
    }));
  }
  
  hospital.updated_at = new Date();
  await hospital.save();
  
  return {
    success: true,
    message: `Template applied for ${city}. Please review and edit the pre-filled data.`,
    appliedSections: Object.keys(template).filter(k => k !== 'city' && k !== 'message' && k !== 'isCustomTemplate')
  };
};

module.exports = {
  getAvailableCities,
  getCityTemplate,
  getPartialTemplate,
  applyTemplate,
  CITY_TEMPLATES,
  DEFAULT_TEMPLATE
};
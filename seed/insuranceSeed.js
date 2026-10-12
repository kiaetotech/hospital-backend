// D:\hospital backend\seed\insuranceSeed.js
// ============================================
// INSURANCE SEED DATA
// Run: node seed/insuranceSeed.js
// Safe to run multiple times (idempotent)
// ============================================

const mongoose = require('mongoose');
require('dotenv').config();

const InsuranceCompany = require('../models/InsuranceCompany');
const InsurancePlan = require('../models/InsurancePlan');
const { InsuranceAddon, InsuranceNetworkHospital } = require('../models/InsuranceTag');
const User = require('../models/User');

const SAMPLE_COMPANIES = [
  {
    companyName: 'ABC Insurance',
    legalName: 'ABC Insurance Ltd',
    registrationNumber: 'ABC-REG-001',
    irdaRegistration: 'IRDAI-ABC-2024',
    gstNumber: '27ABCIN1234A1Z5',
    panNumber: 'ABCIN1234A',
    email: 'info@abcinsurance.test',
    phone: '+91-1800-000-1001',
    website: 'https://abcinsurance.test',
    address: { line1: 'ABC Tower', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
    bankDetails: {
      accountNumber: '1234567890',
      ifscCode: 'HDFC0000001',
      accountHolderName: 'ABC Insurance Ltd',
      bankName: 'HDFC Bank'
    },
    commissionSettings: { defaultRate: 15 },
    isVerified: true,
    isActive: true,
    status: 'verified',
    claimSettlementRatio: 96.4,
    foundedYear: 2005,
    description: 'One of India\'s leading private health insurers with 12,000+ cashless hospitals.'
  },
  {
    companyName: 'XYZ Insurance',
    legalName: 'XYZ Health Insurance Co',
    registrationNumber: 'XYZ-REG-002',
    irdaRegistration: 'IRDAI-XYZ-2024',
    gstNumber: '27XYZIN5678B1Z2',
    panNumber: 'XYZIN5678B',
    email: 'care@xyzinsurance.test',
    phone: '+91-1800-000-1002',
    website: 'https://xyzinsurance.test',
    address: { line1: 'XYZ House', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
    bankDetails: {
      accountNumber: '2345678901',
      ifscCode: 'ICIC0000002',
      accountHolderName: 'XYZ Health Insurance Co',
      bankName: 'ICICI Bank'
    },
    commissionSettings: { defaultRate: 15 },
    isVerified: true,
    isActive: true,
    status: 'verified',
    claimSettlementRatio: 94.1,
    foundedYear: 2008,
    description: 'Specializes in family floater plans with affordable premiums.'
  },
  {
    companyName: 'PQR Insurance',
    legalName: 'PQR General Insurance',
    registrationNumber: 'PQR-REG-003',
    irdaRegistration: 'IRDAI-PQR-2024',
    gstNumber: '07PQRIN9012C1Z8',
    panNumber: 'PQRIN9012C',
    email: 'support@pqrinsurance.test',
    phone: '+91-1800-000-1003',
    website: 'https://pqrinsurance.test',
    address: { line1: 'PQR Plaza', city: 'New Delhi', state: 'Delhi', pincode: '110001' },
    bankDetails: {
      accountNumber: '3456789012',
      ifscCode: 'SBIN0000003',
      accountHolderName: 'PQR General Insurance',
      bankName: 'State Bank of India'
    },
    commissionSettings: { defaultRate: 15 },
    isVerified: true,
    isActive: true,
    status: 'verified',
    claimSettlementRatio: 92.8,
    foundedYear: 2010,
    description: 'Known for senior citizen plans and quick claim settlements.'
  }
];

async function seed() {
  await mongoose.connect(process.env.DB_URI);
  console.log('Connected to DB\n');

  // ---------- Companies ----------
  console.log('Seeding insurance companies...');
  const companyMap = {};
  for (const c of SAMPLE_COMPANIES) {
    let company = await InsuranceCompany.findOne({ registrationNumber: c.registrationNumber });
    if (!company) {
      company = await InsuranceCompany.create(c);
      console.log(`  + Created ${c.companyName}`);
    } else {
      console.log(`  ✓ Exists  ${c.companyName}`);
    }
    companyMap[c.companyName] = company._id;
  }

  // ---------- Plans ----------
  console.log('\nSeeding insurance plans...');
  const PLAN_TEMPLATES = [
    {
      companyName: 'ABC Insurance',
      planName: 'Premium Health Plus',
      planType: 'family_floater',
      basePremium: 18500,
      sumInsured: { min: 300000, max: 5000000, default: 1000000, options: [300000, 500000, 1000000, 2000000, 5000000] },
      roomRentLimit: 'no_limit',
      icuCoverage: true,
      preExistingWaiting: 36,
      initialWaitingDays: 30,
      maternityCoverage: true,
      maternityWaitingMonths: 24,
      maternityLimit: 500000,
      opdCoverage: true,
      opdLimit: 10000,
      dentalCoverage: false,
      ayushCoverage: true,
      mentalHealthCoverage: true,
      worldwideCoverage: false,
      restoreBenefit: true,
      restoreCount: 1,
      restoreType: 'full',
      ncbPercentage: 50,
      coPayPercentage: 0,
      deductible: 0,
      cashlessHospitalCount: 12000,
      features: [
        { title: 'Unlimited room rent', category: 'coverage', included: true },
        { title: 'Automatic restore of sum insured', category: 'coverage', included: true },
        { title: '50% no-claim bonus', category: 'ncb', included: true },
        { title: 'Cashless hospitalization', category: 'cashless', included: true },
        { title: 'AYUSH treatment covered', category: 'ayush', included: true },
        { title: 'Mental health coverage', category: 'mental_health', included: true }
      ],
      isFeatured: true,
      isPopular: true,
      rating: 4.5,
      description: 'Comprehensive family floater with unlimited room rent, AYUSH, and mental health coverage.'
    },
    {
      companyName: 'ABC Insurance',
      planName: 'Health Secure Individual',
      planType: 'individual',
      basePremium: 12000,
      sumInsured: { min: 300000, max: 2500000, default: 500000, options: [300000, 500000, 1000000, 2500000] },
      roomRentLimit: 'single',
      icuCoverage: true,
      preExistingWaiting: 48,
      initialWaitingDays: 30,
      maternityCoverage: false,
      opdCoverage: false,
      ayushCoverage: true,
      mentalHealthCoverage: false,
      worldwideCoverage: false,
      restoreBenefit: false,
      ncbPercentage: 30,
      coPayPercentage: 10,
      deductible: 0,
      cashlessHospitalCount: 12000,
      rating: 4.2,
      description: 'Affordable individual health plan with AYUSH coverage.'
    },
    {
      companyName: 'XYZ Insurance',
      planName: 'Family Secure Plus',
      planType: 'family_floater',
      basePremium: 20100,
      sumInsured: { min: 500000, max: 10000000, default: 1000000, options: [500000, 1000000, 2000000, 5000000, 10000000] },
      roomRentLimit: 'no_limit',
      icuCoverage: true,
      preExistingWaiting: 24,
      initialWaitingDays: 30,
      maternityCoverage: false,
      opdCoverage: false,
      ayushCoverage: true,
      mentalHealthCoverage: true,
      worldwideCoverage: true,
      worldwideLimit: 1000000,
      restoreBenefit: true,
      restoreCount: 2,
      restoreType: 'full',
      ncbPercentage: 100,
      coPayPercentage: 0,
      deductible: 0,
      cashlessHospitalCount: 10000,
      features: [
        { title: '100% no-claim bonus', category: 'ncb', included: true },
        { title: 'Double restore benefit', category: 'coverage', included: true },
        { title: 'Worldwide emergency coverage', category: 'worldwide', included: true },
        { title: 'No room rent limit', category: 'coverage', included: true }
      ],
      isFeatured: true,
      rating: 4.6,
      description: 'Premium family plan with 100% NCB, worldwide emergency, double restore.'
    },
    {
      companyName: 'PQR Insurance',
      planName: 'Senior Citizen Care',
      planType: 'senior_citizen',
      basePremium: 28000,
      sumInsured: { min: 300000, max: 1500000, default: 500000, options: [300000, 500000, 1000000, 1500000] },
      roomRentLimit: 'twin_sharing',
      icuCoverage: true,
      preExistingWaiting: 24,
      initialWaitingDays: 30,
      minEntryAge: 60,
      maxEntryAge: 80,
      maternityCoverage: false,
      opdCoverage: false,
      ayushCoverage: true,
      mentalHealthCoverage: false,
      worldwideCoverage: false,
      restoreBenefit: true,
      ncbPercentage: 20,
      coPayPercentage: 20,
      deductible: 0,
      cashlessHospitalCount: 8500,
      rating: 4.3,
      description: 'Designed for seniors with pre-existing conditions covered after 24 months.'
    },
    {
      companyName: 'ABC Insurance',
      planName: 'Critical Illness Shield',
      planType: 'critical_illness',
      basePremium: 14500,
      sumInsured: { min: 500000, max: 5000000, default: 1000000, options: [500000, 1000000, 2000000, 5000000] },
      roomRentLimit: 'no_limit',
      icuCoverage: true,
      preExistingWaiting: 48,
      maternityCoverage: false,
      opdCoverage: false,
      ayushCoverage: false,
      mentalHealthCoverage: false,
      restoreBenefit: false,
      ncbPercentage: 0,
      coPayPercentage: 0,
      cashlessHospitalCount: 12000,
      rating: 4.4,
      description: 'Lump sum payout on diagnosis of 36 critical illnesses.'
    },
    {
      companyName: 'XYZ Insurance',
      planName: 'Maternity Care Plan',
      planType: 'maternity',
      basePremium: 24000,
      sumInsured: { min: 500000, max: 2000000, default: 1000000, options: [500000, 1000000, 2000000] },
      roomRentLimit: 'single',
      icuCoverage: true,
      preExistingWaiting: 24,
      maternityCoverage: true,
      maternityWaitingMonths: 12,
      maternityLimit: 200000,
      opdCoverage: true,
      opdLimit: 5000,
      ayushCoverage: false,
      mentalHealthCoverage: false,
      restoreBenefit: false,
      ncbPercentage: 30,
      cashlessHospitalCount: 10000,
      rating: 4.5,
      description: 'Comprehensive maternity plan covering delivery, C-section, and newborn.'
    }
  ];

  const planMap = {};
  for (const t of PLAN_TEMPLATES) {
    const companyId = companyMap[t.companyName];
    if (!companyId) continue;

    let plan = await InsurancePlan.findOne({ planName: t.planName, companyId });
    if (!plan) {
      const { companyName, ...planData } = t;
      plan = await InsurancePlan.create({
        ...planData,
        companyId,
        gstRate: 18,
        commissionRate: 15,
        isActive: true,
        isVerified: true,
        verificationDate: new Date(),
        minEntryAge: t.minEntryAge || 18,
        maxEntryAge: t.maxEntryAge || 65
      });
      console.log(`  + Created "${t.planName}"`);
    } else {
      console.log(`  ✓ Exists  "${t.planName}"`);
    }
    planMap[t.planName] = plan._id;
  }

  // ---------- Add-ons ----------
  console.log('\nSeeding add-ons...');
  const ADDON_TEMPLATES = [
    { planName: 'Premium Health Plus', code: 'MATERNITY', name: 'Maternity Protection', price: 2100, coverageLimit: 500000, displayOrder: 1 },
    { planName: 'Premium Health Plus', code: 'OPD', name: 'OPD Cover', price: 1200, coverageLimit: 10000, displayOrder: 2 },
    { planName: 'Premium Health Plus', code: 'CRITICAL_ILLNESS', name: 'Critical Illness Rider', price: 1800, coverageLimit: 500000, displayOrder: 3 },
    { planName: 'Premium Health Plus', code: 'WORLDWIDE', name: 'Worldwide Treatment', price: 900, coverageLimit: 1000000, displayOrder: 4 },
    { planName: 'Premium Health Plus', code: 'DENTAL', name: 'Dental Cover', price: 500, coverageLimit: 25000, displayOrder: 5 },
    { planName: 'Family Secure Plus', code: 'MATERNITY', name: 'Maternity Rider', price: 2500, coverageLimit: 500000, displayOrder: 1 },
    { planName: 'Family Secure Plus', code: 'OPD', name: 'OPD Cover', price: 1500, coverageLimit: 15000, displayOrder: 2 },
    { planName: 'Family Secure Plus', code: 'SUPER_TOPUP', name: 'Super Top-up', price: 750, coverageLimit: 1000000, displayOrder: 3 },
    { planName: 'Senior Citizen Care', code: 'DOMICILIARY', name: 'Domiciliary Care', price: 1200, coverageLimit: 50000, displayOrder: 1 },
    { planName: 'Senior Citizen Care', code: 'PERSONAL_ACCIDENT', name: 'Personal Accident Cover', price: 600, coverageLimit: 500000, displayOrder: 2 },
    { planName: 'Critical Illness Shield', code: 'CANCER_CARE', name: 'Enhanced Cancer Care', price: 2500, coverageLimit: 1000000, displayOrder: 1 },
    { planName: 'Maternity Care Plan', code: 'NEWBORN', name: 'Newborn Coverage', price: 1800, coverageLimit: 200000, displayOrder: 1 }
  ];

  let addonCount = 0;
  for (const a of ADDON_TEMPLATES) {
    const planId = planMap[a.planName];
    if (!planId) continue;
    const existing = await InsuranceAddon.findOne({ planId, code: a.code });
    if (!existing) {
      const { planName, ...addonData } = a;
      await InsuranceAddon.create({ ...addonData, planId, isActive: true });
      addonCount++;
    }
  }
  console.log(`  + Created ${addonCount} add-ons`);

  // ---------- Network Hospitals ----------
  console.log('\nSeeding network hospitals...');
  const CITIES = [
    { name: 'Nagpur', pincode: '440001', state: 'Maharashtra', lat: 21.1458, lng: 79.0882 },
    { name: 'Mumbai', pincode: '400001', state: 'Maharashtra', lat: 19.0760, lng: 72.8777 },
    { name: 'Delhi', pincode: '110001', state: 'Delhi', lat: 28.6139, lng: 77.2090 },
    { name: 'Bengaluru', pincode: '560001', state: 'Karnataka', lat: 12.9716, lng: 77.5946 }
  ];

  const HOSPITALS_BY_CITY = {
    Nagpur: ['Orange City Hospital', 'Care Hospital Nagpur', 'Wockhardt Nagpur', 'Government Medical College', 'Kingsway Hospital', 'AIIMS Nagpur'],
    Mumbai: ['Apollo Mumbai', 'Fortis Mumbai', 'Lilavati Hospital', 'Kokilaben Dhirubhai Ambani', 'Hinduja Hospital', 'Jaslok Hospital', 'Breach Candy Hospital'],
    Delhi: ['AIIMS Delhi', 'Max Saket', 'Fortis Delhi', 'Apollo Delhi', 'Medanta Gurgaon', 'Sir Ganga Ram Hospital'],
    Bengaluru: ['Manipal Bengaluru', 'Apollo Bengaluru', 'Fortis Bengaluru', 'Narayana Health', 'Columbia Asia', 'BGS Gleneagles']
  };

  let hospCount = 0;
  for (const companyId of Object.values(companyMap)) {
    for (const planId of Object.values(planMap)) {
      for (const city of CITIES) {
        const hospitals = HOSPITALS_BY_CITY[city.name] || [];
        for (const hName of hospitals) {
          const existing = await InsuranceNetworkHospital.findOne({ planId, name: hName, city: city.name });
          if (!existing) {
            await InsuranceNetworkHospital.create({
              planId,
              companyId,
              name: hName,
              address: `${hName}, ${city.name}, ${city.state}`,
              city: city.name,
              state: city.state,
              pincode: city.pincode,
              location: { lat: city.lat + (Math.random() - 0.5) * 0.05, lng: city.lng + (Math.random() - 0.5) * 0.05 },
              phone: `+91-${city.pincode.slice(0, 4)}-${Math.floor(100000 + Math.random() * 900000)}`,
              emergency: true,
              cashless: true,
              twentyFourSeven: true,
              specialties: ['cardiac', 'ortho', 'emergency', 'general'],
              rating: 4.0 + Math.random() * 0.8,
              isActive: true
            });
            hospCount++;
          }
        }
      }
    }
  }
  console.log(`  + Created ${hospCount} network hospital entries`);

  console.log('\n===== SEED COMPLETE =====');
  console.log(`Companies:  ${Object.keys(companyMap).length}`);
  console.log(`Plans:      ${Object.keys(planMap).length}`);
  console.log(`Add-ons:    ${addonCount} new`);
  console.log(`Hospitals:  ${hospCount} new`);
  console.log('=========================\n');

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
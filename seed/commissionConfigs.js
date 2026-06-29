const mongoose = require('mongoose');
const CommissionConfig = require('../models/CommissionConfig');
require('dotenv').config();

// ============================================
// SEED: Default Commission Configurations
// ============================================
// Run ONCE: node seed/commissionConfigs.js
// This inserts default commission rates for all 11 tags
// ============================================

const defaultConfigs = [
  // ============================================
  // 🚑 AMBULANCE - EMERGENCY
  // ============================================
  {
    configName: 'Ambulance Emergency - Default',
    description: 'Lower commission for emergency ambulance to incentivize quick response and save lives',
    serviceType: 'ambulance_emergency',
    commissionType: 'percentage',
    percentageRate: 12,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 10,
    ambulanceSpecific: {
      emergencyDiscount: 0,
      nightShiftDiscount: 3,
      longDistanceDiscount: 5,
      driverIncentiveShare: 50,
      minimumDriverEarning: 150,
      surgeCommissionRate: 15,
      peakHourAdjustments: [
        { startHour: 9, endHour: 11, adjustment: 2, reason: 'Morning peak demand' },
        { startHour: 17, endHour: 20, adjustment: 2, reason: 'Evening peak demand' }
      ]
    },
    platformFee: {
      enabled: true,
      feeType: 'fixed',
      fixedFee: 30,
      waiveForEmergency: true
    },
    gstConfig: { gstPercentage: 5, hsnCode: '999311', sacCode: '9993' },
    payoutConfig: {
      payoutFrequency: 'weekly',
      minimumPayoutAmount: 500,
      instantPayoutEnabled: true,
      instantPayoutFee: 0,
      emergencyInstantPayout: true
    },
    createdBy: 'system',
    changeReason: 'Initial default configuration'
  },

  // ============================================
  // 🚑 AMBULANCE - SCHEDULED
  // ============================================
  {
    configName: 'Ambulance Scheduled - Default',
    description: 'Standard commission for scheduled/non-emergency ambulance transport',
    serviceType: 'ambulance_scheduled',
    commissionType: 'percentage',
    percentageRate: 18,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 10,
    ambulanceSpecific: {
      emergencyDiscount: 0,
      nightShiftDiscount: 2,
      longDistanceDiscount: 3,
      driverIncentiveShare: 35,
      minimumDriverEarning: 100,
      surgeCommissionRate: 20
    },
    platformFee: {
      enabled: true,
      feeType: 'fixed',
      fixedFee: 50,
      waiveForEmergency: false
    },
    gstConfig: { gstPercentage: 5, hsnCode: '999311' },
    payoutConfig: {
      payoutFrequency: 'weekly',
      minimumPayoutAmount: 500,
      instantPayoutEnabled: false,
      emergencyInstantPayout: false
    },
    createdBy: 'system',
    changeReason: 'Initial default configuration'
  },

  // ============================================
  // 🏥 HOSPITAL - OPD
  // ============================================
  {
    configName: 'Hospital OPD - Default',
    description: 'Commission for outpatient department bookings',
    serviceType: 'hospital_opd',
    commissionType: 'percentage',
    percentageRate: 15,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 10,
    platformFee: { enabled: true, feeType: 'fixed', fixedFee: 30 },
    gstConfig: { gstPercentage: 18, hsnCode: '999311' },
    payoutConfig: { payoutFrequency: 'weekly', minimumPayoutAmount: 1000 },
    createdBy: 'system',
    changeReason: 'Initial default configuration'
  },

  // ============================================
  // 🏥 HOSPITAL - ADMISSION
  // ============================================
  {
    configName: 'Hospital Admission - Default',
    description: 'Lower commission for high-value admission bookings',
    serviceType: 'hospital_admission',
    commissionType: 'percentage',
    percentageRate: 10,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 10,
    platformFee: { enabled: true, feeType: 'fixed', fixedFee: 100 },
    gstConfig: { gstPercentage: 5, hsnCode: '999311' },
    payoutConfig: { payoutFrequency: 'weekly', minimumPayoutAmount: 5000 },
    createdBy: 'system',
    changeReason: 'Initial default configuration'
  },

  // ============================================
  // 🔬 DIAGNOSTICS / LAB TESTS
  // ============================================
  {
    configName: 'Diagnostics - Default',
    description: 'Higher commission for lab tests (labs have 40-70% margins)',
    serviceType: 'labtest',
    commissionType: 'percentage',
    percentageRate: 25,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 10,
    platformFee: { enabled: true, feeType: 'fixed', fixedFee: 20 },
    gstConfig: { gstPercentage: 18, hsnCode: '999311' },
    payoutConfig: { payoutFrequency: 'weekly', minimumPayoutAmount: 500 },
    createdBy: 'system',
    changeReason: 'Initial default configuration'
  },

  // ============================================
  // 📦 HEALTH PACKAGES
  // ============================================
  {
    configName: 'Health Packages - Default',
    serviceType: 'health_package',
    commissionType: 'percentage',
    percentageRate: 20,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 10,
    platformFee: { enabled: true, feeType: 'fixed', fixedFee: 30 },
    gstConfig: { gstPercentage: 18 },
    payoutConfig: { payoutFrequency: 'weekly', minimumPayoutAmount: 1000 },
    createdBy: 'system',
    changeReason: 'Initial default configuration'
  },

  // ============================================
  // 🏠 CAREGIVERS
  // ============================================
  {
    configName: 'Caregivers - Default',
    serviceType: 'caregiver',
    commissionType: 'percentage',
    percentageRate: 15,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 10,
    platformFee: { enabled: true, feeType: 'fixed', fixedFee: 50 },
    gstConfig: { gstPercentage: 18 },
    payoutConfig: { payoutFrequency: 'weekly', minimumPayoutAmount: 1000 },
    createdBy: 'system',
    changeReason: 'Initial default configuration'
  },

  // ============================================
  // 🧘 AYURVEDA - CONSULTATION
  // ============================================
  {
    configName: 'Ayurveda Consultation - Default',
    serviceType: 'ayurveda_consultation',
    commissionType: 'percentage',
    percentageRate: 20,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 10,
    platformFee: { enabled: true, feeType: 'fixed', fixedFee: 30 },
    gstConfig: { gstPercentage: 18 },
    payoutConfig: { payoutFrequency: 'weekly', minimumPayoutAmount: 500 },
    createdBy: 'system',
    changeReason: 'Initial default configuration'
  },

  // ============================================
  // 🧘 AYURVEDA - PANCHAKARMA
  // ============================================
  {
    configName: 'Ayurveda Panchakarma - Default',
    serviceType: 'ayurveda_panchakarma',
    commissionType: 'percentage',
    percentageRate: 15,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 10,
    platformFee: { enabled: true, feeType: 'fixed', fixedFee: 100 },
    gstConfig: { gstPercentage: 18 },
    payoutConfig: { payoutFrequency: 'weekly', minimumPayoutAmount: 2000 },
    createdBy: 'system',
    changeReason: 'Initial default configuration'
  },

  // ============================================
  // 🌿 HOMEOPATHY - CONSULTATION
  // ============================================
  {
    configName: 'Homeopathy Consultation - Default',
    serviceType: 'homeopathy_consult',
    commissionType: 'percentage',
    percentageRate: 20,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 10,
    platformFee: { enabled: true, feeType: 'fixed', fixedFee: 30 },
    gstConfig: { gstPercentage: 18 },
    payoutConfig: { payoutFrequency: 'weekly', minimumPayoutAmount: 300 },
    createdBy: 'system',
    changeReason: 'Initial default configuration'
  },

  // ============================================
  // 🌿 HOMEOPATHY - MEDICINE
  // ============================================
  {
    configName: 'Homeopathy Medicine - Default',
    serviceType: 'homeopathy_medicine',
    commissionType: 'percentage',
    percentageRate: 20,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 10,
    platformFee: { enabled: true, feeType: 'fixed', fixedFee: 20 },
    gstConfig: { gstPercentage: 12 },
    payoutConfig: { payoutFrequency: 'weekly', minimumPayoutAmount: 300 },
    createdBy: 'system',
    changeReason: 'Initial default configuration'
  },

  // ============================================
  // 🛡️ HEALTH INSURANCE
  // ============================================
  {
    configName: 'Insurance - Default',
    serviceType: 'insurance',
    commissionType: 'percentage',
    percentageRate: 15,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 10,
    platformFee: { enabled: false, feeType: 'fixed', fixedFee: 0 },
    gstConfig: { gstPercentage: 18 },
    payoutConfig: { payoutFrequency: 'monthly', minimumPayoutAmount: 10000 },
    createdBy: 'system',
    changeReason: 'Initial default configuration'
  },

  // ============================================
  // 📱 ONLINE DOCTOR CONSULTATION
  // ============================================
  {
    configName: 'Online Doctor - Default',
    serviceType: 'online_consult',
    commissionType: 'percentage',
    percentageRate: 20,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 10,
    platformFee: { enabled: true, feeType: 'fixed', fixedFee: 20 },
    gstConfig: { gstPercentage: 18 },
    payoutConfig: { payoutFrequency: 'weekly', minimumPayoutAmount: 300 },
    createdBy: 'system',
    changeReason: 'Initial default configuration'
  },

  // ============================================
  // 🧠 MENTAL HEALTH
  // ============================================
  {
    configName: 'Mental Health - Default',
    serviceType: 'mental_health',
    commissionType: 'percentage',
    percentageRate: 20,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 10,
    platformFee: { enabled: true, feeType: 'fixed', fixedFee: 30 },
    gstConfig: { gstPercentage: 18 },
    payoutConfig: { payoutFrequency: 'weekly', minimumPayoutAmount: 500 },
    createdBy: 'system',
    changeReason: 'Initial default configuration'
  },

  // ============================================
  // 💰 HEALTH EMI / FINANCING
  // ============================================
  {
    configName: 'Health EMI - Default',
    serviceType: 'health_emi',
    commissionType: 'percentage',
    percentageRate: 3,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 10,
    platformFee: { enabled: true, feeType: 'fixed', fixedFee: 0 },
    gstConfig: { gstPercentage: 18 },
    payoutConfig: { payoutFrequency: 'monthly', minimumPayoutAmount: 5000 },
    createdBy: 'system',
    changeReason: 'Initial default configuration'
  },

  // ============================================
  // 🏢 CORPORATE HEALTH
  // ============================================
  {
    configName: 'Corporate Health - Default',
    serviceType: 'corporate_health',
    commissionType: 'percentage',
    percentageRate: 12,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 10,
    platformFee: { enabled: false, feeType: 'fixed', fixedFee: 0 },
    gstConfig: { gstPercentage: 18 },
    payoutConfig: { payoutFrequency: 'monthly', minimumPayoutAmount: 10000 },
    createdBy: 'system',
    changeReason: 'Initial default configuration'
  },

  // ============================================
  // 🌍 GLOBAL FALLBACK (ALL SERVICES)
  // ============================================
  {
    configName: 'Global Default - All Services',
    description: 'Fallback configuration for any service type without a specific config',
    serviceType: 'all',
    commissionType: 'percentage',
    percentageRate: 15,
    isDefault: true,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    priority: 1,
    platformFee: { enabled: true, feeType: 'fixed', fixedFee: 30 },
    gstConfig: { gstPercentage: 18, hsnCode: '999311' },
    payoutConfig: { payoutFrequency: 'weekly', minimumPayoutAmount: 500 },
    createdBy: 'system',
    changeReason: 'Initial default configuration - applies to all unconfigured services'
  }
];

// ============================================
// SEED FUNCTION
// ============================================

async function seedCommissionConfigs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare-hub');
    console.log('📦 Connected to MongoDB');

    // Clear existing configs (optional - remove if you want to preserve)
    await CommissionConfig.deleteMany({ createdBy: 'system' });
    console.log('🧹 Cleared existing system configs');

    // Insert new configs
    const inserted = await CommissionConfig.insertMany(defaultConfigs);
    console.log(`✅ Successfully seeded ${inserted.length} commission configurations:`);
    
    inserted.forEach(config => {
      console.log(`   • ${config.serviceType}: ${config.percentageRate}% (${config.configName})`);
    });

    console.log('\n📊 Summary:');
    console.log(`   Ambulance Emergency: 12% (lowest - life-saving incentive)`);
    console.log(`   Diagnostics: 25% (highest - labs have best margins)`);
    console.log(`   Most services: 15-20%`);
    console.log(`   Global fallback: 15%`);

    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding commission configs:', error);
    process.exit(1);
  }
}

// Run the seed
seedCommissionConfigs();
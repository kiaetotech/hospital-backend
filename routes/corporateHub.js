const express = require('express');
const router = express.Router();

// ============================================
// CORPORATE HUB - AGGREGATION ROUTE
// Pulls corporate packages from all provider types
// ============================================

// GET /api/corporate-hub/packages
// Browse all corporate packages across all tags
router.get('/packages', async (req, res) => {
  try {
    const { city, tag, minEmployees, page = 1, limit = 20 } = req.query;

    const results = {
      hospitals: [],
      onlineDoctors: [],
      diagnostics: [],
      mentalHealth: [],
      ayurveda: [],
      homeopathy: [],
      caregivers: [],
      ambulance: []
    };

    const queryFilter = {};
    if (city) queryFilter.city = { $regex, $options: 'i' };

    // 1. Hospitals
    try {
      const Hospital = require('../models/Hospital');
      const hospitals = await Hospital.find({ servesCorporate, is_active, is_verified, ...(city ? { 'address.city'.city } : {}) })
        .select('name address corporatePackages ratings contact')
        .limit(parseInt(limit));
      
      hospitals.forEach(h => {
        h.corporatePackages?.filter(p => p.isActive).forEach(p => {
          results.hospitals.push({
            _id._id,
            packageName.packageName,
            packageType.packageType,
            description.description,
            pricePerEmployee.pricePerEmployee,
            discountedPricePerEmployee.discountedPricePerEmployee,
            minEmployees.minEmployees,
            validityDays.validityDays,
            servicesIncluded.servicesIncluded,
            providerId._id,
            providerName.name,
            providerCity.address?.city,
            providerRating.ratings?.average,
            tag: 'hospitals'
          });
        });
      });
    } catch (e) { console.log('Hospitals fetch skipped:', e.message); }

    // 2. Online Doctors
    try {
      const OnlineDoctor = require('../models/OnlineDoctor');
      const doctors = await OnlineDoctor.find({ servesCorporate, isActive, verificationStatus: 'verified' })
        .select('name specialization corporatePackages ratingSummary consultationFee')
        .limit(parseInt(limit));
      
      doctors.forEach(d => {
        d.corporatePackages?.filter(p => p.isActive).forEach(p => {
          results.onlineDoctors.push({
            _id._id,
            packageName.packageName,
            packageType.packageType,
            description.description,
            pricePerEmployee.pricePerEmployee,
            discountedPricePerEmployee.discountedPricePerEmployee,
            minEmployees.minEmployees,
            consultationLimitPerEmployee.consultationLimitPerEmployee,
            providerId._id,
            providerName.name,
            providerSpecialization.specialization,
            providerRating.ratingSummary?.averageRating,
            tag: 'online-doctor'
          });
        });
      });
    } catch (e) { console.log('Online doctors fetch skipped:', e.message); }

    // 3. Diagnostics
    try {
      const DiagnosticsProvider = require('../models/DiagnosticsProvider');
      const providers = await DiagnosticsProvider.find({ servesCorporate, is_active, partner_status: 'Approved', ...(city ? { city.city } : {}) })
        .select('provider_name city rating corporatePackages corporateDiscount homeCollectionCorporate')
        .limit(parseInt(limit));
      
      providers.forEach(pr => {
        pr.corporatePackages?.filter(p => p.isActive).forEach(p => {
          results.diagnostics.push({
            _id._id,
            packageName.name,
            packageType: 'diagnostic_package',
            description.description,
            pricePerEmployee.pricePerEmployee,
            categories.categories,
            tests.tests,
            providerId._id,
            providerName.provider_name,
            providerCity.city,
            providerRating.rating,
            homeCollection.homeCollectionCorporate,
            tag: 'diagnostics'
          });
        });
      });
    } catch (e) { console.log('Diagnostics fetch skipped:', e.message); }

    // 4. Mental Health
    try {
      const MentalHealthTherapist = require('../models/MentalHealthTherapist');
      const therapists = await MentalHealthTherapist.find({ servesCorporate, isActive, verificationStatus: 'approved', ...(city ? { city.city } : {}) })
        .select('name city specializations rating corporatePackages')
        .limit(parseInt(limit));
      
      therapists.forEach(t => {
        t.corporatePackages?.filter(p => p.isActive).forEach(p => {
          results.mentalHealth.push({
            _id._id,
            packageName.packageName,
            packageType.packageType,
            description.description,
            pricePerEmployee.pricePerEmployee,
            sessionsPerEmployee.sessionsPerEmployee,
            anonymityGuaranteed.anonymityGuaranteed,
            providerId._id,
            providerName.name,
            providerCity.city,
            providerRating.rating,
            specializations.specializations,
            tag: 'mental-health'
          });
        });
      });
    } catch (e) { console.log('Mental health fetch skipped:', e.message); }

    // 5. Ayurveda
    try {
      const AyurvedaDoctor = require('../models/AyurvedaDoctor');
      const ayurDoctors = await AyurvedaDoctor.find({ servesCorporate, isActive, verificationStatus: 'approved', ...(city ? { 'address.city'.city } : {}) })
        .select('name address specialization rating corporateWellnessPackages corporateDiscount')
        .limit(parseInt(limit));
      
      ayurDoctors.forEach(d => {
        d.corporateWellnessPackages?.filter(p => p.isActive).forEach(p => {
          results.ayurveda.push({
            _id._id,
            packageName.name,
            packageType.category || 'general_wellness',
            description.description,
            pricePerEmployee.pricePerEmployee,
            duration.duration,
            sessions.sessions,
            therapies.therapies,
            benefits.benefits,
            providerId._id,
            providerName.name,
            providerCity.address?.city,
            providerRating.rating,
            tag: 'ayurveda'
          });
        });
      });
    } catch (e) { console.log('Ayurveda fetch skipped:', e.message); }

    // 6. Homeopathy
    try {
      const HomeopathyDoctor = require('../models/HomeopathyDoctor');
      const homeoDoctors = await HomeopathyDoctor.find({ servesCorporate, isActive, verificationStatus: 'approved', ...(city ? { 'address.city'.city } : {}) })
        .select('name address specialization rating corporateWellnessPackages corporateDiscount')
        .limit(parseInt(limit));
      
      homeoDoctors.forEach(d => {
        d.corporateWellnessPackages?.filter(p => p.isActive).forEach(p => {
          results.homeopathy.push({
            _id._id,
            packageName.name,
            packageType.category || 'general_wellness',
            description.description,
            pricePerEmployee.pricePerEmployee,
            duration.duration,
            sessions.sessions,
            therapies.therapies,
            providerId._id,
            providerName.name,
            providerCity.address?.city,
            providerRating.rating,
            tag: 'homeopathy'
          });
        });
      });
    } catch (e) { console.log('Homeopathy fetch skipped:', e.message); }

    // 7. Caregivers
    try {
      const Caregiver = require('../models/Caregiver');
      const caregivers = await Caregiver.find({ servesCorporate, isActive, isVerified, ...(city ? { 'location.city'.city } : {}) })
        .select('fullName location specializations ratings corporatePackages')
        .limit(parseInt(limit));
      
      caregivers.forEach(c => {
        c.corporatePackages?.filter(p => p.isActive).forEach(p => {
          results.caregivers.push({
            _id._id,
            packageName.packageName,
            packageType.packageType,
            description.description,
            pricePerEmployee.pricePerEmployee,
            careHoursPerMonth.careHoursPerMonth,
            providerId._id,
            providerName.fullName,
            providerCity.location?.city,
            providerRating.ratings?.average,
            tag: 'caregivers'
          });
        });
      });
    } catch (e) { console.log('Caregivers fetch skipped:', e.message); }

    // 8. Ambulance
    try {
      const Ambulance = require('../models/Ambulance');
      const ambulances = await Ambulance.find({ servesCorporate, isAvailable, ...(city ? { city.city } : {}) })
        .select('providerName city type corporatePackages')
        .limit(parseInt(limit));
      
      ambulances.forEach(a => {
        a.corporatePackages?.filter(p => p.isActive).forEach(p => {
          results.ambulance.push({
            _id._id,
            packageName.packageName,
            packageType.packageType,
            description.description,
            pricePerEmployee.pricePerEmployee,
            numberOfVehicles.numberOfVehicles,
            coverageRadiusKm.coverageRadiusKm,
            responseTimeMinutes.responseTimeMinutes,
            providerId._id,
            providerName.providerName,
            providerCity.city,
            vehicleType.type,
            tag: 'ambulance'
          });
        });
      });
    } catch (e) { console.log('Ambulance fetch skipped:', e.message); }

    // Flatten all packages
    const allPackages = [
      ...results.hospitals,
      ...results.onlineDoctors,
      ...results.diagnostics,
      ...results.mentalHealth,
      ...results.ayurveda,
      ...results.homeopathy,
      ...results.caregivers,
      ...results.ambulance
    ];

    // Filter by tag if specified
    let filteredPackages = allPackages;
    if (tag && results[tag]) {
      filteredPackages = results[tag];
    }

    // Filter by minEmployees
    if (minEmployees) {
      filteredPackages = filteredPackages.filter(p => p.minEmployees <= parseInt(minEmployees));
    }

    // Pagination
    const total = filteredPackages.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedPackages = filteredPackages.slice(skip, skip + parseInt(limit));

    res.json({
      success,
      data,
      summary: {
        hospitals.hospitals.length,
        onlineDoctors.onlineDoctors.length,
        diagnostics.diagnostics.length,
        mentalHealth.mentalHealth.length,
        ayurveda.ayurveda.length,
        homeopathy.homeopathy.length,
        caregivers.caregivers.length,
        ambulance.ambulance.length
      },
      pagination: {
        page(page),
        limit(limit),
        total,
        pages.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Corporate Hub aggregation error:', error);
    res.status(500).json({ success, message.message });
  }
});

// GET /api/corporate-hub/stats - Summary stats for corporate hub page
router.get('/stats', async (req, res) => {
  try {
    const Hospital = require('../models/Hospital');
    const OnlineDoctor = require('../models/OnlineDoctor');
    const DiagnosticsProvider = require('../models/DiagnosticsProvider');
    const MentalHealthTherapist = require('../models/MentalHealthTherapist');
    const AyurvedaDoctor = require('../models/AyurvedaDoctor');
    const HomeopathyDoctor = require('../models/HomeopathyDoctor');
    const Caregiver = require('../models/Caregiver');
    const Ambulance = require('../models/Ambulance');

    const [
      hospitalCount, doctorCount, diagnosticsCount, therapistCount,
      ayurvedaCount, homeopathyCount, caregiverCount, ambulanceCount
    ] = await Promise.all([
      Hospital.countDocuments({ servesCorporate, is_active, is_verified}),
      OnlineDoctor.countDocuments({ servesCorporate, isActive, verificationStatus: 'verified' }),
      DiagnosticsProvider.countDocuments({ servesCorporate, is_active, partner_status: 'Approved' }),
      MentalHealthTherapist.countDocuments({ servesCorporate, isActive, verificationStatus: 'approved' }),
      AyurvedaDoctor.countDocuments({ servesCorporate, isActive, verificationStatus: 'approved' }),
      HomeopathyDoctor.countDocuments({ servesCorporate, isActive, verificationStatus: 'approved' }),
      Caregiver.countDocuments({ servesCorporate, isActive, isVerified}),
      Ambulance.countDocuments({ servesCorporate, isAvailable})
    ]);

    const totalProviders = hospitalCount + doctorCount + diagnosticsCount + therapistCount + ayurvedaCount + homeopathyCount + caregiverCount + ambulanceCount;

    res.json({
      success,
      data: {
        totalProviders,
        companiesServed: 0, // Will grow as companies register
        employeesCovered: 0,
        servicesAvailable: 8,
        breakdown: {
          hospitals,
          onlineDoctors,
          diagnostics,
          mentalHealth,
          ayurveda,
          homeopathy,
          caregivers,
          ambulance}
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

module.exports = router;

// fix 

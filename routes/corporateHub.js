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
    if (city) queryFilter.city = { $regex: city, $options: 'i' };

    // 1. Hospitals
    try {
      const Hospital = require('../models/Hospital');
      const hospitals = await Hospital.find({ servesCorporate: true, is_active: true, is_verified: true, ...(city ? { 'address.city': queryFilter.city } : {}) })
        .select('name address corporatePackages ratings contact')
        .limit(parseInt(limit));
      
      hospitals.forEach(h => {
        h.corporatePackages?.filter(p => p.isActive).forEach(p => {
          results.hospitals.push({
            _id: p._id,
            packageName: p.packageName,
            packageType: p.packageType,
            description: p.description,
            pricePerEmployee: p.pricePerEmployee,
            discountedPricePerEmployee: p.discountedPricePerEmployee,
            minEmployees: p.minEmployees,
            validityDays: p.validityDays,
            servicesIncluded: p.servicesIncluded,
            providerId: h._id,
            providerName: h.name,
            providerCity: h.address?.city,
            providerRating: h.ratings?.average,
            tag: 'hospitals'
          });
        });
      });
    } catch (e) { console.log('Hospitals fetch skipped:', e.message); }

    // 2. Online Doctors
    try {
      const OnlineDoctor = require('../models/OnlineDoctor');
      const doctors = await OnlineDoctor.find({ servesCorporate: true, isActive: true, verificationStatus: 'verified' })
        .select('name specialization corporatePackages ratingSummary consultationFee')
        .limit(parseInt(limit));
      
      doctors.forEach(d => {
        d.corporatePackages?.filter(p => p.isActive).forEach(p => {
          results.onlineDoctors.push({
            _id: p._id,
            packageName: p.packageName,
            packageType: p.packageType,
            description: p.description,
            pricePerEmployee: p.pricePerEmployee,
            discountedPricePerEmployee: p.discountedPricePerEmployee,
            minEmployees: p.minEmployees,
            consultationLimitPerEmployee: p.consultationLimitPerEmployee,
            providerId: d._id,
            providerName: d.name,
            providerSpecialization: d.specialization,
            providerRating: d.ratingSummary?.averageRating,
            tag: 'online-doctor'
          });
        });
      });
    } catch (e) { console.log('Online doctors fetch skipped:', e.message); }

    // 3. Diagnostics
    try {
      const DiagnosticsProvider = require('../models/DiagnosticsProvider');
      const providers = await DiagnosticsProvider.find({ servesCorporate: true, is_active: true, partner_status: 'Approved', ...(city ? { city: queryFilter.city } : {}) })
        .select('provider_name city rating corporatePackages corporateDiscount homeCollectionCorporate')
        .limit(parseInt(limit));
      
      providers.forEach(pr => {
        pr.corporatePackages?.filter(p => p.isActive).forEach(p => {
          results.diagnostics.push({
            _id: p._id,
            packageName: p.name,
            packageType: 'diagnostic_package',
            description: p.description,
            pricePerEmployee: p.pricePerEmployee,
            categories: p.categories,
            tests: p.tests,
            providerId: pr._id,
            providerName: pr.provider_name,
            providerCity: pr.city,
            providerRating: pr.rating,
            homeCollection: pr.homeCollectionCorporate,
            tag: 'diagnostics'
          });
        });
      });
    } catch (e) { console.log('Diagnostics fetch skipped:', e.message); }

    // 4. Mental Health
    try {
      const MentalHealthTherapist = require('../models/MentalHealthTherapist');
      const therapists = await MentalHealthTherapist.find({ servesCorporate: true, isActive: true, verificationStatus: 'approved', ...(city ? { city: queryFilter.city } : {}) })
        .select('name city specializations rating corporatePackages')
        .limit(parseInt(limit));
      
      therapists.forEach(t => {
        t.corporatePackages?.filter(p => p.isActive).forEach(p => {
          results.mentalHealth.push({
            _id: p._id,
            packageName: p.packageName,
            packageType: p.packageType,
            description: p.description,
            pricePerEmployee: p.pricePerEmployee,
            sessionsPerEmployee: p.sessionsPerEmployee,
            anonymityGuaranteed: p.anonymityGuaranteed,
            providerId: t._id,
            providerName: t.name,
            providerCity: t.city,
            providerRating: t.rating,
            specializations: t.specializations,
            tag: 'mental-health'
          });
        });
      });
    } catch (e) { console.log('Mental health fetch skipped:', e.message); }

    // 5. Ayurveda
    try {
      const AyurvedaDoctor = require('../models/AyurvedaDoctor');
      const ayurDoctors = await AyurvedaDoctor.find({ servesCorporate: true, isActive: true, verificationStatus: 'approved', ...(city ? { 'address.city': queryFilter.city } : {}) })
        .select('name address specialization rating corporateWellnessPackages corporateDiscount')
        .limit(parseInt(limit));
      
      ayurDoctors.forEach(d => {
        d.corporateWellnessPackages?.filter(p => p.isActive).forEach(p => {
          results.ayurveda.push({
            _id: p._id,
            packageName: p.name,
            packageType: p.category || 'general_wellness',
            description: p.description,
            pricePerEmployee: p.pricePerEmployee,
            duration: p.duration,
            sessions: p.sessions,
            therapies: p.therapies,
            benefits: p.benefits,
            providerId: d._id,
            providerName: d.name,
            providerCity: d.address?.city,
            providerRating: d.rating,
            tag: 'ayurveda'
          });
        });
      });
    } catch (e) { console.log('Ayurveda fetch skipped:', e.message); }

    // 6. Homeopathy
    try {
      const HomeopathyDoctor = require('../models/HomeopathyDoctor');
      const homeoDoctors = await HomeopathyDoctor.find({ servesCorporate: true, isActive: true, verificationStatus: 'approved', ...(city ? { 'address.city': queryFilter.city } : {}) })
        .select('name address specialization rating corporateWellnessPackages corporateDiscount')
        .limit(parseInt(limit));
      
      homeoDoctors.forEach(d => {
        d.corporateWellnessPackages?.filter(p => p.isActive).forEach(p => {
          results.homeopathy.push({
            _id: p._id,
            packageName: p.name,
            packageType: p.category || 'general_wellness',
            description: p.description,
            pricePerEmployee: p.pricePerEmployee,
            duration: p.duration,
            sessions: p.sessions,
            therapies: p.therapies,
            providerId: d._id,
            providerName: d.name,
            providerCity: d.address?.city,
            providerRating: d.rating,
            tag: 'homeopathy'
          });
        });
      });
    } catch (e) { console.log('Homeopathy fetch skipped:', e.message); }

    // 7. Caregivers
    try {
      const Caregiver = require('../models/Caregiver');
      const caregivers = await Caregiver.find({ servesCorporate: true, isActive: true, isVerified: true, ...(city ? { 'location.city': queryFilter.city } : {}) })
        .select('fullName location specializations ratings corporatePackages')
        .limit(parseInt(limit));
      
      caregivers.forEach(c => {
        c.corporatePackages?.filter(p => p.isActive).forEach(p => {
          results.caregivers.push({
            _id: p._id,
            packageName: p.packageName,
            packageType: p.packageType,
            description: p.description,
            pricePerEmployee: p.pricePerEmployee,
            careHoursPerMonth: p.careHoursPerMonth,
            providerId: c._id,
            providerName: c.fullName,
            providerCity: c.location?.city,
            providerRating: c.ratings?.average,
            tag: 'caregivers'
          });
        });
      });
    } catch (e) { console.log('Caregivers fetch skipped:', e.message); }

    // 8. Ambulance
    try {
      const Ambulance = require('../models/Ambulance');
      const ambulances = await Ambulance.find({ servesCorporate: true, isAvailable: true, ...(city ? { city: queryFilter.city } : {}) })
        .select('providerName city type corporatePackages')
        .limit(parseInt(limit));
      
      ambulances.forEach(a => {
        a.corporatePackages?.filter(p => p.isActive).forEach(p => {
          results.ambulance.push({
            _id: p._id,
            packageName: p.packageName,
            packageType: p.packageType,
            description: p.description,
            pricePerEmployee: p.pricePerEmployee,
            numberOfVehicles: p.numberOfVehicles,
            coverageRadiusKm: p.coverageRadiusKm,
            responseTimeMinutes: p.responseTimeMinutes,
            providerId: a._id,
            providerName: a.providerName,
            providerCity: a.city,
            vehicleType: a.type,
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
      success: true,
      data: paginatedPackages,
      summary: {
        hospitals: results.hospitals.length,
        onlineDoctors: results.onlineDoctors.length,
        diagnostics: results.diagnostics.length,
        mentalHealth: results.mentalHealth.length,
        ayurveda: results.ayurveda.length,
        homeopathy: results.homeopathy.length,
        caregivers: results.caregivers.length,
        ambulance: results.ambulance.length
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Corporate Hub aggregation error:', error);
    res.status(500).json({ success: false, message: error.message });
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
      Hospital.countDocuments({ servesCorporate: true, is_active: true, is_verified: true }),
      OnlineDoctor.countDocuments({ servesCorporate: true, isActive: true, verificationStatus: 'verified' }),
      DiagnosticsProvider.countDocuments({ servesCorporate: true, is_active: true, partner_status: 'Approved' }),
      MentalHealthTherapist.countDocuments({ servesCorporate: true, isActive: true, verificationStatus: 'approved' }),
      AyurvedaDoctor.countDocuments({ servesCorporate: true, isActive: true, verificationStatus: 'approved' }),
      HomeopathyDoctor.countDocuments({ servesCorporate: true, isActive: true, verificationStatus: 'approved' }),
      Caregiver.countDocuments({ servesCorporate: true, isActive: true, isVerified: true }),
      Ambulance.countDocuments({ servesCorporate: true, isAvailable: true })
    ]);

    const totalProviders = hospitalCount + doctorCount + diagnosticsCount + therapistCount + ayurvedaCount + homeopathyCount + caregiverCount + ambulanceCount;

    res.json({
      success: true,
      data: {
        totalProviders,
        companiesServed: 0, // Will grow as companies register
        employeesCovered: 0,
        servicesAvailable: 8,
        breakdown: {
          hospitals: hospitalCount,
          onlineDoctors: doctorCount,
          diagnostics: diagnosticsCount,
          mentalHealth: therapistCount,
          ayurveda: ayurvedaCount,
          homeopathy: homeopathyCount,
          caregivers: caregiverCount,
          ambulance: ambulanceCount
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
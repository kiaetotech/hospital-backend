const express = require('express');
const router = express.Router();

// ============================================
// CORPORATE HUB - AGGREGATION ROUTE
// Pulls corporate packages from all provider types
// ============================================

// GET /api/corporate-hub/packages
router.get('/packages', async (req, res) => {
  try {
    var city = req.query.city;
    var tag = req.query.tag;
    var minEmployees = req.query.minEmployees;
    var page = req.query.page || 1;
    var limit = req.query.limit || 20;

    var results = { hospitals: [], onlineDoctors: [], diagnostics: [], mentalHealth: [], ayurveda: [], homeopathy: [], caregivers: [], ambulance: [] };

    // 1. Hospitals
    try {
      var Hospital = require('../models/Hospital');
      var cityFilter = city ? { 'address.city': city } : {};
      var hospitals = await Hospital.find({ servesCorporate: true, is_active: true, is_verified: true, ...cityFilter })
        .select('name address corporatePackages ratings contact').limit(parseInt(limit));
      
      hospitals.forEach(function(h) {
        (h.corporatePackages || []).filter(function(p) { return p.isActive; }).forEach(function(p) {
          results.hospitals.push({
            _id: h._id, packageName: p.packageName, packageType: p.packageType,
            description: p.description, pricePerEmployee: p.pricePerEmployee,
            discountedPricePerEmployee: p.discountedPricePerEmployee, minEmployees: p.minEmployees,
            validityDays: p.validityDays, servicesIncluded: p.servicesIncluded,
            providerId: h._id, providerName: h.name, providerCity: h.address ? h.address.city : '',
            providerRating: h.ratings ? h.ratings.average : 0, tag: 'hospitals'
          });
        });
      });
    } catch (e) { console.log('Hospitals fetch skipped:', e.message); }

    // 2. Online Doctors
    try {
      var OnlineDoctor = require('../models/OnlineDoctor');
      var doctors = await OnlineDoctor.find({ servesCorporate: true, isActive: true, verificationStatus: 'verified' })
        .select('name specialization corporatePackages ratingSummary consultationFee').limit(parseInt(limit));
      
      doctors.forEach(function(d) {
        (d.corporatePackages || []).filter(function(p) { return p.isActive; }).forEach(function(p) {
          results.onlineDoctors.push({
            _id: d._id, packageName: p.packageName, packageType: p.packageType,
            description: p.description, pricePerEmployee: p.pricePerEmployee,
            discountedPricePerEmployee: p.discountedPricePerEmployee, minEmployees: p.minEmployees,
            consultationLimitPerEmployee: p.consultationLimitPerEmployee,
            providerId: d._id, providerName: d.name, providerSpecialization: d.specialization,
            providerRating: d.ratingSummary ? d.ratingSummary.averageRating : 0, tag: 'online-doctor'
          });
        });
      });
    } catch (e) { console.log('Online doctors fetch skipped:', e.message); }

    // 3. Diagnostics
    try {
      var DiagnosticsProvider = require('../models/DiagnosticsProvider');
      var diagCityFilter = city ? { city: city } : {};
      var providers = await DiagnosticsProvider.find({ servesCorporate: true, is_active: true, partner_status: 'Approved', ...diagCityFilter })
        .select('provider_name city rating corporatePackages corporateDiscount homeCollectionCorporate').limit(parseInt(limit));
      
      providers.forEach(function(pr) {
        (pr.corporatePackages || []).filter(function(p) { return p.isActive; }).forEach(function(p) {
          results.diagnostics.push({
            _id: pr._id, packageName: p.name, packageType: 'diagnostic_package',
            description: p.description, pricePerEmployee: p.pricePerEmployee,
            categories: p.categories, tests: p.tests,
            providerId: pr._id, providerName: pr.provider_name, providerCity: pr.city,
            providerRating: pr.rating, homeCollection: pr.homeCollectionCorporate, tag: 'diagnostics'
          });
        });
      });
    } catch (e) { console.log('Diagnostics fetch skipped:', e.message); }

    // 4. Mental Health
    try {
      var MentalHealthTherapist = require('../models/MentalHealthTherapist');
      var mhCityFilter = city ? { city: city } : {};
      var therapists = await MentalHealthTherapist.find({ servesCorporate: true, isActive: true, verificationStatus: 'approved', ...mhCityFilter })
        .select('name city specializations rating corporatePackages').limit(parseInt(limit));
      
      therapists.forEach(function(t) {
        (t.corporatePackages || []).filter(function(p) { return p.isActive; }).forEach(function(p) {
          results.mentalHealth.push({
            _id: t._id, packageName: p.packageName, packageType: p.packageType,
            description: p.description, pricePerEmployee: p.pricePerEmployee,
            sessionsPerEmployee: p.sessionsPerEmployee, anonymityGuaranteed: p.anonymityGuaranteed,
            providerId: t._id, providerName: t.name, providerCity: t.city,
            providerRating: t.rating, specializations: t.specializations, tag: 'mental-health'
          });
        });
      });
    } catch (e) { console.log('Mental health fetch skipped:', e.message); }

    // 5. Ayurveda
    try {
      var AyurvedaDoctor = require('../models/AyurvedaDoctor');
      var ayurCityFilter = city ? { 'address.city': city } : {};
      var ayurDoctors = await AyurvedaDoctor.find({ servesCorporate: true, isActive: true, verificationStatus: 'approved', ...ayurCityFilter })
        .select('name address specialization rating corporateWellnessPackages corporateDiscount').limit(parseInt(limit));
      
      ayurDoctors.forEach(function(d) {
        (d.corporateWellnessPackages || []).filter(function(p) { return p.isActive; }).forEach(function(p) {
          results.ayurveda.push({
            _id: d._id, packageName: p.name, packageType: p.category || 'general_wellness',
            description: p.description, pricePerEmployee: p.pricePerEmployee,
            duration: p.duration, sessions: p.sessions, therapies: p.therapies, benefits: p.benefits,
            providerId: d._id, providerName: d.name, providerCity: d.address ? d.address.city : '',
            providerRating: d.rating, tag: 'ayurveda'
          });
        });
      });
    } catch (e) { console.log('Ayurveda fetch skipped:', e.message); }

    // 6. Homeopathy
    try {
      var HomeopathyDoctor = require('../models/HomeopathyDoctor');
      var homeoCityFilter = city ? { 'address.city': city } : {};
      var homeoDoctors = await HomeopathyDoctor.find({ servesCorporate: true, isActive: true, verificationStatus: 'approved', ...homeoCityFilter })
        .select('name address specialization rating corporateWellnessPackages corporateDiscount').limit(parseInt(limit));
      
      homeoDoctors.forEach(function(d) {
        (d.corporateWellnessPackages || []).filter(function(p) { return p.isActive; }).forEach(function(p) {
          results.homeopathy.push({
            _id: d._id, packageName: p.name, packageType: p.category || 'general_wellness',
            description: p.description, pricePerEmployee: p.pricePerEmployee,
            duration: p.duration, sessions: p.sessions, therapies: p.therapies,
            providerId: d._id, providerName: d.name, providerCity: d.address ? d.address.city : '',
            providerRating: d.rating, tag: 'homeopathy'
          });
        });
      });
    } catch (e) { console.log('Homeopathy fetch skipped:', e.message); }

    // 7. Caregivers
    try {
      var Caregiver = require('../models/Caregiver');
      var cgCityFilter = city ? { 'location.city': city } : {};
      var caregivers = await Caregiver.find({ servesCorporate: true, isActive: true, isVerified: true, ...cgCityFilter })
        .select('fullName location specializations ratings corporatePackages').limit(parseInt(limit));
      
      caregivers.forEach(function(c) {
        (c.corporatePackages || []).filter(function(p) { return p.isActive; }).forEach(function(p) {
          results.caregivers.push({
            _id: c._id, packageName: p.packageName, packageType: p.packageType,
            description: p.description, pricePerEmployee: p.pricePerEmployee,
            careHoursPerMonth: p.careHoursPerMonth,
            providerId: c._id, providerName: c.fullName, providerCity: c.location ? c.location.city : '',
            providerRating: c.ratings ? c.ratings.average : 0, tag: 'caregivers'
          });
        });
      });
    } catch (e) { console.log('Caregivers fetch skipped:', e.message); }

    // 8. Ambulance
    try {
      var Ambulance = require('../models/Ambulance');
      var ambCityFilter = city ? { city: city } : {};
      var ambulances = await Ambulance.find({ servesCorporate: true, isAvailable: true, ...ambCityFilter })
        .select('providerName city type corporatePackages').limit(parseInt(limit));
      
      ambulances.forEach(function(a) {
        (a.corporatePackages || []).filter(function(p) { return p.isActive; }).forEach(function(p) {
          results.ambulance.push({
            _id: a._id, packageName: p.packageName, packageType: p.packageType,
            description: p.description, pricePerEmployee: p.pricePerEmployee,
            numberOfVehicles: p.numberOfVehicles, coverageRadiusKm: p.coverageRadiusKm,
            responseTimeMinutes: p.responseTimeMinutes,
            providerId: a._id, providerName: a.providerName, providerCity: a.city,
            vehicleType: a.type, tag: 'ambulance'
          });
        });
      });
    } catch (e) { console.log('Ambulance fetch skipped:', e.message); }

    // Flatten
    var allPackages = results.hospitals.concat(results.onlineDoctors, results.diagnostics, results.mentalHealth, results.ayurveda, results.homeopathy, results.caregivers, results.ambulance);

    var filteredPackages = allPackages;
    if (tag && results[tag]) { filteredPackages = results[tag]; }
    if (minEmployees) { filteredPackages = filteredPackages.filter(function(p) { return p.minEmployees <= parseInt(minEmployees); }); }

    var total = filteredPackages.length;
    var skip = (parseInt(page) - 1) * parseInt(limit);
    var paginatedPackages = filteredPackages.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: paginatedPackages,
      summary: {
        hospitals: results.hospitals.length, onlineDoctors: results.onlineDoctors.length,
        diagnostics: results.diagnostics.length, mentalHealth: results.mentalHealth.length,
        ayurveda: results.ayurveda.length, homeopathy: results.homeopathy.length,
        caregivers: results.caregivers.length, ambulance: results.ambulance.length
      },
      pagination: { page: parseInt(page), limit: parseInt(limit), total: total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Corporate Hub aggregation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/corporate-hub/stats
router.get('/stats', async (req, res) => {
  try {
    var Hospital = require('../models/Hospital');
    var OnlineDoctor = require('../models/OnlineDoctor');
    var DiagnosticsProvider = require('../models/DiagnosticsProvider');
    var MentalHealthTherapist = require('../models/MentalHealthTherapist');
    var AyurvedaDoctor = require('../models/AyurvedaDoctor');
    var HomeopathyDoctor = require('../models/HomeopathyDoctor');
    var Caregiver = require('../models/Caregiver');
    var Ambulance = require('../models/Ambulance');

    var counts = await Promise.all([
      Hospital.countDocuments({ servesCorporate: true, is_active: true, is_verified: true }),
      OnlineDoctor.countDocuments({ servesCorporate: true, isActive: true, verificationStatus: 'verified' }),
      DiagnosticsProvider.countDocuments({ servesCorporate: true, is_active: true, partner_status: 'Approved' }),
      MentalHealthTherapist.countDocuments({ servesCorporate: true, isActive: true, verificationStatus: 'approved' }),
      AyurvedaDoctor.countDocuments({ servesCorporate: true, isActive: true, verificationStatus: 'approved' }),
      HomeopathyDoctor.countDocuments({ servesCorporate: true, isActive: true, verificationStatus: 'approved' }),
      Caregiver.countDocuments({ servesCorporate: true, isActive: true, isVerified: true }),
      Ambulance.countDocuments({ servesCorporate: true, isAvailable: true })
    ]);

    var totalProviders = counts[0] + counts[1] + counts[2] + counts[3] + counts[4] + counts[5] + counts[6] + counts[7];

    res.json({
      success: true,
      data: {
        totalProviders: totalProviders, companiesServed: 0, employeesCovered: 0, servicesAvailable: 8,
        breakdown: { hospitals: counts[0], onlineDoctors: counts[1], diagnostics: counts[2], mentalHealth: counts[3], ayurveda: counts[4], homeopathy: counts[5], caregivers: counts[6], ambulance: counts[7] }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
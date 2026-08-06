const express = require('express');
const router = express.Router();
const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const OnlineDoctor = require('../models/OnlineDoctor');
const AyurvedaDoctor = require('../models/AyurvedaDoctor');
const HomeopathyDoctor = require('../models/HomeopathyDoctor');
const MentalHealthTherapist = require('../models/MentalHealthTherapist');
const Caregiver = require('../models/Caregiver');
const DiagnosticsProvider = require('../models/DiagnosticsProvider');
const TestMaster = require('../models/TestMaster');
const WellnessCenter = require('../models/WellnessCenter');
const NaturopathyCenter = require('../models/NaturopathyCenter');
const Pharmacy = require('../models/Pharmacy');
const InsurancePlan = require('../models/InsurancePlan');
const Ambulance = require('../models/Ambulance');

router.get('/', async (req, res) => {
  try {
    var q = req.query.q;
    var limit = req.query.limit || 20;
    
    if (!q || q.trim().length < 2) {
      return res.json({ success: true, results: [], tags: [], totalResults: 0, allResults: [] });
    }

    var searchRegex = new RegExp(q.trim(), 'i');

    var hospitalPromise = Hospital.find({ $or: [{ name: searchRegex }, { 'address.city': searchRegex }, { specialties: searchRegex }, { services: searchRegex }], is_active: true })
      .select('name address specialties services beds ratings images').limit(5).lean()
      .then(function(r) { return r.map(function(i) { return { _id: i._id, name: i.name, city: i.address ? i.address.city : '', _type: 'hospital', tag: 'Hospitals', tagIcon: '🏥', link: '/hospitals/' + i._id, subtitle: (i.address ? i.address.city || '' : '') + ' • ' + (i.beds ? i.beds.available || 0 : 0) + ' beds' }; }); });

    var doctorPromise = Doctor.find({ $or: [{ name: searchRegex }, { specialization: searchRegex }, { city: searchRegex }], isVerified: true })
      .select('name specialization city hospitalName rating image').limit(5).lean()
      .then(function(r) { return r.map(function(i) { return { _id: i._id, name: i.name, _type: 'doctor', tag: 'Doctors', tagIcon: '👨‍⚕️', link: '/hospitals/doctor/' + i._id, subtitle: (i.specialization || '') + ' • ' + (i.hospitalName || i.city || '') }; }); });

    var onlineDocPromise = OnlineDoctor.find({ $or: [{ name: searchRegex }, { specialization: searchRegex }, { city: searchRegex }], isVerified: true })
      .select('name specialization city consultationFee rating image').limit(5).lean()
      .then(function(r) { return r.map(function(i) { return { _id: i._id, name: i.name, _type: 'onlinedoctor', tag: 'Online Doctors', tagIcon: '📱', link: '/online-doctor/' + i._id, subtitle: (i.specialization || '') + ' • ₹' + (i.consultationFee || 0) }; }); });

    var ayurvedaPromise = AyurvedaDoctor.find({ $or: [{ name: searchRegex }, { specialization: searchRegex }, { 'address.city': searchRegex }], isVerified: true })
      .select('name specialization address consultationFee rating image').limit(5).lean()
      .then(function(r) { return r.map(function(i) { return { _id: i._id, name: i.name, _type: 'ayurveda', tag: 'Ayurveda', tagIcon: '🧘', link: '/ayurveda/doctor/' + i._id, subtitle: (i.specialization || '') + ' • ' + (i.address ? i.address.city || '' : '') }; }); });

    var wellnessPromise = WellnessCenter.find({ $or: [{ name: searchRegex }, { city: searchRegex }, { services: searchRegex }], isVerified: true })
      .select('name city services rating images').limit(3).lean()
      .then(function(r) { return r.map(function(i) { return { _id: i._id, name: i.name, _type: 'wellness', tag: 'Wellness Centers', tagIcon: '🧘', link: '/ayurveda/center/' + i._id, subtitle: (i.city || '') + ' • ' + (i.services || []).slice(0, 3).join(', ') }; }); });

    var homeopathyPromise = HomeopathyDoctor.find({ $or: [{ name: searchRegex }, { specialization: searchRegex }, { 'address.city': searchRegex }], isVerified: true })
      .select('name specialization address consultationFee rating image').limit(5).lean()
      .then(function(r) { return r.map(function(i) { return { _id: i._id, name: i.name, _type: 'homeopathy', tag: 'Homeopathy', tagIcon: '🌿', link: '/homeopathy/doctor/' + i._id, subtitle: (i.specialization || '') + ' • ' + (i.address ? i.address.city || '' : '') }; }); });

    var therapistPromise = MentalHealthTherapist.find({ $or: [{ name: searchRegex }, { specialization: searchRegex }, { city: searchRegex }], isVerified: true })
      .select('name specialization city sessionFee rating image').limit(5).lean()
      .then(function(r) { return r.map(function(i) { return { _id: i._id, name: i.name, _type: 'therapist', tag: 'Mental Health', tagIcon: '🧠', link: '/mentalhealth/therapist/' + i._id, subtitle: (i.specialization || '') + ' • ₹' + (i.sessionFee || 0) + '/session' }; }); });

    var caregiverPromise = Caregiver.find({ $or: [{ name: searchRegex }, { serviceType: searchRegex }, { 'location.city': searchRegex }], isVerified: true })
      .select('name serviceType location hourlyRate rating image').limit(5).lean()
      .then(function(r) { return r.map(function(i) { return { _id: i._id, name: i.name, _type: 'caregiver', tag: 'Home Care', tagIcon: '🏠', link: '/caregivers/' + i._id, subtitle: (i.serviceType || '') + ' • ₹' + (i.hourlyRate || 0) + '/hr' }; }); });

    var testPromise = TestMaster.find({ $or: [{ testName: searchRegex }, { category: searchRegex }, { description: searchRegex }], isActive: true })
      .select('testName category description minPrice').limit(5).lean()
      .then(function(r) { return r.map(function(i) { return { _id: i._id, name: i.testName, _type: 'labtest', tag: 'Lab Tests', tagIcon: '🔬', link: '/diagnostics/test/' + i._id, subtitle: (i.category || '') + ' • Starting ₹' + (i.minPrice || 'N/A') }; }); });

    var diagnosticsPromise = DiagnosticsProvider.find({ $or: [{ name: searchRegex }, { city: searchRegex }, { services: searchRegex }], isVerified: true })
      .select('name city services rating image').limit(3).lean()
      .then(function(r) { return r.map(function(i) { return { _id: i._id, name: i.name, _type: 'diagnostics', tag: 'Labs', tagIcon: '🔬', link: '/diagnostics/provider/' + i._id, subtitle: (i.city || '') + ' • ' + (i.services || []).slice(0, 3).join(', ') }; }); });

    var ambulancePromise = Ambulance.find({ $or: [{ providerName: searchRegex }, { city: searchRegex }, { vehicleType: searchRegex }], isActive: true })
      .select('providerName city vehicleType basePrice rating').limit(3).lean()
      .then(function(r) { return r.map(function(i) { return { _id: i._id, name: i.providerName, _type: 'ambulance', tag: 'Ambulance', tagIcon: '🚑', link: '/ambulance', subtitle: (i.vehicleType || '') + ' • ' + (i.city || '') + ' • ₹' + (i.basePrice || 0) }; }); });

    var insurancePromise = InsurancePlan.find({ $or: [{ planName: searchRegex }, { provider: searchRegex }, { type: searchRegex }, { description: searchRegex }], isActive: true })
      .select('planName provider type premium sumInsured').limit(3).lean()
      .then(function(r) { return r.map(function(i) { return { _id: i._id, name: i.planName, _type: 'insurance', tag: 'Insurance', tagIcon: '🛡️', link: '/insurance/' + i._id, subtitle: (i.type || '') + ' • Premium ₹' + (i.premium || 0) + ' • Cover ₹' + (i.sumInsured || 0) }; }); });

    var pharmacyPromise = Pharmacy.find({ $or: [{ name: searchRegex }, { city: searchRegex }], isVerified: true })
      .select('name city medicines rating').limit(3).lean()
      .then(function(r) { return r.map(function(i) { return { _id: i._id, name: i.name, _type: 'pharmacy', tag: 'Pharmacy', tagIcon: '💊', link: '/homeopathy/pharmacy/' + i._id, subtitle: (i.city || '') + ' • ' + (i.medicines || []).length + ' medicines' }; }); });

    var naturopathyPromise = NaturopathyCenter.find({ $or: [{ name: searchRegex }, { city: searchRegex }, { treatments: searchRegex }], isVerified: true })
      .select('name city treatments rating images').limit(3).lean()
      .then(function(r) { return r.map(function(i) { return { _id: i._id, name: i.name, _type: 'naturopathy', tag: 'Naturopathy', tagIcon: '🌿', link: '/homeopathy/naturopathy/' + i._id, subtitle: (i.city || '') + ' • ' + (i.treatments || []).slice(0, 3).join(', ') }; }); });

    var allResults = await Promise.all([hospitalPromise, doctorPromise, onlineDocPromise, ayurvedaPromise, wellnessPromise, homeopathyPromise, therapistPromise, caregiverPromise, testPromise, diagnosticsPromise, ambulancePromise, insurancePromise, pharmacyPromise, naturopathyPromise]);
    
    var groupedResults = {};
    var allTags = [];
    var totalResults = 0;
    
    for (var i = 0; i < allResults.length; i++) {
      var tagResults = allResults[i];
      if (tagResults.length > 0) {
        var tag = tagResults[0].tag;
        groupedResults[tag] = tagResults;
        allTags.push({ tag: tag, tagIcon: tagResults[0].tagIcon, count: tagResults.length });
        totalResults += tagResults.length;
      }
    }

    res.json({ success: true, query: q, totalResults: totalResults, tags: allTags, results: groupedResults, allResults: allResults.flat() });
    
  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({ success: false, message: 'Search failed', error: error.message });
  }
});

module.exports = router;
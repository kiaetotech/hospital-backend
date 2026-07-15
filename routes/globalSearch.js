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
const Insurance = require('../models/Insurance');
const Ambulance = require('../models/Ambulance');

router.get('/', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json({ success: true, results: [], tags: [], totalResults: 0, allResults: [] });
    }

    const searchRegex = new RegExp(q.trim(), 'i');

    const searchPromises = [
      // 🏥 Hospitals
      Hospital.find({
        $or: [
          { name: searchRegex },
          { city: searchRegex },
          { specialization: searchRegex },
          { services: searchRegex }
        ],
        isVerified: true
      })
      .select('name city specialization services beds rating images')
      .limit(5)
      .lean()
      .then(results => results.map(r => ({
        ...r,
        _type: 'hospital',
        tag: 'Hospitals',
        tagIcon: '🏥',
        link: `/hospitals/${r._id}`,
        subtitle: `${r.city || ''} • ${r.beds?.available || 0} beds available`
      }))),

      // 👨‍⚕️ Hospital Doctors
      Doctor.find({
        $or: [
          { name: searchRegex },
          { specialization: searchRegex },
          { city: searchRegex }
        ],
        isVerified: true
      })
      .select('name specialization city hospitalName hospital rating image')
      .limit(5)
      .lean()
      .then(results => results.map(r => ({
        ...r,
        _type: 'doctor',
        tag: 'Doctors',
        tagIcon: '👨‍⚕️',
        link: `/hospitals/doctor/${r._id}`,
        subtitle: `${r.specialization || ''} • ${r.hospitalName || r.city || ''}`
      }))),

      // 📱 Online Doctors
      OnlineDoctor.find({
        $or: [
          { name: searchRegex },
          { specialization: searchRegex },
          { city: searchRegex }
        ],
        isVerified: true
      })
      .select('name specialization city consultationFee rating image')
      .limit(5)
      .lean()
      .then(results => results.map(r => ({
        ...r,
        _type: 'onlinedoctor',
        tag: 'Online Doctors',
        tagIcon: '📱',
        link: `/online-doctor/${r._id}`,
        subtitle: `${r.specialization || ''} • ₹${r.consultationFee || 0} consultation`
      }))),

      // 🧘 Ayurveda Doctors
      AyurvedaDoctor.find({
        $or: [
          { name: searchRegex },
          { specialization: searchRegex },
          { city: searchRegex }
        ],
        isVerified: true
      })
      .select('name specialization city consultationFee rating image')
      .limit(5)
      .lean()
      .then(results => results.map(r => ({
        ...r,
        _type: 'ayurvedadoctor',
        tag: 'Ayurveda',
        tagIcon: '🧘',
        link: `/ayurveda/doctor/${r._id}`,
        subtitle: `${r.specialization || ''} • ${r.city || ''}`
      }))),

      // 🏠 Wellness Centers
      WellnessCenter.find({
        $or: [
          { name: searchRegex },
          { city: searchRegex },
          { services: searchRegex }
        ],
        isVerified: true
      })
      .select('name city services rating images')
      .limit(3)
      .lean()
      .then(results => results.map(r => ({
        ...r,
        _type: 'wellnesscenter',
        tag: 'Wellness Centers',
        tagIcon: '🧘',
        link: `/ayurveda/center/${r._id}`,
        subtitle: `${r.city || ''} • ${(r.services || []).slice(0, 3).join(', ')}`
      }))),

      // 🌿 Homeopathy Doctors
      HomeopathyDoctor.find({
        $or: [
          { name: searchRegex },
          { specialization: searchRegex },
          { city: searchRegex }
        ],
        isVerified: true
      })
      .select('name specialization city consultationFee rating image')
      .limit(5)
      .lean()
      .then(results => results.map(r => ({
        ...r,
        _type: 'homeopathydoctor',
        tag: 'Homeopathy',
        tagIcon: '🌿',
        link: `/homeopathy/doctor/${r._id}`,
        subtitle: `${r.specialization || ''} • ${r.city || ''}`
      }))),

      // 🧠 Mental Health Therapists
      MentalHealthTherapist.find({
        $or: [
          { name: searchRegex },
          { specialization: searchRegex },
          { city: searchRegex }
        ],
        isVerified: true
      })
      .select('name specialization city sessionFee rating image')
      .limit(5)
      .lean()
      .then(results => results.map(r => ({
        ...r,
        _type: 'therapist',
        tag: 'Mental Health',
        tagIcon: '🧠',
        link: `/mentalhealth/therapist/${r._id}`,
        subtitle: `${r.specialization || ''} • ₹${r.sessionFee || 0}/session`
      }))),

      // 🏠 Caregivers
      Caregiver.find({
        $or: [
          { name: searchRegex },
          { serviceType: searchRegex },
          { city: searchRegex }
        ],
        isVerified: true
      })
      .select('name serviceType city hourlyRate rating image')
      .limit(5)
      .lean()
      .then(results => results.map(r => ({
        ...r,
        _type: 'caregiver',
        tag: 'Home Care',
        tagIcon: '🏠',
        link: `/caregivers/${r._id}`,
        subtitle: `${r.serviceType || ''} • ₹${r.hourlyRate || 0}/hr`
      }))),

      // 🔬 Lab Tests
      TestMaster.find({
        $or: [
          { testName: searchRegex },
          { category: searchRegex },
          { description: searchRegex }
        ],
        isActive: true
      })
      .select('testName category description minPrice')
      .limit(5)
      .lean()
      .then(results => results.map(r => ({
        ...r,
        _type: 'labtest',
        tag: 'Lab Tests',
        tagIcon: '🔬',
        link: `/diagnostics/test/${r._id}`,
        subtitle: `${r.category || ''} • Starting ₹${r.minPrice || 'N/A'}`
      }))),

      // 🔬 Diagnostics Providers
      DiagnosticsProvider.find({
        $or: [
          { name: searchRegex },
          { city: searchRegex },
          { services: searchRegex }
        ],
        isVerified: true
      })
      .select('name city services rating image')
      .limit(3)
      .lean()
      .then(results => results.map(r => ({
        ...r,
        _type: 'diagnostics',
        tag: 'Labs',
        tagIcon: '🔬',
        link: `/diagnostics/provider/${r._id}`,
        subtitle: `${r.city || ''} • ${(r.services || []).slice(0, 3).join(', ')}`
      }))),

      // 🚑 Ambulance
      Ambulance.find({
        $or: [
          { providerName: searchRegex },
          { city: searchRegex },
          { vehicleType: searchRegex }
        ],
        isActive: true
      })
      .select('providerName city vehicleType basePrice rating')
      .limit(3)
      .lean()
      .then(results => results.map(r => ({
        ...r,
        _type: 'ambulance',
        tag: 'Ambulance',
        tagIcon: '🚑',
        link: `/ambulance`,
        subtitle: `${r.vehicleType || ''} • ${r.city || ''} • ₹${r.basePrice || 0}`
      }))),

      // 🛡️ Insurance
      Insurance.find({
        $or: [
          { planName: searchRegex },
          { provider: searchRegex },
          { type: searchRegex },
          { description: searchRegex }
        ],
        isActive: true
      })
      .select('planName provider type premium sumInsured')
      .limit(3)
      .lean()
      .then(results => results.map(r => ({
        ...r,
        _type: 'insurance',
        tag: 'Insurance',
        tagIcon: '🛡️',
        link: `/insurance/${r._id}`,
        subtitle: `${r.type || ''} • Premium ₹${r.premium || 0} • Cover ₹${r.sumInsured || 0}`
      }))),

      // 🏪 Pharmacy
      Pharmacy.find({
        $or: [
          { name: searchRegex },
          { city: searchRegex }
        ],
        isVerified: true
      })
      .select('name city medicines rating')
      .limit(3)
      .lean()
      .then(results => results.map(r => ({
        ...r,
        _type: 'pharmacy',
        tag: 'Pharmacy',
        tagIcon: '💊',
        link: `/homeopathy/pharmacy/${r._id}`,
        subtitle: `${r.city || ''} • ${(r.medicines || []).length} medicines`
      }))),

      // 🌿 Naturopathy Centers
      NaturopathyCenter.find({
        $or: [
          { name: searchRegex },
          { city: searchRegex },
          { treatments: searchRegex }
        ],
        isVerified: true
      })
      .select('name city treatments rating images')
      .limit(3)
      .lean()
      .then(results => results.map(r => ({
        ...r,
        _type: 'naturopathy',
        tag: 'Naturopathy',
        tagIcon: '🌿',
        link: `/homeopathy/naturopathy/${r._id}`,
        subtitle: `${r.city || ''} • ${(r.treatments || []).slice(0, 3).join(', ')}`
      })))
    ];

    const allResults = await Promise.all(searchPromises);
    
    // Group results by tag
    const groupedResults = {};
    const allTags = [];
    
    allResults.forEach(tagResults => {
      if (tagResults.length > 0) {
        const tag = tagResults[0].tag;
        const tagIcon = tagResults[0].tagIcon;
        groupedResults[tag] = tagResults;
        allTags.push({ tag, tagIcon, count: tagResults.length });
      }
    });

    const totalCount = allResults.reduce((sum, arr) => sum + arr.length, 0);

    res.json({
      success: true,
      query: q,
      totalResults: totalCount,
      tags: allTags,
      results: groupedResults,
      allResults: allResults.flat()
    });
    
  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Search failed',
      error: error.message 
    });
  }
});

// Quick search/autocomplete
router.get('/quick', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ success: true, results: [] });
    }

    const searchRegex = new RegExp('^' + q.trim(), 'i');
    
    const quickResults = await Promise.all([
      Hospital.find({ name: searchRegex, isVerified: true })
        .select('name city').limit(2).lean(),
      OnlineDoctor.find({ name: searchRegex, isVerified: true })
        .select('name specialization').limit(2).lean(),
      TestMaster.find({ testName: searchRegex, isActive: true })
        .select('testName category').limit(2).lean()
    ]);

    const suggestions = quickResults.flat().slice(0, 5).map(r => ({
      name: r.name || r.testName,
      subtitle: r.specialization || r.city || r.category,
      type: r.specialization ? 'Doctor' : r.city ? 'Hospital' : 'Test'
    }));

    res.json({ success: true, results: suggestions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
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
    const { q, limit = 20 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json({ success, results: [], tags: [], totalResults: 0, allResults: [] });
    }

    const searchRegex = new RegExp(q.trim(), 'i');

    const searchPromises = [
      Hospital.find({
        $or: [{ name}, { city}, { specialization}, { services}],
        isVerified}).select('name city specialization services beds rating images').limit(5).lean()
        .then(r => r.map(i => ({ ...i, _type: 'hospital', tag: 'Hospitals', tagIcon: '🏥', link: `/hospitals/${i._id}`, subtitle: `${i.city || ''} • ${i.beds?.available || 0} beds` }))),

      Doctor.find({
        $or: [{ name}, { specialization}, { city}],
        isVerified}).select('name specialization city hospitalName rating image').limit(5).lean()
        .then(r => r.map(i => ({ ...i, _type: 'doctor', tag: 'Doctors', tagIcon: '👨‍⚕️', link: `/hospitals/doctor/${i._id}`, subtitle: `${i.specialization || ''} • ${i.hospitalName || i.city || ''}` }))),

      OnlineDoctor.find({
        $or: [{ name}, { specialization}, { city}],
        isVerified}).select('name specialization city consultationFee rating image').limit(5).lean()
        .then(r => r.map(i => ({ ...i, _type: 'onlinedoctor', tag: 'Online Doctors', tagIcon: '📱', link: `/online-doctor/${i._id}`, subtitle: `${i.specialization || ''} • ₹${i.consultationFee || 0}` }))),

      AyurvedaDoctor.find({
        $or: [{ name}, { specialization}, { city}],
        isVerified}).select('name specialization city consultationFee rating image').limit(5).lean()
        .then(r => r.map(i => ({ ...i, _type: 'ayurveda', tag: 'Ayurveda', tagIcon: '🧘', link: `/ayurveda/doctor/${i._id}`, subtitle: `${i.specialization || ''} • ${i.city || ''}` }))),

      WellnessCenter.find({
        $or: [{ name}, { city}, { services}],
        isVerified}).select('name city services rating images').limit(3).lean()
        .then(r => r.map(i => ({ ...i, _type: 'wellness', tag: 'Wellness Centers', tagIcon: '🧘', link: `/ayurveda/center/${i._id}`, subtitle: `${i.city || ''} • ${(i.services || []).slice(0, 3).join(', ')}` }))),

      HomeopathyDoctor.find({
        $or: [{ name}, { specialization}, { city}],
        isVerified}).select('name specialization city consultationFee rating image').limit(5).lean()
        .then(r => r.map(i => ({ ...i, _type: 'homeopathy', tag: 'Homeopathy', tagIcon: '🌿', link: `/homeopathy/doctor/${i._id}`, subtitle: `${i.specialization || ''} • ${i.city || ''}` }))),

      MentalHealthTherapist.find({
        $or: [{ name}, { specialization}, { city}],
        isVerified}).select('name specialization city sessionFee rating image').limit(5).lean()
        .then(r => r.map(i => ({ ...i, _type: 'therapist', tag: 'Mental Health', tagIcon: '🧠', link: `/mentalhealth/therapist/${i._id}`, subtitle: `${i.specialization || ''} • ₹${i.sessionFee || 0}/session` }))),

      Caregiver.find({
        $or: [{ name}, { serviceType}, { city}],
        isVerified}).select('name serviceType city hourlyRate rating image').limit(5).lean()
        .then(r => r.map(i => ({ ...i, _type: 'caregiver', tag: 'Home Care', tagIcon: '🏠', link: `/caregivers/${i._id}`, subtitle: `${i.serviceType || ''} • ₹${i.hourlyRate || 0}/hr` }))),

      TestMaster.find({
        $or: [{ testName}, { category}, { description}],
        isActive}).select('testName category description minPrice').limit(5).lean()
        .then(r => r.map(i => ({ ...i, _type: 'labtest', tag: 'Lab Tests', tagIcon: '🔬', link: `/diagnostics/test/${i._id}`, subtitle: `${i.category || ''} • Starting ₹${i.minPrice || 'N/A'}` }))),

      DiagnosticsProvider.find({
        $or: [{ name}, { city}, { services}],
        isVerified}).select('name city services rating image').limit(3).lean()
        .then(r => r.map(i => ({ ...i, _type: 'diagnostics', tag: 'Labs', tagIcon: '🔬', link: `/diagnostics/provider/${i._id}`, subtitle: `${i.city || ''} • ${(i.services || []).slice(0, 3).join(', ')}` }))),

      Ambulance.find({
        $or: [{ providerName}, { city}, { vehicleType}],
        isActive}).select('providerName city vehicleType basePrice rating').limit(3).lean()
        .then(r => r.map(i => ({ ...i, _type: 'ambulance', tag: 'Ambulance', tagIcon: '🚑', link: `/ambulance`, subtitle: `${i.vehicleType || ''} • ${i.city || ''} • ₹${i.basePrice || 0}` }))),

      InsurancePlan.find({
        $or: [{ planName}, { provider}, { type}, { description}],
        isActive}).select('planName provider type premium sumInsured').limit(3).lean()
        .then(r => r.map(i => ({ ...i, _type: 'insurance', tag: 'Insurance', tagIcon: '🛡️', link: `/insurance/${i._id}`, subtitle: `${i.type || ''} • Premium ₹${i.premium || 0} • Cover ₹${i.sumInsured || 0}` }))),

      Pharmacy.find({
        $or: [{ name}, { city}],
        isVerified}).select('name city medicines rating').limit(3).lean()
        .then(r => r.map(i => ({ ...i, _type: 'pharmacy', tag: 'Pharmacy', tagIcon: '💊', link: `/homeopathy/pharmacy/${i._id}`, subtitle: `${i.city || ''} • ${(i.medicines || []).length} medicines` }))),

      NaturopathyCenter.find({
        $or: [{ name}, { city}, { treatments}],
        isVerified}).select('name city treatments rating images').limit(3).lean()
        .then(r => r.map(i => ({ ...i, _type: 'naturopathy', tag: 'Naturopathy', tagIcon: '🌿', link: `/homeopathy/naturopathy/${i._id}`, subtitle: `${i.city || ''} • ${(i.treatments || []).slice(0, 3).join(', ')}` })))
    ];

    const allResults = await Promise.all(searchPromises);
    const groupedResults = {};
    const allTags = [];
    
    allResults.forEach(tagResults => {
      if (tagResults.length > 0) {
        const tag = tagResults[0].tag;
        groupedResults[tag] = tagResults;
        allTags.push({ tag, tagIcon[0].tagIcon, count.length });
      }
    });

    res.json({
      success,
      query,
      totalResults.reduce((s, a) => s + a.length, 0),
      tags,
      results,
      allResults.flat()
    });
    
  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({ success, message: 'Search failed', error.message });
  }
});

router.get('/quick', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ success, results: [] });

    const searchRegex = new RegExp('^' + q.trim(), 'i');
    const quickResults = await Promise.all([
      Hospital.find({ name, isVerified}).select('name city').limit(2).lean(),
      OnlineDoctor.find({ name, isVerified}).select('name specialization').limit(2).lean(),
      TestMaster.find({ testName, isActive}).select('testName category').limit(2).lean()
    ]);

    res.json({
      success,
      results.flat().slice(0, 5).map(r => ({
        name.name || r.testName,
        subtitle.specialization || r.city || r.category
      }))
    });
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

module.exports = router;


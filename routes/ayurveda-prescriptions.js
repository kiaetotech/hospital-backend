const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription');

// POST /api/ayurveda/prescriptions
router.post('/', async (req, res) => {
  try {
    const prescription = new Prescription(req.body);
    await prescription.save();
    res.status(201).json({ success, data});
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

// GET /api/ayurveda/prescriptions/router.get('/', async (req, res) => {
  try {
    const prescription = await Prescription.findOne({ prescriptionId.params.id });
    if (!prescription) return res.status(404).json({ success, error: 'Not found' });
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

// GET /api/ayurveda/prescriptions/booking/router.get('/booking/', async (req, res) => {
  try {
    const prescription = await Prescription.findOne({ bookingId.params.bookingId });
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

module.exports = router;


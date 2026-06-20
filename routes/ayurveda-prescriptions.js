const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription');

// POST /api/ayurveda/prescriptions
router.post('/', async (req, res) => {
  try {
    const prescription = new Prescription(req.body);
    await prescription.save();
    res.status(201).json({ success: true, data: prescription });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ayurveda/prescriptions/:id
router.get('/:id', async (req, res) => {
  try {
    const prescription = await Prescription.findOne({ prescriptionId: req.params.id });
    if (!prescription) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: prescription });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ayurveda/prescriptions/booking/:bookingId
router.get('/booking/:bookingId', async (req, res) => {
  try {
    const prescription = await Prescription.findOne({ bookingId: req.params.bookingId });
    res.json({ success: true, data: prescription });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
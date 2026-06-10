const express = require('express');
const Booking = require('../models/Booking');
const router = express.Router();

// Update booking status
router.put('/:bookingId/status', async (req, res) => {
  try {
    const { status, note } = req.body;
    const booking = await Booking.findOne({ bookingId: req.params.bookingId });
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    booking.status = status;
    booking.statusHistory.push({ status, note, timestamp: new Date() });
    
    // Set estimated report time for lab tests
    if (status === 'sample_collected') {
      booking.estimatedReportTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }
    
    await booking.save();
    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get booking status
router.get('/:bookingId/status', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId }).select('status statusHistory estimatedReportTime');
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
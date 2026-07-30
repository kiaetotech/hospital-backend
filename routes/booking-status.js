const express = require('express');
const Booking = require('../models/Booking');
const router = express.Router();

// Get booking status by ID (with full details)
router.get('/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json({
      bookingId: booking.bookingId,
      status: booking.status,
      statusHistory: booking.statusHistory || [],
      estimatedReportTime: booking.estimatedReportTime,
      appointmentDate: booking.appointmentDate,
      providerName: booking.providerName,
      tests: booking.tests,
      patientName: booking.patientName,
      patientPhone: booking.patientPhone
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update booking status (with history)
router.put('/:bookingId/status', async (req, res) => {
  try {
    const { status, note } = req.body;
    const booking = await Booking.findOne({ bookingId: req.params.bookingId });
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    const validStatuses = ['pending', 'confirmed', 'sample_collected', 'processing', 'report_ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    booking.status = status;
    booking.statusHistory = booking.statusHistory || [];
    booking.statusHistory.push({
      status: status,
      timestamp: new Date(),
      note: note || `Status changed to ${status}`
    });
    
    // Set estimated report time for lab tests when sample is collected
    if (status === 'sample_collected') {
      booking.estimatedReportTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }
    
    await booking.save();
    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get status timeline for a booking
router.get('/:bookingId/timeline', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(booking.statusHistory || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get simple status (legacy support)
router.get('/:bookingId/status', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId }).select('status statusHistory estimatedReportTime');
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
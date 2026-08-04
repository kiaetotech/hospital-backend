const express = require('express');
const Booking = require('../models/Booking');
const router = express.Router();
const { sendBookingEmail, sendBookingSMS } = require('../utils/notifications');

// Create a new booking (for lab tests)
router.post('/create', async (req, res) => {
  try {
    const {
      patientName, patientAge, patientGender, patientPhone, patientEmail,
      tests, providerName, totalAmount, appointmentDate,
      homeCollectionRequested, homeAddress, userId
    } = req.body;
    
    // Generate unique booking ID
    const bookingId = 'LAB' + Date.now() + Math.floor(Math.random() * 1000);
    
    const booking = new Booking({
      bookingId,
      userId: userId || 'guest_' + Date.now(),
      bookingType: 'labtest',
      patientName,
      patientAge,
      patientGender,
      patientPhone,
      patientEmail,
      tests,
      providerName,
      originalAmount: totalAmount,
      finalAmount: totalAmount,
      appointmentDate: new Date(appointmentDate),
      homeCollectionRequested: homeCollectionRequested || false,
      homeAddress: homeAddress || '',
      status: 'confirmed',
      paymentStatus: 'pending'
    });
    
    await booking.save();
    
    // NON-BLOCKING NOTIFICATIONS - Run in background
    // This won't delay the response
    Promise.resolve().then(async () => {
      try {
        await sendBookingEmail(booking);
        console.log('Email sent to:', patientEmail);
      } catch (emailError) {
        console.error('Email error:', emailError.message);
      }
      
      try {
        await sendBookingSMS(booking);
        console.log('SMS sent to:', patientPhone);
      } catch (smsError) {
        console.error('SMS error:', smsError.message);
      }
    });
    
    // Send response immediately without waiting for notifications
    res.json({ 
      success: true, 
      bookingId: booking.bookingId,
      message: 'Booking created successfully!' 
    });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get booking by ID
router.get('/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all bookings for a patient (by phone number)
router.get('/patient/:phone', async (req, res) => {
  try {
    const bookings = await Booking.find({ patientPhone: req.params.phone })
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update booking status
router.put('/:bookingId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findOneAndUpdate(
      { bookingId: req.params.bookingId },
      { status },
      { new: true }
    );
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const Hospital = require('../models/Hospital');
const { authenticateToken } = require('../middleware/auth');
const { sendBookingEmail, sendBookingSMS, sendCancellationEmail } = require('../utils/notifications');

// ============================================
// CREATE BOOKING (OPD / Admission / Lab)
// ============================================
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const {
      bookingType, // 'opd', 'admission', 'labtest', 'ambulance'
      hospitalId, hospitalName,
      doctorName, doctorSpecialization,
      roomType, roomPrice, numberOfDays,
      patientName, patientAge, patientGender,
      patientPhone, patientEmail,
      appointmentDate, appointmentTime,
      consultationFee, totalAmount, advanceAmount,
      paymentId, orderId,
      reason, tests, providerName,
      homeCollectionRequested, homeAddress
    } = req.body;

    const bookingId = (bookingType === 'labtest' ? 'LAB' : 
                      bookingType === 'opd' ? 'OPD' : 
                      bookingType === 'admission' ? 'ADM' : 'AMB') + 
                      Date.now() + Math.floor(Math.random() * 1000);

    const booking = new Booking({
      bookingId,
      userId: req.user._id,
      bookingType,
      
      // Hospital info
      hospitalId,
      hospitalName,
      
      // Doctor info (OPD)
      doctorName,
      doctorSpecialization,
      
      // Room info (Admission)
      roomType,
      roomPrice,
      numberOfDays: numberOfDays || 1,
      
      // Patient info
      patientName,
      patientAge,
      patientGender,
      patientPhone,
      patientEmail,
      
      // Schedule
      appointmentDate: appointmentDate ? new Date(appointmentDate) : null,
      appointmentTime,
      
      // Pricing
      consultationFee,
      totalAmount: totalAmount || consultationFee,
      advanceAmount: advanceAmount || 0,
      platformFee: Math.round((totalAmount || consultationFee) * 0.10), // 10% commission
      
      // Payment
      paymentId,
      orderId,
      paymentStatus: paymentId ? 'paid' : 'pending',
      
      // Lab specific
      tests: tests || [],
      providerName,
      homeCollectionRequested: homeCollectionRequested || false,
      homeAddress: homeAddress || '',
      
      // Reason
      reason: reason || '',
      
      // Status
      status: paymentId ? 'confirmed' : 'pending',
      statusHistory: [{
        status: paymentId ? 'confirmed' : 'pending',
        timestamp: new Date(),
        note: paymentId ? 'Booking confirmed with payment' : 'Booking created, awaiting payment'
      }]
    });

    await booking.save();

    // Update hospital bed count if admission
    if (bookingType === 'admission' && hospitalId) {
      await Hospital.findByIdAndUpdate(hospitalId, {
        $inc: { 'beds.available': -1 }
      });
    }

    // Send notifications
    sendBookingEmail(booking).catch(err => console.error('Email error:', err));
    sendBookingSMS(booking).catch(err => console.error('SMS error:', err));

    res.json({
      success: true,
      bookingId: booking.bookingId,
      message: 'Booking created successfully!',
      data: booking
    });

  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET USER'S BOOKINGS (My Bookings Page)
// ============================================
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;
    
    const query = { userId: req.user._id };
    if (status) query.status = status;
    if (type) query.bookingType = type;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Booking.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalBookings: total
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET SINGLE BOOKING DETAILS
// ============================================
router.get('/:bookingId', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findOne({ 
      bookingId: req.params.bookingId,
      userId: req.user._id
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.json({ success: true, data: booking });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CANCEL BOOKING (With Refund Logic)
// ============================================
router.put('/:bookingId/cancel', authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const booking = await Booking.findOne({ 
      bookingId: req.params.bookingId,
      userId: req.user._id
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Check if already cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking already cancelled' });
    }

    // Check if completed
    if (booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel completed booking' });
    }

    // Calculate refund amount
    const now = new Date();
    const appointmentTime = new Date(booking.appointmentDate);
    const hoursBeforeAppointment = (appointmentTime - now) / (1000 * 60 * 60);
    
    let refundAmount = 0;
    let refundPercentage = 0;
    let cancellationFee = 0;

    if (booking.paymentStatus === 'paid') {
      if (hoursBeforeAppointment > 24) {
        // Full refund minus platform fee
        refundPercentage = 90;
        cancellationFee = booking.platformFee;
        refundAmount = booking.totalAmount - cancellationFee;
      } else if (hoursBeforeAppointment > 6) {
        // 50% refund
        refundPercentage = 50;
        cancellationFee = Math.round(booking.totalAmount * 0.50);
        refundAmount = booking.totalAmount - cancellationFee;
      } else if (hoursBeforeAppointment > 2) {
        // 25% refund
        refundPercentage = 25;
        cancellationFee = Math.round(booking.totalAmount * 0.75);
        refundAmount = booking.totalAmount - cancellationFee;
      } else {
        // No refund
        refundPercentage = 0;
        cancellationFee = booking.totalAmount;
        refundAmount = 0;
      }
    }

    // Update booking
    booking.status = 'cancelled';
    booking.cancellation = {
      cancelledAt: new Date(),
      reason: reason || 'Cancelled by patient',
      cancelledBy: req.user._id,
      refundAmount,
      refundPercentage,
      cancellationFee,
      refundStatus: refundAmount > 0 ? 'pending' : 'not_applicable'
    };

    booking.statusHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      note: `Booking cancelled. Refund: ₹${refundAmount} (${refundPercentage}%)`
    });

    await booking.save();

    // Restore hospital bed count if admission
    if (booking.bookingType === 'admission' && booking.hospitalId) {
      await Hospital.findByIdAndUpdate(booking.hospitalId, {
        $inc: { 'beds.available': 1 }
      });
    }

    // Create refund transaction
    if (refundAmount > 0) {
      await Transaction.create({
        bookingId: booking.bookingId,
        userId: req.user._id,
        type: 'refund',
        amount: refundAmount,
        status: 'pending',
        description: `Refund for cancelled booking ${booking.bookingId}`,
        metadata: {
          originalPaymentId: booking.paymentId,
          cancellationFee,
          refundPercentage
        }
      });
    }

    // Send cancellation notification
    sendCancellationEmail(booking).catch(err => console.error('Email error:', err));

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        bookingId: booking.bookingId,
        refundAmount,
        refundPercentage,
        cancellationFee,
        refundStatus: refundAmount > 0 ? 'pending' : 'not_applicable'
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// UPDATE BOOKING STATUS (Provider/Admin)
// ============================================
router.put('/:bookingId/status', authenticateToken, async (req, res) => {
  try {
    const { status, note } = req.body;
    const booking = await Booking.findOne({ bookingId: req.params.bookingId });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const validStatuses = [
      'pending', 'confirmed', 'in_progress', 
      'sample_collected', 'processing', 'report_ready',
      'completed', 'cancelled', 'no_show'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    booking.status = status;
    booking.statusHistory.push({
      status,
      timestamp: new Date(),
      note: note || `Status updated to ${status}`
    });

    // If completed, mark payment for settlement
    if (status === 'completed') {
      booking.completedAt = new Date();
      booking.paymentStatus = 'completed';
    }

    await booking.save();

    res.json({ success: true, data: booking });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// SUBMIT REVIEW & RATING
// ============================================
router.post('/:bookingId/review', authenticateToken, async (req, res) => {
  try {
    const { rating, review, doctorRating, staffRating, cleanlinessRating, waitTimeRating } = req.body;
    
    const booking = await Booking.findOne({ 
      bookingId: req.params.bookingId,
      userId: req.user._id
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Can only review completed bookings' });
    }

    if (booking.review) {
      return res.status(400).json({ success: false, message: 'Review already submitted' });
    }

    booking.review = {
      rating: rating || 0,
      review: review || '',
      doctorRating: doctorRating || 0,
      staffRating: staffRating || 0,
      cleanlinessRating: cleanlinessRating || 0,
      waitTimeRating: waitTimeRating || 0,
      submittedAt: new Date()
    };

    await booking.save();

    // Update hospital rating
    if (booking.hospitalId) {
      const hospital = await Hospital.findById(booking.hospitalId);
      if (hospital) {
        const allReviews = await Booking.find({ 
          hospitalId: booking.hospitalId, 
          'review.rating': { $gt: 0 } 
        });
        
        const totalRating = allReviews.reduce((sum, b) => sum + b.review.rating, 0);
        hospital.ratings.average = (totalRating / allReviews.length).toFixed(1);
        hospital.ratings.count = allReviews.length;
        await hospital.save();
      }
    }

    res.json({ success: true, message: 'Review submitted successfully!' });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET BOOKING FOR PROVIDER (Hospital Dashboard)
// ============================================
router.get('/provider/bookings', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    // Provider can only see their hospital's bookings
    const hospital = await Hospital.findOne({ userId: req.user._id });
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    const query = { hospitalId: hospital._id };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Booking.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: bookings,
      pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / limit), totalBookings: total }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
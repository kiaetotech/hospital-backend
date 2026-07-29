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

    const bookingId = (bookingType === 'labtest' ? 'LAB' === 'opd' ? 'OPD' === 'admission' ? 'ADM' : 'AMB') + 
                      Date.now() + Math.floor(Math.random() * 1000);

    const booking = new Booking({
      bookingId,
      userId.user._id,
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
      numberOfDaysOfDays || 1,
      
      // Patient info
      patientName,
      patientAge,
      patientGender,
      patientPhone,
      patientEmail,
      
      // Schedule
      appointmentDate? new Date(appointmentDate) ,
      appointmentTime,
      
      // Pricing
      consultationFee,
      totalAmount|| consultationFee,
      advanceAmount|| 0,
      platformFee.round((totalAmount || consultationFee) * 0.10), // 10% commission
      
      // Payment
      paymentId,
      orderId,
      paymentStatus? 'paid' : 'pending',
      
      // Lab specific
      tests|| [],
      providerName,
      homeCollectionRequested|| false,
      homeAddress|| '',
      
      // Reason
      reason|| '',
      
      // Status
      status? 'confirmed' : 'pending',
      statusHistory: [{
        status? 'confirmed' : 'pending',
        timestampDate(),
        note? 'Booking confirmed with payment' : 'Booking created, awaiting payment'
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
      success,
      bookingId.bookingId,
      message: 'Booking created successfully!',
      data});

  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// GET USER'S BOOKINGS (My Bookings Page)
// ============================================
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;
    
    const query = { userId.user._id };
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
      success,
      data,
      pagination: {
        currentPage(page),
        totalPages.ceil(total / parseInt(limit)),
        totalBookings}
    });

  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// GET SINGLE BOOKING DETAILS
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findOne({ 
      bookingId.params.bookingId,
      userId.user._id
    });

    if (!booking) {
      return res.status(404).json({ success, message: 'Booking not found' });
    }

    res.json({ success, data});

  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// CANCEL BOOKING (With Refund Logic)
// ============================================
router.put('//cancel', authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const booking = await Booking.findOne({ 
      bookingId.params.bookingId,
      userId.user._id
    });

    if (!booking) {
      return res.status(404).json({ success, message: 'Booking not found' });
    }

    // Check if already cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({ success, message: 'Booking already cancelled' });
    }

    // Check if completed
    if (booking.status === 'completed') {
      return res.status(400).json({ success, message: 'Cannot cancel completed booking' });
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
      cancelledAtDate(),
      reason|| 'Cancelled by patient',
      cancelledBy.user._id,
      refundAmount,
      refundPercentage,
      cancellationFee,
      refundStatus> 0 ? 'pending' : 'not_applicable'
    };

    booking.statusHistory.push({
      status: 'cancelled',
      timestampDate(),
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
        bookingId.bookingId,
        userId.user._id,
        type: 'refund',
        amount,
        status: 'pending',
        description: `Refund for cancelled booking ${booking.bookingId}`,
        metadata: {
          originalPaymentId.paymentId,
          cancellationFee,
          refundPercentage
        }
      });
    }

    // Send cancellation notification
    sendCancellationEmail(booking).catch(err => console.error('Email error:', err));

    res.json({
      success,
      message: 'Booking cancelled successfully',
      data: {
        bookingId.bookingId,
        refundAmount,
        refundPercentage,
        cancellationFee,
        refundStatus> 0 ? 'pending' : 'not_applicable'
      }
    });

  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// UPDATE BOOKING STATUS (Provider/Admin)
// ============================================
router.put('//status', authenticateToken, async (req, res) => {
  try {
    const { status, note } = req.body;
    const booking = await Booking.findOne({ bookingId.params.bookingId });

    if (!booking) {
      return res.status(404).json({ success, message: 'Booking not found' });
    }

    const validStatuses = [
      'pending', 'confirmed', 'in_progress', 
      'sample_collected', 'processing', 'report_ready',
      'completed', 'cancelled', 'no_show'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success, message: 'Invalid status' });
    }

    booking.status = status;
    booking.statusHistory.push({
      status,
      timestampDate(),
      note|| `Status updated to ${status}`
    });

    // If completed, mark payment for settlement
    if (status === 'completed') {
      booking.completedAt = new Date();
      booking.paymentStatus = 'completed';
    }

    await booking.save();

    res.json({ success, data});

  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// SUBMIT REVIEW & RATING
// ============================================
router.post('//review', authenticateToken, async (req, res) => {
  try {
    const { rating, review, doctorRating, staffRating, cleanlinessRating, waitTimeRating } = req.body;
    
    const booking = await Booking.findOne({ 
      bookingId.params.bookingId,
      userId.user._id
    });

    if (!booking) {
      return res.status(404).json({ success, message: 'Booking not found' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ success, message: 'Can only review completed bookings' });
    }

    if (booking.review) {
      return res.status(400).json({ success, message: 'Review already submitted' });
    }

    booking.review = {
      rating|| 0,
      review|| '',
      doctorRating|| 0,
      staffRating|| 0,
      cleanlinessRating|| 0,
      waitTimeRating|| 0,
      submittedAtDate()
    };

    await booking.save();

    // Update hospital rating
    if (booking.hospitalId) {
      const hospital = await Hospital.findById(booking.hospitalId);
      if (hospital) {
        const allReviews = await Booking.find({ 
          hospitalId.hospitalId, 
          'review.rating': { $gt: 0 } 
        });
        
        const totalRating = allReviews.reduce((sum, b) => sum + b.review.rating, 0);
        hospital.ratings.average = (totalRating / allReviews.length).toFixed(1);
        hospital.ratings.count = allReviews.length;
        await hospital.save();
      }
    }

    res.json({ success, message: 'Review submitted successfully!' });

  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// GET BOOKING FOR PROVIDER (Hospital Dashboard)
// ============================================
router.get('/provider/bookings', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    // Provider can only see their hospital's bookings
    const hospital = await Hospital.findOne({ userId.user._id });
    if (!hospital) {
      return res.status(404).json({ success, message: 'Hospital not found' });
    }

    const query = { hospitalId._id };
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
      success,
      data,
      pagination: { currentPage(page), totalPages.ceil(total / limit), totalBookings}
    });

  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

module.exports = router;


const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const LoanApplication = require('../models/LoanApplication');

// ============================================
// INITIALIZE RAZORPAY
// ============================================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_xxxxxxxxxxxxx',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'xxxxxxxxxxxxxxxxxxxxx'
});

// ============================================
// CREATE ORDER (Generic - Used by Hospitals, Lab, etc.)
// ============================================

router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', bookingId, patientName, patientPhone, patientEmail, bookingType } = req.body;
    
    const receipt = `booking_${bookingId || Date.now()}`;
    
    const options = {
      amount: Math.round(amount * 100),
      currency,
      receipt,
      payment_capture: 1,
      notes: {
        bookingId: bookingId || 'temp_' + Date.now(),
        bookingType: bookingType || 'general',
        patientName: patientName || 'Guest',
        patientPhone: patientPhone || 'Not provided',
        patientEmail: patientEmail || 'Not provided'
      }
    };
    
    const order = await razorpay.orders.create(options);
    
    const transaction = new Transaction({
      transactionId: Transaction.generateTransactionId(),
      orderId: order.id,
      amount: amount,
      netAmount: amount,
      userId: req.body.userId || 'guest',
      bookingType: bookingType || 'other',
      paymentGateway: 'razorpay',
      status: 'initiated',
      initiatedAt: new Date()
    });
    await transaction.save();
    
    res.json({ 
      success: true, 
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      transactionId: transaction.transactionId,
      key_id: process.env.RAZORPAY_KEY_ID
    });
    } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Razorpay order failed',
      razorpayError: error.error?.description || error.toString()
    });
  }
});

// ============================================
// VERIFY PAYMENT (Handles ALL booking types)
// ============================================

router.post('/verify', async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      bookingId,
      patientName,
      patientAge,
      patientGender,
      patientPhone,
      patientEmail,
      tests,
      providerName,
      totalAmount,
      appointmentDate,
      homeCollectionRequested,
      homeAddress,
      bookingType,
      hospitalName,
      hospitalId,
      doctorName,
      doctorSpecialization,
      timeSlot,
      ambulanceType,
      pickupAddress,
      dropAddress,
      caregiverName,
      serviceType,
      loanApplicationId,
      consultationType,
      symptoms,
      wellnessCenter,
      specialization,
      discountAmount,
      platformFee,
      gst,
      finalAmount,
      roomType,
      roomPrice,
      numberOfDays,
      advanceAmount,
      reason,
      guardianName,
      guardianPhone,
      insuranceProvider,
      insurancePolicyNumber,
      schemeApplied,
      consultationFee,
      medicines,
      deliveryAddress,
      userId
    } = req.body;
    
    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'your_key_secret')
      .update(body.toString())
      .digest('hex');
    
    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }
    
    // Update transaction
    const transaction = await Transaction.findOne({ orderId: razorpay_order_id });
    if (transaction) {
      transaction.paymentId = razorpay_payment_id;
      transaction.status = 'completed';
      transaction.paidAt = new Date();
      transaction.completedAt = new Date();
      transaction.paymentMethod = req.body.paymentMethod || 'card';
      transaction.webhookReceived = true;
      
      // Calculate platform commission (10%)
      const amount = totalAmount || finalAmount || transaction.amount;
      transaction.platformCommission = Math.round(amount * 0.10);
      transaction.providerAmount = amount - transaction.platformCommission;
      transaction.commissionStatus = 'pending';
      
      await transaction.save();
    }
    
    let booking = null;
    const bookingAmount = totalAmount || finalAmount || 0;
    const bookingIdPrefix = {
      'labtest': 'LAB',
      'opd': 'OPD',
      'admission': 'ADM',
      'ambulance': 'AMB',
      'caregiver': 'CAR',
      'ayurveda_consultation': 'AYU',
      'ayurveda_panchakarma': 'AYP',
      'homeopathy_consult': 'HOM',
      'homeopathy_medicine': 'HMD'
    };
    
    const prefix = bookingIdPrefix[bookingType] || 'GEN';
    const newBookingId = bookingId || (prefix + Date.now() + Math.floor(Math.random() * 1000));

    // ============================================
    // BUILD COMMON BOOKING DATA
    // ============================================
    
    const commonBookingData = {
      bookingId: newBookingId,
      userId: userId || req.body.userId || 'guest_' + Date.now(),
      bookingType: bookingType || 'general',
      patientName,
      patientAge: parseInt(patientAge) || null,
      patientGender: patientGender || '',
      patientPhone,
      patientEmail: patientEmail || '',
      originalAmount: bookingAmount,
      finalAmount: bookingAmount,
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      appointmentDate: appointmentDate ? new Date(appointmentDate) : new Date(),
      platformCommission: Math.round(bookingAmount * 0.10),
      discount: discountAmount || 0
    };

    // ============================================
    // CASE 1: Lab Test Booking (PRESERVED)
    // ============================================
    if (bookingType === 'labtest' || tests) {
      booking = await Booking.findOne({ bookingId: bookingId });
      
      if (!booking) {
        booking = new Booking({
          ...commonBookingData,
          tests,
          providerName,
          homeCollectionRequested: homeCollectionRequested || false,
          homeAddress: homeAddress || ''
        });
        await booking.save();
      } else {
        Object.assign(booking, commonBookingData);
        await booking.save();
      }
    }
    
    // ============================================
    // CASE 2: Hospital OPD Booking (ENHANCED)
    // ============================================
    else if (bookingType === 'opd') {
      booking = new Booking({
        ...commonBookingData,
        hospitalId: hospitalId || '',
        hospitalName: hospitalName || providerName || '',
        doctorName: doctorName || '',
        doctorSpecialization: doctorSpecialization || '',
        consultationFee: consultationFee || bookingAmount,
        timeSlot: timeSlot || '',
        reason: reason || '',
        existingReports: req.body.existingReports || false,
        guardianName: guardianName || '',
        guardianPhone: guardianPhone || ''
      });
      await booking.save();
    }
    
    // ============================================
    // CASE 3: Hospital Admission Booking (ENHANCED)
    // ============================================
    else if (bookingType === 'admission') {
      booking = new Booking({
        ...commonBookingData,
        hospitalId: hospitalId || '',
        hospitalName: hospitalName || providerName || '',
        doctorName: doctorName || '',
        roomType: roomType || '',
        roomPrice: roomPrice || 0,
        numberOfDays: numberOfDays || 1,
        advanceAmount: advanceAmount || bookingAmount,
        remainingAmount: (bookingAmount * (numberOfDays || 1)) - (advanceAmount || bookingAmount),
        reason: reason || '',
        existingReports: req.body.existingReports || false,
        guardianName: guardianName || '',
        guardianPhone: guardianPhone || '',
        insuranceProvider: insuranceProvider || '',
        insurancePolicyNumber: insurancePolicyNumber || '',
        schemeApplied: schemeApplied || ''
      });
      await booking.save();
      
      // Update hospital bed count
      if (hospitalId) {
        const Hospital = require('../models/Hospital');
        await Hospital.findByIdAndUpdate(hospitalId, {
          $inc: { 'beds.available': -1 }
        });
      }
    }
    
        // ============================================
    // CASE 4: Ambulance
    // ============================================
        else if (bookingType === 'ambulance') {
      booking = await Booking.findOne({ bookingId: newBookingId });
      if (booking) {
        booking.paymentStatus = 'paid';
        booking.paymentId = razorpay_payment_id;
        booking.orderId = razorpay_order_id;
        booking.razorpayOrderId = razorpay_order_id;
        booking.razorpayPaymentId = razorpay_payment_id;
        booking.razorpaySignature = razorpay_signature;
        booking.status = 'confirmed';
        await booking.save();
      } else {
        booking = new Booking({
          ...commonBookingData,
          ambulanceType: ambulanceType || 'basic',
          pickupAddress: pickupAddress || '',
          dropAddress: dropAddress || ''
        });
        await booking.save();
      }
      
      // Auto-assign driver after payment confirmed
      console.log('AUTO-ASSIGN CHECK - BookingType:', booking.bookingType, 'BookingId:', booking.bookingId);
      if (booking.bookingType === 'ambulance') {
        console.log('AUTO-ASSIGN START - PickupLat:', booking.pickupCoordinates?.lat);
        try {
          const locationCache = require('../services/locationCacheService');
          const pickupLat = booking.pickupCoordinates?.lat;
          const pickupLng = booking.pickupCoordinates?.lng;
          
          if (pickupLat && pickupLng) {
            const drivers = await locationCache.ambulance.findNearbyDrivers(
              pickupLat,
              pickupLng,
              50,
              { limit: 5, requireAvailable: true }
            );
            
            const matchedDriver = drivers.find(d => d.driverId === booking.vehicleId?.toString()) || drivers[0];
            
            if (matchedDriver) {
              booking.driverId = matchedDriver.driverId;
              booking.status = 'driver_assigned';
              booking.driverAcceptedAt = new Date();
              await booking.save();
              
              const io = req.app.get('io') || global.io;
              if (io) {
                io.to(`driver:${matchedDriver.driverId}`).emit('scheduled:new_request', {
                  bookingId: booking.bookingId,
                  patientName: booking.patientName,
                  pickupAddress: booking.pickupAddress,
                  dropAddress: booking.dropAddress || booking.hospitalDestination?.address,
                  scheduledDate: booking.appointmentDate,
                  amount: booking.finalAmount,
                  vehicleType: booking.ambulanceType
                });
                console.log(`📡 Scheduled trip alert sent after payment to driver ${matchedDriver.driverId}`);
              }
            }
          }
        } catch (assignError) {
          console.error('Post-payment driver assignment failed:', assignError.message);
        }
      }
    }
    
    // ============================================
    // CASE 5: Caregiver (PRESERVED)
    // ============================================
    else if (bookingType === 'caregiver') {
      booking = new Booking({
        ...commonBookingData,
        providerName: providerName || caregiverName || ''
      });
      await booking.save();
    }
    
    // ============================================
    // CASE 6: Ayurveda Doctor Consultation (PRESERVED)
    // ============================================
    else if (bookingType === 'ayurveda_consultation') {
      booking = new Booking({
        ...commonBookingData,
        providerName: doctorName || providerName || '',
        hospitalName: wellnessCenter || '',
        doctorName: doctorName || '',
        specialization: specialization || '',
        consultationType: consultationType || 'online',
        timeSlot: timeSlot || '',
        symptoms: symptoms || '',
        discountAmount: discountAmount || 0,
        platformFee: platformFee || 0,
        gst: gst || 0
      });
      await booking.save();
    }
    
    // ============================================
    // CASE 7: Ayurveda Panchakarma Package (PRESERVED)
    // ============================================
    else if (bookingType === 'ayurveda_panchakarma') {
      booking = new Booking({
        ...commonBookingData,
        providerName: providerName || wellnessCenter || '',
        hospitalName: wellnessCenter || '',
        discountAmount: discountAmount || 0,
        admissionDate: new Date(appointmentDate)
      });
      await booking.save();
    }
    
    // ============================================
    // CASE 8: Loan Application (PRESERVED - DO NOT MODIFY)
    // ============================================
    else if (bookingType === 'loan' && loanApplicationId) {
      const loanApp = await LoanApplication.findOne({ applicationId: loanApplicationId });
      if (loanApp) {
        loanApp.paymentStatus = 'paid';
        loanApp.paymentId = razorpay_payment_id;
        loanApp.orderId = razorpay_order_id;
        await loanApp.save();
      }
    }
    
    // ============================================
    // CASE 9: Homeopathy Doctor Consultation (PRESERVED)
    // ============================================
    else if (bookingType === 'homeopathy_consult') {
      booking = new Booking({
        ...commonBookingData,
        doctorName: doctorName || '',
        timeSlot: timeSlot || '',
        symptoms: symptoms || ''
      });
      await booking.save();
    }
    
    // ============================================
    // CASE 10: Homeopathy Medicine Order (PRESERVED)
    // ============================================
    else if (bookingType === 'homeopathy_medicine') {
      booking = new Booking({
        ...commonBookingData,
        medicines: medicines || [],
        deliveryAddress: deliveryAddress || '',
        deliveryOTP: Math.floor(100000 + Math.random() * 900000).toString()
      });
      await booking.save();
    }
    
    // ============================================
    // 🆕 CASE 11: Generic/Other booking types
    // ============================================
    else {
      booking = new Booking({
        ...commonBookingData,
        providerName: providerName || hospitalName || '',
        hospitalName: hospitalName || '',
        doctorName: doctorName || '',
        timeSlot: timeSlot || ''
      });
      await booking.save();
    }
    
    res.json({ 
      success: true, 
      message: 'Payment verified and booking confirmed!',
      bookingId: booking?.bookingId || newBookingId,
      data: booking
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET PAYMENT STATUS
// ============================================

router.get('/status/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    res.json({
      success: true,
      paymentStatus: booking.paymentStatus,
      paymentId: booking.paymentId,
      orderId: booking.orderId,
      status: booking.status,
      amount: booking.finalAmount,
      discount: booking.discountAmount || booking.discount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CREATE ORDER V2 (Generic with discount)
// ============================================

router.post('/create-order-v2', async (req, res) => {
  try {
    const { 
      amount, 
      currency = 'INR', 
      bookingId, 
      bookingType,
      userId,
      patientName,
      patientPhone,
      patientEmail,
      discountCode,
      discountAmount = 0,
      finalAmount
    } = req.body;
    
    const finalAmountToPay = finalAmount || (amount - discountAmount);
    const receipt = `${bookingType || 'booking'}_${bookingId || Date.now()}`;
    
    const options = {
      amount: Math.round(finalAmountToPay * 100),
      currency,
      receipt,
      payment_capture: 1,
      notes: {
        bookingId: bookingId || 'temp_' + Date.now(),
        bookingType: bookingType || 'general',
        patientName: patientName || 'Guest',
        patientPhone: patientPhone || 'Not provided',
        discountCode: discountCode || 'N/A',
        discountAmount: discountAmount || 0
      }
    };
    
    const order = await razorpay.orders.create(options);
    
    const transaction = new Transaction({
      transactionId: Transaction.generateTransactionId(),
      orderId: order.id,
      amount: amount,
      discountAmount: discountAmount,
      netAmount: finalAmountToPay,
      userId: userId || 'guest',
      bookingType: bookingType || 'other',
      paymentGateway: 'razorpay',
      status: 'initiated',
      initiatedAt: new Date()
    });
    await transaction.save();
    
    res.json({ 
      success: true, 
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      transactionId: transaction.transactionId,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// AYURVEDA-SPECIFIC: Create order (PRESERVED)
// ============================================

router.post('/ayurveda-create-order', async (req, res) => {
  try {
    const {
      amount, bookingId, doctorId, doctorName,
      patientName, patientPhone, patientEmail,
      consultationType, discountCode, discountAmount = 0,
      platformFee = 0, gst = 0
    } = req.body;

    const finalAmount = amount - discountAmount + gst;
    const receipt = `ayurveda_${bookingId}`;

    const options = {
      amount: Math.round(finalAmount * 100),
      currency: 'INR',
      receipt,
      payment_capture: 1,
      notes: {
        bookingId,
        bookingType: 'ayurveda_consultation',
        doctorId: doctorId || '',
        doctorName: doctorName || '',
        patientName: patientName || 'Guest',
        patientPhone: patientPhone || '',
        consultationType: consultationType || 'online',
        discountCode: discountCode || 'N/A',
        discountAmount: discountAmount || 0,
        platformFee: platformFee || 0,
        gst: gst || 0
      }
    };

    const order = await razorpay.orders.create(options);

    const transaction = new Transaction({
      transactionId: Transaction.generateTransactionId(),
      orderId: order.id,
      amount: amount,
      discountAmount: discountAmount,
      netAmount: finalAmount,
      userId: req.body.userId || 'guest',
      bookingType: 'ayurveda_consultation',
      paymentGateway: 'razorpay',
      status: 'initiated',
      initiatedAt: new Date()
    });
    await transaction.save();

    res.json({
      success: true,
      order: { id: order.id, amount: order.amount, currency: order.currency, receipt: order.receipt },
      transactionId: transaction.transactionId,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Ayurveda order creation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CALCULATE DISCOUNT (PRESERVED)
// ============================================

router.post('/calculate-discount', async (req, res) => {
  try {
    const { amount, discountCode, bookingType } = req.body;
    
    let discountAmount = 0;
    let finalAmount = amount;
    let discountType = null;
    let discountValue = null;
    
    if (discountCode === 'FIRST10') {
      discountAmount = amount * 0.10;
      discountType = 'percentage';
      discountValue = 10;
    } else if (discountCode === 'WELCOME50') {
      discountAmount = 50;
      discountType = 'fixed';
      discountValue = 50;
    } else if (discountCode === 'AYUR50') {
      discountAmount = amount * 0.50;
      discountType = 'percentage';
      discountValue = 50;
    } else if (discountCode === 'FIRST100') {
      discountAmount = Math.min(100, amount);
      discountType = 'fixed';
      discountValue = 100;
    } else if (discountCode === 'WELLNESS20') {
      discountAmount = amount * 0.20;
      discountType = 'percentage';
      discountValue = 20;
    } else if (discountCode === 'HOMEO20') {
      discountAmount = amount * 0.20;
      discountType = 'percentage';
      discountValue = 20;
    } else if (discountCode === 'NATURO15') {
      discountAmount = amount * 0.15;
      discountType = 'percentage';
      discountValue = 15;
    }
    
    finalAmount = Math.max(0, amount - discountAmount);
    
    res.json({
      success: true,
      originalAmount: amount,
      discountAmount: Math.round(discountAmount),
      finalAmount: Math.round(finalAmount),
      discountCode: discountCode || null,
      discountType: discountType,
      discountValue: discountValue
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// WEBHOOK (PRESERVED + ENHANCED)
// ============================================

router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }
    
    const { event, payload } = req.body;
    
    // Payment captured
    if (event === 'payment.captured') {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;
      
      const transaction = await Transaction.findOne({ orderId: orderId });
      if (transaction) {
        transaction.paymentId = paymentId;
        transaction.status = 'completed';
        transaction.paidAt = new Date();
        transaction.completedAt = new Date();
        transaction.webhookReceived = true;
        
        // Calculate commission
        const amount = transaction.netAmount || transaction.amount;
        transaction.platformCommission = Math.round(amount * 0.10);
        transaction.providerAmount = amount - transaction.platformCommission;
        
        await transaction.save();
      }
      
      const booking = await Booking.findOne({ orderId: orderId });
      if (booking && booking.paymentStatus !== 'paid') {
        booking.paymentStatus = 'paid';
        booking.paymentId = paymentId;
        booking.status = 'confirmed';
        booking.razorpayPaymentId = paymentId;
        await booking.save();
      }
    }
    
    // Payment failed
    if (event === 'payment.failed') {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;
      
      const transaction = await Transaction.findOne({ orderId: orderId });
      if (transaction) {
        transaction.status = 'failed';
        transaction.failureReason = payment.error_description || 'Payment failed';
        transaction.failureCode = payment.error_code || 'UNKNOWN';
        transaction.webhookReceived = true;
        await transaction.save();
      }
    }
    
    // Refund processed
    if (event === 'refund.processed' || event === 'refund.created') {
      const refund = payload.refund.entity;
      const paymentId = refund.payment_id;
      
      const transaction = await Transaction.findOne({ paymentId: paymentId });
      if (transaction) {
        transaction.status = transaction.refundAmount === transaction.amount ? 'refunded' : 'partially_refunded';
        transaction.refundId = refund.id;
        transaction.refundAmount = refund.amount / 100;
        transaction.refundedAt = new Date();
        transaction.refund = {
          ...transaction.refund,
          gatewayRefundId: refund.id,
          gatewayRefundStatus: refund.status,
          processedAt: new Date()
        };
        await transaction.save();
      }
      
      const booking = await Booking.findOne({ paymentId: paymentId });
      if (booking) {
        booking.paymentStatus = 'refunded';
        booking.refundId = refund.id;
        booking.refundAmount = refund.amount / 100;
        booking.refundedAt = new Date();
        booking.refundStatus = 'processed';
        
        if (booking.cancellation) {
          booking.cancellation.refundStatus = 'processed';
          booking.cancellation.refundProcessedAt = new Date();
          booking.cancellation.refundTransactionId = refund.id;
        }
        
        await booking.save();
        
        // Restore hospital bed if admission
        if (booking.bookingType === 'admission' && booking.hospitalId) {
          const Hospital = require('../models/Hospital');
          await Hospital.findByIdAndUpdate(booking.hospitalId, {
            $inc: { 'beds.available': 1 }
          });
        }
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 REFUND (ENHANCED)
// ============================================

router.post('/refund/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason, refundType, bookingId } = req.body;
    
    const refundAmount = amount ? Math.round(amount * 100) : undefined;
    
    const refundOptions = {
      payment_id: paymentId,
      amount: refundAmount,
      notes: { 
        reason: reason || 'Customer request',
        refundType: refundType || 'full',
        bookingId: bookingId || ''
      }
    };
    
    // Initiate refund via Razorpay
    const refund = await razorpay.payments.refund(paymentId, refundOptions);
    
    // Update booking
    const booking = await Booking.findOne({ paymentId: paymentId });
    if (booking) {
      booking.paymentStatus = refundAmount ? 'partially_refunded' : 'refunded';
      booking.status = 'cancelled';
      booking.refundId = refund.id;
      booking.refundAmount = amount || booking.finalAmount;
      booking.refundedAt = new Date();
      booking.refundStatus = 'processed';
      
      booking.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date(),
        note: `Refund of ₹${amount || booking.finalAmount} processed. Reason: ${reason || 'Customer request'}`
      });
      
      await booking.save();
      
      // Restore hospital bed if admission
      if (booking.bookingType === 'admission' && booking.hospitalId) {
        const Hospital = require('../models/Hospital');
        await Hospital.findByIdAndUpdate(booking.hospitalId, {
          $inc: { 'beds.available': 1 }
        });
      }
    }
    
    // Update transaction
    const transaction = await Transaction.findOne({ paymentId: paymentId });
    if (transaction) {
      const refundedAmount = amount || transaction.amount;
      transaction.status = refundedAmount === transaction.amount ? 'refunded' : 'partially_refunded';
      transaction.refundId = refund.id;
      transaction.refundAmount = refundedAmount;
      transaction.refundedAt = new Date();
      transaction.refund = {
        initiatedBy: req.body.initiatedBy || 'patient',
        initiatedAt: new Date(),
        reason: reason || 'Customer request',
        refundType: refundType || 'full',
        refundPercentage: amount ? Math.round((amount / transaction.amount) * 100) : 100,
        cancellationFee: transaction.amount - refundedAmount,
        processedBy: 'system',
        processedAt: new Date(),
        refundMode: 'gateway',
        gatewayRefundId: refund.id,
        gatewayRefundStatus: 'completed'
      };
      await transaction.save();
    }
    
    res.json({ 
      success: true, 
      message: 'Refund processed successfully',
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      }
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 PROCESS REFUND BY BOOKING ID
// ============================================

router.post('/refund-booking/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId });
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    if (!booking.paymentId) {
      return res.status(400).json({ success: false, message: 'No payment found for this booking' });
    }
    
    if (booking.paymentStatus === 'refunded') {
      return res.status(400).json({ success: false, message: 'Already refunded' });
    }
    
    const { amount, reason } = req.body;
    
    const refundOptions = {
      payment_id: booking.paymentId,
      amount: amount ? Math.round(amount * 100) : undefined,
      notes: { 
        reason: reason || 'Cancellation refund',
        bookingId: booking.bookingId
      }
    };
    
    const refund = await razorpay.payments.refund(booking.paymentId, refundOptions);
    
    // Update booking
    booking.paymentStatus = 'refunded';
    booking.status = 'cancelled';
    booking.refundId = refund.id;
    booking.refundAmount = amount || booking.finalAmount;
    booking.refundedAt = new Date();
    booking.refundStatus = 'processed';
    
    booking.cancellation = {
      ...booking.cancellation,
      refundStatus: 'processed',
      refundProcessedAt: new Date(),
      refundTransactionId: refund.id
    };
    
    await booking.save();
    
    res.json({ success: true, message: 'Refund processed', refund });
    
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET TRANSACTION
// ============================================

router.get('/transaction/:transactionId', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ transactionId: req.params.transactionId });
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
    res.json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/transaction/order/:orderId', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ orderId: req.params.orderId });
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
    res.json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 GET TRANSACTIONS BY USER
// ============================================

router.get('/transactions/user/:userId', async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 🆕 GET TRANSACTIONS BY HOSPITAL
// ============================================

router.get('/transactions/hospital/:hospitalId', async (req, res) => {
  try {
    const transactions = await Transaction.find({ hospitalId: req.params.hospitalId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/payment - Health check
router.get('/', (req, res) => {
  res.json({ success: true, service: 'Payment Gateway', status: 'active', version: '2.0' });
});

module.exports = router;
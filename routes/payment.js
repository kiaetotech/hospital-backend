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
// CREATE ORDER (UPDATED - Added Ayurveda notes)
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
        bookingType: bookingType || 'general',  // 🆕 Added bookingType
        patientName: patientName || 'Guest',
        patientPhone: patientPhone || 'Not provided',
        patientEmail: patientEmail || 'Not provided'
      }
    };
    
    const order = await razorpay.orders.create(options);
    
    // Save transaction record
    const transaction = new Transaction({
      transactionId: Transaction.generateTransactionId(),
      orderId: order.id,
      amount: amount,
      netAmount: amount,
      userId: req.body.userId || 'guest',
      bookingId: bookingId,
      bookingType: bookingType || 'general',  // 🆕 Added bookingType
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
      key_id: process.env.RAZORPAY_KEY_ID  // 🆕 Send key to frontend
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// VERIFY PAYMENT (UPDATED - Added Ayurveda handling)
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
      doctorName,
      timeSlot,
      ambulanceType,
      pickupAddress,
      dropAddress,
      caregiverName,
      serviceType,
      loanApplicationId,
      // 🆕 AYURVEDA FIELDS
      consultationType,
      symptoms,
      wellnessCenter,
      specialization,
      discountAmount,
      platformFee,
      gst,
      finalAmount
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
      await transaction.save();
    }
    
    // ============================================
    // HANDLE DIFFERENT BOOKING TYPES
    // ============================================
    
    let booking = null;
    
    // Case 1: Lab Test Booking
    if (bookingType === 'labtest' || tests) {
      booking = await Booking.findOne({ bookingId: bookingId });
      
      if (!booking) {
        const newBookingId = 'LAB' + Date.now() + Math.floor(Math.random() * 1000);
        
        booking = new Booking({
          bookingId: newBookingId,
          userId: req.body.userId || 'guest_' + Date.now(),
          bookingType: 'labtest',
          patientName,
          patientAge: parseInt(patientAge),
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
          paymentStatus: 'paid',
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature
        });
        
        await booking.save();
      } else {
        booking.paymentStatus = 'paid';
        booking.paymentId = razorpay_payment_id;
        booking.orderId = razorpay_order_id;
        booking.razorpayOrderId = razorpay_order_id;
        booking.razorpayPaymentId = razorpay_payment_id;
        booking.razorpaySignature = razorpay_signature;
        booking.status = 'confirmed';
        await booking.save();
      }
    }
    
    // Case 2: Hospital OPD/Admission
    else if (bookingType === 'opd' || bookingType === 'admission') {
      const newBookingId = (bookingType === 'opd' ? 'OPD' : 'ADM') + Date.now() + Math.floor(Math.random() * 1000);
      
      booking = new Booking({
        bookingId: newBookingId,
        userId: req.body.userId || 'guest_' + Date.now(),
        bookingType: bookingType,
        patientName,
        patientAge: parseInt(patientAge),
        patientGender,
        patientPhone,
        patientEmail,
        hospitalName: hospitalName || providerName,
        doctorName: doctorName || '',
        timeSlot: timeSlot || '',
        originalAmount: totalAmount,
        finalAmount: totalAmount,
        appointmentDate: new Date(appointmentDate),
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      });
      
      await booking.save();
    }
    
    // Case 3: Ambulance
    else if (bookingType === 'ambulance') {
      const newBookingId = 'AMB' + Date.now() + Math.floor(Math.random() * 1000);
      
      booking = new Booking({
        bookingId: newBookingId,
        userId: req.body.userId || 'guest_' + Date.now(),
        bookingType: 'ambulance',
        patientName,
        patientPhone,
        patientEmail,
        ambulanceType: ambulanceType || 'basic',
        pickupAddress: pickupAddress || '',
        dropAddress: dropAddress || '',
        originalAmount: totalAmount,
        finalAmount: totalAmount,
        appointmentDate: new Date(),
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      });
      
      await booking.save();
    }
    
    // Case 4: Caregiver
    else if (bookingType === 'caregiver') {
      const newBookingId = 'CAR' + Date.now() + Math.floor(Math.random() * 1000);
      
      booking = new Booking({
        bookingId: newBookingId,
        userId: req.body.userId || 'guest_' + Date.now(),
        bookingType: 'caregiver',
        patientName,
        patientPhone,
        patientEmail,
        providerName: providerName || caregiverName || '',
        originalAmount: totalAmount,
        finalAmount: totalAmount,
        appointmentDate: new Date(appointmentDate),
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      });
      
      await booking.save();
    }
    
    // 🆕 CASE 5: AYURVEDA DOCTOR CONSULTATION
    else if (bookingType === 'ayurveda_consultation') {
      const newBookingId = bookingId || 'AYB' + Date.now();
      
      booking = new Booking({
        bookingId: newBookingId,
        userId: req.body.userId || 'guest_' + Date.now(),
        bookingType: 'ayurveda_consultation',
        patientName,
        patientAge: parseInt(patientAge) || null,
        patientGender: patientGender || '',
        patientPhone,
        patientEmail: patientEmail || '',
        providerName: doctorName || providerName || '',
        hospitalName: wellnessCenter || '',  // Using hospitalName field for wellness center
        doctorName: doctorName || '',
        specialization: specialization || '',
        consultationType: consultationType || 'online',
        timeSlot: timeSlot || '',
        symptoms: symptoms || '',
        originalAmount: totalAmount || finalAmount,
        discountAmount: discountAmount || 0,
        platformFee: platformFee || 0,
        gst: gst || 0,
        finalAmount: finalAmount || totalAmount,
        appointmentDate: new Date(appointmentDate),
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      });
      
      await booking.save();
    }
    
    // 🆕 CASE 6: AYURVEDA PANCHAKARMA PACKAGE
    else if (bookingType === 'ayurveda_panchakarma') {
      const newBookingId = bookingId || 'AYP' + Date.now();
      
      booking = new Booking({
        bookingId: newBookingId,
        userId: req.body.userId || 'guest_' + Date.now(),
        bookingType: 'ayurveda_panchakarma',
        patientName,
        patientAge: parseInt(patientAge) || null,
        patientGender: patientGender || '',
        patientPhone,
        patientEmail: patientEmail || '',
        providerName: providerName || wellnessCenter || '',
        hospitalName: wellnessCenter || '',
        packageName: req.body.packageName || '',
        packageDuration: req.body.packageDuration || null,
        originalAmount: totalAmount || finalAmount,
        discountAmount: discountAmount || 0,
        finalAmount: finalAmount || totalAmount,
        appointmentDate: new Date(appointmentDate),
        admissionDate: new Date(appointmentDate),
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      });
      
      await booking.save();
    }
    
    // Case 7: Loan Application (EXISTING)
    else if (bookingType === 'loan' && loanApplicationId) {
      const loanApp = await LoanApplication.findOne({ applicationId: loanApplicationId });
      if (loanApp) {
        loanApp.paymentStatus = 'paid';
        loanApp.paymentId = razorpay_payment_id;
        loanApp.orderId = razorpay_order_id;
        await loanApp.save();
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Payment verified and booking confirmed!',
      bookingId: booking?.bookingId || 'N/A'
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
// CREATE ORDER V2 (Generic - Already there)
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
    
    // Save transaction record
    const transaction = new Transaction({
      transactionId: Transaction.generateTransactionId(),
      orderId: order.id,
      amount: amount,
      discountAmount: discountAmount,
      netAmount: finalAmountToPay,
      userId: userId || 'guest',
      bookingId: bookingId,
      bookingType: bookingType || 'general',
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
// 🆕 AYURVEDA-SPECIFIC: Create order for consultation
// POST /api/payment/ayurveda-create-order
// ============================================

router.post('/ayurveda-create-order', async (req, res) => {
  try {
    const {
      amount,
      bookingId,
      doctorId,
      doctorName,
      patientName,
      patientPhone,
      patientEmail,
      consultationType,
      discountCode,
      discountAmount = 0,
      platformFee = 0,
      gst = 0
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

    // Save transaction
    const transaction = new Transaction({
      transactionId: Transaction.generateTransactionId(),
      orderId: order.id,
      amount: amount,
      discountAmount: discountAmount,
      netAmount: finalAmount,
      userId: req.body.userId || 'guest',
      bookingId: bookingId,
      bookingType: 'ayurveda_consultation',
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
    console.error('Ayurveda order creation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CALCULATE DISCOUNT (EXISTING - Works for Ayurveda too)
// ============================================

router.post('/calculate-discount', async (req, res) => {
  try {
    const { amount, discountCode, bookingType } = req.body;
    
    let discountAmount = 0;
    let finalAmount = amount;
    let discountType = null;
    let discountValue = null;
    
    // Platform-wide discount codes
    if (discountCode === 'FIRST10') {
      discountAmount = amount * 0.10;
      discountType = 'percentage';
      discountValue = 10;
    } else if (discountCode === 'WELCOME50') {
      discountAmount = 50;
      discountType = 'fixed';
      discountValue = 50;
    } else if (discountCode === 'AYUR50') {
      // 🆕 Ayurveda-specific 50% off
      discountAmount = amount * 0.50;
      discountType = 'percentage';
      discountValue = 50;
    } else if (discountCode === 'FIRST100') {
      // 🆕 ₹100 off for first booking
      discountAmount = Math.min(100, amount);
      discountType = 'fixed';
      discountValue = 100;
    } else if (discountCode === 'WELLNESS20') {
      // 🆕 20% off for wellness
      discountAmount = amount * 0.20;
      discountType = 'percentage';
      discountValue = 20;
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
// WEBHOOK (EXISTING - Already handles all types)
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
    
    if (event === 'payment.captured') {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;
      
      // Update transaction
      const transaction = await Transaction.findOne({ orderId: orderId });
      if (transaction) {
        transaction.paymentId = paymentId;
        transaction.status = 'completed';
        transaction.paidAt = new Date();
        transaction.completedAt = new Date();
        transaction.webhookReceived = true;
        await transaction.save();
      }
      
      // Find and update booking by orderId
      const booking = await Booking.findOne({ orderId: orderId });
      if (booking && booking.paymentStatus !== 'paid') {
        booking.paymentStatus = 'paid';
        booking.paymentId = paymentId;
        booking.status = 'confirmed';
        booking.razorpayPaymentId = paymentId;
        await booking.save();
      }
    }
    
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
    
    if (event === 'refund.processed') {
      const refund = payload.refund.entity;
      const paymentId = refund.payment_id;
      
      const transaction = await Transaction.findOne({ paymentId: paymentId });
      if (transaction) {
        transaction.status = 'refunded';
        transaction.refundId = refund.id;
        transaction.refundAmount = refund.amount / 100;
        transaction.refundedAt = new Date();
        await transaction.save();
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// REFUND (EXISTING - Works for all types)
// ============================================

router.post('/refund/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;
    
    const refundOptions = {
      payment_id: paymentId,
      amount: amount ? Math.round(amount * 100) : undefined,
      notes: {
        reason: reason || 'Customer request'
      }
    };
    
    const refund = await razorpay.payments.refund(paymentId, refundOptions);
    
    // Update booking status
    const booking = await Booking.findOne({ paymentId: paymentId });
    if (booking) {
      booking.paymentStatus = 'refunded';
      booking.status = 'cancelled';
      booking.refundId = refund.id;
      booking.refundAmount = amount || booking.finalAmount;
      booking.refundedAt = new Date();
      booking.refundStatus = 'processed';
      await booking.save();
    }
    
    // Update transaction
    const transaction = await Transaction.findOne({ paymentId: paymentId });
    if (transaction) {
      transaction.status = 'refunded';
      transaction.refundId = refund.id;
      transaction.refundAmount = amount || transaction.amount;
      transaction.refundedAt = new Date();
      await transaction.save();
    }
    
    res.json({ success: true, refund });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET TRANSACTION (EXISTING)
// ============================================

router.get('/transaction/:transactionId', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ 
      transactionId: req.params.transactionId 
    });
    
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    
    res.json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET TRANSACTION BY ORDER ID (EXISTING)
// ============================================

router.get('/transaction/order/:orderId', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ 
      orderId: req.params.orderId 
    });
    
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    
    res.json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
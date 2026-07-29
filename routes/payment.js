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
  key_id.env.RAZORPAY_KEY_ID || 'rzp_test_xxxxxxxxxxxxx',
  key_secret.env.RAZORPAY_KEY_SECRET || 'xxxxxxxxxxxxxxxxxxxxx'
});

// ============================================
// CREATE ORDER (Generic - Used by Hospitals, Lab, etc.)
// ============================================

router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', bookingId, patientName, patientPhone, patientEmail, bookingType } = req.body;
    
    const receipt = `booking_${bookingId || Date.now()}`;
    
    const options = {
      amount.round(amount * 100),
      currency,
      receipt,
      payment_capture: 1,
      notes: {
        bookingId|| 'temp_' + Date.now(),
        bookingType|| 'general',
        patientName|| 'Guest',
        patientPhone|| 'Not provided',
        patientEmail|| 'Not provided'
      }
    };
    
    const order = await razorpay.orders.create(options);
    
    const transaction = new Transaction({
      transactionId.generateTransactionId(),
      orderId.id,
      amount,
      netAmount,
      userId.body.userId || 'guest',
      bookingId,
      bookingType|| 'general',
      paymentGateway: 'razorpay',
      status: 'initiated',
      initiatedAtDate()
    });
    await transaction.save();
    
    res.json({ 
      success, 
      order: {
        id.id,
        amount.amount,
        currency.currency,
        receipt.receipt
      },
      transactionId.transactionId,
      key_id.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success, message.message });
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
      return res.status(400).json({ success, message: 'Invalid payment signature' });
    }
    
    // Update transaction
    const transaction = await Transaction.findOne({ orderId_order_id });
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
      bookingId,
      userId|| req.body.userId || 'guest_' + Date.now(),
      bookingType|| 'general',
      patientName,
      patientAge(patientAge) || null,
      patientGender|| '',
      patientPhone,
      patientEmail|| '',
      originalAmount,
      finalAmount,
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentId_payment_id,
      orderId_order_id,
      razorpayOrderId_order_id,
      razorpayPaymentId_payment_id,
      razorpaySignature_signature,
      appointmentDate? new Date(appointmentDate) Date(),
      platformCommission.round(bookingAmount * 0.10),
      discount|| 0
    };

    // ============================================
    // CASE 1Test Booking (PRESERVED)
    // ============================================
    if (bookingType === 'labtest' || tests) {
      booking = await Booking.findOne({ bookingId});
      
      if (!booking) {
        booking = new Booking({
          ...commonBookingData,
          tests,
          providerName,
          homeCollectionRequested|| false,
          homeAddress|| ''
        });
        await booking.save();
      } else {
        Object.assign(booking, commonBookingData);
        await booking.save();
      }
    }
    
    // ============================================
    // CASE 2OPD Booking (ENHANCED)
    // ============================================
    else if (bookingType === 'opd') {
      booking = new Booking({
        ...commonBookingData,
        hospitalId|| '',
        hospitalName|| providerName || '',
        doctorName|| '',
        doctorSpecialization|| '',
        consultationFee|| bookingAmount,
        timeSlot|| '',
        reason|| '',
        existingReports.body.existingReports || false,
        guardianName|| '',
        guardianPhone|| ''
      });
      await booking.save();
    }
    
    // ============================================
    // CASE 3Admission Booking (ENHANCED)
    // ============================================
    else if (bookingType === 'admission') {
      booking = new Booking({
        ...commonBookingData,
        hospitalId|| '',
        hospitalName|| providerName || '',
        doctorName|| '',
        roomType|| '',
        roomPrice|| 0,
        numberOfDaysOfDays || 1,
        advanceAmount|| bookingAmount,
        remainingAmount: (bookingAmount * (numberOfDays || 1)) - (advanceAmount || bookingAmount),
        reason|| '',
        existingReports.body.existingReports || false,
        guardianName|| '',
        guardianPhone|| '',
        insuranceProvider|| '',
        insurancePolicyNumber|| '',
        schemeApplied|| ''
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
    // CASE 4(PRESERVED)
    // ============================================
    else if (bookingType === 'ambulance') {
      booking = new Booking({
        ...commonBookingData,
        ambulanceType|| 'basic',
        pickupAddress|| '',
        dropAddress|| ''
      });
      await booking.save();
    }
    
    // ============================================
    // CASE 5(PRESERVED)
    // ============================================
    else if (bookingType === 'caregiver') {
      booking = new Booking({
        ...commonBookingData,
        providerName|| caregiverName || ''
      });
      await booking.save();
    }
    
    // ============================================
    // CASE 6Doctor Consultation (PRESERVED)
    // ============================================
    else if (bookingType === 'ayurveda_consultation') {
      booking = new Booking({
        ...commonBookingData,
        providerName|| providerName || '',
        hospitalName|| '',
        doctorName|| '',
        specialization|| '',
        consultationType|| 'online',
        timeSlot|| '',
        symptoms|| '',
        discountAmount|| 0,
        platformFee|| 0,
        gst|| 0
      });
      await booking.save();
    }
    
    // ============================================
    // CASE 7Panchakarma Package (PRESERVED)
    // ============================================
    else if (bookingType === 'ayurveda_panchakarma') {
      booking = new Booking({
        ...commonBookingData,
        providerName|| wellnessCenter || '',
        hospitalName|| '',
        discountAmount|| 0,
        admissionDateDate(appointmentDate)
      });
      await booking.save();
    }
    
    // ============================================
    // CASE 8Application (PRESERVED - DO NOT MODIFY)
    // ============================================
    else if (bookingType === 'loan' && loanApplicationId) {
      const loanApp = await LoanApplication.findOne({ applicationId});
      if (loanApp) {
        loanApp.paymentStatus = 'paid';
        loanApp.paymentId = razorpay_payment_id;
        loanApp.orderId = razorpay_order_id;
        await loanApp.save();
      }
    }
    
    // ============================================
    // CASE 9Doctor Consultation (PRESERVED)
    // ============================================
    else if (bookingType === 'homeopathy_consult') {
      booking = new Booking({
        ...commonBookingData,
        doctorName|| '',
        timeSlot|| '',
        symptoms|| ''
      });
      await booking.save();
    }
    
    // ============================================
    // CASE 10Medicine Order (PRESERVED)
    // ============================================
    else if (bookingType === 'homeopathy_medicine') {
      booking = new Booking({
        ...commonBookingData,
        medicines|| [],
        deliveryAddress|| '',
        deliveryOTP.floor(100000 + Math.random() * 900000).toString()
      });
      await booking.save();
    }
    
    // ============================================
    // 🆕 CASE 11/Other booking types
    // ============================================
    else {
      booking = new Booking({
        ...commonBookingData,
        providerName|| hospitalName || '',
        hospitalName|| '',
        doctorName|| '',
        timeSlot|| ''
      });
      await booking.save();
    }
    
    res.json({ 
      success, 
      message: 'Payment verified and booking confirmed!',
      bookingId?.bookingId || newBookingId,
      data});
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// GET PAYMENT STATUS
// ============================================

router.get('/status/', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId.params.bookingId });
    if (!booking) {
      return res.status(404).json({ success, message: 'Booking not found' });
    }
    
    res.json({
      success,
      paymentStatus.paymentStatus,
      paymentId.paymentId,
      orderId.orderId,
      status.status,
      amount.finalAmount,
      discount.discountAmount || booking.discount
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
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
      amount.round(finalAmountToPay * 100),
      currency,
      receipt,
      payment_capture: 1,
      notes: {
        bookingId|| 'temp_' + Date.now(),
        bookingType|| 'general',
        patientName|| 'Guest',
        patientPhone|| 'Not provided',
        discountCode|| 'N/A',
        discountAmount|| 0
      }
    };
    
    const order = await razorpay.orders.create(options);
    
    const transaction = new Transaction({
      transactionId.generateTransactionId(),
      orderId.id,
      amount,
      discountAmount,
      netAmount,
      userId|| 'guest',
      bookingId,
      bookingType|| 'general',
      paymentGateway: 'razorpay',
      status: 'initiated',
      initiatedAtDate()
    });
    await transaction.save();
    
    res.json({ 
      success, 
      order: {
        id.id,
        amount.amount,
        currency.currency,
        receipt.receipt
      },
      transactionId.transactionId,
      key_id.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// AYURVEDA-SPECIFICorder (PRESERVED)
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
      amount.round(finalAmount * 100),
      currency: 'INR',
      receipt,
      payment_capture: 1,
      notes: {
        bookingId,
        bookingType: 'ayurveda_consultation',
        doctorId|| '',
        doctorName|| '',
        patientName|| 'Guest',
        patientPhone|| '',
        consultationType|| 'online',
        discountCode|| 'N/A',
        discountAmount|| 0,
        platformFee|| 0,
        gst|| 0
      }
    };

    const order = await razorpay.orders.create(options);

    const transaction = new Transaction({
      transactionId.generateTransactionId(),
      orderId.id,
      amount,
      discountAmount,
      netAmount,
      userId.body.userId || 'guest',
      bookingId,
      bookingType: 'ayurveda_consultation',
      paymentGateway: 'razorpay',
      status: 'initiated',
      initiatedAtDate()
    });
    await transaction.save();

    res.json({
      success,
      order: { id.id, amount.amount, currency.currency, receipt.receipt },
      transactionId.transactionId,
      key_id.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Ayurveda order creation error:', error);
    res.status(500).json({ success, message.message });
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
      success,
      originalAmount,
      discountAmount.round(discountAmount),
      finalAmount.round(finalAmount),
      discountCode|| null,
      discountType,
      discountValue});
  } catch (error) {
    res.status(500).json({ success, message.message });
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
      return res.status(400).json({ success, message: 'Invalid signature' });
    }
    
    const { event, payload } = req.body;
    
    // Payment captured
    if (event === 'payment.captured') {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;
      
      const transaction = await Transaction.findOne({ orderId});
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
      
      const booking = await Booking.findOne({ orderId});
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
      
      const transaction = await Transaction.findOne({ orderId});
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
      
      const transaction = await Transaction.findOne({ paymentId});
      if (transaction) {
        transaction.status = transaction.refundAmount === transaction.amount ? 'refunded' : 'partially_refunded';
        transaction.refundId = refund.id;
        transaction.refundAmount = refund.amount / 100;
        transaction.refundedAt = new Date();
        transaction.refund = {
          ...transaction.refund,
          gatewayRefundId.id,
          gatewayRefundStatus.status,
          processedAtDate()
        };
        await transaction.save();
      }
      
      const booking = await Booking.findOne({ paymentId});
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
    
    res.json({ success});
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// 🆕 REFUND (ENHANCED)
// ============================================

router.post('/refund/', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason, refundType, bookingId } = req.body;
    
    const refundAmount = amount ? Math.round(amount * 100) ;
    
    const refundOptions = {
      payment_id,
      amount,
      notes: { 
        reason|| 'Customer request',
        refundType|| 'full',
        bookingId|| ''
      }
    };
    
    // Initiate refund via Razorpay
    const refund = await razorpay.payments.refund(paymentId, refundOptions);
    
    // Update booking
    const booking = await Booking.findOne({ paymentId});
    if (booking) {
      booking.paymentStatus = refundAmount ? 'partially_refunded' : 'refunded';
      booking.status = 'cancelled';
      booking.refundId = refund.id;
      booking.refundAmount = amount || booking.finalAmount;
      booking.refundedAt = new Date();
      booking.refundStatus = 'processed';
      
      booking.statusHistory.push({
        status: 'cancelled',
        timestampDate(),
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
    const transaction = await Transaction.findOne({ paymentId});
    if (transaction) {
      const refundedAmount = amount || transaction.amount;
      transaction.status = refundedAmount === transaction.amount ? 'refunded' : 'partially_refunded';
      transaction.refundId = refund.id;
      transaction.refundAmount = refundedAmount;
      transaction.refundedAt = new Date();
      transaction.refund = {
        initiatedBy.body.initiatedBy || 'patient',
        initiatedAtDate(),
        reason|| 'Customer request',
        refundType|| 'full',
        refundPercentage? Math.round((amount / transaction.amount) * 100) : 100,
        cancellationFee.amount - refundedAmount,
        processedBy: 'system',
        processedAtDate(),
        refundMode: 'gateway',
        gatewayRefundId.id,
        gatewayRefundStatus: 'completed'
      };
      await transaction.save();
    }
    
    res.json({ 
      success, 
      message: 'Refund processed successfully',
      refund: {
        id.id,
        amount.amount / 100,
        status.status
      }
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// 🆕 PROCESS REFUND BY BOOKING ID
// ============================================

router.post('/refund-booking/', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId.params.bookingId });
    
    if (!booking) {
      return res.status(404).json({ success, message: 'Booking not found' });
    }
    
    if (!booking.paymentId) {
      return res.status(400).json({ success, message: 'No payment found for this booking' });
    }
    
    if (booking.paymentStatus === 'refunded') {
      return res.status(400).json({ success, message: 'Already refunded' });
    }
    
    const { amount, reason } = req.body;
    
    const refundOptions = {
      payment_id.paymentId,
      amount? Math.round(amount * 100) ,
      notes: { 
        reason|| 'Cancellation refund',
        bookingId.bookingId
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
      refundProcessedAtDate(),
      refundTransactionId.id
    };
    
    await booking.save();
    
    res.json({ success, message: 'Refund processed', refund });
    
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// GET TRANSACTION
// ============================================

router.get('/transaction/', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ transactionId.params.transactionId });
    if (!transaction) return res.status(404).json({ success, message: 'Transaction not found' });
    res.json({ success, transaction });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

router.get('/transaction/order/', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ orderId.params.orderId });
    if (!transaction) return res.status(404).json({ success, message: 'Transaction not found' });
    res.json({ success, transaction });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// 🆕 GET TRANSACTIONS BY USER
// ============================================

router.get('/transactions/user/', async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId.params.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// 🆕 GET TRANSACTIONS BY HOSPITAL
// ============================================

router.get('/transactions/hospital/', async (req, res) => {
  try {
    const transactions = await Transaction.find({ hospitalId.params.hospitalId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

module.exports = router;


const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Booking = require('../models/Booking');

// Initialize Razorpay (use your test keys)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_xxxxxxxxxxxxx',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'xxxxxxxxxxxxxxxxxxxxx'
});

// Create order for lab test booking
router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', bookingId, patientName, patientPhone, patientEmail } = req.body;
    
    const receipt = `booking_${bookingId || Date.now()}`;
    
    const options = {
      amount: Math.round(amount * 100), // Convert to paise and ensure integer
      currency,
      receipt,
      payment_capture: 1,
      notes: {
        bookingId: bookingId || 'temp_' + Date.now(),
        patientName: patientName || 'Guest',
        patientPhone: patientPhone || 'Not provided',
        patientEmail: patientEmail || 'Not provided'
      }
    };
    
    const order = await razorpay.orders.create(options);
    
    // Store order details temporarily (optional - can be stored in session or database)
    // You can create a temporary orders collection if needed
    
    res.json({ 
      success: true, 
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Verify payment and update booking
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
      homeAddress
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
    
    // Check if booking already exists
    let booking = await Booking.findOne({ bookingId: bookingId });
    
    if (!booking) {
      // Create new booking with payment confirmed
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
        orderId: razorpay_order_id
      });
      
      await booking.save();
    } else {
      // Update existing booking with payment info
      booking.paymentStatus = 'paid';
      booking.paymentId = razorpay_payment_id;
      booking.orderId = razorpay_order_id;
      booking.status = 'confirmed';
      await booking.save();
    }
    
    res.json({ 
      success: true, 
      message: 'Payment verified and booking confirmed!',
      bookingId: booking.bookingId
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get payment status for a booking
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
      status: booking.status
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Webhook to handle Razorpay events (optional)
router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    
    // Verify webhook signature
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
      
      // Find and update booking by orderId
      const booking = await Booking.findOne({ orderId: orderId });
      if (booking && booking.paymentStatus !== 'paid') {
        booking.paymentStatus = 'paid';
        booking.paymentId = paymentId;
        booking.status = 'confirmed';
        await booking.save();
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Refund payment (admin only)
router.post('/refund/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;
    
    const refundOptions = {
      payment_id: paymentId,
      amount: amount ? amount * 100 : undefined, // amount in paise
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
      await booking.save();
    }
    
    res.json({ success: true, refund });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
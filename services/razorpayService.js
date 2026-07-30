const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const createOrder = async (amount, currency = 'INR', receipt, notes = {}) => {
  try {
    const options = {
      amount: amount * 100,
      currency: currency,
      receipt: receipt || `receipt_${Date.now()}`,
      notes: notes,
      payment_capture: 1
    };
    
    const order = await razorpay.orders.create(options);
    return {
      success: true,
      order: {
        id: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status
      }
    };
  } catch (error) {
    console.error('Razorpay order error:', error);
    return { success: false, error: error.message };
  }
};

const capturePayment = async (paymentId, amount) => {
  try {
    const payment = await razorpay.payments.capture(paymentId, amount * 100);
    return {
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount / 100,
        status: payment.status,
        method: payment.method
      }
    };
  } catch (error) {
    console.error('Razorpay capture error:', error);
    return { success: false, error: error.message };
  }
};

const createRefund = async (paymentId, amount, notes = {}) => {
  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amount * 100,
      notes: notes
    });
    return {
      success: true,
      refund: {
        id: refund.id,
        payment_id: refund.payment_id,
        amount: refund.amount / 100,
        status: refund.status
      }
    };
  } catch (error) {
    console.error('Razorpay refund error:', error);
    return { success: false, error: error.message };
  }
};

const fetchPayment = async (paymentId) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return {
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount / 100,
        status: payment.status,
        method: payment.method,
        email: payment.email,
        contact: payment.contact
      }
    };
  } catch (error) {
    console.error('Razorpay fetch error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  razorpay,
  createOrder,
  capturePayment,
  createRefund,
  fetchPayment
};
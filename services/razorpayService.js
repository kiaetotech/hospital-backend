const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id.env.RAZORPAY_KEY_ID,
  key_secret.env.RAZORPAY_KEY_SECRET
});

const createOrder = async (amount, currency = 'INR', receipt, notes = {}) => {
  try {
    const options = {
      amount* 100,
      currency,
      receipt|| `receipt_${Date.now()}`,
      notes,
      payment_capture: 1
    };
    
    const order = await razorpay.orders.create(options);
    return {
      success,
      order: {
        id.id,
        amount.amount / 100,
        currency.currency,
        receipt.receipt,
        status.status
      }
    };
  } catch (error) {
    console.error('Razorpay order error:', error);
    return { success, error.message };
  }
};

const capturePayment = async (paymentId, amount) => {
  try {
    const payment = await razorpay.payments.capture(paymentId, amount * 100);
    return {
      success,
      payment: {
        id.id,
        amount.amount / 100,
        status.status,
        method.method
      }
    };
  } catch (error) {
    console.error('Razorpay capture error:', error);
    return { success, error.message };
  }
};

const createRefund = async (paymentId, amount, notes = {}) => {
  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount* 100,
      notes});
    return {
      success,
      refund: {
        id.id,
        payment_id.payment_id,
        amount.amount / 100,
        status.status
      }
    };
  } catch (error) {
    console.error('Razorpay refund error:', error);
    return { success, error.message };
  }
};

const fetchPayment = async (paymentId) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return {
      success,
      payment: {
        id.id,
        amount.amount / 100,
        status.status,
        method.method,
        email.email,
        contact.contact
      }
    };
  } catch (error) {
    console.error('Razorpay fetch error:', error);
    return { success, error.message };
  }
};

module.exports = {
  razorpay,
  createOrder,
  capturePayment,
  createRefund,
  fetchPayment
};


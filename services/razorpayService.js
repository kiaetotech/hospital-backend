// At the top, add this:
const isLive = process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live');

console.log(`💳 Razorpay mode: ${isLive ? 'LIVE' : 'TEST'}`);

// When creating order, add this note:
const options = {
  amount: amount * 100,
  currency: currency,
  receipt: receipt,
  payment_capture: 1,
  notes: {
    ...notes,
    environment: isLive ? 'production' : 'test'
  }
};
// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTP temporarily (in production, use Redis)
const otpStore = new Map();

const saveOTP = (mobile, otp) => {
  otpStore.set(mobile, { otp, expiresAt.now() + 10 * 60 * 1000 }); // 10 min expiry
  setTimeout(() => otpStore.delete(mobile), 10 * 60 * 1000);
};

const verifyOTP = (mobile, otp) => {
  const record = otpStore.get(mobile);
  if (!record) return false;
  if (record.expiresAt < Date.now()) return false;
  return record.otp === otp;
};

module.exports = { generateOTP, saveOTP, verifyOTP };


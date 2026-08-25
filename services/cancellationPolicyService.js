const CancellationPolicy = require('../models/CancellationPolicy');

const calculateCancellation = async (booking) => {
  const policy = await CancellationPolicy.findOne({ isActive: true }) || {
    freeWindowMinutes: 2,
    afterFreeWindowPercent: 25,
    driverArrivedPercent: 75,
    patientOnboardPercent: 100
  };
  
  const totalFare = booking.finalAmount || booking.originalAmount || 0;
  const now = new Date();
  const createdTime = new Date(booking.createdAt);
  const elapsedMinutes = Math.floor((now - createdTime) / (1000 * 60));
  
  let feePercentage = 0;
  let reason = 'Free cancellation window';
  
  if (booking.status === 'patient_onboard') {
    feePercentage = policy.patientOnboardPercent;
    reason = 'Patient already onboard';
  } else if (booking.status === 'driver_arrived') {
    feePercentage = policy.driverArrivedPercent;
    reason = 'Driver has arrived at pickup';
  } else if (elapsedMinutes > policy.freeWindowMinutes) {
    feePercentage = policy.afterFreeWindowPercent;
    reason = 'Free cancellation window passed';
  }
  
  const cancellationFee = Math.round(totalFare * feePercentage / 100);
  const refundAmount = totalFare - cancellationFee;
  
  return {
    canCancel: booking.status !== 'patient_onboard',
    cancellationFee,
    refundAmount,
    feePercentage,
    reason,
    totalFare
  };
};

module.exports = { calculateCancellation };
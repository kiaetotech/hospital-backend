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

// ============================================
// 🆕 NEW: Ayurveda Cancellation Logic
// ============================================
const calculateAyurvedaCancellation = (booking) => {
  const totalFare = booking.finalAmount || booking.amount || 0;
  const now = new Date();
  const bookingTime = new Date(booking.bookingDate);
  const hoursBefore = (bookingTime - now) / (1000 * 60 * 60);
  
  let feePercentage = 0;
  let refundPercentage = 0;
  let reason = '';
  let canCancel = true;
  
  // Doctor Consultation & Home Therapy
  if (booking.type === 'doctor_consultation' || booking.type === 'home_therapy') {
    if (hoursBefore > 24) {
      feePercentage = 10;
      refundPercentage = 90;
      reason = 'Cancelled more than 24 hours before consultation';
    } else if (hoursBefore > 6) {
      feePercentage = 50;
      refundPercentage = 50;
      reason = 'Cancelled between 6-24 hours before consultation';
    } else if (hoursBefore > 2) {
      feePercentage = 75;
      refundPercentage = 25;
      reason = 'Cancelled between 2-6 hours before consultation';
    } else {
      feePercentage = 100;
      refundPercentage = 0;
      reason = 'Cancelled less than 2 hours before consultation';
      canCancel = false;
    }
  }
  
  // Panchakarma Package
  else if (booking.type === 'panchakarma_package') {
    if (hoursBefore > 72) {
      feePercentage = 10;
      refundPercentage = 90;
      reason = 'Cancelled more than 72 hours before admission';
    } else if (hoursBefore > 48) {
      feePercentage = 25;
      refundPercentage = 75;
      reason = 'Cancelled between 48-72 hours before admission';
    } else if (hoursBefore > 24) {
      feePercentage = 50;
      refundPercentage = 50;
      reason = 'Cancelled between 24-48 hours before admission';
    } else {
      feePercentage = 100;
      refundPercentage = 0;
      reason = 'Cancelled less than 24 hours before admission';
      canCancel = false;
    }
  }
  
  // Medicine Order
  else if (booking.type === 'medicine_order') {
    if (['pending', 'confirmed'].includes(booking.status)) {
      feePercentage = 0;
      refundPercentage = 100;
      reason = 'Order not yet shipped - full refund';
    } else {
      feePercentage = 100;
      refundPercentage = 0;
      reason = 'Order already shipped - no refund';
      canCancel = false;
    }
  }
  
  // Default
  else {
    if (hoursBefore > 24) {
      feePercentage = 10;
      refundPercentage = 90;
      reason = 'Cancelled more than 24 hours before booking';
    } else {
      feePercentage = 50;
      refundPercentage = 50;
      reason = 'Cancelled less than 24 hours before booking';
    }
  }
  
  const cancellationFee = Math.round(totalFare * feePercentage / 100);
  const refundAmount = Math.round(totalFare * refundPercentage / 100);
  
  return {
    canCancel,
    cancellationFee,
    refundAmount,
    feePercentage,
    refundPercentage,
    reason,
    totalFare
  };
};

// ============================================
// EXPORTS
// ============================================
module.exports = { 
  calculateCancellation,
  calculateAyurvedaCancellation
};
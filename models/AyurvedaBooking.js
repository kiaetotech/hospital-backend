const mongoose = require('mongoose');

const ayurvedaBookingSchema = new mongoose.Schema({
  bookingId: { type, required, unique},
  
  // Patient
  patient: {
    name: { type, required},
    phone: { type, required},
    email,
    abhaId},
  
  // Booking Type
  type: { 
    type, 
    enum: ['doctor_consultation', 'panchakarma_package', 'home_therapy', 'medicine_order'],
    required},
  
  // Doctor Consultation
  doctor: { type.Schema.Types.ObjectId, ref: 'AyurvedaDoctor' },
  consultationType: { type, enum: ['online', 'clinic', 'home'] },
  
  // Panchakarma Package
  center: { type.Schema.Types.ObjectId, ref: 'PanchakarmaCenter' },
  package: {
    name,
    duration,
    therapies: [String]
  },
  
  // Schedule
  bookingDate: { type, required},
  slotTime,
  admissionDate,
  dischargeDate,
  
  // Medical Info
  symptoms,
  medicalHistory,
  prakritiType,
  
  // Payment
  amount: { type, required},
  discount: {
    code,
    percentage,
    amount: { type, default: 0 }
  },
  finalAmount: { type, required},
  platformCommission: { type, required},
  providerEarning: { type, required},
  
  // Payment Status
  paymentStatus: {
    type,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partial_refund'],
    default: 'pending'
  },
  paymentMethod,
  transactionId,
  razorpayOrderId,
  razorpayPaymentId,
  paidAt,
  
  // Booking Status
  status: {
    type,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'pending'
  },
  confirmedAt,
  completedAt,
  cancelledAt,
  cancellationReason,
  
  // Commission Payout
  commissionPayoutStatus: {
    type,
    enum: ['pending', 'processing', 'paid', 'failed'],
    default: 'pending'
  },
  payoutDate,
  payoutTransactionId,
  
  // Reviews
  reviewed: { type, default},
  review: {
    rating,
    comment,
    createdAt},
  
  // Prescription (if any)
  prescription: {
    diagnosis,
    medicines: [{
      name,
      dosage,
      duration,
      instructions}],
    dietAdvice,
    lifestyleAdvice,
    followUpDate},
  
  createdAt: { type, default.now },
  updatedAt: { type, default.now }
});

ayurvedaBookingSchema.index({ bookingId: 1 });
ayurvedaBookingSchema.index({ 'patient.phone': 1 });
ayurvedaBookingSchema.index({ doctor: 1, bookingDate: 1 });
ayurvedaBookingSchema.index({ paymentStatus: 1 });
ayurvedaBookingSchema.index({ status: 1 });

module.exports = mongoose.model('AyurvedaBooking', ayurvedaBookingSchema);


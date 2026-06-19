const mongoose = require('mongoose');

const ayurvedaBookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  
  // Patient
  patient: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    abhaId: String
  },
  
  // Booking Type
  type: { 
    type: String, 
    enum: ['doctor_consultation', 'panchakarma_package', 'home_therapy', 'medicine_order'],
    required: true 
  },
  
  // Doctor Consultation
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'AyurvedaDoctor' },
  consultationType: { type: String, enum: ['online', 'clinic', 'home'] },
  
  // Panchakarma Package
  center: { type: mongoose.Schema.Types.ObjectId, ref: 'PanchakarmaCenter' },
  package: {
    name: String,
    duration: Number,
    therapies: [String]
  },
  
  // Schedule
  bookingDate: { type: Date, required: true },
  slotTime: String,
  admissionDate: Date,
  dischargeDate: Date,
  
  // Medical Info
  symptoms: String,
  medicalHistory: String,
  prakritiType: String,
  
  // Payment
  amount: { type: Number, required: true },
  discount: {
    code: String,
    percentage: Number,
    amount: { type: Number, default: 0 }
  },
  finalAmount: { type: Number, required: true },
  platformCommission: { type: Number, required: true },
  providerEarning: { type: Number, required: true },
  
  // Payment Status
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partial_refund'],
    default: 'pending'
  },
  paymentMethod: String,
  transactionId: String,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  paidAt: Date,
  
  // Booking Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'pending'
  },
  confirmedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  
  // Commission Payout
  commissionPayoutStatus: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'failed'],
    default: 'pending'
  },
  payoutDate: Date,
  payoutTransactionId: String,
  
  // Reviews
  reviewed: { type: Boolean, default: false },
  review: {
    rating: Number,
    comment: String,
    createdAt: Date
  },
  
  // Prescription (if any)
  prescription: {
    diagnosis: String,
    medicines: [{
      name: String,
      dosage: String,
      duration: String,
      instructions: String
    }],
    dietAdvice: String,
    lifestyleAdvice: String,
    followUpDate: Date
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ayurvedaBookingSchema.index({ bookingId: 1 });
ayurvedaBookingSchema.index({ 'patient.phone': 1 });
ayurvedaBookingSchema.index({ doctor: 1, bookingDate: 1 });
ayurvedaBookingSchema.index({ paymentStatus: 1 });
ayurvedaBookingSchema.index({ status: 1 });

module.exports = mongoose.model('AyurvedaBooking', ayurvedaBookingSchema);
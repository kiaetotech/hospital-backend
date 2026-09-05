const mongoose = require('mongoose');

const caregiverBookingSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  caregiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Caregiver', required: true, index: true },
  serviceType: { type: String, enum: ['personal', 'skilled'], required: true },
  durationType: { type: String, enum: ['hourly', 'daily', 'weekly', 'monthly', 'yearly'], default: 'hourly' },
  date: { type: Date, required: true, index: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  duration: { type: Number, required: true, min: 1 },
  totalAmount: { type: Number, required: true, min: 0 },
  platformFee: { type: Number, required: true, min: 0 },
  gstAmount: { type: Number, required: true, min: 0, default: 0 },
  caregiverEarnings: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed'],
    default: 'pending',
    index: true
  },
  checkIn: { timestamp: Date, location: { lat: Number, lng: Number }, qrCode: String },
  checkOut: { timestamp: Date, location: { lat: Number, lng: Number } },
  paymentStatus: { type: String, enum: ['pending', 'held', 'captured', 'released', 'refund_pending', 'refunded', 'partially_refunded', 'failed'], default: 'pending', index: true },
  paymentId: String,
  paymentOrderId: String,
  refundId: String,
  refundedAt: Date,
  refundStatus: { type: String, enum: ['none','pending','processed','failed'], default: 'none' },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  cancellationReason: String,
  cancellationFee: { type: Number, default: 0 },
  cancellationRefund: { type: Number, default: 0 },
  cancelledAt: Date,
  cancelledBy: { type: String, enum: ['patient', 'caregiver', 'admin'] },
  rating: { type: Number, min: 1, max: 5 },
  review: { type: String, trim: true, maxlength: 2000 },
  reviewedAt: Date,
  recurringWeekly: { type: Boolean, default: false },
  recurringDays: [{ type: String }],
  requirements: { type: String, maxlength: 5000 },
  serviceAddress: { type: String, maxlength: 1000 },
  patientName: String,
  patientPhone: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Prevent overlapping active caregiver bookings for the same date/time window.
caregiverBookingSchema.index({ caregiverId: 1, date: 1, startTime: 1, endTime: 1, status: 1 });
caregiverBookingSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model('CaregiverBooking', caregiverBookingSchema);
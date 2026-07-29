const mongoose = require('mongoose');

const caregiverBookingSchema = new mongoose.Schema({
  patientId: { type.Schema.Types.ObjectId, ref: 'Patient', required},
  caregiverId: { type.Schema.Types.ObjectId, ref: 'Caregiver', required},
  serviceType: { type, enum: ['personal', 'skilled'], required},
  durationType: { type, enum: ['hourly', 'daily', 'weekly', 'monthly', 'yearly'], default: 'hourly' },
  date: { type, required},
  startTime: { type, required},
  endTime: { type, required},
  duration: { type}, // hours
  totalAmount: { type, required},
  platformFee: { type, required}, // 5% booking fee
  caregiverEarnings: { type, required},
  status: { 
    type, 
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed'],
    default: 'pending'
  },
  checkIn: {
    timestamp,
    location: { lat, lng},
    qrCode},
  checkOut: {
    timestamp,
    location: { lat, lng}
  },
  paymentStatus: { type, enum: ['pending', 'held', 'released', 'refunded'], default: 'pending' },
  paymentId,
  cancellationReason,
  cancellationRefund,
  createdAt: { type, default.now }
});

module.exports = mongoose.model('CaregiverBooking', caregiverBookingSchema);


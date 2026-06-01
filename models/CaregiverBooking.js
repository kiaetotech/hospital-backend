const mongoose = require('mongoose');

const caregiverBookingSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  caregiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Caregiver', required: true },
  serviceType: { type: String, enum: ['personal', 'skilled'], required: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  duration: { type: Number }, // hours
  totalAmount: { type: Number, required: true },
  platformFee: { type: Number, required: true }, // 5% booking fee
  caregiverEarnings: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed'],
    default: 'pending'
  },
  checkIn: {
    timestamp: Date,
    location: { lat: Number, lng: Number },
    qrCode: String
  },
  checkOut: {
    timestamp: Date,
    location: { lat: Number, lng: Number }
  },
  paymentStatus: { type: String, enum: ['pending', 'held', 'released', 'refunded'], default: 'pending' },
  paymentId: String,
  cancellationReason: String,
  cancellationRefund: Number,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CaregiverBooking', caregiverBookingSchema);
const mongoose = require('mongoose');

const ambulanceBookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AmbulanceVehicle', required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'AmbulanceProvider' },
  bookingType: { type: String, enum: ['emergency', 'non-emergency'], required: true },
  patientName: { type: String, required: true },
  patientAge: Number,
  patientGender: String,
  patientPhone: { type: String, required: true },
  pickupAddress: { type: String, required: true },
  pickupLocation: { lat: Number, lng: Number },
  dropAddress: { type: String, required: true },
  dropLocation: { lat: Number, lng: Number },
  distance: { type: Number },
  requiresAttendant: { type: Boolean, default: false },
  specialInstructions: String,
  scheduledTime: Date,
  totalAmount: Number,
  discount: Number,
  finalAmount: Number,
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  paymentId: String,
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'enroute', 'arrived', 'completed', 'cancelled'],
    default: 'pending'
  },
  driverName: String,
  driverPhone: String,
  vehicleNumber: String,
  tracking: [{
    lat: Number,
    lng: Number,
    timestamp: Date
  }],
  rating: { type: Number, min: 1, max: 5 },
  review: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AmbulanceBooking', ambulanceBookingSchema);
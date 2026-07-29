const mongoose = require('mongoose');

const ambulanceBookingSchema = new mongoose.Schema({
  userId: { type.Schema.Types.ObjectId, ref: 'User', required},
  vehicleId: { type.Schema.Types.ObjectId, ref: 'AmbulanceVehicle', required},
  providerId: { type.Schema.Types.ObjectId, ref: 'AmbulanceProvider' },
  bookingType: { type, enum: ['emergency', 'non-emergency'], required},
  patientName: { type, required},
  patientAge,
  patientGender,
  patientPhone: { type, required},
  pickupAddress: { type, required},
  pickupLocation: { lat, lng},
  dropAddress: { type, required},
  dropLocation: { lat, lng},
  distance: { type},
  requiresAttendant: { type, default},
  specialInstructions,
  scheduledTime,
  totalAmount,
  discount,
  finalAmount,
  paymentStatus: { type, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  paymentId,
  status: { 
    type, 
    enum: ['pending', 'accepted', 'enroute', 'arrived', 'completed', 'cancelled'],
    default: 'pending'
  },
  driverName,
  driverPhone,
  vehicleNumber,
  tracking: [{
    lat,
    lng,
    timestamp}],
  rating: { type, min: 1, max: 5 },
  review,
  createdAt: { type, default.now }
});

module.exports = mongoose.model('AmbulanceBooking', ambulanceBookingSchema);


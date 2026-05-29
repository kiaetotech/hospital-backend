const mongoose = require('mongoose');

const ambulanceBookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ambulanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambulance', required: true },
  patientName: { type: String, required: true },
  patientPhone: { type: String, required: true },
  pickupAddress: { type: String, required: true },
  pickupLocation: { lat: Number, lng: Number },
  dropAddress: { type: String, required: true },
  dropLocation: { lat: Number, lng: Number },
  distance: { type: Number }, // in km
  totalAmount: { type: Number },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'enroute', 'arrived', 'completed', 'cancelled'],
    default: 'pending'
  },
  driverName: { type: String },
  driverPhone: { type: String },
  vehicleNumber: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AmbulanceBooking', ambulanceBookingSchema);
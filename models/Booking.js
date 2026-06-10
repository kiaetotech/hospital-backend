const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // Common fields for all booking types
  userId: { type: String, required: true },
  bookingType: { type: String, enum: ['opd', 'admission', 'ambulance', 'labtest'], required: true },
  patientName: { type: String, required: true },
  patientPhone: { type: String, required: true },
  patientAge: { type: Number },
  patientGender: { type: String, enum: ['male', 'female', 'other'] },
  patientEmail: { type: String },
  bookingDate: { type: Date, default: Date.now },
  appointmentDate: { type: Date, required: true },
  originalAmount: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  paymentId: { type: String },
  orderId: { type: String },
  status: { type: String, enum: ['pending', 'confirmed', 'sample_collected', 'processing', 'report_ready', 'completed', 'cancelled'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  
  // Hospital/OPD/Admission fields
  hospitalId: { type: String },
  hospitalName: { type: String },
  doctorName: { type: String },
  timeSlot: { type: String },
  
  // Ambulance fields
  ambulanceType: { type: String },
  pickupAddress: { type: String },
  dropAddress: { type: String },
  
  // Lab Test fields
  tests: [{ type: String }],
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },
  providerName: { type: String },
  homeCollectionRequested: { type: Boolean, default: false },
  homeAddress: { type: String },
  bookingId: { type: String, unique: true },
  
  // NEW: Status tracking fields
  statusHistory: [{
    status: { type: String, enum: ['pending', 'confirmed', 'sample_collected', 'processing', 'report_ready', 'completed', 'cancelled'] },
    timestamp: { type: Date, default: Date.now },
    note: { type: String }
  }],
  estimatedReportTime: { type: Date }
});

// Generate unique booking ID before saving
bookingSchema.pre('save', function(next) {
  if (!this.bookingId && this.bookingType === 'labtest') {
    this.bookingId = 'LAB' + Date.now() + Math.floor(Math.random() * 1000);
  }
  // Initialize statusHistory if empty and status is set
  if (this.isModified('status') && (!this.statusHistory || this.statusHistory.length === 0)) {
    this.statusHistory = this.statusHistory || [];
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      note: 'Booking created'
    });
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
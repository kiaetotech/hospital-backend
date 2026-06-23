const mongoose = require('mongoose');

const MentalHealthBookingSchema = new mongoose.Schema({
  therapistId: { type: mongoose.Schema.Types.ObjectId, ref: 'MentalHealthTherapist', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Booking Details
  bookingType: {
    type: String,
    enum: ['video', 'audio', 'text', 'anonymous', 'emergency', 'couples', 'family'],
    required: true
  },
  sessionType: {
    type: String,
    enum: ['individual', 'couples', 'family', 'group'],
    default: 'individual'
  },
  
  // Scheduling
  scheduledDate: { type: Date, required: true },
  scheduledTime: { type: String, required: true },
  duration: { type: Number, default: 60 }, // minutes
  
  // Pricing
  amount: { type: Number, required: true },
  platformCommission: { type: Number, default: 0 },
  therapistEarning: { type: Number, default: 0 },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'pending'
  },
  
  // Payment
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentId: { type: String },
  orderId: { type: String },
  
  // Session Details
  isAnonymous: { type: Boolean, default: false },
  anonymousId: { type: String }, // Random ID for anonymous sessions
  
  // Emergency Flag
  isEmergency: { type: Boolean, default: false },
  emergencyLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  crisisNotes: { type: String },
  
  // Patient Details (for emergency)
  emergencyContact: {
    name: String,
    phone: String,
    relation: String
  },
  
  // Couples/Family Therapy
  participants: [{
    name: String,
    age: Number,
    relation: String,
    email: String
  }],
  
  // Notes
  patientNotes: { type: String },
  therapistNotes: { type: String }, // Added after session
  cancellationReason: { type: String },
  
  // Session Link (for video)
  sessionLink: { type: String },
  
  // Feedback
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String },
    submittedAt: { type: Date }
  },
  
  // Follow-up
  followUpScheduled: { type: Boolean, default: false },
  followUpDate: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
MentalHealthBookingSchema.index({ therapistId: 1, scheduledDate: 1 });
MentalHealthBookingSchema.index({ patientId: 1 });
MentalHealthBookingSchema.index({ status: 1 });
MentalHealthBookingSchema.index({ isEmergency: 1 });

// Virtuals
MentalHealthBookingSchema.virtual('isActive').get(function() {
  return ['pending', 'confirmed', 'in_progress'].includes(this.status);
});

MentalHealthBookingSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

// Methods
MentalHealthBookingSchema.methods.cancel = function(reason) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  return this.save();
};

MentalHealthBookingSchema.methods.complete = function() {
  this.status = 'completed';
  return this.save();
};

MentalHealthBookingSchema.methods.addFeedback = function(rating, review) {
  this.feedback = { rating, review, submittedAt: new Date() };
  return this.save();
};

module.exports = mongoose.model('MentalHealthBooking', MentalHealthBookingSchema);
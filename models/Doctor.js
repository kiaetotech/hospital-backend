const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  // Basic Info
  name: { type: String, required: true },
  specialization: { type: String, required: true, index: true },
  sub_specialization: String,
  qualification: String,
  experience: String,
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  languages: [String],
  
  // Hospital reference
  hospitalId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Hospital', 
    required: true,
    index: true 
  },
  hospitalName: String,
  
  // User account (for doctor login)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: String,
  phone: String,
  
  // Consultation
  consultation_fee: { type: Number, required: true },
  consultation_duration: { type: Number, default: 15 }, // minutes
  opd_room: String,
  
  // Availability
  availability: {
    status: { 
      type: String, 
      enum: ['available', 'limited', 'full', 'leave'],
      default: 'available'
    },
    slots_available: { type: Number, default: 20 },
    next_available: String,
    days: [String],
    morning_slots: String,
    evening_slots: String,
    max_patients_per_day: { type: Number, default: 20 }
  },
  
  // Schedule
  schedule: [{
    day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    morning_start: String,
    morning_end: String,
    evening_start: String,
    evening_end: String,
    is_available: { type: Boolean, default: true }
  }],
  
  // Time slots (for booking)
  time_slots: [{
    date: Date,
    slots: [{
      time: String,
      is_booked: { type: Boolean, default: false },
      patientName: String,
      bookingId: String
    }]
  }],
  
  // Ratings
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  
  // Stats
  totalConsultations: { type: Number, default: 0 },
  totalPatients: { type: Number, default: 0 },
  yearsOfExperience: Number,
  
  // Registration details
  registration_number: String,
  medical_council: String,
  registration_year: Number,
  
  // Documents
  documents: [{
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // Verification
  is_verified: { type: Boolean, default: false },
  verified_at: Date,
  verified_by: String,
  
  // Status
  is_active: { type: Boolean, default: true },
  accepting_new_patients: { type: Boolean, default: true },
  
  // Bio
  bio: String,
  achievements: [String],
  memberships: [String],
  research_papers: [String],
  
  // Photo
  photo_url: String,
  
  // Digital signature
  digital_signature_url: String,
  
  // Timestamps
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }

}, { timestamps: true });

// Indexes
doctorSchema.index({ specialization: 1, is_active: 1 });
doctorSchema.index({ hospitalId: 1, specialization: 1 });
doctorSchema.index({ name: 'text', specialization: 'text' });

// Virtual: Full title
doctorSchema.virtual('fullTitle').get(function() {
  return `Dr. ${this.name} - ${this.specialization}`;
});

// Method: Check if doctor is available on a date
doctorSchema.methods.isAvailableOn = function(date, time) {
  const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
  const schedule = this.schedule?.find(s => s.day === dayName);
  
  if (!schedule || !schedule.is_available) return false;
  if (this.availability?.status === 'leave') return false;
  if (this.availability?.status === 'full') return false;
  
  return true;
};

// Method: Get available slots for a date
doctorSchema.methods.getAvailableSlots = function(date) {
  const timeSlots = this.time_slots?.find(
    ts => new Date(ts.date).toDateString() === new Date(date).toDateString()
  );
  
  if (!timeSlots) return [];
  return timeSlots.slots.filter(s => !s.is_booked);
};

// Method: Book a slot
doctorSchema.methods.bookSlot = async function(date, time, patientName, bookingId) {
  let timeSlot = this.time_slots?.find(
    ts => new Date(ts.date).toDateString() === new Date(date).toDateString()
  );
  
  if (!timeSlot) {
    // Generate slots for the day
    const slots = this.generateTimeSlots();
    timeSlot = { date: new Date(date), slots };
    this.time_slots.push(timeSlot);
  }
  
  const slot = timeSlot.slots.find(s => s.time === time && !s.is_booked);
  if (!slot) {
    throw new Error('Slot not available');
  }
  
  slot.is_booked = true;
  slot.patientName = patientName;
  slot.bookingId = bookingId;
  
  // Update availability
  const availableSlots = timeSlot.slots.filter(s => !s.is_booked).length;
  if (availableSlots === 0) {
    this.availability.status = 'full';
    this.availability.slots_available = 0;
  } else if (availableSlots < 5) {
    this.availability.status = 'limited';
    this.availability.slots_available = availableSlots;
  }
  
  this.totalConsultations += 1;
  await this.save();
  return slot;
};

// Method: Generate time slots for a day
doctorSchema.methods.generateTimeSlots = function() {
  const slots = [];
  const morningStart = 9;
  const morningEnd = 13;
  const eveningStart = 17;
  const eveningEnd = 20;
  const duration = this.consultation_duration || 15;
  
  for (let h = morningStart; h < morningEnd; h++) {
    for (let m = 0; m < 60; m += duration) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const period = h < 12 ? 'AM' : 'PM';
      slots.push({
        time: `${time} ${period}`,
        is_booked: false,
        patientName: null,
        bookingId: null
      });
    }
  }
  
  for (let h = eveningStart; h < eveningEnd; h++) {
    for (let m = 0; m < 60; m += duration) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const period = h < 12 ? 'AM' : 'PM';
      slots.push({
        time: `${time} ${period}`,
        is_booked: false,
        patientName: null,
        bookingId: null
      });
    }
  }
  
  return slots;
};

module.exports = mongoose.model('Doctor', doctorSchema);
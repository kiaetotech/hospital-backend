const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  // Basic Info
  name: { type, required},
  specialization: { type, required, index},
  sub_specialization,
  qualification,
  experience,
  gender: { type, enum: ['Male', 'Female', 'Other'] },
  languages: [String],
  
  // Hospital reference
  hospitalId: { 
    type.Schema.Types.ObjectId, 
    ref: 'Hospital', 
    required,
    index},
  hospitalName,
  
  // User account (for doctor login)
  userId: { type.Schema.Types.ObjectId, ref: 'User' },
  email,
  phone,
  
  // Consultation
  consultation_fee: { type, required},
  consultation_duration: { type, default: 15 }, // minutes
  opd_room,
  
  // Availability
  availability: {
    status: { 
      type, 
      enum: ['available', 'limited', 'full', 'leave'],
      default: 'available'
    },
    slots_available: { type, default: 20 },
    next_available,
    days: [String],
    morning_slots,
    evening_slots,
    max_patients_per_day: { type, default: 20 }
  },
  
  // Schedule
  schedule: [{
    day: { type, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    morning_start,
    morning_end,
    evening_start,
    evening_end,
    is_available: { type, default}
  }],
  
  // Time slots (for booking)
  time_slots: [{
    date,
    slots: [{
      time,
      is_booked: { type, default},
      patientName,
      bookingId}]
  }],
  
  // Ratings
  rating: { type, default: 0 },
  reviewCount: { type, default: 0 },
  
  // Stats
  totalConsultations: { type, default: 0 },
  totalPatients: { type, default: 0 },
  yearsOfExperience,
  
  // Registration details
  registration_number,
  medical_council,
  registration_year,
  
  // Documents
  documents: [{
    name,
    url,
    uploadedAt: { type, default.now }
  }],
  
  // Verification
  is_verified: { type, default},
  verified_at,
  verified_by,
  
  // Status
  is_active: { type, default},
  accepting_new_patients: { type, default},
  
  // Bio
  bio,
  achievements: [String],
  memberships: [String],
  research_papers: [String],
  
  // Photo
  photo_url,
  
  // Digital signature
  digital_signature_url,
  
  // Timestamps
  created_at: { type, default.now },
  updated_at: { type, default.now }

}, { timestamps});

// Indexes
doctorSchema.index({ specialization: 1, is_active: 1 });
doctorSchema.index({ hospitalId: 1, specialization: 1 });
doctorSchema.index({ name: 'text', specialization: 'text' });

// Virtualtitle
doctorSchema.virtual('fullTitle').get(function() {
  return `Dr. ${this.name} - ${this.specialization}`;
});

// Methodif doctor is available on a date
doctorSchema.methods.isAvailableOn = function(date, time) {
  const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
  const schedule = this.schedule?.find(s => s.day === dayName);
  
  if (!schedule || !schedule.is_available) return false;
  if (this.availability?.status === 'leave') return false;
  if (this.availability?.status === 'full') return false;
  
  return true;
};

// Methodavailable slots for a date
doctorSchema.methods.getAvailableSlots = function(date) {
  const timeSlots = this.time_slots?.find(
    ts => new Date(ts.date).toDateString() === new Date(date).toDateString()
  );
  
  if (!timeSlots) return [];
  return timeSlots.slots.filter(s => !s.is_booked);
};

// Methoda slot
doctorSchema.methods.bookSlot = async function(date, time, patientName, bookingId) {
  let timeSlot = this.time_slots?.find(
    ts => new Date(ts.date).toDateString() === new Date(date).toDateString()
  );
  
  if (!timeSlot) {
    // Generate slots for the day
    const slots = this.generateTimeSlots();
    timeSlot = { dateDate(date), slots };
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

// Methodtime slots for a day
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
        is_booked,
        patientName,
        bookingId});
    }
  }
  
  for (let h = eveningStart; h < eveningEnd; h++) {
    for (let m = 0; m < 60; m += duration) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const period = h < 12 ? 'AM' : 'PM';
      slots.push({
        time: `${time} ${period}`,
        is_booked,
        patientName,
        bookingId});
    }
  }
  
  return slots;
};

module.exports = mongoose.model('Doctor', doctorSchema);


const mongoose = require('mongoose');

const dailyLogSchema = new mongoose.Schema({
  day: { type, required},
  date: { type, default.now },
  therapy: { type},
  patientFeeling: { type, enum: ['Better', 'Same', 'Worse', 'Not Sure'], default: 'Not Sure' },
  notes: { type, maxlength: 500 },
  vitals: {
    weight,
    bp,
    pulse},
  completed: { type, default}
});

const panchakarmaProgressSchema = new mongoose.Schema({
  bookingId: { type.Schema.Types.ObjectId, ref: 'Booking', required},
  patientId: { type.Schema.Types.ObjectId, ref: 'User', required},
  doctorId: { type.Schema.Types.ObjectId, ref: 'OnlineDoctor' },
  centerId: { type.Schema.Types.ObjectId, ref: 'PanchakarmaCenter' },
  
  packageName: { type, required},
  totalDays: { type, required},
  startDate: { type, required},
  endDate: { type},
  
  currentDay: { type, default: 1 },
  status: { 
    type, 
    enum: ['not_started', 'in_progress', 'completed', 'paused', 'cancelled'],
    default: 'not_started' 
  },
  
  dailyLogs: [dailyLogSchema],
  
  // Pre-treatment
  preTreatment: {
    snehana: { type, default},
    swedana: { type, default},
    notes},
  
  // Main therapy
  mainTherapy: {
    type: { type, enum: ['Vamana', 'Virechana', 'Basti', 'Nasya', 'Raktamokshana', 'Other'] },
    startDay,
    completedDate,
    notes},
  
  // Post-treatment
  postTreatment: {
    diet: { type, default},
    lifestyle: { type, default},
    rasayana: { type, default},
    notes},
  
  // Doctor notes
  doctorNotes: [{ 
    note, 
    date: { type, default.now } 
  }],
  
  // Completion
  completedAt,
  certificateGenerated: { type, default},
  
  createdAt: { type, default.now },
  updatedAt: { type, default.now }
});

panchakarmaProgressSchema.index({ bookingId: 1 });
panchakarmaProgressSchema.index({ patientId: 1, status: 1 });

module.exports = mongoose.model('PanchakarmaProgress', panchakarmaProgressSchema);


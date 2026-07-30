const mongoose = require('mongoose');

const dailyLogSchema = new mongoose.Schema({
  day: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  therapy: { type: String },
  patientFeeling: { type: String, enum: ['Better', 'Same', 'Worse', 'Not Sure'], default: 'Not Sure' },
  notes: { type: String, maxlength: 500 },
  vitals: {
    weight: Number,
    bp: String,
    pulse: Number
  },
  completed: { type: Boolean, default: false }
});

const panchakarmaProgressSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnlineDoctor' },
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'PanchakarmaCenter' },
  
  packageName: { type: String, required: true },
  totalDays: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  
  currentDay: { type: Number, default: 1 },
  status: { 
    type: String, 
    enum: ['not_started', 'in_progress', 'completed', 'paused', 'cancelled'],
    default: 'not_started' 
  },
  
  dailyLogs: [dailyLogSchema],
  
  // Pre-treatment
  preTreatment: {
    snehana: { type: Boolean, default: false },
    swedana: { type: Boolean, default: false },
    notes: String
  },
  
  // Main therapy
  mainTherapy: {
    type: { type: String, enum: ['Vamana', 'Virechana', 'Basti', 'Nasya', 'Raktamokshana', 'Other'] },
    startDay: Number,
    completedDate: Date,
    notes: String
  },
  
  // Post-treatment
  postTreatment: {
    diet: { type: Boolean, default: false },
    lifestyle: { type: Boolean, default: false },
    rasayana: { type: Boolean, default: false },
    notes: String
  },
  
  // Doctor notes
  doctorNotes: [{ 
    note: String, 
    date: { type: Date, default: Date.now } 
  }],
  
  // Completion
  completedAt: Date,
  certificateGenerated: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

panchakarmaProgressSchema.index({ bookingId: 1 });
panchakarmaProgressSchema.index({ patientId: 1, status: 1 });

module.exports = mongoose.model('PanchakarmaProgress', panchakarmaProgressSchema);
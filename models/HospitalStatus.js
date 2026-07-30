const mongoose = require('mongoose');

const hospitalStatusSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['accepting', 'limited', 'full', 'unknown'],
    default: 'unknown'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  updatedVia: {
    type: String,
    enum: ['whatsapp', 'missed_call', 'manual', 'auto', 'booking'],
    default: 'manual'
  },
  lastWhatsappSent: Date,
  lastResponseReceived: Date,
  responseCount: { type: Number, default: 0 },
  streakCount: { type: Number, default: 0 }
});

hospitalStatusSchema.index({ hospitalId: 1 });
hospitalStatusSchema.index({ status: 1 });
hospitalStatusSchema.index({ updatedAt: 1 });

module.exports = mongoose.model('HospitalStatus', hospitalStatusSchema);
const mongoose = require('mongoose');

const hospitalStatusSchema = new mongoose.Schema({
  hospitalId: {
    type.Schema.Types.ObjectId,
    ref: 'Hospital',
    required,
    unique},
  status: {
    type,
    enum: ['accepting', 'limited', 'full', 'unknown'],
    default: 'unknown'
  },
  updatedAt: {
    type,
    default.now
  },
  updatedVia: {
    type,
    enum: ['whatsapp', 'missed_call', 'manual', 'auto', 'booking'],
    default: 'manual'
  },
  lastWhatsappSent,
  lastResponseReceived,
  responseCount: { type, default: 0 },
  streakCount: { type, default: 0 }
});

hospitalStatusSchema.index({ hospitalId: 1 });
hospitalStatusSchema.index({ status: 1 });
hospitalStatusSchema.index({ updatedAt: 1 });

module.exports = mongoose.model('HospitalStatus', hospitalStatusSchema);


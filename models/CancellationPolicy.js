const mongoose = require('mongoose');

const cancellationPolicySchema = new mongoose.Schema({
  freeWindowMinutes: { type: Number, default: 2 },
  afterFreeWindowPercent: { type: Number, default: 25 },
  driverArrivedPercent: { type: Number, default: 75 },
  patientOnboardPercent: { type: Number, default: 100 },
  isActive: { type: Boolean, default: true },
  updatedBy: { type: String },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CancellationPolicy', cancellationPolicySchema);
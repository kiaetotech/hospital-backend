const mongoose = require('mongoose');

const InsuranceAppealSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsuranceCompany', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Snapshot of suspension at time of appeal
  suspensionReason: { type: String, required: true },
  suspendedAt: { type: Date },
  suspendedUntil: { type: Date },

  // Company's appeal
  appealReason: { type: String, required: true, minlength: 20, maxlength: 2000 },
  lapseExplanation: { type: String, maxlength: 2000 },
  correctiveActions: { type: String, maxlength: 2000 },
  documents: [{
    type: { type: String },
    url: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Status
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },

  // Admin review
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  adminNotes: { type: String, maxlength: 1000 },
  rejectionReason: { type: String, maxlength: 1000 },

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('InsuranceAppeal', InsuranceAppealSchema);
const mongoose = require('mongoose');

const MentalHealthScreeningSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  screeningType: {
    type: String,
    enum: ['depression', 'anxiety', 'stress', 'general'],
    required: true
  },
  depressionScores: [{
    question: Number,
    answer: Number
  }],
  depressionTotal: { type: Number, default: 0 },
  depressionSeverity: {
    type: String,
    enum: ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe']
    // ✅ REMOVED required: true
  },
  anxietyScores: [{
    question: Number,
    answer: Number
  }],
  anxietyTotal: { type: Number, default: 0 },
  anxietySeverity: {
    type: String,
    enum: ['minimal', 'mild', 'moderate', 'severe']
    // ✅ REMOVED required: true
  },
  recommendations: [{
    type: { type: String, enum: ['consultation', 'self_help', 'crisis'] },
    description: String,
    urgency: { type: String, enum: ['low', 'medium', 'high'] }
  }],
  requiresEmergency: { type: Boolean, default: false },
  isAnonymous: { type: Boolean, default: false },
  anonymousId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MentalHealthScreening', MentalHealthScreeningSchema);
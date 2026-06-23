const mongoose = require('mongoose');

const MentalHealthScreeningSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  screeningType: {
    type: String,
    enum: ['depression', 'anxiety', 'stress', 'panic', 'ptsd', 'general'],
    required: true
  },
  
  // PHQ-9 for Depression
  depressionScores: [{
    question: String,
    answer: Number // 0-3
  }],
  depressionTotal: { type: Number, default: 0 },
  depressionSeverity: {
    type: String,
    enum: ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe']
  },
  
  // GAD-7 for Anxiety
  anxietyScores: [{
    question: String,
    answer: Number // 0-3
  }],
  anxietyTotal: { type: Number, default: 0 },
  anxietySeverity: {
    type: String,
    enum: ['minimal', 'mild', 'moderate', 'severe']
  },
  
  // PSS-10 for Stress
  stressScores: [{
    question: String,
    answer: Number // 0-4
  }],
  stressTotal: { type: Number, default: 0 },
  
  // Recommendations
  recommendations: [{
    type: { type: String, enum: ['consultation', 'self_help', 'crisis', 'follow_up'] },
    description: String,
    urgency: { type: String, enum: ['low', 'medium', 'high'] },
    therapistId: { type: mongoose.Schema.Types.ObjectId, ref: 'MentalHealthTherapist' }
  }],
  
  // Emergency Flag
  requiresEmergency: { type: Boolean, default: false },
  emergencyAlertSent: { type: Boolean, default: false },
  
  // Anonymous
  isAnonymous: { type: Boolean, default: false },
  anonymousId: { type: String },
  
  createdAt: { type: Date, default: Date.now }
});

// Indexes
MentalHealthScreeningSchema.index({ userId: 1 });
MentalHealthScreeningSchema.index({ screeningType: 1 });
MentalHealthScreeningSchema.index({ requiresEmergency: 1 });

module.exports = mongoose.model('MentalHealthScreening', MentalHealthScreeningSchema);
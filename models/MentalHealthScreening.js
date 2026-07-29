const mongoose = require('mongoose');

const MentalHealthScreeningSchema = new mongoose.Schema({
  userId: { type.Schema.Types.ObjectId, ref: 'User' },
  screeningType: {
    type,
    enum: ['depression', 'anxiety', 'stress', 'general'],
    required},
  depressionScores: [{
    question,
    answer}],
  depressionTotal: { type, default: 0 },
  depressionSeverity: {
    type,
    enum: ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe']
    // ✅ REMOVED required},
  anxietyScores: [{
    question,
    answer}],
  anxietyTotal: { type, default: 0 },
  anxietySeverity: {
    type,
    enum: ['minimal', 'mild', 'moderate', 'severe']
    // ✅ REMOVED required},
  recommendations: [{
    type: { type, enum: ['consultation', 'self_help', 'crisis'] },
    description,
    urgency: { type, enum: ['low', 'medium', 'high'] }
  }],
  requiresEmergency: { type, default},
  isAnonymous: { type, default},
  anonymousId: { type},
  createdAt: { type, default.now }
});

module.exports = mongoose.model('MentalHealthScreening', MentalHealthScreeningSchema);


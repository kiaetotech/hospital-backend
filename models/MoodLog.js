const mongoose = require('mongoose');

const moodLogSchema = new mongoose.Schema({
  userId: { type.Schema.Types.ObjectId, ref: 'User', required},
  
  // Mood entry
  mood: { 
    type, 
    enum: ['great', 'good', 'okay', 'low', 'bad', 'terrible'],
    required},
  moodScore: { type, min: 1, max: 10, required}, // 1=worst, 10=best
  
  // Context
  journalEntry: { type, maxlength: 2000 },
  tags: [{ type}], // anxiety, stress, sleep, work, relationship
  
  // AI Analysis (auto-filled)
  sentimentScore: { type, min: -1, max: 1 }, // -1 negative, 1 positive
  detectedKeywords: [{ type}],
  crisisDetected: { type, default},
  
  // Date
  date: { type, default.now },
  
  createdAt: { type, default.now }
});

// Index for quick trend queries
moodLogSchema.index({ userId: 1, date: -1 });
moodLogSchema.index({ userId: 1, moodScore: 1 });

// Staticweekly mood trend
moodLogSchema.statics.getWeeklyTrend = async function(userId) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const logs = await this.find({ userId, date: { $gte} }).sort({ date: 1 });
  
  if (logs.length === 0) return { trend: 'stable', averageScore, data: [] };
  
  const scores = logs.map(l => l.moodScore);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  
  let trend = 'stable';
  if (scores.length >= 3) {
    const recent = scores.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const older = scores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    if (recent < older - 1) trend = 'declining';
    else if (recent > older + 1) trend = 'improving';
  }
  
  return { trend, averageScore, data.map(l => ({ date.date, mood.mood, score.moodScore })) };
};

module.exports = mongoose.model('MoodLog', moodLogSchema);


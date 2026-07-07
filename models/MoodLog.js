const mongoose = require('mongoose');

const moodLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Mood entry
  mood: { 
    type: String, 
    enum: ['great', 'good', 'okay', 'low', 'bad', 'terrible'],
    required: true 
  },
  moodScore: { type: Number, min: 1, max: 10, required: true }, // 1=worst, 10=best
  
  // Context
  journalEntry: { type: String, maxlength: 2000 },
  tags: [{ type: String }], // anxiety, stress, sleep, work, relationship
  
  // AI Analysis (auto-filled)
  sentimentScore: { type: Number, min: -1, max: 1 }, // -1 negative, 1 positive
  detectedKeywords: [{ type: String }],
  crisisDetected: { type: Boolean, default: false },
  
  // Date
  date: { type: Date, default: Date.now },
  
  createdAt: { type: Date, default: Date.now }
});

// Index for quick trend queries
moodLogSchema.index({ userId: 1, date: -1 });
moodLogSchema.index({ userId: 1, moodScore: 1 });

// Static: Get weekly mood trend
moodLogSchema.statics.getWeeklyTrend = async function(userId) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const logs = await this.find({ userId, date: { $gte: weekAgo } }).sort({ date: 1 });
  
  if (logs.length === 0) return { trend: 'stable', averageScore: null, data: [] };
  
  const scores = logs.map(l => l.moodScore);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  
  let trend = 'stable';
  if (scores.length >= 3) {
    const recent = scores.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const older = scores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    if (recent < older - 1) trend = 'declining';
    else if (recent > older + 1) trend = 'improving';
  }
  
  return { trend, averageScore: avg, data: logs.map(l => ({ date: l.date, mood: l.mood, score: l.moodScore })) };
};

module.exports = mongoose.model('MoodLog', moodLogSchema);
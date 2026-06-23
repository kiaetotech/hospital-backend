const mongoose = require('mongoose');

const MentalHealthScreeningSchema = new mongoose.Schema({
  // User reference (optional for anonymous)
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: false 
  },
  
  // Screening type
  screeningType: {
    type: String,
    enum: ['depression', 'anxiety', 'stress', 'general'],
    required: true
  },
  
  // Depression (PHQ-9) scores - Only populated for depression tests
  depressionScores: [{
    question: { type: Number },
    answer: { type: Number, min: 0, max: 3 }
  }],
  depressionTotal: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 27
  },
  depressionSeverity: {
    type: String,
    enum: ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe'],
    required: false   // ✅ CHANGED: false instead of true
  },
  
  // Anxiety (GAD-7) scores - Only populated for anxiety tests
  anxietyScores: [{
    question: { type: Number },
    answer: { type: Number, min: 0, max: 3 }
  }],
  anxietyTotal: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 21
  },
  anxietySeverity: {
    type: String,
    enum: ['minimal', 'mild', 'moderate', 'severe'],
    required: false   // ✅ CHANGED: false instead of true
  },
  
  // Recommendations based on results
  recommendations: [{
    type: { 
      type: String, 
      enum: ['consultation', 'self_help', 'crisis', 'follow_up'] 
    },
    description: { type: String },
    urgency: { 
      type: String, 
      enum: ['low', 'medium', 'high'] 
    }
  }],
  
  // Emergency flag
  requiresEmergency: { 
    type: Boolean, 
    default: false 
  },
  
  // Anonymous screening
  isAnonymous: { 
    type: Boolean, 
    default: false 
  },
  anonymousId: { 
    type: String 
  },
  
  // Timestamps
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// ✅ Add indexes for faster queries
MentalHealthScreeningSchema.index({ userId: 1 });
MentalHealthScreeningSchema.index({ screeningType: 1 });
MentalHealthScreeningSchema.index({ requiresEmergency: 1 });
MentalHealthScreeningSchema.index({ createdAt: -1 });

// ✅ Virtual for getting severity label
MentalHealthScreeningSchema.virtual('severityLabel').get(function() {
  if (this.screeningType === 'depression') {
    return this.depressionSeverity;
  } else if (this.screeningType === 'anxiety') {
    return this.anxietySeverity;
  }
  return 'Unknown';
});

// ✅ Virtual for getting total score
MentalHealthScreeningSchema.virtual('totalScore').get(function() {
  if (this.screeningType === 'depression') {
    return this.depressionTotal;
  } else if (this.screeningType === 'anxiety') {
    return this.anxietyTotal;
  }
  return 0;
});

// ✅ Virtual for getting severity color
MentalHealthScreeningSchema.virtual('severityColor').get(function() {
  const colors = {
    'minimal': '#10b981',
    'mild': '#f59e0b',
    'moderate': '#f97316',
    'moderately_severe': '#ef4444',
    'severe': '#dc2626'
  };
  const severity = this.screeningType === 'depression' ? this.depressionSeverity : this.anxietySeverity;
  return colors[severity] || '#6b7280';
});

// ✅ Method to check if emergency
MentalHealthScreeningSchema.methods.isEmergency = function() {
  return this.requiresEmergency === true;
};

// ✅ Static method to get stats
MentalHealthScreeningSchema.statics.getStats = async function() {
  const total = await this.countDocuments();
  const emergency = await this.countDocuments({ requiresEmergency: true });
  const byType = await this.aggregate([
    { $group: { _id: '$screeningType', count: { $sum: 1 } } }
  ]);
  
  return {
    total,
    emergency,
    byType
  };
};

module.exports = mongoose.model('MentalHealthScreening', MentalHealthScreeningSchema);
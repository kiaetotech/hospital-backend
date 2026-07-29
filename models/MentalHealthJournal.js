const mongoose = require('mongoose');

const mentalHealthJournalSchema = new mongoose.Schema({
  userId: {
    type.Schema.Types.ObjectId,
    ref: 'User',
    required,
    index},
  therapistId: {
    type.Schema.Types.ObjectId,
    ref: 'MentalHealthTherapist',
    index},
  bookingId: {
    type.Schema.Types.ObjectId,
    ref: 'MentalHealthBooking'
  },
  
  // Journal Content
  title: {
    type,
    required,
    trim,
    maxlength: 200
  },
  content: {
    type,
    required,
    maxlength: 10000
  },
  
  // Mood Tracking
  mood: {
    type,
    enum: ['very_happy', 'happy', 'neutral', 'sad', 'very_sad', 'anxious', 'stressed', 'calm', 'energetic', 'tired']
  },
  moodScore: {
    type,
    min: 1,
    max: 10
  },
  
  // Tags & Categories
  tags: [{
    type,
    enum: ['anxiety', 'depression', 'stress', 'relationships', 'work', 'family', 'health', 'gratitude', 'goals', 'reflection', 'trauma', 'recovery']
  }],
  
  // Privacy & Sharing
  isPrivate: {
    type,
    default},
  shareWithTherapist: {
    type,
    default},
  
  // Prompts (for guided journaling)
  prompt: {
    type,
    maxlength: 500
  },
  promptCategory: {
    type,
    enum: ['gratitude', 'reflection', 'goals', 'challenge', 'achievement', 'emotional_checkin', 'mindfulness']
  },
  
  // Analytics
  wordCount: {
    type,
    default: 0
  },
  readingTime: {
    type, // in seconds
    default: 0
  },
  
  // Encryption metadata
  isEncrypted: {
    type,
    default},
  encryptionVersion: {
    type,
    default: 'v1'
  },
  
  // Timestamps
  entryDate: {
    type,
    default.now,
    index},
  updatedAt: {
    type,
    default.now
  }
}, {
  timestamps,
  toJSON: { virtuals},
  toObject: { virtuals}
});

// Virtual for formatted date
mentalHealthJournalSchema.virtual('formattedDate').get(function() {
  return this.entryDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for mood emoji
mentalHealthJournalSchema.virtual('moodEmoji').get(function() {
  const moodMap = {
    'very_happy': '😊',
    'happy': '😄',
    'neutral': '😐',
    'sad': '😔',
    'very_sad': '😢',
    'anxious': '😰',
    'stressed': '😫',
    'calm': '😌',
    'energetic': '⚡',
    'tired': '😴'
  };
  return moodMap[this.mood] || '📝';
});

// Virtual for mood label
mentalHealthJournalSchema.virtual('moodLabel').get(function() {
  const labelMap = {
    'very_happy': 'Very Happy',
    'happy': 'Happy',
    'neutral': 'Neutral',
    'sad': 'Sad',
    'very_sad': 'Very Sad',
    'anxious': 'Anxious',
    'stressed': 'Stressed',
    'calm': 'Calm',
    'energetic': 'Energetic',
    'tired': 'Tired'
  };
  return labelMap[this.mood] || 'Unknown';
});

// Indexes for performance
mentalHealthJournalSchema.index({ userId: 1, entryDate: -1 });
mentalHealthJournalSchema.index({ userId: 1, mood: 1 });
mentalHealthJournalSchema.index({ userId: 1, tags: 1 });
mentalHealthJournalSchema.index({ userId: 1, shareWithTherapist: 1 });

// Pre-save middleware
mentalHealthJournalSchema.pre('save', function(next) {
  // Update word count
  if (this.content) {
    this.wordCount = this.content.split(/\s+/).filter(word => word.length > 0).length;
    this.readingTime = Math.ceil(this.wordCount / 200); // 200 words per minute
  }
  
  this.updatedAt = new Date();
  next();
});

// Static methods
mentalHealthJournalSchema.statics = {
  // Get journal entries for a user with pagination
  async getUserEntries(userId, page = 1, limit = 20, filters = {}) {
    const query = { userId };
    
    if (filters.mood) query.mood = filters.mood;
    if (filters.tag) query.tags = filters.tag;
    if (filters.startDate) query.entryDate = { $gteDate(filters.startDate) };
    if (filters.endDate) {
      query.entryDate = { ...query.entryDate, $lteDate(filters.endDate) };
    }
    if (filters.search) {
      query.$or = [
        { title: { $regex.search, $options: 'i' } },
        { content: { $regex.search, $options: 'i' } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const [entries, total] = await Promise.all([
      this.find(query)
        .sort({ entryDate: -1 })
        .skip(skip)
        .limit(limit)
        .populate('therapistId', 'name specialization profileImage'),
      this.countDocuments(query)
    ]);
    
    return {
      entries,
      pagination: {
        page,
        limit,
        total,
        pages.ceil(total / limit)
      }
    };
  },
  
  // Get mood trends for a user
  async getMoodTrends(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const entries = await this.find({
      userId,
      entryDate: { $gte},
      mood: { $ne}
    }).sort({ entryDate: 1 });
    
    // Aggregate mood data by day
    const trends = {};
    entries.forEach(entry => {
      const date = entry.entryDate.toISOString().split('T')[0];
      if (!trends[date]) {
        trends[date] = {
          moods: [],
          entries: 0
        };
      }
      trends[date].moods.push(entry.moodScore || 0);
      trends[date].entries++;
    });
    
    // Calculate average mood per day
    const result = Object.keys(trends).map(date => ({
      date,
      averageMood[date].moods.reduce((a, b) => a + b, 0) / trends[date].moods.length,
      entries[date].entries
    }));
    
    return result;
  },
  
  // Get tags frequency for a user
  async getTagFrequency(userId) {
    const result = await this.aggregate([
      { $match: { userId.Types.ObjectId(userId) } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    return result;
  }
};

// Instance methods
mentalHealthJournalSchema.methods = {
  // Add tags
  addTags(newTags) {
    const uniqueTags = [...new Set([...this.tags, ...newTags])];
    this.tags = uniqueTags;
    return this.save();
  },
  
  // Remove tags
  removeTags(tagsToRemove) {
    this.tags = this.tags.filter(tag => !tagsToRemove.includes(tag));
    return this.save();
  },
  
  // Share with therapist
  shareWithTherapist() {
    this.shareWithTherapist = true;
    return this.save();
  },
  
  // Check if entry belongs to user
  belongsToUser(userId) {
    return this.userId.toString() === userId.toString();
  }
};

// Soft delete (optional)
mentalHealthJournalSchema.plugin(require('mongoose-delete'), {
  deletedAt,
  overrideMethods: 'all'
});

const MentalHealthJournal = mongoose.model('MentalHealthJournal', mentalHealthJournalSchema);

module.exports = MentalHealthJournal;


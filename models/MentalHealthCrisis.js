const mongoose = require('mongoose');

const mentalHealthCrisisSchema = new mongoose.Schema({
  userId: {
    type.Schema.Types.ObjectId,
    ref: 'User',
    required,
    index},
  
  // Crisis Details
  crisisType: {
    type,
    enum: [
      'suicidal_thoughts',
      'self_harm',
      'panic_attack',
      'severe_anxiety',
      'trauma_trigger',
      'psychotic_episode',
      'substance_abuse',
      'domestic_violence',
      'grief_crisis',
      'relationship_crisis',
      'financial_crisis',
      'other'
    ],
    required},
  severity: {
    type,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  description: {
    type,
    required,
    maxlength: 1000
  },
  
  // Location Info
  location: {
    address,
    city,
    state,
    country,
    coordinates: {
      lat,
      lng}
  },
  
  // Emergency Contact
  emergencyContact: {
    name,
    relationship,
    phone,
    email,
    isNotified: {
      type,
      default}
  },
  
  // Crisis Response
  respondedBy: {
    type.Schema.Types.ObjectId,
    ref: 'User'
  },
  responderRole: {
    type,
    enum: ['therapist', 'admin', 'helpline', 'emergency_services']
  },
  responseTime,
  resolutionTime,
  resolutionNotes,
  
  // Helpline Details
  helplineCalled: {
    type,
    default},
  helplineName,
  helplineNumber,
  helplineNotes,
  
  // Emergency Services
  emergencyServicesCalled: {
    type,
    default},
  emergencyServiceType: {
    type,
    enum: ['ambulance', 'police', 'fire', 'rescue']
  },
  emergencyServiceNotes,
  incidentNumber,
  
  // Follow-up
  followUpRequired: {
    type,
    default},
  followUpDate,
  followUpNotes,
  followUpCompleted: {
    type,
    default},
  
  // Status
  status: {
    type,
    enum: ['reported', 'in_progress', 'resolved', 'escalated', 'closed'],
    default: 'reported'
  },
  escalatedTo: {
    type,
    enum: ['supervisor', 'admin', 'crisis_team', 'emergency_services']
  },
  
  // Privacy
  isAnonymous: {
    type,
    default},
  anonymousId, // For tracking anonymous reports
  
  // Safety Plan
  safetyPlan: {
    copingStrategies: [String],
    supportNetwork: [String],
    emergencyContacts: [{
      name,
      relationship,
      phone}],
    triggers: [String],
    warningSigns: [String]
  },
  
  // Analytics
  platform: {
    type,
    enum: ['web', 'mobile', 'helpline', 'chat'],
    default: 'web'
  },
  source: {
    type,
    enum: ['self_report', 'therapist', 'family', 'friend', 'stranger', 'helpline', 'chat'],
    default: 'self_report'
  }
}, {
  timestamps});

// Indexes
mentalHealthCrisisSchema.index({ userId: 1, createdAt: -1 });
mentalHealthCrisisSchema.index({ status: 1, severity: 1 });
mentalHealthCrisisSchema.index({ crisisType: 1, status: 1 });
mentalHealthCrisisSchema.index({ createdAt: -1 });
mentalHealthCrisisSchema.index({ 'location.city': 1 });

// Virtuals
mentalHealthCrisisSchema.virtual('severityLabel').get(function() {
  const labels = {
    'low': 'Low Risk',
    'medium': 'Medium Risk',
    'high': 'High Risk',
    'critical': 'Critical - Immediate Attention Required'
  };
  return labels[this.severity] || 'Unknown';
});

mentalHealthCrisisSchema.virtual('statusLabel').get(function() {
  const labels = {
    'reported': 'Reported',
    'in_progress': 'In Progress',
    'resolved': 'Resolved',
    'escalated': 'Escalated',
    'closed': 'Closed'
  };
  return labels[this.status] || 'Unknown';
});

mentalHealthCrisisSchema.virtual('responseTimeMinutes').get(function() {
  if (!this.responseTime) return null;
  const diff = (this.responseTime - this.createdAt) / (1000 * 60);
  return Math.round(diff);
});

mentalHealthCrisisSchema.virtual('resolutionTimeMinutes').get(function() {
  if (!this.resolutionTime) return null;
  const diff = (this.resolutionTime - this.createdAt) / (1000 * 60);
  return Math.round(diff);
});

// Static methods
mentalHealthCrisisSchema.statics = {
  // Get active crises
  async getActiveCrises() {
    return this.find({
      status: { $in: ['reported', 'in_progress'] }
    }).sort({ severity: -1, createdAt: 1 });
  },
  
  // Get crises by severity
  async getBySeverity(severity, limit = 50) {
    return this.find({ severity })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('userId', 'name email phone');
  },
  
  // Get crisis stats for admin
  async getStats(startDate, endDate) {
    const match = {};
    if (startDate) match.createdAt = { $gteDate(startDate) };
    if (endDate) match.createdAt = { ...match.createdAt, $lteDate(endDate) };
    
    const stats = await this.aggregate([
      { $match},
      {
        $group: {
          _id,
          total: { $sum: 1 },
          bySeverity: {
            $push: '$severity'
          },
          byStatus: {
            $push: '$status'
          },
          byType: {
            $push: '$crisisType'
          },
          avgResponseTime: { $avg: '$responseTimeMinutes' },
          avgResolutionTime: { $avg: '$resolutionTimeMinutes' }
        }
      }
    ]);
    
    if (stats.length === 0) return null;
    
    const result = stats[0];
    return {
      total.total,
      severity._countByField(result.bySeverity),
      status._countByField(result.byStatus),
      types._countByField(result.byType),
      avgResponseTime.round(result.avgResponseTime || 0),
      avgResolutionTime.round(result.avgResolutionTime || 0)
    };
  },
  
  // Helper to count by field
  _countByField(arr) {
    const counts = {};
    arr.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    return counts;
  },
  
  // Get crisis trends over time
  async getTrends(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return this.aggregate([
      { $match: { createdAt: { $gte} } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            severity: '$severity'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);
  }
};

// Instance methods
mentalHealthCrisisSchema.methods = {
  // Update severity based on description keywords
  autoAssessSeverity() {
    const keywords = {
      critical: ['suicide', 'kill', 'death', 'dying', 'emergency', 'immediate'],
      high: ['self harm', 'hurt', 'bleeding', 'unconscious', 'severe'],
      medium: ['anxiety', 'panic', 'crying', 'distressed'],
      low: ['worried', 'upset', 'sad', 'stressed']
    };
    
    const text = this.description.toLowerCase();
    let severity = 'low';
    
    for (const [level, words] of Object.entries(keywords)) {
      if (words.some(word => text.includes(word))) {
        severity = level;
        break;
      }
    }
    
    this.severity = severity;
    return this;
  },
  
  // Escalate crisis
  escalate(reason, escalatedTo = 'supervisor') {
    this.status = 'escalated';
    this.escalatedTo = escalatedTo;
    this.resolutionNotes = (this.resolutionNotes || '') + `\nEscalated: ${reason}`;
    return this.save();
  },
  
  // Resolve crisis
  resolve(resolutionNotes) {
    this.status = 'resolved';
    this.resolutionTime = new Date();
    if (resolutionNotes) {
      this.resolutionNotes = (this.resolutionNotes || '') + `\nResolution: ${resolutionNotes}`;
    }
    return this.save();
  }
};

// Pre-save middleware
mentalHealthCrisisSchema.pre('save', function(next) {
  // Auto-assess severity if not set
  if (!this.isModified('severity') && this.severity === 'medium') {
    this.autoAssessSeverity();
  }
  
  // Set response time if being responded
  if (this.isModified('respondedBy') && this.respondedBy) {
    this.responseTime = new Date();
  }
  
  next();
});

const MentalHealthCrisis = mongoose.model('MentalHealthCrisis', mentalHealthCrisisSchema);

module.exports = MentalHealthCrisis;


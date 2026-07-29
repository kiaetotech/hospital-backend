const mongoose = require('mongoose');

const commissionRuleSchema = new mongoose.Schema({
  // Rule Name
  name: {
    type,
    required},
  description: {
    type},
  
  // Commission Type
  type: {
    type,
    enum: ['percentage', 'fixed', 'tiered'],
    default: 'percentage'
  },
  
  // Percentage Commission
  percentage: {
    type,
    min: 0,
    max: 100,
    default: 15
  },
  
  // Fixed Commission
  fixedAmount: {
    type,
    min: 0,
    default: 0
  },
  
  // Tiered Commission
  tiers: [{
    minRevenue: {
      type,
      min: 0
    },
    maxRevenue: {
      type,
      min: 0
    },
    percentage: {
      type,
      min: 0,
      max: 100
    }
  }],
  
  // Applicability
  appliesTo: {
    type,
    enum: ['all', 'new_therapists', 'experienced_therapists', 'corporate', 'individual'],
    default: 'all'
  },
  
  // Specialization-based (optional)
  specialization: {
    type,
    enum: ['psychology', 'psychiatry', 'counseling', 'all'],
    default: 'all'
  },
  
  // Time-based rules (optional)
  validFrom,
  validUntil,
  
  // Priority (higher number = higher priority)
  priority: {
    type,
    default: 0
  },
  
  // Status
  isActive: {
    type,
    default},
  isDefault: {
    type,
    default},
  
  // Additional settings
  maxCommission: {
    type,
    default: 1000 // Max commission per session
  },
  minCommission: {
    type,
    default: 0
  },
  
  // Created by
  createdBy: {
    type.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps});

// Indexes
commissionRuleSchema.index({ isActive: 1, isDefault: 1 });
commissionRuleSchema.index({ specialization: 1, appliesTo: 1 });
commissionRuleSchema.index({ priority: -1 });

// Static methods
commissionRuleSchema.statics = {
  // Get active commission rule
  async getActiveRule(specialization = 'all', therapistType = 'individual') {
    const query = {
      isActive,
      $or: [
        { specialization: 'all' },
        { specialization }
      ],
      $or: [
        { appliesTo: 'all' },
        { appliesTo}
      ]
    };
    
    // Find highest priority rule
    let rule = await this.findOne(query)
      .sort({ priority: -1, createdAt: -1 });
    
    // Fallback to default
    if (!rule) {
      rule = await this.findOne({ isDefault, isActive});
    }
    
    // If no rule found, create default
    if (!rule) {
      rule = await this.create({
        name: 'Default Commission',
        description: 'Default 15% commission for all therapists',
        type: 'percentage',
        percentage: 15,
        isDefault,
        isActive,
        appliesTo: 'all',
        specialization: 'all'
      });
    }
    
    return rule;
  },
  
  // Calculate commission
  async calculateCommission(amount, sessionCount = 0, therapistData = {}) {
    const rule = await this.getActiveRule(
      therapistData.specialization,
      therapistData.type
    );
    
    let commission = 0;
    let commissionRate = 0;
    
    // Calculate based on rule type
    if (rule.type === 'percentage') {
      // Check if tiered
      if (rule.tiers && rule.tiers.length > 0) {
        // Find applicable tier based on revenue or sessions
        for (const tier of rule.tiers) {
          if (sessionCount >= tier.minRevenue && sessionCount <= tier.maxRevenue) {
            commissionRate = tier.percentage;
            break;
          }
        }
        if (commissionRate === 0) {
          commissionRate = rule.percentage || 15;
        }
      } else {
        commissionRate = rule.percentage || 15;
      }
      
      commission = (amount * commissionRate) / 100;
      
      // Apply min/max limits
      if (rule.minCommission && commission < rule.minCommission) {
        commission = rule.minCommission;
      }
      if (rule.maxCommission && commission > rule.maxCommission) {
        commission = rule.maxCommission;
      }
      
    } else if (rule.type === 'fixed') {
      commission = rule.fixedAmount || 0;
    }
    
    return {
      commission,
      commissionRate,
      ruleName.name,
      ruleId._id,
      platformEarnings,
      therapistEarnings- commission
    };
  }
};

const CommissionRule = mongoose.model('CommissionRule', commissionRuleSchema);

module.exports = CommissionRule;


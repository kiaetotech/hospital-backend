// D:\hospital backend\ai-core\agents\operations\CRMAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');

class CRMAgent extends BaseAgent {
  constructor(providerManager) {
    super(
      {
        name: 'CRM Agent',
        role: AgentRole.CRM,
        capabilities: [
          {
            name: 'track_customer',
            description: 'Track customer activity and engagement',
            priority: 1,
            estimatedLatency: 150,
            requiresAuth: true
          },
          {
            name: 'score_lead',
            description: 'Score and qualify leads',
            priority: 2,
            estimatedLatency: 200,
            requiresAuth: true
          },
          {
            name: 'segment_customers',
            description: 'Segment customers by behavior and preferences',
            priority: 2,
            estimatedLatency: 250,
            requiresAuth: true
          },
          {
            name: 'predict_churn',
            description: 'Predict customer churn risk',
            priority: 2,
            estimatedLatency: 300,
            requiresAuth: true
          }
        ]
      },
      providerManager
    );

    this.customers = [];
    this.leads = [];
    this.initializeData();
  }

  initializeData() {
    this.customers = [
      {
        id: 'c1',
        name: 'Amit Sharma',
        email: 'amit@email.com',
        phone: '9876543210',
        city: 'Mumbai',
        totalBookings: 12,
        totalSpent: 45000,
        lastVisit: new Date('2026-07-20'),
        preferences: ['Cardiology', 'Orthopedics'],
        loyaltyTier: 'Gold',
        engagementScore: 85
      },
      {
        id: 'c2',
        name: 'Priya Patel',
        email: 'priya@email.com',
        phone: '9876543211',
        city: 'Delhi',
        totalBookings: 5,
        totalSpent: 12000,
        lastVisit: new Date('2026-07-15'),
        preferences: ['Dermatology', 'Wellness'],
        loyaltyTier: 'Silver',
        engagementScore: 60
      },
      {
        id: 'c3',
        name: 'Rahul Singh',
        email: 'rahul@email.com',
        phone: '9876543212',
        city: 'Mumbai',
        totalBookings: 1,
        totalSpent: 1500,
        lastVisit: new Date('2026-07-01'),
        preferences: ['General Medicine'],
        loyaltyTier: 'Bronze',
        engagementScore: 25
      }
    ];

    this.leads = [
      {
        id: 'l1',
        name: 'Sneha Reddy',
        email: 'sneha@email.com',
        phone: '9876543213',
        source: 'Website',
        status: 'Qualified',
        score: 75,
        createdAt: new Date('2026-07-10'),
        updatedAt: new Date('2026-07-15')
      },
      {
        id: 'l2',
        name: 'Vikram Mehta',
        email: 'vikram@email.com',
        phone: '9876543214',
        source: 'Referral',
        status: 'New',
        score: 40,
        createdAt: new Date('2026-07-18'),
        updatedAt: new Date('2026-07-18')
      }
    ];
  }

  async execute(request) {
    this.setStatus(AgentStatus.BUSY);
    this.setCurrentTask(request.task);

    try {
      if (!this.validateRequest(request)) {
        throw new Error('Invalid request: missing required fields or capabilities');
      }

      var task = request.task;
      var payload = request.payload;
      this.log('Executing task: ' + task, 'info');

      var result;

      if (task.includes('track') || task.includes('customer')) {
        result = await this.trackCustomer(payload);
      } else if (task.includes('score') || task.includes('lead')) {
        result = await this.scoreLead(payload);
      } else if (task.includes('segment')) {
        result = await this.segmentCustomers(payload);
      } else if (task.includes('churn')) {
        result = await this.predictChurn(payload);
      } else {
        result = await this.handleComplexQuery(task, payload);
      }

      this.setStatus(AgentStatus.IDLE);
      this.setCurrentTask(null);

      return {
        success: true,
        data: result,
        sourceAgent: this.id,
        processingTime: Date.now() - new Date().getTime()
      };

    } catch (error) {
      this.setStatus(AgentStatus.IDLE);
      this.setCurrentTask(null);
      return this.handleError(error, request);
    }
  }

  async trackCustomer(payload) {
    var customerId = payload.customerId;
    var customerData = payload.customerData;

    if (customerId) {
      var customer = this.customers.find(function(c) { return c.id === customerId; });
      if (!customer) {
        throw new Error('Customer not found');
      }

      return {
        customer: customer,
        activitySummary: {
          totalBookings: customer.totalBookings,
          totalSpent: customer.totalSpent,
          loyaltyTier: customer.loyaltyTier,
          engagementScore: customer.engagementScore,
          lastVisit: customer.lastVisit
        }
      };
    }

    if (customerData) {
      var newCustomer = {
        id: 'c' + Date.now(),
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        city: customerData.city,
        totalBookings: 0,
        totalSpent: 0,
        lastVisit: new Date(),
        preferences: customerData.preferences || [],
        loyaltyTier: 'Bronze',
        engagementScore: 0
      };

      this.customers.push(newCustomer);
      return {
        customer: newCustomer,
        message: 'Customer added successfully'
      };
    }

    return {
      customers: this.customers,
      total: this.customers.length
    };
  }

  async scoreLead(payload) {
    var leadId = payload.leadId;
    var leadData = payload.leadData;

    if (leadId) {
      var lead = this.leads.find(function(l) { return l.id === leadId; });
      if (!lead) {
        throw new Error('Lead not found');
      }

      return {
        lead: lead,
        score: lead.score,
        status: lead.status
      };
    }

    if (leadData) {
      var score = 0;

      var sourceScores = {
        'Referral': 20,
        'Website': 10,
        'Social Media': 8,
        'Email Campaign': 5,
        'Other': 3
      };
      score += sourceScores[leadData.source] || 5;

      if (leadData.name) score += 10;
      if (leadData.email) score += 10;
      if (leadData.phone) score += 10;

      if (leadData.interests) {
        score += leadData.interests.length * 5;
      }

      var newLead = {
        id: 'l' + Date.now(),
        name: leadData.name,
        email: leadData.email,
        phone: leadData.phone,
        source: leadData.source || 'Other',
        status: 'New',
        score: Math.min(score, 100),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.leads.push(newLead);
      return {
        lead: newLead,
        message: 'Lead scored successfully'
      };
    }

    return {
      leads: this.leads,
      total: this.leads.length,
      qualifiedLeads: this.leads.filter(function(l) { return l.status === 'Qualified'; }).length
    };
  }

  async segmentCustomers(payload) {
    var segmentBy = payload.segmentBy;

    var bronzeCustomers = this.customers.filter(function(c) { return c.loyaltyTier === 'Bronze'; });
    var silverCustomers = this.customers.filter(function(c) { return c.loyaltyTier === 'Silver'; });
    var goldCustomers = this.customers.filter(function(c) { return c.loyaltyTier === 'Gold'; });
    var platinumCustomers = this.customers.filter(function(c) { return c.loyaltyTier === 'Platinum'; });

    var highEngagement = this.customers.filter(function(c) { return c.engagementScore > 70; });
    var mediumEngagement = this.customers.filter(function(c) { return c.engagementScore > 40 && c.engagementScore <= 70; });
    var lowEngagement = this.customers.filter(function(c) { return c.engagementScore <= 40; });

    var byCity = {};
    this.customers.forEach(function(c) {
      if (!byCity[c.city]) {
        byCity[c.city] = [];
      }
      byCity[c.city].push(c);
    });

    var segments = {
      byLoyalty: {
        Bronze: bronzeCustomers,
        Silver: silverCustomers,
        Gold: goldCustomers,
        Platinum: platinumCustomers
      },
      byCity: byCity,
      byEngagement: {
        High: highEngagement,
        Medium: mediumEngagement,
        Low: lowEngagement
      }
    };

    return {
      segments: segments,
      summary: {
        totalCustomers: this.customers.length,
        goldCustomers: goldCustomers.length,
        highEngagement: highEngagement.length
      }
    };
  }

  async predictChurn(payload) {
    var customerId = payload.customerId;

    var targetCustomers = this.customers;
    if (customerId) {
      targetCustomers = this.customers.filter(function(c) { return c.id === customerId; });
    }

    var self = this;
    var churnAnalysis = targetCustomers.map(function(c) {
      var riskScore = 0;
      var riskFactors = [];

      var daysSinceLastVisit = Math.floor((Date.now() - c.lastVisit.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastVisit > 30) {
        riskScore += 20;
        riskFactors.push('No visit in last 30 days');
      }
      if (daysSinceLastVisit > 60) {
        riskScore += 20;
        riskFactors.push('No visit in last 60 days');
      }

      if (c.engagementScore < 30) {
        riskScore += 20;
        riskFactors.push('Low engagement score');
      }

      if (c.totalBookings < 2) {
        riskScore += 15;
        riskFactors.push('Few total bookings');
      }

      if (c.totalSpent < 1000) {
        riskScore += 10;
        riskFactors.push('Low spending');
      }

      var riskLevel = riskScore > 60 ? 'High' : riskScore > 30 ? 'Medium' : 'Low';

      return {
        customerId: c.id,
        customerName: c.name,
        riskScore: riskScore,
        riskLevel: riskLevel,
        riskFactors: riskFactors,
        recommendations: self.getChurnRecommendations(riskLevel, riskFactors)
      };
    });

    return {
      churnAnalysis: churnAnalysis,
      summary: {
        highRisk: churnAnalysis.filter(function(c) { return c.riskLevel === 'High'; }).length,
        mediumRisk: churnAnalysis.filter(function(c) { return c.riskLevel === 'Medium'; }).length,
        lowRisk: churnAnalysis.filter(function(c) { return c.riskLevel === 'Low'; }).length
      }
    };
  }

  getChurnRecommendations(riskLevel, riskFactors) {
    var recommendations = [];

    if (riskLevel === 'High') {
      recommendations.push('Immediate outreach required');
      recommendations.push('Offer special discount or incentive');
      recommendations.push('Personalized re-engagement campaign');
    }

    if (riskFactors.some(function(f) { return f.includes('30 days'); })) {
      recommendations.push('Send re-engagement email');
      recommendations.push('Offer free health checkup');
    }

    if (riskFactors.some(function(f) { return f.includes('engagement'); })) {
      recommendations.push('Increase communication frequency');
      recommendations.push('Send personalized health tips');
    }

    if (riskFactors.some(function(f) { return f.includes('bookings'); })) {
      recommendations.push('New user onboarding campaign');
      recommendations.push('Offer welcome discount');
    }

    return recommendations.length ? recommendations : ['Continue regular engagement'];
  }

  async handleComplexQuery(task, payload) {
    var prompt = 'Task: ' + task + '\n' +
      'Payload: ' + JSON.stringify(payload) + '\n\n' +
      'CRM Data: ' + JSON.stringify(this.customers) + '\n' +
      'Leads: ' + JSON.stringify(this.leads) + '\n\n' +
      'Please analyze the query and provide a recommendation.';

    var response = await this.providerManager.generate(prompt);

    return {
      aiResponse: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed
    };
  }

  getRequiredCapability(task) {
    if (task.includes('track') || task.includes('customer')) {
      return 'track_customer';
    }
    if (task.includes('score') || task.includes('lead')) {
      return 'score_lead';
    }
    if (task.includes('segment')) {
      return 'segment_customers';
    }
    if (task.includes('churn')) {
      return 'predict_churn';
    }
    return null;
  }
}

module.exports = { CRMAgent };
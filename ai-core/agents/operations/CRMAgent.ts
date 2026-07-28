// D:\hospital backend\ai-core\agents\operations\CRMAgent.ts

import { AgentRole, AgentStatus, AgentRequest, AgentResponse } from '../../../shared/types/AgentTypes';
import { BaseAgent } from '../base/BaseAgent';
import { ProviderManager } from '../../providers/ProviderManager';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  totalBookings: number;
  totalSpent: number;
  lastVisit: Date;
  preferences: string[];
  loyaltyTier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  engagementScore: number;
}

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CRMAgent extends BaseAgent {
  private customers: Customer[] = [];
  private leads: Lead[] = [];

  constructor(providerManager: ProviderManager) {
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

    this.initializeData();
  }

  private initializeData(): void {
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

  async execute(request: AgentRequest): Promise<AgentResponse> {
    this.setStatus(AgentStatus.BUSY);
    this.setCurrentTask(request.task);

    try {
      if (!this.validateRequest(request)) {
        throw new Error('Invalid request: Missing required fields or capabilities');
      }

      const { task, payload } = request;
      this.log(`Executing task: ${task}`, 'info');

      let result: any;

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
      this.setCurrentTask(undefined);

      return {
        success: true,
        data: result,
        sourceAgent: this.id,
        processingTime: Date.now() - new Date().getTime()
      };

    } catch (error) {
      this.setStatus(AgentStatus.IDLE);
      this.setCurrentTask(undefined);
      return this.handleError(error, request);
    }
  }

  private async trackCustomer(payload: any): Promise<any> {
    const { customerId, customerData } = payload;

    if (customerId) {
      const customer = this.customers.find(c => c.id === customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      return {
        customer,
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
      // Add new customer
      const newCustomer: Customer = {
        id: `c${Date.now()}`,
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

  private async scoreLead(payload: any): Promise<any> {
    const { leadId, leadData } = payload;

    if (leadId) {
      const lead = this.leads.find(l => l.id === leadId);
      if (!lead) {
        throw new Error('Lead not found');
      }

      return {
        lead,
        score: lead.score,
        status: lead.status
      };
    }

    if (leadData) {
      // Calculate lead score based on various factors
      let score = 0;
      
      // Source scoring
      const sourceScores: Record<string, number> = {
        'Referral': 20,
        'Website': 10,
        'Social Media': 8,
        'Email Campaign': 5,
        'Other': 3
      };
      score += sourceScores[leadData.source] || 5;

      // Add points for complete information
      if (leadData.name) score += 10;
      if (leadData.email) score += 10;
      if (leadData.phone) score += 10;

      // Add points for specific interests
      if (leadData.interests) {
        score += leadData.interests.length * 5;
      }

      const newLead: Lead = {
        id: `l${Date.now()}`,
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
      qualifiedLeads: this.leads.filter(l => l.status === 'Qualified').length
    };
  }

  private async segmentCustomers(payload: any): Promise<any> {
    const { segmentBy } = payload;

    const segments: any = {
      byLoyalty: {
        Bronze: this.customers.filter(c => c.loyaltyTier === 'Bronze'),
        Silver: this.customers.filter(c => c.loyaltyTier === 'Silver'),
        Gold: this.customers.filter(c => c.loyaltyTier === 'Gold'),
        Platinum: this.customers.filter(c => c.loyaltyTier === 'Platinum')
      },
      byCity: {} as Record<string, Customer[]>,
      byEngagement: {
        High: this.customers.filter(c => c.engagementScore > 70),
        Medium: this.customers.filter(c => c.engagementScore > 40 && c.engagementScore <= 70),
        Low: this.customers.filter(c => c.engagementScore <= 40)
      }
    };

    // Group by city
    this.customers.forEach(c => {
      if (!segments.byCity[c.city]) {
        segments.byCity[c.city] = [];
      }
      segments.byCity[c.city].push(c);
    });

    return {
      segments,
      summary: {
        totalCustomers: this.customers.length,
        goldCustomers: segments.byLoyalty.Gold.length,
        highEngagement: segments.byEngagement.High.length
      }
    };
  }

  private async predictChurn(payload: any): Promise<any> {
    const { customerId } = payload;

    let targetCustomers = this.customers;
    if (customerId) {
      targetCustomers = this.customers.filter(c => c.id === customerId);
    }

    const churnAnalysis = targetCustomers.map(c => {
      // Calculate churn risk based on various factors
      let riskScore = 0;
      let riskFactors: string[] = [];

      // Factor 1: Days since last visit
      const daysSinceLastVisit = Math.floor((Date.now() - c.lastVisit.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastVisit > 30) {
        riskScore += 20;
        riskFactors.push('No visit in last 30 days');
      }
      if (daysSinceLastVisit > 60) {
        riskScore += 20;
        riskFactors.push('No visit in last 60 days');
      }

      // Factor 2: Engagement score
      if (c.engagementScore < 30) {
        riskScore += 20;
        riskFactors.push('Low engagement score');
      }

      // Factor 3: Total bookings
      if (c.totalBookings < 2) {
        riskScore += 15;
        riskFactors.push('Few total bookings');
      }

      // Factor 4: Total spent
      if (c.totalSpent < 1000) {
        riskScore += 10;
        riskFactors.push('Low spending');
      }

      const riskLevel = riskScore > 60 ? 'High' : riskScore > 30 ? 'Medium' : 'Low';

      return {
        customerId: c.id,
        customerName: c.name,
        riskScore,
        riskLevel,
        riskFactors,
        recommendations: this.getChurnRecommendations(riskLevel, riskFactors)
      };
    });

    return {
      churnAnalysis,
      summary: {
        highRisk: churnAnalysis.filter(c => c.riskLevel === 'High').length,
        mediumRisk: churnAnalysis.filter(c => c.riskLevel === 'Medium').length,
        lowRisk: churnAnalysis.filter(c => c.riskLevel === 'Low').length
      }
    };
  }

  private getChurnRecommendations(riskLevel: string, riskFactors: string[]): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'High') {
      recommendations.push('Immediate outreach required');
      recommendations.push('Offer special discount or incentive');
      recommendations.push('Personalized re-engagement campaign');
    }

    if (riskFactors.some(f => f.includes('30 days'))) {
      recommendations.push('Send re-engagement email');
      recommendations.push('Offer free health checkup');
    }

    if (riskFactors.some(f => f.includes('engagement'))) {
      recommendations.push('Increase communication frequency');
      recommendations.push('Send personalized health tips');
    }

    if (riskFactors.some(f => f.includes('bookings'))) {
      recommendations.push('New user onboarding campaign');
      recommendations.push('Offer welcome discount');
    }

    return recommendations.length ? recommendations : ['Continue regular engagement'];
  }

  private async handleComplexQuery(task: string, payload: any): Promise<any> {
    const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      CRM Data:
      Customers: ${JSON.stringify(this.customers)}
      Leads: ${JSON.stringify(this.leads)}
      
      Please analyze the query and provide a recommendation.
    `;

    const response = await this.providerManager.generate(prompt);
    
    return {
      aiResponse: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed
    };
  }

  protected getRequiredCapability(task: string): string | null {
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
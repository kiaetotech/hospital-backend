// D:\hospital backend\ai-core\agents\operations\CorporateHealthAgent.ts

import { AgentRole, AgentStatus, AgentRequest, AgentResponse } from '../../../shared/types/AgentTypes';
import { BaseAgent } from '../base/BaseAgent';
import { ProviderManager } from '../../providers/ProviderManager';

interface CorporatePlan {
  id: string;
  name: string;
  provider: string;
  type: 'Comprehensive' | 'Basic' | 'Custom' | 'Enterprise';
  coverage: {
    hospitalCoverage: boolean;
    doctorConsultation: boolean;
    diagnosticTests: boolean;
    wellnessPrograms: boolean;
    mentalHealth: boolean;
    dental: boolean;
    vision: boolean;
    maternity: boolean;
    emergency: boolean;
  };
  pricing: {
    perEmployeeAnnual: number;
    perEmployeeMonthly: number;
    minEmployees: number;
    maxEmployees: number;
  };
  network: {
    hospitals: number;
    doctors: number;
    labs: number;
    wellnessCenters: number;
  };
  features: string[];
  insurancePartner: string;
}

interface CompanyEnrollment {
  id: string;
  companyName: string;
  employeeCount: number;
  planId: string;
  planName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  status: 'Pending' | 'Approved' | 'Active' | 'Suspended' | 'Completed';
  totalAnnualCost: number;
  totalMonthlyCost: number;
  enrolledAt: Date;
  expiresAt: Date;
}

export class CorporateHealthAgent extends BaseAgent {
  private corporatePlans: CorporatePlan[] = [];
  private enrollments: CompanyEnrollment[] = [];

  constructor(providerManager: ProviderManager) {
    super(
      {
        name: 'Corporate Health Agent',
        role: AgentRole.CORPORATE,
        capabilities: [
          {
            name: 'get_corporate_plans',
            description: 'Get corporate health plans for companies',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth: false
          },
          {
            name: 'compare_corporate_plans',
            description: 'Compare corporate health plans',
            priority: 1,
            estimatedLatency: 250,
            requiresAuth: false
          },
          {
            name: 'enroll_employees',
            description: 'Enroll employees in corporate health plan',
            priority: 2,
            estimatedLatency: 300,
            requiresAuth: true
          },
          {
            name: 'get_enrollment_status',
            description: 'Get enrollment status for a company',
            priority: 2,
            estimatedLatency: 150,
            requiresAuth: true
          }
        ]
      },
      providerManager
    );

    this.initializeCorporatePlans();
  }

  private initializeCorporatePlans(): void {
    this.corporatePlans = [
      {
        id: 'cp1',
        name: 'Enterprise Health Plus',
        provider: 'ICICI Lombard',
        type: 'Enterprise',
        coverage: {
          hospitalCoverage: true,
          doctorConsultation: true,
          diagnosticTests: true,
          wellnessPrograms: true,
          mentalHealth: true,
          dental: true,
          vision: true,
          maternity: true,
          emergency: true
        },
        pricing: {
          perEmployeeAnnual: 12000,
          perEmployeeMonthly: 1000,
          minEmployees: 50,
          maxEmployees: 10000
        },
        network: {
          hospitals: 6000,
          doctors: 15000,
          labs: 3000,
          wellnessCenters: 500
        },
        features: [
          'Cashless hospitalization',
          '24/7 telemedicine',
          'Annual health checkup',
          'Mental wellness support',
          'Maternity coverage',
          'Dental & vision coverage'
        ],
        insurancePartner: 'ICICI Lombard'
      },
      {
        id: 'cp2',
        name: 'Corporate Health Shield',
        provider: 'HDFC Ergo',
        type: 'Comprehensive',
        coverage: {
          hospitalCoverage: true,
          doctorConsultation: true,
          diagnosticTests: true,
          wellnessPrograms: true,
          mentalHealth: true,
          dental: false,
          vision: false,
          maternity: true,
          emergency: true
        },
        pricing: {
          perEmployeeAnnual: 8000,
          perEmployeeMonthly: 667,
          minEmployees: 25,
          maxEmployees: 5000
        },
        network: {
          hospitals: 4500,
          doctors: 10000,
          labs: 2000,
          wellnessCenters: 300
        },
        features: [
          'Cashless hospitalization',
          '24/7 telemedicine',
          'Annual health checkup',
          'Mental wellness support',
          'Maternity coverage'
        ],
        insurancePartner: 'HDFC Ergo'
      },
      {
        id: 'cp3',
        name: 'Startup Health Plan',
        provider: 'Bajaj Allianz',
        type: 'Basic',
        coverage: {
          hospitalCoverage: true,
          doctorConsultation: true,
          diagnosticTests: true,
          wellnessPrograms: false,
          mentalHealth: false,
          dental: false,
          vision: false,
          maternity: false,
          emergency: true
        },
        pricing: {
          perEmployeeAnnual: 5000,
          perEmployeeMonthly: 417,
          minEmployees: 5,
          maxEmployees: 100
        },
        network: {
          hospitals: 2500,
          doctors: 5000,
          labs: 1000,
          wellnessCenters: 100
        },
        features: [
          'Cashless hospitalization',
          '24/7 telemedicine',
          'Basic health checkup',
          'Emergency coverage'
        ],
        insurancePartner: 'Bajaj Allianz'
      },
      {
        id: 'cp4',
        name: 'Premium Corporate Care',
        provider: 'Star Health',
        type: 'Comprehensive',
        coverage: {
          hospitalCoverage: true,
          doctorConsultation: true,
          diagnosticTests: true,
          wellnessPrograms: true,
          mentalHealth: true,
          dental: true,
          vision: true,
          maternity: true,
          emergency: true
        },
        pricing: {
          perEmployeeAnnual: 15000,
          perEmployeeMonthly: 1250,
          minEmployees: 100,
          maxEmployees: 20000
        },
        network: {
          hospitals: 8000,
          doctors: 20000,
          labs: 4000,
          wellnessCenters: 700
        },
        features: [
          'Cashless hospitalization',
          '24/7 telemedicine',
          'Comprehensive health checkup',
          'Mental wellness support',
          'Maternity coverage',
          'Dental & vision coverage',
          'International coverage'
        ],
        insurancePartner: 'Star Health'
      },
      {
        id: 'cp5',
        name: 'SME Health Saver',
        provider: 'SBI General',
        type: 'Custom',
        coverage: {
          hospitalCoverage: true,
          doctorConsultation: true,
          diagnosticTests: true,
          wellnessPrograms: true,
          mentalHealth: false,
          dental: false,
          vision: false,
          maternity: false,
          emergency: true
        },
        pricing: {
          perEmployeeAnnual: 6500,
          perEmployeeMonthly: 542,
          minEmployees: 10,
          maxEmployees: 500
        },
        network: {
          hospitals: 3500,
          doctors: 8000,
          labs: 1500,
          wellnessCenters: 200
        },
        features: [
          'Cashless hospitalization',
          '24/7 telemedicine',
          'Annual health checkup',
          'Emergency coverage'
        ],
        insurancePartner: 'SBI General'
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

      if (task.includes('get') || task.includes('list')) {
        result = await this.getCorporatePlans(payload);
      } else if (task.includes('compare')) {
        result = await this.comparePlans(payload);
      } else if (task.includes('enroll') || task.includes('onboard')) {
        result = await this.enrollEmployees(payload);
      } else if (task.includes('status') || task.includes('enrollment')) {
        result = await this.getEnrollmentStatus(payload);
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

  private async getCorporatePlans(payload: any): Promise<any> {
    const { type, minEmployees, maxBudget } = payload;

    let results = this.corporatePlans;

    if (type) {
      results = results.filter(p => p.type === type);
    }

    if (minEmployees) {
      results = results.filter(p => p.pricing.minEmployees <= minEmployees);
    }

    if (maxBudget) {
      results = results.filter(p => p.pricing.perEmployeeAnnual <= maxBudget);
    }

    return {
      plans: results,
      total: results.length,
      query: { type, minEmployees, maxBudget },
      recommendation: results.length > 0 ? `Recommended: ${results[0].name}` : 'No matching plans found'
    };
  }

  private async comparePlans(payload: any): Promise<any> {
    const { planIds } = payload;

    let selectedPlans = this.corporatePlans;
    if (planIds && planIds.length > 0) {
      selectedPlans = this.corporatePlans.filter(p => planIds.includes(p.id));
    }

    const comparison = selectedPlans.map(plan => ({
      name: plan.name,
      provider: plan.provider,
      type: plan.type,
      perEmployeeCost: `₹${plan.pricing.perEmployeeAnnual}`,
      minEmployees: plan.pricing.minEmployees,
      coverage: Object.entries(plan.coverage)
        .filter(([_, covered]) => covered)
        .map(([key]) => key)
        .join(', '),
      network: {
        hospitals: plan.network.hospitals,
        doctors: plan.network.doctors,
        labs: plan.network.labs
      },
      features: plan.features.slice(0, 3).join(', '),
      insurancePartner: plan.insurancePartner
    }));

    return {
      comparison,
      totalPlans: comparison.length,
      bestValue: comparison.reduce((a, b) => {
        const aCost = parseInt(a.perEmployeeCost.replace('₹', ''));
        const bCost = parseInt(b.perEmployeeCost.replace('₹', ''));
        return aCost < bCost ? a : b;
      }, comparison[0])
    };
  }

  private async enrollEmployees(payload: any): Promise<any> {
    const { companyName, employeeCount, planId, contactPerson, contactEmail, contactPhone, planType } = payload;

    if (!companyName || !employeeCount || !planId) {
      throw new Error('Company name, employee count, and plan ID are required');
    }

    const plan = this.corporatePlans.find(p => p.id === planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    if (employeeCount < plan.pricing.minEmployees) {
      throw new Error(`Minimum ${plan.pricing.minEmployees} employees required for this plan`);
    }

    const totalAnnualCost = employeeCount * plan.pricing.perEmployeeAnnual;
    const totalMonthlyCost = employeeCount * plan.pricing.perEmployeeMonthly;

    const enrollmentId = `ENR${Date.now()}`;

    const enrollment: CompanyEnrollment = {
      id: enrollmentId,
      companyName,
      employeeCount,
      planId: plan.id,
      planName: plan.name,
      contactPerson,
      contactEmail,
      contactPhone,
      status: 'Pending',
      totalAnnualCost,
      totalMonthlyCost,
      enrolledAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    };

    this.enrollments.push(enrollment);

    return {
      enrollmentId,
      company: {
        name: companyName,
        employeeCount,
        contactPerson,
        contactEmail,
        contactPhone
      },
      plan: {
        name: plan.name,
        type: plan.type,
        provider: plan.provider,
        insurancePartner: plan.insurancePartner
      },
      cost: {
        perEmployeeAnnual: `₹${plan.pricing.perEmployeeAnnual}`,
        perEmployeeMonthly: `₹${plan.pricing.perEmployeeMonthly}`,
        totalAnnualCost: `₹${totalAnnualCost.toLocaleString()}`,
        totalMonthlyCost: `₹${totalMonthlyCost.toLocaleString()}`
      },
      status: 'Pending',
      nextSteps: [
        'Complete KYC for company',
        'Upload employee list',
        'Review and sign agreement',
        'Pay first month premium'
      ],
      timestamp: new Date().toISOString()
    };
  }

  private async getEnrollmentStatus(payload: any): Promise<any> {
    const { enrollmentId, companyName } = payload;

    let targetEnrollments = this.enrollments;

    if (enrollmentId) {
      const enrollment = this.enrollments.find(e => e.id === enrollmentId);
      if (!enrollment) {
        throw new Error('Enrollment not found');
      }
      targetEnrollments = [enrollment];
    }

    if (companyName) {
      targetEnrollments = this.enrollments.filter(e => 
        e.companyName.toLowerCase().includes(companyName.toLowerCase())
      );
    }

    return {
      enrollments: targetEnrollments,
      total: targetEnrollments.length,
      summary: {
        active: targetEnrollments.filter(e => e.status === 'Active').length,
        pending: targetEnrollments.filter(e => e.status === 'Pending').length,
        totalEmployees: targetEnrollments.reduce((sum, e) => sum + e.employeeCount, 0)
      }
    };
  }

  private async handleComplexQuery(task: string, payload: any): Promise<any> {
    const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Available Corporate Plans: ${JSON.stringify(this.corporatePlans)}
      Enrollments: ${JSON.stringify(this.enrollments)}
      
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
    if (task.includes('get') || task.includes('list')) {
      return 'get_corporate_plans';
    }
    if (task.includes('compare')) {
      return 'compare_corporate_plans';
    }
    if (task.includes('enroll') || task.includes('onboard')) {
      return 'enroll_employees';
    }
    if (task.includes('status') || task.includes('enrollment')) {
      return 'get_enrollment_status';
    }
    return null;
  }
}
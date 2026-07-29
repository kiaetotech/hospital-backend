// D:\hospital backend\ai-core\agents\operations\CorporateHealthAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');

class CorporateHealthAgent extends BaseAgent {
  constructor(providerManager) {
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
          }
        ]
      },
      providerManager
    );

    this.corporatePlans = [];
    this.initializeCorporatePlans();
  }

  initializeCorporatePlans() {
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
          wellnessPrograms: false,
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

      if (task.includes('get') || task.includes('list')) {
        result = await this.getCorporatePlans(payload);
      } else if (task.includes('compare')) {
        result = await this.comparePlans(payload);
      } else if (task.includes('enroll') || task.includes('onboard')) {
        result = await this.enrollEmployees(payload);
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

  async getCorporatePlans(payload) {
    var type = payload.type;
    var minEmployees = payload.minEmployees;
    var maxBudget = payload.maxBudget;

    var results = this.corporatePlans.slice();

    if (type) {
      results = results.filter(function(p) { return p.type === type; });
    }

    if (minEmployees) {
      results = results.filter(function(p) { return p.pricing.minEmployees <= minEmployees; });
    }

    if (maxBudget) {
      results = results.filter(function(p) { return p.pricing.perEmployeeAnnual <= maxBudget; });
    }

    return {
      plans: results,
      total: results.length,
      query: { type: type, minEmployees: minEmployees, maxBudget: maxBudget },
      recommendation: results.length > 0 ? 'Recommended: ' + results[0].name : 'No matching plans found'
    };
  }

  async comparePlans(payload) {
    var planIds = payload.planIds;

    var selectedPlans = this.corporatePlans;
    if (planIds && planIds.length > 0) {
      selectedPlans = this.corporatePlans.filter(function(p) { return planIds.includes(p.id); });
    }

    var comparison = selectedPlans.map(function(plan) {
      var coverageEntries = Object.entries(plan.coverage);
      var coveredItems = [];
      for (var i = 0; i < coverageEntries.length; i++) {
        if (coverageEntries[i][1]) {
          coveredItems.push(coverageEntries[i][0]);
        }
      }

      return {
        name: plan.name,
        provider: plan.provider,
        type: plan.type,
        perEmployeeCost: '₹' + plan.pricing.perEmployeeAnnual,
        minEmployees: plan.pricing.minEmployees,
        coverage: coveredItems.join(', '),
        network: {
          hospitals: plan.network.hospitals,
          doctors: plan.network.doctors,
          labs: plan.network.labs
        },
        features: plan.features.slice(0, 3).join(', '),
        insurancePartner: plan.insurancePartner
      };
    });

    var bestValue = comparison.reduce(function(a, b) {
      var aCost = parseInt(a.perEmployeeCost.replace('₹', ''));
      var bCost = parseInt(b.perEmployeeCost.replace('₹', ''));
      return aCost < bCost ? a : b;
    }, comparison[0]);

    return {
      comparison: comparison,
      totalPlans: selectedPlans.length,
      bestValue: bestValue
    };
  }

  async enrollEmployees(payload) {
    var companyName = payload.companyName;
    var employeeCount = payload.employeeCount;
    var planId = payload.planId;
    var contactPerson = payload.contactPerson;
    var contactEmail = payload.contactEmail;
    var contactPhone = payload.contactPhone;

    if (!companyName || !employeeCount || !planId) {
      throw new Error('Company name, employee count, and plan ID are required');
    }

    var plan = this.corporatePlans.find(function(p) { return p.id === planId; });
    if (!plan) {
      throw new Error('Plan not found');
    }

    if (employeeCount < plan.pricing.minEmployees) {
      throw new Error('Minimum ' + plan.pricing.minEmployees + ' employees required for this plan');
    }

    var totalAnnualCost = employeeCount * plan.pricing.perEmployeeAnnual;
    var totalMonthlyCost = employeeCount * plan.pricing.perEmployeeMonthly;
    var enrollmentId = 'ENR' + Date.now();

    return {
      enrollmentId: enrollmentId,
      company: {
        name: companyName,
        employeeCount: employeeCount,
        contactPerson: contactPerson,
        contactEmail: contactEmail,
        contactPhone: contactPhone
      },
      plan: {
        name: plan.name,
        type: plan.type,
        provider: plan.provider,
        insurancePartner: plan.insurancePartner
      },
      cost: {
        perEmployeeAnnual: '₹' + plan.pricing.perEmployeeAnnual,
        perEmployeeMonthly: '₹' + plan.pricing.perEmployeeMonthly,
        totalAnnualCost: '₹' + totalAnnualCost.toLocaleString(),
        totalMonthlyCost: '₹' + totalMonthlyCost.toLocaleString()
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

  async handleComplexQuery(task, payload) {
    var prompt = 'Task: ' + task + '\n' +
      'Payload: ' + JSON.stringify(payload) + '\n\n' +
      'Available Corporate Plans: ' + JSON.stringify(this.corporatePlans) + '\n\n' +
      'Please analyze the query and provide a recommendation.';

    var response = await this.providerManager.generate(prompt);

    return {
      aiResponse: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed
    };
  }

  getRequiredCapability(task) {
    if (task.includes('get') || task.includes('list')) {
      return 'get_corporate_plans';
    }
    if (task.includes('compare')) {
      return 'compare_corporate_plans';
    }
    if (task.includes('enroll') || task.includes('onboard')) {
      return 'enroll_employees';
    }
    return null;
  }
}

module.exports = { CorporateHealthAgent };
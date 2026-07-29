// D:\hospital backend\ai-core\agents\operations\FinanceAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');

class FinanceAgent extends BaseAgent {
  constructor(providerManager) {
    super(
      {
        name: 'Finance Agent',
        role: AgentRole.FINANCE,
        capabilities: [
          {
            name: 'calculate_emi',
            description: 'Calculate EMI for health expenses',
            priority: 1,
            estimatedLatency: 150,
            requiresAuth: false
          },
          {
            name: 'compare_emi_partners',
            description: 'Compare EMI partners and plans',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth: false
          },
          {
            name: 'apply_loan',
            description: 'Apply for health EMI loan',
            priority: 1,
            estimatedLatency: 300,
            requiresAuth: true
          },
          {
            name: 'check_eligibility',
            description: 'Check eligibility for EMI',
            priority: 2,
            estimatedLatency: 200,
            requiresAuth: false
          }
        ]
      },
      providerManager
    );

    this.partners = [];
    this.applications = new Map();
    this.initializePartners();
  }

  initializePartners() {
    this.partners = [
      {
        id: 'emi1',
        name: 'HDFC Bank',
        type: 'Bank',
        logo: 'hdfc.png',
        rating: 4.8,
        plans: [
          {
            name: '0% EMI on Health',
            type: '0% EMI',
            minAmount: 5000,
            maxAmount: 500000,
            tenures: [3, 6, 9, 12],
            interestRate: 0,
            processingFee: 99,
            applicableOn: ['Hospital', 'Lab', 'Pharmacy']
          },
          {
            name: 'Flexi Health EMI',
            type: 'Low Interest',
            minAmount: 10000,
            maxAmount: 1000000,
            tenures: [6, 12, 18, 24],
            interestRate: 10,
            processingFee: 199,
            applicableOn: ['Hospital', 'Lab', 'Doctor']
          }
        ],
        eligibility: {
          minCreditScore: 700,
          minIncome: 25000,
          ageRange: { min: 21, max: 60 },
          requiredDocuments: ['ID Proof', 'Address Proof', 'Income Proof']
        },
        processingTime: '24-48 hours'
      },
      {
        id: 'emi2',
        name: 'ICICI Bank',
        type: 'Bank',
        logo: 'icici.png',
        rating: 4.7,
        plans: [
          {
            name: 'Health EMI Saver',
            type: '0% EMI',
            minAmount: 3000,
            maxAmount: 300000,
            tenures: [3, 6, 9, 12],
            interestRate: 0,
            processingFee: 99,
            applicableOn: ['Hospital', 'Lab', 'Pharmacy', 'Doctor']
          },
          {
            name: 'Super Health EMI',
            type: 'No Cost EMI',
            minAmount: 15000,
            maxAmount: 750000,
            tenures: [6, 12, 18],
            interestRate: 0,
            processingFee: 0,
            applicableOn: ['Hospital', 'Lab']
          }
        ],
        eligibility: {
          minCreditScore: 680,
          minIncome: 20000,
          ageRange: { min: 21, max: 58 },
          requiredDocuments: ['ID Proof', 'Address Proof']
        },
        processingTime: '24 hours'
      },
      {
        id: 'emi3',
        name: 'Bajaj Finserv',
        type: 'NBFC',
        logo: 'bajaj.png',
        rating: 4.6,
        plans: [
          {
            name: 'Health EMI Card',
            type: '0% EMI',
            minAmount: 2000,
            maxAmount: 200000,
            tenures: [3, 6, 9],
            interestRate: 0,
            processingFee: 99,
            applicableOn: ['Hospital', 'Lab', 'Pharmacy']
          },
          {
            name: 'Flexi Health Loan',
            type: 'Low Interest',
            minAmount: 20000,
            maxAmount: 1500000,
            tenures: [6, 12, 18, 24, 36],
            interestRate: 12,
            processingFee: 299,
            applicableOn: ['Hospital', 'Lab', 'Doctor', 'Pharmacy']
          }
        ],
        eligibility: {
          minCreditScore: 650,
          minIncome: 18000,
          ageRange: { min: 21, max: 65 },
          requiredDocuments: ['ID Proof', 'Address Proof', 'Income Proof', 'Bank Statement']
        },
        processingTime: '48-72 hours'
      },
      {
        id: 'emi4',
        name: 'Kotak Mahindra Bank',
        type: 'Bank',
        logo: 'kotak.png',
        rating: 4.5,
        plans: [
          {
            name: 'Kotak Health EMI',
            type: '0% EMI',
            minAmount: 5000,
            maxAmount: 400000,
            tenures: [3, 6, 9],
            interestRate: 0,
            processingFee: 99,
            applicableOn: ['Hospital', 'Lab']
          }
        ],
        eligibility: {
          minCreditScore: 700,
          minIncome: 30000,
          ageRange: { min: 21, max: 60 },
          requiredDocuments: ['ID Proof', 'Address Proof', 'Income Proof']
        },
        processingTime: '24 hours'
      },
      {
        id: 'emi5',
        name: 'Paytm Health Finance',
        type: 'Fintech',
        logo: 'paytm.png',
        rating: 4.4,
        plans: [
          {
            name: 'Paytm Health EMI',
            type: '0% EMI',
            minAmount: 2000,
            maxAmount: 150000,
            tenures: [3, 6, 9],
            interestRate: 0,
            processingFee: 49,
            applicableOn: ['Hospital', 'Lab', 'Pharmacy', 'Doctor']
          },
          {
            name: 'Paytm Flexi Health',
            type: 'Low Interest',
            minAmount: 5000,
            maxAmount: 500000,
            tenures: [6, 12, 18],
            interestRate: 11,
            processingFee: 149,
            applicableOn: ['Hospital', 'Lab', 'Doctor']
          }
        ],
        eligibility: {
          minCreditScore: 600,
          minIncome: 15000,
          ageRange: { min: 18, max: 60 },
          requiredDocuments: ['ID Proof', 'Address Proof']
        },
        processingTime: '4-8 hours'
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

      if (task.includes('calculate') || task.includes('emi')) {
        result = await this.calculateEMI(payload);
      } else if (task.includes('compare')) {
        result = await this.comparePartners(payload);
      } else if (task.includes('apply')) {
        result = await this.applyLoan(payload);
      } else if (task.includes('eligibility')) {
        result = await this.checkEligibility(payload);
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

  async calculateEMI(payload) {
    var amount = payload.amount;
    var tenure = payload.tenure;
    var partnerId = payload.partnerId;

    if (!amount || !tenure) {
      throw new Error('Amount and tenure are required');
    }

    var targetPartners = this.partners;
    if (partnerId) {
      targetPartners = this.partners.filter(function(p) { return p.id === partnerId; });
    }

    var quotes = [];

    for (var i = 0; i < targetPartners.length; i++) {
      var partner = targetPartners[i];
      for (var j = 0; j < partner.plans.length; j++) {
        var plan = partner.plans[j];
        if (amount < plan.minAmount || amount > plan.maxAmount) continue;
        if (!plan.tenures.includes(tenure)) continue;

        var totalInterest = amount * (plan.interestRate / 100) * (tenure / 12);
        var processingFee = plan.processingFee;
        var totalAmount = amount + totalInterest + processingFee;
        var monthlyPayment = totalAmount / tenure;

        quotes.push({
          amount: amount,
          tenure: tenure,
          interestRate: plan.interestRate,
          processingFee: processingFee,
          totalInterest: totalInterest,
          totalAmount: totalAmount,
          monthlyPayment: Math.round(monthlyPayment * 100) / 100,
          partner: partner.name,
          planType: plan.type
        });
      }
    }

    quotes.sort(function(a, b) { return a.totalAmount - b.totalAmount; });

    return {
      quotes: quotes,
      summary: {
        bestDeal: quotes[0] || null,
        totalOptions: quotes.length,
        amount: amount,
        tenure: tenure
      }
    };
  }

  async comparePartners(payload) {
    var amount = payload.amount;
    var tenure = payload.tenure;
    var planType = payload.planType;

    var results = this.partners.map(function(partner) {
      var availablePlans = partner.plans.filter(function(plan) {
        var amountCheck = amount >= plan.minAmount && amount <= plan.maxAmount;
        var tenureCheck = plan.tenures.includes(tenure);
        var typeCheck = planType ? plan.type === planType : true;
        return amountCheck && tenureCheck && typeCheck;
      });

      var mappedPlans = availablePlans.map(function(plan) {
        var totalPayment = amount + (amount * plan.interestRate / 100) * (tenure / 12) + plan.processingFee;
        var monthlyPayment = totalPayment / tenure;
        return {
          name: plan.name,
          type: plan.type,
          minAmount: plan.minAmount,
          maxAmount: plan.maxAmount,
          tenures: plan.tenures,
          interestRate: plan.interestRate,
          processingFee: plan.processingFee,
          applicableOn: plan.applicableOn,
          monthlyPayment: Math.round(monthlyPayment * 100) / 100,
          totalPayment: Math.round(totalPayment * 100) / 100
        };
      });

      return {
        id: partner.id,
        name: partner.name,
        type: partner.type,
        logo: partner.logo,
        rating: partner.rating,
        eligibility: partner.eligibility,
        processingTime: partner.processingTime,
        availablePlans: mappedPlans
      };
    });

    results = results.filter(function(p) { return p.availablePlans.length > 0; });

    return {
      partners: results,
      totalPartners: results.length,
      query: { amount: amount, tenure: tenure, planType: planType }
    };
  }

  async applyLoan(payload) {
    var userId = payload.userId;
    var partnerId = payload.partnerId;
    var amount = payload.amount;
    var tenure = payload.tenure;
    var purpose = payload.purpose;
    var userDetails = payload.userDetails;

    if (!userId || !partnerId || !amount || !tenure) {
      throw new Error('User ID, Partner ID, Amount, and Tenure are required');
    }

    var partner = this.partners.find(function(p) { return p.id === partnerId; });
    if (!partner) {
      throw new Error('Partner not found');
    }

    var quoteResult = await this.calculateEMI({ amount: amount, tenure: tenure, partnerId: partnerId });
    var bestQuote = quoteResult.quotes[0];

    if (!bestQuote) {
      throw new Error('No suitable plan found for the given amount and tenure');
    }

    var eligibility = await this.checkEligibility({
      userId: userId,
      partnerId: partnerId,
      amount: amount,
      userDetails: userDetails
    });

    if (!eligibility.eligible) {
      throw new Error('Not eligible: ' + eligibility.reason);
    }

    var applicationId = 'LN' + Date.now();

    var application = {
      id: applicationId,
      userId: userId,
      partnerId: partnerId,
      amount: amount,
      tenure: tenure,
      purpose: purpose || 'Medical Expenses',
      status: 'Pending',
      emiAmount: bestQuote.monthlyPayment,
      totalAmount: bestQuote.totalAmount,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.applications.set(applicationId, application);

    return {
      applicationId: applicationId,
      partner: {
        name: partner.name,
        type: partner.type
      },
      plan: {
        type: bestQuote.planType,
        interestRate: bestQuote.interestRate,
        processingFee: bestQuote.processingFee,
        monthlyPayment: bestQuote.monthlyPayment,
        totalAmount: bestQuote.totalAmount
      },
      amount: amount,
      tenure: tenure,
      purpose: purpose || 'Medical Expenses',
      status: 'Pending',
      nextSteps: [
        'Wait for approval (typically 24-48 hours)',
        'Upload required documents',
        'Complete KYC verification'
      ],
      createdAt: new Date().toISOString()
    };
  }

  async checkEligibility(payload) {
    var userId = payload.userId;
    var partnerId = payload.partnerId;
    var amount = payload.amount;
    var userDetails = payload.userDetails;

    if (partnerId) {
      var partner = this.partners.find(function(p) { return p.id === partnerId; });
      if (!partner) {
        throw new Error('Partner not found');
      }

      var eligibility = partner.eligibility;
      var eligible = true;
      var reason = '';

      if (!userDetails) {
        eligible = false;
        reason = 'User details required';
      } else {
        var creditScore = userDetails.creditScore || 700;
        if (creditScore < eligibility.minCreditScore) {
          eligible = false;
          reason = 'Credit score ' + creditScore + ' is below minimum ' + eligibility.minCreditScore;
        }

        var income = userDetails.monthlyIncome || 25000;
        if (income < eligibility.minIncome) {
          eligible = false;
          reason = 'Income ' + income + ' is below minimum ' + eligibility.minIncome;
        }

        var age = userDetails.age || 30;
        if (age < eligibility.ageRange.min || age > eligibility.ageRange.max) {
          eligible = false;
          reason = 'Age ' + age + ' is outside range ' + eligibility.ageRange.min + '-' + eligibility.ageRange.max;
        }
      }

      return {
        eligible: eligible,
        reason: reason,
        partner: {
          name: partner.name,
          requiredDocuments: partner.eligibility.requiredDocuments,
          processingTime: partner.processingTime
        }
      };
    }

    var results = this.partners.map(function(p) {
      var elig = p.eligibility;
      var isEligible = true;
      var reasonText = '';

      if (userDetails) {
        var cs = userDetails.creditScore || 700;
        if (cs < elig.minCreditScore) {
          isEligible = false;
          reasonText = 'Credit score ' + cs + ' below ' + elig.minCreditScore;
        }
      }

      return {
        partner: p.name,
        type: p.type,
        eligible: isEligible,
        reason: reasonText,
        processingTime: p.processingTime,
        requiredDocuments: p.eligibility.requiredDocuments
      };
    });

    return {
      allPartners: results,
      eligiblePartners: results.filter(function(r) { return r.eligible; }),
      totalEligible: results.filter(function(r) { return r.eligible; }).length
    };
  }

  async handleComplexQuery(task, payload) {
    var prompt = 'Task: ' + task + '\n' +
      'Payload: ' + JSON.stringify(payload) + '\n\n' +
      'Available EMI Partners: ' + JSON.stringify(this.partners) + '\n\n' +
      'Please analyze the query and provide a recommendation.';

    var response = await this.providerManager.generate(prompt);

    return {
      aiResponse: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed
    };
  }

  getRequiredCapability(task) {
    if (task.includes('calculate') || task.includes('emi')) {
      return 'calculate_emi';
    }
    if (task.includes('compare')) {
      return 'compare_emi_partners';
    }
    if (task.includes('apply')) {
      return 'apply_loan';
    }
    if (task.includes('eligibility')) {
      return 'check_eligibility';
    }
    return null;
  }
}

module.exports = { FinanceAgent };

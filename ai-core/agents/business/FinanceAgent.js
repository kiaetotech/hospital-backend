// D:\hospital backend\ai-core\agents\operations\FinanceAgent.ts

const { AgentRole, AgentStatus, AgentRequest, AgentResponse } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');
const { ProviderManager } = require('../../providers/ProviderManager');

;
    requiredDocuments[];
  };
  processingTime;
}







export class FinanceAgent extends BaseAgent {
  private partners[] = [];
  private applications<string, LoanApplication> = new Map();

  constructor(providerManager) {
    super(
      {
        name: 'Finance Agent',
        role.FINANCE,
        capabilities: [
          {
            name: 'calculate_emi',
            description: 'Calculate EMI for health expenses',
            priority: 1,
            estimatedLatency: 150,
            requiresAuth},
          {
            name: 'compare_emi_partners',
            description: 'Compare EMI partners and plans',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth},
          {
            name: 'apply_loan',
            description: 'Apply for health EMI loan',
            priority: 1,
            estimatedLatency: 300,
            requiresAuth},
          {
            name: 'check_eligibility',
            description: 'Check eligibility for EMI',
            priority: 2,
            estimatedLatency: 200,
            requiresAuth}
        ]
      },
      providerManager
    );

    this.initializePartners();
  }

  private initializePartners(){
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

  async execute(request)<AgentResponse> {
    this.setStatus(AgentStatus.BUSY);
    this.setCurrentTask(request.task);

    try {
      if (!this.validateRequest(request)) {
        throw new Error('Invalid requestrequired fields or capabilities');
      }

      const { task, payload } = request;
      this.log(`Executing task: ${task}`, 'info');

      let result;

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
      this.setCurrentTask(undefined);

      return {
        success,
        data,
        sourceAgent.id,
        processingTime.now() - new Date().getTime()
      };

    } catch (error) {
      this.setStatus(AgentStatus.IDLE);
      this.setCurrentTask(undefined);
      return this.handleError(error, request);
    }
  }

  private async calculateEMI(payload)<any> {
    const { amount, tenure, partnerId } = payload;

    if (!amount || !tenure) {
      throw new Error('Amount and tenure are required');
    }

    let targetPartners = this.partners;
    if (partnerId) {
      targetPartners = this.partners.filter(p => p.id === partnerId);
    }

    const quotes[] = [];

    for (const partner of targetPartners) {
      for (const plan of partner.plans) {
        if (amount < plan.minAmount || amount > plan.maxAmount) continue;
        if (!plan.tenures.includes(tenure)) continue;

        const totalInterest = amount * (plan.interestRate / 100) * (tenure / 12);
        const processingFee = plan.processingFee;
        const totalAmount = amount + totalInterest + processingFee;
        const monthlyPayment = totalAmount / tenure;

        quotes.push({
          amount,
          tenure,
          interestRate.interestRate,
          processingFee,
          totalInterest,
          totalAmount,
          monthlyPayment.round(monthlyPayment * 100) / 100,
          partner.name,
          planType.type
        });
      }
    }

    // Sort by total amount (best deal first)
    quotes.sort((a, b) => a.totalAmount - b.totalAmount);

    return {
      quotes,
      summary: {
        bestDeal[0] || null,
        totalOptions.length,
        amount,
        tenure
      }
    };
  }

  private async comparePartners(payload)<any> {
    const { amount, tenure, planType } = payload;

    let results = this.partners.map(partner => {
      const availablePlans = partner.plans.filter(plan => {
        const amountCheck = amount >= plan.minAmount && amount <= plan.maxAmount;
        const tenureCheck = plan.tenures.includes(tenure);
        const typeCheck = planType ? plan.type === planType ;
        return amountCheck && tenureCheck && typeCheck;
      });

      return {
        ...partner,
        availablePlans.map(plan => ({
          ...plan,
          monthlyPayment.round(((amount + (amount * plan.interestRate / 100) * (tenure / 12) + plan.processingFee) / tenure) * 100) / 100,
          totalPayment.round((amount + (amount * plan.interestRate / 100) * (tenure / 12) + plan.processingFee) * 100) / 100
        }))
      };
    });

    // Filter partners with at least one available plan
    results = results.filter(p => p.availablePlans.length > 0);

    return {
      partners,
      totalPartners.length,
      query: { amount, tenure, planType }
    };
  }

  private async applyLoan(payload)<any> {
    const { userId, partnerId, amount, tenure, purpose, userDetails } = payload;

    if (!userId || !partnerId || !amount || !tenure) {
      throw new Error('User ID, Partner ID, Amount, and Tenure are required');
    }

    const partner = this.partners.find(p => p.id === partnerId);
    if (!partner) {
      throw new Error('Partner not found');
    }

    // Calculate EMI
    const quoteResult = await this.calculateEMI({ amount, tenure, partnerId });
    const bestQuote = quoteResult.quotes[0];

    if (!bestQuote) {
      throw new Error('No suitable plan found for the given amount and tenure');
    }

    // Check eligibility (simplified)
    const eligibility = await this.checkEligibility({
      userId,
      partnerId,
      amount,
      userDetails
    });

    if (!eligibility.eligible) {
      throw new Error(`Not eligible: ${eligibility.reason}`);
    }

    const applicationId = `LN${Date.now()}`;

    const application= {
      id,
      userId,
      partnerId,
      amount,
      tenure,
      purpose|| 'Medical Expenses',
      status: 'Pending',
      emiAmount.monthlyPayment,
      totalAmount.totalAmount,
      createdAtDate(),
      updatedAtDate()
    };

    this.applications.set(applicationId, application);

    return {
      applicationId,
      partner: {
        name.name,
        type.type
      },
      plan: {
        type.planType,
        interestRate.interestRate,
        processingFee.processingFee,
        monthlyPayment.monthlyPayment,
        totalAmount.totalAmount
      },
      amount,
      tenure,
      purpose|| 'Medical Expenses',
      status: 'Pending',
      nextSteps: [
        'Wait for approval (typically 24-48 hours)',
        'Upload required documents',
        'Complete KYC verification'
      ],
      createdAtDate().toISOString()
    };
  }

  private async checkEligibility(payload)<any> {
    const { userId, partnerId, amount, userDetails } = payload;

    if (partnerId) {
      const partner = this.partners.find(p => p.id === partnerId);
      if (!partner) {
        throw new Error('Partner not found');
      }

      // Check eligibility criteria
      const eligibility = partner.eligibility;
      let eligible = true;
      let reason = '';

      // Simulated checks
      if (!userDetails) {
        eligible = false;
        reason = 'User details required';
      } else {
        // Simulated credit score check
        const creditScore = userDetails.creditScore || 700;
        if (creditScore < eligibility.minCreditScore) {
          eligible = false;
          reason = `Credit score ${creditScore} is below minimum ${eligibility.minCreditScore}`;
        }

        // Simulated income check
        const income = userDetails.monthlyIncome || 25000;
        if (income < eligibility.minIncome) {
          eligible = false;
          reason = `Income ${income} is below minimum ${eligibility.minIncome}`;
        }

        // Age check
        const age = userDetails.age || 30;
        if (age < eligibility.ageRange.min || age > eligibility.ageRange.max) {
          eligible = false;
          reason = `Age ${age} is outside range ${eligibility.ageRange.min}-${eligibility.ageRange.max}`;
        }
      }

      return {
        eligible,
        reason,
        partner: {
          name.name,
          requiredDocuments.requiredDocuments,
          processingTime.processingTime
        }
      };
    }

    // Check all partners
    const results = this.partners.map(partner => {
      const eligibility = partner.eligibility;
      let eligible = true;
      let reason = '';

      // Simplified check
      if (userDetails) {
        const creditScore = userDetails.creditScore || 700;
        if (creditScore < eligibility.minCreditScore) {
          eligible = false;
          reason = `Credit score ${creditScore} below ${eligibility.minCreditScore}`;
        }
      }

      return {
        partner.name,
        type.type,
        eligible,
        reason,
        processingTime.processingTime,
        requiredDocuments.requiredDocuments
      };
    });

    return {
      allPartners,
      eligiblePartners.filter(r => r.eligible),
      totalEligible.filter(r => r.eligible).length
    };
  }

  private async handleComplexQuery(task, payload)<any> {
    const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Available EMI Partners: ${JSON.stringify(this.partners)}
      
      Please analyze the query and provide a recommendation.
    `;

    const response = await this.providerManager.generate(prompt);
    
    return {
      aiResponse.content,
      provider.provider,
      tokensUsed.tokensUsed
    };
  }

  protected getRequiredCapability(task)| null {
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




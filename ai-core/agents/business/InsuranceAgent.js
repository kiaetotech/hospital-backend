// D:\hospital backend\ai-core\agents\business\InsuranceAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');

class InsuranceAgent extends BaseAgent {
  constructor(providerManager) {
    super(
      {
        name: 'Insurance Agent',
        role: AgentRole.INSURANCE,
        capabilities: [
          {
            name: 'compare_policies',
            description: 'Compare health insurance policies based on coverage and premium',
            priority: 1,
            estimatedLatency: 300,
            requiresAuth: false
          },
          {
            name: 'check_claim',
            description: 'Check claim eligibility and status',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth: true
          },
          {
            name: 'find_cashless_hospitals',
            description: 'Find hospitals that accept cashless insurance',
            priority: 2,
            estimatedLatency: 150,
            requiresAuth: false
          },
          {
            name: 'estimate_premium',
            description: 'Estimate insurance premium based on age and coverage',
            priority: 2,
            estimatedLatency: 200,
            requiresAuth: false
          }
        ]
      },
      providerManager
    );

    this.policies = [];
    this.claims = new Map();
    this.initializePolicies();
  }

  initializePolicies() {
    this.policies = [
      {
        id: 'pol1',
        provider: 'ICICI Lombard',
        name: 'ICICI Health Shield',
        type: 'Family',
        coverageAmount: 500000,
        premium: 12000,
        cashlessHospitals: ['Apollo Hospital', 'Fortis Hospital', 'Max Hospital'],
        waitingPeriod: 3,
        preExistingCoverage: true,
        maternityCoverage: true,
        criticalIllnessCoverage: true,
        roomRentLimit: 5000,
        coPay: 10,
        networkHospitals: 4500,
        rating: 4.8
      },
      {
        id: 'pol2',
        provider: 'HDFC Ergo',
        name: 'HDFC Health Advantage',
        type: 'Individual',
        coverageAmount: 1000000,
        premium: 18000,
        cashlessHospitals: ['Apollo Hospital', 'AIIMS Delhi', 'Medanta Hospital'],
        waitingPeriod: 2,
        preExistingCoverage: true,
        maternityCoverage: false,
        criticalIllnessCoverage: true,
        roomRentLimit: 8000,
        coPay: 5,
        networkHospitals: 6000,
        rating: 4.7
      },
      {
        id: 'pol3',
        provider: 'Bajaj Allianz',
        name: 'Bajaj Health Care',
        type: 'Family',
        coverageAmount: 750000,
        premium: 15000,
        cashlessHospitals: ['Fortis Hospital', 'Max Hospital', 'Medanta Hospital'],
        waitingPeriod: 3,
        preExistingCoverage: true,
        maternityCoverage: true,
        criticalIllnessCoverage: false,
        roomRentLimit: 6000,
        coPay: 15,
        networkHospitals: 3800,
        rating: 4.5
      },
      {
        id: 'pol4',
        provider: 'Star Health',
        name: 'Star Senior Care',
        type: 'SeniorCitizen',
        coverageAmount: 300000,
        premium: 25000,
        cashlessHospitals: ['Apollo Hospital', 'AIIMS Delhi'],
        waitingPeriod: 6,
        preExistingCoverage: true,
        maternityCoverage: false,
        criticalIllnessCoverage: true,
        roomRentLimit: 4000,
        coPay: 20,
        networkHospitals: 2500,
        rating: 4.3
      },
      {
        id: 'pol5',
        provider: 'SBI General',
        name: 'SBI Health Plus',
        type: 'Individual',
        coverageAmount: 800000,
        premium: 14000,
        cashlessHospitals: ['Fortis Hospital', 'Max Hospital'],
        waitingPeriod: 2,
        preExistingCoverage: true,
        maternityCoverage: false,
        criticalIllnessCoverage: true,
        roomRentLimit: 7000,
        coPay: 10,
        networkHospitals: 5000,
        rating: 4.6
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

      if (task.includes('compare') || task.includes('policy')) {
        result = await this.comparePolicies(payload);
      } else if (task.includes('claim')) {
        result = await this.handleClaim(payload);
      } else if (task.includes('cashless')) {
        result = await this.findCashlessHospitals(payload);
      } else if (task.includes('premium') || task.includes('estimate')) {
        result = await this.estimatePremium(payload);
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

  async comparePolicies(payload) {
    var type = payload.type;
    var coverageRange = payload.coverageRange;
    var maxPremium = payload.maxPremium;
    var minRating = payload.minRating || 0;

    var results = this.policies.slice();

    if (type) {
      results = results.filter(function(p) { return p.type === type; });
    }

    if (coverageRange) {
      results = results.filter(function(p) {
        return p.coverageAmount >= coverageRange.min && p.coverageAmount <= coverageRange.max;
      });
    }

    if (maxPremium) {
      results = results.filter(function(p) { return p.premium <= maxPremium; });
    }

    if (minRating) {
      results = results.filter(function(p) { return p.rating >= minRating; });
    }

    results.sort(function(a, b) { return b.rating - a.rating; });

    results = results.map(function(p) {
      var newP = {};
      var keys = Object.keys(p);
      for (var i = 0; i < keys.length; i++) {
        newP[keys[i]] = p[keys[i]];
      }
      newP.valueScore = Math.round((p.coverageAmount / p.premium) * 100) / 100;
      newP.monthlyPremium = Math.round(p.premium / 12);
      return newP;
    });

    results.sort(function(a, b) { return b.valueScore - a.valueScore; });

    var recommendation = null;
    if (results.length > 0) {
      var bestOverall = results[0];
      var bestValue = results.reduce(function(a, b) { return a.valueScore > b.valueScore ? a : b; }, results[0]);
      recommendation = {
        bestOverall: bestOverall.name,
        bestValue: bestValue.name
      };
    }

    return {
      policies: results,
      total: results.length,
      query: { type: type, coverageRange: coverageRange, maxPremium: maxPremium, minRating: minRating },
      recommendation: recommendation
    };
  }

  async handleClaim(payload) {
    var action = payload.action;
    var data = {};
    var keys = Object.keys(payload);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] !== 'action') {
        data[keys[i]] = payload[keys[i]];
      }
    }

    if (action === 'check') {
      return this.checkClaim(data);
    } else if (action === 'submit') {
      return this.submitClaim(data);
    } else if (action === 'status') {
      return this.getClaimStatus(data);
    }

    throw new Error('Invalid claim action');
  }

  async checkClaim(payload) {
    var policyId = payload.policyId;
    var diagnosis = payload.diagnosis;
    var estimatedCost = payload.estimatedCost;

    var policy = this.policies.find(function(p) { return p.id === policyId; });
    if (!policy) {
      throw new Error('Policy not found');
    }

    var isCovered = this.isTreatmentCovered(diagnosis, policy);
    var estimatedCoverage = isCovered ? Math.min(estimatedCost, policy.coverageAmount) : 0;
    var patientShare = estimatedCoverage > 0 ? Math.max(0, estimatedCost - estimatedCoverage) : estimatedCost;

    return {
      policy: {
        id: policy.id,
        name: policy.name,
        provider: policy.provider,
        coverageAmount: policy.coverageAmount
      },
      diagnosis: diagnosis,
      estimatedCost: estimatedCost,
      isCovered: isCovered,
      estimatedCoverage: estimatedCoverage,
      patientShare: patientShare,
      waitingPeriod: policy.waitingPeriod,
      preExistingCoverage: policy.preExistingCoverage,
      coPay: policy.coPay,
      requiresPreAuthorization: estimatedCost > 50000 || diagnosis.includes('surgery')
    };
  }

  isTreatmentCovered(diagnosis, policy) {
    var criticalIllnessKeywords = ['cancer', 'heart', 'stroke', 'kidney', 'liver'];
    var isCritical = criticalIllnessKeywords.some(function(k) {
      return diagnosis.toLowerCase().includes(k);
    });

    if (isCritical && !policy.criticalIllnessCoverage) {
      return false;
    }

    var maternityKeywords = ['pregnancy', 'delivery', 'maternity'];
    var isMaternity = maternityKeywords.some(function(k) {
      return diagnosis.toLowerCase().includes(k);
    });

    if (isMaternity && !policy.maternityCoverage) {
      return false;
    }

    return true;
  }

  async submitClaim(payload) {
    var policyId = payload.policyId;
    var patientName = payload.patientName;
    var hospital = payload.hospital;
    var diagnosis = payload.diagnosis;
    var treatmentDate = payload.treatmentDate;
    var estimatedCost = payload.estimatedCost;
    var documents = payload.documents;

    var policy = this.policies.find(function(p) { return p.id === policyId; });
    if (!policy) {
      throw new Error('Policy not found');
    }

    var isCashless = policy.cashlessHospitals.some(function(h) {
      return hospital.toLowerCase().includes(h.toLowerCase());
    });

    var claimId = 'CLM' + Date.now();

    var claimStatus = {
      claimId: claimId,
      policyId: policyId,
      patientName: patientName,
      hospital: hospital,
      amount: estimatedCost,
      status: 'Pending',
      decision: 'Under review',
      processedAt: new Date().toISOString()
    };

    this.claims.set(claimId, claimStatus);

    return {
      claimId: claimId,
      status: 'Submitted',
      isCashless: isCashless,
      policy: {
        id: policy.id,
        name: policy.name,
        provider: policy.provider
      },
      patient: {
        name: patientName,
        hospital: hospital
      },
      diagnosis: diagnosis,
      estimatedCost: estimatedCost,
      nextSteps: isCashless
        ? 'Hospital will handle claim processing. Please carry your policy document.'
        : 'Pay at hospital and submit reimbursement claim with all bills.',
      expectedProcessingTime: isCashless ? '24-48 hours' : '7-10 days'
    };
  }

  async getClaimStatus(payload) {
    var claimId = payload.claimId;

    if (!claimId) {
      throw new Error('Claim ID is required');
    }

    var claim = this.claims.get(claimId);
    if (!claim) {
      throw new Error('Claim not found');
    }

    return claim;
  }

  async findCashlessHospitals(payload) {
    var city = payload.city;
    var policyId = payload.policyId;

    var policy = null;
    if (policyId) {
      policy = this.policies.find(function(p) { return p.id === policyId; }) || null;
      if (!policy) {
        throw new Error('Policy not found');
      }
    }

    var cashlessHospitals = policy ? policy.cashlessHospitals : [
      'Apollo Hospital',
      'Fortis Hospital',
      'Max Hospital',
      'Medanta Hospital',
      'AIIMS Delhi'
    ];

    var hospitals = cashlessHospitals.map(function(h) {
      return {
        name: h,
        address: h + ', ' + (city || 'All Cities'),
        cashless: true,
        network: policy ? policy.provider + ' Network' : 'Multiple Networks'
      };
    });

    return {
      hospitals: hospitals,
      total: hospitals.length,
      query: { city: city, policyId: policyId }
    };
  }

  async estimatePremium(payload) {
    var age = payload.age;
    var coverage = payload.coverage;
    var type = payload.type || 'Individual';
    var smoker = payload.smoker || false;

    if (!age || !coverage) {
      throw new Error('Age and coverage amount are required');
    }

    var basePremium = coverage * 0.02;

    if (age < 30) basePremium *= 0.8;
    else if (age < 40) basePremium *= 1.0;
    else if (age < 50) basePremium *= 1.3;
    else if (age < 60) basePremium *= 1.8;
    else basePremium *= 2.5;

    if (type === 'Family') basePremium *= 1.5;
    else if (type === 'SeniorCitizen') basePremium *= 2.0;
    else if (type === 'Corporate') basePremium *= 1.2;

    if (smoker) basePremium *= 1.2;

    var annualPremium = Math.round(basePremium / 100) * 100;
    var monthlyPremium = Math.round(annualPremium / 12);

    var recommended = this.policies.filter(function(p) {
      return p.type === type &&
        p.coverageAmount >= coverage &&
        p.premium <= annualPremium * 1.2;
    });

    return {
      estimatedPremium: {
        annual: annualPremium,
        monthly: monthlyPremium
      },
      factors: {
        age: age,
        coverage: coverage,
        type: type,
        smoker: smoker
      },
      recommendedPolicies: recommended.slice(0, 3),
      tips: [
        'Consider increasing coverage for better protection',
        'Check for family floater plans if adding family members',
        'Compare policies from multiple providers'
      ]
    };
  }

  async handleComplexQuery(task, payload) {
    var prompt = 'Task: ' + task + '\n' +
      'Payload: ' + JSON.stringify(payload) + '\n\n' +
      'Available policies: ' + JSON.stringify(this.policies) + '\n\n' +
      'Please analyze the query and provide a recommendation.';

    var response = await this.providerManager.generate(prompt);

    return {
      aiResponse: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed
    };
  }

  getRequiredCapability(task) {
    if (task.includes('compare') || task.includes('policy')) {
      return 'compare_policies';
    }
    if (task.includes('claim')) {
      return 'check_claim';
    }
    if (task.includes('cashless')) {
      return 'find_cashless_hospitals';
    }
    if (task.includes('premium') || task.includes('estimate')) {
      return 'estimate_premium';
    }
    return null;
  }
}

module.exports = { InsuranceAgent };
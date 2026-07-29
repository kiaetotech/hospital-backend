// D:\hospital backend\ai-core\agents\business\HospitalAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');

class HospitalAgent extends BaseAgent {
  constructor(providerManager) {
    super(
      {
        name: 'Hospital Agent',
        role: AgentRole.HOSPITAL,
        capabilities: [
          {
            name: 'search_hospitals',
            description: 'Search hospitals by location, specialty, or insurance',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth: false
          },
          {
            name: 'compare_hospitals',
            description: 'Compare hospitals based on cost, rating, and availability',
            priority: 2,
            estimatedLatency: 300,
            requiresAuth: false
          },
          {
            name: 'check_beds',
            description: 'Check bed availability in specific hospitals',
            priority: 1,
            estimatedLatency: 100,
            requiresAuth: false
          },
          {
            name: 'estimate_cost',
            description: 'Estimate cost for a procedure at a hospital',
            priority: 2,
            estimatedLatency: 200,
            requiresAuth: false
          }
        ]
      },
      providerManager
    );

    this.hospitals = [];
    this.initializeHospitals();
  }

  initializeHospitals() {
    this.hospitals = [
      {
        id: 'h1',
        name: 'Apollo Hospital',
        city: 'Mumbai',
        specialty: ['Cardiology', 'Orthopedics', 'Neurology'],
        bedsAvailable: 45,
        insuranceAccepted: ['ICICI', 'HDFC', 'Bajaj'],
        rating: 4.8,
        costEstimate: 25000
      },
      {
        id: 'h2',
        name: 'Fortis Hospital',
        city: 'Mumbai',
        specialty: ['Cardiology', 'Oncology', 'Gynecology'],
        bedsAvailable: 32,
        insuranceAccepted: ['ICICI', 'SBI', 'Tata'],
        rating: 4.6,
        costEstimate: 22000
      },
      {
        id: 'h3',
        name: 'AIIMS Delhi',
        city: 'Delhi',
        specialty: ['Cardiology', 'Orthopedics', 'Neurology', 'Oncology'],
        bedsAvailable: 18,
        insuranceAccepted: ['SBI', 'HDFC'],
        rating: 4.9,
        costEstimate: 15000
      },
      {
        id: 'h4',
        name: 'Max Hospital',
        city: 'Delhi',
        specialty: ['Orthopedics', 'Gynecology', 'Dermatology'],
        bedsAvailable: 28,
        insuranceAccepted: ['ICICI', 'Bajaj', 'Tata'],
        rating: 4.5,
        costEstimate: 20000
      },
      {
        id: 'h5',
        name: 'Medanta Hospital',
        city: 'Gurugram',
        specialty: ['Cardiology', 'Neurology', 'Oncology'],
        bedsAvailable: 52,
        insuranceAccepted: ['HDFC', 'ICICI', 'SBI'],
        rating: 4.7,
        costEstimate: 28000
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

      if (task.includes('search') || task.includes('find')) {
        result = await this.searchHospitals(payload);
      } else if (task.includes('compare')) {
        result = await this.compareHospitals(payload);
      } else if (task.includes('bed') || task.includes('availability')) {
        result = await this.checkAvailability(payload);
      } else if (task.includes('cost') || task.includes('estimate')) {
        result = await this.estimateCost(payload);
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

  async searchHospitals(payload) {
    var city = payload.city;
    var specialty = payload.specialty;
    var insurance = payload.insurance;
    var maxResults = payload.maxResults || 10;

    var results = this.hospitals.slice();

    if (city) {
      results = results.filter(function(h) {
        return h.city.toLowerCase().includes(city.toLowerCase());
      });
    }

    if (specialty) {
      results = results.filter(function(h) {
        return h.specialty.some(function(s) {
          return s.toLowerCase().includes(specialty.toLowerCase());
        });
      });
    }

    if (insurance) {
      results = results.filter(function(h) {
        return h.insuranceAccepted.some(function(i) {
          return i.toLowerCase().includes(insurance.toLowerCase());
        });
      });
    }

    results.sort(function(a, b) { return b.rating - a.rating; });
    results = results.slice(0, maxResults);

    return {
      hospitals: results,
      total: results.length,
      query: { city: city, specialty: specialty, insurance: insurance }
    };
  }

  async compareHospitals(payload) {
    var hospitalIds = payload.hospitalIds;
    var criteria = payload.criteria;

    var selectedHospitals = this.hospitals;
    if (hospitalIds && hospitalIds.length > 0) {
      selectedHospitals = this.hospitals.filter(function(h) {
        return hospitalIds.includes(h.id);
      });
    }

    var self = this;
    var comparison = selectedHospitals.map(function(hospital) {
      var score = self.calculateHospitalScore(hospital, criteria);
      return {
        id: hospital.id,
        name: hospital.name,
        city: hospital.city,
        specialty: hospital.specialty,
        bedsAvailable: hospital.bedsAvailable,
        insuranceAccepted: hospital.insuranceAccepted,
        rating: hospital.rating,
        costEstimate: hospital.costEstimate,
        score: score
      };
    });

    comparison.sort(function(a, b) { return b.score - a.score; });

    return {
      hospitals: comparison,
      criteria: criteria
    };
  }

  calculateHospitalScore(hospital, criteria) {
    var score = 0;
    score += (hospital.rating / 5) * 40;
    var bedScore = Math.min(hospital.bedsAvailable / 50, 1);
    score += bedScore * 30;
    var costScore = Math.max(0, 1 - (hospital.costEstimate / 50000));
    score += costScore * 30;
    return Math.round(score);
  }

  async checkAvailability(payload) {
    var hospitalId = payload.hospitalId;
    var specialty = payload.specialty;

    var targetHospital = this.hospitals;
    if (hospitalId) {
      targetHospital = this.hospitals.filter(function(h) {
        return h.id === hospitalId;
      });
    }

    var availability = targetHospital.map(function(h) {
      var hasSpecialty = specialty
        ? h.specialty.some(function(s) {
            return s.toLowerCase().includes(specialty.toLowerCase());
          })
        : true;

      var status = h.bedsAvailable > 10 ? 'Available' : h.bedsAvailable > 0 ? 'Limited' : 'Full';

      return {
        id: h.id,
        name: h.name,
        bedsAvailable: h.bedsAvailable,
        hasSpecialty: hasSpecialty,
        status: status
      };
    });

    return {
      availability: availability,
      timestamp: new Date().toISOString()
    };
  }

  async estimateCost(payload) {
    var hospitalId = payload.hospitalId;
    var procedure = payload.procedure;
    var insurance = payload.insurance;

    var targetHospitals = this.hospitals;
    if (hospitalId) {
      targetHospitals = this.hospitals.filter(function(h) {
        return h.id === hospitalId;
      });
    }

    var procedureMultipliers = {
      'surgery': 3,
      'consultation': 0.5,
      'diagnostic': 0.8,
      'emergency': 1.5
    };

    var estimates = targetHospitals.map(function(h) {
      var estimatedCost = h.costEstimate;

      if (procedure) {
        var multiplier = procedureMultipliers[procedure.toLowerCase()] || 1;
        estimatedCost *= multiplier;
      }

      var insuranceDiscount = 0;
      if (insurance && h.insuranceAccepted.some(function(i) {
        return i.toLowerCase().includes(insurance.toLowerCase());
      })) {
        insuranceDiscount = estimatedCost * 0.2;
      }

      return {
        id: h.id,
        name: h.name,
        baseCost: h.costEstimate,
        estimatedCost: Math.round(estimatedCost - insuranceDiscount),
        insuranceDiscount: Math.round(insuranceDiscount),
        insuranceAccepted: h.insuranceAccepted
      };
    });

    return {
      estimates: estimates,
      procedure: procedure,
      timestamp: new Date().toISOString()
    };
  }

  async handleComplexQuery(task, payload) {
    var prompt = 'Task: ' + task + '\n' +
      'Payload: ' + JSON.stringify(payload) + '\n\n' +
      'Available hospitals: ' + JSON.stringify(this.hospitals) + '\n\n' +
      'Please analyze the query and provide a recommendation.';

    var response = await this.providerManager.generate(prompt);

    return {
      aiResponse: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed
    };
  }

  getRequiredCapability(task) {
    if (task.includes('search') || task.includes('find')) {
      return 'search_hospitals';
    }
    if (task.includes('compare')) {
      return 'compare_hospitals';
    }
    if (task.includes('bed') || task.includes('availability')) {
      return 'check_beds';
    }
    if (task.includes('cost') || task.includes('estimate')) {
      return 'estimate_cost';
    }
    return null;
  }
}

module.exports = { HospitalAgent };
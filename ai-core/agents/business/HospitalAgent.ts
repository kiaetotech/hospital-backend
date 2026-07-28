// D:\hospital backend\ai-core\agents\business\HospitalAgent.ts

import { AgentRole, AgentStatus, AgentRequest, AgentResponse } from '../../../shared/types/AgentTypes';
import { BaseAgent } from '../base/BaseAgent';
import { ProviderManager } from '../../providers/ProviderManager';

interface Hospital {
  id: string;
  name: string;
  city: string;
  specialty: string[];
  bedsAvailable: number;
  insuranceAccepted: string[];
  rating: number;
  costEstimate: number;
}

export class HospitalAgent extends BaseAgent {
  private hospitals: Hospital[] = [];

  constructor(providerManager: ProviderManager) {
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

    // Seed with sample data
    this.initializeHospitals();
  }

  private initializeHospitals(): void {
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

  async execute(request: AgentRequest): Promise<AgentResponse> {
    this.setStatus(AgentStatus.BUSY);
    this.setCurrentTask(request.task);

    try {
      // Validate request
      if (!this.validateRequest(request)) {
        throw new Error('Invalid request: Missing required fields or capabilities');
      }

      const { task, payload } = request;
      this.log(`Executing task: ${task}`, 'info');

      let result: any;

      // Route to appropriate handler based on task
      if (task.includes('search') || task.includes('find')) {
        result = await this.searchHospitals(payload);
      } else if (task.includes('compare')) {
        result = await this.compareHospitals(payload);
      } else if (task.includes('bed') || task.includes('availability')) {
        result = await this.checkAvailability(payload);
      } else if (task.includes('cost') || task.includes('estimate')) {
        result = await this.estimateCost(payload);
      } else {
        // Use AI for complex queries
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

  private async searchHospitals(payload: any): Promise<any> {
    const { city, specialty, insurance, maxResults = 10 } = payload;

    let results = this.hospitals;

    // Filter by city
    if (city) {
      results = results.filter(h => h.city.toLowerCase().includes(city.toLowerCase()));
    }

    // Filter by specialty
    if (specialty) {
      results = results.filter(h => 
        h.specialty.some(s => s.toLowerCase().includes(specialty.toLowerCase()))
      );
    }

    // Filter by insurance
    if (insurance) {
      results = results.filter(h => 
        h.insuranceAccepted.some(i => i.toLowerCase().includes(insurance.toLowerCase()))
      );
    }

    // Sort by rating
    results.sort((a, b) => b.rating - a.rating);

    // Limit results
    results = results.slice(0, maxResults);

    return {
      hospitals: results,
      total: results.length,
      query: { city, specialty, insurance }
    };
  }

  private async compareHospitals(payload: any): Promise<any> {
    const { hospitalIds, criteria } = payload;

    let selectedHospitals = this.hospitals;
    if (hospitalIds && hospitalIds.length > 0) {
      selectedHospitals = this.hospitals.filter(h => hospitalIds.includes(h.id));
    }

    const comparison = selectedHospitals.map(hospital => {
      const score = this.calculateHospitalScore(hospital, criteria);
      return {
        ...hospital,
        score
      };
    });

    // Sort by score
    comparison.sort((a, b) => b.score - a.score);

    return {
      hospitals: comparison,
      criteria
    };
  }

  private calculateHospitalScore(hospital: Hospital, criteria?: string[]): number {
    let score = 0;

    // Rating contributes 40%
    score += (hospital.rating / 5) * 40;

    // Bed availability contributes 30%
    const bedScore = Math.min(hospital.bedsAvailable / 50, 1);
    score += bedScore * 30;

    // Cost contributes 30% (lower cost = higher score)
    const costScore = Math.max(0, 1 - (hospital.costEstimate / 50000));
    score += costScore * 30;

    return Math.round(score);
  }

  private async checkAvailability(payload: any): Promise<any> {
    const { hospitalId, specialty } = payload;

    let targetHospital = this.hospitals;
    if (hospitalId) {
      targetHospital = this.hospitals.filter(h => h.id === hospitalId);
    }

    const availability = targetHospital.map(h => ({
      id: h.id,
      name: h.name,
      bedsAvailable: h.bedsAvailable,
      hasSpecialty: specialty ? h.specialty.some(s => s.toLowerCase().includes(specialty.toLowerCase())) : true,
      status: h.bedsAvailable > 10 ? 'Available' : h.bedsAvailable > 0 ? 'Limited' : 'Full'
    }));

    return {
      availability,
      timestamp: new Date().toISOString()
    };
  }

  private async estimateCost(payload: any): Promise<any> {
    const { hospitalId, procedure, insurance } = payload;

    let targetHospitals = this.hospitals;
    if (hospitalId) {
      targetHospitals = this.hospitals.filter(h => h.id === hospitalId);
    }

    const estimates = targetHospitals.map(h => {
      let estimatedCost = h.costEstimate;

      // Adjust based on procedure complexity (simplified)
      if (procedure) {
        const procedureMultipliers: Record<string, number> = {
          'surgery': 3,
          'consultation': 0.5,
          'diagnostic': 0.8,
          'emergency': 1.5
        };
        const multiplier = procedureMultipliers[procedure.toLowerCase()] || 1;
        estimatedCost *= multiplier;
      }

      // Insurance discount
      let insuranceDiscount = 0;
      if (insurance && h.insuranceAccepted.some(i => i.toLowerCase().includes(insurance.toLowerCase()))) {
        insuranceDiscount = estimatedCost * 0.2; // 20% discount
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
      estimates,
      procedure,
      timestamp: new Date().toISOString()
    };
  }

  private async handleComplexQuery(task: string, payload: any): Promise<any> {
    // Use AI for complex queries
    const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Available hospitals: ${JSON.stringify(this.hospitals)}
      
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
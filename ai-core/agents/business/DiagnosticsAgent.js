// D:\hospital backend\ai-core\agents\business\DiagnosticsAgent.ts

import { AgentRole, AgentStatus, AgentRequest, AgentResponse } from '../../../shared/types/AgentTypes';
import { BaseAgent } from '../base/BaseAgent';
import { ProviderManager } from '../../providers/ProviderManager';

;
  accredited;
}





export class DiagnosticsAgent extends BaseAgent {
  private labs[] = [];

  constructor(providerManager) {
    super(
      {
        name: 'Diagnostics Agent',
        role.DIAGNOSTICS,
        capabilities: [
          {
            name: 'find_lab',
            description: 'Find diagnostic labs by location and test availability',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth},
          {
            name: 'compare_packages',
            description: 'Compare diagnostic packages from different labs',
            priority: 2,
            estimatedLatency: 300,
            requiresAuth},
          {
            name: 'book_test',
            description: 'Book a diagnostic test or package',
            priority: 1,
            estimatedLatency: 300,
            requiresAuth},
          {
            name: 'interpret_results',
            description: 'Interpret diagnostic test results with AI',
            priority: 2,
            estimatedLatency: 500,
            requiresAuth}
        ]
      },
      providerManager
    );

    this.initializeLabs();
  }

  private initializeLabs(){
    this.labs = [
      {
        id: 'l1',
        name: 'SRL Diagnostics',
        city: 'Mumbai',
        tests: ['Complete Blood Count', 'Lipid Profile', 'Liver Function', 'Kidney Function', 'Thyroid Profile'],
        packages: [
          {
            id: 'p1',
            name: 'Comprehensive Health Checkup',
            tests: ['Complete Blood Count', 'Lipid Profile', 'Liver Function', 'Kidney Function', 'Thyroid Profile', 'Vitamin D'],
            price: 4999,
            discount: 20,
            preparation: 'Fast for 10-12 hours before the test'
          },
          {
            id: 'p2',
            name: 'Basic Health Package',
            tests: ['Complete Blood Count', 'Lipid Profile', 'Fasting Blood Sugar'],
            price: 1499,
            discount: 10,
            preparation: 'Fast for 8 hours before the test'
          }
        ],
        rating: 4.8,
        turnaroundTime: 24,
        priceRange: { min: 499, max: 9999 },
        accredited},
      {
        id: 'l2',
        name: 'Thyrocare',
        city: 'Mumbai',
        tests: ['Thyroid Profile', 'Vitamin D', 'Complete Blood Count', 'Lipid Profile', 'HbA1c'],
        packages: [
          {
            id: 'p3',
            name: 'Thyroid Full Profile',
            tests: ['T3', 'T4', 'TSH', 'Anti-TPO', 'Anti-TG'],
            price: 3499,
            discount: 15,
            preparation: 'Fast for 6-8 hours before the test'
          },
          {
            id: 'p4',
            name: 'Wellness Package',
            tests: ['Complete Blood Count', 'Lipid Profile', 'Thyroid Profile', 'Vitamin D', 'HbA1c'],
            price: 3999,
            discount: 25,
            preparation: 'Fast for 10-12 hours before the test'
          }
        ],
        rating: 4.6,
        turnaroundTime: 48,
        priceRange: { min: 399, max: 7999 },
        accredited},
      {
        id: 'l3',
        name: 'Metropolis Lab',
        city: 'Delhi',
        tests: ['Complete Blood Count', 'Lipid Profile', 'Liver Function', 'Kidney Function', 'Thyroid Profile', 'Cancer Markers'],
        packages: [
          {
            id: 'p5',
            name: 'Executive Health Check',
            tests: ['Complete Blood Count', 'Lipid Profile', 'Liver Function', 'Kidney Function', 'Thyroid Profile', 'Cancer Markers'],
            price: 7999,
            discount: 10,
            preparation: 'Fast for 12 hours before the test'
          },
          {
            id: 'p6',
            name: 'Basic Health Check',
            tests: ['Complete Blood Count', 'Fasting Blood Sugar', 'Lipid Profile'],
            price: 999,
            discount: 5,
            preparation: 'Fast for 8 hours before the test'
          }
        ],
        rating: 4.7,
        turnaroundTime: 36,
        priceRange: { min: 299, max: 14999 },
        accredited},
      {
        id: 'l4',
        name: 'Dr. Lal PathLabs',
        city: 'Delhi',
        tests: ['Complete Blood Count', 'Lipid Profile', 'Liver Function', 'Kidney Function', 'Urine Analysis'],
        packages: [
          {
            id: 'p7',
            name: 'Complete Health Package',
            tests: ['Complete Blood Count', 'Lipid Profile', 'Liver Function', 'Kidney Function', 'Urine Analysis', 'Vitamin D'],
            price: 4499,
            discount: 20,
            preparation: 'Fast for 10-12 hours before the test'
          }
        ],
        rating: 4.9,
        turnaroundTime: 24,
        priceRange: { min: 499, max: 8999 },
        accredited},
      {
        id: 'l5',
        name: 'Suburban Diagnostics',
        city: 'Gurugram',
        tests: ['Complete Blood Count', 'Lipid Profile', 'Thyroid Profile', 'Vitamin D'],
        packages: [
          {
            id: 'p8',
            name: 'Female Health Check',
            tests: ['Complete Blood Count', 'Thyroid Profile', 'Vitamin D', 'Fasting Blood Sugar'],
            price: 2999,
            discount: 15,
            preparation: 'Fast for 8 hours before the test'
          }
        ],
        rating: 4.5,
        turnaroundTime: 48,
        priceRange: { min: 399, max: 5999 },
        accredited}
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

      if (task.includes('find') || task.includes('search') || task.includes('lab')) {
        result = await this.findLabs(payload);
      } else if (task.includes('compare') || task.includes('package')) {
        result = await this.comparePackages(payload);
      } else if (task.includes('book') || task.includes('test') || task.includes('appointment')) {
        result = await this.bookTest(payload);
      } else if (task.includes('interpret') || task.includes('result')) {
        result = await this.interpretResults(payload);
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

  private async findLabs(payload)<any> {
    const { city, test, maxResults = 10 } = payload;

    let results = this.labs;

    if (city) {
      results = results.filter(l => l.city.toLowerCase().includes(city.toLowerCase()));
    }

    if (test) {
      results = results.filter(l => 
        l.tests.some(t => t.toLowerCase().includes(test.toLowerCase())) ||
        l.packages.some(p => p.tests.some(t => t.toLowerCase().includes(test.toLowerCase())))
      );
    }

    results.sort((a, b) => b.rating - a.rating);
    results = results.slice(0, maxResults);

    return {
      labs,
      total.length,
      query: { city, test }
    };
  }

  private async comparePackages(payload)<any> {
    const { labIds, packageIds } = payload;

    let selectedLabs = this.labs;
    if (labIds && labIds.length > 0) {
      selectedLabs = this.labs.filter(l => labIds.includes(l.id));
    }

    let packages = selectedLabs.flatMap(l => 
      l.packages.map(p => ({
        ...p,
        labName.name,
        labId.id,
        rating.rating,
        turnaroundTime.turnaroundTime
      }))
    );

    if (packageIds && packageIds.length > 0) {
      packages = packages.filter(p => packageIds.includes(p.id));
    }

    // Sort by price
    packages.sort((a, b) => a.price - b.price);

    return {
      packages,
      total.length
    };
  }

  private async bookTest(payload)<any> {
    const { labId, packageId, testName, patientName, patientContact, date, time } = payload;

    const lab = this.labs.find(l => l.id === labId);
    if (!lab) {
      throw new Error('Lab not found');
    }

    let testPackage = lab.packages.find(p => p.id === packageId);
    let selectedTests[] = [];
    let price = 0;

    if (testPackage) {
      selectedTests = testPackage.tests;
      price = testPackage.price - (testPackage.price * testPackage.discount / 100);
    } else if (testName) {
      if (lab.tests.includes(testName)) {
        selectedTests = [testName];
        price = lab.priceRange.min + 500; // Estimate
      } else {
        throw new Error('Test not available at this lab');
      }
    } else {
      throw new Error('Either packageId or testName is required');
    }

    const bookingId = `DIA${Date.now()}`;

    return {
      bookingId,
      lab: {
        id.id,
        name.name,
        address: `${lab.city}, India`
      },
      tests,
      package? {
        id.id,
        name.name,
        discount.discount
      } ,
      price,
      patient: {
        name,
        contact},
      date|| new Date().toISOString().split('T')[0],
      time|| '9:00 AM',
      preparation?.preparation || 'Follow standard preparation guidelines',
      status: 'Confirmed',
      timestampDate().toISOString()
    };
  }

  private async interpretResults(payload)<any> {
    const { results } = payload;

    // Use AI to interpret results
    const prompt = `
      Given the following test results:
      ${JSON.stringify(results)}
      
      Please interpret the results and provide:
      1. Normal vs Abnormal findings
      2. Possible causes for abnormal results
      3. Lifestyle recommendations
      4. What to do next (if further tests needed, consult a doctor, etc.)
      
      IMPORTANTrecommend consulting a doctor for abnormal results.
    `;

    const response = await this.providerManager.generate(prompt);

    return {
      results,
      interpretation.content,
      provider.provider,
      tokensUsed.tokensUsed,
      disclaimer: 'This interpretation is AI-generated and should not replace professional medical advice. Please consult your doctor.'
    };
  }

  private async handleComplexQuery(task, payload)<any> {
    const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Available labs: ${JSON.stringify(this.labs)}
      
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
    if (task.includes('find') || task.includes('search') || task.includes('lab')) {
      return 'find_lab';
    }
    if (task.includes('compare') || task.includes('package')) {
      return 'compare_packages';
    }
    if (task.includes('book') || task.includes('test') || task.includes('appointment')) {
      return 'book_test';
    }
    if (task.includes('interpret') || task.includes('result')) {
      return 'interpret_results';
    }
    return null;
  }
}



"use strict";
// D:\hospital backend\ai-core\agents\operations\CorporateHealthAgent.ts
Object.defineProperty(exports, "__esModule", { value});
exports.CorporateHealthAgent = void 0;
const AgentTypes_1 = require("../../../shared/types/AgentTypes");
const BaseAgent_1 = require("../base/BaseAgent");
class CorporateHealthAgent extends BaseAgent_1.BaseAgent {
    constructor(providerManager) {
        super({
            name: 'Corporate Health Agent',
            role_1.AgentRole.CORPORATE,
            capabilities: [
                {
                    name: 'get_corporate_plans',
                    description: 'Get corporate health plans for companies',
                    priority: 1,
                    estimatedLatency: 200,
                    requiresAuth},
                {
                    name: 'compare_corporate_plans',
                    description: 'Compare corporate health plans',
                    priority: 1,
                    estimatedLatency: 250,
                    requiresAuth},
                {
                    name: 'enroll_employees',
                    description: 'Enroll employees in corporate health plan',
                    priority: 2,
                    estimatedLatency: 300,
                    requiresAuth}
            ]
        }, providerManager);
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
                    hospitalCoverage,
                    doctorConsultation,
                    diagnosticTests,
                    wellnessPrograms,
                    mentalHealth,
                    dental,
                    vision,
                    maternity,
                    emergency},
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
                    hospitalCoverage,
                    doctorConsultation,
                    diagnosticTests,
                    wellnessPrograms,
                    mentalHealth,
                    dental,
                    vision,
                    maternity,
                    emergency},
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
                    hospitalCoverage,
                    doctorConsultation,
                    diagnosticTests,
                    wellnessPrograms,
                    mentalHealth,
                    dental,
                    vision,
                    maternity,
                    emergency},
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
                    hospitalCoverage,
                    doctorConsultation,
                    diagnosticTests,
                    wellnessPrograms,
                    mentalHealth,
                    dental,
                    vision,
                    maternity,
                    emergency},
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
                    hospitalCoverage,
                    doctorConsultation,
                    diagnosticTests,
                    wellnessPrograms,
                    mentalHealth,
                    dental,
                    vision,
                    maternity,
                    emergency},
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
        this.setStatus(AgentTypes_1.AgentStatus.BUSY);
        this.setCurrentTask(request.task);
        try {
            if (!this.validateRequest(request)) {
                throw new Error('Invalid requestrequired fields or capabilities');
            }
            const { task, payload } = request;
            this.log(`Executing task: ${task}`, 'info');
            let result;
            if (task.includes('get') || task.includes('list')) {
                result = await this.getCorporatePlans(payload);
            }
            else if (task.includes('compare')) {
                result = await this.comparePlans(payload);
            }
            else if (task.includes('enroll') || task.includes('onboard')) {
                result = await this.enrollEmployees(payload);
            }
            else {
                result = await this.handleComplexQuery(task, payload);
            }
            this.setStatus(AgentTypes_1.AgentStatus.IDLE);
            this.setCurrentTask(undefined);
            return {
                success,
                data,
                sourceAgent.id,
                processingTime.now() - new Date().getTime()
            };
        }
        catch (error) {
            this.setStatus(AgentTypes_1.AgentStatus.IDLE);
            this.setCurrentTask(undefined);
            return this.handleError(error, request);
        }
    }
    async getCorporatePlans(payload) {
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
            plans,
            total.length,
            query: { type, minEmployees, maxBudget },
            recommendation.length > 0 ? `Recommended: ${results[0].name}` : 'No matching plans found'
        };
    }
    async comparePlans(payload) {
        const { planIds } = payload;
        let selectedPlans = this.corporatePlans;
        if (planIds && planIds.length > 0) {
            selectedPlans = this.corporatePlans.filter(p => planIds.includes(p.id));
        }
        const comparison = selectedPlans.map(plan => ({
            name.name,
            provider.provider,
            type.type,
            perEmployeeCost: `₹${plan.pricing.perEmployeeAnnual}`,
            minEmployees.pricing.minEmployees,
            coverage.entries(plan.coverage)
                .filter(([_, covered]) => covered)
                .map(([key]) => key)
                .join(', '),
            network: {
                hospitals.network.hospitals,
                doctors.network.doctors,
                labs.network.labs
            },
            features.features.slice(0, 3).join(', '),
            insurancePartner.insurancePartner
        }));
        return {
            comparison,
            totalPlans.length,
            bestValue.reduce((a, b) => {
                const aCost = parseInt(a.perEmployeeCost.replace('₹', ''));
                const bCost = parseInt(b.perEmployeeCost.replace('₹', ''));
                return aCost < bCost ? a ;
            }, comparison[0])
        };
    }
    async enrollEmployees(payload) {
        const { companyName, employeeCount, planId, contactPerson, contactEmail, contactPhone } = payload;
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
        return {
            enrollmentId,
            company: {
                name,
                employeeCount,
                contactPerson,
                contactEmail,
                contactPhone
            },
            plan: {
                name.name,
                type.type,
                provider.provider,
                insurancePartner.insurancePartner
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
            timestampDate().toISOString()
        };
    }
    async handleComplexQuery(task, payload) {
        const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Available Corporate Plans: ${JSON.stringify(this.corporatePlans)}
      
      Please analyze the query and provide a recommendation.
    `;
        const response = await this.providerManager.generate(prompt);
        return {
            aiResponse.content,
            provider.provider,
            tokensUsed.tokensUsed
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
exports.CorporateHealthAgent = CorporateHealthAgent;



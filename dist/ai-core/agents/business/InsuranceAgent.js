"use strict";
// D:\hospital backend\ai-core\agents\business\InsuranceAgent.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsuranceAgent = void 0;
const AgentTypes_1 = require("../../../shared/types/AgentTypes");
const BaseAgent_1 = require("../base/BaseAgent");
class InsuranceAgent extends BaseAgent_1.BaseAgent {
    constructor(providerManager) {
        super({
            name: 'Insurance Agent',
            role: AgentTypes_1.AgentRole.INSURANCE,
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
        }, providerManager);
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
                preExistingCoverage: false,
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
        this.setStatus(AgentTypes_1.AgentStatus.BUSY);
        this.setCurrentTask(request.task);
        try {
            if (!this.validateRequest(request)) {
                throw new Error('Invalid request: Missing required fields or capabilities');
            }
            const { task, payload } = request;
            this.log(`Executing task: ${task}`, 'info');
            let result;
            if (task.includes('compare') || task.includes('policy')) {
                result = await this.comparePolicies(payload);
            }
            else if (task.includes('claim')) {
                result = await this.handleClaim(payload);
            }
            else if (task.includes('cashless')) {
                result = await this.findCashlessHospitals(payload);
            }
            else if (task.includes('premium') || task.includes('estimate')) {
                result = await this.estimatePremium(payload);
            }
            else {
                result = await this.handleComplexQuery(task, payload);
            }
            this.setStatus(AgentTypes_1.AgentStatus.IDLE);
            this.setCurrentTask(undefined);
            return {
                success: true,
                data: result,
                sourceAgent: this.id,
                processingTime: Date.now() - new Date().getTime()
            };
        }
        catch (error) {
            this.setStatus(AgentTypes_1.AgentStatus.IDLE);
            this.setCurrentTask(undefined);
            return this.handleError(error, request);
        }
    }
    async comparePolicies(payload) {
        const { type, coverageRange, maxPremium, minRating = 0 } = payload;
        let results = this.policies;
        if (type) {
            results = results.filter(p => p.type === type);
        }
        if (coverageRange) {
            results = results.filter(p => p.coverageAmount >= coverageRange.min && p.coverageAmount <= coverageRange.max);
        }
        if (maxPremium) {
            results = results.filter(p => p.premium <= maxPremium);
        }
        if (minRating) {
            results = results.filter(p => p.rating >= minRating);
        }
        // Sort by rating (highest first)
        results.sort((a, b) => b.rating - a.rating);
        // Calculate value score (coverage per premium)
        results = results.map(p => ({
            ...p,
            valueScore: Math.round((p.coverageAmount / p.premium) * 100) / 100,
            monthlyPremium: Math.round(p.premium / 12)
        }));
        // Sort by value score
        results.sort((a, b) => b.valueScore - a.valueScore);
        return {
            policies: results,
            total: results.length,
            query: { type, coverageRange, maxPremium, minRating },
            recommendation: results.length > 0 ? {
                bestOverall: results[0].name,
                bestValue: results.reduce((a, b) => a.valueScore > b.valueScore ? a : b).name
            } : null
        };
    }
    async handleClaim(payload) {
        const { action, ...data } = payload;
        if (action === 'check') {
            return this.checkClaim(data);
        }
        else if (action === 'submit') {
            return this.submitClaim(data);
        }
        else if (action === 'status') {
            return this.getClaimStatus(data);
        }
        throw new Error('Invalid claim action');
    }
    async checkClaim(payload) {
        const { policyId, diagnosis, estimatedCost } = payload;
        const policy = this.policies.find(p => p.id === policyId);
        if (!policy) {
            throw new Error('Policy not found');
        }
        // Check if treatment is covered
        const isCovered = this.isTreatmentCovered(diagnosis, policy);
        const estimatedCoverage = isCovered ? Math.min(estimatedCost, policy.coverageAmount) : 0;
        return {
            policy: {
                id: policy.id,
                name: policy.name,
                provider: policy.provider,
                coverageAmount: policy.coverageAmount
            },
            diagnosis,
            estimatedCost,
            isCovered,
            estimatedCoverage,
            patientShare: isCovered ? Math.max(0, estimatedCost - estimatedCoverage) : estimatedCost,
            waitingPeriod: policy.waitingPeriod,
            preExistingCoverage: policy.preExistingCoverage,
            coPay: policy.coPay,
            requiresPreAuthorization: estimatedCost > 50000 || diagnosis.includes('surgery')
        };
    }
    isTreatmentCovered(diagnosis, policy) {
        // Check if diagnosis includes critical illness
        const criticalIllnessKeywords = ['cancer', 'heart', 'stroke', 'kidney', 'liver'];
        const isCritical = criticalIllnessKeywords.some(k => diagnosis.toLowerCase().includes(k));
        // Check if coverage available
        if (isCritical && !policy.criticalIllnessCoverage) {
            return false;
        }
        // Check maternity coverage
        const maternityKeywords = ['pregnancy', 'delivery', 'maternity'];
        const isMaternity = maternityKeywords.some(k => diagnosis.toLowerCase().includes(k));
        if (isMaternity && !policy.maternityCoverage) {
            return false;
        }
        // General coverage
        return true;
    }
    async submitClaim(payload) {
        const { policyId, patientName, hospital, diagnosis, treatmentDate, estimatedCost, documents } = payload;
        const policy = this.policies.find(p => p.id === policyId);
        if (!policy) {
            throw new Error('Policy not found');
        }
        // Check if hospital is cashless
        const isCashless = policy.cashlessHospitals.some(h => hospital.toLowerCase().includes(h.toLowerCase()));
        // Generate claim ID
        const claimId = `CLM${Date.now()}`;
        const claimStatus = {
            claimId,
            policyId,
            patientName,
            hospital,
            amount: estimatedCost,
            status: 'Pending',
            decision: 'Under review',
            processedAt: new Date().toISOString()
        };
        this.claims.set(claimId, claimStatus);
        return {
            claimId,
            status: 'Submitted',
            isCashless,
            policy: {
                id: policy.id,
                name: policy.name,
                provider: policy.provider
            },
            patient: {
                name: patientName,
                hospital
            },
            diagnosis,
            estimatedCost,
            nextSteps: isCashless ?
                'Hospital will handle claim processing. Please carry your policy document.' :
                'Pay at hospital and submit reimbursement claim with all bills.',
            expectedProcessingTime: isCashless ? '24-48 hours' : '7-10 days'
        };
    }
    async getClaimStatus(payload) {
        const { claimId } = payload;
        if (!claimId) {
            throw new Error('Claim ID is required');
        }
        const claim = this.claims.get(claimId);
        if (!claim) {
            throw new Error('Claim not found');
        }
        return claim;
    }
    async findCashlessHospitals(payload) {
        const { city, policyId } = payload;
        let policy = null;
        if (policyId) {
            policy = this.policies.find(p => p.id === policyId) || null;
            if (!policy) {
                throw new Error('Policy not found');
            }
        }
        // In production, this would query a database of hospitals
        const cashlessHospitals = policy ? policy.cashlessHospitals : [
            'Apollo Hospital',
            'Fortis Hospital',
            'Max Hospital',
            'Medanta Hospital',
            'AIIMS Delhi'
        ];
        return {
            hospitals: cashlessHospitals.map(h => ({
                name: h,
                address: `${h}, ${city || 'All Cities'}`,
                cashless: true,
                network: policy ? `${policy.provider} Network` : 'Multiple Networks'
            })),
            total: cashlessHospitals.length,
            query: { city, policyId }
        };
    }
    async estimatePremium(payload) {
        const { age, coverage, type = 'Individual', smoker = false } = payload;
        if (!age || !coverage) {
            throw new Error('Age and coverage amount are required');
        }
        // Base premium calculation
        let basePremium = coverage * 0.02; // 2% of coverage
        // Age adjustment
        if (age < 30)
            basePremium *= 0.8;
        else if (age < 40)
            basePremium *= 1.0;
        else if (age < 50)
            basePremium *= 1.3;
        else if (age < 60)
            basePremium *= 1.8;
        else
            basePremium *= 2.5;
        // Type adjustment
        if (type === 'Family')
            basePremium *= 1.5;
        else if (type === 'SeniorCitizen')
            basePremium *= 2.0;
        else if (type === 'Corporate')
            basePremium *= 1.2;
        // Smoker adjustment
        if (smoker)
            basePremium *= 1.2;
        // Round to nearest 100
        const annualPremium = Math.round(basePremium / 100) * 100;
        const monthlyPremium = Math.round(annualPremium / 12);
        // Get recommended policies
        const recommended = this.policies.filter(p => p.type === type &&
            p.coverageAmount >= coverage &&
            p.premium <= annualPremium * 1.2);
        return {
            estimatedPremium: {
                annual: annualPremium,
                monthly: monthlyPremium
            },
            factors: {
                age,
                coverage,
                type,
                smoker
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
        const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Available policies: ${JSON.stringify(this.policies)}
      
      Please analyze the query and provide a recommendation.
    `;
        const response = await this.providerManager.generate(prompt);
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
exports.InsuranceAgent = InsuranceAgent;

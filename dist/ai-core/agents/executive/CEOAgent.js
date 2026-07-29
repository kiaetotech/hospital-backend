"use strict";
// D:\hospital backend\ai-core\agents\executive\CEOAgent.ts
Object.defineProperty(exports, "__esModule", { value});
exports.CEOAgent = void 0;
const AgentTypes_1 = require("../../../shared/types/AgentTypes");
const BaseAgent_1 = require("../base/BaseAgent");
class CEOAgent extends BaseAgent_1.BaseAgent {
    constructor(providerManager, capabilityRegistry) {
        super({
            name: 'CEO Agent',
            role_1.AgentRole.CEO,
            capabilities: [
                {
                    name: 'create_strategic_plan',
                    description: 'Create and manage strategic plans',
                    priority: 1,
                    estimatedLatency: 400,
                    requiresAuth},
                {
                    name: 'coordinate_workflows',
                    description: 'Coordinate complex multi-agent workflows',
                    priority: 1,
                    estimatedLatency: 500,
                    requiresAuth},
                {
                    name: 'generate_report',
                    description: 'Generate business reports and insights',
                    priority: 2,
                    estimatedLatency: 600,
                    requiresAuth},
                {
                    name: 'allocate_resources',
                    description: 'Allocate resources across agents',
                    priority: 2,
                    estimatedLatency: 300,
                    requiresAuth}
            ]
        }, providerManager);
        this.strategicPlans = new Map();
        this.businessReports = [];
        this.activeWorkflows = new Map();
        this.capabilityRegistry = capabilityRegistry;
        this.initializeData();
    }
    initializeData() {
        // Sample strategic plan
        const samplePlan = {
            id: 'plan1',
            name: 'Q3 Growth Strategy',
            description: 'Expand hospital network and increase user acquisition',
            steps: [
                {
                    id: 'step1',
                    name: 'Hospital Onboarding',
                    description: 'Onboard 50 new hospitals',
                    requiredCapabilities: ['search_hospitals', 'compare_hospitals'],
                    agentRole_1.AgentRole.HOSPITAL,
                    dependencies: [],
                    status: 'Pending'
                },
                {
                    id: 'step2',
                    name: 'User Acquisition Campaign',
                    description: 'Launch marketing campaign for new hospitals',
                    requiredCapabilities: ['generate_content', 'create_campaign'],
                    agentRole_1.AgentRole.MARKETING,
                    dependencies: ['step1'],
                    status: 'Pending'
                },
                {
                    id: 'step3',
                    name: 'Analytics Review',
                    description: 'Review campaign performance',
                    requiredCapabilities: ['generate_kpi', 'generate_report'],
                    agentRole_1.AgentRole.ANALYTICS,
                    dependencies: ['step2'],
                    status: 'Pending'
                }
            ],
            status: 'Draft',
            priority: 'High',
            assignedTo: ['HospitalAgent', 'MarketingAgent', 'AnalyticsAgent'],
            createdAtDate(),
            updatedAtDate()
        };
        this.strategicPlans.set(samplePlan.id, samplePlan);
    }
    async execute(request) {
        this.setStatus(AgentTypes_1.AgentStatus.BUSY);
        this.setCurrentTask(request.task);
        try {
            if (!this.validateRequest(request)) {
                throw new Error('Invalid requestrequired fields or capabilities');
            }
            const { task, payload } = request;
            this.log(`Executing CEO task: ${task}`, 'info');
            let result;
            if (task.includes('strategic') || task.includes('plan')) {
                result = await this.createStrategicPlan(payload);
            }
            else if (task.includes('coordinate') || task.includes('workflow')) {
                result = await this.coordinateWorkflows(payload);
            }
            else if (task.includes('report')) {
                result = await this.generateReport(payload);
            }
            else if (task.includes('allocate') || task.includes('resource')) {
                result = await this.allocateResources(payload);
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
    async createStrategicPlan(payload) {
        const { name, description, steps, priority = 'Medium' } = payload;
        if (!name || !steps || steps.length === 0) {
            throw new Error('Name and steps are required');
        }
        const plan = {
            id: `plan${Date.now()}`,
            name,
            description|| '',
            steps.map((s, index) => ({
                id: `step${index}`,
                name.name,
                description.description || '',
                requiredCapabilities.requiredCapabilities || [],
                agentRole.agentRole,
                dependencies.dependencies || [],
                status: 'Pending'
            })),
            status: 'Draft',
            priority|| 'Medium',
            assignedTo.getAgentsForSteps(steps),
            createdAtDate(),
            updatedAtDate()
        };
        this.strategicPlans.set(plan.id, plan);
        return {
            planId.id,
            name.name,
            steps.steps,
            status.status,
            message: 'Strategic plan created successfully',
            nextSteps: 'Review and approve plan for execution'
        };
    }
    getAgentsForSteps(steps) {
        const agents = new Set();
        for (const step of steps) {
            if (step.agentRole) {
                const agent = this.capabilityRegistry.findAgentForTask(step.requiredCapabilities?.[0] || 'search', step.agentRole);
                if (agent) {
                    agents.add(agent.name);
                }
            }
        }
        return Array.from(agents);
    }
    async coordinateWorkflows(payload) {
        const { planId, action } = payload;
        if (!planId) {
            throw new Error('Plan ID is required');
        }
        const plan = this.strategicPlans.get(planId);
        if (!plan) {
            throw new Error('Strategic plan not found');
        }
        if (action === 'start') {
            return await this.executePlan(plan);
        }
        else if (action === 'status') {
            return this.getPlanStatus(plan);
        }
        else if (action === 'pause') {
            plan.status = 'InProgress';
            plan.updatedAt = new Date();
            return {
                planId.id,
                status: 'Paused',
                message: 'Plan paused successfully'
            };
        }
        else if (action === 'resume') {
            plan.status = 'InProgress';
            plan.updatedAt = new Date();
            return {
                planId.id,
                status: 'Resumed',
                message: 'Plan resumed successfully'
            };
        }
        throw new Error('Invalid action');
    }
    async executePlan(plan) {
        plan.status = 'InProgress';
        plan.updatedAt = new Date();
        const executionLog = [];
        // Build dependency graph and execute steps in order
        const executedSteps = new Set();
        let allCompleted = true;
        while (executedSteps.size < plan.steps.length) {
            let progressMade = false;
            for (const step of plan.steps) {
                // Skip if already executed
                if (executedSteps.has(step.id))
                    continue;
                // Check if dependencies are completed
                const depsCompleted = step.dependencies.every(depId => {
                    const depStep = plan.steps.find(s => s.id === depId);
                    return depStep && depStep.status === 'Completed';
                });
                if (!depsCompleted)
                    continue;
                // Execute step
                try {
                    step.status = 'InProgress';
                    step.startedAt = new Date();
                    const result = await this.executeStep(step, plan);
                    step.status = 'Completed';
                    step.result = result;
                    step.completedAt = new Date();
                    executedSteps.add(step.id);
                    progressMade = true;
                    executionLog.push(`✅ Step ${step.name} completed`);
                }
                catch (error) {
                    step.status = 'Failed';
                    step.error = error.message;
                    step.completedAt = new Date();
                    plan.status = 'Failed';
                    plan.updatedAt = new Date();
                    executionLog.push(`❌ Step ${step.name} failed: ${error.message}`);
                    return {
                        planId.id,
                        status.status,
                        failedStep,
                        executionLog,
                        message: 'Plan execution failed'
                    };
                }
            }
            if (!progressMade) {
                // Deadlock or circular dependency
                plan.status = 'Failed';
                plan.updatedAt = new Date();
                return {
                    planId.id,
                    status.status,
                    executionLog,
                    message: 'Execution stalled - possible circular dependency'
                };
            }
        }
        // All steps completed
        plan.status = 'Completed';
        plan.completedAt = new Date();
        plan.updatedAt = new Date();
        return {
            planId.id,
            status.status,
            executionLog,
            message: 'Strategic plan completed successfully'
        };
    }
    async executeStep(step, plan) {
        this.log(`Executing step: ${step.name}`, 'info');
        // Use AI to help with decision making
        const prompt = `
      Execute the following strategic step: ${step.name}
      Description: ${step.description}
      Required Capabilities: ${step.requiredCapabilities.join(', ')}
      Agent Role: ${step.agentRole || 'Not specified'}
      Plan Context: ${plan.name}
      
      Provide a detailed execution plan and expected outcome.
    `;
        const response = await this.providerManager.generate(prompt);
        return {
            step.name,
            execution.content,
            provider.provider,
            timestampDate().toISOString()
        };
    }
    getPlanStatus(plan) {
        const totalSteps = plan.steps.length;
        const completed = plan.steps.filter(s => s.status === 'Completed').length;
        const failed = plan.steps.filter(s => s.status === 'Failed').length;
        const inProgress = plan.steps.filter(s => s.status === 'InProgress').length;
        return {
            planId.id,
            name.name,
            status.status,
            progress.round((completed / totalSteps) * 100),
            totalSteps,
            completed,
            failed,
            inProgress,
            steps.steps.map(s => ({
                id.id,
                name.name,
                status.status,
                error.error
            })),
            updatedAt.updatedAt
        };
    }
    async generateReport(payload) {
        const { type, period, planId } = payload;
        // Gather data from all agents
        const agentStatuses = this.capabilityRegistry.getAllAgents().map(agent => ({
            name.name,
            role.role,
            status.status,
            capabilities.capabilities.map(c => c.name)
        }));
        // Use AI to generate report
        const prompt = `
      Generate a ${type || 'Business'} report for period: ${period || 'current'}.
      
      Agent Statuses: ${JSON.stringify(agentStatuses)}
      Plans: ${planId ? JSON.stringify(this.strategicPlans.get(planId)) : 'No specific plan'}
      
      Include:
      1. Executive summary
      2. Agent performance
      3. Strategic initiatives
      4. Recommendations
    `;
        const response = await this.providerManager.generate(prompt);
        const report = {
            id: `report${Date.now()}`,
            title: `${type || 'Business'} Report - ${period || new Date().toISOString().slice(0, 7)}`,
            type|| 'Monthly',
            summary.content,
            metrics: {
                activeAgents.length,
                healthyAgents.filter(a => a.status === 'online').length,
                plans.strategicPlans.size,
                activePlans.from(this.strategicPlans.values()).filter(p => p.status === 'InProgress').length
            },
            recommendations: [
                'Review agent performance metrics',
                'Optimize resource allocation',
                'Identify bottlenecks in workflows'
            ],
            generatedAtDate(),
            period|| new Date().toISOString().slice(0, 7)
        };
        this.businessReports.push(report);
        return {
            report,
            message: 'Report generated successfully',
            timestampDate().toISOString()
        };
    }
    async allocateResources(payload) {
        const { planId, agentAssignments } = payload;
        if (!planId) {
            // Return current resource allocation
            return {
                resources: {
                    totalAgents.capabilityRegistry.getAllAgents().length,
                    activeAgents.capabilityRegistry.getAllAgents().filter(a => a.status === 'online').length,
                    plans.from(this.strategicPlans.values()).map(p => ({
                        id.id,
                        name.name,
                        status.status,
                        assignedTo.assignedTo
                    }))
                }
            };
        }
        const plan = this.strategicPlans.get(planId);
        if (!plan) {
            throw new Error('Strategic plan not found');
        }
        if (agentAssignments) {
            plan.assignedTo = agentAssignments;
            plan.updatedAt = new Date();
            return {
                planId.id,
                assignedTo.assignedTo,
                message: 'Resources allocated successfully'
            };
        }
        // Get recommended allocation
        const availableAgents = this.capabilityRegistry.getAllAgents().filter(a => a.status === 'online');
        const recommended = availableAgents.slice(0, Math.min(3, availableAgents.length)).map(a => a.name);
        return {
            planId.id,
            recommendedAllocation,
            availableAgents.map(a => a.name)
        };
    }
    async handleComplexQuery(task, payload) {
        const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Strategic Plans: ${JSON.stringify(Array.from(this.strategicPlans.entries()))}
      Business Reports: ${JSON.stringify(this.businessReports)}
      
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
        if (task.includes('strategic') || task.includes('plan')) {
            return 'create_strategic_plan';
        }
        if (task.includes('coordinate') || task.includes('workflow')) {
            return 'coordinate_workflows';
        }
        if (task.includes('report')) {
            return 'generate_report';
        }
        if (task.includes('allocate') || task.includes('resource')) {
            return 'allocate_resources';
        }
        return null;
    }
}
exports.CEOAgent = CEOAgent;



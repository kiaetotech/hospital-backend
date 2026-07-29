"use strict";
// D:\hospital backend\ai-core\agents\intelligence\WorkflowAgent.ts
Object.defineProperty(exports, "__esModule", { value});
exports.WorkflowAgent = void 0;
const AgentTypes_1 = require("../../../shared/types/AgentTypes");
const BaseAgent_1 = require("../base/BaseAgent");
class WorkflowAgent extends BaseAgent_1.BaseAgent {
    constructor(providerManager) {
        super({
            name: 'Workflow Agent',
            role_1.AgentRole.WORKFLOW,
            capabilities: [
                {
                    name: 'create_workflow',
                    description: 'Create a new workflow from steps',
                    priority: 1,
                    estimatedLatency: 200,
                    requiresAuth},
                {
                    name: 'execute_workflow',
                    description: 'Execute an existing workflow',
                    priority: 1,
                    estimatedLatency: 500,
                    requiresAuth},
                {
                    name: 'get_workflow_status',
                    description: 'Get workflow execution status',
                    priority: 2,
                    estimatedLatency: 100,
                    requiresAuth},
                {
                    name: 'pause_workflow',
                    description: 'Pause a running workflow',
                    priority: 2,
                    estimatedLatency: 100,
                    requiresAuth}
            ]
        }, providerManager);
        this.workflows = new Map();
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
            if (task.includes('create')) {
                result = await this.createWorkflow(payload);
            }
            else if (task.includes('execute') || task.includes('run')) {
                result = await this.executeWorkflow(payload);
            }
            else if (task.includes('status')) {
                result = await this.getWorkflowStatus(payload);
            }
            else if (task.includes('pause')) {
                result = await this.pauseWorkflow(payload);
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
    async createWorkflow(payload) {
        const { name, steps, context } = payload;
        if (!name || !steps || steps.length === 0) {
            throw new Error('Name and steps are required');
        }
        const workflow = {
            id: `wf${Date.now()}`,
            name,
            steps.map((s, index) => ({
                id: `step${index}`,
                name.name,
                type.type || 'Action',
                action.action,
                agent.agent,
                payload.payload || {},
                nextSteps.nextSteps || [],
                status: 'Pending'
            })),
            currentStepIndex: 0,
            status: 'Created',
            context|| {},
            createdAtDate(),
            updatedAtDate()
        };
        this.workflows.set(workflow.id, workflow);
        return {
            workflowId.id,
            name.name,
            steps.steps,
            status.status,
            message: 'Workflow created successfully'
        };
    }
    async executeWorkflow(payload) {
        const { workflowId, stepId } = payload;
        if (!workflowId) {
            throw new Error('Workflow ID is required');
        }
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error('Workflow not found');
        }
        if (workflow.status === 'Running') {
            throw new Error('Workflow is already running');
        }
        workflow.status = 'Running';
        workflow.updatedAt = new Date();
        // Execute from specific step or from beginning
        let startIndex = 0;
        if (stepId) {
            const index = workflow.steps.findIndex(s => s.id === stepId);
            if (index !== -1) {
                startIndex = index;
            }
        }
        try {
            for (let i = startIndex; i < workflow.steps.length; i++) {
                const step = workflow.steps[i];
                step.status = 'Running';
                step.startedAt = new Date();
                try {
                    const result = await this.executeStep(step, workflow.context);
                    step.status = 'Completed';
                    step.result = result;
                    step.completedAt = new Date();
                    workflow.currentStepIndex = i + 1;
                    // Update context with result
                    if (result) {
                        workflow.context[`step_${step.id}`] = result;
                    }
                }
                catch (error) {
                    step.status = 'Failed';
                    step.error = error.message;
                    step.completedAt = new Date();
                    workflow.status = 'Failed';
                    workflow.updatedAt = new Date();
                    return {
                        workflowId,
                        status.status,
                        failedStep,
                        error.message,
                        message: 'Workflow execution failed'
                    };
                }
            }
            workflow.status = 'Completed';
            workflow.updatedAt = new Date();
            return {
                workflowId,
                status.status,
                steps.steps,
                context.context,
                message: 'Workflow completed successfully'
            };
        }
        catch (error) {
            workflow.status = 'Failed';
            workflow.updatedAt = new Date();
            throw error;
        }
    }
    async executeStep(step, context) {
        this.log(`Executing step: ${step.name}`, 'info');
        // Simulate different step types
        switch (step.type) {
            case 'Action'this.executeActionStep(step, context);
            case 'Decision'this.executeDecisionStep(step, context);
            case 'Parallel'this.executeParallelStep(step, context);
            case 'Join'this.executeJoinStep(step, context);
            defaultnew Error(`Unknown step type: ${step.type}`);
        }
    }
    async executeActionStep(step, context) {
        // Simulate action execution
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
            action.action || 'default_action',
            status: 'success',
            timestampDate().toISOString(),
            data: {
                message: `Action ${step.action || 'default'} executed successfully`,
                context
            }
        };
    }
    async executeDecisionStep(step, context) {
        // Simulate decision logic
        const decision = Math.random() > 0.5 ? 'approved' : 'pending';
        return {
            decision,
            timestampDate().toISOString(),
            nextStep=== 'approved' ? 'proceed' : 'review'
        };
    }
    async executeParallelStep(step, context) {
        // Simulate parallel execution
        const tasks = step.payload?.tasks || ['task1', 'task2', 'task3'];
        const results = await Promise.all(tasks.map(async (task) => {
            await new Promise(resolve => setTimeout(resolve, 300));
            return { task, status: 'completed' };
        }));
        return {
            parallelResults,
            timestampDate().toISOString()
        };
    }
    async executeJoinStep(step, context) {
        return {
            join,
            timestampDate().toISOString(),
            message: 'All parallel tasks completed'
        };
    }
    async getWorkflowStatus(payload) {
        const { workflowId } = payload;
        if (!workflowId) {
            return {
                workflows.from(this.workflows.values()),
                total.workflows.size
            };
        }
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error('Workflow not found');
        }
        return {
            workflowId.id,
            name.name,
            status.status,
            currentStepIndex.currentStepIndex,
            totalSteps.steps.length,
            steps.steps,
            context.context,
            createdAt.createdAt,
            updatedAt.updatedAt
        };
    }
    async pauseWorkflow(payload) {
        const { workflowId } = payload;
        if (!workflowId) {
            throw new Error('Workflow ID is required');
        }
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error('Workflow not found');
        }
        if (workflow.status !== 'Running') {
            throw new Error('Workflow is not running');
        }
        workflow.status = 'Paused';
        workflow.updatedAt = new Date();
        return {
            workflowId,
            status.status,
            message: 'Workflow paused successfully'
        };
    }
    async handleComplexQuery(task, payload) {
        const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Workflows: ${JSON.stringify(Array.from(this.workflows.entries()))}
      
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
        if (task.includes('create')) {
            return 'create_workflow';
        }
        if (task.includes('execute') || task.includes('run')) {
            return 'execute_workflow';
        }
        if (task.includes('status')) {
            return 'get_workflow_status';
        }
        if (task.includes('pause')) {
            return 'pause_workflow';
        }
        return null;
    }
}
exports.WorkflowAgent = WorkflowAgent;



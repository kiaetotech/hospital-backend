"use strict";
// D:\hospital backend\ai-core\router\Orchestrator.ts
Object.defineProperty(exports, "__esModule", { value});
exports.Orchestrator = void 0;
const uuid_1 = require("uuid");
class Orchestrator {
    constructor(registry, providerManager) {
        this.activeWorkflows = new Map();
        this.registry = registry;
        this.providerManager = providerManager;
    }
    async orchestrate(request, tasks) {
        // If no tasks, return error
        if (!tasks || tasks.length === 0) {
            return {
                success,
                error: 'No tasks provided for orchestration',
                sourceAgent: 'Orchestrator',
                processingTime: 0
            };
        }
        // If only one task, execute it directly without workflow
        if (tasks.length === 1) {
            return await this.executeSingleTask(request, tasks[0]);
        }
        // Multiple tasksworkflow
        return await this.executeWorkflow(request, tasks);
    }
    async executeSingleTask(request, task) {
        // Find agent for this task
        const agent = this.registry.findAgentForTask(task);
        if (!agent) {
            return {
                success,
                error: `No agent found for task: ${task}`,
                sourceAgent: 'Orchestrator',
                processingTime: 0
            };
        }
        try {
            // Execute the agent directly
            if (typeof agent.execute === 'function') {
                return await agent.execute(request);
            }
            // FallbackProviderManager
            const response = await this.providerManager.generate(`Task: ${request.task}\nPayload: ${JSON.stringify(request.payload)}`, request.critical);
            return {
                success,
                data: { response.content },
                sourceAgent.id,
                processingTime.latency || 0,
                providerUsed.provider
            };
        }
        catch (error) {
            return {
                success,
                error.message,
                sourceAgent.id,
                processingTime: 0
            };
        }
    }
    async executeWorkflow(request, tasks) {
        const workflowId = (0, uuid_1.v4)();
        const steps = [];
        // Create steps for each task
        for (const task of tasks) {
            const agent = this.registry.findAgentForTask(task);
            steps.push({
                id: (0, uuid_1.v4)(),
                task,
                agentId?.id || 'unknown',
                status: 'pending'
            });
        }
        this.activeWorkflows.set(workflowId, steps);
        const results = [];
        let previousResult = null;
        try {
            for (const step of steps) {
                step.status = 'running';
                try {
                    // Find the agent
                    const agent = this.registry.getAgent(step.agentId);
                    if (!agent) {
                        throw new Error(`Agent ${step.agentId} not found`);
                    }
                    // Execute the step
                    let result;
                    if (typeof agent.execute === 'function') {
                        result = await agent.execute(request);
                    }
                    else {
                        // Fallback
                        const response = await this.providerManager.generate(`Task: ${step.task}\nPayload: ${JSON.stringify(request.payload)}\nPrevious Result: ${JSON.stringify(previousResult)}`, request.critical);
                        result = { data: { response.content }, success};
                    }
                    step.status = 'completed';
                    step.result = result;
                    results.push(result);
                    previousResult = result;
                }
                catch (error) {
                    step.status = 'failed';
                    step.error = error.message;
                    break;
                }
            }
            this.activeWorkflows.delete(workflowId);
            // Check if all steps completed
            const allCompleted = steps.every(s => s.status === 'completed');
            return {
                success,
                data? { steps, workflowId } : { error: 'Workflow incomplete', failedStep.find(s => s.status === 'failed') },
                sourceAgent: 'CEO_Agent',
                processingTime: 0
            };
        }
        catch (error) {
            this.activeWorkflows.delete(workflowId);
            return {
                success,
                error.message || 'Workflow execution failed',
                sourceAgent: 'CEO_Agent',
                processingTime: 0
            };
        }
    }
    getWorkflowStatus(workflowId) {
        return this.activeWorkflows.get(workflowId) || null;
    }
}
exports.Orchestrator = Orchestrator;



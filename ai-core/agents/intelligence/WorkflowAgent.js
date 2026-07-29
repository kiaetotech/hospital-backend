// D:\hospital backend\ai-core\agents\intelligence\WorkflowAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');

class WorkflowAgent extends BaseAgent {
  constructor(providerManager) {
    super(
      {
        name: 'Workflow Agent',
        role: AgentRole.WORKFLOW,
        capabilities: [
          {
            name: 'create_workflow',
            description: 'Create a new workflow from steps',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth: true
          },
          {
            name: 'execute_workflow',
            description: 'Execute an existing workflow',
            priority: 1,
            estimatedLatency: 500,
            requiresAuth: true
          },
          {
            name: 'get_workflow_status',
            description: 'Get workflow execution status',
            priority: 2,
            estimatedLatency: 100,
            requiresAuth: true
          },
          {
            name: 'pause_workflow',
            description: 'Pause a running workflow',
            priority: 2,
            estimatedLatency: 100,
            requiresAuth: true
          }
        ]
      },
      providerManager
    );

    this.workflows = new Map();
  }

  async execute(request) {
    this.setStatus(AgentStatus.BUSY);
    this.setCurrentTask(request.task);

    try {
      if (!this.validateRequest(request)) {
        throw new Error('Invalid request: Missing required fields or capabilities');
      }

      var task = request.task;
      var payload = request.payload;
      this.log('Executing task: ' + task, 'info');

      var result;

      if (task.includes('create')) {
        result = await this.createWorkflow(payload);
      } else if (task.includes('execute') || task.includes('run')) {
        result = await this.executeWorkflow(payload);
      } else if (task.includes('status')) {
        result = await this.getWorkflowStatus(payload);
      } else if (task.includes('pause')) {
        result = await this.pauseWorkflow(payload);
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

  async createWorkflow(payload) {
    var name = payload.name;
    var steps = payload.steps;
    var context = payload.context;

    if (!name || !steps || steps.length === 0) {
      throw new Error('Name and steps are required');
    }

    var mappedSteps = steps.map(function(s, index) {
      return {
        id: 'step' + index,
        name: s.name,
        type: s.type || 'Action',
        action: s.action,
        agent: s.agent,
        payload: s.payload || {},
        nextSteps: s.nextSteps || [],
        status: 'Pending'
      };
    });

    var workflow = {
      id: 'wf' + Date.now(),
      name: name,
      steps: mappedSteps,
      currentStepIndex: 0,
      status: 'Created',
      context: context || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.workflows.set(workflow.id, workflow);

    return {
      workflowId: workflow.id,
      name: workflow.name,
      steps: workflow.steps,
      status: workflow.status,
      message: 'Workflow created successfully'
    };
  }

  async executeWorkflow(payload) {
    var workflowId = payload.workflowId;
    var stepId = payload.stepId;

    if (!workflowId) {
      throw new Error('Workflow ID is required');
    }

    var workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (workflow.status === 'Running') {
      throw new Error('Workflow is already running');
    }

    workflow.status = 'Running';
    workflow.updatedAt = new Date();

    var startIndex = 0;
    if (stepId) {
      var foundIndex = -1;
      for (var i = 0; i < workflow.steps.length; i++) {
        if (workflow.steps[i].id === stepId) {
          foundIndex = i;
          break;
        }
      }
      if (foundIndex !== -1) {
        startIndex = foundIndex;
      }
    }

    try {
      for (var i = startIndex; i < workflow.steps.length; i++) {
        var step = workflow.steps[i];
        step.status = 'Running';
        step.startedAt = new Date();

        try {
          var result = await this.executeStep(step, workflow.context);
          step.status = 'Completed';
          step.result = result;
          step.completedAt = new Date();
          workflow.currentStepIndex = i + 1;

          if (result) {
            workflow.context['step_' + step.id] = result;
          }

        } catch (error) {
          step.status = 'Failed';
          step.error = error.message;
          step.completedAt = new Date();
          workflow.status = 'Failed';
          workflow.updatedAt = new Date();

          return {
            workflowId: workflowId,
            status: workflow.status,
            failedStep: step,
            error: error.message,
            message: 'Workflow execution failed'
          };
        }
      }

      workflow.status = 'Completed';
      workflow.updatedAt = new Date();

      return {
        workflowId: workflowId,
        status: workflow.status,
        steps: workflow.steps,
        context: workflow.context,
        message: 'Workflow completed successfully'
      };

    } catch (error) {
      workflow.status = 'Failed';
      workflow.updatedAt = new Date();
      throw error;
    }
  }

  async executeStep(step, context) {
    this.log('Executing step: ' + step.name, 'info');

    switch (step.type) {
      case 'Action':
        return this.executeActionStep(step, context);
      case 'Decision':
        return this.executeDecisionStep(step, context);
      case 'Parallel':
        return this.executeParallelStep(step, context);
      case 'Join':
        return this.executeJoinStep(step, context);
      default:
        throw new Error('Unknown step type: ' + step.type);
    }
  }

  async executeActionStep(step, context) {
    await new Promise(function(resolve) { setTimeout(resolve, 500); });

    return {
      action: step.action || 'default_action',
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        message: 'Action ' + (step.action || 'default') + ' executed successfully',
        context: context
      }
    };
  }

  async executeDecisionStep(step, context) {
    var decision = Math.random() > 0.5 ? 'approved' : 'pending';

    return {
      decision: decision,
      timestamp: new Date().toISOString(),
      nextStep: decision === 'approved' ? 'proceed' : 'review'
    };
  }

  async executeParallelStep(step, context) {
    var tasks = (step.payload && step.payload.tasks) || ['task1', 'task2', 'task3'];
    var results = [];

    for (var i = 0; i < tasks.length; i++) {
      await new Promise(function(resolve) { setTimeout(resolve, 300); });
      results.push({ task: tasks[i], status: 'completed' });
    }

    return {
      parallelResults: results,
      timestamp: new Date().toISOString()
    };
  }

  async executeJoinStep(step, context) {
    return {
      join: true,
      timestamp: new Date().toISOString(),
      message: 'All parallel tasks completed'
    };
  }

  async getWorkflowStatus(payload) {
    var workflowId = payload.workflowId;

    if (!workflowId) {
      var allWorkflows = Array.from(this.workflows.values());
      return {
        workflows: allWorkflows,
        total: this.workflows.size
      };
    }

    var workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    return {
      workflowId: workflow.id,
      name: workflow.name,
      status: workflow.status,
      currentStepIndex: workflow.currentStepIndex,
      totalSteps: workflow.steps.length,
      steps: workflow.steps,
      context: workflow.context,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt
    };
  }

  async pauseWorkflow(payload) {
    var workflowId = payload.workflowId;

    if (!workflowId) {
      throw new Error('Workflow ID is required');
    }

    var workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (workflow.status !== 'Running') {
      throw new Error('Workflow is not running');
    }

    workflow.status = 'Paused';
    workflow.updatedAt = new Date();

    return {
      workflowId: workflowId,
      status: workflow.status,
      message: 'Workflow paused successfully'
    };
  }

  async handleComplexQuery(task, payload) {
    var prompt = 'Task: ' + task + '\n' +
      'Payload: ' + JSON.stringify(payload) + '\n\n' +
      'Workflows: ' + JSON.stringify(Array.from(this.workflows.entries())) + '\n\n' +
      'Please analyze the query and provide a recommendation.';

    var response = await this.providerManager.generate(prompt);

    return {
      aiResponse: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed
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

module.exports = { WorkflowAgent };
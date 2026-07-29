// D:\hospital backend\ai-core\agents\executive\CEOAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');

class CEOAgent extends BaseAgent {
  constructor(providerManager, capabilityRegistry) {
    super(
      {
        name: 'CEO Agent',
        role: AgentRole.CEO,
        capabilities: [
          {
            name: 'create_strategic_plan',
            description: 'Create and manage strategic plans',
            priority: 1,
            estimatedLatency: 400,
            requiresAuth: true
          },
          {
            name: 'coordinate_workflows',
            description: 'Coordinate complex multi-agent workflows',
            priority: 1,
            estimatedLatency: 500,
            requiresAuth: true
          },
          {
            name: 'generate_report',
            description: 'Generate business reports and insights',
            priority: 2,
            estimatedLatency: 600,
            requiresAuth: true
          },
          {
            name: 'allocate_resources',
            description: 'Allocate resources across agents',
            priority: 2,
            estimatedLatency: 300,
            requiresAuth: true
          }
        ]
      },
      providerManager
    );

    this.strategicPlans = new Map();
    this.businessReports = [];
    this.capabilityRegistry = capabilityRegistry;
    this.activeWorkflows = new Map();
    this.initializeData();
  }

  initializeData() {
    var samplePlan = {
      id: 'plan1',
      name: 'Q3 Growth Strategy',
      description: 'Expand hospital network and increase user acquisition',
      steps: [
        {
          id: 'step1',
          name: 'Hospital Onboarding',
          description: 'Onboard 50 new hospitals',
          requiredCapabilities: ['search_hospitals', 'compare_hospitals'],
          agentRole: AgentRole.HOSPITAL,
          dependencies: [],
          status: 'Pending'
        },
        {
          id: 'step2',
          name: 'User Acquisition Campaign',
          description: 'Launch marketing campaign for new hospitals',
          requiredCapabilities: ['generate_content', 'create_campaign'],
          agentRole: AgentRole.MARKETING,
          dependencies: ['step1'],
          status: 'Pending'
        },
        {
          id: 'step3',
          name: 'Analytics Review',
          description: 'Review campaign performance',
          requiredCapabilities: ['generate_kpi', 'generate_report'],
          agentRole: AgentRole.ANALYTICS,
          dependencies: ['step2'],
          status: 'Pending'
        }
      ],
      status: 'Draft',
      priority: 'High',
      assignedTo: ['HospitalAgent', 'MarketingAgent', 'AnalyticsAgent'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.strategicPlans.set(samplePlan.id, samplePlan);
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
      this.log('Executing CEO task: ' + task, 'info');

      var result;

      if (task.includes('strategic') || task.includes('plan')) {
        result = await this.createStrategicPlan(payload);
      } else if (task.includes('coordinate') || task.includes('workflow')) {
        result = await this.coordinateWorkflows(payload);
      } else if (task.includes('report')) {
        result = await this.generateReport(payload);
      } else if (task.includes('allocate') || task.includes('resource')) {
        result = await this.allocateResources(payload);
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

  async createStrategicPlan(payload) {
    var name = payload.name;
    var description = payload.description;
    var steps = payload.steps;
    var priority = payload.priority || 'Medium';

    if (!name || !steps || steps.length === 0) {
      throw new Error('Name and steps are required');
    }

    var plan = {
      id: 'plan' + Date.now(),
      name: name,
      description: description || '',
      steps: steps.map(function(s, index) {
        return {
          id: 'step' + index,
          name: s.name,
          description: s.description || '',
          requiredCapabilities: s.requiredCapabilities || [],
          agentRole: s.agentRole,
          dependencies: s.dependencies || [],
          status: 'Pending'
        };
      }),
      status: 'Draft',
      priority: priority || 'Medium',
      assignedTo: this.getAgentsForSteps(steps),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.strategicPlans.set(plan.id, plan);

    return {
      planId: plan.id,
      name: plan.name,
      steps: plan.steps,
      status: plan.status,
      message: 'Strategic plan created successfully',
      nextSteps: 'Review and approve plan for execution'
    };
  }

  getAgentsForSteps(steps) {
    var agents = new Set();
    for (var i = 0; i < steps.length; i++) {
      var step = steps[i];
      if (step.agentRole) {
        var agent = this.capabilityRegistry.findAgentForTask(
          (step.requiredCapabilities && step.requiredCapabilities[0]) || 'search',
          step.agentRole
        );
        if (agent) {
          agents.add(agent.name);
        }
      }
    }
    return Array.from(agents);
  }

  async coordinateWorkflows(payload) {
    var planId = payload.planId;
    var action = payload.action;

    if (!planId) {
      throw new Error('Plan ID is required');
    }

    var plan = this.strategicPlans.get(planId);
    if (!plan) {
      throw new Error('Strategic plan not found');
    }

    if (action === 'start') {
      return await this.executePlan(plan);
    } else if (action === 'status') {
      return this.getPlanStatus(plan);
    } else if (action === 'pause') {
      plan.status = 'InProgress';
      plan.updatedAt = new Date();
      return {
        planId: plan.id,
        status: 'Paused',
        message: 'Plan paused successfully'
      };
    } else if (action === 'resume') {
      plan.status = 'InProgress';
      plan.updatedAt = new Date();
      return {
        planId: plan.id,
        status: 'Resumed',
        message: 'Plan resumed successfully'
      };
    }

    throw new Error('Invalid action');
  }

  async executePlan(plan) {
    plan.status = 'InProgress';
    plan.updatedAt = new Date();

    var executionLog = [];
    var executedSteps = new Set();
    var allCompleted = true;

    while (executedSteps.size < plan.steps.length) {
      var progressMade = false;

      for (var i = 0; i < plan.steps.length; i++) {
        var step = plan.steps[i];

        if (executedSteps.has(step.id)) continue;

        var depsCompleted = step.dependencies.every(function(depId) {
          var depStep = plan.steps.find(function(s) { return s.id === depId; });
          return depStep && depStep.status === 'Completed';
        });

        if (!depsCompleted) continue;

        try {
          step.status = 'InProgress';
          step.startedAt = new Date();
          var result = await this.executeStep(step, plan);
          step.status = 'Completed';
          step.result = result;
          step.completedAt = new Date();
          executedSteps.add(step.id);
          progressMade = true;
          executionLog.push('✅ Step ' + step.name + ' completed');

        } catch (error) {
          step.status = 'Failed';
          step.error = error.message;
          step.completedAt = new Date();
          plan.status = 'Failed';
          plan.updatedAt = new Date();
          executionLog.push('❌ Step ' + step.name + ' failed: ' + error.message);

          return {
            planId: plan.id,
            status: plan.status,
            failedStep: step,
            executionLog: executionLog,
            message: 'Plan execution failed'
          };
        }
      }

      if (!progressMade) {
        plan.status = 'Failed';
        plan.updatedAt = new Date();
        return {
          planId: plan.id,
          status: plan.status,
          executionLog: executionLog,
          message: 'Execution stalled - possible circular dependency'
        };
      }
    }

    plan.status = 'Completed';
    plan.completedAt = new Date();
    plan.updatedAt = new Date();

    return {
      planId: plan.id,
      status: plan.status,
      executionLog: executionLog,
      message: 'Strategic plan completed successfully'
    };
  }

  async executeStep(step, plan) {
    this.log('Executing step: ' + step.name, 'info');

    var prompt = 'Execute the following strategic step: ' + step.name + '\n' +
      'Description: ' + step.description + '\n' +
      'Required Capabilities: ' + step.requiredCapabilities.join(', ') + '\n' +
      'Agent Role: ' + (step.agentRole || 'Not specified') + '\n' +
      'Plan Context: ' + plan.name + '\n\n' +
      'Provide a detailed execution plan and expected outcome.';

    var response = await this.providerManager.generate(prompt);

    return {
      step: step.name,
      execution: response.content,
      provider: response.provider,
      timestamp: new Date().toISOString()
    };
  }

  getPlanStatus(plan) {
    var totalSteps = plan.steps.length;
    var completed = plan.steps.filter(function(s) { return s.status === 'Completed'; }).length;
    var failed = plan.steps.filter(function(s) { return s.status === 'Failed'; }).length;
    var inProgress = plan.steps.filter(function(s) { return s.status === 'InProgress'; }).length;

    return {
      planId: plan.id,
      name: plan.name,
      status: plan.status,
      progress: Math.round((completed / totalSteps) * 100),
      totalSteps: totalSteps,
      completed: completed,
      failed: failed,
      inProgress: inProgress,
      steps: plan.steps.map(function(s) {
        return {
          id: s.id,
          name: s.name,
          status: s.status,
          error: s.error
        };
      }),
      updatedAt: plan.updatedAt
    };
  }

  async generateReport(payload) {
    var type = payload.type;
    var period = payload.period;
    var planId = payload.planId;

    var agentStatuses = this.capabilityRegistry.getAllAgents().map(function(agent) {
      return {
        name: agent.name,
        role: agent.role,
        status: agent.status,
        capabilities: agent.capabilities.map(function(c) { return c.name; })
      };
    });

    var prompt = 'Generate a ' + (type || 'Business') + ' report for period: ' + (period || 'current') + '.\n\n' +
      'Agent Statuses: ' + JSON.stringify(agentStatuses) + '\n' +
      'Plans: ' + (planId ? JSON.stringify(this.strategicPlans.get(planId)) : 'No specific plan') + '\n\n' +
      'Include:\n' +
      '1. Executive summary\n' +
      '2. Agent performance\n' +
      '3. Strategic initiatives\n' +
      '4. Recommendations';

    var response = await this.providerManager.generate(prompt);

    var report = {
      id: 'report' + Date.now(),
      title: (type || 'Business') + ' Report - ' + (period || new Date().toISOString().slice(0, 7)),
      type: type || 'Monthly',
      summary: response.content,
      metrics: {
        activeAgents: agentStatuses.length,
        healthyAgents: agentStatuses.filter(function(a) { return a.status === 'online'; }).length,
        plans: this.strategicPlans.size,
        activePlans: Array.from(this.strategicPlans.values()).filter(function(p) { return p.status === 'InProgress'; }).length
      },
      recommendations: [
        'Review agent performance metrics',
        'Optimize resource allocation',
        'Identify bottlenecks in workflows'
      ],
      generatedAt: new Date(),
      period: period || new Date().toISOString().slice(0, 7)
    };

    this.businessReports.push(report);

    return {
      report: report,
      message: 'Report generated successfully',
      timestamp: new Date().toISOString()
    };
  }

  async allocateResources(payload) {
    var planId = payload.planId;
    var agentAssignments = payload.agentAssignments;

    if (!planId) {
      var allAgents = this.capabilityRegistry.getAllAgents();
      return {
        resources: {
          totalAgents: allAgents.length,
          activeAgents: allAgents.filter(function(a) { return a.status === 'online'; }).length,
          plans: Array.from(this.strategicPlans.values()).map(function(p) {
            return {
              id: p.id,
              name: p.name,
              status: p.status,
              assignedTo: p.assignedTo
            };
          })
        }
      };
    }

    var plan = this.strategicPlans.get(planId);
    if (!plan) {
      throw new Error('Strategic plan not found');
    }

    if (agentAssignments) {
      plan.assignedTo = agentAssignments;
      plan.updatedAt = new Date();

      return {
        planId: plan.id,
        assignedTo: plan.assignedTo,
        message: 'Resources allocated successfully'
      };
    }

    var availableAgents = this.capabilityRegistry.getAllAgents().filter(function(a) { return a.status === 'online'; });
    var recommended = availableAgents.slice(0, Math.min(3, availableAgents.length)).map(function(a) { return a.name; });

    return {
      planId: plan.id,
      recommendedAllocation: recommended,
      availableAgents: availableAgents.map(function(a) { return a.name; })
    };
  }

  async handleComplexQuery(task, payload) {
    var prompt = 'Task: ' + task + '\n' +
      'Payload: ' + JSON.stringify(payload) + '\n\n' +
      'Strategic Plans: ' + JSON.stringify(Array.from(this.strategicPlans.entries())) + '\n' +
      'Business Reports: ' + JSON.stringify(this.businessReports) + '\n\n' +
      'Please analyze the query and provide a recommendation.';

    var response = await this.providerManager.generate(prompt);

    return {
      aiResponse: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed
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

module.exports = { CEOAgent };
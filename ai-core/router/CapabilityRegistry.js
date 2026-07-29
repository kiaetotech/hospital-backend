// D:\hospital backend\ai-core\router\CapabilityRegistry.js

const { AgentStatus } = require('../../shared/types/AgentTypes.js');

class CapabilityRegistry {
  constructor() {
    this.agents = new Map();
    this.capabilityIndex = {};
    this.roleMapping = new Map();
  }

  register(agent) {
    this.agents.set(agent.id, agent);
    
    for (const capability of agent.capabilities) {
      if (!this.capabilityIndex[capability.name]) {
        this.capabilityIndex[capability.name] = [];
      }
      this.capabilityIndex[capability.name].push(agent.id);
    }

    if (!this.roleMapping.has(agent.role)) {
      this.roleMapping.set(agent.role, []);
    }
    this.roleMapping.get(agent.role).push(agent.id);
  }

  findAgentForTask(capability, role) {
    const candidates = this.capabilityIndex[capability] || [];
    
    if (candidates.length === 0) {
      return null;
    }

    let filteredCandidates = candidates;
    if (role) {
      const roleAgents = this.roleMapping.get(role) || [];
      filteredCandidates = candidates.filter(id => roleAgents.includes(id));
    }

    const result = filteredCandidates
      .map(id => this.agents.get(id))
      .filter(agent => agent && (agent.status === 'online' || agent.status === 'idle'))
      .sort((a, b) => {
        const capA = a.capabilities.find(c => c.name === capability);
        const capB = b.capabilities.find(c => c.name === capability);
        return (capA?.priority || 999) - (capB?.priority || 999);
      })[0] || null;

    return result;
  }

  getAgent(id) {
    return this.agents.get(id) || null;
  }

  getAgentsByRole(role) {
    const ids = this.roleMapping.get(role) || [];
    return ids.map(id => this.agents.get(id)).filter(Boolean);
  }

  getAllAgents() {
    return Array.from(this.agents.values());
  }

  getAgentCapabilities(agentId) {
    const agent = this.agents.get(agentId);
    return agent ? agent.capabilities : [];
  }

  unregister(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    for (const capability of agent.capabilities) {
      const candidates = this.capabilityIndex[capability.name] || [];
      this.capabilityIndex[capability.name] = candidates.filter(id => id !== agentId);
    }

    const roleAgents = this.roleMapping.get(agent.role) || [];
    this.roleMapping.set(agent.role, roleAgents.filter(id => id !== agentId));

    this.agents.delete(agentId);
  }

  updateStatus(agentId, status) {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.status = status;
  }
}

module.exports = { CapabilityRegistry };
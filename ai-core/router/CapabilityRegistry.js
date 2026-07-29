// D:\hospital backend\ai-core\router\CapabilityRegistry.ts

import { AgentRegistration, AgentCapability, AgentRole, AgentStatus } from '../../shared/types/AgentTypes';

interface CapabilityIndex {
  [capabilityName: string]: string[];
}

export class CapabilityRegistry {
  private agents: Map<string, AgentRegistration> = new Map();
  private capabilityIndex: CapabilityIndex = {};
  private roleMapping: Map<AgentRole, string[]> = new Map();

  register(agent: AgentRegistration): void {
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
    this.roleMapping.get(agent.role)!.push(agent.id);
  }

  findAgentForTask(capability: string, role?: AgentRole): AgentRegistration | null {
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
      .map(id => this.agents.get(id)!)
      .filter(agent => agent.status === AgentStatus.ONLINE || agent.status === AgentStatus.IDLE)
      .sort((a, b) => {
        const capA = a.capabilities.find(c => c.name === capability);
        const capB = b.capabilities.find(c => c.name === capability);
        return (capA?.priority || 999) - (capB?.priority || 999);
      })[0] || null;

    return result;
  }

  // ✅ ADD THIS METHOD:
  getAgent(id: string): AgentRegistration | null {
    return this.agents.get(id) || null;
  }

  getAgentsByRole(role: AgentRole): AgentRegistration[] {
    const ids = this.roleMapping.get(role) || [];
    return ids.map(id => this.agents.get(id)!).filter(Boolean);
  }

  getAllAgents(): AgentRegistration[] {
    return Array.from(this.agents.values());
  }

  getAgentCapabilities(agentId: string): AgentCapability[] {
    const agent = this.agents.get(agentId);
    return agent ? agent.capabilities : [];
  }

  unregister(agentId: string): void {
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

  updateStatus(agentId: string, status: AgentStatus): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.status = status;
  }
}
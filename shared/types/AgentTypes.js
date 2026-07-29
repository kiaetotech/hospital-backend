// packages/shared/types/AgentTypes.ts

export enum AgentRole {
  // Level 1 - Business Agents
  HOSPITAL = 'hospital',
  DOCTOR = 'doctor',
  DIAGNOSTICS = 'diagnostics',
  AMBULANCE = 'ambulance',
  INSURANCE = 'insurance',
  PHARMACY = 'pharmacy',
  CAREGIVER = 'caregiver',
  WELLNESS = 'wellness',
  
  // Level 2 - Operations Agents
  FINANCE = 'finance',
  CRM = 'crm',
  MARKETING = 'marketing',
  SUPPORT = 'support',
  ANALYTICS = 'analytics',
  
  // Level 3 - Intelligence Agents
  SEARCH_INTELLIGENCE = 'search_intelligence',
  RECOMMENDATION = 'recommendation',
  WORKFLOW = 'workflow',
  MEMORY = 'memory',
  NOTIFICATION = 'notification',
  
  // Executive
  CEO = 'ceo',
  STRATEGY = 'strategy'
}

export enum AgentStatus {
  ONLINE = 'online',
  BUSY = 'busy',
  IDLE = 'idle',
  DEGRADED = 'degraded',
  OFFLINE = 'offline',
  STOPPED = 'stopped'
}

export enum ProviderType {
  GROQ = 'groq',
  OLLAMA = 'ollama',
  GEMINI = 'gemini',
  OPENROUTER = 'openrouter',
  CLAUDE = 'claude',
  GPT = 'gpt'
}

export interface AgentCapability {
  name: string;
  description: string;
  priority: number;
  estimatedLatency: number; // ms
  requiresAuth: boolean;
}

export interface AgentRegistration {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  capabilities: AgentCapability[];
  currentTask?: string;
  lastActive: Date;
  metadata: Record<string, any>;
}

export interface AgentRequest {
  id: string;
  task: string;
  payload: Record<string, any>;
  critical: boolean;
  timeout: number;
  maxRetries: number;
}

export interface AgentResponse {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  sourceAgent: string;
  processingTime: number;
  providerUsed?: ProviderType;
}
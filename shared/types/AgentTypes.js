// D:\hospital backend\shared\types\AgentTypes.js

const AgentRole = {
  HOSPITAL: 'hospital',
  DOCTOR: 'doctor',
  DIAGNOSTICS: 'diagnostics',
  AMBULANCE: 'ambulance',
  INSURANCE: 'insurance',
  PHARMACY: 'pharmacy',
  CAREGIVER: 'caregiver',
  WELLNESS: 'wellness',
  FINANCE: 'finance',
  CRM: 'crm',
  MARKETING: 'marketing',
  SUPPORT: 'support',
  ANALYTICS: 'analytics',
  SEARCH_INTELLIGENCE: 'search_intelligence',
  RECOMMENDATION: 'recommendation',
  WORKFLOW: 'workflow',
  MEMORY: 'memory',
  NOTIFICATION: 'notification',
  CEO: 'ceo',
  STRATEGY: 'strategy'
};

const AgentStatus = {
  ONLINE: 'online',
  BUSY: 'busy',
  IDLE: 'idle',
  DEGRADED: 'degraded',
  OFFLINE: 'offline',
  STOPPED: 'stopped'
};

const ProviderType = {
  GROQ: 'groq',
  OLLAMA: 'ollama',
  GEMINI: 'gemini',
  OPENROUTER: 'openrouter',
  CLAUDE: 'claude',
  GPT: 'gpt'
};

module.exports = {
  AgentRole,
  AgentStatus,
  ProviderType
};
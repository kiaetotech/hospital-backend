// D:\hospital backend\ai-core\index.ts

export { AIRouter } from './router/AIRouter';
export { Orchestrator } from './router/Orchestrator';
export { CapabilityRegistry } from './router/CapabilityRegistry';

export { ProviderManager } from './providers/ProviderManager';

export { BaseAgent } from './agents/base/BaseAgent';

// Business Agents
export { HospitalAgent } from './agents/business/HospitalAgent';
export { DoctorAgent } from './agents/business/DoctorAgent';
export { DiagnosticsAgent } from './agents/business/DiagnosticsAgent';
export { AmbulanceAgent } from './agents/business/AmbulanceAgent';
export { InsuranceAgent } from './agents/business/InsuranceAgent';
export { PharmacyAgent } from './agents/business/PharmacyAgent';
export { CaregiverAgent } from './agents/business/CaregiverAgent';
export { WellnessAgent } from './agents/business/WellnessAgent';

// Operations Agents
export { FinanceAgent } from './agents/operations/FinanceAgent';
export { CRMAgent } from './agents/operations/CRMAgent';
export { MarketingAgent } from './agents/operations/MarketingAgent';
export { SupportAgent } from './agents/operations/SupportAgent';
export { AnalyticsAgent } from './agents/operations/AnalyticsAgent';

// Intelligence Agents
export { SearchIntelligenceAgent } from './agents/intelligence/SearchIntelligenceAgent';
export { RecommendationAgent } from './agents/intelligence/RecommendationAgent';
export { WorkflowAgent } from './agents/intelligence/WorkflowAgent';
export { MemoryAgent } from './agents/intelligence/MemoryAgent';
export { NotificationAgent } from './agents/intelligence/NotificationAgent';

// Executive Agents
export { CEOAgent } from './agents/executive/CEOAgent';
export { StrategyAgent } from './agents/executive/StrategyAgent';

// Monitoring
export { MonitoringAggregationService } from './monitoring/MonitoringAggregationService';
export { HealthManager } from './monitoring/HealthManager';
export { BudgetManager } from './monitoring/BudgetManager';
export { QueueManager } from './monitoring/QueueManager';

// Recovery
export { CircuitBreaker } from './recovery/CircuitBreaker';
export { RetryPolicy } from './recovery/RetryPolicy';
export { FallbackHandler } from './recovery/FallbackHandler';



// D:\hospital backend\ai-core\index.js

const { AIRouter } = require('./router/AIRouter.js');
const { Orchestrator } = require('./router/Orchestrator.js');
const { CapabilityRegistry } = require('./router/CapabilityRegistry.js');
const { ProviderManager } = require('./providers/ProviderManager.js');
const { BaseAgent } = require('./agents/base/BaseAgent.js');
const { HospitalAgent } = require('./agents/business/HospitalAgent.js');
const { DoctorAgent } = require('./agents/business/DoctorAgent.js');
const { DiagnosticsAgent } = require('./agents/business/DiagnosticsAgent.js');
const { AmbulanceAgent } = require('./agents/business/AmbulanceAgent.js');
const { InsuranceAgent } = require('./agents/business/InsuranceAgent.js');
const { CaregiverAgent } = require('./agents/business/CaregiverAgent.js');
const { WellnessAgent } = require('./agents/business/WellnessAgent.js');
const { FinanceAgent } = require('./agents/operations/FinanceAgent.js');
const { CRMAgent } = require('./agents/operations/CRMAgent.js');
const { MarketingAgent } = require('./agents/operations/MarketingAgent.js');
const { SupportAgent } = require('./agents/operations/SupportAgent.js');
const { AnalyticsAgent } = require('./agents/operations/AnalyticsAgent.js');
const { CorporateHealthAgent } = require('./agents/operations/CorporateHealthAgent.js');
const { SearchIntelligenceAgent } = require('./agents/intelligence/SearchIntelligenceAgent.js');
const { RecommendationAgent } = require('./agents/intelligence/RecommendationAgent.js');
const { WorkflowAgent } = require('./agents/intelligence/WorkflowAgent.js');
const { MemoryAgent } = require('./agents/intelligence/MemoryAgent.js');
const { NotificationAgent } = require('./agents/intelligence/NotificationAgent.js');
const { CEOAgent } = require('./agents/executive/CEOAgent.js');
const { StrategyAgent } = require('./agents/executive/StrategyAgent.js');
const { MonitoringAggregationService } = require('./monitoring/MonitoringAggregationService.js');
const { HealthManager } = require('./monitoring/HealthManager.js');
const { BudgetManager } = require('./monitoring/BudgetManager.js');
const { QueueManager } = require('./monitoring/QueueManager.js');
const { CircuitBreaker } = require('./recovery/CircuitBreaker.js');
const { RetryPolicy } = require('./recovery/RetryPolicy.js');
const { FallbackHandler } = require('./recovery/FallbackHandler.js');

module.exports = {
    AIRouter,
    Orchestrator,
    CapabilityRegistry,
    ProviderManager,
    BaseAgent,
    HospitalAgent,
    DoctorAgent,
    DiagnosticsAgent,
    AmbulanceAgent,
    InsuranceAgent,
    CaregiverAgent,
    WellnessAgent,
    FinanceAgent,
    CRMAgent,
    MarketingAgent,
    SupportAgent,
    AnalyticsAgent,
    CorporateHealthAgent,
    SearchIntelligenceAgent,
    RecommendationAgent,
    WorkflowAgent,
    MemoryAgent,
    NotificationAgent,
    CEOAgent,
    StrategyAgent,
    MonitoringAggregationService,
    HealthManager,
    BudgetManager,
    QueueManager,
    CircuitBreaker,
    RetryPolicy,
    FallbackHandler
};
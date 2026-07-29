"use strict";
// packages/shared/types/AgentTypes.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderType = exports.AgentStatus = exports.AgentRole = void 0;
var AgentRole;
(function (AgentRole) {
    // Level 1 - Business Agents
    AgentRole["HOSPITAL"] = "hospital";
    AgentRole["DOCTOR"] = "doctor";
    AgentRole["DIAGNOSTICS"] = "diagnostics";
    AgentRole["AMBULANCE"] = "ambulance";
    AgentRole["INSURANCE"] = "insurance";
    AgentRole["PHARMACY"] = "pharmacy";
    AgentRole["CAREGIVER"] = "caregiver";
    AgentRole["WELLNESS"] = "wellness";
    // Level 2 - Operations Agents
    AgentRole["FINANCE"] = "finance";
    AgentRole["CRM"] = "crm";
    AgentRole["MARKETING"] = "marketing";
    AgentRole["SUPPORT"] = "support";
    AgentRole["ANALYTICS"] = "analytics";
    // Level 3 - Intelligence Agents
    AgentRole["SEARCH_INTELLIGENCE"] = "search_intelligence";
    AgentRole["RECOMMENDATION"] = "recommendation";
    AgentRole["WORKFLOW"] = "workflow";
    AgentRole["MEMORY"] = "memory";
    AgentRole["NOTIFICATION"] = "notification";
    // Executive
    AgentRole["CEO"] = "ceo";
    AgentRole["STRATEGY"] = "strategy";
})(AgentRole || (exports.AgentRole = AgentRole = {}));
var AgentStatus;
(function (AgentStatus) {
    AgentStatus["ONLINE"] = "online";
    AgentStatus["BUSY"] = "busy";
    AgentStatus["IDLE"] = "idle";
    AgentStatus["DEGRADED"] = "degraded";
    AgentStatus["OFFLINE"] = "offline";
    AgentStatus["STOPPED"] = "stopped";
})(AgentStatus || (exports.AgentStatus = AgentStatus = {}));
var ProviderType;
(function (ProviderType) {
    ProviderType["GROQ"] = "groq";
    ProviderType["OLLAMA"] = "ollama";
    ProviderType["GEMINI"] = "gemini";
    ProviderType["OPENROUTER"] = "openrouter";
    ProviderType["CLAUDE"] = "claude";
    ProviderType["GPT"] = "gpt";
})(ProviderType || (exports.ProviderType = ProviderType = {}));

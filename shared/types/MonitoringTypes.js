// D:\hospital backend\shared\types\MonitoringTypes.js

/**
 * @typedef {Object} AgentHealth
 * @property {string} agentId
 * @property {'healthy'|'degraded'|'unhealthy'} status
 * @property {number} uptime - seconds
 * @property {number} responseTime - ms
 * @property {number} errorRate - percentage
 * @property {Date} lastCheck
 * @property {Object<string, any>} details
 */

/**
 * @typedef {Object} AgentCost
 * @property {string} agentId
 * @property {string} provider
 * @property {number} tokensUsed
 * @property {number} costInr
 * @property {number} dailyCostInr
 * @property {number} weeklyCostInr
 * @property {number} monthlyCostInr
 * @property {number} budgetRemaining
 * @property {number} budgetPercentage
 */

/**
 * @typedef {Object} AgentQueue
 * @property {string} queueName
 * @property {number} depth
 * @property {number} processingPerMinute
 * @property {number} delayed
 * @property {number} failed
 * @property {number} deadLetter
 */

/**
 * @typedef {Object} AgentMemory
 * @property {number} totalEntries
 * @property {number} sizeMB
 * @property {number} indexedTerms
 * @property {'patient'|'session'|'conversation'|'preference'} type
 */

/**
 * @typedef {Object} MonitoringSnapshot
 * @property {Date} timestamp
 * @property {Object<string, {status: string, health: AgentHealth, cost: AgentCost, queues: AgentQueue[], memory: AgentMemory[]}>} agents
 * @property {Object} systemHealth
 * @property {number} totalCostToday
 * @property {number} totalRequestsToday
 * @property {number} activeAgentsCount
 */

/**
 * @typedef {Object} HealthCheckResult
 * @property {string} service
 * @property {'healthy'|'degraded'|'unhealthy'} status
 * @property {number} responseTime
 * @property {Object<string, any>} details
 */

// Export empty objects as placeholders (the JSDoc comments above define the types)
const AgentHealth = {};
const AgentCost = {};
const AgentQueue = {};
const AgentMemory = {};
const MonitoringSnapshot = {};
const HealthCheckResult = {};

module.exports = {
  AgentHealth,
  AgentCost,
  AgentQueue,
  AgentMemory,
  MonitoringSnapshot,
  HealthCheckResult
};
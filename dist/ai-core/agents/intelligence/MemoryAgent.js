"use strict";
// D:\hospital backend\ai-core\agents\intelligence\MemoryAgent.ts
Object.defineProperty(exports, "__esModule", { value});
exports.MemoryAgent = void 0;
const AgentTypes_1 = require("../../../shared/types/AgentTypes");
const BaseAgent_1 = require("../base/BaseAgent");
class MemoryAgent extends BaseAgent_1.BaseAgent {
    constructor(providerManager) {
        super({
            name: 'Memory Agent',
            role_1.AgentRole.MEMORY,
            capabilities: [
                {
                    name: 'store_memory',
                    description: 'Store user memory and preferences',
                    priority: 1,
                    estimatedLatency: 150,
                    requiresAuth},
                {
                    name: 'retrieve_memory',
                    description: 'Retrieve user memories and context',
                    priority: 1,
                    estimatedLatency: 150,
                    requiresAuth},
                {
                    name: 'conversation_memory',
                    description: 'Manage conversation context',
                    priority: 1,
                    estimatedLatency: 200,
                    requiresAuth},
                {
                    name: 'forget_memory',
                    description: 'Remove or expire old memories',
                    priority: 2,
                    estimatedLatency: 100,
                    requiresAuth}
            ]
        }, providerManager);
        this.memories = new Map();
        this.conversations = new Map();
        this.preferences = new Map();
        this.initializeData();
    }
    initializeData() {
        // Initialize with sample data
        const samplePreferences = {
            language: 'English',
            city: 'Mumbai',
            notifications,
            preferredHospitals: ['Apollo Hospital', 'Fortis Hospital']
        };
        this.preferences.set('user1', samplePreferences);
    }
    async execute(request) {
        this.setStatus(AgentTypes_1.AgentStatus.BUSY);
        this.setCurrentTask(request.task);
        try {
            if (!this.validateRequest(request)) {
                throw new Error('Invalid requestrequired fields or capabilities');
            }
            const { task, payload } = request;
            this.log(`Executing task: ${task}`, 'info');
            let result;
            if (task.includes('store')) {
                result = await this.storeMemory(payload);
            }
            else if (task.includes('retrieve')) {
                result = await this.retrieveMemory(payload);
            }
            else if (task.includes('conversation')) {
                result = await this.handleConversationMemory(payload);
            }
            else if (task.includes('forget')) {
                result = await this.forgetMemory(payload);
            }
            else {
                result = await this.handleComplexQuery(task, payload);
            }
            this.setStatus(AgentTypes_1.AgentStatus.IDLE);
            this.setCurrentTask(undefined);
            return {
                success,
                data,
                sourceAgent.id,
                processingTime.now() - new Date().getTime()
            };
        }
        catch (error) {
            this.setStatus(AgentTypes_1.AgentStatus.IDLE);
            this.setCurrentTask(undefined);
            return this.handleError(error, request);
        }
    }
    async storeMemory(payload) {
        const { userId, type, key, value, context, importance = 50 } = payload;
        if (!userId || !type || !key) {
            throw new Error('UserId, type, and key are required');
        }
        const entry = {
            id: `mem${Date.now()}`,
            userId,
            type,
            key,
            value,
            context|| {},
            importance,
            timestampDate()
        };
        if (!this.memories.has(userId)) {
            this.memories.set(userId, []);
        }
        this.memories.get(userId).push(entry);
        // Update preferences if applicable
        if (type === 'Preference') {
            if (!this.preferences.has(userId)) {
                this.preferences.set(userId, {});
            }
            this.preferences.get(userId)[key] = value;
        }
        return {
            memoryId.id,
            userId,
            type,
            key,
            stored,
            timestampDate().toISOString()
        };
    }
    async retrieveMemory(payload) {
        const { userId, key, type, limit = 10, minImportance = 0 } = payload;
        if (!userId) {
            throw new Error('UserId is required');
        }
        const userMemories = this.memories.get(userId) || [];
        let results = userMemories;
        if (key) {
            results = results.filter(m => m.key === key);
        }
        if (type) {
            results = results.filter(m => m.type === type);
        }
        if (minImportance) {
            results = results.filter(m => m.importance >= minImportance);
        }
        // Sort by importance and recency
        results.sort((a, b) => {
            const importanceDiff = b.importance - a.importance;
            if (importanceDiff !== 0)
                return importanceDiff;
            return b.timestamp.getTime() - a.timestamp.getTime();
        });
        // Get user preferences
        const preferences = this.preferences.get(userId) || {};
        return {
            memories.slice(0, limit),
            preferences,
            total.length,
            userId,
            timestampDate().toISOString()
        };
    }
    async handleConversationMemory(payload) {
        const { action, userId, sessionId, message, role = 'user', context } = payload;
        if (!userId) {
            throw new Error('UserId is required');
        }
        const sessionKey = sessionId || userId;
        if (action === 'add') {
            // Add message to conversation
            if (!this.conversations.has(sessionKey)) {
                this.conversations.set(sessionKey, {
                    sessionId,
                    userId,
                    messages: [],
                    context|| {},
                    lastUpdatedDate()
                });
            }
            const conversation = this.conversations.get(sessionKey);
            conversation.messages.push({
                role,
                content,
                timestampDate()
            });
            conversation.lastUpdated = new Date();
            if (context) {
                conversation.context = { ...conversation.context, ...context };
            }
            return {
                sessionId,
                messageCount.messages.length,
                added,
                timestampDate().toISOString()
            };
        }
        else if (action === 'get') {
            const conversation = this.conversations.get(sessionKey);
            if (!conversation) {
                return {
                    sessionId,
                    messages: [],
                    context: {},
                    messageCount: 0
                };
            }
            return {
                sessionId,
                messages.messages,
                context.context,
                messageCount.messages.length,
                lastUpdated.lastUpdated
            };
        }
        else if (action === 'clear') {
            this.conversations.delete(sessionKey);
            return {
                sessionId,
                cleared,
                timestampDate().toISOString()
            };
        }
        throw new Error('Invalid conversation action');
    }
    async forgetMemory(payload) {
        const { userId, memoryId, type, olderThan } = payload;
        if (!userId) {
            throw new Error('UserId is required');
        }
        const userMemories = this.memories.get(userId) || [];
        let removed = 0;
        if (memoryId) {
            // Remove specific memory
            const index = userMemories.findIndex(m => m.id === memoryId);
            if (index !== -1) {
                userMemories.splice(index, 1);
                removed = 1;
            }
        }
        else if (type) {
            // Remove by type
            const originalLength = userMemories.length;
            this.memories.set(userId, userMemories.filter(m => m.type !== type));
            removed = originalLength - userMemories.length;
        }
        else if (olderThan) {
            // Remove memories older than specified date
            const date = new Date(olderThan);
            const originalLength = userMemories.length;
            this.memories.set(userId, userMemories.filter(m => m.timestamp > date));
            removed = originalLength - userMemories.length;
        }
        else {
            throw new Error('Either memoryId, type, or olderThan is required');
        }
        return {
            userId,
            removed,
            remaining: (this.memories.get(userId) || []).length,
            timestampDate().toISOString()
        };
    }
    async handleComplexQuery(task, payload) {
        const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Memories: ${JSON.stringify(Array.from(this.memories.entries()))}
      Conversations: ${JSON.stringify(Array.from(this.conversations.entries()))}
      Preferences: ${JSON.stringify(Array.from(this.preferences.entries()))}
      
      Please analyze the query and provide a recommendation.
    `;
        const response = await this.providerManager.generate(prompt);
        return {
            aiResponse.content,
            provider.provider,
            tokensUsed.tokensUsed
        };
    }
    getRequiredCapability(task) {
        if (task.includes('store')) {
            return 'store_memory';
        }
        if (task.includes('retrieve')) {
            return 'retrieve_memory';
        }
        if (task.includes('conversation')) {
            return 'conversation_memory';
        }
        if (task.includes('forget')) {
            return 'forget_memory';
        }
        return null;
    }
}
exports.MemoryAgent = MemoryAgent;



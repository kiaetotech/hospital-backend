// D:\hospital backend\ai-core\agents\intelligence\MemoryAgent.ts

import { AgentRole, AgentStatus, AgentRequest, AgentResponse } from '../../../shared/types/AgentTypes';
import { BaseAgent } from '../base/BaseAgent';
import { ProviderManager } from '../../providers/ProviderManager';

interface MemoryEntry {
  id: string;
  userId: string;
  type: 'Preference' | 'Search' | 'Booking' | 'Interaction' | 'Feedback';
  key: string;
  value: any;
  context: Record<string, any>;
  importance: number;
  timestamp: Date;
  expiresAt?: Date;
}

interface ConversationMemory {
  sessionId: string;
  userId: string;
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }[];
  context: Record<string, any>;
  lastUpdated: Date;
}

export class MemoryAgent extends BaseAgent {
  private memories: Map<string, MemoryEntry[]> = new Map();
  private conversations: Map<string, ConversationMemory> = new Map();
  private preferences: Map<string, Record<string, any>> = new Map();

  constructor(providerManager: ProviderManager) {
    super(
      {
        name: 'Memory Agent',
        role: AgentRole.MEMORY,
        capabilities: [
          {
            name: 'store_memory',
            description: 'Store user memory and preferences',
            priority: 1,
            estimatedLatency: 150,
            requiresAuth: true
          },
          {
            name: 'retrieve_memory',
            description: 'Retrieve user memories and context',
            priority: 1,
            estimatedLatency: 150,
            requiresAuth: true
          },
          {
            name: 'conversation_memory',
            description: 'Manage conversation context',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth: true
          },
          {
            name: 'forget_memory',
            description: 'Remove or expire old memories',
            priority: 2,
            estimatedLatency: 100,
            requiresAuth: true
          }
        ]
      },
      providerManager
    );

    this.initializeData();
  }

  private initializeData(): void {
    // Initialize with sample data
    const samplePreferences: Record<string, any> = {
      language: 'English',
      city: 'Mumbai',
      notifications: true,
      preferredHospitals: ['Apollo Hospital', 'Fortis Hospital']
    };
    this.preferences.set('user1', samplePreferences);
  }

  async execute(request: AgentRequest): Promise<AgentResponse> {
    this.setStatus(AgentStatus.BUSY);
    this.setCurrentTask(request.task);

    try {
      if (!this.validateRequest(request)) {
        throw new Error('Invalid request: Missing required fields or capabilities');
      }

      const { task, payload } = request;
      this.log(`Executing task: ${task}`, 'info');

      let result: any;

      if (task.includes('store')) {
        result = await this.storeMemory(payload);
      } else if (task.includes('retrieve')) {
        result = await this.retrieveMemory(payload);
      } else if (task.includes('conversation')) {
        result = await this.handleConversationMemory(payload);
      } else if (task.includes('forget')) {
        result = await this.forgetMemory(payload);
      } else {
        result = await this.handleComplexQuery(task, payload);
      }

      this.setStatus(AgentStatus.IDLE);
      this.setCurrentTask(undefined);

      return {
        success: true,
        data: result,
        sourceAgent: this.id,
        processingTime: Date.now() - new Date().getTime()
      };

    } catch (error) {
      this.setStatus(AgentStatus.IDLE);
      this.setCurrentTask(undefined);
      return this.handleError(error, request);
    }
  }

  private async storeMemory(payload: any): Promise<any> {
    const { userId, type, key, value, context, importance = 50 } = payload;

    if (!userId || !type || !key) {
      throw new Error('UserId, type, and key are required');
    }

    const entry: MemoryEntry = {
      id: `mem${Date.now()}`,
      userId,
      type,
      key,
      value,
      context: context || {},
      importance,
      timestamp: new Date()
    };

    if (!this.memories.has(userId)) {
      this.memories.set(userId, []);
    }
    this.memories.get(userId)!.push(entry);

    // Update preferences if applicable
    if (type === 'Preference') {
      if (!this.preferences.has(userId)) {
        this.preferences.set(userId, {});
      }
      this.preferences.get(userId)![key] = value;
    }

    return {
      memoryId: entry.id,
      userId,
      type,
      key,
      stored: true,
      timestamp: new Date().toISOString()
    };
  }

  private async retrieveMemory(payload: any): Promise<any> {
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
      if (importanceDiff !== 0) return importanceDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    // Get user preferences
    const preferences = this.preferences.get(userId) || {};

    return {
      memories: results.slice(0, limit),
      preferences,
      total: results.length,
      userId,
      timestamp: new Date().toISOString()
    };
  }

  private async handleConversationMemory(payload: any): Promise<any> {
    const { action, userId, sessionId, message, role = 'user', context } = payload;

    if (!userId) {
      throw new Error('UserId is required');
    }

    const sessionKey = sessionId || userId;

    if (action === 'add') {
      // Add message to conversation
      if (!this.conversations.has(sessionKey)) {
        this.conversations.set(sessionKey, {
          sessionId: sessionKey,
          userId,
          messages: [],
          context: context || {},
          lastUpdated: new Date()
        });
      }

      const conversation = this.conversations.get(sessionKey)!;
      conversation.messages.push({
        role,
        content: message,
        timestamp: new Date()
      });
      conversation.lastUpdated = new Date();

      if (context) {
        conversation.context = { ...conversation.context, ...context };
      }

      return {
        sessionId: sessionKey,
        messageCount: conversation.messages.length,
        added: true,
        timestamp: new Date().toISOString()
      };

    } else if (action === 'get') {
      const conversation = this.conversations.get(sessionKey);
      if (!conversation) {
        return {
          sessionId: sessionKey,
          messages: [],
          context: {},
          messageCount: 0
        };
      }

      return {
        sessionId: sessionKey,
        messages: conversation.messages,
        context: conversation.context,
        messageCount: conversation.messages.length,
        lastUpdated: conversation.lastUpdated
      };

    } else if (action === 'clear') {
      this.conversations.delete(sessionKey);
      return {
        sessionId: sessionKey,
        cleared: true,
        timestamp: new Date().toISOString()
      };
    }

    throw new Error('Invalid conversation action');
  }

  private async forgetMemory(payload: any): Promise<any> {
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
    } else if (type) {
      // Remove by type
      const originalLength = userMemories.length;
      this.memories.set(
        userId,
        userMemories.filter(m => m.type !== type)
      );
      removed = originalLength - userMemories.length;
    } else if (olderThan) {
      // Remove memories older than specified date
      const date = new Date(olderThan);
      const originalLength = userMemories.length;
      this.memories.set(
        userId,
        userMemories.filter(m => m.timestamp > date)
      );
      removed = originalLength - userMemories.length;
    } else {
      throw new Error('Either memoryId, type, or olderThan is required');
    }

    return {
      userId,
      removed,
      remaining: (this.memories.get(userId) || []).length,
      timestamp: new Date().toISOString()
    };
  }

  private async handleComplexQuery(task: string, payload: any): Promise<any> {
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
      aiResponse: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed
    };
  }

  protected getRequiredCapability(task: string): string | null {
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
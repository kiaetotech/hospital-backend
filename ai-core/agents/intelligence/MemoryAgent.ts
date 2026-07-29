// D:\hospital backend\ai-core\agents\intelligence\MemoryAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');

class MemoryAgent extends BaseAgent {
  constructor(providerManager) {
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

    this.memories = new Map();
    this.conversations = new Map();
    this.preferences = new Map();
    this.initializeData();
  }

  initializeData() {
    var samplePreferences = {
      language: 'English',
      city: 'Mumbai',
      notifications: true,
      preferredHospitals: ['Apollo Hospital', 'Fortis Hospital']
    };
    this.preferences.set('user1', samplePreferences);
  }

  async execute(request) {
    this.setStatus(AgentStatus.BUSY);
    this.setCurrentTask(request.task);

    try {
      if (!this.validateRequest(request)) {
        throw new Error('Invalid request: Missing required fields or capabilities');
      }

      var task = request.task;
      var payload = request.payload;
      this.log('Executing task: ' + task, 'info');

      var result;

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
      this.setCurrentTask(null);

      return {
        success: true,
        data: result,
        sourceAgent: this.id,
        processingTime: Date.now() - new Date().getTime()
      };

    } catch (error) {
      this.setStatus(AgentStatus.IDLE);
      this.setCurrentTask(null);
      return this.handleError(error, request);
    }
  }

  async storeMemory(payload) {
    var userId = payload.userId;
    var type = payload.type;
    var key = payload.key;
    var value = payload.value;
    var context = payload.context;
    var importance = payload.importance || 50;

    if (!userId || !type || !key) {
      throw new Error('UserId, type, and key are required');
    }

    var entry = {
      id: 'mem' + Date.now(),
      userId: userId,
      type: type,
      key: key,
      value: value,
      context: context || {},
      importance: importance,
      timestamp: new Date()
    };

    if (!this.memories.has(userId)) {
      this.memories.set(userId, []);
    }
    this.memories.get(userId).push(entry);

    if (type === 'Preference') {
      if (!this.preferences.has(userId)) {
        this.preferences.set(userId, {});
      }
      this.preferences.get(userId)[key] = value;
    }

    return {
      memoryId: entry.id,
      userId: userId,
      type: type,
      key: key,
      stored: true,
      timestamp: new Date().toISOString()
    };
  }

  async retrieveMemory(payload) {
    var userId = payload.userId;
    var key = payload.key;
    var type = payload.type;
    var limit = payload.limit || 10;
    var minImportance = payload.minImportance || 0;

    if (!userId) {
      throw new Error('UserId is required');
    }

    var userMemories = this.memories.get(userId) || [];
    var results = userMemories.slice();

    if (key) {
      results = results.filter(function(m) { return m.key === key; });
    }

    if (type) {
      results = results.filter(function(m) { return m.type === type; });
    }

    if (minImportance) {
      results = results.filter(function(m) { return m.importance >= minImportance; });
    }

    results.sort(function(a, b) {
      var importanceDiff = b.importance - a.importance;
      if (importanceDiff !== 0) return importanceDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    var preferences = this.preferences.get(userId) || {};

    return {
      memories: results.slice(0, limit),
      preferences: preferences,
      total: results.length,
      userId: userId,
      timestamp: new Date().toISOString()
    };
  }

  async handleConversationMemory(payload) {
    var action = payload.action;
    var userId = payload.userId;
    var sessionId = payload.sessionId;
    var message = payload.message;
    var role = payload.role || 'user';
    var context = payload.context;

    if (!userId) {
      throw new Error('UserId is required');
    }

    var sessionKey = sessionId || userId;

    if (action === 'add') {
      if (!this.conversations.has(sessionKey)) {
        this.conversations.set(sessionKey, {
          sessionId: sessionKey,
          userId: userId,
          messages: [],
          context: context || {},
          lastUpdated: new Date()
        });
      }

      var conversation = this.conversations.get(sessionKey);
      conversation.messages.push({
        role: role,
        content: message,
        timestamp: new Date()
      });
      conversation.lastUpdated = new Date();

      if (context) {
        var existingContext = conversation.context;
        var contextKeys = Object.keys(context);
        for (var i = 0; i < contextKeys.length; i++) {
          existingContext[contextKeys[i]] = context[contextKeys[i]];
        }
      }

      return {
        sessionId: sessionKey,
        messageCount: conversation.messages.length,
        added: true,
        timestamp: new Date().toISOString()
      };

    } else if (action === 'get') {
      var conv = this.conversations.get(sessionKey);
      if (!conv) {
        return {
          sessionId: sessionKey,
          messages: [],
          context: {},
          messageCount: 0
        };
      }

      return {
        sessionId: sessionKey,
        messages: conv.messages,
        context: conv.context,
        messageCount: conv.messages.length,
        lastUpdated: conv.lastUpdated
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

  async forgetMemory(payload) {
    var userId = payload.userId;
    var memoryId = payload.memoryId;
    var type = payload.type;
    var olderThan = payload.olderThan;

    if (!userId) {
      throw new Error('UserId is required');
    }

    var userMemories = this.memories.get(userId) || [];
    var removed = 0;

    if (memoryId) {
      var index = -1;
      for (var i = 0; i < userMemories.length; i++) {
        if (userMemories[i].id === memoryId) {
          index = i;
          break;
        }
      }
      if (index !== -1) {
        userMemories.splice(index, 1);
        removed = 1;
      }
    } else if (type) {
      var originalLength = userMemories.length;
      this.memories.set(userId, userMemories.filter(function(m) { return m.type !== type; }));
      removed = originalLength - (this.memories.get(userId) || []).length;
    } else if (olderThan) {
      var date = new Date(olderThan);
      var origLen = userMemories.length;
      this.memories.set(userId, userMemories.filter(function(m) { return m.timestamp > date; }));
      removed = origLen - (this.memories.get(userId) || []).length;
    } else {
      throw new Error('Either memoryId, type, or olderThan is required');
    }

    return {
      userId: userId,
      removed: removed,
      remaining: (this.memories.get(userId) || []).length,
      timestamp: new Date().toISOString()
    };
  }

  async handleComplexQuery(task, payload) {
    var prompt = 'Task: ' + task + '\n' +
      'Payload: ' + JSON.stringify(payload) + '\n\n' +
      'Memories: ' + JSON.stringify(Array.from(this.memories.entries())) + '\n' +
      'Conversations: ' + JSON.stringify(Array.from(this.conversations.entries())) + '\n' +
      'Preferences: ' + JSON.stringify(Array.from(this.preferences.entries())) + '\n\n' +
      'Please analyze the query and provide a recommendation.';

    var response = await this.providerManager.generate(prompt);

    return {
      aiResponse: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed
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

module.exports = { MemoryAgent };
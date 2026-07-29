// D:\hospital backend\ai-core\agents\intelligence\NotificationAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');

class NotificationAgent extends BaseAgent {
  constructor(providerManager) {
    super(
      {
        name: 'Notification Agent',
        role: AgentRole.NOTIFICATION,
        capabilities: [
          {
            name: 'send_notification',
            description: 'Send notification via optimal channel',
            priority: 1,
            estimatedLatency: 300,
            requiresAuth: true
          },
          {
            name: 'get_preferences',
            description: 'Get user notification preferences',
            priority: 2,
            estimatedLatency: 150,
            requiresAuth: true
          },
          {
            name: 'update_preferences',
            description: 'Update user notification preferences',
            priority: 2,
            estimatedLatency: 150,
            requiresAuth: true
          },
          {
            name: 'get_history',
            description: 'Get notification history',
            priority: 2,
            estimatedLatency: 100,
            requiresAuth: true
          }
        ]
      },
      providerManager
    );

    this.notifications = new Map();
    this.channels = new Map();
    this.userPreferences = new Map();
    this.initializeChannels();
    this.initializeUserPreferences();
  }

  initializeChannels() {
    this.channels.set('email', {
      name: 'email',
      enabled: true,
      rateLimit: 1000,
      costPerMessage: 0.001,
      quotaRemaining: 5000,
      quotaReset: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    this.channels.set('sms', {
      name: 'sms',
      enabled: true,
      rateLimit: 100,
      costPerMessage: 0.05,
      quotaRemaining: 500,
      quotaReset: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    this.channels.set('push', {
      name: 'push',
      enabled: true,
      rateLimit: 10000,
      costPerMessage: 0,
      quotaRemaining: 10000,
      quotaReset: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    this.channels.set('whatsapp', {
      name: 'whatsapp',
      enabled: true,
      rateLimit: 50,
      costPerMessage: 0.01,
      quotaRemaining: 250,
      quotaReset: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    this.channels.set('inApp', {
      name: 'inApp',
      enabled: true,
      rateLimit: 100000,
      costPerMessage: 0,
      quotaRemaining: 100000,
      quotaReset: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
  }

  initializeUserPreferences() {
    this.userPreferences.set('user1', {
      userId: 'user1',
      channels: {
        email: true,
        sms: true,
        push: true,
        whatsapp: false,
        inApp: true
      },
      preferences: {
        marketing: false,
        transactional: true,
        reminders: true,
        alerts: true
      },
      language: 'en',
      timezone: 'Asia/Kolkata'
    });
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

      if (task.includes('send')) {
        result = await this.sendNotification(payload);
      } else if (task.includes('preferences')) {
        result = await this.handlePreferences(payload);
      } else if (task.includes('history')) {
        result = await this.getHistory(payload);
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

  async sendNotification(payload) {
    var userId = payload.userId;
    var title = payload.title;
    var body = payload.body;
    var priority = payload.priority || 'Medium';
    var type = payload.type;
    var data = payload.data;

    if (!userId || !title || !body) {
      throw new Error('UserId, title, and body are required');
    }

    var preferences = this.userPreferences.get(userId) || {
      userId: userId,
      channels: { email: true, sms: false, push: true, whatsapp: false, inApp: true },
      preferences: { marketing: true, transactional: true, reminders: true, alerts: true },
      language: 'en',
      timezone: 'Asia/Kolkata'
    };

    var channel = this.selectOptimalChannel(priority, preferences, type);

    if (!channel) {
      throw new Error('No available channel for this notification');
    }

    var channelConfig = this.channels.get(channel);
    if (!channelConfig || channelConfig.quotaRemaining <= 0) {
      throw new Error('Channel ' + channel + ' quota exhausted');
    }

    var notification = {
      id: 'notif' + Date.now(),
      userId: userId,
      type: this.getNotificationType(channel),
      title: title,
      body: body,
      data: data || {},
      priority: priority,
      status: 'Pending',
      channel: channel,
      retryCount: 0,
      createdAt: new Date()
    };

    if (!this.notifications.has(userId)) {
      this.notifications.set(userId, []);
    }
    this.notifications.get(userId).push(notification);

    var sent = await this.sendViaChannel(channel, notification);

    if (sent) {
      notification.status = 'Sent';
      notification.sentAt = new Date();
      channelConfig.quotaRemaining--;
    } else {
      notification.status = 'Failed';
    }

    return {
      notificationId: notification.id,
      status: notification.status,
      channel: channel,
      timestamp: new Date().toISOString(),
      channelQuotaRemaining: channelConfig.quotaRemaining
    };
  }

  selectOptimalChannel(priority, preferences, type) {
    var channels = ['inApp', 'push', 'email', 'whatsapp', 'sms'];

    var enabledChannels = channels.filter(function(ch) {
      return preferences.channels[ch];
    });

    if (priority === 'High') {
      if (preferences.channels.whatsapp && enabledChannels.indexOf('whatsapp') !== -1) {
        return 'whatsapp';
      }
      if (preferences.channels.sms && enabledChannels.indexOf('sms') !== -1) {
        return 'sms';
      }
    }

    for (var i = 0; i < enabledChannels.length; i++) {
      var ch = enabledChannels[i];
      var config = this.channels.get(ch);
      if (config && config.quotaRemaining > 0) {
        return ch;
      }
    }

    return enabledChannels.length > 0 ? enabledChannels[0] : null;
  }

  getNotificationType(channel) {
    var map = {
      'email': 'Email',
      'sms': 'SMS',
      'push': 'Push',
      'whatsapp': 'WhatsApp',
      'inApp': 'InApp'
    };
    return map[channel] || 'InApp';
  }

  async sendViaChannel(channel, notification) {
    console.log('📤 Sending notification via ' + channel + ': ' + notification.title);

    var success = Math.random() < 0.9;

    if (success) {
      notification.deliveredAt = new Date();
    }

    await new Promise(function(resolve) { setTimeout(resolve, 100); });

    return success;
  }

  async handlePreferences(payload) {
    var action = payload.action;
    var userId = payload.userId;
    var preferences = payload.preferences;

    if (!userId) {
      throw new Error('UserId is required');
    }

    if (action === 'get') {
      var userPrefs = this.userPreferences.get(userId);
      if (!userPrefs) {
        return {
          userId: userId,
          preferences: {
            channels: { email: true, sms: false, push: true, whatsapp: false, inApp: true },
            preferences: { marketing: true, transactional: true, reminders: true, alerts: true },
            language: 'en',
            timezone: 'Asia/Kolkata'
          }
        };
      }
      return userPrefs;
    }

    if (action === 'update') {
      if (!preferences) {
        throw new Error('Preferences are required for update');
      }

      var up = this.userPreferences.get(userId);
      if (!up) {
        up = {
          userId: userId,
          channels: { email: true, sms: false, push: true, whatsapp: false, inApp: true },
          preferences: { marketing: true, transactional: true, reminders: true, alerts: true },
          language: 'en',
          timezone: 'Asia/Kolkata'
        };
      }

      if (preferences.channels) {
        var chanKeys = Object.keys(preferences.channels);
        for (var i = 0; i < chanKeys.length; i++) {
          up.channels[chanKeys[i]] = preferences.channels[chanKeys[i]];
        }
      }

      if (preferences.preferences) {
        var prefKeys = Object.keys(preferences.preferences);
        for (var j = 0; j < prefKeys.length; j++) {
          up.preferences[prefKeys[j]] = preferences.preferences[prefKeys[j]];
        }
      }

      if (preferences.language) {
        up.language = preferences.language;
      }

      if (preferences.timezone) {
        up.timezone = preferences.timezone;
      }

      this.userPreferences.set(userId, up);

      return {
        userId: userId,
        preferences: up,
        updated: true,
        timestamp: new Date().toISOString()
      };
    }

    throw new Error('Invalid preferences action');
  }

  async getHistory(payload) {
    var userId = payload.userId;
    var limit = payload.limit || 20;
    var status = payload.status;

    if (!userId) {
      throw new Error('UserId is required');
    }

    var userNotifications = this.notifications.get(userId) || [];
    var results = userNotifications.slice();

    if (status) {
      results = results.filter(function(n) { return n.status === status; });
    }

    results.sort(function(a, b) { return b.createdAt.getTime() - a.createdAt.getTime(); });

    return {
      notifications: results.slice(0, limit),
      total: results.length,
      userId: userId,
      summary: {
        sent: userNotifications.filter(function(n) { return n.status === 'Sent'; }).length,
        failed: userNotifications.filter(function(n) { return n.status === 'Failed'; }).length,
        pending: userNotifications.filter(function(n) { return n.status === 'Pending'; }).length
      }
    };
  }

  async handleComplexQuery(task, payload) {
    var prompt = 'Task: ' + task + '\n' +
      'Payload: ' + JSON.stringify(payload) + '\n\n' +
      'Notifications: ' + JSON.stringify(Array.from(this.notifications.entries())) + '\n' +
      'Channels: ' + JSON.stringify(Array.from(this.channels.entries())) + '\n' +
      'User Preferences: ' + JSON.stringify(Array.from(this.userPreferences.entries())) + '\n\n' +
      'Please analyze the query and provide a recommendation.';

    var response = await this.providerManager.generate(prompt);

    return {
      aiResponse: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed
    };
  }

  getRequiredCapability(task) {
    if (task.includes('send')) {
      return 'send_notification';
    }
    if (task.includes('preferences')) {
      return 'get_preferences';
    }
    if (task.includes('update')) {
      return 'update_preferences';
    }
    if (task.includes('history')) {
      return 'get_history';
    }
    return null;
  }
}

module.exports = { NotificationAgent };
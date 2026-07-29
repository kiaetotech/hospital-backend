// D:\hospital backend\ai-core\agents\intelligence\NotificationAgent.ts

import { AgentRole, AgentStatus, AgentRequest, AgentResponse } from '../../../shared/types/AgentTypes';
import { BaseAgent } from '../base/BaseAgent';
import { ProviderManager } from '../../providers/ProviderManager';





;
  preferences: {
    marketing;
    transactional;
    reminders;
    alerts;
  };
  language;
  timezone;
}

export class NotificationAgent extends BaseAgent {
  private notifications<string, Notification[]> = new Map();
  private channels<string, NotificationChannel> = new Map();
  private userPreferences<string, UserNotificationPreferences> = new Map();

  constructor(providerManager) {
    super(
      {
        name: 'Notification Agent',
        role.NOTIFICATION,
        capabilities: [
          {
            name: 'send_notification',
            description: 'Send notification via optimal channel',
            priority: 1,
            estimatedLatency: 300,
            requiresAuth},
          {
            name: 'get_preferences',
            description: 'Get user notification preferences',
            priority: 2,
            estimatedLatency: 150,
            requiresAuth},
          {
            name: 'update_preferences',
            description: 'Update user notification preferences',
            priority: 2,
            estimatedLatency: 150,
            requiresAuth},
          {
            name: 'get_history',
            description: 'Get notification history',
            priority: 2,
            estimatedLatency: 100,
            requiresAuth}
        ]
      },
      providerManager
    );

    this.initializeChannels();
    this.initializeUserPreferences();
  }

  private initializeChannels(){
    this.channels.set('email', {
      name: 'email',
      enabled,
      rateLimit: 1000,
      costPerMessage: 0.001,
      quotaRemaining: 5000,
      quotaResetDate(Date.now() + 24 * 60 * 60 * 1000)
    });

    this.channels.set('sms', {
      name: 'sms',
      enabled,
      rateLimit: 100,
      costPerMessage: 0.05,
      quotaRemaining: 500,
      quotaResetDate(Date.now() + 24 * 60 * 60 * 1000)
    });

    this.channels.set('push', {
      name: 'push',
      enabled,
      rateLimit: 10000,
      costPerMessage: 0,
      quotaRemaining: 10000,
      quotaResetDate(Date.now() + 24 * 60 * 60 * 1000)
    });

    this.channels.set('whatsapp', {
      name: 'whatsapp',
      enabled,
      rateLimit: 50,
      costPerMessage: 0.01,
      quotaRemaining: 250,
      quotaResetDate(Date.now() + 24 * 60 * 60 * 1000)
    });

    this.channels.set('inApp', {
      name: 'inApp',
      enabled,
      rateLimit: 100000,
      costPerMessage: 0,
      quotaRemaining: 100000,
      quotaResetDate(Date.now() + 24 * 60 * 60 * 1000)
    });
  }

  private initializeUserPreferences(){
    this.userPreferences.set('user1', {
      userId: 'user1',
      channels: {
        email,
        sms,
        push,
        whatsapp,
        inApp},
      preferences: {
        marketing,
        transactional,
        reminders,
        alerts},
      language: 'en',
      timezone: 'Asia/Kolkata'
    });
  }

  async execute(request)<AgentResponse> {
    this.setStatus(AgentStatus.BUSY);
    this.setCurrentTask(request.task);

    try {
      if (!this.validateRequest(request)) {
        throw new Error('Invalid requestrequired fields or capabilities');
      }

      const { task, payload } = request;
      this.log(`Executing task: ${task}`, 'info');

      let result;

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
      this.setCurrentTask(undefined);

      return {
        success,
        data,
        sourceAgent.id,
        processingTime.now() - new Date().getTime()
      };

    } catch (error) {
      this.setStatus(AgentStatus.IDLE);
      this.setCurrentTask(undefined);
      return this.handleError(error, request);
    }
  }

  private async sendNotification(payload)<any> {
    const { userId, title, body, priority = 'Medium', type, data } = payload;

    if (!userId || !title || !body) {
      throw new Error('UserId, title, and body are required');
    }

    // Get user preferences
    const preferences = this.userPreferences.get(userId) || {
      userId,
      channels: { email, sms, push, whatsapp, inApp},
      preferences: { marketing, transactional, reminders, alerts},
      language: 'en',
      timezone: 'Asia/Kolkata'
    };

    // Determine best channel based on priority and user preferences
    const channel = this.selectOptimalChannel(priority, preferences, type);

    if (!channel) {
      throw new Error('No available channel for this notification');
    }

    // Check channel quota
    const channelConfig = this.channels.get(channel);
    if (!channelConfig || channelConfig.quotaRemaining <= 0) {
      throw new Error(`Channel ${channel} quota exhausted`);
    }

    // Create notification
    const notification= {
      id: `notif${Date.now()}`,
      userId,
      type.getNotificationType(channel),
      title,
      body,
      data|| {},
      priority,
      status: 'Pending',
      channel,
      retryCount: 0,
      createdAtDate()
    };

    // Store notification
    if (!this.notifications.has(userId)) {
      this.notifications.set(userId, []);
    }
    this.notifications.get(userId)!.push(notification);

    // Simulate sending
    const sent = await this.sendViaChannel(channel, notification);

    if (sent) {
      notification.status = 'Sent';
      notification.sentAt = new Date();
      channelConfig.quotaRemaining--;
    } else {
      notification.status = 'Failed';
    }

    return {
      notificationId.id,
      status.status,
      channel,
      timestampDate().toISOString(),
      channelQuotaRemaining.quotaRemaining
    };
  }

  private selectOptimalChannel(
    priority,
    preferences,
    type?)| null {
    const channels = ['inApp', 'push', 'email', 'whatsapp', 'sms'];

    // Filter enabled channels
    const enabledChannels = channels.filter(ch => 
      preferences.channels[ch as keyof typeof preferences.channels]
    );

    // For high priority, prefer SMS or WhatsApp
    if (priority === 'High') {
      if (preferences.channels.whatsapp && enabledChannels.includes('whatsapp')) {
        return 'whatsapp';
      }
      if (preferences.channels.sms && enabledChannels.includes('sms')) {
        return 'sms';
      }
    }

    // Check quotas
    for (const ch of enabledChannels) {
      const config = this.channels.get(ch);
      if (config && config.quotaRemaining > 0) {
        return ch;
      }
    }

    // Fallback to first available
    return enabledChannels.length > 0 ? enabledChannels[0] ;
  }

  private getNotificationType(channel)['type'] {
    const map= {
      'email': 'Email',
      'sms': 'SMS',
      'push': 'Push',
      'whatsapp': 'WhatsApp',
      'inApp': 'InApp'
    };
    return map[channel] || 'InApp';
  }

  private async sendViaChannel(channel, notification)<boolean> {
    // Simulate channel sending
    console.log(`📤 Sending notification via ${channel}: ${notification.title}`);

    // Simulate success/failure (90% success rate)
    const success = Math.random() < 0.9;

    if (success) {
      notification.deliveredAt = new Date();
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    return success;
  }

  private async handlePreferences(payload)<any> {
    const { action, userId, preferences } = payload;

    if (!userId) {
      throw new Error('UserId is required');
    }

    if (action === 'get') {
      const userPrefs = this.userPreferences.get(userId);
      if (!userPrefs) {
        return {
          userId,
          preferences: {
            channels: { email, sms, push, whatsapp, inApp},
            preferences: { marketing, transactional, reminders, alerts},
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

      let userPrefs = this.userPreferences.get(userId);
      if (!userPrefs) {
        userPrefs = {
          userId,
          channels: { email, sms, push, whatsapp, inApp},
          preferences: { marketing, transactional, reminders, alerts},
          language: 'en',
          timezone: 'Asia/Kolkata'
        };
      }

      // Update channels
      if (preferences.channels) {
        userPrefs.channels = { ...userPrefs.channels, ...preferences.channels };
      }

      // Update preferences
      if (preferences.preferences) {
        userPrefs.preferences = { ...userPrefs.preferences, ...preferences.preferences };
      }

      // Update language
      if (preferences.language) {
        userPrefs.language = preferences.language;
      }

      // Update timezone
      if (preferences.timezone) {
        userPrefs.timezone = preferences.timezone;
      }

      this.userPreferences.set(userId, userPrefs);

      return {
        userId,
        preferences,
        updated,
        timestampDate().toISOString()
      };
    }

    throw new Error('Invalid preferences action');
  }

  private async getHistory(payload)<any> {
    const { userId, limit = 20, status } = payload;

    if (!userId) {
      throw new Error('UserId is required');
    }

    const userNotifications = this.notifications.get(userId) || [];
    let results = userNotifications;

    if (status) {
      results = results.filter(n => n.status === status);
    }

    // Sort by createdAt descending
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      notifications.slice(0, limit),
      total.length,
      userId,
      summary: {
        sent.filter(n => n.status === 'Sent').length,
        failed.filter(n => n.status === 'Failed').length,
        pending.filter(n => n.status === 'Pending').length
      }
    };
  }

  private async handleComplexQuery(task, payload)<any> {
    const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Notifications: ${JSON.stringify(Array.from(this.notifications.entries()))}
      Channels: ${JSON.stringify(Array.from(this.channels.entries()))}
      User Preferences: ${JSON.stringify(Array.from(this.userPreferences.entries()))}
      
      Please analyze the query and provide a recommendation.
    `;

    const response = await this.providerManager.generate(prompt);
    
    return {
      aiResponse.content,
      provider.provider,
      tokensUsed.tokensUsed
    };
  }

  protected getRequiredCapability(task)| null {
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



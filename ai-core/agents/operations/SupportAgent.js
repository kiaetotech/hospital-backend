// D:\hospital backend\ai-core\agents\operations\SupportAgent.ts

const { AgentRole, AgentStatus, AgentRequest, AgentResponse } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');
const { ProviderManager } = require('../../providers/ProviderManager');







export class SupportAgent extends BaseAgent {
  private tickets[] = [];
  private faqs[] = [];
  private chatSessions<string, ChatMessage[]> = new Map();

  constructor(providerManager) {
    super(
      {
        name: 'Support Agent',
        role.SUPPORT,
        capabilities: [
          {
            name: 'classify_ticket',
            description: 'Classify support tickets by category and priority',
            priority: 1,
            estimatedLatency: 150,
            requiresAuth},
          {
            name: 'answer_faq',
            description: 'Answer FAQs with high accuracy',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth},
          {
            name: 'chat_support',
            description: 'Provide chat support to users',
            priority: 1,
            estimatedLatency: 250,
            requiresAuth},
          {
            name: 'route_ticket',
            description: 'Route tickets to appropriate department',
            priority: 2,
            estimatedLatency: 100,
            requiresAuth}
        ]
      },
      providerManager
    );

    this.initializeData();
  }

  private initializeData(){
    this.tickets = [
      {
        id: 't1',
        userId: 'u1',
        subject: 'Booking cancellation issue',
        description: 'Unable to cancel my hospital booking. The button is not working.',
        category: 'Booking',
        priority: 'High',
        status: 'Open',
        assignedTo: 'Support Team',
        createdAtDate('2026-07-20T10:00:00'),
        updatedAtDate('2026-07-20T10:00:00')
      },
      {
        id: 't2',
        userId: 'u2',
        subject: 'Payment failed but amount deducted',
        description: 'My payment for lab tests failed but money was deducted from my account.',
        category: 'Payment',
        priority: 'Urgent',
        status: 'InProgress',
        assignedTo: 'Finance Team',
        createdAtDate('2026-07-19T15:30:00'),
        updatedAtDate('2026-07-20T09:00:00')
      }
    ];

    this.faqs = [
      {
        id: 'f1',
        question: 'How do I book a hospital appointment?',
        answer: 'You can book a hospital appointment by selecting the hospital, choosing a specialty, picking a doctor, and selecting an available slot. Confirm the booking and you\'ll receive a confirmation.',
        category: 'Booking',
        tags: ['booking', 'appointment', 'hospital'],
        helpfulCount: 45,
        notHelpfulCount: 3,
        createdAtDate('2026-06-01'),
        updatedAtDate('2026-06-01')
      },
      {
        id: 'f2',
        question: 'How can I cancel my booking?',
        answer: 'You can cancel your booking by going to "My Bookings", selecting the booking, and clicking "Cancel Booking". Refunds are processed within 3-5 business days.',
        category: 'Booking',
        tags: ['cancellation', 'refund'],
        helpfulCount: 32,
        notHelpfulCount: 2,
        createdAtDate('2026-06-05'),
        updatedAtDate('2026-06-05')
      },
      {
        id: 'f3',
        question: 'What insurance plans are accepted?',
        answer: 'We accept all major insurance plans including ICICI, HDFC, Bajaj, SBI, and Star Health. You can check the full list on the insurance page.',
        category: 'Insurance',
        tags: ['insurance', 'payment', 'cashless'],
        helpfulCount: 28,
        notHelpfulCount: 1,
        createdAtDate('2026-06-10'),
        updatedAtDate('2026-06-10')
      }
    ];
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

      if (task.includes('classify') || task.includes('ticket')) {
        result = await this.classifyTicket(payload);
      } else if (task.includes('faq') || task.includes('answer')) {
        result = await this.answerFAQ(payload);
      } else if (task.includes('chat') || task.includes('message')) {
        result = await this.chatSupport(payload);
      } else if (task.includes('route')) {
        result = await this.routeTicket(payload);
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

  private async classifyTicket(payload)<any> {
    const { subject, description } = payload;

    if (!subject || !description) {
      throw new Error('Subject and description are required');
    }

    // Use AI to classify
    const prompt = `
      Classify this support ticket: ${subject}
      Description: ${description}
      
      Provide:
      1. Category (Booking/Payment/Doctor/Hospital/Insurance/Technical/General)
      2. Priority (Low/Medium/High/Urgent)
      3. Suggested department
      4. Keywords
    `;

    const response = await this.providerManager.generate(prompt);

    const ticket= {
      id: `t${Date.now()}`,
      userId.userId || 'unknown',
      subject,
      description,
      category: 'General',
      priority: 'Medium',
      status: 'Open',
      assignedTo: 'Support Team',
      createdAtDate(),
      updatedAtDate()
    };

    this.tickets.push(ticket);

    return {
      ticket,
      classification.content,
      provider.provider,
      tokensUsed.tokensUsed,
      ticketId.id
    };
  }

  private async answerFAQ(payload)<any> {
    const { question } = payload;

    if (!question) {
      throw new Error('Question is required');
    }

    // Search for matching FAQ
    let bestMatch| null = null;
    let bestScore = 0;

    for (const faq of this.faqs) {
      const score = this.calculateFAQMatch(question, faq);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = faq;
      }
    }

    if (bestMatch && bestScore > 60) {
      return {
        answer.answer,
        faq,
        confidence,
        source: 'FAQ'
      };
    }

    // If no FAQ matches, use AI
    const prompt = `
      Question: ${question}
      
      Provide a helpful answer. If you're not sure, suggest reaching out to support.
    `;

    const response = await this.providerManager.generate(prompt);

    return {
      answer.content,
      confidence: 50,
      source: 'AI',
      provider.provider,
      tokensUsed.tokensUsed
    };
  }

  private calculateFAQMatch(question, faq){
    let score = 0;
    const qLower = question.toLowerCase();

    // Check question match
    if (faq.question.toLowerCase().includes(qLower) || qLower.includes(faq.question.toLowerCase())) {
      score += 40;
    }

    // Check tag match
    for (const tag of faq.tags) {
      if (qLower.includes(tag.toLowerCase())) {
        score += 10;
      }
    }

    // Check category match
    if (qLower.includes(faq.category.toLowerCase())) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  private async chatSupport(payload)<any> {
    const { userId, sessionId, message } = payload;

    if (!userId || !message) {
      throw new Error('User ID and message are required');
    }

    const sessionKey = sessionId || userId;
    
    // Store user message
    const userMessage= {
      id: `msg${Date.now()}`,
      userId,
      sessionId,
      message,
      isBot,
      createdAtDate()
    };

    if (!this.chatSessions.has(sessionKey)) {
      this.chatSessions.set(sessionKey, []);
    }
    this.chatSessions.get(sessionKey)!.push(userMessage);

    // Generate bot response
    const isGreeting = message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi');
    
    let botResponse;

    if (isGreeting) {
      botResponse = 'Hello! I\'m your support assistant. How can I help you today? 😊';
    } else {
      // Try FAQ first
      const faqResult = await this.answerFAQ({ question});
      botResponse = faqResult.answer;
    }

    const botMessage= {
      id: `msg${Date.now() + 1}`,
      userId,
      sessionId,
      message,
      isBot,
      confidence: 85,
      createdAtDate()
    };

    this.chatSessions.get(sessionKey)!.push(botMessage);

    return {
      response,
      sessionId,
      messages.chatSessions.get(sessionKey),
      timestampDate().toISOString()
    };
  }

  private async routeTicket(payload)<any> {
    const { ticketId } = payload;

    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Routing logic based on category
    const routingMap= {
      'Booking': 'Operations Team',
      'Payment': 'Finance Team',
      'Doctor': 'Doctor Coordination Team',
      'Hospital': 'Hospital Partnership Team',
      'Insurance': 'Insurance Team',
      'Technical': 'Technical Support',
      'General': 'Support Team'
    };

    const assignedTeam = routingMap[ticket.category] || 'Support Team';
    ticket.assignedTo = assignedTeam;
    ticket.status = 'InProgress';
    ticket.updatedAt = new Date();

    return {
      ticket,
      assignedTeam,
      message: `Ticket routed to ${assignedTeam}`,
      estimatedResponseTime.getEstimatedResponseTime(ticket.priority)
    };
  }

  private getEstimatedResponseTime(priority){
    const times= {
      'Urgent': 'Within 2 hours',
      'High': 'Within 4 hours',
      'Medium': 'Within 12 hours',
      'Low': 'Within 24 hours'
    };
    return times[priority] || 'Within 24 hours';
  }

  private async handleComplexQuery(task, payload)<any> {
    const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Support Data: ${JSON.stringify(this.tickets)}
      FAQs: ${JSON.stringify(this.faqs)}
      
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
    if (task.includes('classify') || task.includes('ticket')) {
      return 'classify_ticket';
    }
    if (task.includes('faq') || task.includes('answer')) {
      return 'answer_faq';
    }
    if (task.includes('chat') || task.includes('message')) {
      return 'chat_support';
    }
    if (task.includes('route')) {
      return 'route_ticket';
    }
    return null;
  }
}




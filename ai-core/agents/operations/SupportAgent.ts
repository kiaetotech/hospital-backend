// D:\hospital backend\ai-core\agents\operations\SupportAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');

class SupportAgent extends BaseAgent {
  constructor(providerManager) {
    super(
      {
        name: 'Support Agent',
        role: AgentRole.SUPPORT,
        capabilities: [
          {
            name: 'classify_ticket',
            description: 'Classify support tickets by category and priority',
            priority: 1,
            estimatedLatency: 150,
            requiresAuth: true
          },
          {
            name: 'answer_faq',
            description: 'Answer FAQs with high accuracy',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth: false
          },
          {
            name: 'chat_support',
            description: 'Provide chat support to users',
            priority: 1,
            estimatedLatency: 250,
            requiresAuth: false
          },
          {
            name: 'route_ticket',
            description: 'Route tickets to appropriate department',
            priority: 2,
            estimatedLatency: 100,
            requiresAuth: true
          }
        ]
      },
      providerManager
    );

    this.tickets = [];
    this.faqs = [];
    this.chatSessions = new Map();
    this.initializeData();
  }

  initializeData() {
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
        createdAt: new Date('2026-07-20T10:00:00'),
        updatedAt: new Date('2026-07-20T10:00:00')
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
        createdAt: new Date('2026-07-19T15:30:00'),
        updatedAt: new Date('2026-07-20T09:00:00')
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
        createdAt: new Date('2026-06-01'),
        updatedAt: new Date('2026-06-01')
      },
      {
        id: 'f2',
        question: 'How can I cancel my booking?',
        answer: 'You can cancel your booking by going to "My Bookings", selecting the booking, and clicking "Cancel Booking". Refunds are processed within 3-5 business days.',
        category: 'Booking',
        tags: ['cancellation', 'refund'],
        helpfulCount: 32,
        notHelpfulCount: 2,
        createdAt: new Date('2026-06-05'),
        updatedAt: new Date('2026-06-05')
      },
      {
        id: 'f3',
        question: 'What insurance plans are accepted?',
        answer: 'We accept all major insurance plans including ICICI, HDFC, Bajaj, SBI, and Star Health. You can check the full list on the insurance page.',
        category: 'Insurance',
        tags: ['insurance', 'payment', 'cashless'],
        helpfulCount: 28,
        notHelpfulCount: 1,
        createdAt: new Date('2026-06-10'),
        updatedAt: new Date('2026-06-10')
      }
    ];
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

  async classifyTicket(payload) {
    var subject = payload.subject;
    var description = payload.description;

    if (!subject || !description) {
      throw new Error('Subject and description are required');
    }

    var prompt = 'Classify this support ticket:\n' +
      'Subject: ' + subject + '\n' +
      'Description: ' + description + '\n\n' +
      'Provide:\n' +
      '1. Category (Booking/Payment/Doctor/Hospital/Insurance/Technical/General)\n' +
      '2. Priority (Low/Medium/High/Urgent)\n' +
      '3. Suggested department\n' +
      '4. Keywords';

    var response = await this.providerManager.generate(prompt);

    var ticket = {
      id: 't' + Date.now(),
      userId: payload.userId || 'unknown',
      subject: subject,
      description: description,
      category: 'General',
      priority: 'Medium',
      status: 'Open',
      assignedTo: 'Support Team',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.tickets.push(ticket);

    return {
      ticket: ticket,
      classification: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed,
      ticketId: ticket.id
    };
  }

  async answerFAQ(payload) {
    var question = payload.question;

    if (!question) {
      throw new Error('Question is required');
    }

    var bestMatch = null;
    var bestScore = 0;

    for (var i = 0; i < this.faqs.length; i++) {
      var faq = this.faqs[i];
      var score = this.calculateFAQMatch(question, faq);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = faq;
      }
    }

    if (bestMatch && bestScore > 60) {
      return {
        answer: bestMatch.answer,
        faq: bestMatch,
        confidence: bestScore,
        source: 'FAQ'
      };
    }

    var prompt = 'Question: ' + question + '\n\n' +
      'Provide a helpful answer. If you\'re not sure, suggest reaching out to support.';

    var response = await this.providerManager.generate(prompt);

    return {
      answer: response.content,
      confidence: 50,
      source: 'AI',
      provider: response.provider,
      tokensUsed: response.tokensUsed
    };
  }

  calculateFAQMatch(question, faq) {
    var score = 0;
    var qLower = question.toLowerCase();

    if (faq.question.toLowerCase().includes(qLower) || qLower.includes(faq.question.toLowerCase())) {
      score += 40;
    }

    for (var i = 0; i < faq.tags.length; i++) {
      if (qLower.includes(faq.tags[i].toLowerCase())) {
        score += 10;
      }
    }

    if (qLower.includes(faq.category.toLowerCase())) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  async chatSupport(payload) {
    var userId = payload.userId;
    var sessionId = payload.sessionId;
    var message = payload.message;

    if (!userId || !message) {
      throw new Error('User ID and message are required');
    }

    var sessionKey = sessionId || userId;

    var userMessage = {
      id: 'msg' + Date.now(),
      userId: userId,
      sessionId: sessionKey,
      message: message,
      isBot: false,
      createdAt: new Date()
    };

    if (!this.chatSessions.has(sessionKey)) {
      this.chatSessions.set(sessionKey, []);
    }
    this.chatSessions.get(sessionKey).push(userMessage);

    var isGreeting = message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi');
    var botResponse;

    if (isGreeting) {
      botResponse = 'Hello! I\'m your support assistant. How can I help you today? 😊';
    } else {
      var faqResult = await this.answerFAQ({ question: message });
      botResponse = faqResult.answer;
    }

    var botMessage = {
      id: 'msg' + (Date.now() + 1),
      userId: userId,
      sessionId: sessionKey,
      message: botResponse,
      isBot: true,
      confidence: 85,
      createdAt: new Date()
    };

    this.chatSessions.get(sessionKey).push(botMessage);

    return {
      response: botResponse,
      sessionId: sessionKey,
      messages: this.chatSessions.get(sessionKey),
      timestamp: new Date().toISOString()
    };
  }

  async routeTicket(payload) {
    var ticketId = payload.ticketId;

    var ticket = this.tickets.find(function(t) { return t.id === ticketId; });
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    var routingMap = {
      'Booking': 'Operations Team',
      'Payment': 'Finance Team',
      'Doctor': 'Doctor Coordination Team',
      'Hospital': 'Hospital Partnership Team',
      'Insurance': 'Insurance Team',
      'Technical': 'Technical Support',
      'General': 'Support Team'
    };

    var assignedTeam = routingMap[ticket.category] || 'Support Team';
    ticket.assignedTo = assignedTeam;
    ticket.status = 'InProgress';
    ticket.updatedAt = new Date();

    return {
      ticket: ticket,
      assignedTeam: assignedTeam,
      message: 'Ticket routed to ' + assignedTeam,
      estimatedResponseTime: this.getEstimatedResponseTime(ticket.priority)
    };
  }

  getEstimatedResponseTime(priority) {
    var times = {
      'Urgent': 'Within 2 hours',
      'High': 'Within 4 hours',
      'Medium': 'Within 12 hours',
      'Low': 'Within 24 hours'
    };
    return times[priority] || 'Within 24 hours';
  }

  async handleComplexQuery(task, payload) {
    var prompt = 'Task: ' + task + '\n' +
      'Payload: ' + JSON.stringify(payload) + '\n\n' +
      'Support Data:\n' +
      'Tickets: ' + JSON.stringify(this.tickets) + '\n' +
      'FAQs: ' + JSON.stringify(this.faqs) + '\n\n' +
      'Please analyze the query and provide a recommendation.';

    var response = await this.providerManager.generate(prompt);

    return {
      aiResponse: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed
    };
  }

  getRequiredCapability(task) {
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

module.exports = { SupportAgent };
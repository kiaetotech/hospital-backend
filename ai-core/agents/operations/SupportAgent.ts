// D:\hospital backend\ai-core\agents\operations\SupportAgent.ts

import { AgentRole, AgentStatus, AgentRequest, AgentResponse } from '../../../shared/types/AgentTypes';
import { BaseAgent } from '../base/BaseAgent';
import { ProviderManager } from '../../providers/ProviderManager';

interface Ticket {
  id: string;
  userId: string;
  subject: string;
  description: string;
  category: 'Booking' | 'Payment' | 'Doctor' | 'Hospital' | 'Insurance' | 'Technical' | 'General';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Open' | 'InProgress' | 'Resolved' | 'Closed';
  assignedTo: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  satisfactionScore?: number;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatMessage {
  id: string;
  userId: string;
  sessionId: string;
  message: string;
  isBot: boolean;
  confidence?: number;
  createdAt: Date;
}

export class SupportAgent extends BaseAgent {
  private tickets: Ticket[] = [];
  private faqs: FAQ[] = [];
  private chatSessions: Map<string, ChatMessage[]> = new Map();

  constructor(providerManager: ProviderManager) {
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

    this.initializeData();
  }

  private initializeData(): void {
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

  private async classifyTicket(payload: any): Promise<any> {
    const { subject, description } = payload;

    if (!subject || !description) {
      throw new Error('Subject and description are required');
    }

    // Use AI to classify
    const prompt = `
      Classify this support ticket:
      Subject: ${subject}
      Description: ${description}
      
      Provide:
      1. Category (Booking/Payment/Doctor/Hospital/Insurance/Technical/General)
      2. Priority (Low/Medium/High/Urgent)
      3. Suggested department
      4. Keywords
    `;

    const response = await this.providerManager.generate(prompt);

    const ticket: Ticket = {
      id: `t${Date.now()}`,
      userId: payload.userId || 'unknown',
      subject,
      description,
      category: 'General',
      priority: 'Medium',
      status: 'Open',
      assignedTo: 'Support Team',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.tickets.push(ticket);

    return {
      ticket,
      classification: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed,
      ticketId: ticket.id
    };
  }

  private async answerFAQ(payload: any): Promise<any> {
    const { question } = payload;

    if (!question) {
      throw new Error('Question is required');
    }

    // Search for matching FAQ
    let bestMatch: FAQ | null = null;
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
        answer: bestMatch.answer,
        faq: bestMatch,
        confidence: bestScore,
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
      answer: response.content,
      confidence: 50,
      source: 'AI',
      provider: response.provider,
      tokensUsed: response.tokensUsed
    };
  }

  private calculateFAQMatch(question: string, faq: FAQ): number {
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

  private async chatSupport(payload: any): Promise<any> {
    const { userId, sessionId, message } = payload;

    if (!userId || !message) {
      throw new Error('User ID and message are required');
    }

    const sessionKey = sessionId || userId;
    
    // Store user message
    const userMessage: ChatMessage = {
      id: `msg${Date.now()}`,
      userId,
      sessionId: sessionKey,
      message,
      isBot: false,
      createdAt: new Date()
    };

    if (!this.chatSessions.has(sessionKey)) {
      this.chatSessions.set(sessionKey, []);
    }
    this.chatSessions.get(sessionKey)!.push(userMessage);

    // Generate bot response
    const isGreeting = message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi');
    
    let botResponse: string;

    if (isGreeting) {
      botResponse = 'Hello! I\'m your support assistant. How can I help you today? 😊';
    } else {
      // Try FAQ first
      const faqResult = await this.answerFAQ({ question: message });
      botResponse = faqResult.answer;
    }

    const botMessage: ChatMessage = {
      id: `msg${Date.now() + 1}`,
      userId,
      sessionId: sessionKey,
      message: botResponse,
      isBot: true,
      confidence: 85,
      createdAt: new Date()
    };

    this.chatSessions.get(sessionKey)!.push(botMessage);

    return {
      response: botResponse,
      sessionId: sessionKey,
      messages: this.chatSessions.get(sessionKey),
      timestamp: new Date().toISOString()
    };
  }

  private async routeTicket(payload: any): Promise<any> {
    const { ticketId } = payload;

    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Routing logic based on category
    const routingMap: Record<string, string> = {
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
      estimatedResponseTime: this.getEstimatedResponseTime(ticket.priority)
    };
  }

  private getEstimatedResponseTime(priority: string): string {
    const times: Record<string, string> = {
      'Urgent': 'Within 2 hours',
      'High': 'Within 4 hours',
      'Medium': 'Within 12 hours',
      'Low': 'Within 24 hours'
    };
    return times[priority] || 'Within 24 hours';
  }

  private async handleComplexQuery(task: string, payload: any): Promise<any> {
    const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Support Data:
      Tickets: ${JSON.stringify(this.tickets)}
      FAQs: ${JSON.stringify(this.faqs)}
      
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
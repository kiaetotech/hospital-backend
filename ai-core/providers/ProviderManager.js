// D:\hospital backend\ai-core\providers\ProviderManager.js

const { ProviderType } = require('../../shared/types/AgentTypes.js');
const { BudgetManager } = require('../monitoring/BudgetManager.js');
const { CircuitBreaker } = require('../recovery/CircuitBreaker.js');

class ProviderManager {
  constructor(budgetManager) {
    this.budgetManager = budgetManager;
    this.circuitBreakers = new Map();
    this.fallbackOrder = ['groq', 'ollama', 'gemini', 'openrouter'];
    this.mockMode = true;
    this.initializeCircuitBreakers();
    console.log('🔧 ProviderManager initialized with MOCK MODE:', this.mockMode);
  }

  initializeCircuitBreakers() {
    for (const type of this.fallbackOrder) {
      this.circuitBreakers.set(type, new CircuitBreaker({
        failureThreshold: 3,
        timeout: 120000,
        resetTimeout: 60000
      }));
    }
  }

  async generate(prompt, critical = false) {
    if (this.mockMode) {
      console.log('🔄 [MOCK] Generating response for:', prompt.substring(0, 50) + '...');
      
      let mockData = {};
      const lowerPrompt = prompt.toLowerCase();
      
      // ============================================
      // 1. WELLNESS (Check FIRST - Ayurveda, Homeopathy, Mental Health)
      // ============================================
      if (lowerPrompt.includes('ayurveda') || lowerPrompt.includes('wellness') || 
          lowerPrompt.includes('homeopathy') || lowerPrompt.includes('find_practitioner') ||
          lowerPrompt.includes('mental') || lowerPrompt.includes('therapy')) {
        mockData = {
          practitioners: [
            { id: 'w1', name: 'Dr. Anjali Sharma', type: 'Ayurveda', city: 'Mumbai', rating: 4.9, experience: 15, consultationFee: 600 },
            { id: 'w2', name: 'Dr. Rajesh Kumar', type: 'Ayurveda', city: 'Mumbai', rating: 4.7, experience: 12, consultationFee: 500 },
            { id: 'w3', name: 'Dr. Meera Iyer', type: 'Ayurveda', city: 'Delhi', rating: 4.9, experience: 18, consultationFee: 800 }
          ],
          total: 3,
          message: 'Found wellness practitioners matching your criteria'
        };
      }
      
      // ============================================
      // 2. DOCTOR
      // ============================================
      else if (lowerPrompt.includes('doctor') || lowerPrompt.includes('cardiologist') || 
               lowerPrompt.includes('find_doctor')) {
        mockData = {
          doctors: [
            { id: 'd1', name: 'Dr. Rajesh Kumar', specialty: 'Cardiology', city: 'Mumbai', rating: 4.9, experience: 15, consultationFee: 800 },
            { id: 'd2', name: 'Dr. Priya Sharma', specialty: 'Cardiology', city: 'Delhi', rating: 4.8, experience: 12, consultationFee: 700 },
            { id: 'd3', name: 'Dr. Ananya Patel', specialty: 'Neurology', city: 'Delhi', rating: 4.9, experience: 20, consultationFee: 1200 }
          ],
          total: 3,
          message: 'Found doctors matching your criteria'
        };
      }
      
      // ============================================
      // 3. HOSPITAL
      // ============================================
      else if (lowerPrompt.includes('hospital') || lowerPrompt.includes('search_hospitals') || 
               lowerPrompt.includes('find hospital') || lowerPrompt.includes('clinic')) {
        mockData = {
          hospitals: [
            { id: 'h1', name: 'Apollo Hospital', city: 'Mumbai', rating: 4.8, bedsAvailable: 45, specialties: ['Cardiology', 'Orthopedics', 'Neurology'] },
            { id: 'h2', name: 'Fortis Hospital', city: 'Mumbai', rating: 4.6, bedsAvailable: 32, specialties: ['Cardiology', 'Oncology', 'Gynecology'] },
            { id: 'h3', name: 'AIIMS Delhi', city: 'Delhi', rating: 4.9, bedsAvailable: 18, specialties: ['Cardiology', 'Orthopedics', 'Neurology', 'Oncology'] }
          ],
          total: 3,
          message: 'Found hospitals matching your criteria'
        };
      }
      
      // ============================================
      // 4. AMBULANCE
      // ============================================
      else if (lowerPrompt.includes('ambulance') || lowerPrompt.includes('dispatch_ambulance') || 
               lowerPrompt.includes('book ambulance') || lowerPrompt.includes('emergency')) {
        mockData = {
          ambulance: {
            id: 'amb1',
            vehicleNumber: 'MH-01-AB-1234',
            type: 'Advanced',
            driverName: 'Rajesh Singh',
            driverContact: '+91-9876543210',
            eta: '5 minutes',
            status: 'Dispatched',
            equipment: ['Oxygen', 'Ventilator', 'Defibrillator']
          },
          message: 'Ambulance dispatched successfully! ETA: 5 minutes'
        };
      }
      
      // ============================================
      // 5. INSURANCE
      // ============================================
      else if (lowerPrompt.includes('insurance') || lowerPrompt.includes('compare_policies') || 
               lowerPrompt.includes('claim') || lowerPrompt.includes('policy')) {
        mockData = {
          policies: [
            { id: 'pol1', name: 'ICICI Health Shield', coverage: 500000, premium: 12000, rating: 4.8, type: 'Family' },
            { id: 'pol2', name: 'HDFC Health Advantage', coverage: 1000000, premium: 18000, rating: 4.7, type: 'Individual' },
            { id: 'pol3', name: 'Bajaj Health Care', coverage: 750000, premium: 15000, rating: 4.5, type: 'Family' }
          ],
          total: 3,
          message: 'Found insurance policies matching your criteria'
        };
      }
      
      // ============================================
      // 6. CAREGIVER (Home Care)
      // ============================================
      else if (lowerPrompt.includes('caregiver') || lowerPrompt.includes('home care') || 
               lowerPrompt.includes('nurse') || lowerPrompt.includes('find_caregiver')) {
        mockData = {
          caregivers: [
            { id: 'cg1', name: 'Priya Sharma', type: 'Nurse', city: 'Mumbai', rating: 4.9, experience: 8, hourlyRate: 350 },
            { id: 'cg2', name: 'Sunita Patel', type: 'Nurse', city: 'Mumbai', rating: 4.8, experience: 12, hourlyRate: 400 },
            { id: 'cg3', name: 'Rahul Singh', type: 'Nurse', city: 'Delhi', rating: 4.7, experience: 5, hourlyRate: 300 }
          ],
          total: 3,
          message: 'Found caregivers matching your criteria'
        };
      }
      
      // ============================================
      // 7. DIAGNOSTICS (Lab Tests)
      // ============================================
      else if (lowerPrompt.includes('lab') || lowerPrompt.includes('test') || 
               lowerPrompt.includes('diagnostic') || lowerPrompt.includes('checkup') ||
               lowerPrompt.includes('find_lab')) {
        mockData = {
          labs: [
            { id: 'l1', name: 'SRL Diagnostics', city: 'Mumbai', rating: 4.8, turnaroundTime: '24 hours', tests: ['Complete Blood Count', 'Lipid Profile', 'Liver Function'] },
            { id: 'l2', name: 'Thyrocare', city: 'Mumbai', rating: 4.6, turnaroundTime: '48 hours', tests: ['Thyroid Profile', 'Vitamin D', 'HbA1c'] },
            { id: 'l3', name: 'Metropolis Lab', city: 'Delhi', rating: 4.7, turnaroundTime: '36 hours', tests: ['Cancer Markers', 'Complete Blood Count'] }
          ],
          total: 3,
          message: 'Found diagnostic labs matching your criteria'
        };
      }
      
      // ============================================
      // 8. FINANCE (EMI)
      // ============================================
      else if (lowerPrompt.includes('emi') || lowerPrompt.includes('loan') || 
               lowerPrompt.includes('finance') || lowerPrompt.includes('calculate_emi')) {
        mockData = {
          quotes: [
            { partner: 'HDFC Bank', planType: '0% EMI', monthlyPayment: 8500, totalAmount: 102000, tenure: 12 },
            { partner: 'ICICI Bank', planType: '0% EMI', monthlyPayment: 8600, totalAmount: 103200, tenure: 12 },
            { partner: 'Bajaj Finserv', planType: 'Low Interest', monthlyPayment: 8300, totalAmount: 99600, tenure: 12 }
          ],
          total: 3,
          message: 'Found EMI options matching your criteria'
        };
      }
      
      // ============================================
      // 9. CORPORATE
      // ============================================
      else if (lowerPrompt.includes('corporate') || lowerPrompt.includes('company') || 
               lowerPrompt.includes('employee') || lowerPrompt.includes('get_corporate_plans')) {
        mockData = {
          plans: [
            { id: 'cp1', name: 'Enterprise Health Plus', provider: 'ICICI Lombard', perEmployeeAnnual: 12000, minEmployees: 50 },
            { id: 'cp2', name: 'Corporate Health Shield', provider: 'HDFC Ergo', perEmployeeAnnual: 8000, minEmployees: 25 },
            { id: 'cp3', name: 'Startup Health Plan', provider: 'Bajaj Allianz', perEmployeeAnnual: 5000, minEmployees: 5 }
          ],
          total: 3,
          message: 'Found corporate health plans matching your criteria'
        };
      }
      
      // ============================================
      // 10. CRM
      // ============================================
      else if (lowerPrompt.includes('customer') || lowerPrompt.includes('crm') || 
               lowerPrompt.includes('lead') || lowerPrompt.includes('churn') ||
               lowerPrompt.includes('segment') || lowerPrompt.includes('track customer')) {
        mockData = {
          customers: [
            { id: 'c1', name: 'Amit Sharma', city: 'Mumbai', totalBookings: 12, totalSpent: 45000, loyaltyTier: 'Gold' },
            { id: 'c2', name: 'Priya Patel', city: 'Delhi', totalBookings: 5, totalSpent: 12000, loyaltyTier: 'Silver' }
          ],
          total: 2,
          message: 'Found customers matching your criteria'
        };
      }
      
      // ============================================
      // 11. MARKETING
      // ============================================
      else if (lowerPrompt.includes('content') || lowerPrompt.includes('marketing') || 
               lowerPrompt.includes('campaign') || lowerPrompt.includes('seo') ||
               lowerPrompt.includes('generate content') || lowerPrompt.includes('social media')) {
        mockData = {
          content: {
            title: 'Heart Health: 5 Essential Tips',
            type: 'Blog',
            topic: 'heart health',
            suggestedLength: '1500-2000 words',
            seoScore: 85,
            keywords: ['heart health', 'cardiology', 'prevention']
          },
          message: 'Content generated successfully'
        };
      }
      
      // ============================================
      // 12. ANALYTICS
      // ============================================
      else if (lowerPrompt.includes('kpi') || lowerPrompt.includes('analytics') || 
               lowerPrompt.includes('report') || lowerPrompt.includes('trend') ||
               lowerPrompt.includes('forecast') || lowerPrompt.includes('generate kpi')) {
        mockData = {
          kpis: [
            { id: 'k1', name: 'Monthly Revenue', value: 2450000, target: 3000000, progress: 82, status: 'On Track' },
            { id: 'k2', name: 'Active Users', value: 12500, target: 15000, progress: 83, status: 'On Track' },
            { id: 'k3', name: 'Customer Satisfaction', value: 4.6, target: 4.8, progress: 96, status: 'Excellent' }
          ],
          total: 3,
          message: 'KPIs generated successfully'
        };
      }
      
      // ============================================
      // 13. SUPPORT (FAQ)
      // ============================================
      else if (lowerPrompt.includes('faq') || lowerPrompt.includes('help') || 
               lowerPrompt.includes('support') || lowerPrompt.includes('answer_faq') ||
               lowerPrompt.includes('cancel booking') || lowerPrompt.includes('refund')) {
        mockData = {
          answer: 'Thank you for your question. Here is the information you need. If you need more help, please contact our support team at support@hospitalhub.com.',
          confidence: 85,
          source: 'AI Assistant'
        };
      }
      
      // ============================================
      // 14. SEARCH
      // ============================================
      else if (lowerPrompt.includes('search') || lowerPrompt.includes('find') || 
               lowerPrompt.includes('looking for') || lowerPrompt.includes('semantic_search')) {
        mockData = {
          results: [
            { id: '1', title: 'Apollo Hospital', type: 'Hospital', relevanceScore: 92 },
            { id: '2', title: 'Dr. Rajesh Kumar', type: 'Doctor', relevanceScore: 88 },
            { id: '3', title: 'SRL Diagnostics', type: 'Lab', relevanceScore: 85 }
          ],
          total: 3,
          message: 'Found search results matching your query'
        };
      }
      
      // ============================================
      // 15. RECOMMENDATION
      // ============================================
      else if (lowerPrompt.includes('recommend') || lowerPrompt.includes('suggest') || 
               lowerPrompt.includes('personalize_recommendations')) {
        mockData = {
          recommendations: [
            { id: 'r1', type: 'Hospital', name: 'Apollo Hospital', matchScore: 95, reason: 'Matches your preferences' },
            { id: 'r2', type: 'Doctor', name: 'Dr. Rajesh Kumar', matchScore: 92, reason: 'Specialist in Cardiology' },
            { id: 'r3', type: 'Package', name: 'Comprehensive Health Checkup', matchScore: 90, reason: 'Recommended for your age' }
          ],
          total: 3,
          message: 'Found recommendations based on your profile'
        };
      }
      
      // ============================================
      // 16. WORKFLOW
      // ============================================
      else if (lowerPrompt.includes('workflow') || lowerPrompt.includes('orchestrate') || 
               lowerPrompt.includes('execute workflow')) {
        mockData = {
          workflow: {
            id: 'wf1',
            name: 'Hospital Booking Flow',
            status: 'Completed',
            steps: ['Search Hospital', 'Select Doctor', 'Book Appointment', 'Send Notification']
          },
          message: 'Workflow executed successfully'
        };
      }
      
      // ============================================
      // 17. MEMORY
      // ============================================
      else if (lowerPrompt.includes('memory') || lowerPrompt.includes('remember') || 
               lowerPrompt.includes('store memory') || lowerPrompt.includes('retrieve memory')) {
        mockData = {
          memory: {
            type: 'Preference',
            key: 'language',
            value: 'English',
            importance: 80
          },
          message: 'Memory retrieved successfully'
        };
      }
      
      // ============================================
      // 18. NOTIFICATION
      // ============================================
      else if (lowerPrompt.includes('notification') || lowerPrompt.includes('send') || 
               lowerPrompt.includes('alert') || lowerPrompt.includes('notify')) {
        mockData = {
          notification: {
            id: 'notif1',
            type: 'Email',
            status: 'Sent',
            channel: 'email',
            timestamp: new Date().toISOString()
          },
          message: 'Notification sent successfully'
        };
      }
      
      // ============================================
      // 19. CEO
      // ============================================
      else if (lowerPrompt.includes('ceo') || lowerPrompt.includes('strategic') || 
               lowerPrompt.includes('coordinate') || lowerPrompt.includes('allocate resources')) {
        mockData = {
          plan: {
            id: 'plan1',
            name: 'Q3 Growth Strategy',
            status: 'InProgress',
            steps: ['Hospital Onboarding', 'User Acquisition', 'Analytics Review']
          },
          message: 'Strategic plan executed successfully'
        };
      }
      
      // ============================================
      // 20. STRATEGY
      // ============================================
      else if (lowerPrompt.includes('strategy') || lowerPrompt.includes('market') || 
               lowerPrompt.includes('competitive') || lowerPrompt.includes('forecast')) {
        mockData = {
          insights: [
            { id: 'ins1', title: 'Expand Hospital Network', type: 'Opportunity', impact: 85, confidence: 78 },
            { id: 'ins2', title: 'Competitor Launch', type: 'Threat', impact: 70, confidence: 65 }
          ],
          total: 2,
          message: 'Strategic insights generated'
        };
      }
      
      // ============================================
      // 21. DEFAULT
      // ============================================
      else {
        mockData = {
          message: 'AI response for your request',
          task: prompt.substring(0, 100),
          timestamp: new Date().toISOString()
        };
      }

      this.budgetManager.recordSpend(0, critical);

      return {
        content: JSON.stringify(mockData),
        provider: 'groq',
        tokensUsed: 10,
        costInr: 0,
        latency: 50
      };
    }

    return this.generate(prompt, critical);
  }

  async getHealthStatus() {
    const status = {};
    for (const type of this.fallbackOrder) {
      status[type] = {
        available: this.mockMode ? true : false,
        quota: this.mockMode ? 999 : 0,
        latency: this.mockMode ? 50 : 0,
        circuitBreaker: this.circuitBreakers.get(type)?.getStatus() || { state: 'CLOSED' }
      };
    }
    return status;
  }

  setMockMode(enabled) {
    this.mockMode = enabled;
    console.log(`🔧 Mock mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }
}

module.exports = { ProviderManager };
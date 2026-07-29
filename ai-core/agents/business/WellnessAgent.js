// D:\hospital backend\ai-core\agents\business\WellnessAgent.ts

import { AgentRole, AgentStatus, AgentRequest, AgentResponse } from '../../../shared/types/AgentTypes';
import { BaseAgent } from '../base/BaseAgent';
import { ProviderManager } from '../../providers/ProviderManager';





export class WellnessAgent extends BaseAgent {
  private practitioners[] = [];
  private packages[] = [];

  constructor(providerManager) {
    super(
      {
        name: 'Wellness Agent',
        role.WELLNESS,
        capabilities: [
          {
            name: 'find_practitioner',
            description: 'Find Ayurveda, Homeopathy, or Mental Wellness practitioners',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth},
          {
            name: 'book_consultation',
            description: 'Book a wellness consultation',
            priority: 1,
            estimatedLatency: 300,
            requiresAuth},
          {
            name: 'get_packages',
            description: 'Get wellness packages and treatments',
            priority: 2,
            estimatedLatency: 150,
            requiresAuth},
          {
            name: 'check_availability',
            description: 'Check practitioner availability',
            priority: 1,
            estimatedLatency: 150,
            requiresAuth}
        ]
      },
      providerManager
    );

    this.initializePractitioners();
    this.initializePackages();
  }

  private initializePractitioners(){
    this.practitioners = [
      // ============================================
      // AYURVEDA & WELLNESS (450+ Doctors)
      // Service& Wellness
      // ============================================
      {
        id: 'w1',
        name: 'Dr. Anjali Sharma',
        type: 'Ayurveda',
        specialization: 'Panchakarma, Digestive Health',
        city: 'Mumbai',
        experience: 15,
        rating: 4.9,
        consultationFee: 600,
        availableSlots: ['9:00 AM', '10:30 AM', '2:00 PM', '4:30 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi', 'Sanskrit'],
        qualifications: ['BAMS', 'MD Ayurveda', 'Panchakarma Specialist'],
        about: 'Specializing in traditional Ayurvedic treatments for digestive disorders and detoxification.'
      },
      {
        id: 'w2',
        name: 'Dr. Rajesh Kumar',
        type: 'Ayurveda',
        specialization: 'Skin Care, Hair Care, Immunity',
        city: 'Mumbai',
        experience: 12,
        rating: 4.7,
        consultationFee: 500,
        availableSlots: ['9:30 AM', '11:00 AM', '3:00 PM', '5:00 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi', 'Marathi'],
        qualifications: ['BAMS', 'MD Ayurveda', 'Dermatology'],
        about: 'Expert in Ayurvedic solutions for skin and hair problems with natural remedies.'
      },
      {
        id: 'w3',
        name: 'Dr. Meera Iyer',
        type: 'Ayurveda',
        specialization: 'Women\'s Health, Pregnancy Care',
        city: 'Delhi',
        experience: 18,
        rating: 4.9,
        consultationFee: 800,
        availableSlots: ['10:00 AM', '1:00 PM', '3:30 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi', 'Tamil'],
        qualifications: ['BAMS', 'MD Ayurveda', 'Gynecology'],
        about: 'Specializing in women\'s health, pregnancy care, and post-natal Ayurvedic treatments.'
      },
      {
        id: 'w4',
        name: 'Dr. Suresh Gupta',
        type: 'Ayurveda',
        specialization: 'Joint Health, Arthritis, Back Pain',
        city: 'Delhi',
        experience: 20,
        rating: 4.8,
        consultationFee: 700,
        availableSlots: ['9:00 AM', '11:30 AM', '2:30 PM', '4:00 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi'],
        qualifications: ['BAMS', 'MD Ayurveda', 'Orthopedics'],
        about: 'Expert in treating joint disorders, arthritis, and chronic back pain using Ayurvedic methods.'
      },
      {
        id: 'w5',
        name: 'Dr. Priya Patel',
        type: 'Ayurveda',
        specialization: 'Stress Management, Sleep Disorders',
        city: 'Gurugram',
        experience: 10,
        rating: 4.6,
        consultationFee: 450,
        availableSlots: ['10:30 AM', '12:00 PM', '3:00 PM', '6:00 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi', 'Gujarati'],
        qualifications: ['BAMS', 'MD Ayurveda', 'Psychology'],
        about: 'Helping patients manage stress, anxiety, and sleep disorders through Ayurvedic therapies.'
      },

      // ============================================
      // HOMEOPATHY CARE (300+ Doctors)
      // ServiceCare
      // ============================================
      {
        id: 'w6',
        name: 'Dr. Amit Shah',
        type: 'Homeopathy',
        specialization: 'Allergies, Skin Diseases, Respiratory Issues',
        city: 'Mumbai',
        experience: 14,
        rating: 4.7,
        consultationFee: 400,
        availableSlots: ['9:00 AM', '10:30 AM', '2:00 PM', '5:30 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi', 'Gujarati'],
        qualifications: ['BHMS', 'MD Homeopathy', 'Dermatology'],
        about: 'Specializing in treating allergies, skin diseases, and respiratory conditions with homeopathy.'
      },
      {
        id: 'w7',
        name: 'Dr. Neha Singh',
        type: 'Homeopathy',
        specialization: 'Child Health, Pediatric Care',
        city: 'Mumbai',
        experience: 10,
        rating: 4.8,
        consultationFee: 350,
        availableSlots: ['9:30 AM', '11:30 AM', '1:30 PM', '4:00 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi'],
        qualifications: ['BHMS', 'MD Homeopathy', 'Pediatrics'],
        about: 'Focusing on children\'s health, childhood illnesses, and behavioral issues using homeopathy.'
      },
      {
        id: 'w8',
        name: 'Dr. Rajan Nair',
        type: 'Homeopathy',
        specialization: 'Chronic Diseases, Autoimmune Disorders',
        city: 'Delhi',
        experience: 22,
        rating: 4.9,
        consultationFee: 600,
        availableSlots: ['10:00 AM', '12:00 PM', '3:00 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi', 'Malayalam'],
        qualifications: ['BHMS', 'MD Homeopathy', 'Immunology'],
        about: 'Expert in treating chronic diseases, autoimmune disorders, and complex medical conditions.'
      },
      {
        id: 'w9',
        name: 'Dr. Seema Reddy',
        type: 'Homeopathy',
        specialization: 'Women\'s Health, Hormonal Imbalances',
        city: 'Delhi',
        experience: 16,
        rating: 4.7,
        consultationFee: 500,
        availableSlots: ['9:00 AM', '11:00 AM', '2:30 PM', '5:00 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi', 'Telugu'],
        qualifications: ['BHMS', 'MD Homeopathy', 'Gynecology'],
        about: 'Specializing in women\'s health, hormonal imbalances, and reproductive health.'
      },

      // ============================================
      // MENTAL WELLNESS (150+ Therapists)
      // ServiceWellness
      // ============================================
      {
        id: 'w10',
        name: 'Dr. Ravi Malhotra',
        type: 'MentalHealth',
        specialization: 'Anxiety, Depression, Stress Management',
        city: 'Mumbai',
        experience: 8,
        rating: 4.8,
        consultationFee: 800,
        availableSlots: ['9:00 AM', '11:00 AM', '2:00 PM', '4:30 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi'],
        qualifications: ['MBBS', 'MD Psychiatry', 'Cognitive Behavioral Therapy'],
        about: 'Helping patients overcome anxiety, depression, and stress through evidence-based therapies.'
      },
      {
        id: 'w11',
        name: 'Dr. Sneha Kapoor',
        type: 'MentalHealth',
        specialization: 'Relationship Counseling, Marriage Counseling',
        city: 'Mumbai',
        experience: 6,
        rating: 4.6,
        consultationFee: 700,
        availableSlots: ['10:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi', 'Punjabi'],
        qualifications: ['MA Psychology', 'PhD Clinical Psychology'],
        about: 'Providing relationship counseling, marriage therapy, and family counseling services.'
      },
      {
        id: 'w12',
        name: 'Dr. Arjun Singh',
        type: 'MentalHealth',
        specialization: 'Trauma, PTSD, Grief Counseling',
        city: 'Delhi',
        experience: 10,
        rating: 4.9,
        consultationFee: 900,
        availableSlots: ['9:30 AM', '11:30 AM', '2:30 PM', '5:30 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi'],
        qualifications: ['MBBS', 'MD Psychiatry', 'Trauma Therapy'],
        about: 'Expert in treating trauma, PTSD, grief, and loss through specialized therapeutic approaches.'
      },
      {
        id: 'w13',
        name: 'Dr. Pooja Iyer',
        type: 'MentalHealth',
        specialization: 'Child Psychology, ADHD, Autism',
        city: 'Delhi',
        experience: 7,
        rating: 4.7,
        consultationFee: 750,
        availableSlots: ['9:00 AM', '10:30 AM', '1:00 PM', '3:30 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi', 'Tamil'],
        qualifications: ['MA Psychology', 'PhD Child Psychology', 'ADHD Specialist'],
        about: 'Specializing in child psychology, ADHD, autism spectrum disorders, and developmental issues.'
      },
      {
        id: 'w14',
        name: 'Dr. Vikram Mehta',
        type: 'MentalHealth',
        specialization: 'Addiction, Substance Abuse, Behavioral Therapy',
        city: 'Gurugram',
        experience: 12,
        rating: 4.8,
        consultationFee: 850,
        availableSlots: ['10:00 AM', '12:30 PM', '3:00 PM', '6:30 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi'],
        qualifications: ['MBBS', 'MD Psychiatry', 'Addiction Specialist'],
        about: 'Helping patients overcome addiction, substance abuse, and behavioral issues with comprehensive care.'
      }
    ];
  }

  private initializePackages(){
    this.packages = [
      // Ayurveda Packages
      {
        id: 'wp1',
        name: 'Panchakarma Detox',
        type: 'Ayurveda',
        description: 'Complete body detoxification and rejuvenation',
        duration: '7 Days',
        price: 15000,
        discount: 10,
        includes: ['Vamana', 'Virechana', 'Basti', 'Nasya', 'Rakta Mokshana']
      },
      {
        id: 'wp2',
        name: 'Stress Relief Ayurveda',
        type: 'Ayurveda',
        description: 'Ayurvedic treatments for stress and anxiety',
        duration: '5 Days',
        price: 8000,
        discount: 5,
        includes: ['Abhyanga', 'Shirodhara', 'Herbal Steam', 'Meditation']
      },
      
      // Homeopathy Packages
      {
        id: 'wp3',
        name: 'Chronic Care Homeopathy',
        type: 'Homeopathy',
        description: 'Comprehensive homeopathic treatment for chronic conditions',
        duration: '3 Months',
        price: 12000,
        discount: 15,
        includes: ['Initial Consultation', 'Follow-up Sessions', 'Custom Remedies', 'Progress Reports']
      },
      {
        id: 'wp4',
        name: 'Allergy Relief Package',
        type: 'Homeopathy',
        description: 'Homeopathic treatment for allergies and sensitivities',
        duration: '2 Months',
        price: 6000,
        discount: 0,
        includes: ['Allergy Assessment', 'Custom Remedies', 'Dietary Guidance', 'Follow-up']
      },

      // Mental Wellness Packages
      {
        id: 'wp5',
        name: 'Anxiety & Stress Program',
        type: 'MentalHealth',
        description: 'Comprehensive program for anxiety and stress management',
        duration: '6 Weeks',
        price: 18000,
        discount: 20,
        includes: ['Weekly Sessions', 'CBT Techniques', 'Mindfulness Training', 'Progress Tracking']
      },
      {
        id: 'wp6',
        name: 'Mindfulness & Well-being',
        type: 'MentalHealth',
        description: 'Mindfulness-based stress reduction program',
        duration: '4 Weeks',
        price: 10000,
        discount: 10,
        includes: ['Meditation Training', 'Mindfulness Exercises', 'Group Sessions', 'Personal Guidance']
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

      if (task.includes('find') || task.includes('search') || task.includes('practitioner')) {
        result = await this.findPractitioners(payload);
      } else if (task.includes('book') || task.includes('consultation')) {
        result = await this.bookConsultation(payload);
      } else if (task.includes('package') || task.includes('treatment')) {
        result = await this.getPackages(payload);
      } else if (task.includes('availability')) {
        result = await this.checkPractitionerAvailability(payload);
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

  private async findPractitioners(payload)<any> {
    const { 
      type,           // 'Ayurveda' | 'Homeopathy' | 'MentalHealth'
      city, 
      specialization,
      onlineOnly = false,
      maxResults = 10 
    } = payload;

    let results = this.practitioners;

    // Filter by wellness type
    if (type) {
      results = results.filter(p => p.type === type);
    }

    // Filter by city
    if (city) {
      results = results.filter(p => p.city.toLowerCase().includes(city.toLowerCase()));
    }

    // Filter by specialization
    if (specialization) {
      results = results.filter(p => 
        p.specialization.toLowerCase().includes(specialization.toLowerCase())
      );
    }

    // Filter online only
    if (onlineOnly) {
      results = results.filter(p => p.onlineAvailable);
    }

    // Sort by rating
    results.sort((a, b) => b.rating - a.rating);

    // Limit results
    results = results.slice(0, maxResults);

    // Add type labels
    const typeLabels= {
      'Ayurveda': 'Ayurveda & Wellness',
      'Homeopathy': 'Homeopathy Care',
      'MentalHealth': 'Mental Wellness'
    };

    return {
      practitioners.map(p => ({
        ...p,
        serviceType[p.type] || p.type,
        consultationFee: `₹${p.consultationFee}`
      })),
      total.length,
      query: { type, city, specialization, onlineOnly },
      serviceCounts: {
        ayurveda.practitioners.filter(p => p.type === 'Ayurveda').length,
        homeopathy.practitioners.filter(p => p.type === 'Homeopathy').length,
        mentalHealth.practitioners.filter(p => p.type === 'MentalHealth').length
      }
    };
  }

  private async bookConsultation(payload)<any> {
    const { 
      practitionerId, 
      patientName, 
      patientContact, 
      slot, 
      type = 'online' 
    } = payload;

    const practitioner = this.practitioners.find(p => p.id === practitionerId);
    if (!practitioner) {
      throw new Error('Practitioner not found');
    }

    // Check if slot is available
    if (!practitioner.availableSlots.includes(slot)) {
      throw new Error('Selected slot is not available');
    }

    // Check online availability
    if (type === 'online' && !practitioner.onlineAvailable) {
      throw new Error('Practitioner is not available for online consultation');
    }

    // Generate booking confirmation
    const bookingId = `WLN${Date.now()}`;
    
    // Remove the booked slot
    practitioner.availableSlots = practitioner.availableSlots.filter(s => s !== slot);

    const typeLabels= {
      'Ayurveda': 'Ayurveda & Wellness',
      'Homeopathy': 'Homeopathy Care',
      'MentalHealth': 'Mental Wellness'
    };

    return {
      bookingId,
      practitioner: {
        id.id,
        name.name,
        type.type,
        serviceType[practitioner.type] || practitioner.type,
        specialization.specialization,
        qualification.qualifications[0]
      },
      patient: {
        name,
        contact},
      slot,
      type,
      consultationFee: `₹${practitioner.consultationFee}`,
      status: 'Confirmed',
      timestampDate().toISOString(),
      instructions=== 'online' 
        ? 'You will receive a video call link 10 minutes before the session.'
        : 'Please arrive 15 minutes before the scheduled time.'
    };
  }

  private async getPackages(payload)<any> {
    const { type } = payload;

    let results = this.packages;

    if (type) {
      results = results.filter(p => p.type === type);
    }

    const typeLabels= {
      'Ayurveda': 'Ayurveda & Wellness',
      'Homeopathy': 'Homeopathy Care',
      'MentalHealth': 'Mental Wellness'
    };

    return {
      packages.map(p => ({
        ...p,
        serviceType[p.type] || p.type,
        finalPrice.price - (p.price * p.discount / 100),
        price: `₹${p.price}`,
        discount.discount > 0 ? `${p.discount}% off` : 'No discount'
      })),
      total.length,
      query: { type }
    };
  }

  private async checkPractitionerAvailability(payload)<any> {
    const { practitionerId, date } = payload;

    let targetPractitioners = this.practitioners;
    if (practitionerId) {
      targetPractitioners = this.practitioners.filter(p => p.id === practitionerId);
    }

    const availability = targetPractitioners.map(p => ({
      id.id,
      name.name,
      type.type,
      onlineAvailable.onlineAvailable,
      availableSlots.availableSlots,
      date|| new Date().toISOString().split('T')[0],
      consultationFee: `₹${p.consultationFee}`
    }));

    return {
      availability,
      timestampDate().toISOString()
    };
  }

  private async handleComplexQuery(task, payload)<any> {
    const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Available practitioners: ${JSON.stringify(this.practitioners)}
      Available packages: ${JSON.stringify(this.packages)}
      
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
    if (task.includes('find') || task.includes('search') || task.includes('practitioner')) {
      return 'find_practitioner';
    }
    if (task.includes('book') || task.includes('consultation')) {
      return 'book_consultation';
    }
    if (task.includes('package') || task.includes('treatment')) {
      return 'get_packages';
    }
    if (task.includes('availability')) {
      return 'check_availability';
    }
    return null;
  }
}



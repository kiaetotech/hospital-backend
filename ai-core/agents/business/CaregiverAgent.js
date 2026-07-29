// D:\hospital backend\ai-core\agents\business\CaregiverAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');

class CaregiverAgent extends BaseAgent {
  constructor(providerManager) {
    super(
      {
        name: 'Caregiver Agent',
        role: AgentRole.CAREGIVER,
        capabilities: [
          {
            name: 'find_caregiver',
            description: 'Find caregivers for home care services',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth: false
          },
          {
            name: 'book_caregiver',
            description: 'Book a caregiver for home care',
            priority: 1,
            estimatedLatency: 300,
            requiresAuth: true
          },
          {
            name: 'create_care_plan',
            description: 'Create a personalized care plan',
            priority: 2,
            estimatedLatency: 300,
            requiresAuth: true
          },
          {
            name: 'check_availability',
            description: 'Check caregiver availability',
            priority: 1,
            estimatedLatency: 150,
            requiresAuth: false
          }
        ]
      },
      providerManager
    );

    this.caregivers = [];
    this.carePlans = new Map();
    this.initializeCaregivers();
  }

  initializeCaregivers() {
    this.caregivers = [
      {
        id: 'cg1',
        name: 'Priya Sharma',
        type: 'Nurse',
        city: 'Mumbai',
        experience: 8,
        rating: 4.9,
        hourlyRate: 350,
        availableSlots: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        languages: ['English', 'Hindi', 'Marathi'],
        certifications: ['GNM', 'BSc Nursing', 'Critical Care'],
        specialties: ['Wound Care', 'Medication Management', 'Vital Monitoring'],
        about: 'Experienced nurse with 8 years of experience in home care and critical care.',
        verified: true,
        availableNow: true
      },
      {
        id: 'cg2',
        name: 'Sunita Patel',
        type: 'Nurse',
        city: 'Mumbai',
        experience: 12,
        rating: 4.8,
        hourlyRate: 400,
        availableSlots: ['Mon', 'Wed', 'Fri', 'Sat', 'Sun'],
        languages: ['English', 'Hindi', 'Gujarati'],
        certifications: ['GNM', 'Post Basic Nursing', 'Geriatric Care'],
        specialties: ['Elderly Care', 'Dementia Care', 'Palliative Care'],
        about: 'Specializing in elderly care, dementia management, and palliative care services.',
        verified: true,
        availableNow: true
      },
      {
        id: 'cg3',
        name: 'Rahul Singh',
        type: 'Nurse',
        city: 'Delhi',
        experience: 5,
        rating: 4.7,
        hourlyRate: 300,
        availableSlots: ['Tue', 'Thu', 'Sat', 'Sun'],
        languages: ['English', 'Hindi'],
        certifications: ['GNM', 'BSc Nursing'],
        specialties: ['Post-Surgery Care', 'Wound Care', 'Patient Education'],
        about: 'Dedicated nurse with experience in post-operative care and patient education.',
        verified: true,
        availableNow: true
      },
      {
        id: 'cg4',
        name: 'Deepa Reddy',
        type: 'Nurse',
        city: 'Delhi',
        experience: 15,
        rating: 4.9,
        hourlyRate: 450,
        availableSlots: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        languages: ['English', 'Hindi', 'Telugu'],
        certifications: ['BSc Nursing', 'MSc Nursing', 'Critical Care'],
        specialties: ['ICU Care', 'Ventilator Care', 'Critical Patient Management'],
        about: 'Expert in critical care nursing with 15 years of experience in ICU and home care.',
        verified: true,
        availableNow: true
      },
      {
        id: 'cg5',
        name: 'Mohan Kumar',
        type: 'Attendant',
        city: 'Mumbai',
        experience: 4,
        rating: 4.6,
        hourlyRate: 200,
        availableSlots: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        languages: ['Hindi', 'Marathi'],
        certifications: ['Patient Care Assistant', 'First Aid'],
        specialties: ['Daily Living Assistance', 'Mobility Support', 'Feeding Assistance'],
        about: 'Compassionate attendant providing daily living assistance and mobility support.',
        verified: true,
        availableNow: true
      },
      {
        id: 'cg6',
        name: 'Ramesh Yadav',
        type: 'Attendant',
        city: 'Delhi',
        experience: 6,
        rating: 4.5,
        hourlyRate: 220,
        availableSlots: ['Mon', 'Wed', 'Fri', 'Sun'],
        languages: ['Hindi', 'English'],
        certifications: ['Patient Care Assistant'],
        specialties: ['Bathing Assistance', 'Dressing Assistance', 'Companionship'],
        about: 'Caring attendant with experience in personal care and companionship services.',
        verified: true,
        availableNow: true
      },
      {
        id: 'cg7',
        name: 'Radhika Krishnan',
        type: 'ElderCare',
        city: 'Mumbai',
        experience: 10,
        rating: 4.9,
        hourlyRate: 380,
        availableSlots: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        languages: ['English', 'Hindi', 'Tamil'],
        certifications: ['Geriatric Care', 'Dementia Care', 'Senior Care'],
        specialties: ['Elderly Care', 'Dementia Support', "Alzheimer's Care"],
        about: 'Specialist in elderly care with 10 years of experience in dementia and Alzheimer\'s care.',
        verified: true,
        availableNow: true
      },
      {
        id: 'cg8',
        name: 'Gurpreet Kaur',
        type: 'ElderCare',
        city: 'Delhi',
        experience: 7,
        rating: 4.7,
        hourlyRate: 350,
        availableSlots: ['Tue', 'Thu', 'Sat', 'Sun'],
        languages: ['English', 'Hindi', 'Punjabi'],
        certifications: ['Geriatric Care', 'Senior Care'],
        specialties: ['Elderly Care', 'Palliative Care', 'Companionship'],
        about: 'Experienced caregiver providing compassionate care for the elderly.',
        verified: true,
        availableNow: true
      },
      {
        id: 'cg9',
        name: 'Ananya Verma',
        type: 'SpecialNeeds',
        city: 'Mumbai',
        experience: 6,
        rating: 4.8,
        hourlyRate: 400,
        availableSlots: ['Mon', 'Wed', 'Fri', 'Sat', 'Sun'],
        languages: ['English', 'Hindi'],
        certifications: ['Special Education', 'Behavioral Therapy', 'Speech Therapy'],
        specialties: ['Autism Support', 'Developmental Disorders', 'Behavioral Management'],
        about: 'Specialist in autism care and developmental disorders with behavioral therapy training.',
        verified: true,
        availableNow: true
      },
      {
        id: 'cg10',
        name: 'Suresh Nair',
        type: 'SpecialNeeds',
        city: 'Delhi',
        experience: 8,
        rating: 4.8,
        hourlyRate: 420,
        availableSlots: ['Mon', 'Tue', 'Thu', 'Fri'],
        languages: ['English', 'Hindi', 'Malayalam'],
        certifications: ['Special Education', 'Occupational Therapy'],
        specialties: ['Cerebral Palsy Care', 'Mobility Support', 'Therapy Assistance'],
        about: 'Experienced in caring for individuals with cerebral palsy and other special needs.',
        verified: true,
        availableNow: true
      },
      {
        id: 'cg11',
        name: 'Kavita Joshi',
        type: 'PostSurgery',
        city: 'Mumbai',
        experience: 9,
        rating: 4.7,
        hourlyRate: 360,
        availableSlots: ['Mon', 'Tue', 'Thu', 'Fri', 'Sat'],
        languages: ['English', 'Hindi', 'Marathi'],
        certifications: ['BSc Nursing', 'Surgical Nursing', 'Wound Care'],
        specialties: ['Post-Operative Care', 'Wound Management', 'Pain Management'],
        about: 'Expert in post-operative care with 9 years of experience in surgical recovery.',
        verified: true,
        availableNow: true
      },
      {
        id: 'cg12',
        name: 'Manish Gupta',
        type: 'PostSurgery',
        city: 'Delhi',
        experience: 5,
        rating: 4.6,
        hourlyRate: 320,
        availableSlots: ['Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        languages: ['English', 'Hindi'],
        certifications: ['GNM', 'Surgical Nursing'],
        specialties: ['Wound Care', 'Suture Removal', 'Physical Therapy Assistance'],
        about: 'Compassionate caregiver with expertise in post-surgical recovery and wound care.',
        verified: true,
        availableNow: true
      },
      {
        id: 'cg13',
        name: 'Nalini Menon',
        type: 'Palliative',
        city: 'Mumbai',
        experience: 12,
        rating: 4.9,
        hourlyRate: 450,
        availableSlots: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        languages: ['English', 'Hindi', 'Tamil', 'Malayalam'],
        certifications: ['Palliative Care', 'Hospice Care', 'Pain Management'],
        specialties: ['Palliative Care', 'Pain Management', 'End of Life Care'],
        about: 'Specialist in palliative care with 12 years of experience in hospice and pain management.',
        verified: true,
        availableNow: true
      },
      {
        id: 'cg14',
        name: 'Vijay Singh',
        type: 'Palliative',
        city: 'Delhi',
        experience: 10,
        rating: 4.8,
        hourlyRate: 420,
        availableSlots: ['Tue', 'Thu', 'Sat', 'Sun'],
        languages: ['English', 'Hindi'],
        certifications: ['Palliative Care', 'Hospice Care'],
        specialties: ['Pain Management', 'Emotional Support', 'Family Support'],
        about: 'Dedicated palliative caregiver providing compassionate end-of-life care and support.',
        verified: true,
        availableNow: true
      }
    ];
  }

  async execute(request) {
    this.setStatus(AgentStatus.BUSY);
    this.setCurrentTask(request.task);

    try {
      if (!this.validateRequest(request)) {
        throw new Error('Invalid request: missing required fields or capabilities');
      }

      var task = request.task;
      var payload = request.payload;
      this.log('Executing task: ' + task, 'info');

      var result;

      if (task.includes('find') || task.includes('search')) {
        result = await this.findCaregivers(payload);
      } else if (task.includes('book') || task.includes('hire')) {
        result = await this.bookCaregiver(payload);
      } else if (task.includes('plan') || task.includes('care plan')) {
        result = await this.createCarePlan(payload);
      } else if (task.includes('availability')) {
        result = await this.checkAvailability(payload);
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

  async findCaregivers(payload) {
    var type = payload.type;
    var city = payload.city;
    var experience = payload.experience;
    var minRating = payload.minRating || 0;
    var availableNow = payload.availableNow || false;
    var language = payload.language;
    var maxResults = payload.maxResults || 10;

    var results = this.caregivers.slice();

    if (type) {
      results = results.filter(function(c) { return c.type === type; });
    }
    if (city) {
      results = results.filter(function(c) { return c.city.toLowerCase().includes(city.toLowerCase()); });
    }
    if (experience) {
      results = results.filter(function(c) { return c.experience >= experience; });
    }
    if (minRating) {
      results = results.filter(function(c) { return c.rating >= minRating; });
    }
    if (availableNow) {
      results = results.filter(function(c) { return c.availableNow; });
    }
    if (language) {
      results = results.filter(function(c) {
        return c.languages.some(function(l) { return l.toLowerCase().includes(language.toLowerCase()); });
      });
    }

    results.sort(function(a, b) { return b.rating - a.rating; });
    results = results.slice(0, maxResults);

    var typeCounts = {};
    for (var i = 0; i < this.caregivers.length; i++) {
      var c = this.caregivers[i];
      typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
    }

    var mappedResults = results.map(function(c) {
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        city: c.city,
        experience: c.experience + ' years',
        rating: c.rating,
        hourlyRate: '₹' + c.hourlyRate + '/hour',
        availableSlots: c.availableSlots,
        languages: c.languages.join(', '),
        certifications: c.certifications.join(', '),
        specialties: c.specialties.join(', '),
        about: c.about,
        verified: c.verified,
        availableNow: c.availableNow
      };
    });

    return {
      caregivers: mappedResults,
      total: results.length,
      query: { type: type, city: city, experience: experience, minRating: minRating, availableNow: availableNow, language: language },
      typeCounts: typeCounts,
      serviceName: 'Home Care'
    };
  }

  async bookCaregiver(payload) {
    var caregiverId = payload.caregiverId;
    var patientName = payload.patientName;
    var patientContact = payload.patientContact;
    var patientAddress = payload.patientAddress;
    var startDate = payload.startDate;
    var hoursPerDay = payload.hoursPerDay;
    var daysPerWeek = payload.daysPerWeek;
    var notes = payload.notes;

    var caregiver = this.caregivers.find(function(c) { return c.id === caregiverId; });
    if (!caregiver) {
      throw new Error('Caregiver not found');
    }

    if (!caregiver.availableNow) {
      throw new Error('Caregiver is not available at the moment');
    }

    var dailyCost = caregiver.hourlyRate * hoursPerDay;
    var weeklyCost = dailyCost * daysPerWeek;
    var monthlyCost = weeklyCost * 4;
    var bookingId = 'HMC' + Date.now();

    return {
      bookingId: bookingId,
      caregiver: {
        id: caregiver.id,
        name: caregiver.name,
        type: caregiver.type,
        rating: caregiver.rating,
        hourlyRate: '₹' + caregiver.hourlyRate + '/hour'
      },
      patient: {
        name: patientName,
        contact: patientContact,
        address: patientAddress
      },
      schedule: {
        startDate: startDate,
        hoursPerDay: hoursPerDay,
        daysPerWeek: daysPerWeek
      },
      cost: {
        daily: '₹' + dailyCost,
        weekly: '₹' + weeklyCost,
        monthly: '₹' + monthlyCost
      },
      notes: notes || '',
      status: 'Confirmed',
      timestamp: new Date().toISOString(),
      instructions: 'Caregiver will arrive at the scheduled time. Please ensure all necessary supplies are available.'
    };
  }

  async createCarePlan(payload) {
    var patientName = payload.patientName;
    var caregiverId = payload.caregiverId;
    var type = payload.type;
    var startDate = payload.startDate;
    var endDate = payload.endDate;
    var schedule = payload.schedule;
    var hoursPerDay = payload.hoursPerDay;
    var tasks = payload.tasks;

    var caregiver = this.caregivers.find(function(c) { return c.id === caregiverId; });
    if (!caregiver) {
      throw new Error('Caregiver not found');
    }

    var carePlanId = 'PLN' + Date.now();

    var carePlan = {
      id: carePlanId,
      patientName: patientName,
      caregiverId: caregiverId,
      type: type || 'General',
      startDate: startDate,
      endDate: endDate || undefined,
      schedule: schedule || 'Daily',
      hoursPerDay: hoursPerDay || 4,
      tasks: tasks || ['Personal Care', 'Medication Reminders', 'Companionship'],
      status: 'Pending'
    };

    this.carePlans.set(carePlanId, carePlan);

    var result = {
      id: carePlan.id,
      patientName: carePlan.patientName,
      caregiverId: carePlan.caregiverId,
      caregiverName: caregiver.name,
      caregiverType: caregiver.type,
      type: carePlan.type,
      startDate: carePlan.startDate,
      endDate: carePlan.endDate,
      schedule: carePlan.schedule,
      hoursPerDay: carePlan.hoursPerDay,
      tasks: carePlan.tasks,
      status: carePlan.status
    };

    return {
      carePlan: result,
      dailySchedule: {
        tasks: tasks || ['Personal Care', 'Medication Reminders', 'Companionship'],
        hoursPerDay: hoursPerDay || 4,
        schedule: schedule || 'Daily'
      },
      timestamp: new Date().toISOString()
    };
  }

  async checkAvailability(payload) {
    var caregiverId = payload.caregiverId;
    var date = payload.date;

    var targetCaregivers = this.caregivers;
    if (caregiverId) {
      targetCaregivers = this.caregivers.filter(function(c) { return c.id === caregiverId; });
    }

    var availability = targetCaregivers.map(function(c) {
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        availableNow: c.availableNow,
        availableSlots: c.availableSlots,
        date: date || new Date().toISOString().split('T')[0],
        hourlyRate: '₹' + c.hourlyRate + '/hour'
      };
    });

    return {
      availability: availability,
      timestamp: new Date().toISOString()
    };
  }

  async handleComplexQuery(task, payload) {
    var prompt = 'Task: ' + task + '\n' +
      'Payload: ' + JSON.stringify(payload) + '\n' +
      'Available caregivers: ' + JSON.stringify(this.caregivers) + '\n' +
      'Please analyze the query and provide a recommendation.';

    var response = await this.providerManager.generate(prompt);

    return {
      aiResponse: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed
    };
  }

  getRequiredCapability(task) {
    if (task.includes('find') || task.includes('search')) {
      return 'find_caregiver';
    }
    if (task.includes('book') || task.includes('hire')) {
      return 'book_caregiver';
    }
    if (task.includes('plan') || task.includes('care plan')) {
      return 'create_care_plan';
    }
    if (task.includes('availability')) {
      return 'check_availability';
    }
    return null;
  }
}

module.exports = { CaregiverAgent };
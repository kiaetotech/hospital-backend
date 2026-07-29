// D:\hospital backend\ai-core\agents\business\DoctorAgent.ts

import { AgentRole, AgentStatus, AgentRequest, AgentResponse } from '../../../shared/types/AgentTypes';
import { BaseAgent } from '../base/BaseAgent';
import { ProviderManager } from '../../providers/ProviderManager';



export class DoctorAgent extends BaseAgent {
  private doctors[] = [];

  constructor(providerManager) {
    super(
      {
        name: 'Doctor Agent',
        role.DOCTOR,
        capabilities: [
          {
            name: 'find_doctor',
            description: 'Find doctors by specialty, location, or availability',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth},
          {
            name: 'book_consultation',
            description: 'Book a consultation with a doctor',
            priority: 1,
            estimatedLatency: 300,
            requiresAuth},
          {
            name: 'check_availability',
            description: 'Check doctor availability for online or in-person consultation',
            priority: 1,
            estimatedLatency: 150,
            requiresAuth},
          {
            name: 'get_doctor_profile',
            description: 'Get detailed doctor profile including experience and ratings',
            priority: 2,
            estimatedLatency: 100,
            requiresAuth}
        ]
      },
      providerManager
    );

    // Seed with sample data
    this.initializeDoctors();
  }

  private initializeDoctors(){
    this.doctors = [
      {
        id: 'd1',
        name: 'Dr. Rajesh Kumar',
        specialty: 'Cardiology',
        hospital: 'Apollo Hospital',
        city: 'Mumbai',
        experience: 15,
        rating: 4.9,
        consultationFee: 800,
        availableSlots: ['10:00 AM', '11:30 AM', '2:00 PM', '4:30 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi', 'Marathi']
      },
      {
        id: 'd2',
        name: 'Dr. Priya Sharma',
        specialty: 'Orthopedics',
        hospital: 'Fortis Hospital',
        city: 'Mumbai',
        experience: 12,
        rating: 4.7,
        consultationFee: 700,
        availableSlots: ['9:00 AM', '1:00 PM', '3:30 PM', '5:00 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi']
      },
      {
        id: 'd3',
        name: 'Dr. Ananya Patel',
        specialty: 'Neurology',
        hospital: 'AIIMS Delhi',
        city: 'Delhi',
        experience: 20,
        rating: 4.9,
        consultationFee: 1200,
        availableSlots: ['10:30 AM', '12:00 PM', '3:00 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi', 'Gujarati']
      },
      {
        id: 'd4',
        name: 'Dr. Vikram Singh',
        specialty: 'Oncology',
        hospital: 'Medanta Hospital',
        city: 'Gurugram',
        experience: 18,
        rating: 4.8,
        consultationFee: 1500,
        availableSlots: ['9:30 AM', '11:00 AM', '2:30 PM', '5:30 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi']
      },
      {
        id: 'd5',
        name: 'Dr. Meera Reddy',
        specialty: 'Gynecology',
        hospital: 'Max Hospital',
        city: 'Delhi',
        experience: 10,
        rating: 4.6,
        consultationFee: 600,
        availableSlots: ['8:30 AM', '10:00 AM', '1:30 PM', '4:00 PM'],
        onlineAvailable,
        languages: ['English', 'Tamil', 'Hindi']
      },
      {
        id: 'd6',
        name: 'Dr. Sanjay Gupta',
        specialty: 'Dermatology',
        hospital: 'Apollo Hospital',
        city: 'Mumbai',
        experience: 8,
        rating: 4.5,
        consultationFee: 500,
        availableSlots: ['9:00 AM', '11:30 AM', '2:00 PM'],
        onlineAvailable,
        languages: ['English', 'Hindi']
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

      // Route to appropriate handler
      if (task.includes('find') || task.includes('search')) {
        result = await this.findDoctors(payload);
      } else if (task.includes('book') || task.includes('appointment')) {
        result = await this.bookConsultation(payload);
      } else if (task.includes('availability')) {
        result = await this.checkDoctorAvailability(payload);
      } else if (task.includes('profile') || task.includes('details')) {
        result = await this.getDoctorProfile(payload);
      } else {
        // Use AI for complex queries
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

  private async findDoctors(payload)<any> {
    const { specialty, city, hospital, maxResults = 10, onlineOnly = false } = payload;

    let results = this.doctors;

    // Filter by specialty
    if (specialty) {
      results = results.filter(d => 
        d.specialty.toLowerCase().includes(specialty.toLowerCase())
      );
    }

    // Filter by city
    if (city) {
      results = results.filter(d => 
        d.city.toLowerCase().includes(city.toLowerCase())
      );
    }

    // Filter by hospital
    if (hospital) {
      results = results.filter(d => 
        d.hospital.toLowerCase().includes(hospital.toLowerCase())
      );
    }

    // Filter online only
    if (onlineOnly) {
      results = results.filter(d => d.onlineAvailable);
    }

    // Sort by rating
    results.sort((a, b) => b.rating - a.rating);

    // Limit results
    results = results.slice(0, maxResults);

    return {
      doctors,
      total.length,
      query: { specialty, city, hospital, onlineOnly }
    };
  }

  private async bookConsultation(payload)<any> {
    const { doctorId, patientName, patientContact, slot, type = 'online' } = payload;

    const doctor = this.doctors.find(d => d.id === doctorId);
    if (!doctor) {
      throw new Error('Doctor not found');
    }

    // Check if slot is available
    if (!doctor.availableSlots.includes(slot)) {
      throw new Error('Selected slot is not available');
    }

    // Check online availability
    if (type === 'online' && !doctor.onlineAvailable) {
      throw new Error('Doctor is not available for online consultation');
    }

    // Generate booking confirmation
    const bookingId = `BKG${Date.now()}`;
    
    // Remove the booked slot
    doctor.availableSlots = doctor.availableSlots.filter(s => s !== slot);

    return {
      bookingId,
      doctor: {
        id.id,
        name.name,
        specialty.specialty,
        hospital.hospital
      },
      patient: {
        name,
        contact},
      slot,
      type,
      consultationFee.consultationFee,
      status: 'Confirmed',
      timestampDate().toISOString(),
      instructions: 'Please arrive 15 minutes before the scheduled time. Carry your medical reports.'
    };
  }

  private async checkDoctorAvailability(payload)<any> {
    const { doctorId, date } = payload;

    let targetDoctors = this.doctors;
    if (doctorId) {
      targetDoctors = this.doctors.filter(d => d.id === doctorId);
    }

    const availability = targetDoctors.map(d => ({
      id.id,
      name.name,
      specialty.specialty,
      onlineAvailable.onlineAvailable,
      availableSlots.availableSlots,
      date|| new Date().toISOString().split('T')[0]
    }));

    return {
      availability,
      timestampDate().toISOString()
    };
  }

  private async getDoctorProfile(payload)<any> {
    const { doctorId } = payload;

    const doctor = this.doctors.find(d => d.id === doctorId);
    if (!doctor) {
      throw new Error('Doctor not found');
    }

    return {
      doctor: {
        ...doctor,
        consultationFee: `₹${doctor.consultationFee}`,
        experience: `${doctor.experience} years`,
        availableSlotsCount.availableSlots.length
      }
    };
  }

  private async handleComplexQuery(task, payload)<any> {
    const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Available doctors: ${JSON.stringify(this.doctors)}
      
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
    if (task.includes('find') || task.includes('search')) {
      return 'find_doctor';
    }
    if (task.includes('book') || task.includes('appointment')) {
      return 'book_consultation';
    }
    if (task.includes('availability')) {
      return 'check_availability';
    }
    if (task.includes('profile') || task.includes('details')) {
      return 'get_doctor_profile';
    }
    return null;
  }
}



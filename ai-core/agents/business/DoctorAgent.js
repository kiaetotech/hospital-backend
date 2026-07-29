// D:\hospital backend\ai-core\agents\business\DoctorAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');

class DoctorAgent extends BaseAgent {
  constructor(providerManager) {
    super(
      {
        name: 'Doctor Agent',
        role: AgentRole.DOCTOR,
        capabilities: [
          {
            name: 'find_doctor',
            description: 'Find doctors by specialty, location, or availability',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth: false
          },
          {
            name: 'book_consultation',
            description: 'Book a consultation with a doctor',
            priority: 1,
            estimatedLatency: 300,
            requiresAuth: true
          },
          {
            name: 'check_availability',
            description: 'Check doctor availability for online or in-person consultation',
            priority: 1,
            estimatedLatency: 150,
            requiresAuth: false
          },
          {
            name: 'get_doctor_profile',
            description: 'Get detailed doctor profile including experience and ratings',
            priority: 2,
            estimatedLatency: 100,
            requiresAuth: false
          }
        ]
      },
      providerManager
    );

    this.doctors = [];
    this.initializeDoctors();
  }

  initializeDoctors() {
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
        onlineAvailable: true,
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
        onlineAvailable: true,
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
        onlineAvailable: true,
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
        onlineAvailable: true,
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
        onlineAvailable: true,
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
        onlineAvailable: true,
        languages: ['English', 'Hindi']
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
        result = await this.findDoctors(payload);
      } else if (task.includes('book') || task.includes('appointment')) {
        result = await this.bookConsultation(payload);
      } else if (task.includes('availability')) {
        result = await this.checkDoctorAvailability(payload);
      } else if (task.includes('profile') || task.includes('details')) {
        result = await this.getDoctorProfile(payload);
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

  async findDoctors(payload) {
    var specialty = payload.specialty;
    var city = payload.city;
    var hospital = payload.hospital;
    var maxResults = payload.maxResults || 10;
    var onlineOnly = payload.onlineOnly || false;

    var results = this.doctors.slice();

    if (specialty) {
      results = results.filter(function(d) {
        return d.specialty.toLowerCase().includes(specialty.toLowerCase());
      });
    }

    if (city) {
      results = results.filter(function(d) {
        return d.city.toLowerCase().includes(city.toLowerCase());
      });
    }

    if (hospital) {
      results = results.filter(function(d) {
        return d.hospital.toLowerCase().includes(hospital.toLowerCase());
      });
    }

    if (onlineOnly) {
      results = results.filter(function(d) { return d.onlineAvailable; });
    }

    results.sort(function(a, b) { return b.rating - a.rating; });
    results = results.slice(0, maxResults);

    return {
      doctors: results,
      total: results.length,
      query: { specialty: specialty, city: city, hospital: hospital, onlineOnly: onlineOnly }
    };
  }

  async bookConsultation(payload) {
    var doctorId = payload.doctorId;
    var patientName = payload.patientName;
    var patientContact = payload.patientContact;
    var slot = payload.slot;
    var type = payload.type || 'online';

    var doctor = this.doctors.find(function(d) { return d.id === doctorId; });
    if (!doctor) {
      throw new Error('Doctor not found');
    }

    if (!doctor.availableSlots.includes(slot)) {
      throw new Error('Selected slot is not available');
    }

    if (type === 'online' && !doctor.onlineAvailable) {
      throw new Error('Doctor is not available for online consultation');
    }

    var bookingId = 'BKG' + Date.now();
    doctor.availableSlots = doctor.availableSlots.filter(function(s) { return s !== slot; });

    return {
      bookingId: bookingId,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        specialty: doctor.specialty,
        hospital: doctor.hospital
      },
      patient: {
        name: patientName,
        contact: patientContact
      },
      slot: slot,
      type: type,
      consultationFee: doctor.consultationFee,
      status: 'Confirmed',
      timestamp: new Date().toISOString(),
      instructions: 'Please arrive 15 minutes before the scheduled time. Carry your medical reports.'
    };
  }

  async checkDoctorAvailability(payload) {
    var doctorId = payload.doctorId;
    var date = payload.date;

    var targetDoctors = this.doctors;
    if (doctorId) {
      targetDoctors = this.doctors.filter(function(d) { return d.id === doctorId; });
    }

    var availability = targetDoctors.map(function(d) {
      return {
        id: d.id,
        name: d.name,
        specialty: d.specialty,
        onlineAvailable: d.onlineAvailable,
        availableSlots: d.availableSlots,
        date: date || new Date().toISOString().split('T')[0]
      };
    });

    return {
      availability: availability,
      timestamp: new Date().toISOString()
    };
  }

  async getDoctorProfile(payload) {
    var doctorId = payload.doctorId;

    var doctor = this.doctors.find(function(d) { return d.id === doctorId; });
    if (!doctor) {
      throw new Error('Doctor not found');
    }

    return {
      doctor: {
        id: doctor.id,
        name: doctor.name,
        specialty: doctor.specialty,
        hospital: doctor.hospital,
        city: doctor.city,
        experience: doctor.experience + ' years',
        rating: doctor.rating,
        consultationFee: '₹' + doctor.consultationFee,
        availableSlots: doctor.availableSlots,
        availableSlotsCount: doctor.availableSlots.length,
        onlineAvailable: doctor.onlineAvailable,
        languages: doctor.languages
      }
    };
  }

  async handleComplexQuery(task, payload) {
    var prompt = 'Task: ' + task + '\n' +
      'Payload: ' + JSON.stringify(payload) + '\n\n' +
      'Available doctors: ' + JSON.stringify(this.doctors) + '\n\n' +
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

module.exports = { DoctorAgent };
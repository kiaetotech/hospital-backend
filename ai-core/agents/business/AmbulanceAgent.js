// D:\hospital backend\ai-core\agents\business\AmbulanceAgent.ts

import { AgentRole, AgentStatus, AgentRequest, AgentResponse } from '../../../shared/types/AgentTypes';
import { BaseAgent } from '../base/BaseAgent';
import { ProviderManager } from '../../providers/ProviderManager';

interface Ambulance {
  id: string;
  vehicleNumber: string;
  type: 'Basic' | 'Advanced' | 'ICU';
  city: string;
  currentLocation: { lat: number; lng: number };
  status: 'Available' | 'OnRoute' | 'OnSite' | 'Returning';
  driverName: string;
  driverContact: string;
  estimatedArrival: number; // minutes
  equipment: string[];
}

interface EmergencyRequest {
  patientName: string;
  patientContact: string;
  pickupLocation: { address: string; lat: number; lng: number };
  dropoffLocation: { address: string; lat: number; lng: number };
  emergencyType: 'Medical' | 'Accident' | 'Cardiac' | 'Stroke' | 'Other';
  notes?: string;
}

export class AmbulanceAgent extends BaseAgent {
  private ambulances: Ambulance[] = [];
  private activeTrips: Map<string, any> = new Map();

  constructor(providerManager: ProviderManager) {
    super(
      {
        name: 'Ambulance Agent',
        role: AgentRole.AMBULANCE,
        capabilities: [
          {
            name: 'dispatch_ambulance',
            description: 'Dispatch nearest available ambulance to emergency location',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth: true
          },
          {
            name: 'track_ambulance',
            description: 'Track ambulance location and ETA in real-time',
            priority: 2,
            estimatedLatency: 100,
            requiresAuth: false
          },
          {
            name: 'check_availability',
            description: 'Check ambulance availability by location and type',
            priority: 1,
            estimatedLatency: 150,
            requiresAuth: false
          },
          {
            name: 'calculate_eta',
            description: 'Calculate estimated time of arrival for ambulance',
            priority: 2,
            estimatedLatency: 100,
            requiresAuth: false
          }
        ]
      },
      providerManager
    );

    this.initializeAmbulances();
  }

  private initializeAmbulances(): void {
    this.ambulances = [
      {
        id: 'amb1',
        vehicleNumber: 'MH-01-AB-1234',
        type: 'Advanced',
        city: 'Mumbai',
        currentLocation: { lat: 19.0760, lng: 72.8777 },
        status: 'Available',
        driverName: 'Rajesh Singh',
        driverContact: '+91-9876543210',
        estimatedArrival: 0,
        equipment: ['Oxygen', 'Ventilator', 'Defibrillator', 'ECG Monitor', 'Splints']
      },
      {
        id: 'amb2',
        vehicleNumber: 'MH-02-CD-5678',
        type: 'ICU',
        city: 'Mumbai',
        currentLocation: { lat: 19.1136, lng: 72.8697 },
        status: 'Available',
        driverName: 'Sanjay Patel',
        driverContact: '+91-9876543211',
        estimatedArrival: 0,
        equipment: ['Oxygen', 'Ventilator', 'Defibrillator', 'ECG Monitor', 'ICU Bed', 'Ventilator']
      },
      {
        id: 'amb3',
        vehicleNumber: 'DL-01-EF-9012',
        type: 'Basic',
        city: 'Delhi',
        currentLocation: { lat: 28.6139, lng: 77.2090 },
        status: 'Available',
        driverName: 'Amit Kumar',
        driverContact: '+91-9876543212',
        estimatedArrival: 0,
        equipment: ['Oxygen', 'Stretcher', 'First Aid Kit']
      },
      {
        id: 'amb4',
        vehicleNumber: 'DL-02-GH-3456',
        type: 'Advanced',
        city: 'Delhi',
        currentLocation: { lat: 28.6186, lng: 77.2050 },
        status: 'Available',
        driverName: 'Vikram Sharma',
        driverContact: '+91-9876543213',
        estimatedArrival: 0,
        equipment: ['Oxygen', 'Ventilator', 'Defibrillator', 'ECG Monitor', 'Splints']
      },
      {
        id: 'amb5',
        vehicleNumber: 'HR-01-IJ-7890',
        type: 'Advanced',
        city: 'Gurugram',
        currentLocation: { lat: 28.4595, lng: 77.0266 },
        status: 'Available',
        driverName: 'Deepak Yadav',
        driverContact: '+91-9876543214',
        estimatedArrival: 0,
        equipment: ['Oxygen', 'Ventilator', 'Defibrillator', 'ECG Monitor', 'Splints']
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

      if (task.includes('dispatch') || task.includes('emergency')) {
        result = await this.dispatchAmbulance(payload);
      } else if (task.includes('track') || task.includes('location')) {
        result = await this.trackAmbulance(payload);
      } else if (task.includes('availability') || task.includes('available')) {
        result = await this.checkAvailability(payload);
      } else if (task.includes('eta') || task.includes('arrival')) {
        result = await this.calculateETA(payload);
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

  private async dispatchAmbulance(payload: any): Promise<any> {
    const { patientName, patientContact, pickupLocation, dropoffLocation, emergencyType, notes } = payload;

    if (!pickupLocation || !patientName) {
      throw new Error('Patient name and pickup location are required');
    }

    // Find nearest available ambulance
    const nearestAmbulance = this.findNearestAmbulance(pickupLocation);
    
    if (!nearestAmbulance) {
      throw new Error('No ambulances available in your area');
    }

    // Calculate ETA
    const eta = this.calculateDistance(pickupLocation, nearestAmbulance.currentLocation);
    const etaMinutes = Math.round(eta * 2); // Rough estimate: 1km = 2 minutes

    // Update ambulance status
    nearestAmbulance.status = 'OnRoute';
    nearestAmbulance.estimatedArrival = etaMinutes;

    // Generate trip ID
    const tripId = `TRIP${Date.now()}`;

    // Store active trip
    this.activeTrips.set(tripId, {
      ambulanceId: nearestAmbulance.id,
      patientName,
      patientContact,
      pickupLocation,
      dropoffLocation,
      emergencyType: emergencyType || 'Medical',
      status: 'Dispatched',
      dispatchedAt: new Date().toISOString(),
      estimatedArrival: etaMinutes
    });

    return {
      tripId,
      ambulance: {
        id: nearestAmbulance.id,
        vehicleNumber: nearestAmbulance.vehicleNumber,
        type: nearestAmbulance.type,
        driverName: nearestAmbulance.driverName,
        driverContact: nearestAmbulance.driverContact
      },
      eta: etaMinutes,
      status: 'Dispatched',
      emergencyType: emergencyType || 'Medical',
      message: `Ambulance ${nearestAmbulance.vehicleNumber} is on its way. ETA: ${etaMinutes} minutes`,
      tracking: {
        ambulanceLocation: nearestAmbulance.currentLocation,
        pickupLocation,
        dropoffLocation: dropoffLocation || null
      }
    };
  }

  private findNearestAmbulance(pickupLocation: { lat: number; lng: number }): Ambulance | null {
    let nearest: Ambulance | null = null;
    let minDistance = Infinity;

    for (const ambulance of this.ambulances) {
      if (ambulance.status !== 'Available') continue;

      const distance = this.calculateDistance(pickupLocation, ambulance.currentLocation);
      
      // Priority: Advanced > ICU > Basic
      const typePriority = { 'Advanced': 3, 'ICU': 2, 'Basic': 1 };
      const typeScore = typePriority[ambulance.type] || 1;
      
      // Combine distance and type priority
      const adjustedDistance = distance / typeScore;
      
      if (adjustedDistance < minDistance) {
        minDistance = adjustedDistance;
        nearest = ambulance;
      }
    }

    return nearest;
  }

  private calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
    // Haversine formula to calculate distance in km
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private async trackAmbulance(payload: any): Promise<any> {
    const { tripId, ambulanceId } = payload;

    if (tripId) {
      const trip = this.activeTrips.get(tripId);
      if (!trip) {
        throw new Error('Trip not found');
      }

      const ambulance = this.ambulances.find(a => a.id === trip.ambulanceId);
      
      return {
        tripId,
        status: trip.status,
        ambulance: ambulance ? {
          id: ambulance.id,
          vehicleNumber: ambulance.vehicleNumber,
          driverName: ambulance.driverName,
          driverContact: ambulance.driverContact,
          currentLocation: ambulance.currentLocation,
          estimatedArrival: ambulance.estimatedArrival
        } : null,
        patientName: trip.patientName,
        dispatchedAt: trip.dispatchedAt
      };
    }

    if (ambulanceId) {
      const ambulance = this.ambulances.find(a => a.id === ambulanceId);
      if (!ambulance) {
        throw new Error('Ambulance not found');
      }

      return {
        ambulance: {
          id: ambulance.id,
          vehicleNumber: ambulance.vehicleNumber,
          status: ambulance.status,
          currentLocation: ambulance.currentLocation,
          estimatedArrival: ambulance.estimatedArrival,
          driverName: ambulance.driverName
        }
      };
    }

    throw new Error('Either tripId or ambulanceId is required');
  }

  private async checkAvailability(payload: any): Promise<any> {
    const { city, type } = payload;

    let availableAmbulances = this.ambulances.filter(a => a.status === 'Available');

    if (city) {
      availableAmbulances = availableAmbulances.filter(a => 
        a.city.toLowerCase().includes(city.toLowerCase())
      );
    }

    if (type) {
      availableAmbulances = availableAmbulances.filter(a => a.type === type);
    }

    return {
      available: availableAmbulances.length,
      ambulances: availableAmbulances.map(a => ({
        id: a.id,
        vehicleNumber: a.vehicleNumber,
        type: a.type,
        driverName: a.driverName,
        city: a.city,
        equipment: a.equipment
      })),
      query: { city, type }
    };
  }

  private async calculateETA(payload: any): Promise<any> {
    const { pickupLocation, ambulanceId } = payload;

    if (!pickupLocation) {
      throw new Error('Pickup location is required');
    }

    let ambulance: Ambulance | null = null;

    if (ambulanceId) {
      ambulance = this.ambulances.find(a => a.id === ambulanceId) || null;
      if (!ambulance) {
        throw new Error('Ambulance not found');
      }
    } else {
      ambulance = this.findNearestAmbulance(pickupLocation);
      if (!ambulance) {
        throw new Error('No ambulances available');
      }
    }

    const distance = this.calculateDistance(pickupLocation, ambulance.currentLocation);
    const etaMinutes = Math.round(distance * 2);

    return {
      ambulance: {
        id: ambulance.id,
        vehicleNumber: ambulance.vehicleNumber,
        type: ambulance.type,
        currentLocation: ambulance.currentLocation
      },
      distance: `${distance.toFixed(1)} km`,
      eta: `${etaMinutes} minutes`,
      estimatedArrival: new Date(Date.now() + etaMinutes * 60000).toISOString()
    };
  }

  private async handleComplexQuery(task: string, payload: any): Promise<any> {
    const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Available ambulances: ${JSON.stringify(this.ambulances)}
      
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
    if (task.includes('dispatch') || task.includes('emergency')) {
      return 'dispatch_ambulance';
    }
    if (task.includes('track') || task.includes('location')) {
      return 'track_ambulance';
    }
    if (task.includes('availability') || task.includes('available')) {
      return 'check_availability';
    }
    if (task.includes('eta') || task.includes('arrival')) {
      return 'calculate_eta';
    }
    return null;
  }
}
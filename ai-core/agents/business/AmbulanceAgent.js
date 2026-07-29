// D:\hospital backend\ai-core\agents\business\AmbulanceAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');

class AmbulanceAgent extends BaseAgent {
  constructor(providerManager) {
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

    this.ambulances = [];
    this.activeTrips = new Map();
    this.initializeAmbulances();
  }

  initializeAmbulances() {
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

  async dispatchAmbulance(payload) {
    var patientName = payload.patientName;
    var patientContact = payload.patientContact;
    var pickupLocation = payload.pickupLocation;
    var dropoffLocation = payload.dropoffLocation;
    var emergencyType = payload.emergencyType;
    var notes = payload.notes;

    if (!pickupLocation || !patientName) {
      throw new Error('Patient name and pickup location are required');
    }

    var nearestAmbulance = this.findNearestAmbulance(pickupLocation);

    if (!nearestAmbulance) {
      throw new Error('No ambulances available in your area');
    }

    var eta = this.calculateDistance(pickupLocation, nearestAmbulance.currentLocation);
    var etaMinutes = Math.round(eta * 2);

    nearestAmbulance.status = 'OnRoute';
    nearestAmbulance.estimatedArrival = etaMinutes;

    var tripId = 'TRIP' + Date.now();

    this.activeTrips.set(tripId, {
      ambulanceId: nearestAmbulance.id,
      patientName: patientName,
      patientContact: patientContact,
      pickupLocation: pickupLocation,
      dropoffLocation: dropoffLocation,
      emergencyType: emergencyType || 'Medical',
      status: 'Dispatched',
      dispatchedAt: new Date().toISOString(),
      estimatedArrival: etaMinutes
    });

    return {
      tripId: tripId,
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
      message: 'Ambulance ' + nearestAmbulance.vehicleNumber + ' is on its way. ETA: ' + etaMinutes + ' minutes',
      tracking: {
        ambulanceLocation: nearestAmbulance.currentLocation,
        pickupLocation: pickupLocation,
        dropoffLocation: dropoffLocation || null
      }
    };
  }

  findNearestAmbulance(pickupLocation) {
    var nearest = null;
    var minDistance = Infinity;

    for (var i = 0; i < this.ambulances.length; i++) {
      var ambulance = this.ambulances[i];
      if (ambulance.status !== 'Available') continue;

      var distance = this.calculateDistance(pickupLocation, ambulance.currentLocation);

      var typePriority = { 'Advanced': 3, 'ICU': 2, 'Basic': 1 };
      var typeScore = typePriority[ambulance.type] || 1;

      var adjustedDistance = distance / typeScore;

      if (adjustedDistance < minDistance) {
        minDistance = adjustedDistance;
        nearest = ambulance;
      }
    }

    return nearest;
  }

  calculateDistance(point1, point2) {
    var R = 6371;
    var dLat = (point2.lat - point1.lat) * Math.PI / 180;
    var dLng = (point2.lng - point1.lng) * Math.PI / 180;
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async trackAmbulance(payload) {
    var tripId = payload.tripId;
    var ambulanceId = payload.ambulanceId;

    if (tripId) {
      var trip = this.activeTrips.get(tripId);
      if (!trip) {
        throw new Error('Trip not found');
      }

      var ambulance = this.ambulances.find(function(a) { return a.id === trip.ambulanceId; });

      return {
        tripId: tripId,
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
      var amb = this.ambulances.find(function(a) { return a.id === ambulanceId; });
      if (!amb) {
        throw new Error('Ambulance not found');
      }

      return {
        ambulance: {
          id: amb.id,
          vehicleNumber: amb.vehicleNumber,
          status: amb.status,
          currentLocation: amb.currentLocation,
          estimatedArrival: amb.estimatedArrival,
          driverName: amb.driverName
        }
      };
    }

    throw new Error('Either tripId or ambulanceId is required');
  }

  async checkAvailability(payload) {
    var city = payload.city;
    var type = payload.type;

    var availableAmbulances = this.ambulances.filter(function(a) { return a.status === 'Available'; });

    if (city) {
      availableAmbulances = availableAmbulances.filter(function(a) {
        return a.city.toLowerCase().includes(city.toLowerCase());
      });
    }

    if (type) {
      availableAmbulances = availableAmbulances.filter(function(a) { return a.type === type; });
    }

    return {
      available: availableAmbulances.length,
      ambulances: availableAmbulances.map(function(a) {
        return {
          id: a.id,
          vehicleNumber: a.vehicleNumber,
          type: a.type,
          driverName: a.driverName,
          city: a.city,
          equipment: a.equipment
        };
      }),
      query: { city: city, type: type }
    };
  }

  async calculateETA(payload) {
    var pickupLocation = payload.pickupLocation;
    var ambulanceId = payload.ambulanceId;

    if (!pickupLocation) {
      throw new Error('Pickup location is required');
    }

    var ambulance = null;

    if (ambulanceId) {
      ambulance = this.ambulances.find(function(a) { return a.id === ambulanceId; }) || null;
      if (!ambulance) {
        throw new Error('Ambulance not found');
      }
    } else {
      ambulance = this.findNearestAmbulance(pickupLocation);
      if (!ambulance) {
        throw new Error('No ambulances available');
      }
    }

    var distance = this.calculateDistance(pickupLocation, ambulance.currentLocation);
    var etaMinutes = Math.round(distance * 2);

    return {
      ambulance: {
        id: ambulance.id,
        vehicleNumber: ambulance.vehicleNumber,
        type: ambulance.type,
        currentLocation: ambulance.currentLocation
      },
      distance: distance.toFixed(1) + ' km',
      eta: etaMinutes + ' minutes',
      estimatedArrival: new Date(Date.now() + etaMinutes * 60000).toISOString()
    };
  }

  async handleComplexQuery(task, payload) {
    var prompt = 'Task: ' + task + '\n' +
      'Payload: ' + JSON.stringify(payload) + '\n\n' +
      'Available ambulances: ' + JSON.stringify(this.ambulances) + '\n\n' +
      'Please analyze the query and provide a recommendation.';

    var response = await this.providerManager.generate(prompt);

    return {
      aiResponse: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed
    };
  }

  getRequiredCapability(task) {
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

module.exports = { AmbulanceAgent };
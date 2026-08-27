// D:\hospital backend\socket\ambulanceSocket.js

// ============================================
// AMBULANCE WEBSOCKET HANDLER
// ============================================
// Real-time bidirectional communication for:
// 🚑 Ambulance - Driver tracking, emergency dispatch
// 🏠 Caregivers - Caregiver location tracking
// 🔬 Diagnostics - Phlebotomist tracking
// 🌿 Homeopathy - Delivery tracking
// 🧘 Ayurveda - Delivery tracking

const jwt = require('jsonwebtoken');
const locationCache = require('../services/locationCacheService');
const dispatchService = require('../services/ambulanceDispatchService');

// ============================================
// CONNECTED CLIENTS STORE
// ============================================

// Track connected sockets by type
const connectedClients = {
  // 🚑 Ambulance drivers
  drivers: new Map(),        // driverId -> { socket, userId, providerId, vehicleType }
  
  // 🏠 Caregivers
  caregivers: new Map(),     // caregiverId -> { socket, userId }
  
  // 🔬 Phlebotomists
  phlebotomists: new Map(),  // phleboId -> { socket, userId, labId }
  
  // 👤 Patients (tracking their emergencies)
  patients: new Map(),       // userId -> { socket, trackingBookingId }
  
  // 🏥 Hospitals (receiving ER notifications)
  hospitals: new Map(),      // hospitalId -> { socket }
  
  // 👨‍💼 Admin (monitoring dashboard)
  admins: new Map()          // adminId -> { socket }
};

// ============================================
// ROOM MANAGEMENT
// ============================================

// Rooms group sockets by context
// emergency:{bookingId} - Patient + Driver + Admin
// driver:{driverId} - Driver-specific updates
// hospital:{hospitalId} - Hospital notifications
// admin:emergencies - Admin live monitoring

// ============================================
// SOCKET INITIALIZATION
// ============================================

const initializeSocket = (io) => {
  console.log('🔌 WebSocket server initializing...');

  // ============================================
  // AUTHENTICATION MIDDLEWARE
  // ============================================
  
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      const userType = socket.handshake.auth.userType || socket.handshake.query.userType || 'patient';
      
      if (!token) {
        // Allow limited access without token for emergency tracking
        const trackingId = socket.handshake.query.trackingId;
        if (trackingId) {
          socket.userType = 'guest';
          socket.trackingId = trackingId;
          return next();
        }
        return next(new Error('Authentication required'));
      }
      
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      socket.userId = decoded.userId || decoded.id;
      socket.userType = userType;
      socket.userRole = decoded.role;
      
      next();
    } catch (error) {
      console.error('WebSocket auth error:', error.message);
      next(new Error('Authentication failed'));
    }
  });

  // ============================================
  // CONNECTION HANDLER
  // ============================================
  
  io.on('connection', (socket) => {
    console.log(`🔗 Client connected: ${socket.id} | Type: ${socket.userType} | User: ${socket.userId || 'guest'}`);
    
    // ============================================
    // CLIENT REGISTRATION
    // ============================================
    
    // 🚑 Driver registration
    socket.on('driver:register', (data) => {
      const { driverId, providerId, vehicleType } = data;
      connectedClients.drivers.set(driverId, {
        socket,
        userId: socket.userId,
        providerId,
        vehicleType,
        registeredAt: new Date()
      });
      socket.driverId = driverId;
      socket.join(`driver:${driverId}`);
      socket.join('drivers:active');
      
      console.log(`🚑 Driver registered: ${driverId} (${vehicleType})`);
      socket.emit('driver:registered', { success: true, driverId });
      
      // Notify admin of driver online
      io.to('admin:emergencies').emit('driver:online', { driverId, vehicleType, timestamp: new Date() });
    });
    
    // 🏠 Caregiver registration
    socket.on('caregiver:register', (data) => {
      const { caregiverId } = data;
      connectedClients.caregivers.set(caregiverId, {
        socket,
        userId: socket.userId,
        registeredAt: new Date()
      });
      socket.caregiverId = caregiverId;
      socket.join(`caregiver:${caregiverId}`);
      
      console.log(`🏠 Caregiver registered: ${caregiverId}`);
      socket.emit('caregiver:registered', { success: true, caregiverId });
    });
    
    // 🔬 Phlebotomist registration
    socket.on('phlebotomist:register', (data) => {
      const { phleboId, labId } = data;
      connectedClients.phlebotomists.set(phleboId, {
        socket,
        userId: socket.userId,
        labId,
        registeredAt: new Date()
      });
      socket.phleboId = phleboId;
      socket.join(`phlebotomist:${phleboId}`);
      
      console.log(`🔬 Phlebotomist registered: ${phleboId}`);
      socket.emit('phlebotomist:registered', { success: true, phleboId });
    });
    
    // 👤 Patient tracking registration
    socket.on('patient:track', (data) => {
      const { bookingId } = data;
      if (socket.userId) {
        connectedClients.patients.set(socket.userId, {
          socket,
          trackingBookingId: bookingId,
          registeredAt: new Date()
        });
      }
      socket.join(`emergency:${bookingId}`);
      
      console.log(`👤 Patient tracking: ${bookingId}`);
      socket.emit('patient:tracking_started', { success: true, bookingId });
    });
    
    // 🏥 Hospital registration
    socket.on('hospital:register', (data) => {
      const { hospitalId } = data;
      connectedClients.hospitals.set(hospitalId, {
        socket,
        registeredAt: new Date()
      });
      socket.hospitalId = hospitalId;
      socket.join(`hospital:${hospitalId}`);
      
      console.log(`🏥 Hospital registered: ${hospitalId}`);
      socket.emit('hospital:registered', { success: true, hospitalId });
    });
    
    // 👨‍💼 Admin registration
    socket.on('admin:register', (data) => {
      const { adminId } = data;
      connectedClients.admins.set(adminId || socket.userId, {
        socket,
        registeredAt: new Date()
      });
      socket.join('admin:emergencies');
      socket.join('admin:drivers');
      socket.join('admin:all');
      
      console.log(`👨‍💼 Admin registered: ${adminId || socket.userId}`);
      
      // Send current active emergencies to admin
      const activeEmergencies = locationCache.ambulance.getActiveEmergencies();
      socket.emit('admin:active_emergencies', activeEmergencies);
    });

    // ============================================
    // 🚑 DRIVER LOCATION UPDATES
    // ============================================
    
    socket.on('driver:location_update', async (data) => {
      const { lat, lng, speed, heading, accuracy, isAvailable, isOnTrip, tripId } = data;
      
      if (!socket.driverId) {
        socket.emit('error', { message: 'Driver not registered' });
        return;
      }
      
      try {
        // Update location in Redis
        await locationCache.ambulance.updateDriverLocation(socket.driverId, lat, lng, {
  speed, heading, accuracy,
  isAvailable: isAvailable !== false,
  vehicleType: connectedClients.drivers.get(socket.driverId)?.vehicleType || 'basic',
  providerId: connectedClients.drivers.get(socket.driverId)?.providerId || '',
  vehicleId: socket.driverId,
  vehicleNumber: connectedClients.drivers.get(socket.driverId)?.vehicleNumber || '',
  isOnTrip: isOnTrip || false,
  tripId: tripId || ''
});
        
        // If on trip, broadcast location to patient tracking
        if (isOnTrip && tripId) {
          io.to(`emergency:${tripId}`).emit('driver:location_updated', {
            driverId: socket.driverId,
            lat, lng, speed, heading,
            timestamp: new Date().toISOString()
          });
        }
        
        // Broadcast to admin
        io.to('admin:emergencies').emit('driver:location_updated', {
          driverId: socket.driverId,
          lat, lng, speed, heading,
          isAvailable, isOnTrip, tripId,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Location update error:', error);
        socket.emit('error', { message: 'Failed to update location' });
      }
    });
    
    // 🏠 Caregiver location update
    socket.on('caregiver:location_update', async (data) => {
      const { lat, lng, isAvailable, isOnVisit, visitId } = data;
      
      if (!socket.caregiverId) {
        socket.emit('error', { message: 'Caregiver not registered' });
        return;
      }
      
      try {
        await locationCache.caregiver.updateCaregiverLocation(socket.caregiverId, lat, lng, {
          isAvailable, isOnVisit, visitId
        });
        
        if (isOnVisit && visitId) {
          io.to(`visit:${visitId}`).emit('caregiver:location_updated', {
            caregiverId: socket.caregiverId,
            lat, lng,
            timestamp: new Date().toISOString()
          });
        }
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to update location' });
      }
    });
    
    // 🔬 Phlebotomist location update
    socket.on('phlebotomist:location_update', async (data) => {
      const { lat, lng, isAvailable, isOnCollection, collectionId } = data;
      
      if (!socket.phleboId) {
        socket.emit('error', { message: 'Phlebotomist not registered' });
        return;
      }
      
      try {
        await locationCache.diagnostics.updatePhleboLocation(socket.phleboId, lat, lng, {
          isAvailable, isOnCollection, collectionId,
          labId: connectedClients.phlebotomists.get(socket.phleboId)?.labId || ''
        });
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    // ============================================
    // 🚨 EMERGENCY DISPATCH EVENTS
    // ============================================
    
    // Driver accepts emergency
    socket.on('driver:accept_emergency', async (data) => {
      const { bookingId } = data;
      
      if (!socket.driverId) {
        socket.emit('error', { message: 'Driver not registered' });
        return;
      }
      
      try {
        const result = await dispatchService.driverAcceptEmergency(socket.driverId, bookingId);
        
        if (result.success) {
          // Notify patient
          io.to(`emergency:${bookingId}`).emit('emergency:driver_accepted', {
            bookingId,
            driverId: socket.driverId,
            driverName: result.booking.driverName,
            vehicleNumber: result.booking.vehicleNumber,
            eta: '5 minutes',
            timestamp: new Date().toISOString()
          });
          
          // Notify admin
          io.to('admin:emergencies').emit('emergency:driver_accepted', {
            bookingId,
            driverId: socket.driverId,
            timestamp: new Date().toISOString()
          });
          
          socket.emit('driver:accept_confirmed', { success: true, bookingId });
        } else {
          socket.emit('driver:accept_failed', result);
        }
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to accept emergency' });
      }
    });
    
    // Driver rejects emergency
    socket.on('driver:reject_emergency', (data) => {
      const { bookingId, reason } = data;
      
      console.log(`❌ Driver ${socket.driverId} rejected emergency ${bookingId}: ${reason}`);
      
      // Admin notified for monitoring
      io.to('admin:emergencies').emit('driver:rejected_emergency', {
        bookingId,
        driverId: socket.driverId,
        reason,
        timestamp: new Date().toISOString()
      });
    });
    
    // Driver reached pickup
    socket.on('driver:arrived_pickup', async (data) => {
      const { bookingId } = data;
      
      try {
        const result = await dispatchService.driverArrivedAtPickup(bookingId);
        
        if (result.success) {
          io.to(`emergency:${bookingId}`).emit('emergency:driver_arrived', {
            bookingId,
            timestamp: new Date().toISOString()
          });
          
          io.to('admin:emergencies').emit('emergency:driver_arrived', {
            bookingId,
            timestamp: new Date().toISOString()
          });
        }
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to update status' });
      }
    });
    
    // Patient onboard
    socket.on('driver:patient_onboard', async (data) => {
      const { bookingId, otp } = data;
      
      try {
        const result = await dispatchService.patientOnboard(bookingId, otp);
        
        if (result.success) {
          io.to(`emergency:${bookingId}`).emit('emergency:patient_onboard', {
            bookingId,
            timestamp: new Date().toISOString()
          });
          
          // Notify hospital
          const booking = result.booking;
          if (booking.hospitalDestination?.hospitalId) {
            io.to(`hospital:${booking.hospitalDestination.hospitalId}`).emit('hospital:patient_onboard', {
              bookingId,
              patientName: booking.patientName,
              eta: '10 minutes',
              timestamp: new Date().toISOString()
            });
          }
        }
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to confirm OTP' });
      }
    });
    
    // Arrived at hospital
    socket.on('driver:arrived_hospital', async (data) => {
      const { bookingId, vitals } = data;
      
      try {
        const result = await dispatchService.arrivedAtHospital(bookingId, vitals);
        
        if (result.success) {
          io.to(`emergency:${bookingId}`).emit('emergency:arrived_hospital', {
            bookingId,
            timestamp: new Date().toISOString()
          });
        }
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to update status' });
      }
    });
    
    // Trip completed
    socket.on('driver:trip_completed', async (data) => {
      const { bookingId, distance, duration, oxygenAdministered, medicationsGiven, notes } = data;
      
      try {
        const result = await dispatchService.completeEmergencyTrip(bookingId, {
          distance, duration, oxygenAdministered, medicationsGiven,
          driverNotes: notes
        });
        
        if (result.success) {
          io.to(`emergency:${bookingId}`).emit('emergency:trip_completed', {
            bookingId,
            fareBreakdown: result.fareBreakdown,
            timestamp: new Date().toISOString()
          });
          
          io.to('admin:emergencies').emit('emergency:trip_completed', {
            bookingId,
            driverId: socket.driverId,
            timestamp: new Date().toISOString()
          });
          
          socket.emit('driver:trip_summary', {
            bookingId,
            earnings: result.fareBreakdown?.driverEarnings || 0,
            fare: result.fareBreakdown?.total || 0
          });
        }
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to complete trip' });
      }
    });

    // ============================================
    // 🏥 HOSPITAL EVENTS
    // ============================================
    
    // Hospital updates bed availability
    socket.on('hospital:bed_update', async (data) => {
      const { hospitalId, availableBeds, icuBeds, ventilatorBeds } = data;
      
      try {
        await locationCache.hospital.updateBedAvailability(hospitalId, {
          availableBeds, icuBeds, ventilatorBeds
        });
        
        // Broadcast to admin
        io.to('admin:emergencies').emit('hospital:bed_updated', {
          hospitalId,
          availableBeds, icuBeds, ventilatorBeds,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to update beds' });
      }
    });

    // ============================================
    // 👤 PATIENT EVENTS
    // ============================================
    
    // Patient joins tracking room
    socket.on('patient:join_tracking', (data) => {
      const { bookingId } = data;
      socket.join(`emergency:${bookingId}`);
      socket.emit('patient:joined', { bookingId });
    });
    
    // Patient cancels emergency
    socket.on('patient:cancel_emergency', async (data) => {
      const { bookingId, reason } = data;
      
      try {
        const result = await dispatchService.cancelEmergency(bookingId, reason, 'patient');
        
        if (result.success) {
          io.to(`emergency:${bookingId}`).emit('emergency:cancelled', {
            bookingId,
            cancelledBy: 'patient',
            reason,
            timestamp: new Date().toISOString()
          });
          
          // Notify driver
          const driverId = result.booking.driverId;
          if (driverId) {
            io.to(`driver:${driverId}`).emit('emergency:cancelled', {
              bookingId,
              reason,
              timestamp: new Date().toISOString()
            });
          }
        }
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to cancel emergency' });
      }
    });

    // ============================================
    // 💓 HEARTBEAT
    // ============================================
    
    socket.on('heartbeat', (data) => {
      const { service, id } = data;
      socket.emit('heartbeat:ack', { timestamp: Date.now() });
    });

    // ============================================
    // DISCONNECTION
    // ============================================
    
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      
      // Clean up from connected clients
      if (socket.driverId) {
        connectedClients.drivers.delete(socket.driverId);
        locationCache.ambulance.removeDriver(socket.driverId).catch(console.error);
        
        // Notify admin
        io.to('admin:emergencies').emit('driver:offline', {
          driverId: socket.driverId,
          timestamp: new Date().toISOString()
        });
      }
      
      if (socket.caregiverId) {
        connectedClients.caregivers.delete(socket.caregiverId);
        locationCache.caregiver.removeCaregiver(socket.caregiverId).catch(console.error);
      }
      
      if (socket.phleboId) {
        connectedClients.phlebotomists.delete(socket.phleboId);
        locationCache.diagnostics.removePhlebo(socket.phleboId).catch(console.error);
      }
      
      if (socket.userId) {
        connectedClients.patients.delete(socket.userId);
      }
    });
  });

  console.log('✅ WebSocket server initialized');
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Get online drivers count
const getOnlineDriversCount = () => connectedClients.drivers.size;

// Get online caregivers count
const getOnlineCaregiversCount = () => connectedClients.caregivers.size;

// Get online phlebotomists count
const getOnlinePhlebotomistsCount = () => connectedClients.phlebotomists.size;

// Check if driver is online
const isDriverOnline = (driverId) => connectedClients.drivers.has(driverId);

// Send emergency to specific driver
const sendEmergencyToDriver = (io, driverId, emergencyData) => {
  const driver = connectedClients.drivers.get(driverId);
  if (driver) {
    driver.socket.emit('emergency:new_request', emergencyData);
    return true;
  }
  return false;
};

// Broadcast to all admins
const broadcastToAdmins = (io, event, data) => {
  io.to('admin:emergencies').emit(event, data);
};

// Get connected clients stats
const getConnectionStats = () => ({
  drivers: connectedClients.drivers.size,
  caregivers: connectedClients.caregivers.size,
  phlebotomists: connectedClients.phlebotomists.size,
  patients: connectedClients.patients.size,
  hospitals: connectedClients.hospitals.size,
  admins: connectedClients.admins.size,
  timestamp: new Date().toISOString()
});

// ============================================
// EXPORTS
// ============================================

module.exports = {
  initializeSocket,
  connectedClients,
  
  // Utilities
  getOnlineDriversCount,
  getOnlineCaregiversCount,
  getOnlinePhlebotomistsCount,
  isDriverOnline,
  sendEmergencyToDriver,
  broadcastToAdmins,
  getConnectionStats
};
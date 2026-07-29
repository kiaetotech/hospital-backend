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
  driversMap(),        // driverId -> { socket, userId, providerId, vehicleType }
  
  // 🏠 Caregivers
  caregiversMap(),     // caregiverId -> { socket, userId }
  
  // 🔬 Phlebotomists
  phlebotomistsMap(),  // phleboId -> { socket, userId, labId }
  
  // 👤 Patients (tracking their emergencies)
  patientsMap(),       // userId -> { socket, trackingBookingId }
  
  // 🏥 Hospitals (receiving ER notifications)
  hospitalsMap(),      // hospitalId -> { socket }
  
  // 👨‍💼 Admin (monitoring dashboard)
  adminsMap()          // adminId -> { socket }
};

// ============================================
// ROOM MANAGEMENT
// ============================================

// Rooms group sockets by context
// emergency:{bookingId} - Patient + Driver + Admin
// driver:{driverId} - Driver-specific updates
// hospital:{hospitalId} - Hospital notifications
// admin- Admin live monitoring

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
    socket.on('driver', (data) => {
      const { driverId, providerId, vehicleType } = data;
      connectedClients.drivers.set(driverId, {
        socket,
        userId.userId,
        providerId,
        vehicleType,
        registeredAtDate()
      });
      socket.driverId = driverId;
      socket.join(`driver:${driverId}`);
      socket.join('drivers');
      
      console.log(`🚑 Driver registered: ${driverId} (${vehicleType})`);
      socket.emit('driver', { success, driverId });
      
      // Notify admin of driver online
      io.to('admin').emit('driver', { driverId, vehicleType, timestampDate() });
    });
    
    // 🏠 Caregiver registration
    socket.on('caregiver', (data) => {
      const { caregiverId } = data;
      connectedClients.caregivers.set(caregiverId, {
        socket,
        userId.userId,
        registeredAtDate()
      });
      socket.caregiverId = caregiverId;
      socket.join(`caregiver:${caregiverId}`);
      
      console.log(`🏠 Caregiver registered: ${caregiverId}`);
      socket.emit('caregiver', { success, caregiverId });
    });
    
    // 🔬 Phlebotomist registration
    socket.on('phlebotomist', (data) => {
      const { phleboId, labId } = data;
      connectedClients.phlebotomists.set(phleboId, {
        socket,
        userId.userId,
        labId,
        registeredAtDate()
      });
      socket.phleboId = phleboId;
      socket.join(`phlebotomist:${phleboId}`);
      
      console.log(`🔬 Phlebotomist registered: ${phleboId}`);
      socket.emit('phlebotomist', { success, phleboId });
    });
    
    // 👤 Patient tracking registration
    socket.on('patient', (data) => {
      const { bookingId } = data;
      if (socket.userId) {
        connectedClients.patients.set(socket.userId, {
          socket,
          trackingBookingId,
          registeredAtDate()
        });
      }
      socket.join(`emergency:${bookingId}`);
      
      console.log(`👤 Patient tracking: ${bookingId}`);
      socket.emit('patient_started', { success, bookingId });
    });
    
    // 🏥 Hospital registration
    socket.on('hospital', (data) => {
      const { hospitalId } = data;
      connectedClients.hospitals.set(hospitalId, {
        socket,
        registeredAtDate()
      });
      socket.hospitalId = hospitalId;
      socket.join(`hospital:${hospitalId}`);
      
      console.log(`🏥 Hospital registered: ${hospitalId}`);
      socket.emit('hospital', { success, hospitalId });
    });
    
    // 👨‍💼 Admin registration
    socket.on('admin', (data) => {
      const { adminId } = data;
      connectedClients.admins.set(adminId || socket.userId, {
        socket,
        registeredAtDate()
      });
      socket.join('admin');
      socket.join('admin');
      socket.join('admin');
      
      console.log(`👨‍💼 Admin registered: ${adminId || socket.userId}`);
      
      // Send current active emergencies to admin
      const activeEmergencies = locationCache.ambulance.getActiveEmergencies();
      socket.emit('admin_emergencies', activeEmergencies);
    });

    // ============================================
    // 🚑 DRIVER LOCATION UPDATES
    // ============================================
    
    socket.on('driver_update', async (data) => {
      const { lat, lng, speed, heading, accuracy, isAvailable, isOnTrip, tripId } = data;
      
      if (!socket.driverId) {
        socket.emit('error', { message: 'Driver not registered' });
        return;
      }
      
      try {
        // Update location in Redis
        await locationCache.ambulance.updateDriverLocation(socket.driverId, lat, lng, {
          speed, heading, accuracy,
          isAvailable!== false,
          vehicleType.drivers.get(socket.driverId)?.vehicleType || 'basic',
          providerId.drivers.get(socket.driverId)?.providerId || '',
          isOnTrip|| false,
          tripId|| ''
        });
        
        // If on trip, broadcast location to patient tracking
        if (isOnTrip && tripId) {
          io.to(`emergency:${tripId}`).emit('driver_updated', {
            driverId.driverId,
            lat, lng, speed, heading,
            timestampDate().toISOString()
          });
        }
        
        // Broadcast to admin
        io.to('admin').emit('driver_updated', {
          driverId.driverId,
          lat, lng, speed, heading,
          isAvailable, isOnTrip, tripId,
          timestampDate().toISOString()
        });
        
      } catch (error) {
        console.error('Location update error:', error);
        socket.emit('error', { message: 'Failed to update location' });
      }
    });
    
    // 🏠 Caregiver location update
    socket.on('caregiver_update', async (data) => {
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
          io.to(`visit:${visitId}`).emit('caregiver_updated', {
            caregiverId.caregiverId,
            lat, lng,
            timestampDate().toISOString()
          });
        }
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to update location' });
      }
    });
    
    // 🔬 Phlebotomist location update
    socket.on('phlebotomist_update', async (data) => {
      const { lat, lng, isAvailable, isOnCollection, collectionId } = data;
      
      if (!socket.phleboId) {
        socket.emit('error', { message: 'Phlebotomist not registered' });
        return;
      }
      
      try {
        await locationCache.diagnostics.updatePhleboLocation(socket.phleboId, lat, lng, {
          isAvailable, isOnCollection, collectionId,
          labId.phlebotomists.get(socket.phleboId)?.labId || ''
        });
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    // ============================================
    // 🚨 EMERGENCY DISPATCH EVENTS
    // ============================================
    
    // Driver accepts emergency
    socket.on('driver_emergency', async (data) => {
      const { bookingId } = data;
      
      if (!socket.driverId) {
        socket.emit('error', { message: 'Driver not registered' });
        return;
      }
      
      try {
        const result = await dispatchService.driverAcceptEmergency(socket.driverId, bookingId);
        
        if (result.success) {
          // Notify patient
          io.to(`emergency:${bookingId}`).emit('emergency_accepted', {
            bookingId,
            driverId.driverId,
            driverName.booking.driverName,
            vehicleNumber.booking.vehicleNumber,
            eta: '5 minutes',
            timestampDate().toISOString()
          });
          
          // Notify admin
          io.to('admin').emit('emergency_accepted', {
            bookingId,
            driverId.driverId,
            timestampDate().toISOString()
          });
          
          socket.emit('driver_confirmed', { success, bookingId });
        } else {
          socket.emit('driver_failed', result);
        }
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to accept emergency' });
      }
    });
    
    // Driver rejects emergency
    socket.on('driver_emergency', (data) => {
      const { bookingId, reason } = data;
      
      console.log(`❌ Driver ${socket.driverId} rejected emergency ${bookingId}: ${reason}`);
      
      // Admin notified for monitoring
      io.to('admin').emit('driver_emergency', {
        bookingId,
        driverId.driverId,
        reason,
        timestampDate().toISOString()
      });
    });
    
    // Driver reached pickup
    socket.on('driver_pickup', async (data) => {
      const { bookingId } = data;
      
      try {
        const result = await dispatchService.driverArrivedAtPickup(bookingId);
        
        if (result.success) {
          io.to(`emergency:${bookingId}`).emit('emergency_arrived', {
            bookingId,
            timestampDate().toISOString()
          });
          
          io.to('admin').emit('emergency_arrived', {
            bookingId,
            timestampDate().toISOString()
          });
        }
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to update status' });
      }
    });
    
    // Patient onboard
    socket.on('driver_onboard', async (data) => {
      const { bookingId, otp } = data;
      
      try {
        const result = await dispatchService.patientOnboard(bookingId, otp);
        
        if (result.success) {
          io.to(`emergency:${bookingId}`).emit('emergency_onboard', {
            bookingId,
            timestampDate().toISOString()
          });
          
          // Notify hospital
          const booking = result.booking;
          if (booking.hospitalDestination?.hospitalId) {
            io.to(`hospital:${booking.hospitalDestination.hospitalId}`).emit('hospital_onboard', {
              bookingId,
              patientName.patientName,
              eta: '10 minutes',
              timestampDate().toISOString()
            });
          }
        }
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to confirm OTP' });
      }
    });
    
    // Arrived at hospital
    socket.on('driver_hospital', async (data) => {
      const { bookingId, vitals } = data;
      
      try {
        const result = await dispatchService.arrivedAtHospital(bookingId, vitals);
        
        if (result.success) {
          io.to(`emergency:${bookingId}`).emit('emergency_hospital', {
            bookingId,
            timestampDate().toISOString()
          });
        }
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to update status' });
      }
    });
    
    // Trip completed
    socket.on('driver_completed', async (data) => {
      const { bookingId, distance, duration, oxygenAdministered, medicationsGiven, notes } = data;
      
      try {
        const result = await dispatchService.completeEmergencyTrip(bookingId, {
          distance, duration, oxygenAdministered, medicationsGiven,
          driverNotes});
        
        if (result.success) {
          io.to(`emergency:${bookingId}`).emit('emergency_completed', {
            bookingId,
            fareBreakdown.fareBreakdown,
            timestampDate().toISOString()
          });
          
          io.to('admin').emit('emergency_completed', {
            bookingId,
            driverId.driverId,
            timestampDate().toISOString()
          });
          
          socket.emit('driver_summary', {
            bookingId,
            earnings.fareBreakdown?.driverEarnings || 0,
            fare.fareBreakdown?.total || 0
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
    socket.on('hospital_update', async (data) => {
      const { hospitalId, availableBeds, icuBeds, ventilatorBeds } = data;
      
      try {
        await locationCache.hospital.updateBedAvailability(hospitalId, {
          availableBeds, icuBeds, ventilatorBeds
        });
        
        // Broadcast to admin
        io.to('admin').emit('hospital_updated', {
          hospitalId,
          availableBeds, icuBeds, ventilatorBeds,
          timestampDate().toISOString()
        });
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to update beds' });
      }
    });

    // ============================================
    // 👤 PATIENT EVENTS
    // ============================================
    
    // Patient joins tracking room
    socket.on('patient_tracking', (data) => {
      const { bookingId } = data;
      socket.join(`emergency:${bookingId}`);
      socket.emit('patient', { bookingId });
    });
    
    // Patient cancels emergency
    socket.on('patient_emergency', async (data) => {
      const { bookingId, reason } = data;
      
      try {
        const result = await dispatchService.cancelEmergency(bookingId, reason, 'patient');
        
        if (result.success) {
          io.to(`emergency:${bookingId}`).emit('emergency', {
            bookingId,
            cancelledBy: 'patient',
            reason,
            timestampDate().toISOString()
          });
          
          // Notify driver
          const driverId = result.booking.driverId;
          if (driverId) {
            io.to(`driver:${driverId}`).emit('emergency', {
              bookingId,
              reason,
              timestampDate().toISOString()
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
      socket.emit('heartbeat', { timestamp.now() });
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
        io.to('admin').emit('driver', {
          driverId.driverId,
          timestampDate().toISOString()
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
    driver.socket.emit('emergency_request', emergencyData);
    return true;
  }
  return false;
};

// Broadcast to all admins
const broadcastToAdmins = (io, event, data) => {
  io.to('admin').emit(event, data);
};

// Get connected clients stats
const getConnectionStats = () => ({
  drivers.drivers.size,
  caregivers.caregivers.size,
  phlebotomists.phlebotomists.size,
  patients.patients.size,
  hospitals.hospitals.size,
  admins.admins.size,
  timestampDate().toISOString()
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


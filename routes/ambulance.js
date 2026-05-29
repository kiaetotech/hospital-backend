const express = require('express');
const router = express.Router();
const Ambulance = require('../models/Ambulance');
const AmbulanceBooking = require('../models/AmbulanceBooking');

// Get available ambulances by city
router.get('/available', async (req, res) => {
  try {
    const { city, lat, lng } = req.query;
    let query = { isAvailable: true };
    if (city) query.city = { $regex: new RegExp(city, 'i') };
    
    let ambulances = await Ambulance.find(query);
    
    // Calculate distance if location provided
    if (lat && lng) {
      ambulances = ambulances.map(a => ({
        ...a.toObject(),
        distance: calculateDistance(lat, lng, a.location.lat, a.location.lng)
      }));
      ambulances.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    }
    
    res.json({ success: true, data: ambulances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Book ambulance
router.post('/book', async (req, res) => {
  try {
    const { 
      ambulanceId, patientName, patientPhone, 
      pickupAddress, pickupLocation, dropAddress, dropLocation, distance 
    } = req.body;
    
    const ambulance = await Ambulance.findById(ambulanceId);
    if (!ambulance) {
      return res.status(404).json({ success: false, message: 'Ambulance not found' });
    }
    
    const totalAmount = ambulance.basePrice + (distance * ambulance.pricePerKm);
    const discount = Math.round(totalAmount * 0.1);
    const finalAmount = totalAmount - discount;
    
    const booking = new AmbulanceBooking({
      userId: req.user?.id || 'guest',
      ambulanceId,
      patientName,
      patientPhone,
      pickupAddress,
      pickupLocation,
      dropAddress,
      dropLocation,
      distance,
      totalAmount: finalAmount,
      driverName: ambulance.driverName,
      driverPhone: ambulance.driverPhone,
      vehicleNumber: ambulance.vehicleNumber,
      status: 'pending'
    });
    
    await booking.save();
    
    // Mark ambulance as unavailable
    ambulance.isAvailable = false;
    await ambulance.save();
    
    res.json({ 
      success: true, 
      data: booking,
      message: `Ambulance booked successfully! Total: ₹${finalAmount} (10% discount applied)`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get booking status
router.get('/booking/:id', async (req, res) => {
  try {
    const booking = await AmbulanceBooking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update booking status (for driver app)
router.put('/booking/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await AmbulanceBooking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return parseFloat((R * c).toFixed(1));
}

module.exports = router;

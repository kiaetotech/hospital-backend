require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// JWT Authentication for Lab Agencies
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'hospital_platform_secret_key_2024';

// Authentication middleware for lab agencies
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please login first.' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
};

// Make available globally
global.authenticateToken = authenticateToken;
global.JWT_SECRET = JWT_SECRET;

// Import routes
const hospitalRoutes = require('./routes/hospitals');
const authRoutes = require('./routes/auth');
const caregiverRoutes = require('./routes/caregivers');
const diagnosticsRoutes = require('./routes/diagnostics'); 
const diagnosticsUploadRoutes = require('./routes/diagnostics-upload');
const ambulanceRoutes = require('./routes/ambulance');
const healthPackageRoutes = require('./routes/healthPackageRoutes');
const testRoutes = require('./routes/tests');
const uploadRoutes = require('./routes/upload');
const providerAuthRoutes = require('./routes/providerAuth');
const bookingRoutes = require('./routes/bookings');
const razorpayRoutes = require('./routes/payment');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');                 // NEW - will create
const bookingStatusRoutes = require('./routes/booking-status'); // NEW - will create

// COMMENTED OUT - Missing files (keep as is)
// const paymentRoutes = require('./routes/payments');

// Use routes
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/caregivers', caregiverRoutes);
app.use('/api/diagnostics', diagnosticsRoutes); 
app.use('/api/diagnostics/upload', diagnosticsUploadRoutes);
app.use('/api/ambulance', ambulanceRoutes);
app.use('/api/health-packages', healthPackageRoutes);
app.use('/api/provider', healthPackageRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/provider-auth', providerAuthRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payment', razorpayRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);                         // NEW
app.use('/api/booking-status', bookingStatusRoutes);       // NEW

// COMMENTED OUT - Missing routes (keep as is)
// app.use('/api/payments', paymentRoutes);

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API is working' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// MongoDB connection
const DB_URI = process.env.DB_URI || 'mongodb://localhost:27017/hospital_db';
mongoose.connect(DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
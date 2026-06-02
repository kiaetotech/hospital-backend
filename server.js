require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Import routes
const hospitalRoutes = require('./routes/hospitals');
const authRoutes = require('./routes/auth');
const caregiverRoutes = require('./routes/caregivers');
const diagnosticsRoutes = require('./routes/diagnostics'); const diagnosticsUploadRoutes = require('./routes/diagnostics-upload');
const paymentRoutes = require('./routes/payments');
const ambulanceRoutes = require('./routes/ambulance');

// Use routes (ALL routes MUST be before app.listen)
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/caregivers', caregiverRoutes);
app.use('/api/diagnostics', diagnosticsRoutes); app.use('/api/diagnostics/upload', diagnosticsUploadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ambulance', ambulanceRoutes);

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API is working' });
});

// MongoDB connection
const DB_URI = process.env.DB_URI || 'mongodb://localhost:27017/hospital_db';
mongoose.connect(DB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
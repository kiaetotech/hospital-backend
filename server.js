require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Import routes
const hospitalRoutes = require('./routes/hospitals');

// Use routes
app.use('/api/hospitals', hospitalRoutes);

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
const paymentRoutes = require('./routes/payments');
app.use('/api/payments', paymentRoutes);
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
const ambulanceRoutes = require('./routes/ambulance');
app.use('/api/ambulance', ambulanceRoutes);
});


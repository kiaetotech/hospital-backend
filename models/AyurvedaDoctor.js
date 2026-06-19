const mongoose = require('mongoose');

const ayurvedaDoctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true },
  phone: { type: String, required: true },
  
  // AYUSH Verification
  ayushRegNo: { type: String, required: true, unique: true },
  verifiedKyc: { type: Boolean, default: false },
  degreeCertificate: String,
  idProof: String,
  photo: String,
  
  // Professional Details
  specialization: { 
    type: String, 
    enum: ['Panchakarma', 'General Ayurveda', 'Kerala Ayurveda', 'Ayurvedic Dermatology', 'Rasayana Therapy', 'Kayachikitsa', 'Shalya Tantra'],
    required: true 
  },
  experience: { type: Number, required: true },
  education: String,
  about: String,
  languages: [String],
  
  // Consultation Details
  consultationFee: { type: Number, required: true },
  videoIntroUrl: String,
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  
  // 🆕 LOCATION DATA (CRITICAL FOR SEARCH)
  address: {
    street: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: String,
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true } // [longitude, latitude]
    }
  },
  
  // Service Areas (for doctors who travel)
  serviceRadius: { type: Number, default: 20 }, // in kilometers
  consultationTypes: {
    online: { type: Boolean, default: true },
    clinic: { type: Boolean, default: true },
    homeVisit: { type: Boolean, default: false }
  },
  
  // Availability
  availableSlots: [{
    day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    slots: [{
      startTime: String,
      endTime: String,
      maxPatients: { type: Number, default: 5 },
      bookedCount: { type: Number, default: 0 }
    }]
  }],
  
  // Commission & Subscription
  subscriptionPlan: {
    type: String,
    enum: ['basic', 'premium', 'enterprise', 'none'],
    default: 'none'
  },
  commissionRate: {
    firstConsult: { type: Number, default: 15 }, // percentage
    repeatConsult: { type: Number, default: 5 }
  },
  
  // Status
  isActive: { type: Boolean, default: true },
  isAvailable: { type: Boolean, default: false },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 🆕 GEOSPATIAL INDEX for location-based queries
ayurvedaDoctorSchema.index({ 'address.coordinates': '2dsphere' });

// 🆕 Text index for search
ayurvedaDoctorSchema.index({ 
  name: 'text', 
  specialization: 'text', 
  'address.city': 'text',
  about: 'text'
});

module.exports = mongoose.model('AyurvedaDoctor', ayurvedaDoctorSchema);
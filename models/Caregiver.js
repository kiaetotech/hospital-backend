const mongoose = require('mongoose');

const caregiverSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fullName: { type: String, required: true },
  photo: { type: String, default: 'https://placehold.co/400x400/e2e8f0/1e293b?text=Caregiver' },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  governmentId: { type: String, required: true }, // Encrypted in production
  serviceType: { type: String, enum: ['personal', 'skilled', 'both'], required: true },
  licenseNumber: { type: String },
  licenseIssuingAuthority: { type: String },
  licenseExpiryDate: { type: Date },
  certifications: [String], // CPR, BLS, CNA, RN, LPN
  experienceYears: { type: Number, default: 0 },
  specializations: [String], // dementia, palliative, post-surgery, diabetes, bedridden, newborn
  languages: [String],
  pricing: {
    personal: {
      hourly: { type: Number, required: true },
      daily: { type: Number },
      monthly: { type: Number },
      overnight: { type: Number }
    },
    skilled: {
      hourly: { type: Number },
      daily: { type: Number },
      monthly: { type: Number },
      overnight: { type: Number }
    }
  },
  availability: {
    recurring: [{
      dayOfWeek: { type: Number, min: 0, max: 6 },
      startTime: String,
      endTime: String
    }],
    dateBlocks: [{
      date: Date,
      startTime: String,
      endTime: String,
      isAvailable: Boolean
    }]
  },
  location: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    coordinates: { lat: Number, lng: Number },
    travelRadius: { type: Number, default: 10 } // km
  },
  ratings: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  totalReviews: { type: Number, default: 0 },
  backgroundCheckStatus: { type: String, enum: ['pending', 'cleared', 'failed'], default: 'pending' },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  subscriptionPlan: { type: String, enum: ['free', 'pro'], default: 'free' },
  subscriptionExpiry: Date,
  createdAt: { type: Date, default: Date.now }
});

caregiverSchema.index({ 'location.coordinates': '2dsphere' });

module.exports = mongoose.model('Caregiver', caregiverSchema);
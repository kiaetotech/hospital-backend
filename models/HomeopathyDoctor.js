const mongoose = require('mongoose');

const homeopathyDoctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String },
  password: { type: String },
  
  specialization: { type: String, enum: ['Classical Homeopathy', 'Clinical Homeopathy', 'Naturopathy', 'Yoga & Naturopathy', 'Diet Therapy', 'Acupuncture', 'Biochemic Medicine'] },
  experience: { type: Number },
  education: { type: String },
  registrationNumber: { type: String, required: true, unique: true },
  registrationCouncil: { type: String },
  
  languages: [String],
  consultationFee: { type: Number, required: true },
  
  address: {
    street: String,
    area: String,
    city: { type: String, required: true },
    state: String,
    pincode: String
  },
  
  consultationTypes: {
    online: { type: Boolean, default: true },
    clinic: { type: Boolean, default: true }
  },
  
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  
  verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  isActive: { type: Boolean, default: false },
  
  documents: {
    degreeCertificate: String,
    registrationCertificate: String,
    idProof: String
  },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('HomeopathyDoctor', homeopathyDoctorSchema);
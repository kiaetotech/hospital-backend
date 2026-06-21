const mongoose = require('mongoose');

const homeopathyDoctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String },
  password: { type: String },
  
  specialization: { type: String, enum: ['Classical Homeopathy', 'Clinical Homeopathy', 'Naturopathy', 'Yoga & Naturopathy', 'Diet Therapy', 'Acupuncture', 'Biochemic Medicine', 'Bach Flower Therapy'], required: true },
  experience: { type: Number, required: true },
  education: { type: String },
  about: { type: String },
  
  registrationNumber: { type: String, required: true, unique: true },
  registrationCouncil: { type: String },
  
  languages: [String],
  consultationFee: { type: Number, required: true },
  
  address: {
    street: String, area: String,
    city: { type: String, required: true },
    state: String, pincode: String,
    coordinates: { lat: Number, lng: Number }
  },
  
  clinicName: { type: String },
  
  consultationTypes: { online: { type: Boolean, default: true }, clinic: { type: Boolean, default: true } },
  
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  reviews: [{ patient: String, patientName: String, rating: Number, review: String, createdAt: { type: Date, default: Date.now } }],
  
  verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  isActive: { type: Boolean, default: false },
  verifiedBy: String, verifiedAt: Date, rejectionReason: String,
  
  documents: { degreeCertificate: String, registrationCertificate: String, idProof: String, photo: String },
  
  availability: [{ day: String, slots: [{ startTime: String, endTime: String }] }],
  
  stats: { totalConsultations: { type: Number, default: 0 }, totalEarnings: { type: Number, default: 0 } },
  
  bankDetails: { accountHolder: String, accountNumber: String, ifscCode: String, bankName: String, upiId: String },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('HomeopathyDoctor', homeopathyDoctorSchema);
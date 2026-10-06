const mongoose = require('mongoose');

const pharmacySchema = new mongoose.Schema({
  businessName: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String },
  password: { type: String },
  
  drugLicenseNumber: { type: String, required: true, unique: true },
  gstNumber: { type: String },
  
  address: { street: String, area: String, city: { type: String, required: true }, state: String, pincode: String },
  pincodesServed: [String],
  
  ownerName: String,
  shopPhotos: [String],
  
  medicines: [{ name: String, potency: String, category: String, price: Number, stock: { type: Number, default: 0 } }],
  
  rating: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  
    verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending' },
  verificationHistory: [{
    action: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended', 'unsuspended'] },
    at: { type: Date, default: Date.now },
    reason: { type: String }
  }],
  suspendedReason: { type: String },
  suspendedAt: { type: Date },
  isActive: { type: Boolean, default: false },
  
  documents: { drugLicense: String, gstCertificate: String, shopPhoto: String },
  
  bankDetails: { accountHolder: String, accountNumber: String, ifscCode: String, bankName: String },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Pharmacy', pharmacySchema);
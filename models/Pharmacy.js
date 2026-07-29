const mongoose = require('mongoose');

const pharmacySchema = new mongoose.Schema({
  businessName: { type, required},
  phone: { type, required, unique},
  email: { type},
  password: { type},
  
  drugLicenseNumber: { type, required, unique},
  gstNumber: { type},
  
  address: { street, area, city: { type, required}, state, pincode},
  pincodesServed: [String],
  
  ownerName,
  shopPhotos: [String],
  
  medicines: [{ name, potency, category, price, stock: { type, default: 0 } }],
  
  rating: { type, default: 0 },
  totalOrders: { type, default: 0 },
  
  verificationStatus: { type, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  isActive: { type, default},
  
  documents: { drugLicense, gstCertificate, shopPhoto},
  
  bankDetails: { accountHolder, accountNumber, ifscCode, bankName},
  
  createdAt: { type, default.now }
});

module.exports = mongoose.model('Pharmacy', pharmacySchema);


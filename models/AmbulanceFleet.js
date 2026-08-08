const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  vehicleNumber: { type: String },
  type: { type: String, enum: ['basic', 'cardiac', 'ventilator', 'neonatal', 'wheelchair'], default: 'basic' },
  status: { type: String, enum: ['available', 'on_trip', 'maintenance', 'offline'], default: 'available' },
  make: { type: String },
  model: { type: String },
  year: { type: Number },
  registrationDate: { type: Date },
  equipment: [{ type: String }],
  baseFare: { type: Number },
  perKmRate: { type: Number },
  nightCharge: { type: Number },
  waitingCharge: { type: Number },
  driverName: { type: String },
  driverPhone: { type: String },
  driverLicense: { type: String },
  driverExperience: { type: String },
  location: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 }
  },
  city: { type: String }
});

const driverSchema = new mongoose.Schema({
  name: { type: String },
  phone: { type: String },
  licenseNumber: { type: String },
  experience: { type: String },
  status: { type: String, enum: ['available', 'on_trip', 'offline'], default: 'available' },
  rating: { type: Number, default: 4.5 },
  totalTrips: { type: Number, default: 0 },
  joinedAt: { type: Date, default: Date.now }
});

const corporatePackageSchema = new mongoose.Schema({
  packageName: String,
  packageType: String,
  description: String,
  pricePerEmployee: Number,
  discountedPricePerEmployee: Number,
  minEmployees: Number,
  validityDays: Number,
  servicesIncluded: [String],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const ambulanceFleetSchema = new mongoose.Schema({
  ownerType: { type: String, enum: ['hospital', 'ambulance_provider'], required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  providerName: { type: String },
  city: { type: String },
  state: { type: String },
  contactPhone: { type: String },
  contactEmail: { type: String },
  vehicles: [vehicleSchema],
  drivers: [driverSchema],
  pricing: {
    basePrice: { type: Number, default: 500 },
    pricePerKm: { type: Number, default: 20 },
    emergencyCharge: { type: Number, default: 200 },
    nightChargeMultiplier: { type: Number, default: 1.5 },
    oxygenCharge: { type: Number, default: 200 },
    waitingChargePerMin: { type: Number, default: 5 }
  },
  servesCorporate: { type: Boolean, default: false },
  corporatePackages: [corporatePackageSchema],
  corporateEnquiries: [{
    companyName: String,
    contactPerson: String,
    email: String,
    phone: String,
    employeeCount: Number,
    requirements: String,
    status: { type: String, enum: ['new', 'contacted', 'negotiating', 'converted', 'closed'], default: 'new' },
    createdAt: { type: Date, default: Date.now }
  }],
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AmbulanceFleet', ambulanceFleetSchema);
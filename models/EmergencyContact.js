const mongoose = require('mongoose');

// ============================================
// EMERGENCY CONTACT MODEL
// ============================================
// Stores emergency contacts and critical medical
// information for ALL tags that involve emergencies
//
// Used by:
// 🚑 Ambulance - Emergency dispatch
// 🧠 Mental Health - Crisis intervention
// 🏥 Hospitals - Emergency admission
// 🏠 Caregivers - Patient emergency
// 🏢 Corporate - Employee emergency
// 📱 Online Doctor - Urgent consultation
// ============================================

const emergencyContactSchema = new mongoose.Schema({
  // ============================================
  // USER REFERENCE
  // ============================================
  
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true  // One emergency profile per user
  },
  userType: {
    type: String,
    enum: ['patient', 'caregiver_recipient', 'employee', 'general'],
    default: 'patient'
  },

  // ============================================
  // 🚨 EMERGENCY CONTACTS
  // ============================================
  
  contacts: [{
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    relationship: { 
      type: String, 
      enum: [
        'spouse', 'parent', 'child', 'sibling', 
        'grandparent', 'grandchild', 'relative',
        'friend', 'neighbor', 'colleague', 'caregiver',
        'guardian', 'other'
      ]
    },
    priority: { 
      type: Number, 
      default: 1,
      min: 1,
      max: 5  // 1=Primary, 5=Last resort
    },
    isEmergencyContact: { type: Boolean, default: true },
    
    // Notification preferences
    notifyOn: {
      ambulance_emergency: { type: Boolean, default: true },   // 🚑
      mental_health_crisis: { type: Boolean, default: true },  // 🧠
      hospital_emergency: { type: Boolean, default: true },    // 🏥
      caregiver_emergency: { type: Boolean, default: true },   // 🏠
      corporate_emergency: { type: Boolean, default: false },  // 🏢
      general_emergency: { type: Boolean, default: true }      // All other
    },
    
    // Contact availability
    available24x7: { type: Boolean, default: true },
    availableFrom: { type: String },  // "09:00"
    availableTo: { type: String },    // "21:00"
    timezone: { type: String, default: 'Asia/Kolkata' },
    
    // Verification
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    
    // Last notification
    lastNotifiedAt: { type: Date },
    lastNotifiedFor: { type: String },  // Tag/service type
    
    // Contact address (for home emergencies)
    address: {
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      pincode: { type: String }
    },
    
    // Additional contact methods
    alternatePhone: { type: String },
    whatsappNumber: { type: String },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],

  // ============================================
  // 🩺 CRITICAL MEDICAL INFORMATION
  // ============================================
  
  medicalInfo: {
    // Basic
    bloodGroup: { 
      type: String, 
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'] 
    },
    height: { type: Number },  // cm
    weight: { type: Number },  // kg
    
    // Critical conditions
    chronicConditions: [{
      condition: { type: String },
      diagnosedSince: { type: Date },
      severity: { type: String, enum: ['mild', 'moderate', 'severe', 'critical'] },
      medications: [{ type: String }],
      notes: { type: String }
    }],
    
    // Allergies (Critical for emergency)
    allergies: [{
      allergen: { type: String, required: true },
      reaction: { type: String },
      severity: { type: String, enum: ['mild', 'moderate', 'severe', 'life_threatening'] },
      category: { 
        type: String, 
        enum: ['medication', 'food', 'environmental', 'insect', 'latex', 'other'] 
      }
    }],
    
    // Current medications
    currentMedications: [{
      name: { type: String },
      dosage: { type: String },
      frequency: { type: String },
      since: { type: Date },
      prescribedBy: { type: String },
      forCondition: { type: String }
    }],
    
    // Past surgeries
    pastSurgeries: [{
      surgery: { type: String },
      date: { type: Date },
      hospital: { type: String },
      notes: { type: String }
    }],
    
    // Implants/Devices
    implants: [{
      type: { type: String },  // Pacemaker, Stent, Artificial joint, etc.
      implantedDate: { type: Date },
      location: { type: String },
      notes: { type: String }
    }],
    
    // Special conditions
    isPregnant: { type: Boolean, default: false },
    dueDate: { type: Date },
    isOrganDonor: { type: Boolean, default: false },
    hasDisability: { type: Boolean, default: false },
    disabilityDetails: { type: String },
    
    // Emergency-specific
    doNotResuscitate: { type: Boolean, default: false },
    dnrDocumentUrl: { type: String },
    advanceDirective: { type: String },
    
    lastUpdated: { type: Date, default: Date.now },
    verifiedByDoctor: { type: Boolean, default: false },
    verifiedDoctorId: { type: String }
  },

  // ============================================
  // 🛡️ INSURANCE INFORMATION
  // ============================================
  
  insuranceInfo: {
    primaryInsurance: {
      provider: { type: String },
      policyNumber: { type: String },
      groupId: { type: String },
      validUntil: { type: Date },
      cardFrontImage: { type: String },  // Cloudinary URL
      cardBackImage: { type: String }    // Cloudinary URL
    },
    secondaryInsurance: {
      provider: { type: String },
      policyNumber: { type: String }
    },
    tpaProvider: { type: String },  // Third Party Administrator
    tpaContact: { type: String }
  },

  // ============================================
  // 🏥 PREFERRED HOSPITALS
  // ============================================
  
  preferredHospitals: [{
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    hospitalName: { type: String },
    address: { type: String },
    phone: { type: String },
    isNetworkHospital: { type: Boolean, default: false },
    priority: { type: Number, default: 1 },  // 1=First choice
    reason: { type: String }  // "Close to home", "Insurance network", etc.
  }],

  // ============================================
  // 🚑 AMBULANCE-SPECIFIC PREFERENCES
  // ============================================
  
  ambulancePreferences: {
    preferredAmbulanceType: {
      type: String,
      enum: ['basic', 'cardiac', 'ventilator', 'neonatal', 'wheelchair', 'any'],
      default: 'any'
    },
    requiresOxygen: { type: Boolean, default: false },
    requiresStretcher: { type: Boolean, default: false },
    requiresWheelchairAccess: { type: Boolean, default: false },
    specialInstructions: { type: String },
    buildingInfo: {
      floor: { type: Number },
      hasElevator: { type: Boolean, default: true },
      accessNotes: { type: String }  // "Narrow staircase", "Service elevator only"
    }
  },

  // ============================================
  // 🧠 MENTAL HEALTH CRISIS INFO
  // ============================================
  
  mentalHealthCrisis: {
    hasMentalHealthCondition: { type: Boolean, default: false },
    diagnosis: [{ type: String }],
    therapistName: { type: String },
    therapistPhone: { type: String },
    psychiatristName: { type: String },
    psychiatristPhone: { type: String },
    crisisPlan: { type: String },
    triggers: [{ type: String }],
    copingStrategies: [{ type: String }],
    preferredCrisisFacility: { type: String },
    medicationsForCrisis: [{ type: String }]
  },

  // ============================================
  // 🏠 CAREGIVER EMERGENCY INFO
  // ============================================
  
  caregiverEmergency: {
    hasCaregiver: { type: Boolean, default: false },
    caregiverName: { type: String },
    caregiverPhone: { type: String },
    caregiverAgency: { type: String },
    caregiverAgencyPhone: { type: String },
    careSchedule: { type: String },  // "Mon-Fri 8am-6pm"
    backupCaregiver: { type: String },
    backupCaregiverPhone: { type: String },
    mobilityStatus: {
      type: String,
      enum: ['independent', 'walker', 'wheelchair', 'bedridden', 'assisted']
    },
    communicationNeeds: [{ type: String }],  // "Hearing impaired", "Non-verbal"
    specialCareInstructions: { type: String }
  },

  // ============================================
  // 🏢 CORPORATE EMERGENCY INFO
  // ============================================
  
  corporateEmergency: {
    companyName: { type: String },
    hrContact: { type: String },
    hrPhone: { type: String },
    hrEmail: { type: String },
    employeeId: { type: String },
    department: { type: String },
    managerName: { type: String },
    managerPhone: { type: String },
    workLocation: { type: String },
    corporateHealthProgram: { type: String }
  },

  // ============================================
  // 📱 EMERGENCY APP SETTINGS
  // ============================================
  
  emergencySettings: {
    // Quick access
    enableEmergencyButton: { type: Boolean, default: true },
    enableSOSGesture: { type: Boolean, default: true },  // Shake phone for SOS
    autoDetectFall: { type: Boolean, default: false },
    
    // Auto-share
    autoShareLocation: { type: Boolean, default: true },
    autoShareMedicalInfo: { type: Boolean, default: true },
    autoShareInsurance: { type: Boolean, default: true },
    autoNotifyContacts: { type: Boolean, default: true },
    autoCallAmbulance: { type: Boolean, default: false },
    
    // Notification preferences
    notifyBeforeDispatch: { type: Boolean, default: true },
    notifyAfterDispatch: { type: Boolean, default: true },
    notifyOnArrival: { type: Boolean, default: true },
    
    // Emergency sound
    emergencySoundEnabled: { type: Boolean, default: true },
    emergencySoundVolume: { type: Number, default: 100, min: 0, max: 100 }
  },

  // ============================================
  // 🚨 EMERGENCY HISTORY
  // ============================================
  
  emergencyHistory: [{
    emergencyType: {
      type: String,
      enum: [
        'ambulance_emergency',   // 🚑
        'mental_health_crisis',  // 🧠
        'hospital_emergency',    // 🏥
        'caregiver_emergency',   // 🏠
        'corporate_emergency',   // 🏢
        'general_emergency'      // Other
      ]
    },
    bookingId: { type: String },
    occurredAt: { type: Date },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String }
    },
    outcome: { type: String },
    notes: { type: String },
    contactsNotified: [{ type: String }],
    ambulanceDispatched: { type: Boolean, default: false },
    hospitalVisited: { type: String }
  }],

  // ============================================
  // AUDIT FIELDS
  // ============================================
  
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastEmergencyAt: { type: Date },
  totalEmergencies: { type: Number, default: 0 }
});

// ============================================
// INDEXES
// ============================================

emergencyContactSchema.index({ userId: 1 });
emergencyContactSchema.index({ 'contacts.phone': 1 });
emergencyContactSchema.index({ 'medicalInfo.bloodGroup': 1 });
emergencyContactSchema.index({ 'emergencyHistory.occurredAt': -1 });
emergencyContactSchema.index({ totalEmergencies: -1 });

// ============================================
// VIRTUAL FIELDS
// ============================================

// Get primary emergency contact
emergencyContactSchema.virtual('primaryContact').get(function() {
  if (!this.contacts || this.contacts.length === 0) return null;
  const sorted = [...this.contacts].sort((a, b) => a.priority - b.priority);
  return sorted.find(c => c.isEmergencyContact && c.isVerified) || sorted[0];
});

// Get all verified contacts
emergencyContactSchema.virtual('verifiedContacts').get(function() {
  return this.contacts.filter(c => c.isVerified && c.isEmergencyContact);
});

// Get contacts available now
emergencyContactSchema.virtual('availableContactsNow').get(function() {
  if (!this.contacts) return [];
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

  return this.contacts.filter(c => {
    if (c.available24x7) return true;
    if (!c.availableFrom || !c.availableTo) return true;
    return currentTimeStr >= c.availableFrom && currentTimeStr <= c.availableTo;
  });
});

// Check if user has critical allergies
emergencyContactSchema.virtual('hasCriticalAllergies').get(function() {
  return this.medicalInfo?.allergies?.some(a => a.severity === 'life_threatening') || false;
});

// Get critical conditions summary
emergencyContactSchema.virtual('criticalConditionsSummary').get(function() {
  if (!this.medicalInfo?.chronicConditions) return '';
  return this.medicalInfo.chronicConditions
    .filter(c => c.severity === 'severe' || c.severity === 'critical')
    .map(c => c.condition)
    .join(', ');
});

// Check if mental health crisis plan exists
emergencyContactSchema.virtual('hasCrisisPlan').get(function() {
  return !!this.mentalHealthCrisis?.crisisPlan;
});

// ============================================
// METHODS
// ============================================

// Add emergency contact
emergencyContactSchema.methods.addContact = function(contactData) {
  this.contacts.push({
    ...contactData,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  return this.save();
};

// Update emergency contact
emergencyContactSchema.methods.updateContact = function(contactId, updates) {
  const contact = this.contacts.id(contactId);
  if (!contact) return null;
  Object.assign(contact, { ...updates, updatedAt: new Date() });
  return this.save();
};

// Remove emergency contact
emergencyContactSchema.methods.removeContact = function(contactId) {
  this.contacts.pull(contactId);
  return this.save();
};

// Verify a contact
emergencyContactSchema.methods.verifyContact = function(contactId) {
  const contact = this.contacts.id(contactId);
  if (!contact) return null;
  contact.isVerified = true;
  contact.verifiedAt = new Date();
  return this.save();
};

// Update medical information
emergencyContactSchema.methods.updateMedicalInfo = function(medicalData) {
  this.medicalInfo = {
    ...this.medicalInfo,
    ...medicalData,
    lastUpdated: new Date()
  };
  return this.save();
};

// Add allergy
emergencyContactSchema.methods.addAllergy = function(allergyData) {
  if (!this.medicalInfo.allergies) this.medicalInfo.allergies = [];
  this.medicalInfo.allergies.push(allergyData);
  this.medicalInfo.lastUpdated = new Date();
  return this.save();
};

// Add chronic condition
emergencyContactSchema.methods.addChronicCondition = function(conditionData) {
  if (!this.medicalInfo.chronicConditions) this.medicalInfo.chronicConditions = [];
  this.medicalInfo.chronicConditions.push(conditionData);
  this.medicalInfo.lastUpdated = new Date();
  return this.save();
};

// Add current medication
emergencyContactSchema.methods.addMedication = function(medicationData) {
  if (!this.medicalInfo.currentMedications) this.medicalInfo.currentMedications = [];
  this.medicalInfo.currentMedications.push(medicationData);
  this.medicalInfo.lastUpdated = new Date();
  return this.save();
};

// Record emergency event
emergencyContactSchema.methods.recordEmergency = function(emergencyData) {
  this.emergencyHistory.push({
    ...emergencyData,
    occurredAt: new Date()
  });
  this.totalEmergencies = (this.totalEmergencies || 0) + 1;
  this.lastEmergencyAt = new Date();
  return this.save();
};

// Get contacts for a specific emergency type
emergencyContactSchema.methods.getContactsForEmergency = function(emergencyType) {
  const notifyFieldMap = {
    'ambulance_emergency': 'ambulance_emergency',
    'mental_health_crisis': 'mental_health_crisis',
    'hospital_emergency': 'hospital_emergency',
    'caregiver_emergency': 'caregiver_emergency',
    'corporate_emergency': 'corporate_emergency',
    'general_emergency': 'general_emergency'
  };

  const notifyField = notifyFieldMap[emergencyType] || 'general_emergency';
  
  return this.contacts.filter(c => {
    const shouldNotify = c.notifyOn?.[notifyField] || c.notifyOn?.general_emergency;
    return c.isEmergencyContact && c.isVerified && shouldNotify;
  }).sort((a, b) => a.priority - b.priority);
};

// Mark contacts as notified
emergencyContactSchema.methods.markContactsNotified = function(contactIds) {
  const now = new Date();
  this.contacts.forEach(contact => {
    if (contactIds.includes(contact._id.toString())) {
      contact.lastNotifiedAt = now;
    }
  });
  return this.save();
};

// 🚑 Get emergency-ready data for ambulance dispatch
emergencyContactSchema.methods.getAmbulanceEmergencyData = function() {
  return {
    contacts: this.getContactsForEmergency('ambulance_emergency'),
    medicalInfo: {
      bloodGroup: this.medicalInfo?.bloodGroup,
      allergies: this.medicalInfo?.allergies?.filter(a => a.severity === 'severe' || a.severity === 'life_threatening'),
      chronicConditions: this.medicalInfo?.chronicConditions?.filter(c => c.severity === 'severe' || c.severity === 'critical'),
      currentMedications: this.medicalInfo?.currentMedications,
      implants: this.medicalInfo?.implants,
      isPregnant: this.medicalInfo?.isPregnant,
      doNotResuscitate: this.medicalInfo?.doNotResuscitate
    },
    insurance: this.insuranceInfo,
    preferredHospitals: this.preferredHospitals,
    ambulancePreferences: this.ambulancePreferences
  };
};

// 🧠 Get mental health crisis data
emergencyContactSchema.methods.getMentalHealthCrisisData = function() {
  return {
    contacts: this.getContactsForEmergency('mental_health_crisis'),
    crisisInfo: this.mentalHealthCrisis,
    medicalInfo: {
      allergies: this.medicalInfo?.allergies,
      currentMedications: this.medicalInfo?.currentMedications
    }
  };
};

// 🏠 Get caregiver emergency data
emergencyContactSchema.methods.getCaregiverEmergencyData = function() {
  return {
    contacts: this.getContactsForEmergency('caregiver_emergency'),
    caregiverInfo: this.caregiverEmergency,
    medicalInfo: this.medicalInfo,
    ambulancePreferences: this.ambulancePreferences
  };
};

// 🏢 Get corporate emergency data
emergencyContactSchema.methods.getCorporateEmergencyData = function() {
  return {
    contacts: this.getContactsForEmergency('corporate_emergency'),
    corporateInfo: this.corporateEmergency,
    medicalInfo: {
      bloodGroup: this.medicalInfo?.bloodGroup,
      allergies: this.medicalInfo?.allergies
    }
  };
};

// Check if profile is complete (minimum for emergency use)
emergencyContactSchema.methods.isProfileComplete = function() {
  const hasContact = this.contacts.some(c => c.isVerified && c.isEmergencyContact);
  const hasBloodGroup = !!this.medicalInfo?.bloodGroup;
  const hasAllergies = this.medicalInfo?.allergies?.length > 0;
  
  return hasContact && (hasBloodGroup || hasAllergies);
};

// ============================================
// STATIC METHODS
// ============================================

// Find by user ID
emergencyContactSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId, isActive: true });
};

// Find users with specific blood group (for emergency blood requests)
emergencyContactSchema.statics.findByBloodGroup = function(bloodGroup, location = null) {
  const query = { 
    'medicalInfo.bloodGroup': bloodGroup,
    isActive: true 
  };
  return this.find(query).limit(50);
};

// Find users with critical allergies
emergencyContactSchema.statics.findWithCriticalAllergies = function() {
  return this.find({
    'medicalInfo.allergies.severity': 'life_threatening',
    isActive: true
  });
};

// Find users with DNR orders
emergencyContactSchema.statics.findWithDNR = function() {
  return this.find({
    'medicalInfo.doNotResuscitate': true,
    isActive: true
  });
};

// Find users who have had emergencies recently
emergencyContactSchema.statics.findRecentEmergencies = function(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  return this.find({
    'emergencyHistory.occurredAt': { $gte: since },
    isActive: true
  }).sort({ 'emergencyHistory.occurredAt': -1 });
};

// ============================================
// PRE-SAVE HOOK
// ============================================

emergencyContactSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Sort contacts by priority
  if (this.contacts && this.contacts.length > 0) {
    this.contacts.sort((a, b) => a.priority - b.priority);
  }
  
  next();
});

module.exports = mongoose.model('EmergencyContact', emergencyContactSchema);
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
    type.Schema.Types.ObjectId, 
    ref: 'User', 
    required,
    unique// One emergency profile per user
  },
  userType: {
    type,
    enum: ['patient', 'caregiver_recipient', 'employee', 'general'],
    default: 'patient'
  },

  // ============================================
  // 🚨 EMERGENCY CONTACTS
  // ============================================
  
  contacts: [{
    name: { type, required},
    phone: { type, required},
    email: { type},
    relationship: { 
      type, 
      enum: [
        'spouse', 'parent', 'child', 'sibling', 
        'grandparent', 'grandchild', 'relative',
        'friend', 'neighbor', 'colleague', 'caregiver',
        'guardian', 'other'
      ]
    },
    priority: { 
      type, 
      default: 1,
      min: 1,
      max: 5  // 1=Primary, 5=Last resort
    },
    isEmergencyContact: { type, default},
    
    // Notification preferences
    notifyOn: {
      ambulance_emergency: { type, default},   // 🚑
      mental_health_crisis: { type, default},  // 🧠
      hospital_emergency: { type, default},    // 🏥
      caregiver_emergency: { type, default},   // 🏠
      corporate_emergency: { type, default},  // 🏢
      general_emergency: { type, default}      // All other
    },
    
    // Contact availability
    available24x7: { type, default},
    availableFrom: { type},  // "09:00"
    availableTo: { type},    // "21:00"
    timezone: { type, default: 'Asia/Kolkata' },
    
    // Verification
    isVerified: { type, default},
    verifiedAt: { type},
    
    // Last notification
    lastNotifiedAt: { type},
    lastNotifiedFor: { type},  // Tag/service type
    
    // Contact address (for home emergencies)
    address: {
      line1: { type},
      line2: { type},
      city: { type},
      state: { type},
      pincode: { type}
    },
    
    // Additional contact methods
    alternatePhone: { type},
    whatsappNumber: { type},
    
    createdAt: { type, default.now },
    updatedAt: { type, default.now }
  }],

  // ============================================
  // 🩺 CRITICAL MEDICAL INFORMATION
  // ============================================
  
  medicalInfo: {
    // Basic
    bloodGroup: { 
      type, 
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'] 
    },
    height: { type},  // cm
    weight: { type},  // kg
    
    // Critical conditions
    chronicConditions: [{
      condition: { type},
      diagnosedSince: { type},
      severity: { type, enum: ['mild', 'moderate', 'severe', 'critical'] },
      medications: [{ type}],
      notes: { type}
    }],
    
    // Allergies (Critical for emergency)
    allergies: [{
      allergen: { type, required},
      reaction: { type},
      severity: { type, enum: ['mild', 'moderate', 'severe', 'life_threatening'] },
      category: { 
        type, 
        enum: ['medication', 'food', 'environmental', 'insect', 'latex', 'other'] 
      }
    }],
    
    // Current medications
    currentMedications: [{
      name: { type},
      dosage: { type},
      frequency: { type},
      since: { type},
      prescribedBy: { type},
      forCondition: { type}
    }],
    
    // Past surgeries
    pastSurgeries: [{
      surgery: { type},
      date: { type},
      hospital: { type},
      notes: { type}
    }],
    
    // Implants/Devices
    implants: [{
      type: { type},  // Pacemaker, Stent, Artificial joint, etc.
      implantedDate: { type},
      location: { type},
      notes: { type}
    }],
    
    // Special conditions
    isPregnant: { type, default},
    dueDate: { type},
    isOrganDonor: { type, default},
    hasDisability: { type, default},
    disabilityDetails: { type},
    
    // Emergency-specific
    doNotResuscitate: { type, default},
    dnrDocumentUrl: { type},
    advanceDirective: { type},
    
    lastUpdated: { type, default.now },
    verifiedByDoctor: { type, default},
    verifiedDoctorId: { type}
  },

  // ============================================
  // 🛡️ INSURANCE INFORMATION
  // ============================================
  
  insuranceInfo: {
    primaryInsurance: {
      provider: { type},
      policyNumber: { type},
      groupId: { type},
      validUntil: { type},
      cardFrontImage: { type},  // Cloudinary URL
      cardBackImage: { type}    // Cloudinary URL
    },
    secondaryInsurance: {
      provider: { type},
      policyNumber: { type}
    },
    tpaProvider: { type},  // Third Party Administrator
    tpaContact: { type}
  },

  // ============================================
  // 🏥 PREFERRED HOSPITALS
  // ============================================
  
  preferredHospitals: [{
    hospitalId: { type.Schema.Types.ObjectId, ref: 'Hospital' },
    hospitalName: { type},
    address: { type},
    phone: { type},
    isNetworkHospital: { type, default},
    priority: { type, default: 1 },  // 1=First choice
    reason: { type}  // "Close to home", "Insurance network", etc.
  }],

  // ============================================
  // 🚑 AMBULANCE-SPECIFIC PREFERENCES
  // ============================================
  
  ambulancePreferences: {
    preferredAmbulanceType: {
      type,
      enum: ['basic', 'cardiac', 'ventilator', 'neonatal', 'wheelchair', 'any'],
      default: 'any'
    },
    requiresOxygen: { type, default},
    requiresStretcher: { type, default},
    requiresWheelchairAccess: { type, default},
    specialInstructions: { type},
    buildingInfo: {
      floor: { type},
      hasElevator: { type, default},
      accessNotes: { type}  // "Narrow staircase", "Service elevator only"
    }
  },

  // ============================================
  // 🧠 MENTAL HEALTH CRISIS INFO
  // ============================================
  
  mentalHealthCrisis: {
    hasMentalHealthCondition: { type, default},
    diagnosis: [{ type}],
    therapistName: { type},
    therapistPhone: { type},
    psychiatristName: { type},
    psychiatristPhone: { type},
    crisisPlan: { type},
    triggers: [{ type}],
    copingStrategies: [{ type}],
    preferredCrisisFacility: { type},
    medicationsForCrisis: [{ type}]
  },

  // ============================================
  // 🏠 CAREGIVER EMERGENCY INFO
  // ============================================
  
  caregiverEmergency: {
    hasCaregiver: { type, default},
    caregiverName: { type},
    caregiverPhone: { type},
    caregiverAgency: { type},
    caregiverAgencyPhone: { type},
    careSchedule: { type},  // "Mon-Fri 8am-6pm"
    backupCaregiver: { type},
    backupCaregiverPhone: { type},
    mobilityStatus: {
      type,
      enum: ['independent', 'walker', 'wheelchair', 'bedridden', 'assisted']
    },
    communicationNeeds: [{ type}],  // "Hearing impaired", "Non-verbal"
    specialCareInstructions: { type}
  },

  // ============================================
  // 🏢 CORPORATE EMERGENCY INFO
  // ============================================
  
  corporateEmergency: {
    companyName: { type},
    hrContact: { type},
    hrPhone: { type},
    hrEmail: { type},
    employeeId: { type},
    department: { type},
    managerName: { type},
    managerPhone: { type},
    workLocation: { type},
    corporateHealthProgram: { type}
  },

  // ============================================
  // 📱 EMERGENCY APP SETTINGS
  // ============================================
  
  emergencySettings: {
    // Quick access
    enableEmergencyButton: { type, default},
    enableSOSGesture: { type, default},  // Shake phone for SOS
    autoDetectFall: { type, default},
    
    // Auto-share
    autoShareLocation: { type, default},
    autoShareMedicalInfo: { type, default},
    autoShareInsurance: { type, default},
    autoNotifyContacts: { type, default},
    autoCallAmbulance: { type, default},
    
    // Notification preferences
    notifyBeforeDispatch: { type, default},
    notifyAfterDispatch: { type, default},
    notifyOnArrival: { type, default},
    
    // Emergency sound
    emergencySoundEnabled: { type, default},
    emergencySoundVolume: { type, default: 100, min: 0, max: 100 }
  },

  // ============================================
  // 🚨 EMERGENCY HISTORY
  // ============================================
  
  emergencyHistory: [{
    emergencyType: {
      type,
      enum: [
        'ambulance_emergency',   // 🚑
        'mental_health_crisis',  // 🧠
        'hospital_emergency',    // 🏥
        'caregiver_emergency',   // 🏠
        'corporate_emergency',   // 🏢
        'general_emergency'      // Other
      ]
    },
    bookingId: { type},
    occurredAt: { type},
    location: {
      lat: { type},
      lng: { type},
      address: { type}
    },
    outcome: { type},
    notes: { type},
    contactsNotified: [{ type}],
    ambulanceDispatched: { type, default},
    hospitalVisited: { type}
  }],

  // ============================================
  // AUDIT FIELDS
  // ============================================
  
  isActive: { type, default},
  createdAt: { type, default.now },
  updatedAt: { type, default.now },
  lastEmergencyAt: { type},
  totalEmergencies: { type, default: 0 }
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
    createdAtDate(),
    updatedAtDate()
  });
  return this.save();
};

// Update emergency contact
emergencyContactSchema.methods.updateContact = function(contactId, updates) {
  const contact = this.contacts.id(contactId);
  if (!contact) return null;
  Object.assign(contact, { ...updates, updatedAtDate() });
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
    lastUpdatedDate()
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
    occurredAtDate()
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
    contacts.getContactsForEmergency('ambulance_emergency'),
    medicalInfo: {
      bloodGroup.medicalInfo?.bloodGroup,
      allergies.medicalInfo?.allergies?.filter(a => a.severity === 'severe' || a.severity === 'life_threatening'),
      chronicConditions.medicalInfo?.chronicConditions?.filter(c => c.severity === 'severe' || c.severity === 'critical'),
      currentMedications.medicalInfo?.currentMedications,
      implants.medicalInfo?.implants,
      isPregnant.medicalInfo?.isPregnant,
      doNotResuscitate.medicalInfo?.doNotResuscitate
    },
    insurance.insuranceInfo,
    preferredHospitals.preferredHospitals,
    ambulancePreferences.ambulancePreferences
  };
};

// 🧠 Get mental health crisis data
emergencyContactSchema.methods.getMentalHealthCrisisData = function() {
  return {
    contacts.getContactsForEmergency('mental_health_crisis'),
    crisisInfo.mentalHealthCrisis,
    medicalInfo: {
      allergies.medicalInfo?.allergies,
      currentMedications.medicalInfo?.currentMedications
    }
  };
};

// 🏠 Get caregiver emergency data
emergencyContactSchema.methods.getCaregiverEmergencyData = function() {
  return {
    contacts.getContactsForEmergency('caregiver_emergency'),
    caregiverInfo.caregiverEmergency,
    medicalInfo.medicalInfo,
    ambulancePreferences.ambulancePreferences
  };
};

// 🏢 Get corporate emergency data
emergencyContactSchema.methods.getCorporateEmergencyData = function() {
  return {
    contacts.getContactsForEmergency('corporate_emergency'),
    corporateInfo.corporateEmergency,
    medicalInfo: {
      bloodGroup.medicalInfo?.bloodGroup,
      allergies.medicalInfo?.allergies
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
  return this.findOne({ userId, isActive});
};

// Find users with specific blood group (for emergency blood requests)
emergencyContactSchema.statics.findByBloodGroup = function(bloodGroup, location = null) {
  const query = { 
    'medicalInfo.bloodGroup',
    isActive};
  return this.find(query).limit(50);
};

// Find users with critical allergies
emergencyContactSchema.statics.findWithCriticalAllergies = function() {
  return this.find({
    'medicalInfo.allergies.severity': 'life_threatening',
    isActive});
};

// Find users with DNR orders
emergencyContactSchema.statics.findWithDNR = function() {
  return this.find({
    'medicalInfo.doNotResuscitate',
    isActive});
};

// Find users who have had emergencies recently
emergencyContactSchema.statics.findRecentEmergencies = function(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  return this.find({
    'emergencyHistory.occurredAt': { $gte},
    isActive}).sort({ 'emergencyHistory.occurredAt': -1 });
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


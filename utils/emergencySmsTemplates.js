// D:\hospital backend\utils\emergencySmsTemplates.js

// ============================================
// EMERGENCY SMS TEMPLATES - All Tags
// ============================================

/**
 * Centralized SMS templates for all emergency scenarios
 * Used by.js, notificationService.js
 * 
 * Tags covered:
 * 🚑 Ambulance - Emergency dispatch, tracking, driver alerts
 * 🏥 Hospitals - ER notification, bed alerts
 * 🧠 Mental Health - Crisis alerts
 * 🏠 Caregivers - Emergency alerts
 * 🏢 Corporate - Employee emergency
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hospital-frontend-kiaeto.vercel.app';

// ============================================
// 🚑 AMBULANCE EMERGENCY TEMPLATES
// ============================================

const ambulanceTemplates = {
  // ─────────────────────────────────────────
  // PATIENT-FACING TEMPLATES
  // ─────────────────────────────────────────

  // Sent when emergency request is initiated
  emergency_initiated: {
    subject: '🚨 Emergency Request Initiated',
    sms: [
      '🚨 Emergency request received.',
      'We are locating the nearest ambulance.',
      'You will be notified when a driver accepts.',
      'If urgent, call 108 directly.',
      'ID: {bookingId}'
    ],
    email: `
      <div style="background:#fff3e0;padding:20px;border-left:5px solid #ff6f00;">
        <h2 style="color:#e65100;">🚨 Emergency Request Received</h2>
        <p>We are searching for the nearest available ambulance.</p>
        <p><strong>Pickup:</strong> {pickupAddress}</p>
        <p>You will be notified when a driver accepts.</p>
        <p style="color:#e65100;"><strong>If this is a life-threatening emergency, call 108 immediately.</strong></p>
        <p><small>Booking ID: {bookingId}</small></p>
      </div>
    `
  },

  // Sent when driver accepts the emergency
  driver_accepted: {
    subject: '✅ Ambulance Confirmed - On the Way',
    sms: [
      '✅ AMBULANCE CONFIRMED',
      'Driver: {driverName}',
      'Vehicle: {vehicleNumber} ({vehicleType})',
      'ETA: {eta} minutes',
      'Track: {trackingUrl}',
      'OTP: {otp} (share with driver)',
      'ID: {bookingId}'
    ],
    email: `
      <div style="background:#e8f5e9;padding:20px;border-left:5px solid #4caf50;">
        <h2 style="color:#2e7d32;">✅ Ambulance Confirmed</h2>
        <p><strong>Driver:</strong> {driverName} ({driverPhone})</p>
        <p><strong>Vehicle:</strong> {vehicleNumber} ({vehicleType})</p>
        <p><strong>ETA:</strong> <span style="font-size:24px;color:#2e7d32;">{eta} minutes</span></p>
        <p><strong>OTP:</strong> <span style="font-size:20px;font-weight;">{otp}</span></p>
        <p><a href="{trackingUrl}" style="background:#4caf50;color;padding:10px20px;text-decoration;border-radius:5px;">Track Live</a></p>
        <p><small>Booking ID: {bookingId}</small></p>
      </div>
    `
  },

  // Sent when driver arrives at pickup
  driver_arrived: {
    subject: '🚑 Ambulance Has Arrived',
    sms: [
      '🚑 AMBULANCE HAS ARRIVED',
      'Driver: {driverName}',
      'Vehicle: {vehicleNumber}',
      'OTP: {otp} - Share with driver',
      'ID: {bookingId}'
    ]
  },

  // Sent when patient is onboard
  patient_onboard: {
    subject: '🏥 Heading to Hospital',
    sms: [
      '🏥 Patient onboard',
      'Heading to: {hospitalName}',
      'ETA to hospital: {eta} minutes',
      'ID: {bookingId}'
    ]
  },

  // Sent when arrived at hospital
  arrived_hospital: {
    subject: '🏥 Arrived at Hospital',
    sms: [
      '🏥 Arrived at {hospitalName}',
      'Trip completed.',
      'Trip Sheet: {tripSheetUrl}',
      'Fare: ₹{fare}',
      'ID: {bookingId}'
    ]
  },

  // Sent when no driver found
  no_driver_found: {
    subject: '⚠️ No Ambulance Available',
    sms: [
      '⚠️ URGENTambulance available nearby.',
      'CALL 108 (National Ambulance) IMMEDIATELY.',
      'We apologize for the inconvenience.',
      'ID: {bookingId}'
    ],
    priority: 'emergency'
  },

  // Sent when driver cancels (re-dispatching)
  driver_cancelled: {
    subject: '⚠️ Driver Cancelled - Re-dispatching',
    sms: [
      '⚠️ Driver cancelled. Re-dispatching...',
      'Finding another ambulance.',
      'If urgent, call 108.',
      'ID: {bookingId}'
    ]
  },

  // Sent when patient cancels emergency
  emergency_cancelled: {
    subject: 'Emergency Cancelled',
    sms: [
      'Emergency booking cancelled.',
      '{refundMessage}',
      'ID: {bookingId}',
      'We hope you are safe.'
    ]
  },

  // Surge pricing alert
  surge_alert: {
    subject: '⚠️ Surge Pricing Active',
    sms: [
      '⚠️ Surge pricing ({multiplier}x)',
      'Reason: {reason}',
      'Revised fare: ₹{revisedFare}',
      'Accept to continue.',
      'ID: {bookingId}'
    ]
  },

  // ─────────────────────────────────────────
  // DRIVER-FACING TEMPLATES
  // ─────────────────────────────────────────

  // Emergency dispatch alert to driver
  driver_dispatch: {
    subject: '🚨 EMERGENCY REQUEST',
    sms: [
      '🚨 EMERGENCY REQUEST!',
      'Patient: {patientName}',
      'Condition: {patientCondition}',
      'Pickup: {pickupAddress}',
      'Distance: {distance}km | ETA: {eta}min',
      'Est. Fare: ₹{estimatedFare}',
      '{surgeMessage}',
      'ACCEPT WITHIN 15 SECONDS!',
      'ID: {bookingId}'
    ],
    priority: 'emergency'
  },

  // Driver trip completed
  driver_trip_completed: {
    subject: '✅ Trip Completed',
    sms: [
      '✅ Trip Completed',
      'Fare: ₹{fare}',
      'Your earning: ₹{driverEarning}',
      'ID: {bookingId}'
    ]
  },

  // Driver weekly summary
  driver_weekly_summary: {
    subject: '📊 Weekly Summary',
    sms: [
      '📊 Weekly Summary - {driverName}',
      'Trips: {totalTrips} (Emergency: {emergencyTrips})',
      'Earnings: ₹{totalEarnings}',
      'Rating: {rating} ⭐',
      'Avg Response: {avgResponseTime}s',
      'Great work! 💪'
    ]
  },

  // ─────────────────────────────────────────
  // PROVIDER (FLEET OWNER) TEMPLATES
  // ─────────────────────────────────────────

  provider_weekly_summary: {
    subject: '📊 Fleet Weekly Summary',
    sms: [
      '📊 Weekly Fleet Summary - {providerName}',
      'Total Trips: {totalTrips}',
      'Emergency: {emergencyTrips} | Scheduled: {scheduledTrips}',
      'Total Earnings: ₹{totalEarnings}',
      'Avg Rating: {averageRating} ⭐',
      'Avg Response: {averageResponseTime}s',
      'View dashboard for details.'
    ]
  },

  // ─────────────────────────────────────────
  // EMERGENCY CONTACT TEMPLATES
  // ─────────────────────────────────────────

  emergency_contact_notification: {
    subject: '🚨 Emergency Alert - {patientName}',
    sms: [
      '🚨 EMERGENCY ALERT',
      '{patientName} has requested an emergency ambulance.',
      '',
      '🚑 Ambulance: {vehicleNumber} ({ambulanceType})',
      '👨‍⚕️ Driver: {driverName} ({driverPhone})',
      '⏱️ ETA: {eta} minutes',
      '🏥 Destination: {hospitalName}',
      '',
      '📍 Track live: {trackingUrl}'
    ],
    priority: 'emergency'
  },

  // ─────────────────────────────────────────
  // HOSPITAL ER NOTIFICATION TEMPLATES
  // ─────────────────────────────────────────

  hospital_er_alert: {
    subject: '🏥 INCOMING EMERGENCY - {patientName} - ETA {eta}min',
    sms: [
      '🏥 INCOMING EMERGENCY PATIENT',
      'Patient: {patientName}, {patientAge}y, {patientGender}',
      'Condition: {chiefComplaint}',
      'Status: {patientCondition}',
      'Ambulance: {vehicleNumber} ({ambulanceType})',
      'ETA: {eta} minutes',
      'Driver: {driverPhone}',
      '{vitalsLine}',
      'Insurance: {insuranceProvider} ({insurancePolicyNumber})',
      '',
      'PLEASE PREPARE EMERGENCY DEPARTMENT.',
      'ID: {bookingId}'
    ],
    priority: 'emergency'
  },

  // ─────────────────────────────────────────
  // SCHEDULED AMBULANCE TEMPLATES
  // ─────────────────────────────────────────

  scheduled_confirmed: {
    subject: '🚑 Scheduled Ambulance Confirmed',
    sms: [
      '🚑 Ambulance Scheduled',
      'Date: {date} at {time}',
      'Pickup: {pickupAddress}',
      'Destination: {hospitalName}',
      'Vehicle: {vehicleType}',
      'ID: {bookingId}'
    ]
  },

  scheduled_reminder: {
    subject: '⏰ Ambulance Reminder',
    sms: [
      '⏰ Reminderscheduled',
      'Tomorrow at {time}',
      'Pickup: {pickupAddress}',
      'ID: {bookingId}'
    ]
  },

  trip_sheet_ready: {
    subject: '📋 Trip Sheet Ready',
    sms: [
      '📋 Digital trip sheet ready',
      'View & download: {tripSheetUrl}',
      'Use this for insurance claims.',
      'ID: {bookingId}'
    ]
  }
};

// ============================================
// 🏥 HOSPITAL EMERGENCY TEMPLATES
// ============================================

const hospitalTemplates = {
  // ER bed availability alert
  bed_availability_alert: {
    subject: '🛏️ Bed Availability Update',
    sms: [
      '🛏️ {hospitalName} Bed Update:',
      'General: {generalBeds} | ICU: {icuBeds} | Ventilator: {ventilatorBeds}',
      'Updated: {updatedAt}'
    ]
  },

  // Emergency admission alert to family
  emergency_admission: {
    subject: '🏥 Emergency Admission - {patientName}',
    sms: [
      '🏥 Emergency Admission',
      '{patientName} has been admitted to {hospitalName}.',
      'Department: {department}',
      'Room: {roomNumber}',
      'Contact hospital: {hospitalPhone}',
      'ID: {bookingId}'
    ],
    priority: 'high'
  },

  // Surgery emergency alert
  surgery_emergency: {
    subject: '🏥 Emergency Surgery - {patientName}',
    sms: [
      '🏥 EMERGENCY SURGERY',
      '{patientName} is undergoing emergency surgery.',
      'Hospital: {hospitalName}',
      'Department: {department}',
      'Please come to the hospital immediately.',
      'Contact: {hospitalPhone}'
    ],
    priority: 'emergency'
  }
};

// ============================================
// 🧠 MENTAL HEALTH CRISIS TEMPLATES
// ============================================

const mentalHealthTemplates = {
  // Crisis alert to emergency contacts
  crisis_alert: {
    subject: '🚨 MENTAL HEALTH CRISIS - {patientName}',
    sms: [
      '🚨 MENTAL HEALTH CRISIS ALERT',
      '{patientName} may be experiencing a mental health crisis.',
      '',
      'Please check on them immediately.',
      'Crisis Helpline: 9152987821',
      'Therapist: {therapistName} ({therapistPhone})',
      'Crisis Plan: {crisisPlan}',
      '',
      'If this is a life-threatening emergency, call 108.'
    ],
    priority: 'emergency'
  },

  // Therapist alert
  therapist_crisis_alert: {
    subject: '🚨 Patient Crisis Alert - {patientName}',
    sms: [
      '🚨 PATIENT CRISIS ALERT',
      'Your patient {patientName} may be in crisis.',
      'Emergency contacts have been notified.',
      'Please reach out if available.',
      'Helpline: 9152987821'
    ],
    priority: 'emergency'
  },

  // Mood check-in
  mood_check_in: {
    subject: '💭 How are you feeling?',
    sms: [
      '💭 Daily Check-in',
      'How are you feeling today?',
      'Take a moment to journal: {journalUrl}',
      '- Your Mental Health Team'
    ]
  },

  // Crisis center referral
  crisis_center_referral: {
    subject: '🏥 Nearest Crisis Center',
    sms: [
      '🏥 Nearest Crisis Center:',
      '{centerName}',
      'Address: {address}',
      'Phone: {phone}',
      'Distance: {distance}km',
      'Available 24/7: {available24x7}'
    ],
    priority: 'high'
  }
};

// ============================================
// 🏠 CAREGIVER EMERGENCY TEMPLATES
// ============================================

const caregiverTemplates = {
  // Caregiver emergency alert
  caregiver_emergency: {
    subject: '🚨 Caregiver Emergency - {patientName}',
    sms: [
      '🚨 CAREGIVER EMERGENCY',
      'Emergency detected for {patientName}.',
      'Caregiver: {caregiverName} ({caregiverPhone})',
      'Location: {address}',
      '',
      'Fall detected: {fallDetected}',
      'Vitals abnormal: {abnormalVitals}',
      '',
      'Emergency services notified: {ambulanceNotified}',
      'ID: {bookingId}'
    ],
    priority: 'emergency'
  },

  // Caregiver no-show alert
  caregiver_no_show: {
    subject: '⚠️ Caregiver No-Show - {patientName}',
    sms: [
      '⚠️ CAREGIVER NO-SHOW',
      'Caregiver {caregiverName} has not arrived.',
      'Scheduled: {scheduledTime}',
      'Replacement being arranged.',
      'Agency: {agencyPhone}'
    ],
    priority: 'high'
  },

  // Medication missed alert
  medication_missed: {
    subject: '💊 Missed Medication - {patientName}',
    sms: [
      '💊 MISSED MEDICATION',
      '{patientName} missed: {medicationName}',
      'Scheduled time: {scheduledTime}',
      'Please follow up.'
    ],
    priority: 'high'
  }
};

// ============================================
// 🏢 CORPORATE EMERGENCY TEMPLATES
// ============================================

const corporateTemplates = {
  // Employee emergency
  employee_emergency: {
    subject: '🚨 Employee Emergency - {employeeName}',
    sms: [
      '🚨 EMPLOYEE EMERGENCY',
      '{employeeName} (ID: {employeeId})',
      'Department: {department}',
      'Location: {workLocation}',
      '',
      'Emergency services: {ambulanceNotified}',
      'Hospital: {hospitalName}',
      '',
      'HR Contact: {hrPhone}'
    ],
    priority: 'emergency'
  },

  // Workplace accident
  workplace_accident: {
    subject: '🚨 Workplace Accident - {companyName}',
    sms: [
      '🚨 WORKPLACE ACCIDENT',
      'Location: {accidentLocation}',
      'Injured: {injuredCount} person(s)',
      'Ambulance: {ambulanceStatus}',
      '',
      'Safety team notified.',
      'Emergency coordinator: {coordinatorPhone}'
    ],
    priority: 'emergency'
  }
};

// ============================================
// 🛡️ INSURANCE EMERGENCY TEMPLATES
// ============================================

const insuranceTemplates = {
  // Emergency cashless approval
  cashless_emergency_approval: {
    subject: '🏥 Emergency Cashless Approved',
    sms: [
      '✅ Emergency Cashless Approved',
      'Patient: {patientName}',
      'Hospital: {hospitalName}',
      'Policy: {policyNumber}',
      'Coverage: ₹{coverageAmount}',
      'Authorization: {authCode}',
      'ID: {bookingId}'
    ],
    priority: 'high'
  },

  // Insurance card shared with hospital
  insurance_shared: {
    subject: '🛡️ Insurance Shared with Hospital',
    sms: [
      '🛡️ Insurance information shared',
      'Hospital: {hospitalName}',
      'Policy: {policyNumber}',
      'Provider: {insuranceProvider}',
      'ID: {bookingId}'
    ]
  }
};

// ============================================
// 💰 HEALTH EMI EMERGENCY TEMPLATES
// ============================================

const healthEMITemplates = {
  // Emergency loan approved
  emergency_loan_approved: {
    subject: '✅ Emergency Medical Loan Approved',
    sms: [
      '✅ Emergency Loan Approved',
      'Amount: ₹{loanAmount}',
      'Hospital: {hospitalName}',
      'EMI: ₹{emiAmount}/month',
      'Disbursement',
      'ID: {applicationId}'
    ],
    priority: 'high'
  }
};

// ============================================
// 🔬 DIAGNOSTICS EMERGENCY TEMPLATES
// ============================================

const diagnosticsTemplates = {
  // Critical lab result alert
  critical_result_alert: {
    subject: '⚠️ Critical Lab Result - {patientName}',
    sms: [
      '⚠️ CRITICAL LAB RESULT',
      'Patient: {patientName}',
      'Test: {testName}',
      'Result: {resultValue}',
      'Normal Range: {normalRange}',
      '',
      'Please consult your doctor immediately.',
      'Lab: {labName} ({labPhone})'
    ],
    priority: 'high'
  }
};

// ============================================
// 📱 ONLINE DOCTOR EMERGENCY TEMPLATES
// ============================================

const onlineDoctorTemplates = {
  // Urgent consultation needed
  urgent_consult_alert: {
    subject: '⚠️ Urgent Consultation Required',
    sms: [
      '⚠️ URGENTrecommended',
      'Based on your symptoms, an urgent consultation is advised.',
      'Book now: {consultUrl}',
      'Available doctors: {availableDoctors}',
      'If emergency, call 108.'
    ],
    priority: 'high'
  }
};

// ============================================
// 🌿 HOMEOPATHY EMERGENCY TEMPLATES
// ============================================

const homeopathyTemplates = {
  // Acute remedy alert
  acute_remedy_alert: {
    subject: '💊 Acute Remedy Recommendation',
    sms: [
      '💊 ACUTE REMEDY ALERT',
      'For {condition}, consider: {remedy}',
      'Potency: {potency}',
      'Dosage: {dosage}',
      'Consult your homeopath if symptoms persist.',
      'If emergency, call 108.'
    ]
  }
};

// ============================================
// 🧘 AYURVEDA EMERGENCY TEMPLATES
// ============================================

const ayurvedaTemplates = {
  // Emergency Ayurvedic advice
  emergency_ayurveda_advice: {
    subject: '🌿 Emergency Ayurvedic Advice',
    sms: [
      '🌿 EMERGENCY AYURVEDIC ADVICE',
      'For {condition}:',
      'Apply: {immediateAction}',
      'Avoid: {avoidList}',
      'Contact. {doctorName} ({doctorPhone})',
      'If severe, seek emergency allopathic care.'
    ]
  }
};

// ============================================
// GENERIC EMERGENCY TEMPLATES
// ============================================

const genericTemplates = {
  // Generic emergency alert
  generic_emergency: {
    subject: '🚨 Emergency Alert',
    sms: [
      '🚨 EMERGENCY ALERT',
      'Type: {emergencyType}',
      'For: {personName}',
      'Location: {location}',
      'Time: {timestamp}',
      '',
      'Emergency services: {servicesNotified}',
      'ID: {referenceId}'
    ],
    priority: 'emergency'
  },

  // Emergency contact test
  emergency_test: {
    subject: '✅ Emergency Contact Test',
    sms: [
      '✅ EMERGENCY CONTACT TEST',
      'This is a test of the emergency notification system.',
      'If you received this, your contact is working correctly.',
      'No action needed.',
      '- HealthCare Hub'
    ]
  },

  // System down alert
  system_down: {
    subject: '⚠️ System Alert',
    sms: [
      '⚠️ SYSTEM ALERT',
      'Our emergency dispatch system is experiencing issues.',
      'For emergencies, please call 108 directly.',
      'We will notify when the system is back online.',
      '- HealthCare Hub'
    ],
    priority: 'high'
  }
};

// ============================================
// TEMPLATE RENDERER
// ============================================

/**
 * Replace placeholders in template with actual data
 * @param {string} template - Template string with {placeholders}
 * @param {Object} data - Key-value pairs to replace
 * @returns {string} - Rendered text
 */
const renderTemplate = (template, data = {}) => {
  let rendered = template;
  Object.keys(data).forEach(key => {
    const value = data[key] !== undefined && data[key] !== null ? data[key] : 'N/A';
    rendered = rendered.replace(new RegExp(`{${key}}`, 'g'), value);
  });
  // Clean up any remaining placeholders
  rendered = rendered.replace(/\{[^}]+\}/g, 'N/A');
  return rendered;
};

/**
 * Get a complete SMS/Email message from template
 * @param {Object} templateObj - Template object with sms/email/subject
 * @param {Object} data - Data to fill in
 * @returns {Object} - Rendered message
 */
const getMessage = (templateObj, data = {}) => {
  const result = {};
  
  if (templateObj.subject) {
    result.subject = renderTemplate(templateObj.subject, data);
  }
  
  if (templateObj.sms) {
    const smsText = Array.isArray(templateObj.sms) 
      ? templateObj.sms.join('\n') 
      .sms;
    result.sms = renderTemplate(smsText, data);
  }
  
  if (templateObj.email) {
    result.email = renderTemplate(templateObj.email, data);
  }
  
  result.priority = templateObj.priority || 'normal';
  
  return result;
};

/**
 * Get template by category and name
 * @param {string} category - 'ambulance', 'hospital', 'mentalHealth', etc.
 * @param {string} templateName - Template identifier
 * @returns {Object|null} - Template object
 */
const getTemplate = (category, templateName) => {
  const templateMap = {
    ambulance,
    hospital,
    mentalHealth,
    caregiver,
    corporate,
    insurance,
    healthEMI,
    diagnostics,
    onlineDoctor,
    homeopathy,
    ayurveda,
    generic};

  const templates = templateMap[category];
  if (!templates) return null;
  return templates[templateName] || null;
};

/**
 * Get rendered emergency message
 * @param {string} category - Template category
 * @param {string} templateName - Template name
 * @param {Object} data - Replacement data
 * @returns {Object} - Rendered message with subject, sms, email, priority
 */
const getEmergencyMessage = (category, templateName, data = {}) => {
  const template = getTemplate(category, templateName);
  if (!template) {
    return {
      subject: 'Emergency Alert',
      sms: `Emergency: ${templateName}. Data: ${JSON.stringify(data)}`,
      priority: 'high'
    };
  }
  return getMessage(template, data);
};

// ============================================
// ALL TEMPLATES EXPORT
// ============================================

const ALL_TEMPLATES = {
  ambulance,
  hospital,
  mentalHealth,
  caregiver,
  corporate,
  insurance,
  healthEMI,
  diagnostics,
  onlineDoctor,
  homeopathy,
  ayurveda,
  generic};

// ============================================
// TEMPLATE COUNTS
// ============================================

const TEMPLATE_COUNTS = {
  ambulance.keys(ambulanceTemplates).length,
  hospital.keys(hospitalTemplates).length,
  mentalHealth.keys(mentalHealthTemplates).length,
  caregiver.keys(caregiverTemplates).length,
  corporate.keys(corporateTemplates).length,
  insurance.keys(insuranceTemplates).length,
  healthEMI.keys(healthEMITemplates).length,
  diagnostics.keys(diagnosticsTemplates).length,
  onlineDoctor.keys(onlineDoctorTemplates).length,
  homeopathy.keys(homeopathyTemplates).length,
  ayurveda.keys(ayurvedaTemplates).length,
  generic.keys(genericTemplates).length,
  get total() {
    return Object.values(this).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0);
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Template collections
  ambulanceTemplates,
  hospitalTemplates,
  mentalHealthTemplates,
  caregiverTemplates,
  corporateTemplates,
  insuranceTemplates,
  healthEMITemplates,
  diagnosticsTemplates,
  onlineDoctorTemplates,
  homeopathyTemplates,
  ayurvedaTemplates,
  genericTemplates,
  ALL_TEMPLATES,
  
  // Utility functions
  renderTemplate,
  getMessage,
  getTemplate,
  getEmergencyMessage,
  
  // Stats
  TEMPLATE_COUNTS,
  
  // Frontend URL for links
  FRONTEND_URL
};


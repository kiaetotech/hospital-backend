// ============================================
// AI SYMPTOM TRIAGE SERVICE
// ============================================
// Rule-based symptom-to-specialty matching
// No external API needed — instant, free, reliable
// ============================================

// Primary symptom-to-specialty mapping
const SYMPTOM_SPECIALTY_MAP = {
  // General
  'fever': { specialty: 'General Physician', confidence: 'High', keywords: ['fever', 'temperature', 'chills'] },
  'cold': { specialty: 'General Physician', confidence: 'High', keywords: ['cold', 'cough', 'sneeze', 'runny nose'] },
  'flu': { specialty: 'General Physician', confidence: 'High', keywords: ['flu', 'influenza', 'body ache'] },
  'headache': { specialty: 'General Physician', confidence: 'Medium', keywords: ['headache', 'head pain', 'migraine'] },
  'weakness': { specialty: 'General Physician', confidence: 'Medium', keywords: ['weakness', 'fatigue', 'tired'] },
  
  // Cardiology
  'chest pain': { specialty: 'Cardiologist', confidence: 'High', keywords: ['chest pain', 'heart', 'palpitation', 'chest tightness'] },
  'high bp': { specialty: 'Cardiologist', confidence: 'High', keywords: ['high bp', 'blood pressure', 'hypertension'] },
  'breathless': { specialty: 'Cardiologist', confidence: 'Medium', keywords: ['breathless', 'shortness of breath', 'difficulty breathing'] },
  
  // Dermatology
  'skin': { specialty: 'Dermatologist', confidence: 'High', keywords: ['skin', 'rash', 'acne', 'itching', 'allergy', 'pimple', 'eczema'] },
  'hair loss': { specialty: 'Dermatologist', confidence: 'High', keywords: ['hair loss', 'bald', 'dandruff', 'hair fall'] },
  
  // Gynecology
  'pregnancy': { specialty: 'Gynecologist', confidence: 'High', keywords: ['pregnancy', 'pregnant', 'missed period'] },
  'period': { specialty: 'Gynecologist', confidence: 'High', keywords: ['period', 'menstrual', 'menstruation', 'cramps', 'pcos'] },
  'women': { specialty: 'Gynecologist', confidence: 'Medium', keywords: ['women', 'female', 'uterus', 'ovary'] },
  
  // Pediatrics
  'child': { specialty: 'Pediatrician', confidence: 'High', keywords: ['child', 'baby', 'infant', 'kid', 'newborn', 'son', 'daughter'] },
  'vaccination': { specialty: 'Pediatrician', confidence: 'High', keywords: ['vaccination', 'vaccine', 'immunization'] },
  
  // Orthopedics
  'bone': { specialty: 'Orthopedic', confidence: 'High', keywords: ['bone', 'fracture', 'joint pain', 'knee', 'back pain', 'neck pain', 'spine'] },
  'arthritis': { specialty: 'Orthopedic', confidence: 'High', keywords: ['arthritis', 'joint swelling', 'stiffness'] },
  
  // Gastroenterology
  'stomach': { specialty: 'Gastroenterologist', confidence: 'High', keywords: ['stomach', 'digestion', 'acidity', 'gas', 'bloating', 'constipation', 'diarrhea'] },
  'liver': { specialty: 'Gastroenterologist', confidence: 'High', keywords: ['liver', 'jaundice', 'hepatitis'] },
  
  // ENT
  'ear': { specialty: 'ENT Specialist', confidence: 'High', keywords: ['ear', 'hearing', 'ear pain', 'tinnitus'] },
  'throat': { specialty: 'ENT Specialist', confidence: 'High', keywords: ['throat', 'sore throat', 'tonsils', 'voice'] },
  'nose': { specialty: 'ENT Specialist', confidence: 'High', keywords: ['nose', 'sinus', 'nasal', 'sneeze'] },
  
  // Ophthalmology
  'eye': { specialty: 'Ophthalmologist', confidence: 'High', keywords: ['eye', 'vision', 'blurry', 'cataract', 'glasses'] },
  
  // Dental
  'tooth': { specialty: 'Dentist', confidence: 'High', keywords: ['tooth', 'teeth', 'dental', 'gum', 'cavity', 'mouth'] },
  
  // Psychiatry/Mental Health
  'anxiety': { specialty: 'Psychiatrist', confidence: 'High', keywords: ['anxiety', 'anxious', 'panic', 'worry', 'stress', 'nervous'] },
  'depression': { specialty: 'Psychiatrist', confidence: 'High', keywords: ['depression', 'depressed', 'sad', 'hopeless', 'suicidal'] },
  'sleep': { specialty: 'Psychiatrist', confidence: 'Medium', keywords: ['sleep', 'insomnia', 'nightmare', 'sleepless'] },
  
  // Neurology
  'seizure': { specialty: 'Neurologist', confidence: 'High', keywords: ['seizure', 'epilepsy', 'convulsion', 'fit'] },
  'numbness': { specialty: 'Neurologist', confidence: 'High', keywords: ['numbness', 'tingling', 'paralysis', 'tremor'] },
  'memory': { specialty: 'Neurologist', confidence: 'Medium', keywords: ['memory', 'forgetful', 'confusion', 'dementia'] },
  
  // Pulmonology
  'cough': { specialty: 'Pulmonologist', confidence: 'Medium', keywords: ['cough', 'phlegm', 'wheezing', 'asthma', 'bronchitis'] },
  'lung': { specialty: 'Pulmonologist', confidence: 'High', keywords: ['lung', 'pneumonia', 'tb', 'tuberculosis'] },
  
  // Endocrinology
  'diabetes': { specialty: 'Endocrinologist', confidence: 'High', keywords: ['diabetes', 'sugar', 'glucose', 'insulin', 'thyroid'] },
  'weight': { specialty: 'Endocrinologist', confidence: 'Medium', keywords: ['weight gain', 'weight loss', 'obesity', 'metabolism'] },
  
  // Urology
  'urine': { specialty: 'Urologist', confidence: 'High', keywords: ['urine', 'urinary', 'kidney stone', 'bladder', 'prostate'] },
  'kidney': { specialty: 'Urologist', confidence: 'High', keywords: ['kidney', 'renal', 'dialysis'] },
  
  // Emergency
  'bleeding': { specialty: 'Emergency Medicine', confidence: 'Critical', keywords: ['bleeding', 'blood', 'injury', 'accident', 'wound'] },
  'accident': { specialty: 'Emergency Medicine', confidence: 'Critical', keywords: ['accident', 'fall', 'trauma', 'burn', 'poison'] }
};

// Red flag symptoms that need emergency
const EMERGENCY_SYMPTOMS = [
  'chest pain severe',
  'difficulty breathing',
  'heavy bleeding',
  'unconscious',
  'seizure',
  'stroke',
  'heart attack',
  'poison',
  'severe burn',
  'suicidal',
  'accident major'
];

// Common health tips based on symptoms
const HEALTH_TIPS = {
  'fever': 'Rest well, drink plenty of fluids. Monitor temperature every 4 hours.',
  'headache': 'Stay hydrated, rest in a quiet dark room. Avoid screen time.',
  'cough': 'Drink warm water, use honey and ginger. Avoid cold drinks.',
  'stomach': 'Eat light food, avoid spicy and oily items. Stay hydrated.',
  'skin': 'Keep the area clean and dry. Avoid scratching. Use mild soap.',
  'anxiety': 'Practice deep breathing. Inhale for 4 seconds, hold for 4, exhale for 4.',
  'sleep': 'Avoid screens 1 hour before bed. Maintain consistent sleep schedule.',
  'back pain': 'Apply hot/cold compress. Avoid heavy lifting. Maintain good posture.'
};

/**
 * Analyze patient symptoms and recommend specialist
 * @param {string} symptoms - Patient's symptom description
 * @returns {Object} Triage result with recommendations
 */
const triageSymptoms = (symptoms) => {
  if (!symptoms || symptoms.trim().length < 3) {
    return {
      success,
      message: 'Please describe your symptoms in more detail',
      recommendation};
  }

  const symptomsLower = symptoms.toLowerCase();
  const matches = [];
  const matchedSpecialties = new Set();

  // Check emergency first
  for (const emergency of EMERGENCY_SYMPTOMS) {
    if (symptomsLower.includes(emergency)) {
      return {
        success,
        isEmergency,
        message: '⚠️ URGENTsymptoms suggest a medical emergency.',
        recommendation: {
          specialty: 'Emergency Medicine',
          action: 'Please call emergency services (108) or visit the nearest Emergency Room immediately.',
          urgency: 'critical'
        },
        matches: []
      };
    }
  }

  // Match symptoms to specialties
  for (const [condition, data] of Object.entries(SYMPTOM_SPECIALTY_MAP)) {
    for (const keyword of data.keywords) {
      if (symptomsLower.includes(keyword)) {
        if (!matchedSpecialties.has(data.specialty)) {
          matches.push({
            condition,
            specialty.specialty,
            confidence.confidence,
            matchedKeyword});
          matchedSpecialties.add(data.specialty);
        }
        break;
      }
    }
  }

  // Sort by confidence
  const confidenceOrder = { 'Critical': 5, 'High': 4, 'Medium': 3, 'Low': 2 };
  matches.sort((a, b) => (confidenceOrder[b.confidence] || 0) - (confidenceOrder[a.confidence] || 0));

  // Get primary recommendation
  const primaryRecommendation = matches[0] || {
    specialty: 'General Physician',
    confidence: 'Low',
    condition: 'general checkup'
  };

  // Find relevant health tips
  const tips = [];
  for (const match of matches) {
    const tipKey = Object.keys(HEALTH_TIPS).find(key => 
      match.condition.includes(key) || symptomsLower.includes(key)
    );
    if (tipKey && !tips.includes(HEALTH_TIPS[tipKey])) {
      tips.push(HEALTH_TIPS[tipKey]);
    }
  }

  // Severity assessment
  let severity = 'Low';
  if (matches.some(m => m.confidence === 'Critical')) severity = 'Critical';
  else if (matches.length >= 3) severity = 'Medium';
  else if (matches.some(m => m.confidence === 'High')) severity = 'Medium';

  return {
    success,
    isEmergency,
    message: `Based on your symptoms, we recommend consulting a ${primaryRecommendation.specialty}.`,
    recommendation: {
      specialty.specialty,
      confidence.confidence,
      severity,
      action: `Book a ${primaryRecommendation.specialty} consultation`,
      estimatedUrgency=== 'High' ? 'Within 24 hours' === 'Medium' ? 'Within 2-3 days' : 'When convenient'
    },
    allPossibleSpecialties: [...new Set(matches.map(m => m.specialty))],
    matches.slice(0, 5), // Top 5 matches
    healthTips.slice(0, 3), // Top 3 tips
    disclaimer: 'This is an AI-assisted recommendation. Always consult a qualified doctor for medical advice.',
    analyzedSymptoms,
    timestampDate().toISOString()
  };
};

/**
 * Get all available specialties
 */
const getAvailableSpecialties = () => {
  const specialties = new Set();
  for (const data of Object.values(SYMPTOM_SPECIALTY_MAP)) {
    specialties.add(data.specialty);
  }
  return [...specialties].sort();
};

/**
 * Quick symptom checker (returns specialty only)
 */
const quickTriage = (symptoms) => {
  const result = triageSymptoms(symptoms);
  return {
    specialty.recommendation?.specialty || 'General Physician',
    isEmergency.isEmergency || false,
    confidence.recommendation?.confidence || 'Low'
  };
};

module.exports = {
  triageSymptoms,
  getAvailableSpecialties,
  quickTriage,
  SYMPTOM_SPECIALTY_MAP,
  EMERGENCY_SYMPTOMS
};


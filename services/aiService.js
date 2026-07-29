// ============================================
// FILE:\hospital backend\services\aiService.js
// ============================================
// UNIVERSAL AI SERVICE — Production Ready
// PowersDoctor Triage, Hospital Search,
//         Main Search Bar, Emergency Detection
// ============================================
// Primary+ Llama 3 (FREE, 30 RPM)
// FallbackFlash (FREE, 15 RPM)
// Enhanced Rule-basedMaster Data (300+ keywords)
// ============================================

const axios = require('axios');
const MEDICAL_MASTER_DATA = require('../data/medicalMasterData');

// ============================================
// API CONFIGURATION
// ============================================

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash';

// ============================================
// CACHE — Avoid repeated API calls
// ============================================
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const getCached = (key) => {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
};

const setCache = (key, data) => {
  // Keep cache size manageable
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { data, timestamp.now() });
};

// ============================================
// 1. GROQ + LLAMA 3 (Primary — FREE)
// ============================================

const callGroq = async (prompt) => {
  if (!GROQ_API_KEY) return null;

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model_MODEL,
        messages: [
          { 
            role: 'system', 
            content: 'You are a medical triage assistant for an Indian healthcare platform. Respond in valid JSON only. No markdown, no explanations, no code fences.' 
          },
          { role: 'user', content}
        ],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    const content = response.data.choices[0].message.content;
    // Clean any markdown that might slip through
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('Groq API error:', error.message);
    return null;
  }
};

// ============================================
// 2. GEMINI FLASH (Fallback — FREE)
// ============================================

const callGemini = async (prompt) => {
  if (!GEMINI_API_KEY) return null;

  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{ 
          parts: [{ 
            text+ '\n\nRespond with ONLY valid JSON. No markdown, no code fences, no extra text.' 
          }] 
        }],
        generationConfig: { 
          temperature: 0.2, 
          maxOutputTokens: 500 
        }
      },
      { timeout: 10000 }
    );

    const text = response.data.candidates[0].content.parts[0].text;
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) ;
  } catch (error) {
    console.error('Gemini API error:', error.message);
    return null;
  }
};

// ============================================
// 3. ENHANCED RULE-BASED (Medical Master Data)
// ============================================

const getHealthTips = (category) => {
  const tips = {
    'Heart': ['Avoid fatty and salty foods', 'Monitor blood pressure daily', 'Take prescribed medications on time', 'Avoid heavy exertion'],
    'Brain & Nerves': ['Get adequate sleep', 'Avoid stress triggers', 'Maintain a symptom diary', 'Stay hydrated'],
    'Bones & Joints': ['Apply hot/cold compress', 'Avoid heavy lifting', 'Maintain good posture', 'Do gentle stretches'],
    'Cancer': ['Follow oncologist advice strictly', 'Maintain nutrition', 'Join support groups', 'Keep all follow-up appointments'],
    'Kidney & Urinary': ['Drink plenty of water', 'Reduce salt intake', 'Avoid holding urine', 'Monitor urine color'],
    'Liver & Stomach': ['Eat small frequent meals', 'Avoid spicy and oily food', 'Avoid alcohol', 'Stay hydrated'],
    'Lungs & Breathing': ['Avoid dust and smoke', 'Use inhaler as prescribed', 'Practice breathing exercises', 'Stay indoors on high pollution days'],
    'Diabetes & Hormones': ['Monitor blood sugar regularly', 'Follow diabetic diet', 'Exercise daily', 'Take medications on time'],
    'Eye': ['Avoid screen strain', 'Use prescribed eye drops', 'Wear sunglasses outdoors', 'Get regular eye checkups'],
    'Ear, Nose, Throat': ['Avoid cold drinks', 'Steam inhalation', 'Gargle with warm salt water', 'Avoid loud noise'],
    'Skin': ['Keep area clean and dry', 'Avoid scratching', 'Use mild soap', 'Apply prescribed cream'],
    'Women Health': ['Track menstrual cycle', 'Maintain healthy weight', 'Regular checkups', 'Take prescribed supplements'],
    'Children': ['Monitor temperature', 'Ensure hydration', 'Follow vaccination schedule', 'Maintain nutrition'],
    'Mental Health': ['Practice deep breathing', 'Talk to someone you trust', 'Maintain sleep schedule', 'Avoid alcohol/drugs'],
    'Infections': ['Isolate if contagious', 'Complete antibiotic course', 'Rest adequately', 'Drink plenty of fluids']
  };
  return tips[category] || ['Get adequate rest', 'Stay hydrated', 'Monitor your symptoms', 'Consult a doctor if symptoms worsen'];
};

const categoryToSpecialty = {
  'Heart': 'Cardiology',
  'Brain & Nerves': 'Neurology',
  'Bones & Joints': 'Orthopedics',
  'Cancer': 'Oncology',
  'Kidney & Urinary': 'Nephrology',
  'Liver & Stomach': 'Gastroenterology',
  'Lungs & Breathing': 'Pulmonology',
  'Diabetes & Hormones': 'Endocrinology',
  'Eye': 'Ophthalmology',
  'Ear, Nose, Throat': 'ENT',
  'Skin': 'Dermatology',
  'Women Health': 'Gynecology',
  'Children': 'Pediatrics',
  'Mental Health': 'Psychiatry',
  'Infections': 'Infectious Disease'
};

const ruleBasedAnalysis = (symptoms) => {
  const s = symptoms.toLowerCase();
  let bestMatch = null;
  let highestScore = 0;

  // ============================================
  // EMERGENCY DETECTION (Check FIRST)
  // ============================================
  const emergencyPatterns = [
    { pattern: /chest pain.*severe|heart attack|cardiac arrest/i, msg: 'Possible cardiac emergency', specialty: 'Cardiology' },
    { pattern: /difficulty breathing|can'?t breathe|suffocat|severe breathlessness/i, msg: 'Respiratory emergency', specialty: 'Pulmonology' },
    { pattern: /heavy bleeding|bleeding profusely|blood loss|hemorrhage/i, msg: 'Hemorrhagic emergency', specialty: 'Emergency Medicine' },
    { pattern: /unconscious|passed out|fainted|collapse|not responding/i, msg: 'Loss of consciousness', specialty: 'Emergency Medicine' },
    { pattern: /seizure|convulsion|fitting|epileptic attack/i, msg: 'Neurological emergency', specialty: 'Neurology' },
    { pattern: /stroke|face drooping|slurred speech|paralysis sudden|one side weak/i, msg: 'Possible stroke', specialty: 'Neurology' },
    { pattern: /suicidal|kill myself|end my life|want to die|self harm/i, msg: 'Psychiatric emergency', specialty: 'Psychiatry' },
    { pattern: /severe burn|third degree|chemical burn|extensive burn/i, msg: 'Burn emergency', specialty: 'Emergency Medicine' },
    { pattern: /poison|overdose|toxic ingestion|snake bite|dog bite rabies/i, msg: 'Poisoning emergency', specialty: 'Emergency Medicine' },
    { pattern: /accident.*major|car crash|fell from height|head injury severe/i, msg: 'Trauma emergency', specialty: 'Emergency Medicine' },
    { pattern: /not breathing|no pulse|cpr|cardiac arrest/i, msg: 'Cardiac arrest - CPR needed', specialty: 'Emergency Medicine' },
    { pattern: /severe allergic|anaphylaxis|throat swelling|face swelling sudden/i, msg: 'Severe allergic reaction', specialty: 'Emergency Medicine' },
  ];

  for (const emergency of emergencyPatterns) {
    if (emergency.pattern.test(s)) {
      return {
        isEmergency,
        emergencyReason.msg,
        action: '🚨 Call 108 or visit nearest Emergency Room IMMEDIATELY.',
        specialty.specialty,
        confidence: 'Critical',
        method: 'rule-based-emergency',
        possibleConditions: [emergency.msg],
        healthTips: ['Do not delay - seek emergency care now', 'Keep patient calm and still'],
        urgencyLevel: 'immediate'
      };
    }
  }

  // ============================================
  // DISEASE MATCHING from Medical Master Data
  // ============================================
  
  for (const [category, diseaseList] of Object.entries(MEDICAL_MASTER_DATA.diseases)) {
    for (const disease of diseaseList) {
      let score = 0;
      
      // Check each keyword
      for (const keyword of disease.keywords) {
        if (s.includes(keyword.toLowerCase())) {
          score += keyword.length; // Longer keyword = better match
        }
      }
      
      // Check disease name (higher weight)
      if (s.includes(disease.label.toLowerCase())) {
        score += 25;
      }
      
      if (score > highestScore) {
        highestScore = score;
        bestMatch = { disease, category, score };
      }
    }
  }

  // ============================================
  // PROCEDURE MATCHING
  // ============================================
  
  if (!bestMatch || highestScore < 5) {
    for (const procedure of MEDICAL_MASTER_DATA.procedures) {
      if (s.includes(procedure.label.toLowerCase())) {
        const procToSpecialty = {
          'Heart': 'Cardiology',
          'Bones': 'Orthopedics',
          'General Surgery': 'General Surgery',
          'Women': 'Gynecology',
          'Cancer': 'Oncology',
          'Kidney': 'Nephrology',
          'Eye': 'Ophthalmology',
          'Diagnostics': 'Radiology'
        };
        
        bestMatch = {
          disease: { label.label, keywords: [procedure.label] },
          category.category,
          score: 15
        };
        highestScore = 15;
        break;
      }
    }
  }

  // ============================================
  // SPECIALTY MATCHING (Direct)
  // ============================================
  
  if (!bestMatch || highestScore < 3) {
    for (const specialty of MEDICAL_MASTER_DATA.specialties) {
      const specialtyKeywords = specialty.label.toLowerCase().replace(/[^\w\s]/g, '').split(' ');
      for (const word of specialtyKeywords) {
        if (word.length > 3 && s.includes(word)) {
          if (!bestMatch || 5 > highestScore) {
            bestMatch = {
              disease: { label.label, keywords: [specialty.label] },
              category.category,
              score: 5
            };
            highestScore = 5;
          }
        }
      }
    }
  }

  // ============================================
  // RETURN RESULT
  // ============================================

  if (bestMatch && highestScore >= 3) {
    const specialty = categoryToSpecialty[bestMatch.category] || 'General Medicine';
    
    return {
      isEmergency,
      specialty,
      confidence>= 20 ? 'High' >= 10 ? 'Medium' : 'Low',
      method: 'rule-based-masterdata',
      possibleConditions: [bestMatch.disease.label],
      matchedCategory.category,
      matchedKeywords.disease.keywords?.filter(k => s.includes(k.toLowerCase())) || [],
      healthTips(bestMatch.category),
      urgencyLevel>= 20 ? 'within24h' : 'within3days'
    };
  }

  // Nothing matched
  return {
    isEmergency,
    specialty: 'General Medicine',
    confidence: 'Low',
    method: 'rule-based-default',
    possibleConditions: ['Unspecified - needs evaluation'],
    message: 'Please consult a General Physician for initial evaluation.',
    healthTips: ['Keep track of your symptoms', 'Note when symptoms started', 'Stay hydrated'],
    urgencyLevel: 'routine'
  };
};

// ============================================
// BUILD PROMPTS FOR AI
// ============================================

const buildTriagePrompt = (symptoms) => {
  return `You are a medical triage AI for an Indian healthcare platform called HealthCare Hub. Analyze the patient's symptoms and recommend the appropriate medical specialist.

PATIENT SYMPTOMS: "${symptoms}"

Return ONLY this JSON structure:
{
  "isEmergency"or false,
  "emergencyReason": "brief reason if emergency, otherwise empty string",
  "specialty": "recommended medical specialist (use standard Indian medical terminology)",
  "confidence": "High, Medium, or Low",
  "possibleConditions": ["most likely condition", "other possibility"],
  "healthTips": ["practical actionable tip 1", "tip 2"],
  "urgencyLevel": "immediate, within24h, within3days, or routine",
  "recommendedTests": ["relevant test 1 if applicable", "test 2"],
  "additionalNotes": "brief helpful note for the patient"
}

RULES:
- If life-threatening (heart attack, stroke, severe bleeding, suicidal) → isEmergency, urgencyLevel: "immediate"
- Consider common Indian diseases, malaria, typhoid, tuberculosis, chikungunya
- Be conservativeunsure, recommend "General Medicine"
- Health tips should be culturally relevant to Indian patients
- Use Indian medical terminology where appropriate
- If symptoms suggest multiple possible conditions, list them`;
};

const buildSmartSearchPrompt = (query) => {
  return `You are a healthcare search assistant for HealthCare Hub, an Indian healthcare platform. Analyze this user query and determine their intent.

USER QUERY: "${query}"

Available services on HealthCare Hub:
- Online Doctor Consultation (video/audio)
- Hospital Search & OPD Booking
- Emergency Ambulance
- Lab Tests & Health Packages
- Health Insurance
- Ayurveda, Homeopathy, Mental Wellness
- Home Care / Caregivers
- Health EMI / Financing

Return ONLY this JSON:
{
  "intent": "symptom_check or find_doctor or find_hospital or book_ambulance or book_lab_test or insurance or ayurveda or homeopathy or mental_health or home_care or health_emi or general_info or emergency",
  "extractedSpecialty": "medical specialty if mentioned, else empty string",
  "extractedLocation": "city or area if mentioned, else empty string",
  "extractedDoctorName": "doctor name if mentioned, else empty string",
  "isEmergency"or false,
  "suggestedAction": "brief 1-line suggestion for the user",
  "routeTo": "triage or doctor-search or hospital-search or ambulance or diagnostics or insurance or ayurveda or homeopathy or mental-health or home-care or financing"
}`;
};

// ============================================
// MAIN AI FUNCTION — With Multi-Layer Fallback
// ============================================

const analyzeWithAI = async (query, type = 'triage') => {
  const cacheKey = `${type}:${query.toLowerCase().trim()}`;
  
  // Check cache
  const cached = getCached(cacheKey);
  if (cached) {
    return { ...cached, fromCache};
  }

  // Build prompt
  const prompt = type === 'triage' 
    ? buildTriagePrompt(query)
    (query);

  let result = null;

  // Layer 1Groq (Fastest, FREE)
  if (GROQ_API_KEY) {
    result = await callGroq(prompt);
    if (result) {
      result.method = 'groq-llama3';
      setCache(cacheKey, result);
      return result;
    }
  }

  // Layer 2Gemini (Fallback, FREE)
  if (GEMINI_API_KEY) {
    result = await callGemini(prompt);
    if (result) {
      result.method = 'gemini-flash';
      setCache(cacheKey, result);
      return result;
    }
  }

  // Layer 3-based with Medical Master Data (Always available)
  result = ruleBasedAnalysis(query);
  result.method = 'rule-based-masterdata';
  setCache(cacheKey, result);
  return result;
};

// ============================================
// PUBLIC FUNCTIONS
// ============================================

// For Online Doctor Triage
const triageForOnlineDoctor = async (symptoms) => {
  const result = await analyzeWithAI(symptoms, 'triage');
  
  return {
    success,
    ...result,
    disclaimer: 'This is AI-assisted triage. Always consult a qualified doctor for accurate diagnosis.',
    timestampDate().toISOString()
  };
};

// For Smart Search (Main Page + Online Doctor Hub)
const smartSearch = async (query) => {
  const result = await analyzeWithAI(query, 'search');
  
  return {
    success,
    ...result,
    originalQuery,
    timestampDate().toISOString()
  };
};

// For Hospital Search
const triageForHospital = async (symptoms, location = '') => {
  const result = await analyzeWithAI(symptoms, 'triage');
  
  return {
    success,
    ...result,
    location|| 'Not specified',
    hospitalSearchQuery: `${result.specialty} hospital ${location}`.trim(),
    timestampDate().toISOString()
  };
};

// For Emergency Detection (Quick check only)
const quickEmergencyCheck = (symptoms) => {
  return ruleBasedAnalysis(symptoms);
};

// ============================================
// CACHE MANAGEMENT
// ============================================

const clearCache = () => {
  const size = cache.size;
  cache.clear();
  return { success, message: `Cleared ${size} cached entries` };
};

const getCacheStats = () => {
  return {
    size.size,
    maxSize: 500,
    ttlMinutes_TTL / 60000
  };
};

// ============================================
// HEALTH CHECK
// ============================================

const healthCheck = async () => {
  const status = {
    groq_API_KEY ? 'configured' : 'not-configured',
    gemini_API_KEY ? 'configured' : 'not-configured',
    ruleBased: 'available (300+ keywords)',
    masterData_MASTER_DATA ? 'loaded' : 'not-found',
    cache(),
    timestampDate().toISOString()
  };

  // Test Groq if configured
  if (GROQ_API_KEY) {
    try {
      const test = await callGroq('Reply with EXACTLY: {"status":"ok"}');
      status.groq = test?.status === 'ok' ? 'working' : 'error-response';
    } catch {
      status.groq = 'error-connection';
    }
  }

  return status;
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Main public functions
  triageForOnlineDoctor,
  smartSearch,
  triageForHospital,
  quickEmergencyCheck,
  
  // Direct access (for testing/debugging)
  analyzeWithAI,
  callGroq,
  callGemini,
  ruleBasedAnalysis,
  
  // Management
  clearCache,
  getCacheStats,
  healthCheck
}; 



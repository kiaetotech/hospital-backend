// ============================================
// COMPLETE MEDICAL MASTER DATA
// Diseases, Procedures, Specialties - All Categories
// ============================================

const MEDICAL_MASTER_DATA = {
  specialties: [
    { value: 'cardiology', label: '🫀 Cardiology', category: 'Heart' },
    { value: 'neurology', label: '🧠 Neurology', category: 'Brain' },
    { value: 'neurosurgery', label: '🔬 Neurosurgery', category: 'Brain' },
    { value: 'orthopedics', label: '🦴 Orthopedics', category: 'Bones' },
    { value: 'oncology', label: '🎗️ Oncology', category: 'Cancer' },
    { value: 'nephrology', label: '🫘 Nephrology', category: 'Kidney' },
    { value: 'urology', label: '💧 Urology', category: 'Kidney' },
    { value: 'gastroenterology', label: '🔬 Gastroenterology', category: 'Stomach' },
    { value: 'pulmonology', label: '🫁 Pulmonology', category: 'Lungs' },
    { value: 'endocrinology', label: '🦋 Endocrinology', category: 'Hormones' },
    { value: 'diabetology', label: '💉 Diabetology', category: 'Diabetes' },
    { value: 'dermatology', label: '🧴 Dermatology', category: 'Skin' },
    { value: 'ophthalmology', label: '👁️ Ophthalmology', category: 'Eye' },
    { value: 'ent', label: '👂 ENT', category: 'Ear/Nose/Throat' },
    { value: 'dentistry', label: '🦷 Dentistry', category: 'Dental' },
    { value: 'gynecology', label: '🤰 Gynecology', category: 'Women' },
    { value: 'obstetrics', label: '👶 Obstetrics', category: 'Women' },
    { value: 'pediatrics', label: '👶 Pediatrics', category: 'Children' },
    { value: 'neonatology', label: '🍼 Neonatology', category: 'Children' },
    { value: 'psychiatry', label: '🧠 Psychiatry', category: 'Mental' },
    { value: 'psychology', label: '💭 Psychology', category: 'Mental' },
    { value: 'rheumatology', label: '🦿 Rheumatology', category: 'Joints' },
    { value: 'hematology', label: '🩸 Hematology', category: 'Blood' },
    { value: 'immunology', label: '🛡️ Immunology', category: 'Immune' },
    { value: 'infectious_disease', label: '🦠 Infectious Disease', category: 'Infections' },
    { value: 'plastic_surgery', label: '🔧 Plastic Surgery', category: 'Surgery' },
    { value: 'vascular_surgery', label: '💉 Vascular Surgery', category: 'Surgery' },
    { value: 'general_surgery', label: '🏥 General Surgery', category: 'Surgery' },
    { value: 'anesthesiology', label: '💤 Anesthesiology', category: 'Surgery' },
    { value: 'radiology', label: '🖥️ Radiology', category: 'Diagnostics' },
    { value: 'pathology', label: '🔬 Pathology', category: 'Diagnostics' },
    { value: 'emergency_medicine', label: '🚨 Emergency Medicine', category: 'Emergency' },
    { value: 'critical_care', label: '🏥 Critical Care', category: 'Emergency' },
    { value: 'physiotherapy', label: '💪 Physiotherapy', category: 'Rehab' },
    { value: 'occupational_therapy', label: '🖐️ Occupational Therapy', category: 'Rehab' },
    { value: 'speech_therapy', label: '🗣️ Speech Therapy', category: 'Rehab' },
    { value: 'dietetics', label: '🥗 Dietetics/Nutrition', category: 'Wellness' },
    { value: 'ayurveda', label: '🌿 Ayurveda', category: 'AYUSH' },
    { value: 'homeopathy', label: '💊 Homeopathy', category: 'AYUSH' },
    { value: 'yoga_therapy', label: '🧘 Yoga Therapy', category: 'AYUSH' }
  ],

  diseases: {
    'Heart': [
      { value: 'coronary_artery_disease', label: 'Coronary Artery Disease', keywords: ['heart blockage', 'angiogram', 'chest pain'] },
      { value: 'heart_attack', label: 'Heart Attack (MI)', keywords: ['heart attack', 'myocardial infarction'] },
      { value: 'heart_failure', label: 'Heart Failure', keywords: ['weak heart', 'pump failure', 'breathlessness'] },
      { value: 'arrhythmia', label: 'Arrhythmia', keywords: ['irregular heartbeat', 'palpitations', 'afib'] },
      { value: 'valve_disease', label: 'Valve Heart Disease', keywords: ['valve problem', 'valve replacement', 'leaky valve'] },
      { value: 'hypertension', label: 'Hypertension', keywords: ['high blood pressure', 'bp'] },
      { value: 'congenital_heart', label: 'Congenital Heart Disease', keywords: ['hole in heart', 'birth heart defect'] },
      { value: 'cardiomyopathy', label: 'Cardiomyopathy', keywords: ['enlarged heart', 'thick heart muscle'] }
    ],
    'Brain & Nerves': [
      { value: 'stroke', label: 'Stroke', keywords: ['brain attack', 'paralysis', 'brain hemorrhage'] },
      { value: 'epilepsy', label: 'Epilepsy', keywords: ['fits', 'seizures', 'convulsions'] },
      { value: 'migraine', label: 'Migraine', keywords: ['severe headache', 'one sided headache'] },
      { value: 'parkinson', label: 'Parkinson\'s Disease', keywords: ['shaking', 'tremors', 'stiffness'] },
      { value: 'alzheimer', label: 'Alzheimer\'s Disease', keywords: ['memory loss', 'forgetfulness', 'dementia'] },
      { value: 'multiple_sclerosis', label: 'Multiple Sclerosis', keywords: ['ms', 'nerve damage'] },
      { value: 'brain_tumor', label: 'Brain Tumor', keywords: ['brain cancer', 'tumor in head'] },
      { value: 'neuropathy', label: 'Neuropathy', keywords: ['nerve pain', 'tingling', 'numbness'] }
    ],
    'Bones & Joints': [
      { value: 'arthritis', label: 'Arthritis', keywords: ['joint pain', 'knee pain', 'swelling'] },
      { value: 'osteoarthritis', label: 'Osteoarthritis', keywords: ['wear and tear', 'old age joint pain'] },
      { value: 'rheumatoid_arthritis', label: 'Rheumatoid Arthritis', keywords: ['ra', 'autoimmune joint'] },
      { value: 'osteoporosis', label: 'Osteoporosis', keywords: ['weak bones', 'bone loss', 'calcium'] },
      { value: 'fracture', label: 'Fracture', keywords: ['broken bone', 'crack', 'cast'] },
      { value: 'back_pain', label: 'Back Pain / Slip Disc', keywords: ['spine pain', 'disc bulge', 'sciatica'] },
      { value: 'sciatica', label: 'Sciatica', keywords: ['leg pain from back', 'nerve compression'] },
      { value: 'spondylitis', label: 'Spondylitis', keywords: ['neck pain', 'ankylosing'] },
      { value: 'gout', label: 'Gout', keywords: ['uric acid', 'big toe pain', 'swollen toe'] }
    ],
    'Cancer': [
      { value: 'breast_cancer', label: 'Breast Cancer', keywords: ['lump in breast', 'mammogram'] },
      { value: 'lung_cancer', label: 'Lung Cancer', keywords: ['cough blood', 'smoking cancer'] },
      { value: 'oral_cancer', label: 'Oral Cancer', keywords: ['mouth cancer', 'tobacco cancer'] },
      { value: 'cervical_cancer', label: 'Cervical Cancer', keywords: ['pap smear', 'hpv'] },
      { value: 'prostate_cancer', label: 'Prostate Cancer', keywords: ['psa', 'urine problem'] },
      { value: 'blood_cancer', label: 'Blood Cancer (Leukemia)', keywords: ['leukemia', 'lymphoma', 'myeloma'] },
      { value: 'colon_cancer', label: 'Colon Cancer', keywords: ['colorectal', 'blood in stool'] },
      { value: 'liver_cancer', label: 'Liver Cancer', keywords: ['hcc', 'hepatocellular'] },
      { value: 'skin_cancer', label: 'Skin Cancer', keywords: ['melanoma', 'mole change'] }
    ],
    'Kidney & Urinary': [
      { value: 'kidney_stones', label: 'Kidney Stones', keywords: ['renal stone', 'painful urination'] },
      { value: 'kidney_failure', label: 'Kidney Failure', keywords: ['dialysis', 'renal failure', 'ckd'] },
      { value: 'uti', label: 'Urinary Tract Infection', keywords: ['uti', 'burning urine', 'frequent urination'] },
      { value: 'prostate_enlargement', label: 'Prostate Enlargement (BPH)', keywords: ['bph', 'urine flow', 'frequent night'] },
      { value: 'nephritis', label: 'Nephritis', keywords: ['kidney inflammation'] }
    ],
    'Liver & Stomach': [
      { value: 'hepatitis', label: 'Hepatitis', keywords: ['jaundice', 'liver infection', 'hep b'] },
      { value: 'cirrhosis', label: 'Liver Cirrhosis', keywords: ['liver damage', 'alcohol liver'] },
      { value: 'fatty_liver', label: 'Fatty Liver', keywords: ['nafld', 'liver fat'] },
      { value: 'gerd', label: 'GERD / Acidity', keywords: ['acid reflux', 'heartburn', 'gas'] },
      { value: 'ulcer', label: 'Peptic Ulcer', keywords: ['stomach ulcer', 'duodenal ulcer'] },
      { value: 'hernia', label: 'Hernia', keywords: ['inguinal', 'umbilical', 'bulge'] },
      { value: 'appendicitis', label: 'Appendicitis', keywords: ['appendix pain', 'right side pain'] },
      { value: 'gallstones', label: 'Gallstones', keywords: ['gallbladder stone', 'biliary'] },
      { value: 'ibs', label: 'Irritable Bowel Syndrome', keywords: ['ibs', 'stomach cramps', 'diarrhea constipation'] }
    ],
    'Lungs & Breathing': [
      { value: 'asthma', label: 'Asthma', keywords: ['wheezing', 'inhaler', 'breathing difficulty'] },
      { value: 'copd', label: 'COPD', keywords: ['chronic bronchitis', 'emphysema', 'smoker cough'] },
      { value: 'tuberculosis', label: 'Tuberculosis (TB)', keywords: ['tb', 'cough blood', 'night sweats'] },
      { value: 'pneumonia', label: 'Pneumonia', keywords: ['chest infection', 'lung infection'] },
      { value: 'sleep_apnea', label: 'Sleep Apnea', keywords: ['snoring', 'stop breathing sleep'] },
      { value: 'allergy', label: 'Allergies', keywords: ['sneezing', 'dust allergy', 'pollen'] },
      { value: 'sinusitis', label: 'Sinusitis', keywords: ['sinus', 'blocked nose', 'facial pain'] }
    ],
    'Diabetes & Hormones': [
      { value: 'diabetes_type1', label: 'Diabetes Type 1', keywords: ['juvenile diabetes', 'insulin dependent'] },
      { value: 'diabetes_type2', label: 'Diabetes Type 2', keywords: ['sugar', 'high glucose', 'hba1c'] },
      { value: 'thyroid', label: 'Thyroid Disorders', keywords: ['hypothyroid', 'hyperthyroid', 'tsh'] },
      { value: 'pcos', label: 'PCOS', keywords: ['polycystic ovary', 'irregular periods', 'facial hair'] },
      { value: 'obesity', label: 'Obesity', keywords: ['weight loss', 'bariatric', 'overweight'] },
      { value: 'vitamin_deficiency', label: 'Vitamin Deficiency', keywords: ['vitamin d', 'b12', 'anemia'] }
    ],
    'Eye': [
      { value: 'cataract', label: 'Cataract', keywords: ['cloudy vision', 'lens replacement'] },
      { value: 'glaucoma', label: 'Glaucoma', keywords: ['eye pressure', 'vision loss'] },
      { value: 'refractive_error', label: 'Refractive Error', keywords: ['glasses', 'myopia', 'hyperopia'] },
      { value: 'conjunctivitis', label: 'Conjunctivitis', keywords: ['pink eye', 'eye infection'] }
    ],
    'Ear, Nose, Throat': [
      { value: 'tonsillitis', label: 'Tonsillitis', keywords: ['tonsils', 'sore throat', 'throat pain'] },
      { value: 'ear_infection', label: 'Ear Infection', keywords: ['ear pain', 'otitis', 'ear discharge'] },
      { value: 'hearing_loss', label: 'Hearing Loss', keywords: ['deafness', 'hearing aid'] },
      { value: 'vertigo', label: 'Vertigo', keywords: ['dizziness', 'spinning', 'balance'] }
    ],
    'Skin': [
      { value: 'psoriasis', label: 'Psoriasis', keywords: ['scaly skin', 'red patches'] },
      { value: 'eczema', label: 'Eczema', keywords: ['dermatitis', 'itchy skin', 'dry skin'] },
      { value: 'acne', label: 'Acne', keywords: ['pimples', 'breakouts', 'oily skin'] },
      { value: 'fungal_infection', label: 'Fungal Infection', keywords: ['ringworm', 'athlete foot'] }
    ],
    'Women Health': [
      { value: 'pregnancy', label: 'Pregnancy Care', keywords: ['antenatal', 'delivery', 'normal delivery'] },
      { value: 'infertility', label: 'Infertility', keywords: ['ivf', 'not conceiving', 'fertility'] },
      { value: 'menopause', label: 'Menopause', keywords: ['hot flashes', 'periods stopped'] },
      { value: 'fibroids', label: 'Uterine Fibroids', keywords: ['uterine tumor', 'heavy bleeding'] },
      { value: 'endometriosis', label: 'Endometriosis', keywords: ['painful periods', 'pelvic pain'] }
    ],
    'Children': [
      { value: 'fever', label: 'Fever in Children', keywords: ['baby fever', 'child temperature'] },
      { value: 'vaccination', label: 'Vaccination', keywords: ['immunization', 'baby shots'] },
      { value: 'growth_delay', label: 'Growth & Development', keywords: ['child not growing', 'milestones'] },
      { value: 'asthma_child', label: 'Childhood Asthma', keywords: ['child wheezing', 'pediatric asthma'] }
    ],
    'Mental Health': [
      { value: 'depression', label: 'Depression', keywords: ['sad', 'no interest', 'suicidal'] },
      { value: 'anxiety', label: 'Anxiety', keywords: ['panic', 'worry', 'nervousness'] },
      { value: 'bipolar', label: 'Bipolar Disorder', keywords: ['mood swings', 'mania'] },
      { value: 'ocd', label: 'OCD', keywords: ['obsessive', 'compulsive', 'repeated actions'] },
      { value: 'addiction', label: 'Addiction', keywords: ['alcohol', 'drugs', 'deaddiction'] }
    ],
    'Infections': [
      { value: 'dengue', label: 'Dengue', keywords: ['platelets', 'mosquito fever'] },
      { value: 'malaria', label: 'Malaria', keywords: ['chills', 'rigors', 'mosquito'] },
      { value: 'typhoid', label: 'Typhoid', keywords: ['typhoid fever', 'widal test'] },
      { value: 'covid19', label: 'COVID-19', keywords: ['corona', 'rtpcr', 'oxygen drop'] },
      { value: 'hiv', label: 'HIV/AIDS', keywords: ['hiv test', 'cd4', 'antiretroviral'] }
    ]
  },

  procedures: [
    // Heart
    { value: 'angioplasty', label: 'Angioplasty (Stent)', category: 'Heart' },
    { value: 'cabg', label: 'Bypass Surgery (CABG)', category: 'Heart' },
    { value: 'pacemaker', label: 'Pacemaker Implantation', category: 'Heart' },
    { value: 'valve_replacement', label: 'Valve Replacement', category: 'Heart' },
    { value: 'angiography', label: 'Coronary Angiography', category: 'Heart' },
    
    // Bones
    { value: 'knee_replacement', label: 'Knee Replacement', category: 'Bones' },
    { value: 'hip_replacement', label: 'Hip Replacement', category: 'Bones' },
    { value: 'spine_surgery', label: 'Spine Surgery', category: 'Bones' },
    { value: 'arthroscopy', label: 'Arthroscopy', category: 'Bones' },
    { value: 'fracture_fixation', label: 'Fracture Fixation', category: 'Bones' },
    
    // General Surgery
    { value: 'appendectomy', label: 'Appendix Removal', category: 'General Surgery' },
    { value: 'cholecystectomy', label: 'Gallbladder Removal', category: 'General Surgery' },
    { value: 'hernia_repair', label: 'Hernia Repair', category: 'General Surgery' },
    { value: 'hysterectomy', label: 'Hysterectomy', category: 'Women' },
    { value: 'csection', label: 'C-Section Delivery', category: 'Women' },
    { value: 'normal_delivery', label: 'Normal Delivery', category: 'Women' },
    
    // Cancer
    { value: 'chemotherapy', label: 'Chemotherapy', category: 'Cancer' },
    { value: 'radiation', label: 'Radiation Therapy', category: 'Cancer' },
    { value: 'mastectomy', label: 'Mastectomy', category: 'Cancer' },
    
    // Kidney
    { value: 'dialysis', label: 'Dialysis', category: 'Kidney' },
    { value: 'kidney_transplant', label: 'Kidney Transplant', category: 'Kidney' },
    { value: 'lithotripsy', label: 'Kidney Stone Removal', category: 'Kidney' },
    
    // Eye
    { value: 'cataract_surgery', label: 'Cataract Surgery', category: 'Eye' },
    { value: 'lasik', label: 'LASIK Eye Surgery', category: 'Eye' },
    
    // Others
    { value: 'endoscopy', label: 'Endoscopy', category: 'Diagnostics' },
    { value: 'colonoscopy', label: 'Colonoscopy', category: 'Diagnostics' },
    { value: 'bronchoscopy', label: 'Bronchoscopy', category: 'Diagnostics' },
    { value: 'biopsy', label: 'Biopsy', category: 'Diagnostics' },
    { value: 'mri', label: 'MRI Scan', category: 'Diagnostics' },
    { value: 'ct_scan', label: 'CT Scan', category: 'Diagnostics' },
    { value: 'ultrasound', label: 'Ultrasound', category: 'Diagnostics' }
  ]
};

module.exports = MEDICAL_MASTER_DATA;
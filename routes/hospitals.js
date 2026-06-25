const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const Hospital = require('../models/Hospital');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Multer config for Excel upload
const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ============================================
// STATIC ROUTES (Must be before /:id)
// ============================================

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    module: 'Hospitals',
    status: 'active',
    features: {
      search: '/api/hospitals/search',
      details: '/api/hospitals/:id',
      bedUpdate: '/api/hospitals/:id/bed-status',
      whatsappUpdate: '/api/hospitals/whatsapp-update',
      excelUpload: '/api/hospitals/:id/upload-doctors',
      template: '/api/hospitals/template/download',
      schemeFilter: '/api/hospitals/search?scheme=ayushman',
      insuranceFilter: '/api/hospitals/search?insurance=star'
    }
  });
});

// Search hospitals with advanced filters
router.get('/search', async (req, res) => {
  try {
    const { 
      q, city, state, lat, lng, radius = 50,
      scheme, insurance, cashless,
      emergency, beds_available, min_rating,
      facility, accreditation, specialty,
      opd_fee_min, opd_fee_max,
      sort = 'relevance', page = 1, limit = 10 
    } = req.query;

    const query = {};

    // Text search on disease, specialty, hospital name
    if (q && q.trim() !== '') {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { diseases_treated: { $regex: q, $options: 'i' } },
        { specialties: { $regex: q, $options: 'i' } },
        { 'doctors.specialization': { $regex: q, $options: 'i' } }
      ];
    }

    // Location filter
    if (city) {
      query['address.city'] = { $regex: city, $options: 'i' };
    }
    if (state) {
      query['address.state'] = { $regex: state, $options: 'i' };
    }

    // Geospatial search
    if (lat && lng) {
      query.location = {
        $near: {
          $geometry: { 
            type: 'Point', 
            coordinates: [parseFloat(lng), parseFloat(lat)] 
          },
          $maxDistance: parseFloat(radius) * 1000
        }
      };
    }

    // Government schemes filter
    if (scheme) {
      query['schemes_accepted'] = { $in: [scheme.toLowerCase()] };
    }

    // Insurance filter
    if (insurance) {
      query['insurance_accepted'] = { $regex: insurance, $options: 'i' };
    }

    // Cashless filter
    if (cashless === 'true') {
      query.cashless_available = true;
    }

    // Emergency filter
    if (emergency === 'true') {
      query.has24x7ER = true;
    }

    // Beds available filter
    if (beds_available === 'true') {
      query['beds.available'] = { $gt: 0 };
    }

    // Minimum rating filter
    if (min_rating) {
      query['ratings.average'] = { $gte: parseFloat(min_rating) };
    }

    // Facility filter
    if (facility) {
      query.facilities = { $in: [facility] };
    }

    // Accreditation filter
    if (accreditation) {
      query.accreditations = { $in: [accreditation.toUpperCase()] };
    }

    // Specialty filter
    if (specialty) {
      query.specialties = { $regex: specialty, $options: 'i' };
    }

    // OPD fee range filter
    if (opd_fee_min || opd_fee_max) {
      query['pricing.consultation'] = {};
      if (opd_fee_min) query['pricing.consultation'].$gte = parseFloat(opd_fee_min);
      if (opd_fee_max) query['pricing.consultation'].$lte = parseFloat(opd_fee_max);
    }

    // Sort logic
    let sortQuery = {};
    switch(sort) {
      case 'distance':
        if (!lat || !lng) sortQuery = { 'ratings.average': -1 };
        break;
      case 'fee':
        sortQuery = { 'pricing.consultation': 1 };
        break;
      case 'rating':
        sortQuery = { 'ratings.average': -1 };
        break;
      case 'beds':
        sortQuery = { 'beds.available': -1 };
        break;
      case 'reviews':
        sortQuery = { 'ratings.count': -1 };
        break;
      default:
        sortQuery = { 'activity_score': -1, 'ratings.average': -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [hospitals, total] = await Promise.all([
      Hospital.find(query)
        .sort(sortQuery)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v')
        .lean(),
      Hospital.countDocuments(query)
    ]);

    let hospitalsWithDistance = hospitals;
    if (lat && lng && query.location?.$near) {
      hospitalsWithDistance = hospitals.map(h => ({
        ...h,
        distance: h.distance || null
      }));
    }

    res.json({
      success: true,
      data: hospitalsWithDistance,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalHospitals: total,
        perPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, message: 'Search failed', error: error.message });
  }
});

// WhatsApp bed update webhook (Public)
router.post('/whatsapp-update', async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    const parsedData = parseWhatsAppMessage(message);
    
    if (!parsedData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid format. Send: BEDS [total] AVL [available] ICU [icu_beds] VENT [ventilators] ER [OPEN/CLOSED]' 
      });
    }

    const hospital = await Hospital.findOne({ 'contact.phone': phone });
    
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found with this phone number' });
    }

    hospital.beds = {
      ...hospital.beds.toObject(),
      total: parsedData.total || hospital.beds.total,
      available: parsedData.available || hospital.beds.available,
      icu_available: parsedData.icu || hospital.beds.icu_available,
      ventilator_available: parsedData.ventilator || hospital.beds.ventilator_available,
      emergency_open: parsedData.emergency,
      last_updated: new Date(),
      update_method: 'whatsapp',
      auto_expire_at: new Date(Date.now() + 4 * 60 * 60 * 1000)
    };

    hospital.activity_score = calculateActivityScore(hospital);
    
    await hospital.save();

    res.json({ 
      success: true, 
      message: `✅ Updated! Beds:${hospital.beds.total}, Available:${hospital.beds.available}, ICU:${hospital.beds.icu_available}` 
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Download Excel template
router.get('/template/download', authenticateToken, authorizeRoles('hospital', 'admin'), (req, res) => {
  const template = [
    {
      'Doctor Name': 'Dr. Example',
      'Specialization': 'Cardiologist',
      'Qualification': 'MBBS, MD (Cardiology)',
      'Experience (Years)': '15',
      'Consultation Fee (₹)': '1200',
      'Languages': 'English, Hindi',
      'Gender': 'Male',
      'Available Days': 'Mon, Tue, Wed, Thu, Fri',
      'Morning Slots (HH:MM-HH:MM)': '09:00-13:00',
      'Evening Slots (HH:MM-HH:MM)': '17:00-20:00',
      'Max Patients Per Day': '20'
    }
  ];

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(template);
  
  const instructions = [
    { 'IMPORTANT INSTRUCTIONS': '' },
    { '': '1. Do not change column headers' },
    { '': '2. All fields are mandatory' },
    { '': '3. Specialization must match exactly with hospital specialties' }
  ];
  const wsInstructions = xlsx.utils.json_to_sheet(instructions);
  
  xlsx.utils.book_append_sheet(wb, ws, 'Doctors Template');
  xlsx.utils.book_append_sheet(wb, wsInstructions, 'Instructions');
  
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=hospital_doctors_template.xlsx');
  res.send(buffer);
});

// ============================================
// DYNAMIC ID ROUTES (Must be AFTER static routes)
// ============================================

// Get single hospital details
router.get('/:id', async (req, res) => {
  try {
    // Skip if 'id' is a known static route (safety check)
    if (['health', 'search', 'whatsapp-update', 'template'].includes(req.params.id)) {
      return next();
    }

    const hospital = await Hospital.findById(req.params.id)
      .select('-password')
      .lean();

    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    res.json({ success: true, data: hospital });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update bed status (Web portal)
router.put('/:id/bed-status', authenticateToken, authorizeRoles('hospital', 'admin'), async (req, res) => {
  try {
    const { beds, updateMethod } = req.body;
    
    const hospital = await Hospital.findById(req.params.id);
    
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    if (req.user.role === 'hospital' && hospital.userId && hospital.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    hospital.beds = {
      ...hospital.beds.toObject(),
      ...beds,
      last_updated: new Date(),
      update_method: updateMethod || 'web_portal',
      auto_expire_at: new Date(Date.now() + 4 * 60 * 60 * 1000)
    };

    hospital.activity_score = calculateActivityScore(hospital);
    
    await hospital.save();

    res.json({ 
      success: true, 
      message: 'Bed status updated successfully',
      data: hospital.beds 
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upload Excel - Bulk add/update doctors
router.post('/:id/upload-doctors', authenticateToken, authorizeRoles('hospital', 'admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an Excel file' });
    }

    const hospital = await Hospital.findById(req.params.id);
    
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    if (req.user.role === 'hospital' && hospital.userId && hospital.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const doctors = xlsx.utils.sheet_to_json(sheet);

    if (doctors.length === 0) {
      return res.status(400).json({ success: false, message: 'No doctors found in Excel file' });
    }

    const formattedDoctors = doctors.map((doc, index) => {
      if (!doc['Doctor Name'] || !doc['Specialization'] || !doc['Consultation Fee (₹)']) {
        throw new Error(`Row ${index + 2}: Doctor Name, Specialization, and Consultation Fee are required`);
      }

      return {
        name: doc['Doctor Name'],
        specialization: doc['Specialization'],
        qualification: doc['Qualification'] || '',
        experience: doc['Experience (Years)'] || '0',
        consultation_fee: parseFloat(doc['Consultation Fee (₹)']) || 0,
        languages: doc['Languages'] ? doc['Languages'].split(',').map(l => l.trim()) : [],
        gender: doc['Gender'] || 'Male',
        rating: 0,
        reviewCount: 0,
        availability: {
          status: 'available',
          slots_available: parseInt(doc['Max Patients Per Day']) || 20,
          days: doc['Available Days'] ? doc['Available Days'].split(',').map(d => d.trim()) : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          morning_slots: doc['Morning Slots (HH:MM-HH:MM)'] || '09:00-13:00',
          evening_slots: doc['Evening Slots (HH:MM-HH:MM)'] || '17:00-20:00',
          max_patients: parseInt(doc['Max Patients Per Day']) || 20
        }
      };
    });

    hospital.doctors = formattedDoctors;
    
    await hospital.save();

    res.json({ 
      success: true, 
      message: `✅ ${formattedDoctors.length} doctors uploaded successfully`,
      data: formattedDoctors
    });

  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Upload Excel - Update pricing and beds
router.post('/:id/upload-data', authenticateToken, authorizeRoles('hospital', 'admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an Excel file' });
    }

    const hospital = await Hospital.findById(req.params.id);
    
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    if (req.user.role === 'hospital' && hospital.userId && hospital.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    if (data.length > 0) {
      const row = data[0];
      
      if (row['Total Beds']) hospital.beds.total = parseInt(row['Total Beds']);
      if (row['Available Beds']) hospital.beds.available = parseInt(row['Available Beds']);
      if (row['ICU Beds']) hospital.beds.icu_available = parseInt(row['ICU Beds']);
      if (row['Ventilators']) hospital.beds.ventilator_total = parseInt(row['Ventilators']);
      if (row['OPD Fee (₹)']) hospital.pricing.consultation = parseFloat(row['OPD Fee (₹)']);
      if (row['ICU Per Day (₹)']) hospital.pricing.icu_bed_per_day = parseFloat(row['ICU Per Day (₹)']);
      if (row['General Ward (₹)']) hospital.pricing.general_bed_per_day = parseFloat(row['General Ward (₹)']);
      if (row['Semi-Private (₹)']) hospital.pricing.semi_private_per_day = parseFloat(row['Semi-Private (₹)']);
      if (row['Private Room (₹)']) hospital.pricing.private_per_day = parseFloat(row['Private Room (₹)']);
      if (row['Online Discount (%)']) hospital.pricing.online_booking_discount = parseFloat(row['Online Discount (%)']);
      
      hospital.beds.last_updated = new Date();
      hospital.beds.update_method = 'excel_upload';
      hospital.beds.auto_expire_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
      hospital.activity_score = calculateActivityScore(hospital);
      
      await hospital.save();
    }

    res.json({ 
      success: true, 
      message: 'Hospital data updated successfully from Excel',
      data: hospital
    });

  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseWhatsAppMessage(message) {
  try {
    const parts = message.toUpperCase().split(' ');
    const data = {};
    
    for (let i = 0; i < parts.length; i++) {
      switch(parts[i]) {
        case 'BEDS':
          data.total = parseInt(parts[i + 1]);
          break;
        case 'AVL':
          data.available = parseInt(parts[i + 1]);
          break;
        case 'ICU':
          data.icu = parseInt(parts[i + 1]);
          break;
        case 'VENT':
          data.ventilator = parseInt(parts[i + 1]);
          break;
        case 'ER':
          data.emergency = parts[i + 1] === 'OPEN';
          break;
      }
    }
    
    return data.total ? data : null;
  } catch (error) {
    return null;
  }
}

function calculateActivityScore(hospital) {
  const now = new Date();
  const lastBedUpdate = hospital.beds?.last_updated;
  
  if (!lastBedUpdate) return 0;
  
  const hoursSinceUpdate = (now - new Date(lastBedUpdate)) / (1000 * 60 * 60);
  
  let score = 100;
  
  if (hoursSinceUpdate > 24) score -= 60;
  else if (hoursSinceUpdate > 12) score -= 40;
  else if (hoursSinceUpdate > 4) score -= 20;
  else if (hoursSinceUpdate > 2) score -= 10;
  
  if (hospital.doctors?.length > 0) score += 10;
  if (hospital.schemes_accepted?.length > 0) score += 5;
  if (hospital.insurance_accepted?.length > 0) score += 5;
  
  return Math.max(0, Math.min(100, score));
}

module.exports = router;
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
  limits: { fileSize: 5 * 1024 * 1024 }
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
      medicalData: '/api/hospitals/medical-data',
      schemeFilter: '/api/hospitals/search?scheme=ayushman',
      insuranceFilter: '/api/hospitals/search?insurance=star',
      corporateToggle: '/api/hospitals/corporate/toggle',
      corporatePackages: '/api/hospitals/corporate/packages'
    }
  });
});

// Medical master data - MUST be before /:id
router.get('/medical-data', (req, res) => {
  try {
    const MEDICAL_MASTER_DATA = require('../data/medicalMasterData');
    res.json({
      success: true,
      data: {
        specialties: MEDICAL_MASTER_DATA.specialties,
        diseases: MEDICAL_MASTER_DATA.diseases,
        procedures: MEDICAL_MASTER_DATA.procedures
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Medical data unavailable' });
  }
});

// Search hospitals with advanced filters
router.get('/search', async (req, res) => {
  try {
    const { 
      q, city, state, lat, lng, radius = 50,
      scheme, insurance, cashless,
      emergency, beds_available, min_rating,
      facility, accreditation, specialty,
      disease, procedure,
      opd_fee_min, opd_fee_max,
      sort = 'relevance', page = 1, limit = 10 
    } = req.query;

    const query = {};

    if (q && q.trim() !== '') {
      const searchRegex = { $regex: q.trim(), $options: 'i' };
      query.$or = [
        { name: searchRegex },
        { diseases_treated: searchRegex },
        { specialties: searchRegex },
        { procedures_available: searchRegex },
        { 'doctors.name': searchRegex },
        { 'doctors.specialization': searchRegex }
      ];
    }

    if (city && city.trim() !== '') {
      query['address.city'] = { $regex: city.trim(), $options: 'i' };
    }

    if (state && state.trim() !== '') {
      query['address.state'] = { $regex: state.trim(), $options: 'i' };
    }

    // Geo search disabled - frontend calculates distance

    if (disease && disease.trim() !== '') {
      query.diseases_treated = { $regex: disease.trim(), $options: 'i' };
    }

    if (procedure && procedure.trim() !== '') {
      query.procedures_available = { $regex: procedure.trim(), $options: 'i' };
    }

    if (scheme && scheme.trim() !== '') {
      query['schemes_accepted'] = { $in: [scheme.trim().toLowerCase()] };
    }

    if (insurance && insurance.trim() !== '') {
      query['insurance_accepted'] = { $regex: insurance.trim(), $options: 'i' };
    }

    if (cashless === 'true') {
      query.cashless_available = true;
    }

    if (emergency === 'true') {
      query.has24x7ER = true;
    }

    if (beds_available === 'true') {
      query['beds.available'] = { $gt: 0 };
    }

    if (min_rating && !isNaN(parseFloat(min_rating))) {
      const rating = parseFloat(min_rating);
      if (rating > 0) {
        query['ratings.average'] = { $gte: rating };
      }
    }

    if (facility && facility.trim() !== '') {
      query['facilities.name'] = { $regex: facility.trim(), $options: 'i' };
    }

    if (accreditation && accreditation.trim() !== '') {
      query.accreditations = { $in: [accreditation.trim().toUpperCase()] };
    }

    if (specialty && specialty.trim() !== '') {
      query.specialties = { $regex: specialty.trim(), $options: 'i' };
    }

    const parsedFeeMin = parseFloat(opd_fee_min);
    const parsedFeeMax = parseFloat(opd_fee_max);
    if (!isNaN(parsedFeeMin) || !isNaN(parsedFeeMax)) {
      query['pricing.consultation'] = {};
      if (!isNaN(parsedFeeMin) && parsedFeeMin >= 0) {
        query['pricing.consultation'].$gte = parsedFeeMin;
      }
      if (!isNaN(parsedFeeMax) && parsedFeeMax >= 0) {
        query['pricing.consultation'].$lte = parsedFeeMax;
      }
    }

    let sortQuery = {};
    switch(sort) {
      case 'distance': sortQuery = { 'ratings.average': -1 }; break;
      case 'fee': sortQuery = { 'pricing.consultation': 1 }; break;
      case 'rating': sortQuery = { 'ratings.average': -1 }; break;
      case 'beds': sortQuery = { 'beds.available': -1 }; break;
      case 'reviews': sortQuery = { 'ratings.count': -1 }; break;
      default: sortQuery = { 'activity_score': -1, 'ratings.average': -1 };
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;
    
    const [hospitals, total] = await Promise.all([
      Hospital.find(query).sort(sortQuery).skip(skip).limit(limitNum).select('-__v -password').lean(),
      Hospital.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: hospitals,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalHospitals: total,
        perPage: limitNum
      }
    });

  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ success: false, message: 'Search failed. Please try again.' });
  }
});

// WhatsApp bed update webhook (Public)
router.post('/whatsapp-update', async (req, res) => {
  try {
    const { phone, message } = req.body;
    const parsedData = parseWhatsAppMessage(message);
    if (!parsedData) {
      return res.status(400).json({ success: false, message: 'Invalid format' });
    }
    const hospital = await Hospital.findOne({ 'contact.phone': phone });
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });
    hospital.beds = { ...hospital.beds.toObject(), total: parsedData.total || hospital.beds.total, available: parsedData.available || hospital.beds.available, icu_available: parsedData.icu || hospital.beds.icu_available, ventilator_available: parsedData.ventilator || hospital.beds.ventilator_available, last_updated: new Date(), update_method: 'whatsapp', auto_expire_at: new Date(Date.now() + 4 * 60 * 60 * 1000) };
    hospital.activity_score = calculateActivityScore(hospital);
    await hospital.save();
    res.json({ success: true, message: 'Updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Download Excel template
router.get('/template/download', authenticateToken, authorizeRoles('hospital', 'admin'), (req, res) => {
  const template = [{ 'Doctor Name': 'Dr. Example', 'Specialization': 'Cardiologist', 'Qualification': 'MBBS, MD', 'Experience (Years)': '15', 'Consultation Fee (₹)': '1200', 'Languages': 'English, Hindi', 'Gender': 'Male', 'Available Days': 'Mon-Fri', 'Morning Slots': '09:00-13:00', 'Evening Slots': '17:00-20:00', 'Max Patients Per Day': '20' }];
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(template);
  xlsx.utils.book_append_sheet(wb, ws, 'Doctors');
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=doctor_template.xlsx');
  res.send(buffer);
});

// ============================================
// CORPORATE ROUTES (Must be before /:id)
// ============================================

// Toggle corporate serving status
router.put('/corporate/toggle', authenticateToken, authorizeRoles('hospital', 'admin'), async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId || req.body.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'Hospital ID required' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    const enable = req.body.enable !== false;
    await hospital.toggleCorporate(enable);

    res.json({
      success: true,
      message: `Corporate ${enable ? 'enabled' : 'disabled'} successfully`,
      data: { servesCorporate: hospital.servesCorporate }
    });
  } catch (error) {
    console.error('Corporate toggle error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all corporate packages for this hospital
router.get('/corporate/packages', authenticateToken, authorizeRoles('hospital', 'admin'), async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId || req.query.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'Hospital ID required' });
    }

    const hospital = await Hospital.findById(hospitalId).select('servesCorporate corporatePackages');
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    res.json({
      success: true,
      data: {
        servesCorporate: hospital.servesCorporate,
        packages: hospital.corporatePackages || []
      }
    });
  } catch (error) {
    console.error('Get corporate packages error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create corporate package
router.post('/corporate/packages', authenticateToken, authorizeRoles('hospital', 'admin'), async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId || req.body.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'Hospital ID required' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    const packageData = {
      packageName: req.body.packageName,
      packageType: req.body.packageType || 'health_checkup',
      description: req.body.description || '',
      servicesIncluded: req.body.servicesIncluded || [],
      pricePerEmployee: req.body.pricePerEmployee,
      discountedPricePerEmployee: req.body.discountedPricePerEmployee,
      minEmployees: req.body.minEmployees || 10,
      maxEmployees: req.body.maxEmployees,
      validityDays: req.body.validityDays || 365,
      locations: req.body.locations || [],
      availableCities: req.body.availableCities || [],
      dedicatedPOC: req.body.dedicatedPOC || {},
      slaTerms: req.body.slaTerms || ''
    };

    if (!packageData.packageName || !packageData.pricePerEmployee) {
      return res.status(400).json({ success: false, message: 'Package name and price per employee are required' });
    }

    await hospital.addCorporatePackage(packageData);

    res.json({
      success: true,
      message: 'Corporate package added successfully',
      data: hospital.corporatePackages[hospital.corporatePackages.length - 1]
    });
  } catch (error) {
    console.error('Add corporate package error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update corporate package
router.put('/corporate/packages/:packageId', authenticateToken, authorizeRoles('hospital', 'admin'), async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId || req.body.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'Hospital ID required' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    const pkg = hospital.corporatePackages.id(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    const updatableFields = [
      'packageName', 'packageType', 'description', 'servicesIncluded',
      'pricePerEmployee', 'discountedPricePerEmployee', 'minEmployees',
      'maxEmployees', 'validityDays', 'locations', 'availableCities',
      'dedicatedPOC', 'slaTerms', 'isActive'
    ];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        pkg[field] = req.body[field];
      }
    });

    pkg.updatedAt = new Date();
    await hospital.save();

    res.json({
      success: true,
      message: 'Corporate package updated successfully',
      data: pkg
    });
  } catch (error) {
    console.error('Update corporate package error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete corporate package
router.delete('/corporate/packages/:packageId', authenticateToken, authorizeRoles('hospital', 'admin'), async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId || req.body.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'Hospital ID required' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    const pkg = hospital.corporatePackages.id(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    pkg.remove();
    await hospital.save();

    res.json({
      success: true,
      message: 'Corporate package deleted successfully'
    });
  } catch (error) {
    console.error('Delete corporate package error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get corporate enquiries for this hospital
router.get('/corporate/enquiries', authenticateToken, authorizeRoles('hospital', 'admin'), async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId || req.query.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'Hospital ID required' });
    }

    const hospital = await Hospital.findById(hospitalId).select('corporateEnquiries');
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    res.json({
      success: true,
      data: hospital.corporateEnquiries || []
    });
  } catch (error) {
    console.error('Get corporate enquiries error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update enquiry status
router.put('/corporate/enquiries/:enquiryId', authenticateToken, authorizeRoles('hospital', 'admin'), async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId || req.body.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'Hospital ID required' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    const enquiry = hospital.corporateEnquiries.id(req.params.enquiryId);
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    if (req.body.status) {
      enquiry.status = req.body.status;
    }

    await hospital.save();

    res.json({
      success: true,
      message: 'Enquiry updated successfully',
      data: enquiry
    });
  } catch (error) {
    console.error('Update enquiry error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// DYNAMIC ID ROUTES (Must be AFTER static routes)
// ============================================

// Get single hospital
router.get('/:id', async (req, res) => {
  try {
    if (['health', 'search', 'whatsapp-update', 'template', 'medical-data', 'corporate'].includes(req.params.id)) return;
    const hospital = await Hospital.findById(req.params.id).select('-password').lean();
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });
    res.json({ success: true, data: hospital });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update bed status
router.put('/:id/bed-status', authenticateToken, authorizeRoles('hospital', 'admin'), async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });
    hospital.beds = { ...hospital.beds.toObject(), ...req.body.beds, last_updated: new Date(), update_method: req.body.updateMethod || 'web_portal', auto_expire_at: new Date(Date.now() + 4 * 60 * 60 * 1000) };
    await hospital.save();
    res.json({ success: true, data: hospital.beds });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upload doctors Excel
router.post('/:id/upload-doctors', authenticateToken, authorizeRoles('hospital', 'admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file' });
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ success: false, message: 'Not found' });
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const doctors = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    hospital.doctors = doctors.map(d => ({ name: d['Doctor Name'] || '', specialization: d['Specialization'] || '', qualification: d['Qualification'] || '', experience: d['Experience (Years)'] || '0', consultation_fee: parseFloat(d['Consultation Fee (₹)']) || 0, languages: d['Languages'] ? d['Languages'].split(',').map(l => l.trim()) : [], gender: d['Gender'] || 'Male', rating: 0, reviewCount: 0, availability: { status: 'available', slots_available: parseInt(d['Max Patients Per Day']) || 20, days: ['Mon','Tue','Wed','Thu','Fri','Sat'], morning_slots: d['Morning Slots'] || '09:00-13:00', evening_slots: d['Evening Slots'] || '', max_patients: parseInt(d['Max Patients Per Day']) || 20 } }));
    await hospital.save();
    res.json({ success: true, message: `${doctors.length} doctors uploaded` });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Upload data Excel
router.post('/:id/upload-data', authenticateToken, authorizeRoles('hospital', 'admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file' });
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ success: false, message: 'Not found' });
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])[0] || {};
    if (data['Total Beds']) hospital.beds.total = parseInt(data['Total Beds']);
    if (data['Available Beds']) hospital.beds.available = parseInt(data['Available Beds']);
    if (data['ICU Beds']) hospital.beds.icu_available = parseInt(data['ICU Beds']);
    if (data['OPD Fee (₹)']) hospital.pricing.consultation = parseFloat(data['OPD Fee (₹)']);
    hospital.beds.last_updated = new Date();
    hospital.beds.update_method = 'excel_upload';
    await hospital.save();
    res.json({ success: true, message: 'Updated' });
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
        case 'BEDS': data.total = parseInt(parts[i + 1]); break;
        case 'AVL': data.available = parseInt(parts[i + 1]); break;
        case 'ICU': data.icu = parseInt(parts[i + 1]); break;
        case 'VENT': data.ventilator = parseInt(parts[i + 1]); break;
        case 'ER': data.emergency = parts[i + 1] === 'OPEN'; break;
      }
    }
    return data.total ? data : null;
  } catch (error) { return null; }
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
  if (hospital.diseases_treated?.length > 0) score += 5;
  if (hospital.procedures_available?.length > 0) score += 5;
  return Math.max(0, Math.min(100, score));
}

module.exports = router;
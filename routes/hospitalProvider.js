require('../models/TestMaster');
require('../models/TestPricing');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Hospital = require('../models/Hospital');
require('../models/TestMaster');
require('../models/TestPricing');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const Prescription = require('../models/Prescription');
const Doctor = require('../models/Doctor');
const { 
  authenticateHospital, 
  authenticateAdmin, 
  authorizeRoles 
} = require('../middleware/auth');

// Multer config for Excel upload
const upload = multer({ 
  storage.memoryStorage(),
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
// VALIDATION HELPERS
// ============================================

const validatePhone = (phone) => /^[6-9]\d{9}$/.test(phone);
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (password) => password && password.length >= 8;

// ============================================
// REGISTRATION & AUTHENTICATION
// ============================================

// Register hospital
router.post('/register', async (req, res) => {
  try {
    const { password, contact, name } = req.body;

    if (!name) {
      return res.status(400).json({ success, message: 'Hospital name is required' });
    }
    if (!contact?.phone || !validatePhone(contact.phone)) {
      return res.status(400).json({ success, message: 'Valid 10-digit phone number is required' });
    }
    if (!contact?.email || !validateEmail(contact.email)) {
      return res.status(400).json({ success, message: 'Valid email is required' });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ success, message: 'Password must be at least 8 characters' });
    }

    const existing = await Hospital.findOne({
      $or: [
        { 'contact.email'.email },
        { 'contact.phone'.phone }
      ]
    });
    if (existing) {
      return res.status(400).json({ success, message: 'Hospital with this email or phone already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const hospital = new Hospital({
      ...req.body,
      password,
      is_verified,
      is_active,
      subscription_plan: 'free',
      created_atDate()
    });
    
    await hospital.save();

    res.json({ 
      success, 
      message: 'Registration submitted successfully! Please wait for verification.',
      data: { id._id, name.name }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ success, message.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if (!password) {
      return res.status(400).json({ success, message: 'Password is required' });
    }

    const hospital = await Hospital.findOne({ 
      $or: [
        { 'contact.email'|| '' },
        { 'contact.phone'|| '' }
      ]
    }).select('+password');
    
    if (!hospital) {
      return res.status(404).json({ success, message: 'Hospital not found. Please check your credentials.' });
    }

    if (!hospital.is_active) {
      return res.status(403).json({ success, message: 'Hospital account is deactivated. Contact support.' });
    }

    const isMatch = await bcrypt.compare(password, hospital.password);
    if (!isMatch) {
      return res.status(401).json({ success, message: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { 
        _id._id, 
        role: 'hospital', 
        isVerified.is_verified,
        subscriptionPlan.subscription_plan
      },
      process.env.JWT_SECRET || 'hospital_platform_secret_key_2024',
      { expiresIn: '7d' }
    );
    
    res.json({ 
      success, 
      token, 
      hospitalId._id,
      isVerified.is_verified,
      message: 'Login successful' 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success, message.message });
  }
});

// Auth verify
router.get('/auth/verify', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id).select('-password');
    if (!hospital) {
      return res.status(404).json({ success, message: 'Hospital not found' });
    }
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Logout
router.post('/logout', authenticateHospital, (req, res) => {
  res.json({ success, message: 'Logged out successfully' });
});

// ============================================
// PROFILE MANAGEMENT
// ============================================

// Get profile
router.get('/profile', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id).select('-password');
    if (!hospital) {
      return res.status(404).json({ success, message: 'Hospital not found' });
    }
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Update profile
router.put('/profile', authenticateHospital, async (req, res) => {
  try {
    delete req.body.password;
    const hospital = await Hospital.findById(req.user._id);

if (req.body.pricing) {
  hospital.pricing = { ...hospital.pricing.toObject(), ...req.body.pricing };
  delete req.body.pricing;
}

Object.assign(hospital, req.body);
hospital.updated_at = new Date();
await hospital.save();

const updated = await Hospital.findById(req.user._id).select('-password');
res.json({ success, data});
    
    res.json({ success, data});
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Change password
router.put('/change-password', authenticateHospital, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ success, message: 'New password must be at least 8 characters' });
    }

    const hospital = await Hospital.findById(req.user._id);
    const isMatch = await bcrypt.compare(currentPassword, hospital.password);
    
    if (!isMatch) {
      return res.status(401).json({ success, message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    hospital.password = await bcrypt.hash(newPassword, salt);
    await hospital.save();

    res.json({ success, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// DOCTOR MANAGEMENT
// ============================================

// Get all doctors
router.get('/doctors', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id).select('doctors');
    res.json({ success, data?.doctors || [] });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Add doctor
router.post('/doctors', authenticateHospital, async (req, res) => {
  try {
    const { name, specialization, consultation_fee } = req.body;
    if (!name || !specialization) {
      return res.status(400).json({ success, message: 'Name and specialization are required' });
    }

    const hospital = await Hospital.findById(req.user._id);
    const doctorData = {
      ...req.body,
      rating: 0,
      reviewCount: 0,
      availability: {
        status: 'available',
        slots_available.body.max_patients_per_day || 20,
        days.body.availability_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        morning_slots.body.morning_slots || '09:00-13:00',
        evening_slots.body.evening_slots || '17:00-20:00',
        max_patients.body.max_patients_per_day || 20
      }
    };
    
    hospital.doctors.push(doctorData);
    await hospital.save();
    res.json({ success, data.doctors });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Update doctor
router.put('/doctors/', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    const doctor = hospital.doctors.id(req.params.doctorId);
    if (!doctor) return res.status(404).json({ success, message: 'Doctor not found' });
    
    Object.assign(doctor, req.body);
    await hospital.save();
    res.json({ success, data});
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Delete doctor
router.delete('/doctors/', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    hospital.doctors.pull(req.params.doctorId);
    await hospital.save();
    res.json({ success, message: 'Doctor removed' });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Update doctor availability
router.put('/doctors//availability', authenticateHospital, async (req, res) => {
  try {
    const { status, slots_available, days, morning_slots, evening_slots } = req.body;
    const hospital = await Hospital.findById(req.user._id);
    const doctor = hospital.doctors.id(req.params.doctorId);
    
    if (!doctor) return res.status(404).json({ success, message: 'Doctor not found' });
    
    doctor.availability = {
      status|| doctor.availability?.status || 'available',
      slots_available_available ?? doctor.availability?.slots_available ?? 20,
      days|| doctor.availability?.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      morning_slots_slots || doctor.availability?.morning_slots,
      evening_slots_slots || doctor.availability?.evening_slots,
      max_patients.availability?.max_patients || 20
    };
    
    await hospital.save();
    res.json({ success, data.availability });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// ============================================
// SCHEMES & INSURANCE MANAGEMENT
// ============================================

// Update schemes
router.put('/schemes', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    hospital.schemes_accepted = req.body.schemes_accepted || [];
    if (req.body.scheme_details) {
      hospital.scheme_details = req.body.scheme_details;
    }
    await hospital.save();
    res.json({ success, data.schemes_accepted });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Get schemes
router.get('/schemes', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id).select('schemes_accepted scheme_details cashless_available tpa_desk_available');
    res.json({ success, data|| {} });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Update insurance
router.put('/insurance', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    hospital.insurance_accepted = req.body.insurance_accepted || [];
    hospital.cashless_available = req.body.cashless_available ?? hospital.cashless_available;
    hospital.tpa_desk_available = req.body.tpa_desk_available ?? hospital.tpa_desk_available;
    hospital.reimbursement_accepted = req.body.reimbursement_accepted ?? hospital.reimbursement_accepted;
    hospital.tpa_partners = req.body.tpa_partners || hospital.tpa_partners;
    hospital.payment_methods = req.body.payment_methods || hospital.payment_methods;
    hospital.emi_available = req.body.emi_available ?? hospital.emi_available;
    await hospital.save();
    res.json({ success, message: 'Insurance updated' });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Get insurance
router.get('/insurance', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id).select('insurance_accepted cashless_available tpa_desk_available tpa_partners payment_methods emi_available');
    res.json({ success, data|| {} });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// FACILITIES MANAGEMENT
// ============================================

// Update facilities
router.put('/facilities', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    if (req.body.facilities) hospital.facilities = req.body.facilities;
    if (req.body.technology) hospital.technology = req.body.technology;
    if (req.body.amenities) hospital.amenities = req.body.amenities;
    if (req.body.specialties) hospital.specialties = req.body.specialties;
    if (req.body.diseases_treated) hospital.diseases_treated = req.body.diseases_treated;
    if (req.body.accreditations) hospital.accreditations = req.body.accreditations;
    if (req.body.operation_theaters) hospital.operation_theaters = req.body.operation_theaters;
    
    await hospital.save();
    res.json({ success, message: 'Facilities updated' });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Get facilities
router.get('/facilities', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id).select('facilities technology amenities specialties diseases_treated accreditations operation_theaters has24x7ER trauma_center stroke_ready cardiac_emergency lab_tests_available ambulance_available pharmacy_24x7');
    res.json({ success, data|| {} });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// PRICING MANAGEMENT
// ============================================

// Update pricing
router.put('/pricing', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    
    if (req.body.consultation) hospital.pricing.consultation = req.body.consultation;
    if (req.body.icu_bed_per_day) hospital.pricing.icu_bed_per_day = req.body.icu_bed_per_day;
    if (req.body.general_bed_per_day) hospital.pricing.general_bed_per_day = req.body.general_bed_per_day;
    if (req.body.semi_private_per_day) hospital.pricing.semi_private_per_day = req.body.semi_private_per_day;
    if (req.body.private_per_day) hospital.pricing.private_per_day = req.body.private_per_day;
    if (req.body.deluxe_per_day) hospital.pricing.deluxe_per_day = req.body.deluxe_per_day;
    if (req.body.online_booking_discount) hospital.pricing.online_booking_discount = req.body.online_booking_discount;
    
    await hospital.save();
    res.json({ success, data.pricing });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// ============================================
// HEALTH PACKAGES & OFFERS
// ============================================

// Get packages
router.get('/packages', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id).select('pricing.health_packages');
    res.json({ success, data?.pricing?.health_packages || [] });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Add package
router.post('/packages', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    hospital.pricing.health_packages.push(req.body);
    await hospital.save();
    res.json({ success, data.pricing.health_packages });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Update package
router.put('/packages/', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    const pkg = hospital.pricing.health_packages.id(req.params.packageId);
    if (!pkg) return res.status(404).json({ success, message: 'Package not found' });
    
    Object.assign(pkg, req.body);
    await hospital.save();
    res.json({ success, data});
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Delete package
router.delete('/packages/', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    hospital.pricing.health_packages.pull(req.params.packageId);
    await hospital.save();
    res.json({ success, message: 'Package removed' });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Get offers
router.get('/offers', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id).select('pricing.offers');
    res.json({ success, data?.pricing?.offers || [] });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Add offer
router.post('/offers', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    hospital.pricing.offers.push(req.body);
    await hospital.save();
    res.json({ success, data.pricing.offers });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Delete offer
router.delete('/offers/', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    hospital.pricing.offers.pull(req.params.offerId);
    await hospital.save();
    res.json({ success, message: 'Offer removed' });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// ============================================
// EXCEL UPLOAD
// ============================================

// Upload doctors via Excel
router.post('/upload-doctors', authenticateHospital, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success, message: 'Please upload a file' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const doctors = xlsx.utils.sheet_to_json(sheet);
    
    if (doctors.length === 0) {
      return res.status(400).json({ success, message: 'No doctors found in file' });
    }

    const hospital = await Hospital.findById(req.user._id);
    hospital.doctors = doctors.map(doc => ({
      name['Doctor Name'] || '',
      specialization['Specialization'] || '',
      qualification['Qualification'] || '',
      experience['Experience (Years)'] || '0',
      consultation_fee(doc['Consultation Fee (₹)']) || 0,
      languages['Languages'] ? doc['Languages'].split(',').map(l => l.trim()) : [],
      gender['Gender'] || 'Male',
      rating: 0,
      reviewCount: 0,
      availability: {
        status: 'available',
        slots_available(doc['Max Patients Per Day']) || 20,
        days['Available Days'] ? doc['Available Days'].split(',').map(d => d.trim()) : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        morning_slots['Morning Slots (HH-HH)'] || '09:00-13:00',
        evening_slots['Evening Slots (HH-HH)'] || '17:00-20:00',
        max_patients(doc['Max Patients Per Day']) || 20
      }
    }));
    
    hospital.upload_history.push(JSON.stringify({
    filename.file.originalname,
    uploaded_atDate(),
    type: "bulk_data",
    status: "completed"
}));
    
    await hospital.save();
    res.json({ success, message: `${doctors.length} doctors uploaded successfully` });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Upload data via Excel (beds, pricing)
// ============================================
// SAFE EXCEL UPLOAD (Beds & Pricing)
// ============================================
router.post(
  '/upload-data',
  authenticateHospital,
  upload.single('file'),
  async (req, res) => {
    try {
      console.log("========== EXCEL UPLOAD START ==========");
      console.log('DEBUG req.user._id:', req.user._id);
      console.log('DEBUG req.user:', JSON.stringify(req.user));

      if (!req.file) {
        return res.status(400).json({ success, message: "Please upload an Excel file." });
      }

      console.log("Uploaded File:", req.file.originalname);

      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });

      if (!workbook.SheetNames.length) {
        return res.status(400).json({ success, message: "Excel file contains no sheets." });
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) {
        return res.status(400).json({ success, message: "Unable to read worksheet." });
      }

      const rows = xlsx.utils.sheet_to_json(sheet);
      if (!rows.length) {
        return res.status(400).json({ success, message: "Excel file is empty." });
      }

      const data = rows[0];
      console.log("Excel Data:", data);

      // Find Hospital - use multiple fallback methods
      let hospitalId = req.user._id;
      if (!hospitalId || hospitalId === 'provider') {
        hospitalId = req.user.id || req.user.hospitalId;
      }
      
      const hospital = await Hospital.findById(hospitalId);
      if (!hospital) {
        return res.status(404).json({ success, message: "Hospital not found. ID: " + hospitalId });
      }

      if (!hospital.beds) hospital.beds = {};
      if (!hospital.pricing) hospital.pricing = {};
      if (!hospital.upload_history) hospital.upload_history = [];

      if (data["Total Beds"] !== undefined) hospital.beds.total = Number(data["Total Beds"]) || 0;
      if (data["Available Beds"] !== undefined) hospital.beds.available = Number(data["Available Beds"]) || 0;
      if (data["ICU Beds"] !== undefined) hospital.beds.icu_available = Number(data["ICU Beds"]) || 0;
      if (data["Ventilators"] !== undefined) hospital.beds.ventilator_total = Number(data["Ventilators"]) || 0;
      if (data["OPD Fee (₹)"] !== undefined) hospital.pricing.consultation = Number(data["OPD Fee (₹)"]) || 0;
      if (data["ICU Per Day (₹)"] !== undefined) hospital.pricing.icu_bed_per_day = Number(data["ICU Per Day (₹)"]) || 0;
      if (data["General Ward (₹)"] !== undefined) hospital.pricing.general_bed_per_day = Number(data["General Ward (₹)"]) || 0;
      if (data["Semi-Private (₹)"] !== undefined) hospital.pricing.semi_private_per_day = Number(data["Semi-Private (₹)"]) || 0;
      if (data["Private Room (₹)"] !== undefined) hospital.pricing.private_per_day = Number(data["Private Room (₹)"]) || 0;
      if (data["Online Discount (%)"] !== undefined) hospital.pricing.online_booking_discount = Number(data["Online Discount (%)"]) || 0;

      hospital.beds.last_updated = new Date();
      hospital.beds.update_method = "excel_upload";
      hospital.beds.auto_expire_at = new Date(Date.now() + 24 * 60 * 60 * 1000);

      hospital.upload_history.push({
        filename.file.originalname,
        uploaded_atDate(),
        type: "bulk_data",
        status: "completed"
      });

      hospital.updated_at = new Date();
      await hospital.save();

      console.log("Upload completed successfully.");
      return res.json({
        success,
        message: "Hospital data uploaded successfully.",
        uploaded: { beds.beds, pricing.pricing }
      });

    } catch (error) {
      console.error("========== EXCEL UPLOAD ERROR ==========");
      console.error(error);
      return res.status(500).json({ success, message.message });
    }
  }
);

// Download doctor template
router.get('/template/download', (req, res) => {
  // Accept token from query or header
  const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success, message: 'Access denied. No token provided.' });
  }
  try {
    const jwt = require('jsonwebtoken');
    jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
  } catch(e) {
    return res.status(401).json({ success, message: 'Invalid token.' });
  }

  const template = [{
    'Doctor Name': 'Dr. Example',
    'Specialization': 'Cardiologist',
    'Qualification': 'MBBS, MD (Cardiology)',
    'Experience (Years)': '15',
    'Consultation Fee (₹)': '1200',
    'Languages': 'English, Hindi',
    'Gender': 'Male',
    'Available Days': 'Mon, Tue, Wed, Thu, Fri, Sat',
    'Morning Slots (HH-HH)': '09:00-13:00',
    'Evening Slots (HH-HH)': '17:00-20:00',
    'Max Patients Per Day': '20'
  }];
  
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(template);
  xlsx.utils.book_append_sheet(wb, ws, 'Doctors');
  
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=doctor_template.xlsx');
  res.send(buffer);
});

// ============================================
// BOOKINGS MANAGEMENT
// ============================================

// Get all bookings for hospital
router.get('/bookings', authenticateHospital, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20, search } = req.query;
    const hospitalId = req.user._id.toString();
    
    const query = { hospitalId };
    if (status) query.status = status;
    if (type) query.bookingType = type;
    if (search) {
      query.$or = [
        { bookingId: { $regex, $options: 'i' } },
        { patientName: { $regex, $options: 'i' } },
        { patientPhone: { $regex, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Booking.countDocuments(query)
    ]);

    res.json({
      success,
      data,
      pagination: {
        currentPage(page),
        totalPages.ceil(total / parseInt(limit)),
        totalBookings}
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Update booking status
router.put('/bookings//status', authenticateHospital, async (req, res) => {
  try {
    const { status, note } = req.body;
    const booking = await Booking.findOne({ 
      bookingId.params.bookingId,
      hospitalId.user._id.toString()
    });

    if (!booking) {
      return res.status(404).json({ success, message: 'Booking not found' });
    }

    const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success, message: 'Invalid status' });
    }

    booking.status = status;
    booking.statusHistory.push({
      status,
      timestampDate(),
      note|| `Status updated to ${status} by hospital`
    });

    if (status === 'completed') {
      booking.completedAt = new Date();
    }

    await booking.save();
    res.json({ success, data});
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Get single booking
router.get('/bookings/', authenticateHospital, async (req, res) => {
  try {
    const booking = await Booking.findOne({ 
      bookingId.params.bookingId,
      hospitalId.user._id.toString()
    });

    if (!booking) {
      return res.status(404).json({ success, message: 'Booking not found' });
    }

    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// PATIENTS MANAGEMENT
// ============================================

// Get patients list
router.get('/patients', authenticateHospital, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const hospitalId = req.user._id.toString();

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const patients = await Booking.aggregate([
      { $match: { hospitalId } },
      { $group: {
        _id: '$patientPhone',
        patientName: { $first: '$patientName' },
        patientPhone: { $first: '$patientPhone' },
        patientEmail: { $first: '$patientEmail' },
        patientAge: { $first: '$patientAge' },
        patientGender: { $first: '$patientGender' },
        totalBookings: { $sum: 1 },
        lastVisit: { $max: '$appointmentDate' },
        totalSpent: { $sum: '$finalAmount' }
      }},
      { $sort: { lastVisit: -1 } },
      { $skip},
      { $limit(limit) }
    ]);

    const total = await Booking.aggregate([
      { $match: { hospitalId } },
      { $group: { _id: '$patientPhone' } },
      { $count: 'total' }
    ]);

    res.json({
      success,
      data,
      pagination: {
        currentPage(page),
        totalPages.ceil((total[0]?.total || 0) / parseInt(limit)),
        totalPatients[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Get single patient details
router.get('/patients/', authenticateHospital, async (req, res) => {
  try {
    const hospitalId = req.user._id.toString();
    
    const bookings = await Booking.find({ 
      hospitalId, 
      patientPhone.params.phone 
    }).sort({ createdAt: -1 }).lean();

    if (bookings.length === 0) {
      return res.status(404).json({ success, message: 'Patient not found' });
    }

    res.json({
      success,
      data: {
        patientName[0].patientName,
        patientPhone[0].patientPhone,
        patientEmail[0].patientEmail,
        patientAge[0].patientAge,
        patientGender[0].patientGender,
        totalBookings.length,
        totalSpent.reduce((sum, b) => sum + (b.finalAmount || 0), 0),
        lastVisit[0].appointmentDate,
        bookings
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// PRESCRIPTION MANAGEMENT
// ============================================

// Create prescription
router.post('/prescriptions', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id).select('name');
    
    const prescription = new Prescription({
      ...req.body,
      hospitalId.user._id,
      hospitalName.name
    });
    
    await prescription.save();
    
    // Update booking with prescription reference
    if (req.body.bookingId) {
      await Booking.findOneAndUpdate(
        { bookingId.body.bookingId },
        { 
          'prescription.generated',
          'prescription.prescriptionId'.prescriptionId,
          'prescription.generatedAt'Date(),
          'prescription.medicines'.body.medicines || [],
          'prescription.tests'.body.tests_recommended || [],
          'prescription.doctorNotes'.body.doctor_notes || ''
        }
      );
    }
    
    res.json({ success, data});
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Get all prescriptions for hospital
router.get('/prescriptions', authenticateHospital, async (req, res) => {
  try {
    const { page = 1, limit = 20, doctorId, status } = req.query;
    const query = { hospitalId.user._id };
    
    if (doctorId) query.doctorId = doctorId;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [prescriptions, total] = await Promise.all([
      Prescription.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Prescription.countDocuments(query)
    ]);

    res.json({
      success,
      data,
      pagination: {
        currentPage(page),
        totalPages.ceil(total / parseInt(limit)),
        totalPrescriptions}
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Get single prescription
router.get('/prescriptions/', authenticateHospital, async (req, res) => {
  try {
    const prescription = await Prescription.findOne({ 
      prescriptionId.params.prescriptionId,
      hospitalId.user._id
    });
    
    if (!prescription) {
      return res.status(404).json({ success, message: 'Prescription not found' });
    }
    
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Update prescription
router.put('/prescriptions/', authenticateHospital, async (req, res) => {
  try {
    const prescription = await Prescription.findOneAndUpdate(
      { prescriptionId.params.prescriptionId, hospitalId.user._id },
      { ...req.body, updated_atDate() },
      { new}
    );
    
    if (!prescription) {
      return res.status(404).json({ success, message: 'Prescription not found' });
    }
    
    res.json({ success, data});
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Sign prescription (digital signature)
router.put('/prescriptions//sign', authenticateHospital, async (req, res) => {
  try {
    const prescription = await Prescription.findOne({ 
      prescriptionId.params.prescriptionId,
      hospitalId.user._id
    });
    
    if (!prescription) {
      return res.status(404).json({ success, message: 'Prescription not found' });
    }
    
    await prescription.sign(req.body.signatureUrl, req.ip);
    res.json({ success, message: 'Prescription signed', data});
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Expire prescription
router.put('/prescriptions//expire', authenticateHospital, async (req, res) => {
  try {
    const prescription = await Prescription.findOne({ 
      prescriptionId.params.prescriptionId,
      hospitalId.user._id
    });
    
    if (!prescription) {
      return res.status(404).json({ success, message: 'Prescription not found' });
    }
    
    await prescription.expire();
    res.json({ success, message: 'Prescription expired', data});
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// ============================================
// DASHBOARD & ANALYTICS
// ============================================

// Dashboard stats
router.get('/dashboard/stats', authenticateHospital, async (req, res) => {
  try {
    const hospitalId = req.user._id.toString();
    
    const [
      hospital, 
      totalBookings, 
      todayBookings, 
      revenueData,
      pendingBookings,
      completedBookings
    ] = await Promise.all([
      Hospital.findById(req.user._id).select('doctors beds ratings schemes_accepted insurance_accepted subscription_plan activity_score'),
      Booking.countDocuments({ hospitalId }),
      Booking.countDocuments({ hospitalId, createdAt: { $gteDate(new Date().setHours(0,0,0,0)) } }),
      Transaction.aggregate([
        { $match: { hospitalId, status: { $in: ['completed', 'captured'] } } },
        { $group: { _id, total: { $sum: '$netAmount' }, commission: { $sum: '$platformCommission' }, count: { $sum: 1 } } }
      ]),
      Booking.countDocuments({ hospitalId, status: { $in: ['pending', 'confirmed'] } }),
      Booking.countDocuments({ hospitalId, status: 'completed' })
    ]);

    res.json({
      success,
      data: {
        totalDoctors?.doctors?.length || 0,
        totalBeds?.beds?.total || 0,
        availableBeds?.beds?.available || 0,
        icuAvailable?.beds?.icu_available || 0,
        ventilatorAvailable?.beds?.ventilator_available || 0,
        rating?.ratings?.average || 0,
        reviewCount?.ratings?.count || 0,
        schemesCount?.schemes_accepted?.length || 0,
        insuranceCount?.insurance_accepted?.length || 0,
        subscription?.subscription_plan || 'free',
        activityScore?.activity_score || 0,
        totalBookings,
        todayBookings,
        pendingBookings,
        completedBookings,
        totalRevenue[0]?.total || 0,
        totalCommission[0]?.commission || 0,
        totalTransactions[0]?.count || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Get stats (legacy)
router.get('/stats', authenticateHospital, async (req, res) => {
  try {
    const hospitalId = req.user._id.toString();
    
    const [hospital, totalBookings, todayBookings] = await Promise.all([
      Hospital.findById(req.user._id).select('doctors beds ratings'),
      Booking.countDocuments({ hospitalId }),
      Booking.countDocuments({ hospitalId, createdAt: { $gteDate(new Date().setHours(0,0,0,0)) } })
    ]);

    res.json({
      success,
      data: {
        totalDoctors?.doctors?.length || 0,
        totalBeds?.beds?.total || 0,
        availableBeds?.beds?.available || 0,
        rating?.ratings?.average || 0,
        totalBookings,
        todayBookings
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Analytics
router.get('/analytics', authenticateHospital, async (req, res) => {
  try {
    const hospitalId = req.user._id.toString();
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [bookingStats, revenueData, dailyBookings, topDoctors] = await Promise.all([
      Booking.aggregate([
        { $match: { hospitalId, createdAt: { $gte} } },
        { $group: { _id: '$bookingType', count: { $sum: 1 }, revenue: { $sum: '$finalAmount' } } }
      ]),
      Transaction.aggregate([
        { $match: { hospitalId, status: 'completed', createdAt: { $gte} } },
        { $group: { _id, total: { $sum: '$netAmount' }, commission: { $sum: '$platformCommission' }, count: { $sum: 1 } } }
      ]),
      Booking.aggregate([
        { $match: { hospitalId, createdAt: { $gte} } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, revenue: { $sum: '$finalAmount' } } },
        { $sort: { _id: 1 } }
      ]),
      Booking.aggregate([
        { $match: { hospitalId, doctorName: { $ne}, createdAt: { $gte} } },
        { $group: { _id: '$doctorName', count: { $sum: 1 }, revenue: { $sum: '$finalAmount' } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    res.json({
      success,
      data: {
        bookingBreakdown,
        revenue[0] || { total: 0, commission: 0, count: 0 },
        dailyBookings,
        topDoctors
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Reports
router.get('/reports', authenticateHospital, async (req, res) => {
  try {
    const hospitalId = req.user._id.toString();
    const { startDate, endDate } = req.query;
    
    const matchQuery = { hospitalId };
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const [bookingReport, revenueReport] = await Promise.all([
      Booking.aggregate([
        { $match},
        { $group: {
          _id: '$bookingType',
          total: { $sum: 1 },
          revenue: { $sum: '$finalAmount' },
          avgAmount: { $avg: '$finalAmount' }
        }}
      ]),
      Transaction.aggregate([
        { $match: { ...matchQuery, status: 'completed' } },
        { $group: {
          _id,
          totalRevenue: { $sum: '$netAmount' },
          totalCommission: { $sum: '$platformCommission' },
          totalTransactions: { $sum: 1 }
        }}
      ])
    ]);

    res.json({
      success,
      data: {
        bookingReport,
        revenueReport[0] || { totalRevenue: 0, totalCommission: 0, totalTransactions: 0 }
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Export report (CSV)
router.get('/reports/export', authenticateHospital, async (req, res) => {
  try {
    const hospitalId = req.user._id.toString();
    const { startDate, endDate } = req.query;
    
    const query = { hospitalId };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const bookings = await Booking.find(query).sort({ createdAt: -1 }).lean();
    
    // Generate CSV
    const headers = 'Booking ID,Type,Patient Name,Phone,Doctor,Hospital,Amount,Status,Date\n';
    const rows = bookings.map(b => 
      `${b.bookingId},${b.bookingType},${b.patientName},${b.patientPhone},${b.doctorName || ''},${b.hospitalName || ''},${b.finalAmount || 0},${b.status},${new Date(b.createdAt).toLocaleDateString()}`
    ).join('\n');
    
    const csv = headers + rows;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=hospital_report_${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// ACTIVITY & RANKING
// ============================================

// Get activity score
router.get('/activity-score', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id).select('activity_score update_frequency last_activity');
    res.json({
      success,
      data: {
        score?.activity_score || 0,
        updateFrequency?.update_frequency || { today: 0, this_week: 0, this_month: 0 },
        lastActivity?.last_activity
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// NOTIFICATIONS
// ============================================

// Get notifications
router.get('/notifications', authenticateHospital, async (req, res) => {
  try {
    // You can create a Notification model for this
    res.json({ success, data: [] });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Mark notification as read
router.put('/notifications//read', authenticateHospital, async (req, res) => {
  try {
    res.json({ success, message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// OPD SCHEDULE MANAGEMENT
// ============================================

// Get OPD schedule
router.get('/opd-schedule', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id).select('opd_timings working_hours');
    res.json({ success, data|| {} });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Update OPD schedule
router.put('/opd-schedule', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findByIdAndUpdate(
      req.user._id,
      { 
        opd_timings.body.opd_timings,
        working_hours.body.working_hours,
        visiting_hours.body.visiting_hours,
        icu_visiting_hours.body.icu_visiting_hours
      },
      { new}
    );
    res.json({ success, data.opd_timings });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// ============================================
// SLOTS MANAGEMENT (Legacy)
// ============================================

router.get('/slots', authenticateHospital, (req, res) => {
  res.json({ success, data: [] });
});

router.post('/slots', authenticateHospital, (req, res) => {
  res.json({ success, message: 'Slot added' });
});

router.put('/slots/', authenticateHospital, (req, res) => {
  res.json({ success, message: 'Slot updated' });
});

router.delete('/slots/', authenticateHospital, (req, res) => {
  res.json({ success, message: 'Slot removed' });
});

// ============================================
// ROOMS MANAGEMENT (Legacy)
// ============================================

router.get('/rooms', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id).select('beds.categories pricing');
    res.json({ success, data?.beds?.categories || {} });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

router.post('/rooms', authenticateHospital, (req, res) => {
  res.json({ success, message: 'Room added' });
});

router.put('/rooms/', authenticateHospital, (req, res) => {
  res.json({ success, message: 'Room updated' });
});

router.delete('/rooms/', authenticateHospital, (req, res) => {
  res.json({ success, message: 'Room removed' });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

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
  if (hospital.accreditations?.length > 0) score += 5;
  if (hospital.technology?.length > 0) score += 5;
  
  return Math.max(0, Math.min(100, score));
}

// ============================================
// 🆕 COMPLETE REGISTRATION WITH EXCEL UPLOAD
// ============================================

// Download COMPLETE hospital template (all 5 sheets)
router.get('/template/complete', authenticateHospital, async (req, res) => {
  try {
    const excelService = require('../services/excelService');
    const filePath = excelService.generateHospitalTemplate();
    res.download(filePath, 'hospital_complete_template.xlsx');
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Download individual sheet templates
router.get('/template/', authenticateHospital, async (req, res) => {
  try {
    const excelService = require('../services/excelService');
    let wb, fileName;
    
    switch(req.params.type) {
      case 'doctors'= excelService.generateDoctorsTemplate();
        fileName = 'doctors_template.xlsx';
        break;
      case 'pricing'= excelService.generatePricingTemplate();
        fileName = 'pricing_template.xlsx';
        break;
      case 'facilities'= excelService.generateFacilitiesTemplate();
        fileName = 'facilities_template.xlsx';
        break;
      case 'schemes'= excelService.generateSchemesTemplate();
        fileName = 'schemes_template.xlsx';
        break;
      case 'insurance'= excelService.generateInsuranceTemplate();
        fileName = 'insurance_template.xlsx';
        break;
      defaultres.status(400).json({ success, message: 'Invalid template type' });
    }
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Upload complete hospital data via Excel (all data in one file)
router.post('/upload-complete', authenticateHospital, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success, message: 'Please upload an Excel file' });
    }

    const excelService = require('../services/excelService');
    const fs = require('fs');
    const path = require('path');
    
    // Save uploaded file temporarily
    const tempPath = path.join(excelService.UPLOAD_DIR, `${req.user._id}_${Date.now()}.xlsx`);
    fs.writeFileSync(tempPath, req.file.buffer);
    
    // Parse Excel
    const data = excelService.parseHospitalExcel(tempPath);
    
    // Clean up temp file
    fs.unlinkSync(tempPath);
    
    // Update hospital with parsed data
    const hospital = await Hospital.findById(req.user._id);
    
    // Update doctors
    if (data.doctors.length > 0) {
      hospital.doctors = data.doctors.map(doc => ({
        name.name,
        specialization.specialization,
        sub_specialization.subSpecialization,
        qualification.qualification,
        experience.experience,
        consultation_fee.consultationFee,
        languages.languages,
        gender.gender,
        rating: 0,
        reviewCount: 0,
        availability: {
          status: 'available',
          slots_available.maxPatientsPerDay,
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          morning_slots: `${doc.morningStart}-${doc.morningEnd}`,
          evening_slots.eveningStart ? `${doc.eveningStart}-${doc.eveningEnd}` : '',
          max_patients.maxPatientsPerDay
        },
        online_consult.onlineConsult,
        online_consult_fee.onlineFee
      }));
    }
    
    // Update pricing
    if (data.pricing.length > 0) {
      hospital.pricing = hospital.pricing || {};
      data.pricing.forEach(p => {
        switch(p.roomType.toLowerCase().replace(/\s/g, '_')) {
          case 'general_ward'.pricing.general_bed_per_day = p.perDayCharge; break;
          case 'semi-private'.pricing.semi_private_per_day = p.perDayCharge; break;
          case 'private'.pricing.private_per_day = p.perDayCharge; break;
          case 'deluxe'.pricing.deluxe_per_day = p.perDayCharge; break;
          case 'icu'.pricing.icu_bed_per_day = p.perDayCharge; break;
          case 'nicu'.pricing.nicu_per_day = p.perDayCharge; break;
          case 'emergency'.pricing.emergency_bed_per_day = p.perDayCharge; break;
        }
      });
    }
    
    // Update facilities
    if (data.facilities.length > 0) {
      hospital.facilities = data.facilities.map(f => ({
        name.name,
        category.category,
        available_24x7.available24x7,
        description.description
      }));
    }
    
    // Update schemes
    if (data.schemes.length > 0) {
      hospital.schemes_accepted = data.schemes.map(s => s.code);
      hospital.scheme_details = data.schemes.map(s => ({
        code.code,
        name.name,
        active}));
    }
    
    // Update insurance
    if (data.insurance.length > 0) {
      hospital.insurance_accepted = data.insurance.map(i => i.company);
      hospital.cashless_available = data.insurance.some(i => i.cashlessAvailable);
      hospital.tpa_desk_available = data.insurance.some(i => i.tpaDesk);
      hospital.tpa_partners = data.insurance.filter(i => i.tpaName).map(i => i.tpaName);
    }
    
    hospital.updated_at = new Date();
    hospital.activity_score = calculateActivityScore(hospital);
    await hospital.save();
    
    res.json({
      success,
      message: 'Complete hospital data uploaded successfully',
      data: {
        doctors.doctors.length,
        pricing.pricing.length,
        facilities.facilities.length,
        schemes.schemes_accepted.length,
        insurance.insurance_accepted.length
      }
    });
  } catch (error) {
    console.error('Excel upload error:', error);
    res.status(400).json({ success, message.message });
  }
});

// Get registration progress
router.get('/registration-progress', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id).select('name doctors facilities schemes_accepted insurance_accepted pricing accreditations is_verified');
    
    const steps = {
      basicInfo: !!(hospital.name),
      doctors: (hospital.doctors?.length || 0) > 0,
      pricing: !!(hospital.pricing?.consultation || hospital.pricing?.general_bed_per_day),
      facilities: (hospital.facilities?.length || 0) > 0,
      schemes: (hospital.schemes_accepted?.length || 0) > 0,
      insurance: (hospital.insurance_accepted?.length || 0) > 0,
      verified.is_verified
    };
    
    const completedSteps = Object.values(steps).filter(Boolean).length;
    const totalSteps = Object.keys(steps).length;
    
    res.json({
      success,
      data: {
        steps,
        completedSteps,
        totalSteps,
        percentage.round((completedSteps / totalSteps) * 100),
        isComplete>= 5
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Submit for verification
router.post('/submit-verification', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    
    // Check if minimum data is filled
    if (!hospital.doctors || hospital.doctors.length === 0) {
      return res.status(400).json({ success, message: 'Please add at least one doctor before submitting' });
    }
    if (!hospital.pricing?.consultation && !hospital.pricing?.general_bed_per_day) {
      return res.status(400).json({ success, message: 'Please add pricing details before submitting' });
    }
    
    hospital.is_verified = false;
    hospital.verification_status = 'pending';
    hospital.verification_submitted_at = new Date();
    hospital.updated_at = new Date();
    await hospital.save();
    
    res.json({ success, message: 'Hospital submitted for verification. We will review and activate within 24-48 hours.' });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// ============================================
// 🆕 CITY TEMPLATE SYSTEM
// ============================================

// Get available cities with templates
router.get('/template/cities', async (req, res) => {
  try {
    const cityTemplateService = require('../services/cityTemplateService');
    const cities = cityTemplateService.getAvailableCities();
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Get template for a city (what data will be pre-filled)
router.get('/template/city/', async (req, res) => {
  try {
    const cityTemplateService = require('../services/cityTemplateService');
    const { sections } = req.query;
    const sectionList = sections ? sections.split(',') : [];
    const template = cityTemplateService.getPartialTemplate(req.params.city, sectionList);
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Preview template before applying
router.get('/template/city//preview', async (req, res) => {
  try {
    const cityTemplateService = require('../services/cityTemplateService');
    const template = cityTemplateService.getCityTemplate(req.params.city);
    res.json({
      success,
      data: {
        city.params.city,
        preview: {
          accreditations: `${template.commonAccreditations.length} accreditations (e.g., ${template.commonAccreditations.slice(0, 3).join(', ')})`,
          facilities: `${template.commonFacilities.length} facilities (e.g., ${template.commonFacilities.slice(0, 3).map(f => f.name).join(', ')})`,
          insurance: `${template.commonInsurance.length} insurance partners`,
          schemes: `${template.commonSchemes.length} government schemes`,
          tests: `${(template.commonTests || []).length} lab tests`,
          packages: `${(template.commonPackages || []).length} health packages`
        },
        sampleData: {
          accreditations.commonAccreditations.slice(0, 3),
          facilities.commonFacilities.slice(0, 5),
          insurance.commonInsurance.slice(0, 3),
          schemes.commonSchemes.slice(0, 3)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Apply city template to hospital
router.post('/template/city//apply', authenticateHospital, async (req, res) => {
  try {
    const cityTemplateService = require('../services/cityTemplateService');
    const { sections } = req.body;
    const result = await cityTemplateService.applyTemplate(
      req.user._id,
      req.params.city,
      sections || []
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});
// ============================================
// LAB TESTS, PACKAGES, AMBULANCE ENDPOINTS
// ============================================

// Save lab tests
router.put('/lab-tests', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    hospital.diagnostics = hospital.diagnostics || {};
    hospital.diagnostics.tests = req.body.tests || [];
    await hospital.save();
    res.json({ success, message: 'Lab tests saved' });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Save health packages
router.put('/packages', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    hospital.pricing = hospital.pricing || {};
    hospital.pricing.health_packages = req.body.packages || [];
    await hospital.save();
    res.json({ success, message: 'Packages saved' });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Save ambulance fleet
router.put('/ambulance', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    hospital.ambulance_fleet = req.body.fleet || [];
    await hospital.save();
    res.json({ success, message: 'Ambulance fleet saved' });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Save diseases & procedures
router.put('/diseases', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user._id);
    hospital.diseases_treated = req.body.diseases || [];
    hospital.procedures_available = req.body.procedures || [];
    await hospital.save();
    res.json({ success, message: 'Diseases & procedures saved' });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Deactivate hospital account
router.put('/deactivate', authenticateHospital, async (req, res) => {
  try {
    await Hospital.findByIdAndUpdate(req.user._id, { 
      is_active, 
      deactivated_atDate(),
      deactivation_reason.body.reason || 'Requested by hospital'
    });
    res.json({ success, message: 'Account deactivated. You can reactivate by contacting support.' });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Delete hospital account (soft delete - keeps data for 30 days)
router.delete('/delete', authenticateHospital, async (req, res) => {
  try {
    await Hospital.findByIdAndUpdate(req.user._id, { 
      is_active, 
      marked_for_deletion,
      deletion_requested_atDate(),
      deletion_scheduled_atDate(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    res.json({ success, message: 'Account deletion requested. Data will be removed in 30 days.' });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Get stats by provider ID
router.get('//stats', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.providerId).select('doctors beds ratings');
    res.json({
      success,
      data: {
        totalDoctors?.doctors?.length || 0,
        totalBeds?.beds?.total || 0,
        availableBeds?.beds?.available || 0,
        rating?.ratings?.average || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Get bookings by provider ID
router.get('//bookings', authenticateHospital, async (req, res) => {
  try {
    const bookings = await Booking.find({ hospitalId.params.providerId })
      .sort({ createdAt: -1 }).limit(parseInt(req.query.limit) || 5).lean();
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Get doctors by provider ID (fallback)
router.get('//doctors', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.providerId).select('doctors');
    res.json({ success, data?.doctors || [] });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// BED MANAGEMENT
// ============================================

// Update bed status
// Update beds by provider ID
router.put('/id//beds', authenticateHospital, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.providerId);
    if (!hospital) return res.status(404).json({ success, message: 'Hospital not found' });
    
    const b = req.body.beds || {};
    
    hospital.beds = {
      total.total ?? hospital.beds?.total ?? 0,
      available.available ?? hospital.beds?.available ?? 0,
      general_ward.general_ward ?? hospital.beds?.general_ward,
      twin_sharing.twin_sharing ?? hospital.beds?.twin_sharing,
      single_room.single_room ?? hospital.beds?.single_room,
      deluxe.deluxe ?? hospital.beds?.deluxe,
      super_deluxe.super_deluxe ?? hospital.beds?.super_deluxe,
      suite.suite ?? hospital.beds?.suite,
      maternity.maternity ?? hospital.beds?.maternity,
      post_op.post_op ?? hospital.beds?.post_op,
      icu_available.icu_available ?? hospital.beds?.icu_available ?? 0,
      icu_total.icu_total ?? hospital.beds?.icu_total ?? 0,
      ventilator_available.ventilator_available ?? hospital.beds?.ventilator_available ?? 0,
      ventilator_total.ventilator_total ?? hospital.beds?.ventilator_total ?? 0,
      nicu_beds.nicu_beds ?? hospital.beds?.nicu_beds,
      picu_beds.picu_beds ?? hospital.beds?.picu_beds,
      hdu_beds.hdu_beds ?? hospital.beds?.hdu_beds,
      emergency_beds.emergency_beds ?? hospital.beds?.emergency_beds ?? 0,
      isolation_beds.isolation_beds ?? hospital.beds?.isolation_beds ?? 0,
      day_care_beds.day_care_beds ?? hospital.beds?.day_care_beds,
      last_updatedDate(),
      update_method.body.updateMethod || 'web_portal'
    };
    
    await hospital.save();
    res.json({ success, data.beds, message: 'Beds updated' });
  } catch (error) {
    res.status(400).json({ success, message.message });
  }
});

// Get available services for corporate plan
router.get('/corporate/services', authenticateHospital, async (req, res) => {
  try {
    const hospitalId = req.user._id;
    const TestMaster = require('../models/TestMaster');
    const TestPricing = require('../models/TestPricing');    
    const labTests = await TestPricing.find({ provider_id})
      .populate('test_id', 'test_name test_code major_category')
      .lean();
    
    const labServices = labTests.map(t => ({
      _id.test_id?._id,
      code.test_id?.test_code || '',
      name.test_id?.test_name || '',
      category.test_id?.major_category || 'Lab Test',
      type: 'lab',
      price.discounted_price || t.mrp || 0
    }));

    const hospital = await Hospital.findById(hospitalId).select('pricing');
    const opdServices = [];
    if (hospital?.pricing?.opd_general) opdServices.push({ code: 'OPD-GEN', name: 'General OPD', category: 'OPD', type: 'opd', price.pricing.opd_general });
    if (hospital?.pricing?.opd_specialist) opdServices.push({ code: 'OPD-SPC', name: 'Specialist OPD', category: 'OPD', type: 'opd', price.pricing.opd_specialist });

    const additionalServices = [
      { code: 'DEN-001', name: 'Dental Checkup', category: 'Dental', type: 'dental', price: 0 },
      { code: 'EYE-001', name: 'Eye Test', category: 'Eye Care', type: 'eye', price: 0 },
      { code: 'AYU-001', name: 'Ayurveda Consultation', category: 'Ayurveda', type: 'ayurveda', price: 0 },
      { code: 'MEN-001', name: 'Counseling Session', category: 'Mental Wellness', type: 'mental', price: 0 },
      { code: 'PHY-001', name: 'Physiotherapy', category: 'Physiotherapy', type: 'physio', price: 0 },
      { code: 'VAC-001', name: 'Vaccination', category: 'Vaccination', type: 'vaccine', price: 0 },
      { code: 'CAM-001', name: 'On-site Health Camp', category: 'Health Camp', type: 'camp', price: 0 },
    ];

    res.json({ success, data: { lab, opd, additional} });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

module.exports = router;



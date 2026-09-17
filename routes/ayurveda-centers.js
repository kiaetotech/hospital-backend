const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const WellnessCenter = require('../models/WellnessCenter');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital_platform_secret_key_2024';

// ============================================
// CENTER REGISTRATION
// ============================================
router.post('/register', async (req, res) => {
  try {
    const { name, phone, email, password, type, description, address, bedCount, panchakarmaRooms, facilities } = req.body;
    
    const existing = await WellnessCenter.findOne({ $or: [{ phone }, { email }] });
    if (existing) return res.status(400).json({ success: false, error: 'Center already registered' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const center = new WellnessCenter({
      name, phone, email, password: hashedPassword,
      type: type || 'Wellness Center',
      description,
      address: address || {},
      bedCount, panchakarmaRooms,
      facilities: facilities || [],
      verificationStatus: 'pending'
    });
    
    await center.save();
    res.status(201).json({ success: true, message: 'Registration submitted for verification', centerId: center._id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CENTER LOGIN
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const center = await WellnessCenter.findOne({ phone });
    if (!center) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, center.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    
    if (center.verificationStatus !== 'approved') {
      return res.status(403).json({ success: false, error: 'Account not approved. Status: ' + center.verificationStatus });
    }
    
    const token = jwt.sign({ id: center._id, role: 'wellness_center' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, center: { id: center._id, name: center.name, type: center.type } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CENTER DASHBOARD
// ============================================
router.get('/dashboard/:centerId', async (req, res) => {
  try {
    const center = await WellnessCenter.findById(req.params.centerId)
      .select('-password')
      .populate('doctors', 'name specialization');
    
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });
    
    res.json({ success: true, data: center });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// UPDATE CENTER PROFILE
// ============================================
router.put('/:centerId/profile', async (req, res) => {
  try {
    // Auth check
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    if (decoded.id !== req.params.centerId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const {
      name,
      tagline,
      description,
      established,
      facilities,
      photos,
      coverPhoto,
      address,
      bedCount,
      panchakarmaRooms,
      doctorCount,
      staffCount,
      nearestAirport,
      nearestRailway,
      distanceFromAirport,
      distanceFromRailway,
      googleMapsUrl,
      contact,
      mealOptions,
      dietaryAccommodations
    } = req.body;

    const center = await WellnessCenter.findById(req.params.centerId);
    if (!center) {
      return res.status(404).json({ success: false, error: 'Center not found' });
    }

    // Update fields
    if (name !== undefined) center.name = name;
    if (tagline !== undefined) center.tagline = tagline;
    if (description !== undefined) center.description = description;
    if (established !== undefined) center.established = established;
    if (facilities !== undefined) center.facilities = facilities;
    if (photos !== undefined) center.photos = photos;
    if (coverPhoto !== undefined) center.coverPhoto = coverPhoto;
    if (address !== undefined) center.address = { ...center.address, ...address };
    if (bedCount !== undefined) center.bedCount = bedCount;
    if (panchakarmaRooms !== undefined) center.panchakarmaRooms = panchakarmaRooms;
    if (doctorCount !== undefined) center.doctorCount = doctorCount;
    if (staffCount !== undefined) center.staffCount = staffCount;
    if (nearestAirport !== undefined) center.nearestAirport = nearestAirport;
    if (nearestRailway !== undefined) center.nearestRailway = nearestRailway;
    if (distanceFromAirport !== undefined) center.distanceFromAirport = distanceFromAirport;
    if (distanceFromRailway !== undefined) center.distanceFromRailway = distanceFromRailway;
    if (googleMapsUrl !== undefined) center.googleMapsUrl = googleMapsUrl;
    if (contact !== undefined) center.contact = { ...center.contact, ...contact };
    if (mealOptions !== undefined) center.mealOptions = mealOptions;
    if (dietaryAccommodations !== undefined) center.dietaryAccommodations = dietaryAccommodations;

    center.updatedAt = new Date();
    await center.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: center
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ROOM TYPES CRUD
// ============================================
router.post('/:centerId/rooms', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.id !== req.params.centerId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const { name, type, pricePerNight, capacity, totalRooms, amenities, photos, description } = req.body;

    if (!name || !pricePerNight) {
      return res.status(400).json({ success: false, error: 'Name and price are required' });
    }

    const center = await WellnessCenter.findById(req.params.centerId);
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });

    center.roomTypes.push({
      name,
      type: type || 'Standard',
      pricePerNight,
      capacity: capacity || 1,
      totalRooms: totalRooms || 1,
      amenities: amenities || [],
      photos: photos || [],
      description: description || '',
      isActive: true
    });

    await center.save();
    res.json({ success: true, data: center.roomTypes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:centerId/rooms/:roomId', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.id !== req.params.centerId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const center = await WellnessCenter.findById(req.params.centerId);
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });

    const room = center.roomTypes.id(req.params.roomId);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

    Object.assign(room, req.body);
    await center.save();

    res.json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:centerId/rooms/:roomId', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.id !== req.params.centerId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const center = await WellnessCenter.findById(req.params.centerId);
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });

    center.roomTypes.pull(req.params.roomId);
    await center.save();

    res.json({ success: true, message: 'Room deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// POLICIES UPDATE
// ============================================
router.put('/:centerId/policies', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.id !== req.params.centerId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const center = await WellnessCenter.findById(req.params.centerId);
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });

    center.policies = { ...center.policies, ...req.body };
    center.updatedAt = new Date();
    await center.save();

    res.json({ success: true, message: 'Policies updated', data: center.policies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PACKAGE SCHEDULE UPDATE
// ============================================
router.put('/:centerId/packages/:packageId/schedule', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.id !== req.params.centerId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const { programSchedule } = req.body;
    if (!Array.isArray(programSchedule)) {
      return res.status(400).json({ success: false, error: 'programSchedule must be an array' });
    }

    const center = await WellnessCenter.findById(req.params.centerId);
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });

    const pkg = center.packages.id(req.params.packageId);
    if (!pkg) return res.status(404).json({ success: false, error: 'Package not found' });

    pkg.programSchedule = programSchedule;
    await center.save();

    res.json({ success: true, data: pkg.programSchedule });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ACCREDITATIONS CRUD
// ============================================
router.post('/:centerId/accreditations', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.id !== req.params.centerId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const center = await WellnessCenter.findById(req.params.centerId);
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });

    center.accreditations.push({
      name: req.body.name,
      number: req.body.number,
      issuedBy: req.body.issuedBy,
      validUntil: req.body.validUntil,
      documentUrl: req.body.documentUrl,
      verified: false
    });

    await center.save();
    res.json({ success: true, data: center.accreditations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MIDDLEWARE: Verify center auth
// ============================================
const authenticateCenter = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    if (decoded.role !== 'wellness_center') {
      return res.status(403).json({ success: false, error: 'Center access required' });
    }

    if (decoded.id !== req.params.centerId) {
      return res.status(403).json({ success: false, error: 'You can only modify your own packages' });
    }

    const center = await WellnessCenter.findById(decoded.id);
    if (!center) {
      return res.status(404).json({ success: false, error: 'Center not found' });
    }
    if (!center.isActive || center.verificationStatus !== 'approved') {
      return res.status(403).json({ success: false, error: 'Center account is not active' });
    }

    req.center = center;
    next();
  } catch (error) {
    console.error('Center auth error:', error);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

// ============================================
// VALIDATOR: Package input
// ============================================
const validatePackageInput = (data) => {
  const errors = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 3) {
    errors.push('Package name must be at least 3 characters');
  }
  if (data.name && data.name.length > 100) {
    errors.push('Package name cannot exceed 100 characters');
  }

  const duration = parseInt(data.duration);
  if (!duration || duration < 1 || duration > 365) {
    errors.push('Duration must be between 1 and 365 days');
  }

  const price = parseInt(data.price);
  if (!price || price < 100 || price > 10000000) {
    errors.push('Price must be between ₹100 and ₹1,00,00,000');
  }

  if (data.discountPrice) {
    const dp = parseInt(data.discountPrice);
    if (dp < 100) errors.push('Discount price must be at least ₹100');
    if (dp >= price) errors.push('Discount price must be less than original price');
  }

  if (data.maxCapacity) {
    const mc = parseInt(data.maxCapacity);
    if (mc < 1 || mc > 500) errors.push('Max capacity must be between 1 and 500');
  }

  if (data.description && data.description.length > 3000) {
    errors.push('Description cannot exceed 3000 characters');
  }

  if (data.therapies && !Array.isArray(data.therapies)) errors.push('Therapies must be an array');
  if (data.inclusions && !Array.isArray(data.inclusions)) errors.push('Inclusions must be an array');
  if (data.exclusions && !Array.isArray(data.exclusions)) errors.push('Exclusions must be an array');

  if (Array.isArray(data.therapies) && data.therapies.length > 30) errors.push('Too many therapies (max 30)');
  if (Array.isArray(data.inclusions) && data.inclusions.length > 30) errors.push('Too many inclusions (max 30)');

  return errors;
};

// ============================================
// SANITIZER: Clean package input
// ============================================
const sanitizePackageInput = (data) => {
  const safe = {};

  if (data.name) safe.name = String(data.name).trim().slice(0, 100);
  if (data.duration) safe.duration = parseInt(data.duration);
  if (data.price) safe.price = parseInt(data.price);
  if (data.discountPrice) safe.discountPrice = parseInt(data.discountPrice);
  if (data.description) safe.description = String(data.description).trim().slice(0, 3000);
  if (data.shortDescription) safe.shortDescription = String(data.shortDescription).trim().slice(0, 200);
  if (data.maxCapacity) safe.maxCapacity = parseInt(data.maxCapacity);
  if (typeof data.isActive === 'boolean') safe.isActive = data.isActive;

  if (Array.isArray(data.therapies)) {
    safe.therapies = data.therapies
      .filter(t => typeof t === 'string' && t.trim())
      .map(t => String(t).trim().slice(0, 100))
      .slice(0, 30);
  }
  if (Array.isArray(data.inclusions)) {
    safe.inclusions = data.inclusions
      .filter(t => typeof t === 'string' && t.trim())
      .map(t => String(t).trim().slice(0, 200))
      .slice(0, 30);
  }
  if (Array.isArray(data.exclusions)) {
    safe.exclusions = data.exclusions
      .filter(t => typeof t === 'string' && t.trim())
      .map(t => String(t).trim().slice(0, 200))
      .slice(0, 30);
  }

  const flags = ['includesConsultation', 'includesAccommodation', 'includesMeals',
                 'includesMedicines', 'includesYoga', 'includesAirportTransfer',
                 'includesFollowUp', 'includesDiagnostics'];
  flags.forEach(flag => {
    if (typeof data[flag] === 'boolean') safe[flag] = data[flag];
  });

  if (Array.isArray(data.programSchedule)) {
    safe.programSchedule = data.programSchedule
      .filter(d => d && typeof d.day === 'number')
      .map(d => ({
        day: parseInt(d.day),
        title: String(d.title || '').slice(0, 200),
        description: String(d.description || '').slice(0, 1000),
        therapies: Array.isArray(d.therapies)
          ? d.therapies.filter(t => typeof t === 'string').map(t => String(t).slice(0, 100))
          : []
      }))
      .slice(0, 60);
  }

  return safe;
};

// ============================================
// CREATE PACKAGE (Production)
// ============================================
router.post('/packages/:centerId', authenticateCenter, async (req, res) => {
  try {
    const center = req.center;

    const errors = validatePackageInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const cleanData = sanitizePackageInput(req.body);

    const exists = center.packages.some(
      p => p.name.toLowerCase() === cleanData.name.toLowerCase() && !p.deleted
    );
    if (exists) {
      return res.status(400).json({ success: false, error: 'A package with this name already exists' });
    }

    const newPackage = {
      ...cleanData,
      approvalStatus: 'pending',
      submittedAt: new Date(),
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: '',
      approvalNotes: '',
      versionHistory: [{
        version: 1,
        changedAt: new Date(),
        changedBy: 'center',
        changeType: 'created',
        snapshot: { ...cleanData }
      }],
      deleted: false,
      deletedAt: null,
      deletedBy: null
    };

    center.packages.push(newPackage);
    await center.save();

    const added = center.packages[center.packages.length - 1];

    res.status(201).json({
      success: true,
      message: 'Package submitted for admin approval',
      data: added
    });
  } catch (error) {
    console.error('Package create error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// UPDATE PACKAGE (Production)
// ============================================
router.put('/packages/:centerId/:packageId', authenticateCenter, async (req, res) => {
  try {
    const center = req.center;
    const pkg = center.packages.id(req.params.packageId);

    if (!pkg) return res.status(404).json({ success: false, error: 'Package not found' });
    if (pkg.deleted) return res.status(400).json({ success: false, error: 'Cannot edit a deleted package' });

    const errors = validatePackageInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const cleanData = sanitizePackageInput(req.body);

    if (cleanData.name) {
      const collision = center.packages.some(
        p => p._id.toString() !== req.params.packageId &&
             p.name.toLowerCase() === cleanData.name.toLowerCase() &&
             !p.deleted
      );
      if (collision) {
        return res.status(400).json({ success: false, error: 'A package with this name already exists' });
      }
    }

    const beforeSnapshot = {
      name: pkg.name,
      duration: pkg.duration,
      price: pkg.price,
      discountPrice: pkg.discountPrice,
      description: pkg.description,
      therapies: [...(pkg.therapies || [])],
      inclusions: [...(pkg.inclusions || [])],
      exclusions: [...(pkg.exclusions || [])],
      maxCapacity: pkg.maxCapacity,
      isActive: pkg.isActive
    };

    Object.keys(cleanData).forEach(key => {
      pkg[key] = cleanData[key];
    });

    pkg.approvalStatus = 'pending';
    pkg.submittedAt = new Date();
    pkg.approvedAt = null;
    pkg.approvedBy = null;
    pkg.rejectedAt = null;
    pkg.rejectedBy = null;
    pkg.rejectionReason = '';
    pkg.approvalNotes = '';

    if (!pkg.versionHistory) pkg.versionHistory = [];
    pkg.versionHistory.push({
      version: pkg.versionHistory.length + 1,
      changedAt: new Date(),
      changedBy: 'center',
      changeType: 'updated',
      before: beforeSnapshot,
      after: { ...cleanData }
    });

    await center.save();

    res.json({
      success: true,
      message: 'Package updated and sent for re-approval',
      data: pkg
    });
  } catch (error) {
    console.error('Package update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DELETE PACKAGE (Soft Delete)
// ============================================
router.delete('/packages/:centerId/:packageId', authenticateCenter, async (req, res) => {
  try {
    const center = req.center;
    const pkg = center.packages.id(req.params.packageId);

    if (!pkg) return res.status(404).json({ success: false, error: 'Package not found' });
    if (pkg.deleted) return res.status(400).json({ success: false, error: 'Package already deleted' });

    pkg.deleted = true;
    pkg.deletedAt = new Date();
    pkg.deletedBy = 'center';
    pkg.isActive = false;
    pkg.approvalStatus = 'rejected';
    pkg.rejectionReason = 'Deleted by center';

    if (!pkg.versionHistory) pkg.versionHistory = [];
    pkg.versionHistory.push({
      version: pkg.versionHistory.length + 1,
      changedAt: new Date(),
      changedBy: 'center',
      changeType: 'deleted'
    });

    await center.save();

    res.json({ success: true, message: 'Package deleted' });
  } catch (error) {
    console.error('Package delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN: PACKAGE APPROVAL ROUTES
// ============================================

// Get all pending packages across all centers
router.get('/admin/packages/pending', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  
  try {
    const centers = await WellnessCenter.find({
      'packages.approvalStatus': 'pending'
    }).select('name phone email address packages');
    
    const pendingPackages = [];
    centers.forEach(center => {
      center.packages
        .filter(pkg => pkg.approvalStatus === 'pending' && !pkg.deleted)
        .forEach(pkg => {
          pendingPackages.push({
            centerId: center._id,
            centerName: center.name,
            centerCity: center.address?.city,
            centerPhone: center.phone,
            packageId: pkg._id,
            name: pkg.name,
            duration: pkg.duration,
            price: pkg.price,
            discountPrice: pkg.discountPrice,
            therapies: pkg.therapies,
            inclusions: pkg.inclusions,
            shortDescription: pkg.shortDescription,
            description: pkg.description,
            maxCapacity: pkg.maxCapacity,
            submittedAt: pkg.submittedAt,
            approvalStatus: pkg.approvalStatus
          });
        });
    });
    
    // Sort by newest first
    pendingPackages.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    
    res.json({ 
      success: true, 
      count: pendingPackages.length,
      data: pendingPackages 
    });
  } catch (error) {
    console.error('Pending packages error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve a package
router.put('/admin/packages/:centerId/:packageId/approve', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  
  try {
    const center = await WellnessCenter.findById(req.params.centerId);
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });
    
    const pkg = center.packages.id(req.params.packageId);
    if (!pkg) return res.status(404).json({ success: false, error: 'Package not found' });
    
    pkg.approvalStatus = 'approved';
    pkg.approvedAt = new Date();
    pkg.rejectionReason = '';
    pkg.approvalNotes = req.body.notes || '';
    
    await center.save();
    
    res.json({ 
      success: true, 
      message: 'Package approved',
      data: pkg 
    });
  } catch (error) {
    console.error('Package approval error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject a package
router.put('/admin/packages/:centerId/:packageId/reject', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required' });
    }
    
    const center = await WellnessCenter.findById(req.params.centerId);
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });
    
    const pkg = center.packages.id(req.params.packageId);
    if (!pkg) return res.status(404).json({ success: false, error: 'Package not found' });
    
    pkg.approvalStatus = 'rejected';
    pkg.rejectedAt = new Date();
    pkg.rejectionReason = reason;
    
    await center.save();
    
    res.json({ 
      success: true, 
      message: 'Package rejected',
      data: pkg 
    });
  } catch (error) {
    console.error('Package rejection error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get count of pending packages (for dashboard badge)
router.get('/admin/packages/pending-count', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  
  try {
    const centers = await WellnessCenter.find({
      'packages.approvalStatus': 'pending'
    }).select('packages');
    
    let count = 0;
    centers.forEach(center => {
      count += center.packages.filter(pkg => pkg.approvalStatus === 'pending' && !pkg.deleted).length;
    });
    
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN: VERIFY CENTER
// ============================================
router.put('/admin/verify/:centerId', async (req, res) => {
  // Check admin key
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  try {
    const { status, rejectionReason } = req.body;
    const center = await WellnessCenter.findByIdAndUpdate(req.params.centerId, {
      verificationStatus: status,
      isActive: status === 'approved',
      verifiedAt: new Date(),
      rejectionReason: status === 'rejected' ? rejectionReason : null
    }, { new: true });
    
    if (!center) return res.status(404).json({ success: false, error: 'Center not found' });
    res.json({ success: true, message: `Center ${status}`, data: center });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN: PENDING CENTERS
// ============================================
router.get('/admin/pending', async (req, res) => {
  try {
    const centers = await WellnessCenter.find({ verificationStatus: 'pending' })
      .select('name phone type address.city createdAt')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: centers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADD THE NEW ENDPOINT HERE 👇
router.get('/admin/all', async (req, res) => {
  try {
    const centers = await WellnessCenter.find()
      .select('name phone email type address verificationStatus isActive createdAt')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: centers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PUBLIC: LIST CENTERS
// ============================================
router.get('/', async (req, res) => {
  try {
    var { city, type, page = 1, limit = 20 } = req.query;
    var query = { isActive: true, verificationStatus: 'approved' };
    if (city) query['address.city'] = { $regex: city, $options: 'i' };
    if (type) query.type = type;
    
    var centers = await WellnessCenter.find(query).select('-password').skip((page - 1) * limit).limit(parseInt(limit)).lean();
    var total = await WellnessCenter.countDocuments(query);
    
    res.json({ success: true, data: centers, total: total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ONE-TIME MIGRATION: Add approvalStatus to old packages
// ============================================
router.post('/admin/migrate/packages-approval', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  
  try {
    const centers = await WellnessCenter.find({});
    let updated = 0;
    
    for (const center of centers) {
      let changed = false;
      center.packages.forEach(pkg => {
        if (!pkg.approvalStatus) {
          pkg.approvalStatus = 'pending';
          pkg.submittedAt = pkg.submittedAt || new Date();
          changed = true;
          updated++;
        }
      });
      if (changed) await center.save();
    }
    
    res.json({ 
      success: true, 
      message: `Migration complete. Updated ${updated} packages.`,
      totalCenters: centers.length
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// TEMP DEBUG - Remove after investigation
router.get('/debug-raw/:centerId', async (req, res) => {
  try {
    const center = await WellnessCenter.findById(req.params.centerId).lean();
    if (!center) return res.status(404).json({ error: 'Center not found' });
    
    const packages = center.packages || [];
    
    res.json({
      centerName: center.name,
      centerId: center._id,
      updatedAt: center.updatedAt,
      packagesCount: packages.length,
      packages: packages.map(p => ({
        id: p._id,
        name: p.name,
        approvalStatus: p.approvalStatus || 'MISSING',
        deleted: p.deleted === true,
        isActive: p.isActive,
        price: p.price,
        duration: p.duration
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

module.exports = router;
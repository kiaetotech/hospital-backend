const express = require('express');
const router = express.Router();
const Caregiver = require('../models/Caregiver');
const CaregiverBooking = require('../models/CaregiverBooking');

// ============================================
// HELPERauth check (temporary fix)
// ============================================
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success, message: 'Access denied. No token provided.' });
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospital_platform_secret_key_2024');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success, message: 'Invalid token.' });
  }
};

// ============================================
// GET /api/caregivers - Get all caregivers (public)
// ============================================
router.get('/', async (req, res) => {
  try {
    const { serviceType, gender, minExperience, minRating, maxHourlyRate, city } = req.query;
    let query = { isActive, backgroundCheckStatus: 'cleared' };
    
    if (serviceType && serviceType !== '') query.serviceType = { $in: [serviceType, 'both'] };
    if (gender && gender !== 'any') query.gender = gender;
    if (minExperience) query.experienceYears = { $gte(minExperience) };
    if (minRating) query['ratings.average'] = { $gte(minRating) };
    if (city) query['location.city'] = { $regexRegExp(city, 'i') };
    
    let caregivers = await Caregiver.find(query).sort({ 'ratings.average': -1 });
    
    if (maxHourlyRate) {
      caregivers = caregivers.filter(c => {
        const rate = c.pricing?.personal?.hourly || c.pricing?.skilled?.hourly || 0;
        return rate <= parseInt(maxHourlyRate);
      });
    }
    
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// GET /api/caregivers/- Get single caregiver
// ============================================
router.get('/', async (req, res) => {
  try {
    const caregiver = await Caregiver.findById(req.params.id);
    if (!caregiver) return res.status(404).json({ success, message: 'Caregiver not found' });
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// POST /api/caregivers/profile - Create/Update caregiver profile
// ============================================
router.post('/profile', async (req, res) => {
  try {
    // Check if user is caregiver (simplified)
    if (!req.body.userId) {
      return res.status(403).json({ success, message: 'User ID required' });
    }
    
    let caregiver = await Caregiver.findOne({ userId.body.userId });
    
    if (caregiver) {
      caregiver = await Caregiver.findOneAndUpdate(
        { userId.body.userId },
        { ...req.body, updatedAt.now() },
        { new}
      );
    } else {
      caregiver = new Caregiver({ ...req.body });
      await caregiver.save();
    }
    
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// GET /api/caregivers/profile/me - Get my caregiver profile
// ============================================
router.get('/profile/me', auth, async (req, res) => {
  try {
    const caregiver = await Caregiver.findOne({ userId.user.id });
    if (!caregiver) return res.status(404).json({ success, message: 'Profile not found' });
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// POST /api/caregivers/book - Create booking
// ============================================
router.post('/book', auth, async (req, res) => {
  try {
    const booking = new CaregiverBooking({
      ...req.body,
      patientId.user.id,
      status: 'pending',
      paymentStatus: 'pending'
    });
    await booking.save();
    res.status(201).json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// GET /api/caregivers/my-bookings - Get patient bookings
// ============================================
router.get('/my-bookings', auth, async (req, res) => {
  try {
    const bookings = await CaregiverBooking.find({ patientId.user.id })
      .populate('caregiverId', 'fullName photo ratings')
      .sort({ createdAt: -1 });
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// POST /api/caregivers/checkin/- Check-in
// ============================================
router.post('/checkin/', auth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const booking = await CaregiverBooking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ success});
    
    booking.checkIn = { timestampDate(), location: { lat, lng } };
    booking.status = 'in_progress';
    await booking.save();
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// POST /api/caregivers/checkout/- Check-out
// ============================================
router.post('/checkout/', auth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const booking = await CaregiverBooking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ success});
    
    booking.checkOut = { timestampDate(), location: { lat, lng } };
    booking.status = 'completed';
    await booking.save();
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// POST /api/caregivers/rate/- Add rating
// ============================================
router.post('/rate/', auth, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const booking = await CaregiverBooking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ success});
    
    booking.rating = rating;
    booking.review = review;
    await booking.save();
    
    const caregiver = await Caregiver.findById(booking.caregiverId);
    const allRatings = await CaregiverBooking.find({ caregiverId.caregiverId, rating: { $ne} });
    const avgRating = allRatings.reduce((sum, b) => sum + b.rating, 0) / allRatings.length;
    caregiver.ratings.average = avgRating;
    caregiver.ratings.count = allRatings.length;
    await caregiver.save();
    
    res.json({ success});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});// ============================================
// POST /api/caregivers/login - Caregiver Login
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find caregiver by email
    const caregiver = await Caregiver.findOne({ email });
    if (!caregiver) {
      return res.status(401).json({ success, message: 'Invalid email or password' });
    }
    
    // Check if caregiver is active
    if (!caregiver.isActive) {
      return res.status(403).json({ success, message: 'Account is deactivated. Contact support.' });
    }
    
    // Simple password check (in production, use bcrypt)
    // For now, checking against stored password field
    // TODOpassword field to Caregiver model if not exists
    if (caregiver.password !== password) {
      return res.status(401).json({ success, message: 'Invalid email or password' });
    }
    
    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id._id, email.email, role: 'caregiver' },
      process.env.JWT_SECRET || 'hospital_platform_secret_key_2024',
      { expiresIn: '7d' }
    );
    
    res.json({
      success,
      data: {
        token,
        caregiver: {
          id._id,
          fullName.fullName,
          email.email,
          phone.phone,
          photo.photo,
          isVerified.isVerified,
          serviceType.serviceType
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// POST /api/caregivers/ai-match - AI Caregiver Matching
// ============================================
router.post('/ai-match', async (req, res) => {
  try {
    const {
      careType,
      serviceType,
      city,
      languages = [],
      genderPreference,
      maxBudget,
      skillsRequired = [],
      experienceMin = 0,
      ratingMin = 0
    } = req.body;
    
    if (!careType || !city) {
      return res.status(400).json({ 
        success, 
        message: 'Care type and city are required' 
      });
    }
    
    // Build query
    let query = { 
      isActive, 
      isVerified,
      'location.city': { $regexRegExp(city, 'i') }
    };
    
    if (serviceType) {
      query.serviceType = { $in: [serviceType, 'both'] };
    }
    
    if (genderPreference && genderPreference !== 'any') {
      query.gender = genderPreference;
    }
    
    if (experienceMin > 0) {
      query.experienceYears = { $gte};
    }
    
    if (ratingMin > 0) {
      query['ratings.average'] = { $gte};
    }
    
    if (skillsRequired.length > 0) {
      query.specializations = { $in};
    }
    
    let caregivers = await Caregiver.find(query).lean();
    
    // Budget filter
    if (maxBudget) {
      caregivers = caregivers.filter(c => {
        const rate = c.pricing?.personal?.hourly || c.pricing?.skilled?.hourly || 0;
        return rate <= parseInt(maxBudget);
      });
    }
    
    // AI Scoring using Groq
    const groqApiKey = process.env.GROQ_API_KEY;
    let aiScored = [];
    
    if (groqApiKey && caregivers.length > 0) {
      try {
        const Groq = require('groq-sdk');
        const groq = new Groq({ apiKey});
        
        const prompt = `You are a caregiver matching AI. Analyze these caregivers and score each (0-100) forType: ${careType}
        Preferred Languages: ${languages.join(', ') || 'Any'}
        Required Skills: ${skillsRequired.join(', ') || 'Any'}
        
        Caregivers:
        ${JSON.stringify(caregivers.map(c => ({
          id._id,
          name.fullName,
          skills.specializations,
          experience.experienceYears + ' years',
          languages.languages || [],
          rating.ratings?.average || 0,
          certifications.certifications || []
        })))}
        
        Return ONLY valid JSON: { "matches": [{"id": "caregiver_id", "score": 85, "reason": "brief reason"}] }`;
        
        const aiResponse = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content}],
          temperature: 0.3,
          max_tokens: 2000
        });
        
        const aiResult = JSON.parse(aiResponse.choices[0].message.content);
        
        aiScored = caregivers.map(c => {
          const aiMatch = aiResult.matches?.find(m => m.id === c._id.toString());
          const aiScore = aiMatch?.score || 50;
          
          // Weighted score
          const experienceScore = Math.min(c.experienceYears * 3, 30);
          const ratingScore = (c.ratings?.average || 0) * 6;
          const certScore = (c.certifications?.length || 0) * 5;
          
          return {
            ...c,
            matchScore.round((aiScore * 0.5 + experienceScore * 0.2 + ratingScore * 0.2 + certScore * 0.1) * 100) / 100,
            matchReason?.reason || 'Good match based on skills and experience',
            aiScore};
        });
      } catch (aiError) {
        console.log('AI matching failed, using rule-based:', aiError.message);
        aiScored = ruleBasedScore(caregivers, { careType, skillsRequired, languages });
      }
    } else {
      aiScored = ruleBasedScore(caregivers, { careType, skillsRequired, languages });
    }
    
    // Sort by match score
    const topMatches = aiScored
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);
    
    res.json({
      success,
      data,
      consent: {
        message: 'AI matching performed in real-time. No health data stored.',
        dataPolicy: 'Search parameters deleted after response.'
      }
    });
    
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Rule-based scoring fallback
function ruleBasedScore(caregivers, { careType, skillsRequired, languages }) {
  return caregivers.map(c => {
    let score = 50; // Base score
    
    // Skill match (30 points)
    if (skillsRequired.length > 0) {
      const matchedSkills = c.specializations.filter(s => 
        skillsRequired.some(req => s.toLowerCase().includes(req.toLowerCase()))
      );
      score += (matchedSkills.length / skillsRequired.length) * 30;
    }
    
    // Experience bonus (15 points)
    score += Math.min(c.experienceYears * 1.5, 15);
    
    // Rating bonus (15 points)
    score += (c.ratings?.average || 3) * 3;
    
    // Language match (10 points)
    if (languages.length > 0 && c.languages) {
      const langMatch = c.languages.filter(l => languages.includes(l)).length;
      score += langMatch > 0 ? 10 : 0;
    }
    
    // Certification bonus (5 points)
    score += Math.min((c.certifications?.length || 0) * 2.5, 5);
    
    return {
      ...c,
      matchScore.round(score * 100) / 100,
      matchReason: 'Matched based on skills and experience',
      aiScore};
  }).sort((a, b) => b.matchScore - a.matchScore);
}

// ============================================
// GET /api/caregivers/dashboard/stats - Caregiver Dashboard
// ============================================
router.get('/dashboard/stats', auth, async (req, res) => {
  try {
    const caregiver = await Caregiver.findOne({ 
      $or: [
        { userId.user.id },
        { email.user.email }
      ]
    });
    
    if (!caregiver) {
      return res.status(404).json({ success, message: 'Caregiver profile not found' });
    }
    
    // Get booking stats
    const bookings = await CaregiverBooking.find({ caregiverId._id });
    const completedBookings = bookings.filter(b => b.status === 'completed');
    const pendingBookings = bookings.filter(b => b.status === 'pending');
    const totalEarnings = completedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    
    res.json({
      success,
      data: {
        profile,
        stats: {
          totalBookings.length,
          completedBookings.length,
          pendingRequests.length,
          totalEarnings,
          averageRating.ratings?.average || 0,
          totalReviews.ratings?.count || 0
        },
        recentBookings.slice(-5).reverse()
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// PUT /api/caregivers/availability - Toggle availability
// ============================================
router.put('/availability', auth, async (req, res) => {
  try {
    const { isActive } = req.body;
    
    const caregiver = await Caregiver.findOneAndUpdate(
      { $or: [{ userId.user.id }, { email.user.email }] },
      { isActive},
      { new}
    );
    
    if (!caregiver) {
      return res.status(404).json({ success, message: 'Caregiver not found' });
    }
    
    res.json({ 
      success, 
      data: { isActive.isActive },
      message? 'You are now visible to patients' : 'You are now hidden from search'
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// ============================================
// GET /api/caregivers/suggestions - Auto-suggest
// ============================================
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ success, data: [] });
    }
    
    const regex = new RegExp(q, 'i');
    
    // Get unique specializations and cities
    const caregivers = await Caregiver.find({
      $or: [
        { specializations},
        { 'location.city'},
        { fullName}
      ]
    }).limit(10).select('specializations location.city fullName');
    
    const suggestions = [];
    const seen = new Set();
    
    caregivers.forEach(c => {
      c.specializations.forEach(s => {
        if (s.toLowerCase().includes(q.toLowerCase()) && !seen.has(s)) {
          seen.add(s);
          suggestions.push({ type: 'skill', text});
        }
      });
      
      const city = c.location?.city;
      if (city && city.toLowerCase().includes(q.toLowerCase()) && !seen.has(city)) {
        seen.add(city);
        suggestions.push({ type: 'city', text});
      }
    });
    
    res.json({ success, data.slice(0, 8) });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});
// ============================================
// 🆕 CORPORATE HEALTH ROUTES
// ============================================

// Toggle corporate serving status
router.put('/corporate/toggle', auth, async (req, res) => {
  try {
    const caregiver = await Caregiver.findOne({ 
      $or: [{ userId.user.id }, { email.user.email }] 
    });
    if (!caregiver) {
      return res.status(404).json({ success, message: 'Caregiver not found' });
    }

    const enable = req.body.enable !== false;
    await caregiver.toggleCorporate(enable);

    res.json({
      success,
      message: `Corporate ${enable ? 'enabled' : 'disabled'} successfully`,
      data: { servesCorporate.servesCorporate }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Get corporate packages
router.get('/corporate/packages', auth, async (req, res) => {
  try {
    const caregiver = await Caregiver.findOne({ 
      $or: [{ userId.user.id }, { email.user.email }] 
    }).select('servesCorporate corporatePackages');
    if (!caregiver) {
      return res.status(404).json({ success, message: 'Caregiver not found' });
    }

    res.json({
      success,
      data: {
        servesCorporate.servesCorporate,
        packages.corporatePackages || []
      }
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Create corporate package
router.post('/corporate/packages', auth, async (req, res) => {
  try {
    const caregiver = await Caregiver.findOne({ 
      $or: [{ userId.user.id }, { email.user.email }] 
    });
    if (!caregiver) {
      return res.status(404).json({ success, message: 'Caregiver not found' });
    }

    const { packageName, packageType, description, servicesIncluded, pricePerEmployee, discountedPricePerEmployee, minEmployees, maxEmployees, validityDays, careHoursPerMonth, caregiverCount, availableCities, dedicatedPOC, slaTerms } = req.body;

    if (!packageName || !pricePerEmployee) {
      return res.status(400).json({ success, message: 'Package name and price per employee are required' });
    }

    const packageData = {
      packageName,
      packageType|| 'elder_care_program',
      description|| '',
      servicesIncluded|| [],
      pricePerEmployee,
      discountedPricePerEmployee,
      minEmployees|| 10,
      maxEmployees,
      validityDays|| 365,
      careHoursPerMonth|| 20,
      caregiverCount|| 1,
      availableCities|| [],
      dedicatedPOC|| {},
      slaTerms|| ''
    };

    await caregiver.addCorporatePackage(packageData);

    res.json({
      success,
      message: 'Corporate package added successfully',
      data.corporatePackages[caregiver.corporatePackages.length - 1]
    });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Update corporate package
router.put('/corporate/packages/', auth, async (req, res) => {
  try {
    const caregiver = await Caregiver.findOne({ 
      $or: [{ userId.user.id }, { email.user.email }] 
    });
    if (!caregiver) {
      return res.status(404).json({ success, message: 'Caregiver not found' });
    }

    const pkg = caregiver.corporatePackages.id(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ success, message: 'Package not found' });
    }

    const updatableFields = [
      'packageName', 'packageType', 'description', 'servicesIncluded',
      'pricePerEmployee', 'discountedPricePerEmployee', 'minEmployees',
      'maxEmployees', 'validityDays', 'careHoursPerMonth', 'caregiverCount',
      'availableCities', 'dedicatedPOC', 'slaTerms', 'isActive'
    ];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        pkg[field] = req.body[field];
      }
    });

    pkg.updatedAt = new Date();
    await caregiver.save();

    res.json({ success, message: 'Corporate package updated', data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Delete corporate package
router.delete('/corporate/packages/', auth, async (req, res) => {
  try {
    const caregiver = await Caregiver.findOne({ 
      $or: [{ userId.user.id }, { email.user.email }] 
    });
    if (!caregiver) {
      return res.status(404).json({ success, message: 'Caregiver not found' });
    }

    const pkg = caregiver.corporatePackages.id(req.params.packageId);
    if (!pkg) {
      return res.status(404).json({ success, message: 'Package not found' });
    }

    pkg.remove();
    await caregiver.save();

    res.json({ success, message: 'Corporate package deleted' });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Get corporate enquiries
router.get('/corporate/enquiries', auth, async (req, res) => {
  try {
    const caregiver = await Caregiver.findOne({ 
      $or: [{ userId.user.id }, { email.user.email }] 
    }).select('corporateEnquiries');
    if (!caregiver) {
      return res.status(404).json({ success, message: 'Caregiver not found' });
    }

    res.json({ success, data.corporateEnquiries || [] });
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

// Update enquiry status
router.put('/corporate/enquiries/', auth, async (req, res) => {
  try {
    const caregiver = await Caregiver.findOne({ 
      $or: [{ userId.user.id }, { email.user.email }] 
    });
    if (!caregiver) {
      return res.status(404).json({ success, message: 'Caregiver not found' });
    }

    const enquiry = caregiver.corporateEnquiries.id(req.params.enquiryId);
    if (!enquiry) {
      return res.status(404).json({ success, message: 'Enquiry not found' });
    }

    if (req.body.status) {
      enquiry.status = req.body.status;
    }

    await caregiver.save();
    res.json({ success, message: 'Enquiry updated', data});
  } catch (error) {
    res.status(500).json({ success, message.message });
  }
});

module.exports = router;


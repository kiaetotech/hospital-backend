const express = require('express');
const router = express.Router();
const AyurvedaDoctor = require('../models/AyurvedaDoctor');

// ============================================
// 🆕 LOCATION-BASED DOCTOR SEARCH
// GET /api/ayurveda/search?lat=19.0760&lng=72.8777&radius=20&speciality=Panchakarma
// ============================================
router.get('/search', async (req, res) => {
  try {
    const { 
      lat, lng, 
      radius = 20,  // Default 20km radius
      specialization,
      minExperience,
      maxFee,
      languages,
      consultationType = 'online,clinic',
      sortBy = 'distance', // distance | rating | fee | experience
      page = 1,
      limit = 10
    } = req.query;

    // Build query
    const query = { 
      isActive: true, 
      verifiedKyc: true 
    };

    // 🆕 GEOSPATIAL QUERY
    if (lat && lng) {
      query['address.coordinates'] = {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseFloat(radius) * 1000 // Convert km to meters
        }
      };
    }

    // Filters
    if (specialization) {
      query.specialization = specialization;
    }
    if (minExperience) {
      query.experience = { $gte: parseInt(minExperience) };
    }
    if (maxFee) {
      query.consultationFee = { $lte: parseInt(maxFee) };
    }
    if (languages) {
      query.languages = { $in: languages.split(',') };
    }
    if (consultationType) {
      const types = consultationType.split(',');
      types.forEach(type => {
        query[`consultationTypes.${type}`] = true;
      });
    }

    // Sorting options
    let sortOptions = {};
    switch(sortBy) {
      case 'rating':
        sortOptions = { rating: -1 };
        break;
      case 'fee':
        sortOptions = { consultationFee: 1 };
        break;
      case 'experience':
        sortOptions = { experience: -1 };
        break;
      case 'distance':
      default:
        // Distance sorting is automatic with $nearSphere
        break;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 🆕 Execute query with distance calculation
    const doctors = await AyurvedaDoctor.aggregate([
      { $match: query },
      ...(lat && lng ? [{
        $addFields: {
          distance: {
            $round: [{
              $divide: [
                { 
                  $geoNear: {
                    near: { 
                      type: 'Point', 
                      coordinates: [parseFloat(lng), parseFloat(lat)] 
                    },
                    distanceField: 'calculatedDistance',
                    spherical: true,
                    query: query
                  }
                },
                1000 // Convert to km
              ]
            }, 2]
          }
        }
      }] : []),
      { $sort: sortOptions },
      { $skip: skip },
      { $limit: parseInt(limit) },
      { 
        $project: {
          name: 1,
          specialization: 1,
          experience: 1,
          rating: 1,
          consultationFee: 1,
          languages: 1,
          'address.city': 1,
          'address.coordinates': 1,
          calculatedDistance: { $round: ['$calculatedDistance', 2] },
          consultationTypes: 1,
          availableSlots: 1,
          isAvailable: 1
        }
      }
    ]);

    // Get total count
    const total = await AyurvedaDoctor.countDocuments(query);

    res.json({
      success: true,
      data: doctors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 🆕 GET NEARBY DOCTORS (Quick search)
// GET /api/ayurveda/nearby?lat=19.0760&lng=72.8777
// ============================================
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        error: 'Latitude and longitude required' 
      });
    }

    const doctors = await AyurvedaDoctor.find({
      isActive: true,
      verifiedKyc: true,
      'address.coordinates': {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseFloat(radius) * 1000
        }
      }
    })
    .select('name specialization experience rating consultationFee address.city languages isAvailable')
    .limit(20);

    // Calculate distances
    const doctorsWithDistance = doctors.map(doctor => {
      const distance = calculateDistance(
        parseFloat(lat), parseFloat(lng),
        doctor.address.coordinates.coordinates[1],
        doctor.address.coordinates.coordinates[0]
      );
      return {
        ...doctor.toObject(),
        distance: Math.round(distance * 100) / 100
      };
    });

    // Sort by distance
    doctorsWithDistance.sort((a, b) => a.distance - b.distance);

    res.json({
      success: true,
      data: doctorsWithDistance,
      count: doctorsWithDistance.length
    });

  } catch (error) {
    console.error('Nearby search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 🆕 SMART DOCTOR RECOMMENDATION
// Considers: location, rating, availability, specialization
// GET /api/ayurveda/recommend?lat=19.0760&lng=72.8777&symptoms=headache,insomnia
// ============================================
router.get('/recommend', async (req, res) => {
  try {
    const { lat, lng, symptoms, patientDosha } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        error: 'Location required for recommendations' 
      });
    }

    // 🆕 Symptom to Specialization Mapping
    const symptomSpecializationMap = {
      'joint pain': 'Panchakarma',
      'arthritis': 'Panchakarma',
      'skin rash': 'Ayurvedic Dermatology',
      'acne': 'Ayurvedic Dermatology',
      'eczema': 'Ayurvedic Dermatology',
      'digestion': 'General Ayurveda',
      'acidity': 'General Ayurveda',
      'stress': 'Kayachikitsa',
      'anxiety': 'Kayachikitsa',
      'insomnia': 'Kayachikitsa',
      'weight loss': 'Rasayana Therapy',
      'detox': 'Panchakarma',
      'headache': 'General Ayurveda',
      'back pain': 'Panchakarma'
    };

    // Determine recommended specialization
    let recommendedSpec = 'General Ayurveda';
    if (symptoms) {
      const symptomList = symptoms.split(',');
      for (const symptom of symptomList) {
        if (symptomSpecializationMap[symptom.toLowerCase()]) {
          recommendedSpec = symptomSpecializationMap[symptom.toLowerCase()];
          break;
        }
      }
    }

    // Get nearby doctors with recommended specialization
    const recommendedDoctors = await AyurvedaDoctor.find({
      isActive: true,
      verifiedKyc: true,
      specialization: recommendedSpec,
      isAvailable: true,
      'address.coordinates': {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: 30000 // 30km
        }
      }
    })
    .select('name specialization experience rating consultationFee address.city isAvailable')
    .limit(5);

    // Get other nearby doctors as alternatives
    const otherDoctors = await AyurvedaDoctor.find({
      isActive: true,
      verifiedKyc: true,
      specialization: { $ne: recommendedSpec },
      isAvailable: true,
      'address.coordinates': {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: 30000
        }
      }
    })
    .select('name specialization experience rating consultationFee address.city isAvailable')
    .sort({ rating: -1 })
    .limit(3);

    res.json({
      success: true,
      data: {
        basedOnSymptoms: symptoms || null,
        recommendedSpecialization: recommendedSpec,
        recommendedDoctors,
        otherNearbyDoctors: otherDoctors
      }
    });

  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// HELPER: Calculate distance between two coordinates (Haversine formula)
// ============================================
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

module.exports = router;
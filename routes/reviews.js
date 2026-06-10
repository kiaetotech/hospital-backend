const express = require('express');
const Review = require('../models/Review');
const Provider = require('../models/Provider');
const router = express.Router();

// Submit a review
router.post('/create', async (req, res) => {
  try {
    const { providerId, providerName, patientName, patientPhone, rating, comment, bookingId } = req.body;
    
    const review = new Review({
      providerId,
      providerName,
      patientName,
      patientPhone,
      rating,
      comment,
      bookingId,
      isVerified: true
    });
    
    await review.save();
    
    // Update provider's average rating
    const reviews = await Review.find({ providerId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await Provider.findByIdAndUpdate(providerId, { rating: avgRating.toFixed(1) });
    
    res.json({ success: true, review });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get reviews for a provider
router.get('/provider/:providerId', async (req, res) => {
  try {
    const reviews = await Review.find({ providerId: req.params.providerId }).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
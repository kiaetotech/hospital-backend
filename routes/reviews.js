const express = require('express');
const Review = require('../models/Review');
const Provider = require('../models/Provider');
const router = express.Router();

// Submit a review
router.post('/create', async (req, res) => {
  try {
    const { providerId, providerName, patientName, patientPhone, rating, comment, bookingId } = req.body;
    
    // Check if review already exists for this booking
    const existingReview = await Review.findOne({ bookingId });
    if (existingReview) {
      return res.status(400).json({ error: 'Review already submitted for this booking' });
    }
    
    const review = new Review({
      providerId,
      providerName,
      patientName,
      patientPhone,
      rating,
      comment,
      bookingId,
      createdAt: new Date()
    });
    
    await review.save();
    
    // Update provider's average rating
    const reviews = await Review.find({ providerId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await Provider.findByIdAndUpdate(providerId, { rating: avgRating.toFixed(1) });
    
    res.json({ success: true, message: 'Thank you for your feedback!' });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get reviews for a provider
router.get('/provider/:providerId', async (req, res) => {
  try {
    const reviews = await Review.find({ providerId: req.params.providerId })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get average rating for a provider
router.get('/rating/:providerId', async (req, res) => {
  try {
    const reviews = await Review.find({ providerId: req.params.providerId });
    const avgRating = reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0;
    res.json({ 
      averageRating: avgRating.toFixed(1), 
      totalReviews: reviews.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
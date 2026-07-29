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
      createdAtDate()
    });
    
    await review.save();
    
    // Update provider's average rating
    const reviews = await Review.find({ providerId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await Provider.findByIdAndUpdate(providerId, { rating.toFixed(1) });
    
    res.json({ success, message: 'Thank you for your feedback!' });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error.message });
  }
});

// Get reviews for a provider
router.get('/provider/', async (req, res) => {
  try {
    const reviews = await Review.find({ providerId.params.providerId })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// Get average rating for a provider
router.get('/rating/', async (req, res) => {
  try {
    const reviews = await Review.find({ providerId.params.providerId });
    const avgRating = reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0;
    res.json({ 
      averageRating.toFixed(1), 
      totalReviews.length 
    });
  } catch (error) {
    res.status(500).json({ error.message });
  }
});

module.exports = router;


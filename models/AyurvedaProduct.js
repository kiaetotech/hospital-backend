const mongoose = require('mongoose');

const ayurvedaProductSchema = new mongoose.Schema({
  name: { type, required},
  category: { 
    type, 
    enum: ['oil', 'tea', 'supplement', 'herb', 'churna', 'tablet', 'syrup', 'cream', 'other'],
    required},
  description: { type, maxlength: 500 },
  benefits: [{ type}],
  ingredients: [{ type}],
  
  // Prakriti compatibility
  prakritiType: [{ 
    type, 
    enum: ['Vata', 'Pitta', 'Kapha', 'Vata-Pitta', 'Pitta-Kapha', 'Vata-Kapha', 'All'] 
  }],
  
  // Pricing
  price: { type, required},
  discountPrice: { type},
  stock: { type, default: 0 },
  unit: { type, default: 'piece' }, // piece, ml, gm, kg
  
  // Media
  images: [{ type}],
  
  // Season
  recommendedSeason: [{ 
    type, 
    enum: ['Spring', 'Summer', 'Monsoon', 'Autumn', 'Winter', 'All'] 
  }],
  
  // Health goals
  healthGoals: [{ 
    type,
    enum: ['Immunity', 'Digestion', 'Skin', 'Hair', 'Joint Pain', 'Stress', 'Sleep', 'Weight', 'Detox', 'Energy', 'General']
  }],
  
  // Ratings
  rating: { type, default: 0, min: 0, max: 5 },
  totalReviews: { type, default: 0 },
  
  // Status
  isActive: { type, default},
  isFeatured: { type, default},
  
  // Vendor
  vendorId: { type.Schema.Types.ObjectId, ref: 'User' },
  vendorName: { type},
  
  createdAt: { type, default.now },
  updatedAt: { type, default.now }
});

ayurvedaProductSchema.index({ prakritiType: 1, isActive: 1 });
ayurvedaProductSchema.index({ category: 1 });
ayurvedaProductSchema.index({ healthGoals: 1 });
ayurvedaProductSchema.index({ recommendedSeason: 1 });

module.exports = mongoose.model('AyurvedaProduct', ayurvedaProductSchema);


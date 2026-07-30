const mongoose = require('mongoose');

const ayurvedaProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['oil', 'tea', 'supplement', 'herb', 'churna', 'tablet', 'syrup', 'cream', 'other'],
    required: true 
  },
  description: { type: String, maxlength: 500 },
  benefits: [{ type: String }],
  ingredients: [{ type: String }],
  
  // Prakriti compatibility
  prakritiType: [{ 
    type: String, 
    enum: ['Vata', 'Pitta', 'Kapha', 'Vata-Pitta', 'Pitta-Kapha', 'Vata-Kapha', 'All'] 
  }],
  
  // Pricing
  price: { type: Number, required: true },
  discountPrice: { type: Number },
  stock: { type: Number, default: 0 },
  unit: { type: String, default: 'piece' }, // piece, ml, gm, kg
  
  // Media
  images: [{ type: String }],
  
  // Season
  recommendedSeason: [{ 
    type: String, 
    enum: ['Spring', 'Summer', 'Monsoon', 'Autumn', 'Winter', 'All'] 
  }],
  
  // Health goals
  healthGoals: [{ 
    type: String,
    enum: ['Immunity', 'Digestion', 'Skin', 'Hair', 'Joint Pain', 'Stress', 'Sleep', 'Weight', 'Detox', 'Energy', 'General']
  }],
  
  // Ratings
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
  
  // Status
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  
  // Vendor
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  vendorName: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ayurvedaProductSchema.index({ prakritiType: 1, isActive: 1 });
ayurvedaProductSchema.index({ category: 1 });
ayurvedaProductSchema.index({ healthGoals: 1 });
ayurvedaProductSchema.index({ recommendedSeason: 1 });

module.exports = mongoose.model('AyurvedaProduct', ayurvedaProductSchema);
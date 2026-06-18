// D:\hospital backend\routes\discounts.js

const express = require('express');
const router = express.Router();
const Discount = require('../models/Discount');
const Booking = require('../models/Booking');
const {
  validateDiscount,
  applyDiscountToBooking,
  removeDiscountFromBooking,
  getActiveDiscounts,
  getDiscountByCode,
  createDiscount,
  updateDiscount,
  deleteDiscount
} = require('../services/discountService');

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// ============================================
// 1. Validate discount code
// POST /api/discounts/validate
// ============================================

router.post('/validate', async (req, res) => {
  try {
    const { code, amount, bookingType } = req.body;
    
    if (!code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Discount code required' 
      });
    }
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid amount required' 
      });
    }
    
    const result = await validateDiscount(code, amount, bookingType || 'general');
    
    if (!result.valid) {
      return res.status(400).json({ 
        success: false, 
        message: result.message 
      });
    }
    
    res.json({
      success: true,
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount,
      discount: {
        code: result.discount.code,
        type: result.discount.type,
        value: result.discount.value,
        description: result.discount.description,
        minAmount: result.discount.minAmount,
        maxDiscount: result.discount.maxDiscount
      },
      message: result.message
    });
  } catch (error) {
    console.error('Validate discount error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to validate discount' 
    });
  }
});

// ============================================
// 2. Get all active discounts
// GET /api/discounts/active
// ============================================

router.get('/active', async (req, res) => {
  try {
    const { bookingType } = req.query;
    const discounts = await getActiveDiscounts(bookingType);
    
    res.json({
      success: true,
      count: discounts.length,
      discounts: discounts.map(d => ({
        code: d.code,
        type: d.type,
        value: d.value,
        description: d.description,
        minAmount: d.minAmount,
        maxDiscount: d.maxDiscount,
        applicableTags: d.applicableTags,
        validUntil: d.validUntil
      }))
    });
  } catch (error) {
    console.error('Get active discounts error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch discounts' 
    });
  }
});

// ============================================
// 3. Get discount by code
// GET /api/discounts/:code
// ============================================

router.get('/:code', async (req, res) => {
  try {
    const discount = await getDiscountByCode(req.params.code);
    
    if (!discount) {
      return res.status(404).json({ 
        success: false, 
        message: 'Discount not found' 
      });
    }
    
    res.json({
      success: true,
      discount: {
        code: discount.code,
        type: discount.type,
        value: discount.value,
        description: discount.description,
        applicableTags: discount.applicableTags,
        minAmount: discount.minAmount,
        maxDiscount: discount.maxDiscount,
        validFrom: discount.validFrom,
        validUntil: discount.validUntil,
        maxUses: discount.maxUses,
        usedCount: discount.usedCount,
        isActive: discount.isActive,
        isExpired: discount.isExpired,
        isCurrentlyActive: discount.isCurrentlyActive
      }
    });
  } catch (error) {
    console.error('Get discount error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch discount' 
    });
  }
});

// ============================================
// BOOKING DISCOUNT ROUTES
// ============================================

// ============================================
// 4. Apply discount to booking
// POST /api/discounts/apply-to-booking/:bookingId
// ============================================

router.post('/apply-to-booking/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { discountCode } = req.body;
    
    if (!discountCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Discount code required' 
      });
    }
    
    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }
    
    const result = await applyDiscountToBooking(booking, discountCode);
    
    if (!result.success) {
      return res.status(400).json({ 
        success: false, 
        message: result.message 
      });
    }
    
    res.json({
      success: true,
      message: result.message,
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount,
      originalAmount: booking.originalAmount,
      discount: {
        code: result.discount.code,
        type: result.discount.type,
        value: result.discount.value
      }
    });
  } catch (error) {
    console.error('Apply discount error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to apply discount' 
    });
  }
});

// ============================================
// 5. Remove discount from booking
// DELETE /api/discounts/remove-from-booking/:bookingId
// ============================================

router.delete('/remove-from-booking/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }
    
    const result = await removeDiscountFromBooking(booking);
    
    if (!result.success) {
      return res.status(400).json({ 
        success: false, 
        message: result.message 
      });
    }
    
    res.json({
      success: true,
      message: result.message,
      finalAmount: result.finalAmount
    });
  } catch (error) {
    console.error('Remove discount error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove discount' 
    });
  }
});

// ============================================
// ADMIN ROUTES (Requires admin authentication)
// ============================================

// ============================================
// 6. Create discount (Admin only)
// POST /api/discounts/admin/create
// ============================================

router.post('/admin/create', async (req, res) => {
  try {
    const { 
      code, 
      type, 
      value, 
      description, 
      applicableTags, 
      minAmount, 
      maxDiscount, 
      validFrom, 
      validUntil, 
      maxUses,
      maxUsesPerUser
    } = req.body;
    
    // Validate required fields
    if (!code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Discount code is required' 
      });
    }
    
    if (!type || !['percentage', 'fixed'].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid discount type (percentage/fixed) is required' 
      });
    }
    
    if (!value || value <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid discount value is required' 
      });
    }
    
    // Check if discount code already exists
    const existing = await Discount.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Discount code already exists' 
      });
    }
    
    const discount = await createDiscount({
      code,
      type,
      value,
      description,
      applicableTags: applicableTags || [],
      minAmount: minAmount || 0,
      maxDiscount: maxDiscount || null,
      validFrom: validFrom || new Date(),
      validUntil: validUntil || null,
      maxUses: maxUses || null,
      maxUsesPerUser: maxUsesPerUser || null
    });
    
    res.status(201).json({
      success: true,
      message: 'Discount created successfully',
      discount: {
        code: discount.code,
        type: discount.type,
        value: discount.value,
        description: discount.description,
        applicableTags: discount.applicableTags,
        minAmount: discount.minAmount,
        maxDiscount: discount.maxDiscount,
        validFrom: discount.validFrom,
        validUntil: discount.validUntil,
        maxUses: discount.maxUses,
        maxUsesPerUser: discount.maxUsesPerUser,
        isActive: discount.isActive
      }
    });
  } catch (error) {
    console.error('Create discount error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create discount: ' + error.message 
    });
  }
});

// ============================================
// 7. Update discount (Admin only)
// PUT /api/discounts/admin/:code
// ============================================

router.put('/admin/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const data = req.body;
    
    const discount = await updateDiscount(code, data);
    
    res.json({
      success: true,
      message: 'Discount updated successfully',
      discount: {
        code: discount.code,
        type: discount.type,
        value: discount.value,
        description: discount.description,
        applicableTags: discount.applicableTags,
        minAmount: discount.minAmount,
        maxDiscount: discount.maxDiscount,
        validFrom: discount.validFrom,
        validUntil: discount.validUntil,
        maxUses: discount.maxUses,
        maxUsesPerUser: discount.maxUsesPerUser,
        isActive: discount.isActive,
        usedCount: discount.usedCount
      }
    });
  } catch (error) {
    console.error('Update discount error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update discount: ' + error.message 
    });
  }
});

// ============================================
// 8. Delete discount (Admin only)
// DELETE /api/discounts/admin/:code
// ============================================

router.delete('/admin/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const result = await deleteDiscount(code);
    
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Delete discount error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete discount: ' + error.message 
    });
  }
});

// ============================================
// 9. Toggle discount active status (Admin only)
// PATCH /api/discounts/admin/:code/toggle
// ============================================

router.patch('/admin/:code/toggle', async (req, res) => {
  try {
    const { code } = req.params;
    const { isActive } = req.body;
    
    const discount = await Discount.findOne({ code: code.toUpperCase() });
    if (!discount) {
      return res.status(404).json({ 
        success: false, 
        message: 'Discount not found' 
      });
    }
    
    discount.isActive = isActive !== undefined ? isActive : !discount.isActive;
    discount.updatedAt = new Date();
    await discount.save();
    
    res.json({
      success: true,
      message: `Discount ${discount.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: discount.isActive
    });
  } catch (error) {
    console.error('Toggle discount error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to toggle discount: ' + error.message 
    });
  }
});

// ============================================
// 10. Get all discounts (Admin only)
// GET /api/discounts/admin/all
// ============================================

router.get('/admin/all', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const discounts = await Discount.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Discount.countDocuments(query);
    
    res.json({
      success: true,
      discounts,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Get all discounts error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch discounts' 
    });
  }
});

module.exports = router;
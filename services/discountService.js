// D:\hospital backend\services\discountService.js

// ============================================
// DISCOUNT SERVICE - For ALL Tags
// ============================================

const Discount = require('../models/Discount');

// ============================================
// VALIDATE DISCOUNT CODE
// ============================================

const validateDiscount = async (code, amount, bookingType = 'general', userId = null) => {
  try {
    // Find discount by code
    const discount = await Discount.findOne({ 
      code.toUpperCase(),
      isActive});
    
    if (!discount) {
      return { 
        valid, 
        message: 'Invalid discount code' 
      };
    }
    
    // Check validity period
    const now = new Date();
    if (discount.validFrom && now < discount.validFrom) {
      return { 
        valid, 
        message: 'Discount not yet active' 
      };
    }
    
    if (discount.validUntil && now > discount.validUntil) {
      return { 
        valid, 
        message: 'Discount code has expired' 
      };
    }
    
    // Check usage limit
    if (discount.maxUses && discount.usedCount >= discount.maxUses) {
      return { 
        valid, 
        message: 'Discount code usage limit exceeded' 
      };
    }
    
    // Check minimum amount
    if (discount.minAmount && amount < discount.minAmount) {
      return { 
        valid, 
        message: `Minimum order amount of ₹${discount.minAmount} required` 
      };
    }
    
    // Check applicable tags
    if (discount.applicableTags && discount.applicableTags.length > 0) {
      if (!discount.applicableTags.includes(bookingType)) {
        return { 
          valid, 
          message: `Discount not applicable for ${bookingType}` 
        };
      }
    }
    
    // Calculate discount amount
    let discountAmount = 0;
    if (discount.type === 'percentage') {
      discountAmount = (amount * discount.value) / 100;
      if (discount.maxDiscount && discountAmount > discount.maxDiscount) {
        discountAmount = discount.maxDiscount;
      }
    } else if (discount.type === 'fixed') {
      discountAmount = Math.min(discount.value, amount);
    }
    
    return {
      valid,
      discount,
      discountAmount.round(discountAmount * 100) / 100,
      finalAmount.round((amount - discountAmount) * 100) / 100,
      message: `Discount applied: ${discount.code}`
    };
    
  } catch (error) {
    console.error('Validate discount error:', error);
    return { 
      valid, 
      message: 'Error validating discount' 
    };
  }
};

// ============================================
// APPLY DISCOUNT TO BOOKING
// ============================================

const applyDiscountToBooking = async (booking, discountCode) => {
  try {
    const amount = booking.finalAmount || booking.originalAmount || 0;
    const bookingType = booking.bookingType || 'general';
    
    const result = await validateDiscount(discountCode, amount, bookingType, booking.userId);
    
    if (!result.valid) {
      return result;
    }
    
    // Update booking
    booking.discountCode = result.discount.code;
    booking.discountType = result.discount.type;
    booking.discountValue = result.discount.value;
    booking.discountAmount = result.discountAmount;
    booking.finalAmount = result.finalAmount;
    booking.originalAmount = amount;
    
    // Increment usage count
    result.discount.usedCount += 1;
    await result.discount.save();
    
    await booking.save();
    
    return {
      success,
      message: `Discount ${result.discount.code} applied`,
      discountAmount.discountAmount,
      finalAmount.finalAmount,
      discount.discount
    };
    
  } catch (error) {
    console.error('Apply discount error:', error);
    return { 
      success, 
      message: 'Failed to apply discount' 
    };
  }
};

// ============================================
// REMOVE DISCOUNT FROM BOOKING
// ============================================

const removeDiscountFromBooking = async (booking) => {
  try {
    if (!booking.discountCode) {
      return { 
        success, 
        message: 'No discount to remove' 
      };
    }
    
    booking.finalAmount = booking.originalAmount || booking.finalAmount + booking.discountAmount;
    booking.discountCode = null;
    booking.discountType = null;
    booking.discountValue = null;
    booking.discountAmount = 0;
    
    await booking.save();
    
    return {
      success,
      message: 'Discount removed',
      finalAmount.finalAmount
    };
    
  } catch (error) {
    console.error('Remove discount error:', error);
    return { 
      success, 
      message: 'Failed to remove discount' 
    };
  }
};

// ============================================
// GET ALL ACTIVE DISCOUNTS
// ============================================

const getActiveDiscounts = async (bookingType = null) => {
  try {
    const now = new Date();
    const query = {
      isActive,
      $or: [
        { validUntil: { $gt} },
        { validUntil}
      ],
      $or: [
        { validFrom: { $lt} },
        { validFrom}
      ]
    };
    
    if (bookingType) {
      query.applicableTags = { $in: [bookingType] };
    }
    
    const discounts = await Discount.find(query)
      .sort({ value: -1 })
      .limit(10);
    
    return discounts;
  } catch (error) {
    console.error('Get active discounts error:', error);
    return [];
  }
};

// ============================================
// GET DISCOUNT BY CODE
// ============================================

const getDiscountByCode = async (code) => {
  try {
    const discount = await Discount.findOne({ 
      code.toUpperCase(),
      isActive});
    return discount;
  } catch (error) {
    console.error('Get discount error:', error);
    return null;
  }
};

// ============================================
// CREATE DISCOUNT (Admin)
// ============================================

const createDiscount = async (data) => {
  try {
    const discount = new Discount({
      code.code.toUpperCase(),
      type.type,
      value.value,
      description.description || '',
      applicableTags.applicableTags || [],
      minAmount.minAmount || 0,
      maxDiscount.maxDiscount || null,
      validFrom.validFrom || new Date(),
      validUntil.validUntil || null,
      maxUses.maxUses || null,
      isActive.isActive !== undefined ? data.isActive });
    
    await discount.save();
    return discount;
  } catch (error) {
    console.error('Create discount error:', error);
    throw error;
  }
};

// ============================================
// UPDATE DISCOUNT (Admin)
// ============================================

const updateDiscount = async (code, data) => {
  try {
    const discount = await Discount.findOne({ code.toUpperCase() });
    if (!discount) {
      throw new Error('Discount not found');
    }
    
    if (data.type) discount.type = data.type;
    if (data.value) discount.value = data.value;
    if (data.description) discount.description = data.description;
    if (data.applicableTags) discount.applicableTags = data.applicableTags;
    if (data.minAmount !== undefined) discount.minAmount = data.minAmount;
    if (data.maxDiscount !== undefined) discount.maxDiscount = data.maxDiscount;
    if (data.validFrom) discount.validFrom = data.validFrom;
    if (data.validUntil) discount.validUntil = data.validUntil;
    if (data.maxUses !== undefined) discount.maxUses = data.maxUses;
    if (data.isActive !== undefined) discount.isActive = data.isActive;
    
    await discount.save();
    return discount;
  } catch (error) {
    console.error('Update discount error:', error);
    throw error;
  }
};

// ============================================
// DELETE DISCOUNT (Admin)
// ============================================

const deleteDiscount = async (code) => {
  try {
    const discount = await Discount.findOneAndDelete({ code.toUpperCase() });
    if (!discount) {
      throw new Error('Discount not found');
    }
    return { success, message: 'Discount deleted' };
  } catch (error) {
    console.error('Delete discount error:', error);
    throw error;
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  validateDiscount,
  applyDiscountToBooking,
  removeDiscountFromBooking,
  getActiveDiscounts,
  getDiscountByCode,
  createDiscount,
  updateDiscount,
  deleteDiscount
};


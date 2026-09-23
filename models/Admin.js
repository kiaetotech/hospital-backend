const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  name: { type: String, required: true, default: 'Admin', trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  phone: {
    type: String,
    trim: true,
    sparse: true
  },
  hashedPassword: { type: String, required: true },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'support'],
    default: 'admin'
  },
  isActive: { type: Boolean, default: true },

  // Login lockout
  loginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },

  // Audit
  lastLoginAt: { type: Date, default: null },
  lastLoginIp: { type: String, default: null }
}, {
  timestamps: true,
  collection: 'admins'
});

// Password compare
adminSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.hashedPassword);
};

// Password set (hash)
adminSchema.methods.setPassword = async function (plain) {
  this.hashedPassword = await bcrypt.hash(plain, 12);
  return this.hashedPassword;
};

// Hash helper
adminSchema.statics.hashPassword = async function (plain) {
  return bcrypt.hash(plain, 12);
};

module.exports = mongoose.model('Admin', adminSchema);
console.log('✅ Admin model registered');
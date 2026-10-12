// D:\hospital backend\models\AdminAuditLog.js
// ============================================
// ADMIN AUDIT LOG
// ============================================

const mongoose = require('mongoose');

const AdminAuditLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  adminEmail: { type: String, index: true },
  adminName: String,

  action: { type: String, required: true, index: true },
  entityType: { type: String, required: true, index: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, index: true },
  entityName: String,

  changes: { type: mongoose.Schema.Types.Mixed, default: {} },
  reason: String,
  notes: String,

  ipAddress: String,
  userAgent: String,

  status: {
    type: String,
    enum: ['success', 'failure'],
    default: 'success',
    index: true,
  },
  errorMessage: String,
}, { timestamps: true });

AdminAuditLogSchema.index({ createdAt: -1 });
AdminAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ adminId: 1, createdAt: -1 });

module.exports = mongoose.model('AdminAuditLog', AdminAuditLogSchema);
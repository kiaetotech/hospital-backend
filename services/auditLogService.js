// D:\hospital backend\services\auditLogService.js
// ============================================

const AdminAuditLog = require('../models/AdminAuditLog');

async function logAdminAction(req, entry) {
  try {
    if (!req || !req.user) return;

    await AdminAuditLog.create({
      adminId: req.user.id || req.user._id || req.user.userId,
      adminEmail: req.user.email,
      adminName: req.user.name,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityName: entry.entityName,
      changes: entry.changes || {},
      reason: entry.reason,
      notes: entry.notes,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      status: entry.status || 'success',
      errorMessage: entry.errorMessage,
    });
  } catch (e) {
    console.error('[auditLog] failed:', e.message);
  }
}

module.exports = { logAdminAction };
// D:\hospital backend\middleware\auditAdmin.js
// ============================================

const { logAdminAction } = require('../services/auditLogService');

function auditAdmin(action, entityType) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);

    let statusCode = 200;
    res.status = (code) => {
      statusCode = code;
      return originalStatus(code);
    };

    res.json = (body) => {
      const success = statusCode >= 200 && statusCode < 300;

      logAdminAction(req, {
        action,
        entityType,
        entityId: req.params.id || req.body.entityId,
        entityName: body?.data?.companyName || body?.data?.planName || body?.data?.name || null,
        changes: {
          body: sanitizeBody(req.body),
          params: req.params,
          query: req.query,
        },
        reason: req.body?.reason || req.query?.reason,
        notes: req.body?.note || req.body?.notes,
        status: success ? 'success' : 'failure',
        errorMessage: success ? null : (body?.error?.message || body?.message),
      }).catch(() => {});

      return originalJson(body);
    };

    next();
  };
}

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const out = { ...body };
  for (const k of ['password', 'token', 'secret', 'adminKey', 'apiKey']) {
    if (k in out) out[k] = '[REDACTED]';
  }
  return out;
}

module.exports = { auditAdmin };
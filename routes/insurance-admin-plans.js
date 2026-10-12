// D:\hospital backend\routes\insurance-admin-plans.js
// Mount: app.use('/api/insurance-admin/plans', ...)
// ============================================

const express = require('express');
const router = express.Router();

const InsurancePlan = require('../models/InsurancePlan');
const User = require('../models/User');
const { authenticateAdmin } = require('../middleware/auth');
const { auditAdmin } = require('../middleware/auditAdmin');

function ok(res, data, meta = {}) {
  return res.json({ success: true, data, meta: { ...meta, timestamp: new Date().toISOString() } });
}
function fail(res, status, code, message, details = {}) {
  return res.status(status).json({ success: false, error: { code, message, details } });
}
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', authenticateAdmin, asyncHandler(async (req, res) => {
  const { status, companyId, search, page = 1, limit = 30 } = req.query;
  const query = {};
  if (companyId) query.companyId = companyId;
  if (search) query.planName = { $regex: search, $options: 'i' };
  if (status === 'orphan') query.$or = [{ companyId: null }, { companyId: { $exists: false } }];
  else if (status === 'verified') query.isVerified = true;
  else if (status === 'pending') query.isVerified = false;
  else if (status === 'inactive') query.isActive = false;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [plans, total] = await Promise.all([
    InsurancePlan.find(query)
      .populate('companyId', 'name email companyName role')
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    InsurancePlan.countDocuments(query),
  ]);

  return ok(res, plans, {
    pagination: {
      page: parseInt(page), limit: parseInt(limit), total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

router.get('/orphans', authenticateAdmin, asyncHandler(async (req, res) => {
  const query = { $or: [{ companyId: null }, { companyId: { $exists: false } }] };
  const [plans, total] = await Promise.all([
    InsurancePlan.find(query).select('_id planName basePremium planType createdAt').lean(),
    InsurancePlan.countDocuments(query),
  ]);
  return ok(res, plans, { total });
}));

router.get('/companies', authenticateAdmin, asyncHandler(async (req, res) => {
  const users = await User.find({ role: 'insurance_company', isActive: true })
    .select('_id name email companyName').lean();
  return ok(res, users, { total: users.length });
}));

router.post('/:id/attach',
  authenticateAdmin,
  auditAdmin('insurance.plan.attach_company', 'InsurancePlan'),
  asyncHandler(async (req, res) => {
    const { companyUserId } = req.body;
    if (!companyUserId) return fail(res, 400, 'MISSING_COMPANY', 'companyUserId required');

    const plan = await InsurancePlan.findById(req.params.id);
    if (!plan) return fail(res, 404, 'NOT_FOUND', 'Plan not found');

    const company = await User.findOne({ _id: companyUserId, role: 'insurance_company' });
    if (!company) return fail(res, 404, 'NOT_FOUND', 'Insurance company User not found');

    plan.companyId = company._id;
    await plan.save();

    return ok(res, plan);
  })
);

router.delete('/:id',
  authenticateAdmin,
  auditAdmin('insurance.plan.delete', 'InsurancePlan'),
  asyncHandler(async (req, res) => {
    const result = await InsurancePlan.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) return fail(res, 404, 'NOT_FOUND', 'Plan not found');
    return ok(res, { deleted: true });
  })
);

router.post('/bulk-delete-orphans',
  authenticateAdmin,
  auditAdmin('insurance.plan.bulk_delete_orphans', 'InsurancePlan'),
  asyncHandler(async (req, res) => {
    if (req.query.confirm !== 'YES') {
      return fail(res, 400, 'CONFIRM_REQUIRED', 'Add ?confirm=YES to confirm');
    }
    const result = await InsurancePlan.deleteMany({
      $or: [{ companyId: null }, { companyId: { $exists: false } }],
    });
    return ok(res, { deletedCount: result.deletedCount });
  })
);

module.exports = router;
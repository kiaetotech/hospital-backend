const express = require('express');
const router = express.Router();
const CorporateBilling = require('../models/CorporateBilling');
const CorporatePlan = require('../models/CorporatePlan');
const CorporateEmployee = require('../models/CorporateEmployee');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// CREATE BILLING
// ============================================

// Generate invoice for a company
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { companyId, periodStart, periodEnd, billingPeriod = 'monthly' } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }

    // Get company details
    const company = await CorporatePlan.findById(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get employee count
    const employeeCount = await CorporateEmployee.countDocuments({
      corporateId,
      isActive});

    // Calculate amounts
    const baseAmount = company.basePrice || 0;
    const perEmployeeAmount = company.perEmployeePrice || 0;
    const totalEmployees = employeeCount;
    const totalAmount = baseAmount + (perEmployeeAmount * totalEmployees);
    const taxAmount = totalAmount * 0.18; // 18% GST
    const finalAmount = totalAmount + taxAmount;

    // Create billing
    const billing = new CorporateBilling({
      companyId,
      hrId.user.id,
      billingPeriod,
      periodStartDate(periodStart),
      periodEndDate(periodEnd),
      dueDateDate(new Date(periodEnd).setDate(new Date(periodEnd).getDate() + 15)),
      baseAmount,
      perEmployeeAmount,
      totalEmployees,
      totalAmount,
      taxAmount,
      finalAmount,
      status: 'pending'
    });

    await billing.save();

    res.json({
      success,
      data,
      message: 'Invoice generated successfully'
    });

  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error.message });
  }
});

// ============================================
// GET BILLINGS
// ============================================

// Get all billings for a company
router.get('/company/', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status, limit = 50, skip = 0 } = req.query;

    const query = { companyId };
    if (status) query.status = status;

    const [billings, total] = await Promise.all([
      CorporateBilling.find(query)
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit)),
      CorporateBilling.countDocuments(query)
    ]);

    res.json({
      success,
      data: {
        billings,
        pagination: {
          total,
          limit(limit),
          skip(skip),
          pages.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// Get billing summary
router.get('/summary/', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.params;
    const summary = await CorporateBilling.getCompanyBillingSummary(companyId);

    // Get overdue count
    const overdueCount = await CorporateBilling.countDocuments({
      companyId,
      status: 'overdue'
    });

    res.json({
      success,
      data: {
        ...summary,
        overdueCount
      }
    });

  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// Get single billing
router.get('/', authenticateToken, async (req, res) => {
  try {
    const billing = await CorporateBilling.findById(req.params.id)
      .populate('companyId', 'companyName email')
      .populate('hrId', 'name email');

    if (!billing) {
      return res.status(404).json({ error: 'Billing not found' });
    }

    res.json({
      success,
      data});

  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// ============================================
// PAYMENT ROUTES
// ============================================

// Mark invoice as paid
router.post('//pay', authenticateToken, async (req, res) => {
  try {
    const { paymentId, paymentMethod = 'razorpay' } = req.body;
    const billing = await CorporateBilling.findById(req.params.id);

    if (!billing) {
      return res.status(404).json({ error: 'Billing not found' });
    }

    if (billing.status === 'paid') {
      return res.status(400).json({ error: 'Invoice already paid' });
    }

    await billing.markAsPaid(paymentId, paymentMethod);

    res.json({
      success,
      data,
      message: 'Invoice marked as paid'
    });

  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Get all overdue invoices (Admin only)
router.get('/admin/overdue', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const invoices = await CorporateBilling.getOverdueInvoices();
    res.json({
      success,
      data});

  } catch (error) {
    res.status(500).json({ error.message });
  }
});

// Get billing stats (Admin only)
router.get('/admin/stats', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = await CorporateBilling.aggregate([
      {
        $group: {
          _id,
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ['$status', 'paid'] }, '$finalAmount', 0]
            }
          },
          totalPending: {
            $sum: {
              $cond: [{ $in: ['$status', ['pending', 'overdue']] }, '$finalAmount', 0]
            }
          },
          totalOverdue: {
            $sum: {
              $cond: [{ $eq: ['$status', 'overdue'] }, '$finalAmount', 0]
            }
          },
          totalInvoices: { $sum: 1 },
          paidInvoices: {
            $sum: {
              $cond: [{ $eq: ['$status', 'paid'] }, 1, 0]
            }
          },
          overdueInvoices: {
            $sum: {
              $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalRevenue: 1,
          totalPending: 1,
          totalOverdue: 1,
          totalInvoices: 1,
          paidInvoices: 1,
          overdueInvoices: 1,
          collectionRate: {
            $multiply: [
              { $divide: ['$paidInvoices', '$totalInvoices'] },
              100
            ]
          }
        }
      }
    ]);

    res.json({
      success,
      data[0] || {
        totalRevenue: 0,
        totalPending: 0,
        totalOverdue: 0,
        totalInvoices: 0,
        paidInvoices: 0,
        overdueInvoices: 0,
        collectionRate: 0
      }
    });

  } catch (error) {
    res.status(500).json({ error.message });
  }
});

module.exports = router;


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
      corporateId: companyId,
      isActive: true
    });

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
      hrId: req.user.id,
      billingPeriod,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      dueDate: new Date(new Date(periodEnd).setDate(new Date(periodEnd).getDate() + 15)),
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
      success: true,
      data: billing,
      message: 'Invoice generated successfully'
    });

  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET BILLINGS
// ============================================

// Get all billings for a company
router.get('/company/:companyId', authenticateToken, async (req, res) => {
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
      success: true,
      data: {
        billings,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get billing summary
router.get('/summary/:companyId', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.params;
    const summary = await CorporateBilling.getCompanyBillingSummary(companyId);

    // Get overdue count
    const overdueCount = await CorporateBilling.countDocuments({
      companyId,
      status: 'overdue'
    });

    res.json({
      success: true,
      data: {
        ...summary,
        overdueCount
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single billing
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const billing = await CorporateBilling.findById(req.params.id)
      .populate('companyId', 'companyName email')
      .populate('hrId', 'name email');

    if (!billing) {
      return res.status(404).json({ error: 'Billing not found' });
    }

    res.json({
      success: true,
      data: billing
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PAYMENT ROUTES
// ============================================

// Mark invoice as paid
router.post('/:id/pay', authenticateToken, async (req, res) => {
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
      success: true,
      data: billing,
      message: 'Invoice marked as paid'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
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
      success: true,
      data: invoices
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
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
          _id: null,
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
      success: true,
      data: stats[0] || {
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
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
// D:\hospital backend\services\loan\loanCommissionService.js
// ============================================
// LOAN COMMISSION SERVICE
// ============================================
// Production-grade loan commission calculation + Transaction ledger entry.
//
// Scope: LOAN / EMI only. Does NOT touch ambulance, ayurveda, homeopathy,
// hospitals, diagnostics, mental health, online doctor, caregivers, insurance,
// corporate, or lab tests.
//
// Uses:
//   - Lender.commissionRate (already configured at lender registration)
//   - Transaction model (already used by all tags — read-only schema, no changes)
//
// Guarantees:
//   - No duplicate commission per application (idempotency via applicationId)
//   - Rejects inactive lenders, missing rates, zero amounts
//   - Every calculation creates a real Transaction row (not a floating number)
//   - Returns structured result so caller can branch on success/failure
// ============================================

const Lender = require('../../models/Lender');
const LoanApplication = require('../../models/LoanApplication');
const Transaction = require('../../models/Transaction');

// ============================================
// CALCULATE
// ============================================
// Pure calculation — no DB writes.
// Returns { commissionAmount, commissionRate, lenderId, disbursedAmount, lenderName }
// Throws LoanCommissionError on validation failures.
// ============================================
async function calculate({
  applicationId,
  disbursedAmount = null,
}) {
  if (!applicationId) {
    throw new LoanCommissionError('applicationId is required', 'MISSING_APPLICATION_ID');
  }

  const application = await LoanApplication.findOne({ applicationId });
  if (!application) {
    throw new LoanCommissionError(
      `LoanApplication not found: ${applicationId}`,
      'APPLICATION_NOT_FOUND'
    );
  }

  // Prefer explicitly provided disbursedAmount; fall back to application record
  const amount = disbursedAmount ?? application.disbursedAmount ?? 0;

  if (typeof amount !== 'number' || amount <= 0) {
    throw new LoanCommissionError(
      `Invalid disbursedAmount: ${amount}. Must be > 0.`,
      'INVALID_AMOUNT'
    );
  }

  if (!application.lenderId) {
    throw new LoanCommissionError(
      'Application has no lenderId',
      'MISSING_LENDER_ID'
    );
  }

  const lender = await Lender.findById(application.lenderId);
  if (!lender) {
    throw new LoanCommissionError(
      `Lender not found: ${application.lenderId}`,
      'LENDER_NOT_FOUND'
    );
  }

  if (lender.status !== 'active') {
    throw new LoanCommissionError(
      `Lender is ${lender.status}, cannot calculate commission`,
      'LENDER_NOT_ACTIVE'
    );
  }

  const rate = Number(lender.commissionRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new LoanCommissionError(
      `Invalid commissionRate on lender ${lender.lenderId}: ${lender.commissionRate}`,
      'INVALID_LENDER_RATE'
    );
  }

  const commissionAmount = Math.round((amount * rate) / 100 * 100) / 100;

  return {
    applicationId,
    disbursedAmount: amount,
    commissionRate: rate,
    commissionAmount,
    lenderId: String(lender._id),
    lenderBusinessName: lender.businessName,
    lenderType: lender.lenderType,
  };
}

// ============================================
// POST COMMISSION
// ============================================
// Calculates + writes a Transaction row + updates application.
// Idempotent: if a commission Transaction already exists for this application,
// returns that one instead of creating a duplicate.
//
// Returns:
// {
//   created: boolean,
//   transaction: <Transaction doc>,
//   commission: { applicationId, disbursedAmount, commissionRate, commissionAmount, ... }
// }
// ============================================
async function postCommission({
  applicationId,
  disbursedAmount = null,
  updatedBy = 'system',
  updatedByRole = 'system',
}) {
  const calc = await calculate({ applicationId, disbursedAmount });

  // Idempotency check — was commission already posted for this application?
  const existing = await Transaction.findOne({
    applicationId: calc.applicationId,
    type: 'commission_payment',
    bookingType: 'loan',
  });

  if (existing) {
    return {
      created: false,
      transaction: existing,
      commission: calc,
      reason: 'ALREADY_POSTED',
    };
  }

  // Create the Transaction row (real ledger entry)
  const transactionId = `TXN_LOAN_COMM_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const transaction = new Transaction({
    transactionId,
    applicationId: calc.applicationId,
    lenderId: calc.lenderId,
    type: 'commission_payment',
    bookingType: 'loan',
    amount: calc.disbursedAmount,
    platformCommission: calc.commissionAmount,
    providerAmount: calc.disbursedAmount - calc.commissionAmount,
    commissionStatus: 'pending',
    status: 'pending',
    paymentMethod: 'bank_transfer',
    notes: `Loan commission @ ${calc.commissionRate}% on ₹${calc.disbursedAmount} (lender: ${calc.lenderBusinessName})`,
    metadata: {
      commissionRate: calc.commissionRate,
      lenderBusinessName: calc.lenderBusinessName,
      lenderType: calc.lenderType,
      postedBy: updatedBy,
      postedByRole: updatedByRole,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await transaction.save();

  // Update the application with the commission figure (idempotent — same value)
  await LoanApplication.updateOne(
    { applicationId: calc.applicationId },
    {
      $set: {
        platformCommission: calc.commissionAmount,
        commissionPaid: false,
      },
    }
  );

  return {
    created: true,
    transaction,
    commission: calc,
  };
}

// ============================================
// MARK COMMISSION AS PAID
// ============================================
// Called when lender actually pays HospitalHub.
// Updates the Transaction + application.
// ============================================
async function markCommissionPaid({
  applicationId,
  paymentReference,
  paidBy = 'admin',
  paidByRole = 'admin',
}) {
  if (!paymentReference || typeof paymentReference !== 'string') {
    throw new LoanCommissionError(
      'paymentReference (bank UTR / transaction ID) is required',
      'MISSING_PAYMENT_REFERENCE'
    );
  }

  const transaction = await Transaction.findOne({
    applicationId,
    type: 'commission_payment',
    bookingType: 'loan',
  });

  if (!transaction) {
    throw new LoanCommissionError(
      `No commission transaction found for application ${applicationId}. Post commission first.`,
      'TRANSACTION_NOT_FOUND'
    );
  }

  if (transaction.commissionStatus === 'paid') {
    return {
      alreadyPaid: true,
      transaction,
      message: 'Commission was already marked paid',
    };
  }

  transaction.commissionStatus = 'paid';
  transaction.commissionPaidAt = new Date();
  transaction.commissionPaymentId = paymentReference;
  transaction.status = 'completed';
  transaction.completedAt = new Date();
  transaction.metadata = {
    ...(transaction.metadata || {}),
    paidBy,
    paidByRole,
    paymentReference,
  };
  transaction.updatedAt = new Date();

  await transaction.save();

  await LoanApplication.updateOne(
    { applicationId },
    {
      $set: {
        commissionPaid: true,
        commissionPaidAt: new Date(),
      },
    }
  );

  return {
    alreadyPaid: false,
    transaction,
  };
}

// ============================================
// GET COMMISSION FOR APPLICATION
// ============================================
async function getCommissionForApplication(applicationId) {
  const transaction = await Transaction.findOne({
    applicationId,
    type: 'commission_payment',
    bookingType: 'loan',
  });

  if (!transaction) return null;

  return {
    transactionId: transaction.transactionId,
    disbursedAmount: transaction.amount,
    commissionAmount: transaction.platformCommission,
    commissionStatus: transaction.commissionStatus,
    commissionPaidAt: transaction.commissionPaidAt,
    commissionPaymentId: transaction.commissionPaymentId,
    createdAt: transaction.createdAt,
    metadata: transaction.metadata,
  };
}

// ============================================
// ERROR TYPE
// ============================================
class LoanCommissionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'LoanCommissionError';
    this.code = code;
  }
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  calculate,
  postCommission,
  markCommissionPaid,
  getCommissionForApplication,
  LoanCommissionError,
};
// D:\hospital backend\services\loan\loanStateService.js
// ============================================
// LOAN STATE SERVICE
// ============================================
// Single source of truth for loan application state transitions.
//
// Scope: LOAN / EMI only. Does NOT touch ambulance, ayurveda, homeopathy,
// hospitals, diagnostics, mental health, online doctor, caregivers, insurance,
// corporate, or lab tests.
//
// Every route that changes loan status MUST call this service.
// No route may write `application.status = 'X'` directly.
//
// Uses:
//   - LoanApplication model (existing fields: status, statusHistory — no schema change)
//
// Guarantees:
//   - Valid transitions enforced (state machine)
//   - Role permissions enforced (patient/lender/admin/service)
//   - Reason required for rejections/cancellations/withdrawals
//   - Writes statusHistory entry on every transition (audit trail)
//   - Returns structured result — never throws silently
// ============================================

const LoanApplication = require('../../models/LoanApplication');

// ============================================
// STATE MACHINE
// ============================================
// Key = current status, Value = array of valid next statuses.
//
// Matches the enum in LoanApplication model plus new states:
//   - offer_issued, offer_accepted, offer_declined
//   - agreement_pending, agreement_signed
//   - withdrawn (patient-initiated)
// ============================================
const STATE_MACHINE = {
  draft: ['submitted', 'withdrawn'],
  submitted: ['under_review', 'document_pending', 'rejected', 'withdrawn'],
  under_review: ['offer_issued', 'document_pending', 'rejected', 'withdrawn'],
  document_pending: ['under_review', 'rejected', 'withdrawn'],
  offer_issued: ['offer_accepted', 'offer_declined', 'offer_expired', 'rejected', 'withdrawn'],
  offer_accepted: ['agreement_pending', 'rejected', 'withdrawn'],
  offer_declined: ['under_review', 'withdrawn'],  // lender can reissue after negotiation
  offer_expired: ['under_review', 'withdrawn'],   // lender can reissue
  agreement_pending: ['agreement_signed', 'rejected', 'withdrawn'],
  agreement_signed: ['pending_disbursal', 'rejected', 'withdrawn'],
  pending_disbursal: ['disbursed', 'rejected', 'withdrawn'],
  disbursed: ['completed'],                        // only completion from disbursed
  completed: [],                                   // terminal
  rejected: [],                                    // terminal
  withdrawn: [],                                   // terminal
  cancelled: [],                                   // legacy — terminal
};

// ============================================
// ROLE PERMISSIONS
// ============================================
// Which roles may trigger which transitions.
// Key = transition target status, Value = array of allowed roles.
// ============================================
const TRANSITION_PERMISSIONS = {
  submitted:          ['patient'],
  withdrawn:          ['patient', 'admin_ops'],
  under_review:       ['lender_underwriter', 'lender_ops', 'admin_ops'],
  document_pending:   ['lender_underwriter', 'lender_ops', 'admin_ops'],
  offer_issued:       ['lender_underwriter'],
  offer_accepted:     ['patient'],
  offer_declined:     ['patient'],
  offer_expired:      ['system', 'lender_ops', 'admin_ops'],
  agreement_pending:  ['system', 'lender_ops'],
  agreement_signed:   ['system', 'lender_ops', 'patient'],
  pending_disbursal:  ['lender_ops', 'admin_finance'],
  disbursed:          ['lender_ops', 'admin_finance'],
  completed:          ['system', 'admin_ops'],
  rejected:           ['lender_underwriter', 'admin_ops'],
  cancelled:          ['admin_ops'],
};

// ============================================
// TRANSITIONS REQUIRING A REASON
// ============================================
const REASON_REQUIRED = new Set([
  'rejected',
  'withdrawn',
  'cancelled',
  'offer_declined',
  'offer_expired',
]);

// ============================================
// ERROR TYPE
// ============================================
class LoanStateError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'LoanStateError';
    this.code = code;
  }
}

// ============================================
// CAN TRANSITION (pure check — no DB write)
// ============================================
// Returns { allowed: boolean, reason?: string }
function canTransition({ fromStatus, toStatus, role }) {
  if (!fromStatus || !toStatus) {
    return { allowed: false, reason: 'fromStatus and toStatus are required' };
  }

  if (!STATE_MACHINE[fromStatus]) {
    return { allowed: false, reason: `Unknown current status: ${fromStatus}` };
  }

  if (!STATE_MACHINE[toStatus]) {
    return { allowed: false, reason: `Unknown target status: ${toStatus}` };
  }

  if (!STATE_MACHINE[fromStatus].includes(toStatus)) {
    return {
      allowed: false,
      reason: `Invalid transition: ${fromStatus} → ${toStatus}. Allowed: ${STATE_MACHINE[fromStatus].join(', ') || 'none'}`,
    };
  }

  const allowedRoles = TRANSITION_PERMISSIONS[toStatus] || [];
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return {
      allowed: false,
      reason: `Role '${role}' cannot perform transition to '${toStatus}'. Allowed: ${allowedRoles.join(', ')}`,
    };
  }

  return { allowed: true };
}

// ============================================
// TRANSITION (DB write + audit)
// ============================================
// Applies a state transition to a LoanApplication.
// Returns { success: boolean, application?, error?, code? }
//
// Idempotent: if the application is already in `toStatus`, returns success
// with `alreadyInState: true` — does not duplicate history.
// ============================================
async function transition({
  applicationId,
  toStatus,
  actor,
  actorRole,
  reason = null,
  note = null,
  metadata = null,
}) {
  // ─── Validation ───
  if (!applicationId) {
    throw new LoanStateError('applicationId is required', 'MISSING_APPLICATION_ID');
  }
  if (!toStatus) {
    throw new LoanStateError('toStatus is required', 'MISSING_TO_STATUS');
  }
  if (!actor || !actorRole) {
    throw new LoanStateError('actor and actorRole are required', 'MISSING_ACTOR');
  }

  if (REASON_REQUIRED.has(toStatus) && (!reason || typeof reason !== 'string' || reason.trim().length === 0)) {
    throw new LoanStateError(
      `Reason is required for transition to '${toStatus}'`,
      'MISSING_REASON'
    );
  }

  // ─── Load application ───
  const application = await LoanApplication.findOne({ applicationId });
  if (!application) {
    throw new LoanStateError(`Application not found: ${applicationId}`, 'APPLICATION_NOT_FOUND');
  }

  // ─── Idempotency ───
  if (application.status === toStatus) {
    return {
      success: true,
      alreadyInState: true,
      application,
    };
  }

  // ─── Permission + transition check ───
  const check = canTransition({
    fromStatus: application.status,
    toStatus,
    role: actorRole,
  });

  if (!check.allowed) {
    throw new LoanStateError(check.reason, 'INVALID_TRANSITION');
  }

  // ─── Apply transition ───
  const fromStatus = application.status;
  application.status = toStatus;

  // Push audit entry (existing statusHistory array — no schema change)
  if (!Array.isArray(application.statusHistory)) {
    application.statusHistory = [];
  }

  application.statusHistory.push({
    status: toStatus,
    fromStatus,
    note: note || reason || `Status changed to ${toStatus}`,
    reason: reason || null,
    updatedBy: String(actor),
    updatedByRole: actorRole,
    timestamp: new Date(),
    metadata: metadata || null,
  });

  // Set timestamp fields (existing fields — no schema change)
  const now = new Date();
  switch (toStatus) {
    case 'submitted':
      application.submittedAt = application.submittedAt || now;
      break;
    case 'approved':
      application.approvedAt = now;
      break;
    case 'rejected':
      application.rejectedAt = now;
      break;
    case 'disbursed':
      application.disbursedAt = now;
      break;
    case 'completed':
      // No standard timestamp field — history entry is enough
      break;
  }

  application.updatedAt = now;

  await application.save();

  return {
    success: true,
    alreadyInState: false,
    fromStatus,
    toStatus,
    application,
  };
}

// ============================================
// GET AVAILABLE ACTIONS
// ============================================
// Returns which transitions are allowed for a given role/status.
// Used by frontend to show/hide buttons — single source of truth.
// ============================================
function getAvailableActions({ currentStatus, role }) {
  if (!currentStatus || !role) return [];

  const validNext = STATE_MACHINE[currentStatus] || [];

  return validNext.filter((toStatus) => {
    const allowedRoles = TRANSITION_PERMISSIONS[toStatus] || [];
    return allowedRoles.includes(role);
  });
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  canTransition,
  transition,
  getAvailableActions,
  LoanStateError,
  STATE_MACHINE,
  TRANSITION_PERMISSIONS,
};
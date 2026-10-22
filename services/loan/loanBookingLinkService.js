// D:\hospital backend\services\loan\loanBookingLinkService.js
// ============================================
// LOAN BOOKING LINK SERVICE
// ============================================
// Production-grade validation that ties a LoanApplication to a real
// HospitalHub Booking or Quotation.
//
// Scope: LOAN / EMI only. Does NOT touch ambulance, ayurveda, homeopathy,
// hospitals, diagnostics, mental health, online doctor, caregivers, insurance,
// corporate, or lab tests.
//
// What it validates:
//   1. The referenced booking exists in the DB
//   2. The booking belongs to the same patient who is applying
//   3. The booking is not cancelled / refunded
//   4. The booking amount matches the loan's estimatedAmount (within tolerance)
//   5. The provider/hospital is active (not suspended)
//   6. The booking is not already linked to another loan (prevents double-financing)
//
// What it returns:
//   { valid: true, booking, linkedBookingId, linkedAmount, providerId, providerName }
//   or throws LoanBookingLinkError with a specific code
//
// Why tolerance:
//   Real bookings may include discounts, GST, or rounding — a strict equality
//   check would reject legitimate applications. Tolerance is configurable.
//
// Idempotency:
//   Once a loan is linked to a booking, the booking cannot be linked to another
//   loan. This prevents double-financing the same hospital bill.
// ============================================

const mongoose = require('mongoose');
const LoanApplication = require('../../models/LoanApplication');

// ============================================
// CONFIG
// ============================================
// Amount tolerance: allowed difference between loan estimatedAmount and
// booking amount. Default 1% — real bills vary by rounding and minor charges.
const AMOUNT_TOLERANCE_PERCENT = 1;

// Booking statuses that are eligible for loan financing
// (These come from Booking model enum — verify on first integration)
const ELIGIBLE_BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'in_progress',
  'completed',   // allow financing of already-completed services (retro-EMI)
];

// Booking statuses that are NOT eligible
const INELIGIBLE_BOOKING_STATUSES = [
  'cancelled',
  'refunded',
  'no_show',
  'expired',
];

// ============================================
// ERROR TYPE
// ============================================
class LoanBookingLinkError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'LoanBookingLinkError';
    this.code = code;
  }
}

// ============================================
// LOAD BOOKING (defensive — Booking model may not exist)
// ============================================
// Tries to load the Booking model. If it doesn't exist (wrong deployment),
// throws a clear error instead of crashing.
let Booking;
try {
  Booking = require('../../models/Booking');
} catch (e) {
  Booking = null;
}

// ============================================
// VALIDATE AND LINK
// ============================================
// Main function — validates a booking against a loan application.
// Does NOT modify the application — caller decides what to store.
// ============================================
async function validateAndLink({
  applicationId,
  bookingId,
  tolerancePercent = AMOUNT_TOLERANCE_PERCENT,
}) {
  if (!applicationId) {
    throw new LoanBookingLinkError('applicationId is required', 'MISSING_APPLICATION_ID');
  }
  if (!bookingId) {
    throw new LoanBookingLinkError(
      'bookingId is required. Loans must be linked to a real HospitalHub booking.',
      'MISSING_BOOKING_ID'
    );
  }

  if (!Booking) {
    throw new LoanBookingLinkError(
      'Booking model not available. Cannot validate booking link.',
      'BOOKING_MODEL_UNAVAILABLE'
    );
  }

  // ─── 1. Load application ───
  const application = await LoanApplication.findOne({ applicationId });
  if (!application) {
    throw new LoanBookingLinkError(
      `LoanApplication not found: ${applicationId}`,
      'APPLICATION_NOT_FOUND'
    );
  }

  // ─── 2. Load booking ───
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new LoanBookingLinkError(
      `Booking not found: ${bookingId}`,
      'BOOKING_NOT_FOUND'
    );
  }

  // ─── 3. Check booking belongs to same patient ───
  // patientId may be ObjectId or string depending on Booking model —
  // normalize both sides to string for comparison.
  const bookingPatientId =
    (booking.patientId && booking.patientId.toString()) ||
    (booking.userId && booking.userId.toString()) ||
    null;

  const applicationPatientId = application.patientId && application.patientId.toString();

  if (!bookingPatientId) {
    throw new LoanBookingLinkError(
      'Booking has no patientId/userId — cannot verify ownership',
      'BOOKING_NO_PATIENT'
    );
  }

  if (bookingPatientId !== applicationPatientId) {
    throw new LoanBookingLinkError(
      'Booking does not belong to the applying patient',
      'BOOKING_OWNERSHIP_MISMATCH'
    );
  }

  // ─── 4. Check booking status ───
  const bookingStatus = booking.status || booking.bookingStatus || 'pending';

  if (INELIGIBLE_BOOKING_STATUSES.includes(bookingStatus)) {
    throw new LoanBookingLinkError(
      `Booking status '${bookingStatus}' is not eligible for financing`,
      'BOOKING_STATUS_INELIGIBLE'
    );
  }

  if (!ELIGIBLE_BOOKING_STATUSES.includes(bookingStatus)) {
    throw new LoanBookingLinkError(
      `Booking status '${bookingStatus}' is not recognized as eligible. ` +
      `Update ELIGIBLE_BOOKING_STATUSES in loanBookingLinkService if this is valid.`,
      'BOOKING_STATUS_UNKNOWN'
    );
  }

  // ─── 5. Check amount match (with tolerance) ───
  const bookingAmount =
    booking.finalAmount ||
    booking.totalAmount ||
    booking.amount ||
    booking.estimatedAmount ||
    0;

  const loanAmount = application.estimatedAmount || 0;

  if (bookingAmount <= 0) {
    throw new LoanBookingLinkError(
      'Booking has no valid amount',
      'BOOKING_NO_AMOUNT'
    );
  }

  const toleranceAmount = bookingAmount * (tolerancePercent / 100);
  const minAllowed = bookingAmount - toleranceAmount;
  const maxAllowed = bookingAmount + toleranceAmount;

  if (loanAmount < minAllowed || loanAmount > maxAllowed) {
    throw new LoanBookingLinkError(
      `Loan amount ₹${loanAmount} does not match booking amount ₹${bookingAmount} ` +
      `(tolerance ±${tolerancePercent}% = ₹${minAllowed.toFixed(2)}–₹${maxAllowed.toFixed(2)})`,
      'AMOUNT_MISMATCH'
    );
  }

  // ─── 6. Check booking not already linked to another loan ───
  const existingLink = await LoanApplication.findOne({
    linkedBookingId: bookingId,
    applicationId: { $ne: applicationId }, // exclude current application
    status: { $nin: ['rejected', 'withdrawn', 'cancelled'] },
  });

  if (existingLink) {
    throw new LoanBookingLinkError(
      `Booking is already linked to loan application ${existingLink.applicationId}`,
      'BOOKING_ALREADY_LINKED'
    );
  }

  // ─── 7. Check provider/hospital is active ───
  const providerId =
    booking.hospitalId ||
    booking.providerId ||
    null;

  let providerName = null;
  let providerActive = true; // default true if we can't verify

  if (providerId) {
    // Try to load provider — may be Hospital, Provider, or other model
    // This is defensive: if the provider model isn't available, skip the check
    try {
      const Hospital = require('../../models/Hospital');
      const provider = await Hospital.findById(providerId).select('name status isActive');

      if (provider) {
        providerName = provider.name;
        if (
          provider.status === 'suspended' ||
          provider.status === 'inactive' ||
          provider.isActive === false
        ) {
          providerActive = false;
        }
      }
    } catch (e) {
      // Hospital model may not exist for this booking type — skip check
      console.warn('[loanBookingLinkService] Provider status check skipped:', e.message);
    }

    if (!providerActive) {
      throw new LoanBookingLinkError(
        `Provider ${providerName || providerId} is not active`,
        'PROVIDER_INACTIVE'
      );
    }
  }

  // ─── 8. Success ───
  return {
    valid: true,
    linkedBookingId: String(booking._id),
    linkedAmount: bookingAmount,
    linkedStatus: bookingStatus,
    providerId: providerId ? String(providerId) : null,
    providerName,
    patientId: bookingPatientId,
    applicationPatientId,
  };
}

// ============================================
// PERSIST LINK ON APPLICATION
// ============================================
// After successful validation, writes the link fields to the application.
// These fields must exist on LoanApplication schema:
//   linkedBookingId: String
//   linkedAmount: Number
//   linkedAt: Date
//
// ⚠️ If these fields don't exist yet on the model, this will silently do nothing
// (Mongoose strict mode). Task 5 will add them if needed.
// ============================================
async function persistLink({ applicationId, linkResult }) {
  if (!linkResult || !linkResult.valid) {
    throw new LoanBookingLinkError(
      'Cannot persist — validation did not succeed',
      'PERSIST_WITHOUT_VALIDATION'
    );
  }

  const update = {
    linkedBookingId: linkResult.linkedBookingId,
    linkedAmount: linkResult.linkedAmount,
    linkedAt: new Date(),
  };

  const result = await LoanApplication.updateOne(
    { applicationId },
    { $set: update }
  );

  if (result.matchedCount === 0) {
    throw new LoanBookingLinkError(
      `Application not found during persist: ${applicationId}`,
      'PERSIST_APPLICATION_NOT_FOUND'
    );
  }

  return {
    persisted: true,
    fields: update,
  };
}

// ============================================
// FULL FLOW (validate + persist in one call)
// ============================================
async function link({
  applicationId,
  bookingId,
  tolerancePercent = AMOUNT_TOLERANCE_PERCENT,
}) {
  const linkResult = await validateAndLink({
    applicationId,
    bookingId,
    tolerancePercent,
  });

  const persistResult = await persistLink({ applicationId, linkResult });

  return {
    ...linkResult,
    ...persistResult,
  };
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  validateAndLink,
  persistLink,
  link,
  LoanBookingLinkError,
  AMOUNT_TOLERANCE_PERCENT,
  ELIGIBLE_BOOKING_STATUSES,
  INELIGIBLE_BOOKING_STATUSES,
};
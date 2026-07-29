const multer = require('multer');
const path = require('path');

// ============================================
// CONFIGURE MULTER (Memory Storage for Cloudinary)
// ============================================

// Use memory storage instead of disk storage
// This stores files in buffer for direct upload to Cloudinary
const storage = multer.memoryStorage();

// File filter - only allow images and PDFs
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 
    'image/png', 
    'image/jpg', 
    'image/webp',
    'application/pdf'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, PDF files are allowed'), false);
  }
};

// ============================================
// CREATE MULTER INSTANCE
// ============================================

const upload = multer({
  storage,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB limit (increased from 5MB)
  },
  fileFilter});

// ============================================
// SPECIFIC UPLOAD CONFIGURATIONS
// ============================================

// For single file upload
const uploadSingle = (fieldName) => upload.single(fieldName);

// For multiple files (up to 10)
const uploadMultiple = (fieldName, maxCount = 10) => upload.array(fieldName, maxCount);

// For loan document uploads (6 different document types)
const uploadDocuments = upload.fields([
  { name: 'tentativeEstimate', maxCount: 1 },
  { name: 'finalBill', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'aadhaarCard', maxCount: 1 },
  { name: 'salarySlip', maxCount: 1 },
  { name: 'bankStatement', maxCount: 1 },
  { name: 'collateralDocument', maxCount: 1 }
]);

// ============================================
// FOR CAREGIVER/UPLOAD (Existing functionality)
// ============================================

// Single file upload (for profile photos, etc.)
const uploadProfilePhoto = upload.single('profilePhoto');

// Multiple file upload for general use
const uploadMultipleFiles = upload.array('files', 10);

// ============================================
// EXPORTS
// ============================================

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadDocuments,
  uploadProfilePhoto,
  uploadMultipleFiles
};


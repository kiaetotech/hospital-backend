const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// ============================================
// CONFIGURE CLOUDINARY
// ============================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ============================================
// UPLOAD FILE TO CLOUDINARY
// ============================================

const uploadFile = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_FOLDER || 'hospital_documents',
        resource_type: 'auto',
        ...options
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

// ============================================
// UPLOAD MULTIPLE FILES
// ============================================

const uploadMultipleFiles = async (files) => {
  const results = [];
  for (const file of files) {
    const result = await uploadFile(file.buffer, { 
      public_id: `${Date.now()}_${file.originalname.replace(/\.[^/.]+$/, '')}` 
    });
    results.push({
      fieldname: file.fieldname,
      originalname: file.originalname,
      url: result.secure_url,
      public_id: result.public_id,
      size: result.bytes
    });
  }
  return results;
};

// ============================================
// DELETE FILE FROM CLOUDINARY
// ============================================

const deleteFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Delete failed:', error);
    throw error;
  }
};

// ============================================
// GET SIGNED URL (for secure access)
// ============================================

const getSignedUrl = (publicId, expiresIn = 3600) => {
  return cloudinary.url(publicId, {
    secure: true,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn
  });
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  getSignedUrl,
  cloudinary
};
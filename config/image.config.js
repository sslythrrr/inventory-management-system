/**
 * Image processing configuration
 * Centralized settings untuk Sharp image processing
 */

module.exports = {
  // Maximum image width for resizing
  maxWidth: 500,
  
  // JPEG quality (1-100)
  quality: 80,
  
  // Maximum file size in bytes (5MB)
  maxFileSize: 5 * 1024 * 1024,
  
  // Allowed file extensions
  allowedExtensions: ['jpeg', 'jpg', 'png', 'gif'],
  
  // Allowed MIME types
  allowedMimeTypes: /jpeg|jpg|png|gif/,
  
  // Upload directory path
  uploadDir: 'public/uploads/barang',
  
  // Filename prefix
  filenamePrefix: 'inventas-'
};

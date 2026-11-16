const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const getStorage = (folderName) => {
  if (isCloudinaryConfigured) {
    return new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: folderName,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
      },
    });
  }

  // Fallback to local disk storage when Cloudinary credentials are not configured
  const safeFolder = (folderName || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '_');
  const uploadDir = path.join(__dirname, '../../uploads', safeFolder);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, safeName);
    },
  });
};

module.exports = {
  cloudinary,
  getStorage,
  isCloudinaryConfigured
};

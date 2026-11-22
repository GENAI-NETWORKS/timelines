/**
 * cloudinary.js  — REPLACED with memory-based storage
 *
 * Images are stored as Base64 data-URLs directly in MySQL.
 * No external service (Cloudinary / disk) needed.
 * Compatible with any hosting including Hostinger.
 */
const multer = require('multer');

// Memory storage — file bytes available as req.file.buffer
const memStorage = multer.memoryStorage();

/**
 * Returns a multer memoryStorage instance (folderName kept for API compatibility).
 * Call site: const storage = getStorage('timelines/tailoring');
 */
const getStorage = (_folderName) => memStorage;

// Stub cloudinary object so old delete calls don't crash
const cloudinary = {
  uploader: {
    destroy: async () => ({ result: 'ok' }),
  },
  config: () => {},
};

module.exports = { cloudinary, getStorage, isCloudinaryConfigured: false };

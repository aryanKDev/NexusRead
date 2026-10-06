const { v2: cloudinary } = require('cloudinary');

const requiredVars = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const missing = requiredVars.filter((key) => !process.env[key]?.trim());
const isConfigured = missing.length === 0;

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    api_key: process.env.CLOUDINARY_API_KEY.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
  });
} else {
  const useCloudinary = String(process.env.USE_CLOUDINARY_PDF || '').toLowerCase() === 'true';
  if (useCloudinary) {
    // Cloudinary explicitly enabled, but credentials are missing -> fail fast with actionable error
    throw new Error(
      `Cloudinary config missing: ${missing.join(', ')}. Set these in .env or disable USE_CLOUDINARY_PDF to use local storage.`
    );
  }
  // Local storage mode is active; log a non-fatal warning
  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      `[Cloudinary] Credentials not configured (${missing.join(', ')} missing). Using local disk storage.`
    );
  }
}

cloudinary.isConfigured = isConfigured;

module.exports = cloudinary;

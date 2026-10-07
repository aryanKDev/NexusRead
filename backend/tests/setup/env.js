/**
 * Global test environment variables.
 * Loaded via Jest setupFiles — runs before any test module is loaded.
 *
 * IMPORTANT: These are TEST-ONLY values. No real secrets or production data.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'nexusread-test-jwt-secret-phase5-jest';
process.env.REFRESH_TOKEN_SECRET = 'nexusread-test-refresh-secret-phase5-jest';
process.env.JWT_ACCESS_EXPIRE = '15m';
process.env.REFRESH_TOKEN_EXPIRE_DAYS = '7';
process.env.LOGIN_MAX_ATTEMPTS = '5';
process.env.LOGIN_LOCK_DURATION_MINUTES = '15';
// Suppress Cloudinary configuration warning — no real Cloudinary in tests
process.env.CLOUDINARY_CLOUD_NAME = 'test';
process.env.CLOUDINARY_API_KEY = 'test';
process.env.CLOUDINARY_API_SECRET = 'test';
// Use local storage for PDFs in tests (not Cloudinary)
process.env.USE_CLOUDINARY_PDF = 'false';
// Suppress rate limiter log spam
process.env.LOG_LEVEL = 'error';

/**
 * Jest configuration for backend integration tests.
 *
 * - testEnvironment: node (not jsdom — backend CJS code)
 * - testMatch: only files in tests/ directory
 * - testTimeout: 30s for slow mongodb-memory-server startup
 * - No code transformation needed — backend is pure CJS CommonJS
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 30000,
  // Globally set test env vars (also set in server.js but belt-and-suspenders)
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  // Stop after first failing test in CI to save time
  bail: false,
  // Verbose output so each test name appears
  verbose: true,
  // Do not collect coverage by default (use --coverage flag)
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/utils/logger.js',
  ],
  coverageReporters: ['text', 'lcov'],
  coverageDirectory: 'coverage',
};

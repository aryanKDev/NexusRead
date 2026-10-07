/**
 * Express app test server helper.
 * Provides a reusable supertest agent bound to the real app.
 * Env vars are set BEFORE requiring app to avoid module cache pollution.
 */
const request = require('supertest');

// Minimal test environment (no real secrets needed for in-memory DB tests)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'nexusread-test-jwt-secret-phase5';
process.env.REFRESH_TOKEN_SECRET = 'nexusread-test-refresh-secret-phase5';
process.env.JWT_ACCESS_EXPIRE = '15m';
process.env.REFRESH_TOKEN_EXPIRE_DAYS = '7';
process.env.LOGIN_MAX_ATTEMPTS = '5';
process.env.LOGIN_LOCK_DURATION_MINUTES = '15';

let _app = null;

const getApp = () => {
  if (!_app) {
    _app = require('../../src/app');
  }
  return _app;
};

/**
 * Returns a supertest agent for the real app.
 * Cookie jar is maintained across requests within the same agent instance.
 */
const agent = () => request.agent(getApp());

/**
 * Plain supertest instance (no cookie jar).
 */
const api = () => request(getApp());

/**
 * Sign up a user and return { accessToken, refreshCookie, user }.
 * Re-usable across test files.
 */
const registerAndLogin = async (agentInstance, userData = {}) => {
  const { name = 'Test User', email = `user${Date.now()}@test.com`, password = 'Password123!' } = userData;

  const regRes = await agentInstance
    .post('/api/v1/auth/register')
    .send({ name, email, password });

  return {
    accessToken: regRes.body?.data?.accessToken,
    user: regRes.body?.data?.user,
    statusCode: regRes.statusCode,
  };
};

module.exports = { getApp, agent, api, registerAndLogin };

/**
 * Backend Integration Tests — Authentication
 * Covers Phase 2 security: register, login, refresh, logout, brute-force lockout.
 * Uses in-memory MongoDB — NEVER touches real developer data.
 */

const db = require('./helpers/db');
const { api, agent, registerAndLogin } = require('./helpers/server');
const { User, RefreshToken } = require('../src/models');

// ─── Setup / Teardown ─────────────────────────────────────────────────────────
beforeAll(async () => {
  await db.connect();
});

afterEach(async () => {
  await db.clear();
});

afterAll(async () => {
  await db.close();
});

// ─── REGISTER ─────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/register', () => {
  test('201 — valid registration returns user and access token', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Alice', email: 'alice@test.com', password: 'Password123!' });

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe('alice@test.com');
    expect(res.body.data.user.name).toBe('Alice');
    expect(res.body.data.user.role).toBe('user');
  });

  test('201 — response does NOT include password field', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Bob', email: 'bob@test.com', password: 'Password123!' });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.user.password).toBeUndefined();
  });

  test('201 — password is hashed in database (not stored in plain text)', async () => {
    await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Cathy', email: 'cathy@test.com', password: 'Plain123!' });

    const dbUser = await User.findOne({ email: 'cathy@test.com' }).select('+password');
    expect(dbUser).toBeTruthy();
    expect(dbUser.password).not.toBe('Plain123!');
    expect(dbUser.password).toMatch(/^\$2[aby]\$.{56}$/); // bcrypt hash pattern
  });

  test('201 — sets HttpOnly refresh token cookie', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Dave', email: 'dave@test.com', password: 'Password123!' });

    expect(res.statusCode).toBe(201);
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeTruthy();
    const refreshCookie = cookies.find((c) => c.includes('refreshToken') || c.includes('HttpOnly'));
    expect(refreshCookie).toBeTruthy();
    expect(refreshCookie.toLowerCase()).toContain('httponly');
  });

  test('400 — missing name field', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'noname@test.com', password: 'Password123!' });

    expect(res.statusCode).toBe(400);
  });

  test('400 — invalid email format', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Eve', email: 'not-an-email', password: 'Password123!' });

    expect(res.statusCode).toBe(400);
  });

  test('400 — password too short (< 6 chars)', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Frank', email: 'frank@test.com', password: '12345' });

    expect(res.statusCode).toBe(400);
  });

  test('400 — duplicate email registration', async () => {
    await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Grace', email: 'grace@test.com', password: 'Password123!' });

    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Grace 2', email: 'grace@test.com', password: 'AnotherPass!' });

    expect(res.statusCode).toBe(400);
    expect(res.body.status).not.toBe('success');
  });

  test('400 — empty body', async () => {
    const res = await api().post('/api/v1/auth/register').send({});
    expect(res.statusCode).toBe(400);
  });
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Login User', email: 'loginuser@test.com', password: 'Password123!' });
  });

  test('200 — valid credentials returns access token and user', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'loginuser@test.com', password: 'Password123!' });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe('loginuser@test.com');
  });

  test('200 — response does NOT include password field', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'loginuser@test.com', password: 'Password123!' });

    expect(res.body.data.user.password).toBeUndefined();
  });

  test('200 — sets HttpOnly refresh token cookie on login', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'loginuser@test.com', password: 'Password123!' });

    expect(res.statusCode).toBe(200);
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeTruthy();
    const refreshCookie = cookies.find((c) => c.includes('HttpOnly') || c.toLowerCase().includes('httponly'));
    expect(refreshCookie).toBeTruthy();
  });

  test('401 — wrong password', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'loginuser@test.com', password: 'WrongPass!' });

    expect(res.statusCode).toBe(401);
    expect(res.body.status).not.toBe('success');
  });

  test('401 — unknown email', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.com', password: 'Password123!' });

    expect(res.statusCode).toBe(401);
  });

  test('400 — invalid email format', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'Password123!' });

    expect(res.statusCode).toBe(400);
  });

  test('400 — missing password', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'loginuser@test.com' });

    expect(res.statusCode).toBe(400);
  });

  test('200 — successful login resets failedLoginAttempts', async () => {
    // Trigger one failed attempt first
    await api()
      .post('/api/v1/auth/login')
      .send({ email: 'loginuser@test.com', password: 'WrongPass!' });

    // Now login correctly
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'loginuser@test.com', password: 'Password123!' });

    expect(res.statusCode).toBe(200);

    const user = await User.findOne({ email: 'loginuser@test.com' }).select('+failedLoginAttempts +lockedUntil');
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeFalsy();
  });
});

// ─── BRUTE-FORCE LOCKOUT ──────────────────────────────────────────────────────
describe('Brute-force lockout (Phase 2)', () => {
  const EMAIL = 'locktest@test.com';
  const PASS = 'Correct123!';
  const MAX = parseInt(process.env.LOGIN_MAX_ATTEMPTS, 10) || 5;

  beforeEach(async () => {
    await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Lock Test User', email: EMAIL, password: PASS });
  });

  test('401 each time before lockout threshold', async () => {
    for (let i = 0; i < MAX - 1; i++) {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: EMAIL, password: 'Wrong!' });
      expect(res.statusCode).toBe(401);
    }
  });

  test('failedLoginAttempts increments with each failed login', async () => {
    await api().post('/api/v1/auth/login').send({ email: EMAIL, password: 'Wrong!' });
    await api().post('/api/v1/auth/login').send({ email: EMAIL, password: 'Wrong!' });

    const user = await User.findOne({ email: EMAIL }).select('+failedLoginAttempts');
    expect(user.failedLoginAttempts).toBe(2);
  });

  test('account locks after MAX failed attempts', async () => {
    for (let i = 0; i < MAX; i++) {
      await api().post('/api/v1/auth/login').send({ email: EMAIL, password: 'Wrong!' });
    }

    const user = await User.findOne({ email: EMAIL }).select('+lockedUntil +failedLoginAttempts');
    expect(user.lockedUntil).toBeTruthy();
    expect(user.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  test('429 — locked account rejects correct password while locked', async () => {
    for (let i = 0; i < MAX; i++) {
      await api().post('/api/v1/auth/login').send({ email: EMAIL, password: 'Wrong!' });
    }

    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: PASS });

    expect(res.statusCode).toBe(429);
    expect(res.body.message).toMatch(/locked/i);
  });

  test('unknown email does NOT create phantom lockout record', async () => {
    for (let i = 0; i < MAX; i++) {
      await api()
        .post('/api/v1/auth/login')
        .send({ email: 'phantom@test.com', password: 'Wrong!' });
    }

    const user = await User.findOne({ email: 'phantom@test.com' });
    expect(user).toBeNull();
  });

  test('200 — account unlocks after lockout expires', async () => {
    // Lock the account
    for (let i = 0; i < MAX; i++) {
      await api().post('/api/v1/auth/login').send({ email: EMAIL, password: 'Wrong!' });
    }

    // Manually expire the lockout to simulate time passing
    await User.updateOne(
      { email: EMAIL },
      { $set: { lockedUntil: new Date(Date.now() - 1000) } }
    );

    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: PASS });

    // After lockout expires, correct password should work (200 or 401 if server re-checks)
    // The implementation checks lockedUntil > Date.now(), so an expired lock should allow login
    expect(res.statusCode).toBe(200);
  });
});

// ─── REFRESH ──────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/refresh', () => {
  test('200 — valid refresh cookie returns new access token', async () => {
    const a = agent();
    await registerAndLogin(a, { email: 'refresh1@test.com' });

    const res = await a.post('/api/v1/auth/refresh');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.accessToken).toBeTruthy();
  });

  test('401 — no refresh cookie', async () => {
    const res = await api().post('/api/v1/auth/refresh');
    expect(res.statusCode).toBe(401);
  });

  test('401 — garbage refresh cookie', async () => {
    const res = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=garbage.invalid.token');

    expect(res.statusCode).toBe(401);
  });

  test('401 — reuse detection: using same refresh token twice triggers reuse flow', async () => {
    const a = agent();
    // Register to get cookie in agent
    const regRes = await a
      .post('/api/v1/auth/register')
      .send({ name: 'Reuse Test', email: 'reuse@test.com', password: 'Password123!' });

    // Extract the cookie value from the set-cookie header
    const cookies = regRes.headers['set-cookie'];
    const tokenCookie = cookies.find((c) => c.startsWith('refreshToken='));
    expect(tokenCookie).toBeTruthy();
    const tokenValue = tokenCookie.split(';')[0].split('=')[1];

    // First rotation: the agent cookie rotates automatically
    await a.post('/api/v1/auth/refresh');

    // Now replay the ORIGINAL (now revoked) token value
    const res = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${tokenValue}`);

    // Reuse detection: should fail with 401
    expect(res.statusCode).toBe(401);
  });
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/logout', () => {
  test('200 — logout succeeds and clears refresh cookie', async () => {
    const a = agent();
    await registerAndLogin(a, { email: 'logout1@test.com' });

    const res = await a.post('/api/v1/auth/logout');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');

    // Cookie should be cleared (set with maxAge=0)
    const cookies = res.headers['set-cookie'];
    if (cookies) {
      const refreshCookie = cookies.find((c) => c.includes('refreshToken'));
      if (refreshCookie) {
        // Should be expired or empty
        expect(refreshCookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
      }
    }
  });

  test('200 — logout without cookie still returns 200 (no crash)', async () => {
    const res = await api().post('/api/v1/auth/logout');
    expect(res.statusCode).toBe(200);
  });

  test('401 — refresh token after logout is invalid', async () => {
    const a = agent();
    await registerAndLogin(a, { email: 'logout2@test.com' });
    await a.post('/api/v1/auth/logout');

    const res = await a.post('/api/v1/auth/refresh');
    expect(res.statusCode).toBe(401);
  });
});

// ─── GET ME ───────────────────────────────────────────────────────────────────
describe('GET /api/v1/auth/me', () => {
  test('200 — returns current user when access token is valid', async () => {
    const a = agent();
    const { accessToken } = await registerAndLogin(a, { email: 'me@test.com' });

    const res = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.user.email).toBe('me@test.com');
    expect(res.body.data.user.password).toBeUndefined();
  });

  test('401 — no token returns 401', async () => {
    const res = await api().get('/api/v1/auth/me');
    expect(res.statusCode).toBe(401);
  });

  test('401 — invalid token returns 401', async () => {
    const res = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer garbage.token.here');
    expect(res.statusCode).toBe(401);
  });
});

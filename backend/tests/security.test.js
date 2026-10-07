/**
 * Backend Integration Tests — Security
 * Phase 2 IDOR security, path traversal, and authorization regression.
 */

const db = require('./helpers/db');
const { api } = require('./helpers/server');
const { createUser, createUploadedBook } = require('./helpers/factories');
const { signAccessToken } = require('../src/utils/tokenUtils');
const path = require('path');
const fs = require('fs');

beforeAll(async () => { await db.connect(); });
afterEach(async () => { await db.clear(); });
afterAll(async () => { await db.close(); });

const makeUserWithToken = async (suffix = Date.now()) => {
  const user = await createUser({ email: `secuser${suffix}@test.com` });
  const token = signAccessToken(user._id, 'user');
  return { user, token };
};

// ─── PDF IDOR — OWNERSHIP ENFORCEMENT ─────────────────────────────────────────
// Tests the /api/v1/pdfs/:filename endpoint that serves uploaded PDFs
// with a DB ownership check (Phase 2 critical feature).
describe('PDF IDOR security (Phase 2)', () => {
  test('401 — guest cannot access PDF file', async () => {
    const { user } = await makeUserWithToken(1);
    const book = await createUploadedBook(user._id, { publicId: 'idor_test_1.pdf' });

    const res = await api().get('/api/v1/pdfs/idor_test_1.pdf');
    expect(res.statusCode).toBe(401);
  });

  test('403 — User B cannot access User A PDF via filename', async () => {
    const { user: userA } = await makeUserWithToken(2);
    const { token: tokenB } = await makeUserWithToken(3);

    // User A owns this book
    await createUploadedBook(userA._id, {
      publicId: 'idor_file_a.pdf',
      fileUrl: `http://localhost:5000/api/v1/pdfs/idor_file_a.pdf`,
    });

    // User B tries to access User A's file
    const res = await api()
      .get('/api/v1/pdfs/idor_file_a.pdf')
      .set('Authorization', `Bearer ${tokenB}`);

    // 403 or 404 — either way, NOT 200
    expect([403, 404]).toContain(res.statusCode);
  });

  test('404 — nonexistent filename returns safe 404 (not 500 or path leak)', async () => {
    const { token } = await makeUserWithToken(4);

    const res = await api()
      .get('/api/v1/pdfs/nonexistent_file_12345.pdf')
      .set('Authorization', `Bearer ${token}`);

    expect([404, 403]).toContain(res.statusCode);
    // Response body must NOT leak filesystem paths
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/C:\\/);
    expect(bodyStr).not.toMatch(/\/home\//);
    expect(bodyStr).not.toMatch(/node_modules/);
  });

  test('400 or 403 — path traversal attempt is rejected', async () => {
    const { token } = await makeUserWithToken(5);

    // Attempt path traversal
    const res = await api()
      .get('/api/v1/pdfs/..%2F..%2Fetc%2Fpasswd')
      .set('Authorization', `Bearer ${token}`);

    // Must not be 200 — path traversal must be blocked
    expect(res.statusCode).not.toBe(200);
  });

  test('404 — malformed/no-extension filename handled safely', async () => {
    const { token } = await makeUserWithToken(6);

    const res = await api()
      .get('/api/v1/pdfs/no-extension-here')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).not.toBe(500);
    expect([404, 403, 400]).toContain(res.statusCode);
  });
});

// ─── UPLOADED BOOK READER IDOR ─────────────────────────────────────────────────
describe('Reader uploaded book IDOR prevention (Phase 2)', () => {
  test('403 — User B cannot access User A uploaded book in reader', async () => {
    const { user: userA } = await makeUserWithToken(7);
    const { token: tokenB } = await makeUserWithToken(8);

    const bookA = await createUploadedBook(userA._id);

    const res = await api()
      .get(`/api/v1/reader/${bookA._id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.statusCode).toBe(403);
    // Response body must not contain book data
    expect(res.body.data).toBeUndefined();
  });

  test('403 — User B cannot read User A progress for uploaded book', async () => {
    const { user: userA } = await makeUserWithToken(9);
    const { token: tokenB } = await makeUserWithToken(10);

    const bookA = await createUploadedBook(userA._id);

    // User A saves progress
    const tokenA = signAccessToken(userA._id, 'user');
    await api()
      .patch('/api/v1/reader/progress')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ bookId: bookA._id.toString(), currentPage: 20, totalPages: 100 });

    // User B tries to GET progress for User A's book
    const res = await api()
      .get('/api/v1/reader/progress')
      .query({ bookId: bookA._id.toString() })
      .set('Authorization', `Bearer ${tokenB}`);

    // Should be 403 (non-owner access to uploaded book is denied)
    expect(res.statusCode).toBe(403);
  });
});

// ─── ADMIN ROUTE PROTECTION ────────────────────────────────────────────────────
describe('Admin route protection (Phase 2)', () => {
  const ADMIN_ROUTES = [
    { method: 'get', path: '/api/v1/admin/stats' },
    { method: 'get', path: '/api/v1/admin/users' },
    { method: 'get', path: '/api/v1/admin/audit-logs' },
  ];

  ADMIN_ROUTES.forEach(({ method, path }) => {
    test(`401 — ${method.toUpperCase()} ${path} without auth`, async () => {
      const res = await api()[method](path);
      expect(res.statusCode).toBe(401);
    });

    test(`403 — ${method.toUpperCase()} ${path} with regular user token`, async () => {
      const { token } = await makeUserWithToken();
      const res = await api()[method](path).set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(403);
    });
  });
});

// ─── INPUT VALIDATION / INJECTION RESISTANCE ─────────────────────────────────
describe('Input validation and injection resistance', () => {
  test('MongoDB operator injection in email is rejected or sanitized', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: { $gt: '' }, password: 'anything' });

    // Should NOT return 200 (which would indicate successful bypass)
    expect(res.statusCode).not.toBe(200);
    expect([400, 401, 422]).toContain(res.statusCode);
  });

  test('SQL-like injection in search query is safely handled', async () => {
    const res = await api()
      .get('/api/v1/books/search')
      .query({ q: "'; DROP TABLE books; --" });

    // Should not 500 or leak data — any non-500 is acceptable
    expect(res.statusCode).not.toBe(500);
  });
});

/**
 * Backend Integration Tests — Book Routes (Security & Authorization)
 * Covers Phase 1 (routes), Phase 2 (authorization), Phase 4 (route topology preserved).
 * Tests the ACTUAL mounted route chain: book.routes.js → bookRoutes.js → bookController.js
 */

const db = require('./helpers/db');
const { api, agent, registerAndLogin } = require('./helpers/server');
const { createBook } = require('./helpers/factories');

beforeAll(async () => { await db.connect(); });
afterEach(async () => { await db.clear(); });
afterAll(async () => { await db.close(); });

// ─── PUBLIC BOOK DISCOVERY (Phase 2: optionalProtect) ─────────────────────────
describe('Public book discovery', () => {
  beforeEach(async () => {
    await createBook({ title: 'Public Book', author: 'Author A' });
    await createBook({ title: 'Another Book', author: 'Author B' });
  });

  test('200 — guest can GET /api/v1/books (list all books)', async () => {
    const res = await api().get('/api/v1/books');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('200 — guest can GET /api/v1/books/explore', async () => {
    const res = await api().get('/api/v1/books/explore');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('books');
    expect(Array.isArray(res.body.data.books)).toBe(true);
  });

  test('200 — guest can GET /api/v1/books/:id (known book)', async () => {
    const book = await createBook({ title: 'Direct Book', author: 'Direct Author' });
    const res = await api().get(`/api/v1/books/${book._id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.book.title).toBe('Direct Book');
  });

  test('200 — guest can GET /api/v1/books/search with query', async () => {
    const res = await api()
      .get('/api/v1/books/search')
      .query({ q: 'test' });
    // Should succeed (even if no external results in test env)
    // External services are handled by the controller with graceful empty result
    expect([200, 502, 500]).toContain(res.statusCode);
    // At minimum it should NOT be 401 (unauthorized)
    expect(res.statusCode).not.toBe(401);
  });
});

// ─── PROTECTED MUTATIONS (Phase 2) ─────────────────────────────────────────────
describe('Protected book mutations — guest cannot mutate', () => {
  let bookId;

  beforeEach(async () => {
    const book = await createBook({ title: 'Protected Book', author: 'Auth Author' });
    bookId = book._id.toString();
  });

  test('401 — POST /api/v1/books without auth', async () => {
    const res = await api()
      .post('/api/v1/books')
      .send({ title: 'Hack', author: 'Hacker', pages: 100 });
    expect(res.statusCode).toBe(401);
  });

  test('401 — PUT /api/v1/books/:id without auth', async () => {
    const res = await api()
      .put(`/api/v1/books/${bookId}`)
      .send({ title: 'Mutated' });
    expect(res.statusCode).toBe(401);
  });

  test('401 — DELETE /api/v1/books/:id without auth', async () => {
    const res = await api().delete(`/api/v1/books/${bookId}`);
    expect(res.statusCode).toBe(401);
  });

  test('401 — POST /api/v1/books/:id/add-to-library without auth', async () => {
    const res = await api().post(`/api/v1/books/${bookId}/add-to-library`);
    expect(res.statusCode).toBe(401);
  });

  test('401 — POST /api/v1/books/add-external without auth', async () => {
    const res = await api()
      .post('/api/v1/books/add-external')
      .send({ externalId: 'abc', externalSource: 'google', title: 'Ext Book' });
    expect(res.statusCode).toBe(401);
  });
});

// ─── AUTHENTICATED BOOK OPERATIONS ────────────────────────────────────────────
describe('Authenticated book operations', () => {
  let accessToken;
  let a;

  beforeEach(async () => {
    a = agent();
    const result = await registerAndLogin(a, { email: `bookuser${Date.now()}@test.com` });
    accessToken = result.accessToken;
  });

  test('201 — authenticated user can create a book', async () => {
    const res = await api()
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'New Book', author: 'New Author', pages: 300 });

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.book.title).toBe('New Book');
  });

  test('201 — add to library creates ReadingProgress', async () => {
    const book = await createBook({ title: 'Library Book', author: 'Lib Author' });

    const res = await api()
      .post(`/api/v1/books/${book._id}/add-to-library`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('success');
  });

  test('200 — authenticated user can update own book', async () => {
    // First create a book
    const createRes = await api()
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Original Title', author: 'Author', pages: 100 });

    const bookId = createRes.body.data.book._id;

    const res = await api()
      .put(`/api/v1/books/${bookId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Updated Title' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.book.title).toBe('Updated Title');
  });

  test('200 — authenticated user can delete own book', async () => {
    const createRes = await api()
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'To Delete', author: 'Author', pages: 50 });

    const bookId = createRes.body.data.book._id;

    const res = await api()
      .delete(`/api/v1/books/${bookId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
  });
});

// ─── ADMIN AUTHORIZATION (Phase 2) ─────────────────────────────────────────────
describe('Admin authorization', () => {
  test('403 — normal user cannot access admin stats', async () => {
    const a = agent();
    const { accessToken } = await registerAndLogin(a, { email: `normaluser${Date.now()}@test.com` });

    const res = await api()
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(403);
  });

  test('401 — unauthenticated request cannot access admin stats', async () => {
    const res = await api().get('/api/v1/admin/stats');
    expect(res.statusCode).toBe(401);
  });

  test('200 — admin user can access admin stats', async () => {
    const a = agent();
    const { accessToken } = await registerAndLogin(a, {
      email: `admin${Date.now()}@test.com`,
    });

    // Elevate to admin directly in DB (mimics admin provisioning)
    const { User } = require('../src/models');
    await User.updateOne({ email: a._email || 'admin@test.com' }, { role: 'admin' }).catch(() => {});

    // We need to fetch the actual user token with admin role — re-login after update
    const loginRes = await a.post('/api/v1/auth/login').catch(() => null);
    // If we can't re-login in same agent context, test auth with a direct admin
    const { createAdmin } = require('./helpers/factories');
    const adminUser = await createAdmin({ email: `adminx${Date.now()}@test.com` });

    const { signAccessToken } = require('../src/utils/tokenUtils');
    const adminToken = signAccessToken(adminUser._id, 'admin');

    const res = await api()
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});

// ─── ROUTE TOPOLOGY PRESERVED (Phase 4) ─────────────────────────────────────────
describe('Phase 4 — route topology sanity', () => {
  test('book.routes.js is active: GET /api/v1/books/search is mounted', async () => {
    const res = await api().get('/api/v1/books/search').query({ q: 'a' });
    // Not 404 — route exists (may fail with 502 if external API is down in test, that is acceptable)
    expect(res.statusCode).not.toBe(404);
    expect(res.statusCode).not.toBe(401);
  });

  test('bookRoutes.js is active via book.routes.js: GET /api/v1/books/explore is mounted', async () => {
    const res = await api().get('/api/v1/books/explore');
    expect([200, 500]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(404);
  });

  test('both controllers remain wired: POST /api/v1/books/preview-click exists', async () => {
    const res = await api()
      .post('/api/v1/books/preview-click')
      .send({ bookId: '507f1f77bcf86cd799439011', previewLink: 'https://example.com' });
    // Requires auth — 401 is expected, not 404
    expect(res.statusCode).toBe(401);
  });
});

// ─── METADATA NORMALIZATION (Phase 1 regression) ────────────────────────────────
describe('Phase 1 — book metadata contract', () => {
  test('GET /api/v1/books returns expected data shape', async () => {
    await createBook({ title: 'Meta Book', author: 'Meta Author', pages: 150 });

    const res = await api().get('/api/v1/books');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    if (res.body.data.length > 0) {
      const book = res.body.data[0];
      // Required fields exist
      expect(book.title).toBeDefined();
      expect(book.author).toBeDefined();
    }
  });

  test('GET /api/v1/books/:id returns normalized book shape', async () => {
    const book = await createBook({
      title: 'Shaped Book',
      author: 'Shaped Author',
      pages: 100,
      genre: ['Fiction'],
      cover: 'https://example.com/cover.jpg',
    });

    const res = await api().get(`/api/v1/books/${book._id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.book.title).toBe('Shaped Book');
    expect(res.body.data.book.author).toBe('Shaped Author');
    expect(res.body.data.book.pages).toBe(100);
    expect(Array.isArray(res.body.data.book.genre)).toBe(true);
  });

  test('404 — nonexistent book returns 404', async () => {
    const res = await api().get('/api/v1/books/507f1f77bcf86cd799439011');
    expect(res.statusCode).toBe(404);
  });
});

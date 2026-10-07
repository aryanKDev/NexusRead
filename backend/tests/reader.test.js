/**
 * Backend Integration Tests — Reader API
 * Covers Phase 1 (book resolution) and Phase 3 (progress, bookmarks, highlights).
 * Critical: tests that page updates do NOT clobber existing annotations.
 */

const db = require('./helpers/db');
const { api, agent, registerAndLogin } = require('./helpers/server');
const { createUser, createBook, createUploadedBook } = require('./helpers/factories');
const { signAccessToken } = require('../src/utils/tokenUtils');

beforeAll(async () => { await db.connect(); });
afterEach(async () => { await db.clear(); });
afterAll(async () => { await db.close(); });

// ─── Helper: create user and get token ────────────────────────────────────────
const makeUserWithToken = async (emailSuffix = Date.now()) => {
  const user = await createUser({ email: `readeruser${emailSuffix}@test.com` });
  const token = signAccessToken(user._id, 'user');
  return { user, token };
};

// ─── AUTHENTICATION REQUIRED ──────────────────────────────────────────────────
describe('Reader routes require authentication', () => {
  test('401 — GET /api/v1/reader/:bookId without auth', async () => {
    const res = await api().get('/api/v1/reader/507f1f77bcf86cd799439011');
    expect(res.statusCode).toBe(401);
  });

  test('401 — GET /api/v1/reader/progress without auth', async () => {
    const res = await api().get('/api/v1/reader/progress').query({ bookId: '507f1f77bcf86cd799439011' });
    expect(res.statusCode).toBe(401);
  });

  test('401 — PATCH /api/v1/reader/progress without auth', async () => {
    const res = await api().patch('/api/v1/reader/progress').send({ bookId: '507f1f77bcf86cd799439011', currentPage: 5, totalPages: 100 });
    expect(res.statusCode).toBe(401);
  });
});

// ─── CATALOG BOOK RESOLUTION (Phase 1) ────────────────────────────────────────
describe('Catalog book resolution', () => {
  test('200 — authenticated user can GET /api/v1/reader/:bookId for catalog book', async () => {
    const { token } = await makeUserWithToken();
    const book = await createBook({ title: 'Reader Book', author: 'Reader Author', pages: 250 });

    const res = await api()
      .get(`/api/v1/reader/${book._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Reader Book');
  });

  test('400 — malformed ObjectId returns 400', async () => {
    const { token } = await makeUserWithToken();

    const res = await api()
      .get('/api/v1/reader/not-a-valid-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(400);
  });

  test('404 — nonexistent book ID returns 404', async () => {
    const { token } = await makeUserWithToken();

    const res = await api()
      .get('/api/v1/reader/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(404);
  });
});

// ─── UPLOADED BOOK AUTHORIZATION (Phase 2 IDOR regression) ───────────────────
describe('Uploaded book ownership enforcement', () => {
  test('200 — owner can access their uploaded book', async () => {
    const { user, token } = await makeUserWithToken(1);
    const uploadedBook = await createUploadedBook(user._id);

    const res = await api()
      .get(`/api/v1/reader/${uploadedBook._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.title).toBe('My Uploaded PDF');
  });

  test('403 — non-owner cannot access uploaded book (IDOR prevention)', async () => {
    const { user: ownerUser } = await makeUserWithToken(2);
    const { token: attackerToken } = await makeUserWithToken(3);

    const uploadedBook = await createUploadedBook(ownerUser._id);

    const res = await api()
      .get(`/api/v1/reader/${uploadedBook._id}`)
      .set('Authorization', `Bearer ${attackerToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.data).toBeUndefined();
  });
});

// ─── PROGRESS — SAVE AND LOAD ──────────────────────────────────────────────────
describe('Reading progress save and load', () => {
  test('200 — GET /api/v1/reader/progress returns defaults for new book', async () => {
    const { user, token } = await makeUserWithToken(4);
    const book = await createBook({ title: 'Progress Book', author: 'P Author', pages: 300 });

    const res = await api()
      .get('/api/v1/reader/progress')
      .query({ bookId: book._id.toString() })
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.currentPage).toBe(1);
    expect(res.body.data.percentage).toBe(0);
    expect(Array.isArray(res.body.data.bookmarks)).toBe(true);
    expect(Array.isArray(res.body.data.userHighlights)).toBe(true);
  });

  test('200 — PATCH progress saves page and percentage', async () => {
    const { user, token } = await makeUserWithToken(5);
    const book = await createBook({ title: 'Save Book', author: 'S Author', pages: 200 });

    const res = await api()
      .patch('/api/v1/reader/progress')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId: book._id.toString(), currentPage: 50, totalPages: 200 });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.currentPage).toBe(50);
    expect(res.body.data.percentage).toBe(25);
  });

  test('200 — progress upserts: second save updates, does not duplicate', async () => {
    const { user, token } = await makeUserWithToken(6);
    const book = await createBook({ title: 'Upsert Book', author: 'U Author', pages: 100 });
    const bookId = book._id.toString();

    // First save
    await api()
      .patch('/api/v1/reader/progress')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId, currentPage: 10, totalPages: 100 });

    // Second save
    await api()
      .patch('/api/v1/reader/progress')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId, currentPage: 20, totalPages: 100 });

    // Verify only one document exists
    const { ReadingProgress } = require('../src/models');
    const docs = await ReadingProgress.find({ user: user._id, book: book._id });
    expect(docs.length).toBe(1);
    expect(docs[0].currentPage).toBe(20);
  });

  test('400 — currentPage = 0 is rejected', async () => {
    const { token } = await makeUserWithToken(7);
    const book = await createBook({ title: 'Valid Book', author: 'V A', pages: 100 });

    const res = await api()
      .patch('/api/v1/reader/progress')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId: book._id.toString(), currentPage: 0, totalPages: 100 });

    expect(res.statusCode).toBe(400);
  });

  test('400 — currentPage > totalPages is rejected', async () => {
    const { token } = await makeUserWithToken(8);
    const book = await createBook({ title: 'Valid Book 2', author: 'V A', pages: 100 });

    const res = await api()
      .patch('/api/v1/reader/progress')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId: book._id.toString(), currentPage: 200, totalPages: 100 });

    expect(res.statusCode).toBe(400);
  });
});

// ─── ANNOTATION PRESERVATION (Phase 3 — CRITICAL) ─────────────────────────────
describe('Phase 3 — annotation preservation (bookmarks not clobbered by page save)', () => {
  test('page save preserves existing bookmarks when bookmarks field is absent', async () => {
    const { user, token } = await makeUserWithToken(9);
    const book = await createBook({ title: 'Annotated Book', author: 'Ann Author', pages: 500 });
    const bookId = book._id.toString();

    // Save progress with bookmarks
    await api()
      .patch('/api/v1/reader/progress')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bookId,
        currentPage: 20,
        totalPages: 500,
        bookmarks: [{ page: 15, label: 'My bookmark' }],
      });

    // Now update ONLY page — do NOT send bookmarks field
    await api()
      .patch('/api/v1/reader/progress')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId, currentPage: 21, totalPages: 500 });

    // Verify bookmarks survived
    const { ReadingProgress } = require('../src/models');
    const progress = await ReadingProgress.findOne({ user: user._id, book: book._id });

    expect(progress.currentPage).toBe(21);
    expect(progress.bookmarks.length).toBe(1);
    expect(progress.bookmarks[0].page).toBe(15);
    expect(progress.bookmarks[0].label).toBe('My bookmark');
  });

  test('bookmark update does not clobber existing page position', async () => {
    const { user, token } = await makeUserWithToken(10);
    const book = await createBook({ title: 'Bookmark Test Book', author: 'BT Author', pages: 400 });
    const bookId = book._id.toString();

    // Save page position
    await api()
      .patch('/api/v1/reader/progress')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId, currentPage: 50, totalPages: 400 });

    // Now save with bookmarks only (page remains same)
    await api()
      .patch('/api/v1/reader/progress')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bookId,
        currentPage: 50,
        totalPages: 400,
        bookmarks: [{ page: 50, label: 'Chapter 3' }],
        userHighlights: [{ text: 'Important quote', page: 50, color: '#FF0000' }],
      });

    const { ReadingProgress } = require('../src/models');
    const progress = await ReadingProgress.findOne({ user: user._id, book: book._id });

    expect(progress.currentPage).toBe(50);
    expect(progress.bookmarks.length).toBe(1);
    expect(progress.userHighlights.length).toBe(1);
    expect(progress.userHighlights[0].text).toBe('Important quote');
  });

  test('highlights text and page survive round-trip correctly', async () => {
    const { user, token } = await makeUserWithToken(11);
    const book = await createBook({ title: 'Highlight Book', author: 'H Author', pages: 300 });
    const bookId = book._id.toString();

    await api()
      .patch('/api/v1/reader/progress')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bookId,
        currentPage: 10,
        totalPages: 300,
        userHighlights: [{ text: 'Test highlight text', page: 10, color: '#FBBF24' }],
      });

    const { ReadingProgress } = require('../src/models');
    const progress = await ReadingProgress.findOne({ user: user._id, book: book._id });

    expect(progress.userHighlights[0].text).toBe('Test highlight text');
    expect(progress.userHighlights[0].page).toBe(10);
  });
});

// ─── SESSION CREATION (Phase 3) ────────────────────────────────────────────────
describe('Reading session creation', () => {
  test('201 — creating a reading session succeeds for catalog book', async () => {
    const { user, token } = await makeUserWithToken(12);
    const book = await createBook({ title: 'Session Book', author: 'S Auth', pages: 200 });

    const res = await api()
      .post('/api/v1/reader/session')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId: book._id.toString(), durationInSeconds: 1800 });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ok).toBe(true);
  });

  test('400 — missing bookId rejected', async () => {
    const { token } = await makeUserWithToken(13);
    const res = await api()
      .post('/api/v1/reader/session')
      .set('Authorization', `Bearer ${token}`)
      .send({ durationInSeconds: 600 });

    expect(res.statusCode).toBe(400);
  });

  test('400 — negative duration rejected', async () => {
    const { token } = await makeUserWithToken(14);
    const book = await createBook({ title: 'Dur Book', author: 'D Auth', pages: 100 });

    const res = await api()
      .post('/api/v1/reader/session')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId: book._id.toString(), durationInSeconds: -1 });

    expect(res.statusCode).toBe(400);
  });
});

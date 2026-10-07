/**
 * Backend Integration Tests — Notes API
 * Covers Phase 3: note CRUD with proper ownership and isolation.
 */

const db = require('./helpers/db');
const { api } = require('./helpers/server');
const { createUser, createBook } = require('./helpers/factories');
const { signAccessToken } = require('../src/utils/tokenUtils');

beforeAll(async () => { await db.connect(); });
afterEach(async () => { await db.clear(); });
afterAll(async () => { await db.close(); });

const makeUserWithToken = async (suffix = Date.now()) => {
  const user = await createUser({ email: `noteuser${suffix}@test.com` });
  const token = signAccessToken(user._id, 'user');
  return { user, token };
};

// ─── AUTH REQUIRED ─────────────────────────────────────────────────────────────
describe('Notes routes require authentication', () => {
  test('401 — GET /api/v1/reader/notes/:bookId without auth', async () => {
    const res = await api().get('/api/v1/reader/notes/507f1f77bcf86cd799439011');
    expect(res.statusCode).toBe(401);
  });

  test('401 — POST /api/v1/reader/notes/:bookId without auth', async () => {
    const res = await api()
      .post('/api/v1/reader/notes/507f1f77bcf86cd799439011')
      .send({ content: 'Test note' });
    expect(res.statusCode).toBe(401);
  });
});

// ─── NOTE CRUD LIFECYCLE ───────────────────────────────────────────────────────
describe('Note lifecycle: create → get → delete → gone', () => {
  test('complete lifecycle: create, get, delete, confirm gone', async () => {
    const { user, token } = await makeUserWithToken(1);
    const book = await createBook({ title: 'Note Book', author: 'N Author', pages: 100 });
    const bookId = book._id.toString();

    // CREATE
    const createRes = await api()
      .post(`/api/v1/reader/notes/${bookId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'My important note', page: 42 });

    expect(createRes.statusCode).toBe(201);
    expect(createRes.body.success).toBe(true);
    const noteId = createRes.body.data._id;
    expect(noteId).toBeTruthy();

    // GET — note should be returned
    const getRes = await api()
      .get(`/api/v1/reader/notes/${bookId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.statusCode).toBe(200);
    expect(Array.isArray(getRes.body.data)).toBe(true);
    expect(getRes.body.data.length).toBe(1);
    expect(getRes.body.data[0].content).toBe('My important note');
    expect(getRes.body.data[0].page).toBe(42);

    // DELETE
    const deleteRes = await api()
      .delete(`/api/v1/reader/notes/${bookId}/${noteId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.body.message).toMatch(/deleted/i);

    // GET AGAIN — note should be gone
    const getRes2 = await api()
      .get(`/api/v1/reader/notes/${bookId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes2.statusCode).toBe(200);
    expect(getRes2.body.data.length).toBe(0);
  });
});

// ─── USER OWNERSHIP ENFORCEMENT ────────────────────────────────────────────────
describe('Note ownership — cross-user isolation', () => {
  test("User B cannot read User A's notes", async () => {
    const { user: userA, token: tokenA } = await makeUserWithToken(2);
    const { user: userB, token: tokenB } = await makeUserWithToken(3);
    const book = await createBook({ title: 'Shared Book', author: 'Sh Auth', pages: 50 });
    const bookId = book._id.toString();

    // User A creates a note
    await api()
      .post(`/api/v1/reader/notes/${bookId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: "User A's private note", page: 1 });

    // User B gets notes for same book
    const getRes = await api()
      .get(`/api/v1/reader/notes/${bookId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.data.length).toBe(0); // User B sees NONE
  });

  test("User B cannot delete User A's note", async () => {
    const { user: userA, token: tokenA } = await makeUserWithToken(4);
    const { token: tokenB } = await makeUserWithToken(5);
    const book = await createBook({ title: 'Cross Book', author: 'C Auth', pages: 50 });
    const bookId = book._id.toString();

    // User A creates note
    const createRes = await api()
      .post(`/api/v1/reader/notes/${bookId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: "Delete-me note", page: 3 });

    const noteId = createRes.body.data._id;

    // User B tries to delete it
    const deleteRes = await api()
      .delete(`/api/v1/reader/notes/${bookId}/${noteId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(deleteRes.statusCode).toBe(404); // Not found in user B's scope
  });

  test('Book A notes do not appear in Book B note list', async () => {
    const { user, token } = await makeUserWithToken(6);
    const bookA = await createBook({ title: 'Book A', author: 'Author A', pages: 100 });
    const bookB = await createBook({ title: 'Book B', author: 'Author B', pages: 100 });

    await api()
      .post(`/api/v1/reader/notes/${bookA._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Note for Book A', page: 1 });

    const getRes = await api()
      .get(`/api/v1/reader/notes/${bookB._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.data.length).toBe(0); // Book B has no notes
  });
});

// ─── INPUT VALIDATION ─────────────────────────────────────────────────────────
describe('Note input validation', () => {
  test('400 — empty content rejected', async () => {
    const { token } = await makeUserWithToken(7);
    const book = await createBook({ title: 'Val Book', author: 'V A', pages: 50 });

    const res = await api()
      .post(`/api/v1/reader/notes/${book._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '', page: 1 });

    expect(res.statusCode).toBe(400);
  });

  test('400 — whitespace-only content rejected', async () => {
    const { token } = await makeUserWithToken(8);
    const book = await createBook({ title: 'WS Book', author: 'W A', pages: 50 });

    const res = await api()
      .post(`/api/v1/reader/notes/${book._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '   ', page: 1 });

    expect(res.statusCode).toBe(400);
  });

  test('400 — missing content field rejected', async () => {
    const { token } = await makeUserWithToken(9);
    const book = await createBook({ title: 'Miss Book', author: 'M A', pages: 50 });

    const res = await api()
      .post(`/api/v1/reader/notes/${book._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ page: 1 });

    expect(res.statusCode).toBe(400);
  });

  test('404 — delete nonexistent note returns 404', async () => {
    const { token } = await makeUserWithToken(10);
    const book = await createBook({ title: 'NE Book', author: 'NE A', pages: 50 });

    const res = await api()
      .delete(`/api/v1/reader/notes/${book._id}/507f1f77bcf86cd799439011`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(404);
  });
});

// ─── DATA CONTRACT ─────────────────────────────────────────────────────────────
describe('Notes data contract', () => {
  test('created note has expected fields: _id, content, page, createdAt', async () => {
    const { token } = await makeUserWithToken(11);
    const book = await createBook({ title: 'Contract Book', author: 'C A', pages: 50 });

    const res = await api()
      .post(`/api/v1/reader/notes/${book._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Test content', page: 5 });

    expect(res.statusCode).toBe(201);
    const note = res.body.data;
    expect(note._id).toBeTruthy();
    expect(note.content).toBe('Test content');
    expect(note.page).toBe(5);
    expect(note.createdAt).toBeTruthy();
    // Sensitive fields should NOT be returned
    expect(note.user).toBeDefined(); // ObjectId is OK but the actual user data should not be populated
  });
});

/**
 * Backend Integration Tests — Analytics API (Phase 3 regression)
 * Tests real data aggregation — no Math.random(), no synthetic data.
 */

const db = require('./helpers/db');
const { api } = require('./helpers/server');
const { createUser, createBook, createReadingProgress, createReadingSession } = require('./helpers/factories');
const { signAccessToken } = require('../src/utils/tokenUtils');
const { ReadingProgress, ReadingSession } = require('../src/models');

beforeAll(async () => { await db.connect(); });
afterEach(async () => { await db.clear(); });
afterAll(async () => { await db.close(); });

const makeUserWithToken = async (suffix = Date.now()) => {
  const user = await createUser({ email: `analytics${suffix}@test.com` });
  const token = signAccessToken(user._id, 'user');
  return { user, token };
};

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
describe('GET /api/v1/reader/dashboard/stats', () => {
  test('401 — unauthenticated request rejected', async () => {
    const res = await api().get('/api/v1/reader/dashboard/stats');
    expect(res.statusCode).toBe(401);
  });

  test('200 — zero-data user returns zeros', async () => {
    const { token } = await makeUserWithToken(1);

    const res = await api()
      .get('/api/v1/reader/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalBooksRead).toBe(0);
    expect(res.body.data.pagesRead).toBe(0);
    expect(res.body.data.currentlyReadingCount).toBe(0);
    expect(res.body.data.totalReadingMinutes).toBe(0);
    expect(res.body.data.averageRating).toBeNull();
  });

  test('200 — completedBooks metric counts completed status correctly', async () => {
    const { user, token } = await makeUserWithToken(2);
    const book1 = await createBook({ title: 'Completed B', author: 'A', pages: 100 });
    const book2 = await createBook({ title: 'Reading B', author: 'B', pages: 200 });

    // Completed book — use the API so the controller creates the progress correctly
    await ReadingProgress.create({
      user: user._id,
      book: book1._id,
      status: 'completed',
      currentPage: 100,
      percentage: 100,
      externalId: 'ext-completed-1',
      externalSource: 'google',
    });
    // Still reading — different externalId to avoid sparse index collision
    await ReadingProgress.create({
      user: user._id,
      book: book2._id,
      status: 'reading',
      currentPage: 50,
      percentage: 25,
      externalId: 'ext-reading-1',
      externalSource: 'open-library',
    });

    const res = await api()
      .get('/api/v1/reader/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.totalBooksRead).toBe(1);
    expect(res.body.data.currentlyReadingCount).toBe(1);
  });

  test('200 — user scoping: User A stats not visible to User B', async () => {
    const { user: userA } = await makeUserWithToken(3);
    const { token: tokenB } = await makeUserWithToken(4);
    const book = await createBook({ title: 'Scope Book', author: 'S A', pages: 100 });

    // User A has completed a book
    await ReadingProgress.create({
      user: userA._id,
      book: book._id,
      status: 'completed',
      percentage: 100,
      currentPage: 100,
      externalId: 'scope-ext-1',
      externalSource: 'google',
    });

    // User B gets their own stats
    const res = await api()
      .get('/api/v1/reader/dashboard/stats')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.totalBooksRead).toBe(0); // User B has nothing
  });

  test('200 — response includes all required fields', async () => {
    const { token } = await makeUserWithToken(5);

    const res = await api()
      .get('/api/v1/reader/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    const data = res.body.data;
    expect(data).toHaveProperty('totalBooksRead');
    expect(data).toHaveProperty('pagesRead');
    expect(data).toHaveProperty('currentlyReadingCount');
    expect(data).toHaveProperty('booksCompletedThisMonth');
    expect(data).toHaveProperty('totalReadingMinutes');
    expect(data).toHaveProperty('averageRating');
  });
});

// ─── STREAK ────────────────────────────────────────────────────────────────────
describe('GET /api/v1/reader/dashboard/streak', () => {
  test('401 — unauthenticated rejected', async () => {
    const res = await api().get('/api/v1/reader/dashboard/streak');
    expect(res.statusCode).toBe(401);
  });

  test('200 — no activity => current streak 0', async () => {
    const { token } = await makeUserWithToken(6);

    const res = await api()
      .get('/api/v1/reader/dashboard/streak')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.current).toBe(0);
    expect(res.body.data.longest).toBe(0);
    expect(Array.isArray(res.body.data.thisWeek)).toBe(true);
    expect(res.body.data.thisWeek.length).toBe(7);
  });

  test('200 — session today gives current streak 1', async () => {
    const { user, token } = await makeUserWithToken(7);
    const book = await createBook({ title: 'Streak Book', author: 'Str A', pages: 100 });

    // Session today
    await ReadingSession.create({
      user: user._id,
      book: book._id,
      duration: 30,
      date: new Date(), // today
    });

    const res = await api()
      .get('/api/v1/reader/dashboard/streak')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.current).toBe(1);
  });

  test('200 — consecutive days produce correct streak count', async () => {
    const { user, token } = await makeUserWithToken(8);
    const book = await createBook({ title: 'Consec Book', author: 'C A', pages: 100 });

    // Sessions on 3 consecutive days (today, yesterday, 2 days ago)
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    for (let daysAgo = 0; daysAgo < 3; daysAgo++) {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      await ReadingSession.create({ user: user._id, book: book._id, duration: 20, date: d });
    }

    const res = await api()
      .get('/api/v1/reader/dashboard/streak')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.current).toBe(3);
    expect(res.body.data.longest).toBeGreaterThanOrEqual(3);
  });

  test('200 — broken streak resets correctly', async () => {
    const { user, token } = await makeUserWithToken(9);
    const book = await createBook({ title: 'Break Book', author: 'B A', pages: 100 });

    // 2 days ago and today (gap: yesterday)
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    await ReadingSession.create({ user: user._id, book: book._id, duration: 20, date: today });
    await ReadingSession.create({ user: user._id, book: book._id, duration: 20, date: twoDaysAgo });

    const res = await api()
      .get('/api/v1/reader/dashboard/streak')
      .set('Authorization', `Bearer ${token}`);

    // Current streak should be 1 (only today, yesterday was skipped)
    expect(res.statusCode).toBe(200);
    expect(res.body.data.current).toBe(1);
    // Longest ever = 1 (2-day old is isolated)
    expect(res.body.data.longest).toBe(1);
  });
});

// ─── ACTIVITY ─────────────────────────────────────────────────────────────────
describe('GET /api/v1/reader/dashboard/activity', () => {
  test('401 — unauthenticated rejected', async () => {
    const res = await api().get('/api/v1/reader/dashboard/activity');
    expect(res.statusCode).toBe(401);
  });

  test('200 — response shape has monthlyActivity, dailyActivity, hourlyActivity', async () => {
    const { token } = await makeUserWithToken(10);

    const res = await api()
      .get('/api/v1/reader/dashboard/activity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('monthlyActivity');
    expect(res.body.data).toHaveProperty('dailyActivity');
    expect(res.body.data).toHaveProperty('hourlyActivity');
    expect(Array.isArray(res.body.data.monthlyActivity)).toBe(true);
    expect(Array.isArray(res.body.data.dailyActivity)).toBe(true);
    expect(Array.isArray(res.body.data.hourlyActivity)).toBe(true);
  });

  test('200 — monthlyActivity has 12 entries (one per month)', async () => {
    const { token } = await makeUserWithToken(11);

    const res = await api()
      .get('/api/v1/reader/dashboard/activity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.monthlyActivity.length).toBe(12);
  });

  test('200 — hourlyActivity is empty (not fabricated) for user with no sessions', async () => {
    const { token } = await makeUserWithToken(12);

    const res = await api()
      .get('/api/v1/reader/dashboard/activity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    // No sessions = no hourly data (Phase 3 requirement: no synthetic hour generation)
    expect(res.body.data.hourlyActivity.length).toBe(0);
  });

  test('200 — hourlyActivity reflects real session timestamps', async () => {
    const { user, token } = await makeUserWithToken(13);
    const book = await createBook({ title: 'Hourly Book', author: 'H A', pages: 100 });

    const sessionDate = new Date();
    sessionDate.setHours(14, 0, 0, 0); // 2 PM UTC

    await ReadingSession.create({
      user: user._id,
      book: book._id,
      duration: 60,
      date: sessionDate,
    });

    const res = await api()
      .get('/api/v1/reader/dashboard/activity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.hourlyActivity.length).toBeGreaterThan(0);

    const entry = res.body.data.hourlyActivity[0];
    expect(entry).toHaveProperty('day');
    expect(entry).toHaveProperty('hour');
    expect(entry).toHaveProperty('count');
    expect(typeof entry.count).toBe('number');
  });
});

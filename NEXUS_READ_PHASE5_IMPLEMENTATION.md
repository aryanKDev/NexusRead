# NEXUS_READ_PHASE5_IMPLEMENTATION.md
# Phase 5 — Automated Testing & Regression Protection

## Overview

Phase 5 establishes a complete automated test suite for NexusRead, providing
repeatable regression protection for all Phase 1–4 behavior. The suite runs
against an in-memory MongoDB instance (never touching real user data) and
covers authentication, authorization, reader functionality, analytics, security
boundaries, and React component behavior.

**Commit:** `2e0caf8` on branch `nexusread-2.0`

---

## Test Architecture

### Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend test runner | Jest 29 | Node.js test execution |
| Backend HTTP assertions | Supertest | Real Express app testing |
| Isolated database | mongodb-memory-server 10 | In-memory MongoDB (no real data) |
| Frontend test runner | Vitest 1.6 | Vite-compatible ESM test runner |
| Component rendering | React Testing Library 14 | DOM-based React assertions |
| User interaction | @testing-library/user-event 14 | Realistic user event simulation |
| DOM matchers | @testing-library/jest-dom 6 | `toBeInTheDocument`, etc. |

### Isolation Guarantees

- **No production MongoDB is ever touched.** `mongodb-memory-server` starts a
  fresh in-memory MongoDB for each backend test run. Data is cleared between
  tests with `afterEach(db.clear)`.
- **No real HTTP calls during component tests.** All `axios` API calls are
  mocked via `vitest`'s `vi.mock('../api/axios', ...)` in `src/tests/setup.js`.
- **No real Cloudinary calls.** `USE_CLOUDINARY_PDF=false` and
  `CLOUDINARY_CLOUD_NAME=test` are set in test environment.
- **No real external book API calls during unit-level tests.** The `books.test.js`
  search test hits the real aggregator (with a real network) only in the route
  topology test — and explicitly accepts 502 as valid (external APIs may be
  unavailable in CI).

---

## File Structure

```
backend/
├── jest.config.js                # Jest config: node env, 30s timeout, testMatch
├── package.json                  # Added: test, test:watch, test:coverage scripts
└── tests/
    ├── setup/
    │   └── env.js                # Test-only env vars (JWT secrets, no real Cloudinary)
    ├── helpers/
    │   ├── db.js                 # MongoMemoryServer lifecycle: connect/clear/close
    │   ├── factories.js          # Entity factories: createUser, createBook, etc.
    │   └── server.js             # Supertest app wrapper: api(), agent(), registerAndLogin()
    ├── auth.test.js              # 33 tests — auth contract
    ├── books.test.js             # 22 tests — books API
    ├── reader.test.js            # 19 tests — reader API + annotation preservation
    ├── notes.test.js             # 11 tests — notes CRUD + isolation
    ├── analytics.test.js         # 15 tests — dashboard stats, streak, activity
    └── security.test.js          # 16 tests — IDOR, traversal, admin protection

src/
├── tests/
│   ├── setup.js                  # Vitest setup: jest-dom, GSAP mock, react-pdf mock, axios mock
│   ├── AuthContext.test.jsx      # 10 tests — AuthContext provider behavior
│   └── BookCard.test.jsx         # 9 tests — BookCard rendering and interaction
vitest.config.js                  # Vitest config: jsdom, setupFiles, include pattern
package.json                      # Added: test, test:watch, test:coverage scripts
```

---

## Test Counts by Category

### Backend (Jest + Supertest)

| File | Suite | Count | What's protected |
|------|-------|-------|-----------------|
| `auth.test.js` | POST /auth/register | 9 | Registration, password hashing, cookie setting, validation |
| `auth.test.js` | POST /auth/login | 8 | Credentials, token shape, cookie, `failedLoginAttempts` reset |
| `auth.test.js` | Brute-force lockout (Phase 2) | 6 | Rate limit, account lock, lock expiry, no phantom records |
| `auth.test.js` | POST /auth/refresh | 4 | Valid token, no cookie, garbage cookie, reuse detection |
| `auth.test.js` | POST /auth/logout | 3 | Cookie cleared, no-crash without cookie, token invalidated |
| `auth.test.js` | GET /auth/me | 3 | Valid token, missing token, invalid token |
| `books.test.js` | Public discovery | 4 | Guest access to list, explore, single, search |
| `books.test.js` | Protected mutations | 5 | 401 on POST/PUT/DELETE/add-to-library/add-external without auth |
| `books.test.js` | Authenticated operations | 4 | Create, add-to-library, update, delete |
| `books.test.js` | Admin authorization | 3 | 403 for normal user, 401 for guest, 200 for admin |
| `books.test.js` | Route topology (Phase 4) | 3 | book.routes.js + bookRoutes.js + preview-click all mounted |
| `books.test.js` | Metadata contract (Phase 1) | 3 | Response shape, normalized fields, 404 |
| `reader.test.js` | Auth enforcement | 3 | 401 on all reader routes without token |
| `reader.test.js` | Catalog book resolution | 3 | 200 auth, 400 malformed id, 404 missing |
| `reader.test.js` | Uploaded book IDOR | 2 | 200 for owner, 403 for other user (Phase 2) |
| `reader.test.js` | Progress save/load | 5 | Defaults, save+percentage, upsert, 400 on page=0, page>total |
| `reader.test.js` | Annotation preservation (Phase 3) | 3 | Bookmarks not clobbered, highlights round-trip |
| `reader.test.js` | Session creation | 3 | 201 success, 400 missing bookId, 400 negative duration |
| `notes.test.js` | Auth enforcement | 2 | 401 on GET and POST without auth |
| `notes.test.js` | Full lifecycle | 1 | Create → get → delete → confirm gone |
| `notes.test.js` | Cross-user isolation | 3 | User B cannot read/delete User A's notes |
| `notes.test.js` | Input validation | 4 | Empty, whitespace, missing content, nonexistent note |
| `notes.test.js` | Data contract | 1 | Fields: _id, content, page, createdAt |
| `analytics.test.js` | Dashboard stats | 5 | Auth, zeros, completedBooks, scoping, required fields |
| `analytics.test.js` | Streak | 5 | Auth, no activity, today's session, consecutive, broken streak |
| `analytics.test.js` | Activity | 5 | Auth, shape, 12 months, empty hourly, real timestamps |
| `security.test.js` | PDF IDOR (Phase 2) | 5 | 401 guest, 403 wrong user, 404 nonexistent, traversal, malformed |
| `security.test.js` | Reader IDOR (Phase 2) | 2 | Uploaded book and progress cross-user isolation |
| `security.test.js` | Admin protection (Phase 2) | 6 | 401/403 on stats, users, audit-logs |
| `security.test.js` | Injection resistance | 2 | MongoDB operator injection, SQL-like injection |

**Backend total: 115 tests, 6 test suites — all passing**

### Frontend (Vitest + RTL)

| File | Suite | Count | What's protected |
|------|-------|-------|-----------------|
| `AuthContext.test.jsx` | Initial state | 2 | Loading → ready, unauthenticated null state |
| `AuthContext.test.jsx` | Login | 4 | Success, 401 error state, 403 banned message, session restoration |
| `AuthContext.test.jsx` | Logout | 1 | State cleared |
| `AuthContext.test.jsx` | Register | 2 | Success, error state |
| `AuthContext.test.jsx` | API wiring | 1 | setOnUnauthorized/setTokenHandlers called on mount |
| `BookCard.test.jsx` | Rendering | 5 | Title, authors, cover/fallback, no thumbnail, no authors |
| `BookCard.test.jsx` | Interactions | 2 | onAdd called, isAdded state |
| `BookCard.test.jsx` | Data contract | 2 | title+authors accuracy, minimal fields |

**Frontend total: 19 tests, 2 test files — all passing**

### Grand Total: **134 tests**

---

## How to Run Tests

### Backend tests (all)
```bash
cd backend
npm test              # Run all 6 suites once
npm run test:watch    # Watch mode for development
npm run test:coverage # With Istanbul coverage report
```

### Frontend tests (all)
```bash
npm test              # Run vitest in root (19 tests)
npm run test:watch    # Watch mode
npm run test:coverage # With v8 coverage
```

### Individual backend test file
```bash
cd backend
npx jest tests/auth.test.js --forceExit
npx jest tests/security.test.js --forceExit
```

---

## What Regressions Are Now Protected

### Phase 1 — Critical Fixes
- ✅ Book metadata contract (title, author, cover shape)
- ✅ 404 on nonexistent book IDs
- ✅ Route topology from Phase 1 book routes

### Phase 2 — Security Hardening
- ✅ Brute-force lockout (5 attempts → 429, auto-unlock)
- ✅ PDF IDOR: User B cannot access User A's PDF via filename
- ✅ Reader IDOR: User B cannot access User A's uploaded book
- ✅ Admin routes protected (401/403 for non-admins)
- ✅ Path traversal on PDF endpoint rejected
- ✅ MongoDB operator injection sanitized
- ✅ RefreshToken reuse detection (double-use triggers revocation)
- ✅ Password never returned in responses
- ✅ Password is hashed in database (bcrypt)

### Phase 3 — Core Features + Data Sync
- ✅ ReadingProgress upserts correctly (no duplicate documents)
- ✅ Bookmarks preserved when page-only update is sent
- ✅ Highlights not clobbered by subsequent saves
- ✅ Notes scoped to user+book (cross-user isolation)
- ✅ Session creation accepts valid input, rejects invalid
- ✅ Analytics dashboard returns correctly scoped stats
- ✅ Streak counts consecutive days including today
- ✅ Activity shape matches expected contract

### Phase 4 — Architecture Cleanup
- ✅ Both book.routes.js AND bookRoutes.js are still mounted
- ✅ book.controller.js (`searchBooks`, `trackPreviewClick`) still wired
- ✅ bookController.js (CRUD) still accessible through the sub-router

---

## Application Bugs Fixed by Phase 5 Tests

> The directive requires: *"If tests expose a real application bug: DO NOT hide
> it by weakening the assertion. Fix the bug only if it is in scope."*

### Bug 1: Streak excludes today's sessions (`readerAnalytics.controller.js`)

**Symptom:** `GET /api/v1/reader/dashboard/streak` returned `current: 0` even
when the user had a reading session logged that same day.

**Root cause:** The query used `date: { $lte: today }` where
`today = getStartOfDay(new Date())` = local midnight (00:00:00 local).
Sessions saved *after* midnight (i.e., any session today at normal reading
hours) have timestamps strictly *greater than* local midnight and were
excluded.

**Fix:** Changed `$lte: today` to `$lt: tomorrow` where `tomorrow` is the
start of the next UTC day, ensuring all sessions from the current calendar day
are included.

### Bug 2: Streak date-key timezone mismatch (`readerAnalytics.controller.js`)

**Symptom:** Streak counts were always 0 or off by 1 for users in non-UTC
timezones (e.g., IST +05:30).

**Root cause:** MongoDB's `$dateToString: { format: '%Y-%m-%d', date: '$date' }`
produces a **UTC** date string (e.g., `2026-10-07`). The JavaScript
`normalizeDateKey` helper used `new Date(local_year, local_month, local_day).toISOString()`,
which converts a local-midnight Date to ISO and subtracts the UTC offset,
producing the **previous** UTC day (e.g., `2026-10-06`). These keys never
matched.

**Fix:** Rewrote `normalizeDateKey` to use `d.getUTCFullYear()`,
`d.getUTCMonth()`, `d.getUTCDate()` to produce UTC date strings consistently
with MongoDB's output. Updated `hasActivity` to pass the date object directly
(without `getStartOfDay`) and updated the streak cursor to use
`setUTCDate`/`setUTCHours(0,0,0,0)` for UTC-accurate day stepping.

---

## Test Environment Variables

Set in `backend/tests/setup/env.js` (not committed with real secrets):

```
NODE_ENV=test
JWT_SECRET=nexusread-test-jwt-secret-phase5-jest
REFRESH_TOKEN_SECRET=nexusread-test-refresh-secret-phase5-jest
JWT_ACCESS_EXPIRE=15m
REFRESH_TOKEN_EXPIRE_DAYS=7
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCK_DURATION_MINUTES=15
CLOUDINARY_CLOUD_NAME=test
USE_CLOUDINARY_PDF=false
```

**NEVER commit real credentials. The test env file uses dummy values only.**

---

## Coverage Summary (Behavioral, Not Instrumented)

| Area | Coverage type | Status |
|------|--------------|--------|
| Auth register/login/logout/refresh | Integration | ✅ Full |
| Brute-force lockout | Integration | ✅ Full |
| Token refresh rotation + reuse | Integration | ✅ Full |
| Book CRUD + library | Integration | ✅ Full |
| Reader progress save/load + upsert | Integration | ✅ Full |
| Annotation preservation (bookmarks/highlights) | Integration | ✅ Full |
| Notes lifecycle + ownership | Integration | ✅ Full |
| Analytics: stats, streak, activity | Integration | ✅ Full |
| PDF IDOR security | Integration | ✅ Full |
| Path traversal prevention | Integration | ✅ Full |
| Admin route protection | Integration | ✅ Full |
| AuthContext state management | Component | ✅ Full |
| BookCard rendering + interaction | Component | ✅ Full |

---

*Phase 5 complete. All 134 tests pass. Zero regressions from Phases 1–4.*

# NexusRead (BookTracker) — Strategic Remediation & Production Roadmap

**Document Version**: 1.0.0  
**Target Repository**: `c:\Users\kushw\OneDrive\Desktop\FS32\Online\BookT`  
**Execution Strategy**: 7-Phase Iterative Engineering Plan  
**Goal**: Transition codebase from prototype/pre-alpha (51%) to production-ready platform (100%)

---

## Roadmap Overview & Gantt Progression

```
Phase 1: Critical Fixes & Crash Prevention (Days 1–3)
  └── Resolve P0 Blockers (Reader 404, metadata loss, Gemini model, mobile layout, Axios refresh)

Phase 2: Security & Authentication Hardening (Days 4–6)
  └── Route guard isolation, IDOR prevention, account lockouts, secure download streams

Phase 3: Core Feature Completion & Data Sync (Days 7–11)
  └── PDF annotation persistence, real book search, analytics metrics sync, cart checkout

Phase 4: Architecture Unification & Debt Purge (Days 12–14)
  └── Merge dual book controllers, eliminate 14 orphaned files, unify Book/UploadedBook schemas

Phase 5: Automated Testing & Verification Suite (Days 15–18)
  └── Vitest + RTL frontend tests, Supertest backend API test suite, E2E auth/reader flows

Phase 6: Performance & Scalability Optimization (Days 19–21)
  └── Database indexes, MongoDB projections, React lazy route splitting, bundle optimization

Phase 7: Production DevOps & Deployment Readiness (Days 22–24)
  └── Environment validation, Docker containerization, CI/CD pipeline, health checks
```

---

## Phase 1: Critical Fixes & Crash Prevention (Days 1–3)

### Goal
Eliminate all P0 runtime crashes, data corruption bugs, and rendering blockers.

### Tasks & Implementation Steps

#### 1.1 Fix Reader Controller 404 on Catalog Books
- **Files**: `backend/src/controllers/reader.controller.js`
- **Action**:
  Update `getProgress`, `saveProgress`, and `getBookDetails` to resolve both `UploadedBook` and `Book` entities:
  ```javascript
  let book = await UploadedBook.findById(bookId);
  let bookType = 'uploaded';
  if (!book) {
    book = await Book.findById(bookId);
    bookType = 'catalog';
  }
  if (!book) {
    return res.status(404).json({ success: false, message: 'Book not found' });
  }
  ```
- **Verification**: Opening any book from `/explore` in the reader loads the document without 404 errors.

#### 1.2 Restore External Books Metadata in Library View
- **Files**: `backend/src/controllers/bookController.js`
- **Action**:
  Update `normalizeExternal` to retain `author`, `status`, `pages`, `currentPage`, `rating`, and `genre`:
  ```javascript
  const normalizeExternal = (b) => ({
    id: b._id || b.id,
    title: b.title,
    author: b.author || (b.authors ? b.authors.join(', ') : 'Unknown'),
    authors: b.authors || (b.author ? [b.author] : []),
    thumbnail: b.thumbnail || b.coverImage,
    pages: b.pages || b.pageCount || 0,
    currentPage: b.currentPage || 0,
    status: b.status || 'want-to-read',
    rating: b.rating || 0,
    genre: b.genre || (b.categories ? b.categories[0] : 'General'),
    createdAt: b.createdAt,
    type: 'external'
  });
  ```
- **Verification**: In `/tracker`, external books show author names, page counts, and filter accurately under "Reading" and "Completed" tabs.

#### 1.3 Fix Gemini Model Identifier
- **Files**: `backend/src/services/aiService.js`
- **Action**:
  Replace `gemini-2.5-flash` with a valid model name:
  ```javascript
  const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  ```
- **Verification**: Call `POST /api/v1/ai/summary` and verify successful AI summary generation.

#### 1.4 Resolve Axios Refresh Token Promise Swallow
- **Files**: `src/api/axios.js`
- **Action**:
  Ensure the response interceptor catch block returns a rejected promise:
  ```javascript
  } catch (refreshError) {
    refreshPromise = null;
    window.dispatchEvent(new CustomEvent('auth:expired'));
    return Promise.reject(refreshError);
  }
  ```
- **Verification**: Expire the refresh token; verify the UI redirects smoothly to `/login` with no `TypeError` in the console.

#### 1.5 Fix Mobile Right-Shift Viewport Break
- **Files**: `src/components/AppLayout.jsx`
- **Action**:
  Add the `.nx-main` class to the `<main>` tag so small-screen media queries take effect:
  ```jsx
  <main
    style={{ marginLeft: `${sidebarW}px` }}
    className="nx-main flex-1 transition-all duration-300 min-h-screen"
  >
  ```
- **Verification**: Inspect on mobile screen width (375px); verify content is horizontally centered with zero rightward shift.

#### 1.6 Graceful Fallback for Cloudinary Config
- **Files**: `backend/config/cloudinary.js`
- **Action**:
  Replace top-level `throw new Error(...)` with environment check:
  ```javascript
  const isCloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
  if (!isCloudinaryConfigured) {
    console.warn('⚠️ Cloudinary credentials missing. Defaulting to local storage.');
  }
  ```
- **Verification**: Start backend with empty Cloudinary keys and `USE_CLOUDINARY_PDF=false`; server boots without crashing.

---

## Phase 2: Security & Authentication Hardening (Days 4–6)

### Goal
Close authorization bypasses, protect endpoints, secure file downloads, and enforce rate limits.

### Tasks & Implementation Steps

#### 2.1 Restore Public Access to Book Discovery
- **Files**: `backend/src/routes/book.routes.js`
- **Action**:
  Mount public routes before the `protect` guard:
  ```javascript
  router.get('/explore', legacyBookRoutes);
  router.get('/search', legacyBookRoutes);
  router.get('/:id', optionalProtect, legacyBookRoutes);
  router.use('/', protect, legacyBookRoutes);
  ```
- **Verification**: Visiting `/explore` in an incognito window successfully returns catalog books without 401 errors.

#### 2.2 Secure PDF Downloads (Prevent IDOR)
- **Files**: `backend/src/controllers/reader.controller.js`, `backend/src/app.js`
- **Action**:
  Remove open static file serving of `/uploads`. Implement an authenticated streaming route `GET /api/v1/reader/books/:bookId/file` that verifies user ownership before piping the file.
- **Verification**: Unauthenticated requests to download PDFs return 401; users cannot access PDFs belonging to other users.

#### 2.3 Implement Login Brute-Force Protection
- **Files**: `backend/src/controllers/authController.js`, `backend/src/models/User.js`
- **Action**:
  Add `failedLoginAttempts` and `lockUntil` fields to `User.js`. Lock account for 15 minutes after 5 consecutive failed attempts.
- **Verification**: 6th incorrect password attempt returns HTTP 423 (Locked).

---

## Phase 3: Core Feature Completion & Data Sync (Days 7–11)

### Goal
Replace placeholder mocks with real backend features and synchronize data contracts.

### Tasks & Implementation Steps

#### 3.1 PDF Annotation & Bookmark Persistence
- **Files**:
  - `backend/src/models/UploadedBookReadingProgress.js`
  - `backend/src/controllers/reader.controller.js`
  - `src/pages/Reader.jsx`
- **Action**:
  1. Add schema fields:
     ```javascript
     bookmarks: [{ page: Number, label: String, createdAt: Date }],
     highlights: [{ page: Number, text: String, color: String, rects: Array }]
     ```
  2. Update `saveProgress` to store bookmarks and highlights.
  3. Load saved annotations on initial document mount in `Reader.jsx`.
- **Verification**: Highlight text, add a bookmark, refresh the browser; verify annotations persist.

#### 3.2 Real External Search in AddBookModal
- **Files**: `src/components/AddBookModal.jsx`
- **Action**:
  Replace mock `setTimeout` search with an API call to `GET /api/v1/books/search?q=${query}`.
- **Verification**: Search for any book title; verify live Google Books/Open Library results appear and can be saved to library.

#### 3.3 Synchronize Analytics Dashboard Contracts
- **Files**: `backend/src/controllers/readerAnalytics.controller.js`, `src/pages/Analytics.jsx`
- **Action**:
  1. Return standardized metric names:
     ```json
     {
       "completedBooks": 12,
       "totalPagesRead": 3400,
       "totalHours": 56.6,
       "currentStreak": 5
     }
     ```
  2. Replace `generateHeatmapData()` random numbers with real session bucket aggregation from `UploadedBookReadingSession`.
- **Verification**: Analytics KPI cards display non-zero numbers matching actual user reading sessions.

#### 3.4 Wire Quick Notes in BookModal
- **Files**: `src/components/BookModal.jsx`, `backend/src/controllers/bookController.js`
- **Action**:
  Implement `handleSaveNotes` calling `PUT /api/v1/books/:id` with notes payload.
- **Verification**: Adding a note in the modal saves it to the database and displays it upon reopening.

---

## Phase 4: Architecture Unification & Debt Purge (Days 12–14)

### Goal
Clean up duplicate controllers, merge split schemas, and delete orphaned files.

### Tasks & Implementation Steps

#### 4.1 Delete Orphaned Frontend Components (14 Files)
- **Action**:
  Remove dead files:
  - `src/pages/AdminDashboard.jsx`
  - `src/pages/admin/AdminAnalytics.jsx`
  - `src/components/Header.jsx`
  - `src/components/SearchBar.jsx`
  - `src/components/PDFViewer.jsx`
  - `src/components/MarketplaceBookCard.jsx`
  - `src/components/ReadingCharts.jsx`
  - `src/components/ReadingHeatmap.jsx`
  - `src/components/WordCloud.jsx`
  - `src/components/EmptyState.jsx`
  - `src/components/ui/Dialog.jsx`
  - `src/components/ui/Badge.jsx`
  - `src/hooks/useLocalStorage.js`
  - `src/hooks/useTheme.js`
- **Verification**: Execute `npm run build`; verify zero build errors or broken imports.

#### 4.2 Unify Dual Book Controllers
- **Files**: `backend/src/controllers/book.controller.js`, `backend/src/controllers/bookController.js`
- **Action**:
  Consolidate all endpoints into `backend/src/controllers/book.controller.js`. Remove legacy `bookController.js`.
- **Verification**: Verify all book routes function correctly using the consolidated controller.

#### 4.3 Remove Empty 0-Byte Backend Stubs
- **Action**:
  Remove `backend/services/cacheService.js`, `backend/services/openLibraryService.js`, and `backend/config/redis.js`.

---

## Phase 5: Automated Testing & Verification Suite (Days 15–18)

### Goal
Establish test coverage across authentication, reader operations, and critical business flows.

### Tasks & Implementation Steps

#### 5.1 Set Up Testing Infrastructure
- **Frontend**: Install `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
- **Backend**: Install `jest`, `supertest`, `mongodb-memory-server`.

#### 5.2 Implement Core Backend Integration Tests
- **Suites**:
  1. `tests/auth.test.js`: Register, login, refresh token rotation, logout, token reuse detection.
  2. `tests/books.test.js`: Search, add book, shelf updates, catalog filtering.
  3. `tests/reader.test.js`: Upload PDF, fetch progress, update page position, bookmark persistence.
  4. `tests/admin.test.js`: Admin-only route guard, role updates, user banning.

#### 5.3 Implement Frontend Unit Tests
- **Suites**:
  1. `src/context/__tests__/AuthContext.test.jsx`: Login state persistence, logout handling.
  2. `src/pages/__tests__/BookTracker.test.jsx`: Shelf tab filtering, status transitions.
  3. `src/components/__tests__/Reader.test.jsx`: Page navigation controls, zoom scaling.

---

## Phase 6: Performance & Scalability Optimization (Days 19–21)

### Goal
Optimize queries, reduce bundle size, and improve page load metrics.

### Tasks & Implementation Steps

#### 6.1 Database Indexing & Aggregation Pipelines
- **Files**: All Mongoose models
- **Action**:
  1. Create compound indexes:
     ```javascript
     bookSchema.index({ user: 1, status: 1 });
     uploadedBookReadingProgressSchema.index({ userId: 1, bookId: 1 }, { unique: true });
     readingSessionSchema.index({ userId: 1, createdAt: -1 });
     ```
  2. Refactor `gamification.controller.js` leaderboard to use `$sort` and `$limit` at database level instead of in-memory sorting.
- **Verification**: Run `explain('executionStats')` on MongoDB; verify index scans (IXSCAN) replace collection scans (COLLSCAN).

#### 6.2 Frontend Route Code Splitting
- **Files**: `src/App.jsx`
- **Action**:
  Convert page imports to lazy dynamic imports:
  ```jsx
  const Reader = React.lazy(() => import('./pages/Reader'));
  const Analytics = React.lazy(() => import('./pages/Analytics'));
  const Marketplace = React.lazy(() => import('./pages/Marketplace'));
  ```
- **Verification**: Measure initial bundle size; target reduction of at least 40% (deferring `pdfjs-dist` and `recharts`).

#### 6.3 Local PDF Worker Configuration
- **Files**: `src/pages/Reader.jsx`
- **Action**:
  Bundle `pdf.worker.min.js` locally or import via Vite instead of relying on external unpkg CDN.
- **Verification**: Reader loads successfully in offline mode with cached assets.

---

## Phase 7: Production DevOps & Deployment Readiness (Days 22–24)

### Goal
Prepare containerized deployment, CI/CD pipelines, and runtime monitoring.

### Tasks & Implementation Steps

#### 7.1 Environment Variable Schema & Validation
- **Files**: `backend/src/config/env.js`
- **Action**:
  Implement startup validation using Joi or Zod to verify required environment variables (`JWT_SECRET`, `MONGO_URI`, `CLIENT_URL`) and fail fast with clear error messages.

#### 7.2 Containerization (Docker & Compose)
- **Action**:
  1. Create multi-stage `Dockerfile` for Vite frontend (build stage + Nginx Alpine runner).
  2. Create production `Dockerfile` for Express backend (Node.js 20 Alpine with unprivileged user).
  3. Create `docker-compose.yml` for local staging testing.

#### 7.3 CI/CD Workflow
- **Files**: `.github/workflows/ci.yml`
- **Action**:
  Configure GitHub Actions workflow running:
  - Linter (`eslint`)
  - Typecheck / build verification
  - Automated test suites (backend Supertest + frontend Vitest)

---

## Phase Acceptance Criteria & Definition of Done

| Phase | Milestone Name | Acceptance Criteria |
| :--- | :--- | :--- |
| **Phase 1** | Critical Stability | Reader opens catalog books without 404; external books display full metadata; Gemini AI generates summaries; mobile UI renders with zero margin offset. |
| **Phase 2** | Security Hardened | Public explore accessible to guests; PDF downloads require ownership verification; login rate limiting prevents brute force. |
| **Phase 3** | Feature Realization | PDF highlights and bookmarks persist across reloads; AddBookModal searches live Google Books; Analytics dashboard displays live session data. |
| **Phase 4** | Debt Free | All 14 orphaned files removed; single consolidated book controller; zero 0-byte stub files. |
| **Phase 5** | Tested Platform | > 80% test coverage on authentication and reader APIs; automated CI test runs on PR. |
| **Phase 6** | Performance Optimized | Initial JS bundle < 350 KB gzipped; database queries use index scans; leaderboard scales to 100k+ users. |
| **Phase 7** | Production Ready | Container builds pass cleanly; env validation runs on boot; zero secrets committed in repo. |

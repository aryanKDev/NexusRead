# NexusRead (BookTracker) — Comprehensive Issues & Vulnerability Register

**Document Version**: 1.0.0  
**Status**: ACTIVE AUDIT FINDINGS  
**Classification**: CONFIRMED & VERIFIED DEFECTS ONLY  
**Target Repository**: `c:\Users\kushw\OneDrive\Desktop\FS32\Online\BookT`

---

## Issue Severity Hierarchy

- **P0 (BLOCKER)**: Critical bugs, data loss, API crashes, or rendering blockers that prevent primary user workflows.
- **P1 (HIGH)**: Major functional defects, authentication/authorization flaws, significant UX breakdowns, or unhandled promise crashes.
- **P2 (MEDIUM)**: Secondary feature gaps, unindexed database queries, missing persistence for secondary entities, or performance degradations.
- **P3 (LOW)**: Code debt, dead components, minor styling inconsistencies, or missing documentation.

---

## Priority 0 (P0) — Critical Blockers & Catastrophic Defects

### [P0-BUG-01] Reader API 404 Failure on Catalog Books
- **Classification**: Confirmed Bug / Architectural Split
- **Affected Files**:
  - `backend/src/controllers/reader.controller.js` (Lines 140–155, 175–190)
  - `src/pages/Reader.jsx` (Lines 110–135)
- **Problem Description**:
  The in-browser Reader component navigates using `/reader/:bookId`. When fetching or saving reading progress (`GET /api/v1/reader/progress/:bookId` and `POST /api/v1/reader/progress/:bookId`), `reader.controller.js` explicitly executes:
  ```javascript
  const book = await UploadedBook.findById(bookId);
  if (!book) {
    return res.status(404).json({ success: false, message: 'Book not found' });
  }
  ```
  If the user is reading a catalog book (stored in the `Book` collection) that has a digital `pdfUrl`, the controller cannot find the document in `UploadedBook` and returns a 404 status.
- **System Impact**:
  Users can only read user-uploaded PDFs. Clicking "Read Now" on any book added from the catalog or explore page completely breaks reading progress tracking with an unhandled 404 error.
- **Remediation**:
  1. Implement a unified book resolution helper:
     ```javascript
     const book = (await UploadedBook.findById(bookId)) || (await Book.findById(bookId));
     ```
  2. Unify reading progress models or create a polymorphic association capable of tracking progress against either `Book` or `UploadedBook` IDs.

---

### [P0-BUG-02] External Books Strip Essential Metadata in Library View
- **Classification**: Confirmed Bug / Data Normalization Regression
- **Affected Files**:
  - `backend/src/controllers/bookController.js` (Lines 35–48)
  - `src/pages/BookTracker.jsx` (Lines 60–95)
  - `src/components/LibraryBookCard.jsx` (Lines 15–40)
- **Problem Description**:
  In `bookController.js` (`getAllBooks`), external books retrieved from the user's shelf are passed through `normalizeExternal`:
  ```javascript
  const normalizeExternal = (b) => ({
    id: b._id || b.id,
    title: b.title,
    authors: b.authors || (b.author ? [b.author] : []),
    thumbnail: b.thumbnail || b.coverImage,
    createdAt: b.createdAt,
    type: 'external'
  });
  ```
  This function drops `author` (singular), `pages`, `currentPage`, `status`, `rating`, `genre`, and `categories`.
- **System Impact**:
  When external books load into `BookTracker.jsx`:
  1. `book.status` is undefined. Filtering by "Reading", "Completed", or "Want to Read" excludes them from the UI.
  2. Author fields appear blank or render as `[object Object]` if components expect a string.
  3. Reading progress bars display as 0% because `currentPage` and `pages` are missing.
- **Remediation**:
  Update `normalizeExternal` to preserve full tracking metadata:
  ```javascript
  const normalizeExternal = (b) => ({
    id: b._id || b.id,
    title: b.title,
    author: b.author || (b.authors ? b.authors.join(', ') : 'Unknown Author'),
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

---

### [P0-BUG-03] Non-Existent Gemini AI Model Identifier
- **Classification**: Confirmed Bug / External Integration Crash
- **Affected Files**:
  - `backend/src/services/aiService.js` (Line 8)
  - `backend/src/controllers/ai.controller.js` (Lines 20–45)
- **Problem Description**:
  The AI service initializes the Google Gemini Generative AI SDK with an invalid model identifier:
  ```javascript
  const MODEL_NAME = 'gemini-2.5-flash';
  ```
  Google Gemini does not offer a model named `gemini-2.5-flash`.
- **System Impact**:
  Every call to `/api/v1/ai/summary` or `/api/v1/ai/chat` fails immediately with an HTTP 404/500 error from the Google API: `[GoogleGenerativeAI Error]: Model not found`. All AI-driven features (book summaries, key themes, discussion questions) crash completely.
- **Remediation**:
  Change the model identifier to a valid, supported Gemini model:
  ```javascript
  const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  ```

---

### [P0-SEC-01] Fatal Startup Crash on Missing Cloudinary Configuration
- **Classification**: System Crash / Configuration Defect
- **Affected Files**:
  - `backend/config/cloudinary.js` (Lines 4–12)
  - `backend/server.js` (Line 15)
- **Problem Description**:
  `backend/config/cloudinary.js` throws an unhandled top-level exception on startup if Cloudinary credentials are not present in `.env`:
  ```javascript
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary environment variables are missing');
  }
  ```
- **System Impact**:
  Even when a developer intends to run local file storage (`USE_CLOUDINARY_PDF=false`), the backend process crashes immediately on launch and cannot start.
- **Remediation**:
  Allow graceful fallback:
  ```javascript
  const isCloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
  if (!isCloudinaryConfigured) {
    console.warn('⚠️ Cloudinary not configured. Defaulting to local disk storage.');
  }
  ```

---

## Priority 1 (P1) — High Priority Bugs & Vulnerabilities

### [P1-BUG-01] Unhandled Axios Response Interceptor Promise Swallow
- **Classification**: Confirmed Bug / Async Flow Corruption
- **Affected Files**:
  - `src/api/axios.js` (Lines 55–65)
- **Problem Description**:
  When a 401 response triggers the silent refresh token flow, the catch block swallows the error without returning a rejected promise:
  ```javascript
  } catch (refreshError) {
    refreshPromise = null;
    // Missing return Promise.reject(refreshError);
  }
  ```
- **System Impact**:
  When the refresh token expires or is rejected, original API requests resolve with `undefined` instead of rejecting with an error. Calling components execute `.then(res => res.data)` and throw unhandled runtime exceptions: `TypeError: Cannot read properties of undefined (reading 'data')`. Users are left on frozen, broken pages instead of being redirected to `/login`.
- **Remediation**:
  Explicitly reject the promise and broadcast an auth expiration event:
  ```javascript
  } catch (refreshError) {
    refreshPromise = null;
    window.dispatchEvent(new Event('auth:expired'));
    return Promise.reject(refreshError);
  }
  ```

---

### [P1-UI-01] Mobile Viewport Right-Shift Layout Break
- **Classification**: Confirmed Bug / Responsive Design Defect
- **Affected Files**:
  - `src/components/AppLayout.jsx` (Lines 19–26)
  - `src/index.css` (Lines 45–55)
- **Problem Description**:
  In `AppLayout.jsx`, the `<main>` tag receives an inline style `style={{ marginLeft: `${sidebarW}px` }}`. The CSS media query designed to override this on small screens references `.nx-main`:
  ```css
  @media (max-width: 768px) {
    .nx-main { margin-left: 0 !important; }
  }
  ```
  However, the `<main>` element does not have the `nx-main` class applied.
- **System Impact**:
  On all mobile devices (< 768px wide), the entire page content is shifted 240 pixels off the right edge of the screen, creating broken layouts and horizontal scrolling.
- **Remediation**:
  Add the missing CSS class to `<main>` in `AppLayout.jsx`:
  ```jsx
  <main
    style={{ marginLeft: `${sidebarW}px` }}
    className="nx-main flex-1 transition-all duration-300 min-h-screen"
  >
  ```

---

### [P1-BUG-02] Analytics Dashboard KPI Property Mismatch
- **Classification**: Confirmed Bug / Data Contract Drift
- **Affected Files**:
  - `src/pages/Analytics.jsx` (Lines 145–175)
  - `backend/src/controllers/readerAnalytics.controller.js` (Lines 30–55)
- **Problem Description**:
  `readerAnalytics.controller.js` returns:
  ```json
  {
    "totalBooksRead": 8,
    "pagesRead": 2450,
    "totalMinutes": 320
  }
  ```
  `Analytics.jsx` expects:
  ```javascript
  stats?.completedBooks
  stats?.totalPagesRead
  stats?.currentStreak
  ```
- **System Impact**:
  Three out of four KPI metric cards on the Analytics dashboard display `0` or `0d`, regardless of how many books or pages the user has read.
- **Remediation**:
  Normalize controller output or update `Analytics.jsx` to support both property names:
  ```javascript
  const completedBooks = stats?.completedBooks ?? stats?.totalBooksRead ?? 0;
  const totalPages = stats?.totalPagesRead ?? stats?.pagesRead ?? 0;
  ```

---

### [P1-SEC-02] Global Route Guard Overrides Public Book Discovery
- **Classification**: Security Architecture / Route Configuration Defect
- **Affected Files**:
  - `backend/src/routes/book.routes.js` (Line 34)
  - `backend/routes/bookRoutes.js` (Lines 15–25)
- **Problem Description**:
  In `backend/src/routes/book.routes.js`:
  ```javascript
  router.use('/', protect, legacyBookRoutes);
  ```
  Wrapping the entire legacy router with `protect` forces authentication on `/api/v1/books/explore` and `/api/v1/books/search`, completely overriding the intended `optionalProtect` behavior.
- **System Impact**:
  Unauthenticated guest visitors browsing the landing or explore pages receive 401 Unauthorized errors instead of seeing public book listings.
- **Remediation**:
  Mount public routes before applying the `protect` middleware guard:
  ```javascript
  router.get('/explore', legacyBookRoutes);
  router.get('/search', legacyBookRoutes);
  router.use('/', protect, legacyBookRoutes);
  ```

---

## Priority 2 (P2) — Functional Gaps & Performance Risks

### [P2-DATA-01] Missing PDF Annotation & Highlight Persistence
- **Classification**: Missing Functionality / Data Loss
- **Affected Files**:
  - `src/pages/Reader.jsx` (Lines 320–380)
  - `backend/src/controllers/reader.controller.js` (Lines 160–210)
  - `backend/src/models/UploadedBookReadingProgress.js`
- **Problem Description**:
  The UI allows users to highlight text and create bookmarks in the reader canvas. These actions mutate React state, but the payload sent to `POST /api/v1/reader/progress/:bookId` only sends `{ currentPage, totalPages, percentage }`. Highlights and bookmarks are never saved to the database.
- **System Impact**:
  User annotations and bookmarks are permanently lost upon refreshing or closing the browser.
- **Remediation**:
  Add `bookmarks` and `highlights` arrays to `UploadedBookReadingProgress.js` and update `saveProgress` in `reader.controller.js` to persist them.

---

### [P2-UI-02] AddBookModal Searches Hardcoded Mock Array Instead of Live API
- **Classification**: Mock Data / Fake Feature
- **Affected Files**:
  - `src/components/AddBookModal.jsx` (Lines 48–65)
- **Problem Description**:
  The modal search function does not invoke `/api/v1/books/search`. Instead, it uses `setTimeout` with hardcoded objects ("Atomic Habits", "Deep Work") and dummy Pexels photo URLs.
- **System Impact**:
  Users cannot search or add any books other than the 2 hardcoded examples in the modal.
- **Remediation**:
  Replace `handleSearch` with a real API call:
  ```javascript
  const { data } = await api.get(`/books/search?q=${encodeURIComponent(query)}`);
  setSearchResults(data.books || []);
  ```

---

### [P2-PERF-01] Unbounded In-Memory Leaderboard Sorting
- **Classification**: Performance Bottleneck / Memory Exhaustion Risk
- **Affected Files**:
  - `backend/src/controllers/gamification.controller.js` (Lines 40–60)
- **Problem Description**:
  The leaderboard endpoint loads all users from the database into Node.js memory:
  ```javascript
  const allUsers = await User.find({}).select('name points readingStreak avatar');
  allUsers.sort((a, b) => b.points - a.points);
  ```
- **System Impact**:
  As the user base grows past 5,000 users, this query causes severe garbage collection pauses, high latency, and eventual out-of-memory crashes on Node.js.
- **Remediation**:
  Use MongoDB aggregation with `$sort` and `$limit`:
  ```javascript
  const topUsers = await User.find({})
    .select('name points readingStreak avatar')
    .sort({ points: -1 })
    .limit(50)
    .lean();
  ```

---

### [P2-DATA-02] Missing Compound Indexes on Critical Progress Collections
- **Classification**: Database Optimization
- **Affected Files**:
  - `backend/src/models/UploadedBookReadingProgress.js`
  - `backend/src/models/Book.js`
- **Problem Description**:
  Neither `UploadedBookReadingProgress` nor `Book` define compound indexes for frequent queries (`{ userId: 1, bookId: 1 }` and `{ user: 1, status: 1 }`).
- **System Impact**:
  Every reading progress lookup and library shelf filter requires a collection scan, degrading database performance as records scale.
- **Remediation**:
  Add schema-level compound indexes:
  ```javascript
  uploadedBookReadingProgressSchema.index({ userId: 1, bookId: 1 }, { unique: true });
  bookSchema.index({ user: 1, status: 1 });
  ```

---

### [P2-ECOMM-01] Simulated Checkout Without Payment Verification
- **Classification**: Incomplete Business Logic
- **Affected Files**:
  - `src/pages/Cart.jsx` (Lines 180–220)
  - `backend/src/controllers/order.controller.js` (Lines 25–50)
- **Problem Description**:
  The marketplace checkout creates orders directly in the database without integrating a payment provider (Stripe, Razorpay, etc.). Order records are marked `completed` without payment confirmation.
- **System Impact**:
  No real commercial transactions can occur; anyone can generate orders without transferring funds.
- **Remediation**:
  Integrate Stripe Elements or Checkout Sessions with webhook validation before marking orders as paid.

---

## Priority 3 (P3) — Technical Debt, Polish & Dead Code

### [P3-CLEAN-01] Orphaned Dead Files in Frontend
- **Classification**: Dead Code
- **Affected Files**:
  - `src/pages/AdminDashboard.jsx` (Replaced by `AdminLayout.jsx`)
  - `src/pages/admin/AdminAnalytics.jsx` (Static stub)
  - `src/components/Header.jsx` (Replaced by `TopBar.jsx`)
  - `src/components/SearchBar.jsx` (Unused)
  - `src/components/PDFViewer.jsx` (Unused)
  - `src/components/MarketplaceBookCard.jsx` (Unused)
  - `src/components/ReadingCharts.jsx` (Unused)
  - `src/components/ReadingHeatmap.jsx` (Unused)
  - `src/components/WordCloud.jsx` (Unused)
  - `src/components/EmptyState.jsx` (Unused)
  - `src/components/ui/Dialog.jsx` (Unused)
  - `src/components/ui/Badge.jsx` (Unused)
  - `src/hooks/useLocalStorage.js` (Unused)
  - `src/hooks/useTheme.js` (Unused)
- **System Impact**:
  Inflates repository size, causes confusion during maintenance, and increases bundle risk.
- **Remediation**:
  Safely remove these orphaned files.

---

### [P3-CLEAN-02] Dead Backend Controller & Empty Stub Files
- **Classification**: Technical Debt
- **Affected Files**:
  - `backend/src/controllers/book.controller.js` (Unused duplicate of `bookController.js`)
  - `backend/services/cacheService.js` (0-byte file)
  - `backend/services/openLibraryService.js` (0-byte file)
  - `backend/config/redis.js` (0-byte file)
- **System Impact**:
  Maintains duplicate business logic that diverges from live endpoints.
- **Remediation**:
  Migrate routes to the modern modular `book.controller.js`, deprecate legacy `bookController.js`, and remove empty stub files.

---

### [P3-PERF-02] Monolithic Main Bundle Lacks Route Splitting
- **Classification**: Frontend Performance
- **Affected Files**:
  - `src/App.jsx` (Lines 10–35)
- **Problem Description**:
  All page components are imported statically at the root, bundling heavy libraries (`pdfjs-dist`, `recharts`, `framer-motion`) into the initial bundle.
- **System Impact**:
  Slow initial load times on mobile devices.
- **Remediation**:
  Implement code splitting using `React.lazy` and `Suspense`.

---

## Issue Summary Matrix

| ID | Title | Severity | Category | File |
| :--- | :--- | :--- | :--- | :--- |
| **P0-BUG-01** | Reader API 404 on Catalog Books | **P0** | Confirmed Bug | `backend/src/controllers/reader.controller.js` |
| **P0-BUG-02** | External Metadata Stripped in Library View | **P0** | Confirmed Bug | `backend/src/controllers/bookController.js` |
| **P0-BUG-03** | Invalid Gemini AI Model Identifier | **P0** | Confirmed Bug | `backend/src/services/aiService.js` |
| **P0-SEC-01** | Startup Crash on Missing Cloudinary Config | **P0** | System Crash | `backend/config/cloudinary.js` |
| **P1-BUG-01** | Axios Refresh Token Promise Swallow | **P1** | Confirmed Bug | `src/api/axios.js` |
| **P1-UI-01** | Mobile Right-Shift Viewport Break | **P1** | UI/UX Defect | `src/components/AppLayout.jsx` |
| **P1-BUG-02** | Analytics KPI Property Mismatch | **P1** | Confirmed Bug | `src/pages/Analytics.jsx` |
| **P1-SEC-02** | Global Route Guard Blocks Public Explore | **P1** | Security/Routes | `backend/src/routes/book.routes.js` |
| **P2-DATA-01** | Missing PDF Annotation Persistence | **P2** | Missing Feature| `src/pages/Reader.jsx` |
| **P2-UI-02** | AddBookModal Hardcoded Mock Search | **P2** | Mock / Fake UI | `src/components/AddBookModal.jsx` |
| **P2-PERF-01**| Unbounded Leaderboard Sorting | **P2** | Performance | `backend/src/controllers/gamification.controller.js` |
| **P2-DATA-02**| Missing Indexes on Progress & Books | **P2** | Database | `backend/src/models/Book.js` |
| **P2-ECOMM-01**| Simulated Checkout Without Payment | **P2** | Incomplete Logic| `src/pages/Cart.jsx` |
| **P3-CLEAN-01**| 14 Orphaned Frontend Files | **P3** | Dead Code | `src/components/*` |
| **P3-CLEAN-02**| Duplicate Controller & Empty Stubs | **P3** | Technical Debt | `backend/src/controllers/book.controller.js` |
| **P3-PERF-02**| Monolithic Main Bundle | **P3** | Performance | `src/App.jsx` |

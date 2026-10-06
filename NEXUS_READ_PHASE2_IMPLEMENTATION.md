# NexusRead Phase 2 — Security & Authentication Hardening

**Branch:** `nexusread-2.0`
**Baseline:** Phase 1 commit `6c4a645e51f81e524463d6a3feceef6ae067af25`
**Phase 2 commit:** `feat: complete phase 2 security hardening`

---

## Scope

Phase 2 addresses three verified security issues:

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Public catalog/discovery blocked by overly-broad `protect` | Medium | ✅ Fixed |
| 2 | IDOR on local PDF file serving | High | ✅ Fixed |
| 3 | No account-level brute-force lockout on login | High | ✅ Fixed |

---

## Task 1 — Public Book Discovery Route Authorization

### Finding

`backend/src/routes/book.routes.js` (line 25) mounted the entire `legacyBookRoutes` router behind `protect`:

```js
// BEFORE (broken)
router.use('/', protect, legacyBookRoutes);
```

`legacyBookRoutes` (`bookRoutes.js`) correctly uses `optionalProtect` on its public GET routes (`/explore`, `GET /`, `GET /:id`) and only applies `protect` to mutations. But the outer `protect` in `book.routes.js` intercepted every request first, returning HTTP 401 to unauthenticated users trying to browse the catalog.

### Verification

Confirmed by reading both files:
- `book.routes.js` line 25: `router.use('/', protect, legacyBookRoutes)` — outer protect
- `bookRoutes.js` lines 7–13: `optionalProtect` on public GETs, `router.use(protect)` before mutations

### Fix

Removed the outer `protect` wrapper. The `legacyBookRoutes` router's internal guard (`router.use(protect)` at its own line 13) is sufficient and correct.

```js
// AFTER (fixed)
router.use('/', legacyBookRoutes);
```

**Files changed:** `backend/src/routes/book.routes.js`

### Regression Risk

None. The `legacyBookRoutes` router's internal `router.use(protect)` still protects all mutation routes (`POST /`, `PUT /:id`, `DELETE /:id`, `POST /add-external`, `POST /:id/add-to-library`). Public GETs still use `optionalProtect`, attaching user context when a valid token is present.

---

## Task 2 — Secure Private PDF Access (IDOR Prevention)

### Finding

`backend/src/app.js` served uploaded PDFs via `express.static`:

```js
// BEFORE (IDOR vulnerable)
app.use(
  '/api/v1/pdfs',
  protect,
  express.static(path.join(__dirname, '..', 'public', 'pdfs'), { ... })
);
```

Any authenticated user who knew or guessed a PDF filename could access another user's file. Filenames are MongoDB ObjectIds (`<id>.pdf`) — predictable in format, even if the 12-byte value requires enumeration.

`express.static` has no mechanism for per-file ownership checks — it simply checks whether the file exists on disk.

### Verification

- `UploadedBook.publicId` stores the filename (confirmed from `uploadPdf` handler in `reader.controller.js` line 44: `publicId: fileName`)
- `UploadedBook.user` stores the owner's ObjectId
- `express.static` performed no ownership check

### Fix

Replaced the `express.static` block with a custom `app.get` route handler that:

1. Validates the filename against path traversal patterns (`/`, `\`, `..`)
2. Queries `UploadedBook.findOne({ publicId: filename })` to find the record
3. Returns 404 if no DB record exists (avoids confirming file existence)
4. Returns 403 if the requesting user is not the book owner
5. Calls `res.sendFile()` only after ownership is confirmed

```js
// AFTER (ownership-checked)
app.get('/api/v1/pdfs/:filename', protect, (req, res, next) => {
  const { filename } = req.params;
  if (!filename || /[/\\]/.test(filename) || filename.includes('..')) {
    return res.status(400).json({ status: 'fail', message: 'Invalid filename.' });
  }
  UploadedBook.findOne({ publicId: filename }).then((book) => {
    if (!book) return res.status(404).json(...);
    if (book.user.toString() !== req.user._id.toString())
      return res.status(403).json(...);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(filePath, ...);
  }).catch(next);
});
```

**Files changed:** `backend/src/app.js`

> **Note on Cloudinary PDFs:** When `USE_CLOUDINARY_PDF=true`, the `fileUrl` stored in UploadedBook is a Cloudinary CDN URL. These URLs are not served through this endpoint and are not protected by it. Cloudinary raw resource URLs by default are public on the CDN. Securing Cloudinary URLs with signed access or private delivery requires Cloudinary account-level changes (upgrade to a plan with private delivery or URL signing). This is a known limitation documented here but deferred — the local PDF path (default) is now IDOR-free.

### Regression Risk

Minimal. The endpoint behavior is identical for the owner. Non-owners now get 403 instead of the file. Unauthenticated users already got 401 via `protect`.

---

## Task 3 — Login Brute-Force Protection (Account-Level Lockout)

### Finding

The IP-level `loginLimiter` (5 requests / 15 min per IP in production) existed but provided no protection against:
- Multi-IP / VPN / proxy attackers targeting a single account
- Credential stuffing attacks on known email addresses

`authController.js` login handler had no per-account failure tracking.

### Verification

- `backend/src/middleware/security.js`: `loginLimiter` is IP-based only (`rateLimit()` without custom key)
- `backend/src/controllers/authController.js`: login handler made a single DB query with no attempt tracking
- `backend/src/models/User.js`: no `failedLoginAttempts` or `lockedUntil` fields

### Fix

**Schema changes (`User.js`):**
- Added `failedLoginAttempts: { type: Number, default: 0, select: false }`
- Added `lockedUntil: { type: Date, default: null, select: false }`
- Both fields use `select: false` to prevent accidental exposure in responses

**Login handler changes (`authController.js`):**

1. Select the hidden fields explicitly: `.select('+password +failedLoginAttempts +lockedUntil')`
2. Check lockout before password comparison to short-circuit and avoid bcrypt timing leak
3. On failed credentials:
   - Increment `failedLoginAttempts` on the existing user (no-op for unknown emails)
   - Lock the account (`lockedUntil = now + 15min`) when attempts reach the threshold
   - Use `User.updateOne()` to bypass the `pre('save')` password hashing hook
4. On successful login: reset `failedLoginAttempts` and `lockedUntil` if non-zero
5. Locked response returns **HTTP 429** with minutes remaining in the message

**Configurable via environment variables:**
- `LOGIN_MAX_ATTEMPTS` (default: `5`)
- `LOGIN_LOCK_DURATION_MINUTES` (default: `15`)

**Design decisions:**
- Lockout is only applied to **existing accounts** — unknown email attempts do not create phantom lockouts
- Response for an already-locked account is HTTP 429, not 401, to let the frontend show a distinct UI message
- `User.updateOne()` (not `user.save()`) avoids triggering the password-hashing `pre('save')` hook

**Files changed:** `backend/src/models/User.js`, `backend/src/controllers/authController.js`

### Regression Risk

Low. The login success path is unchanged for users who have not failed before. Existing users without the new schema fields will have `undefined` for `failedLoginAttempts` / `lockedUntil` — the code safely treats `undefined` as `0` / `null` respectively.

---

## Verification Results

| Check | Result |
|-------|--------|
| `node -e "require('./backend/src/app')"` | ✅ Loads OK (Cloudinary graceful warning, expected) |
| `npm run lint` | ✅ 0 errors |
| `npm run build` | ✅ `built in 11.58s`, 2723 modules transformed |
| Branch | ✅ `nexusread-2.0` |
| `main` untouched | ✅ No changes to `main` |

---

## Files Modified

| File | Change |
|------|--------|
| `backend/src/routes/book.routes.js` | Removed outer `protect` from `legacyBookRoutes` mount |
| `backend/src/app.js` | Replaced `express.static` PDF serve with ownership-checked route handler |
| `backend/src/models/User.js` | Added `failedLoginAttempts` and `lockedUntil` schema fields |
| `backend/src/controllers/authController.js` | Implemented account-level lockout in `login` handler |

---

## Deferred / Out of Phase 2 Scope

- **Cloudinary PDF IDOR**: Cloudinary CDN URLs are inherently public; signed delivery requires account plan upgrade — deferred to a future infrastructure phase
- **IDOR in other controllers** (Book update/delete without ownership check, order endpoints): deferred to Phase 3 per roadmap
- **Admin authorization audit**: deferred to Phase 3
- **Google login brute-force**: Google OAuth is token-verified by Google's servers; no brute-force surface exists in NexusRead's own code for this path

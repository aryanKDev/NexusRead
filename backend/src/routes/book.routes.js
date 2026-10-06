const express = require('express');
const validateSearchQuery = require('../middlewares/validateSearchQuery.middleware');
const bookController = require('../controllers/book.controller');
const { protect, optionalProtect } = require('../middleware/auth');
const { searchLimiter } = require('../../config/rateLimit');

// Legacy routes: contain both public (explore, GET /, GET /:id) and
// protected (add-external, POST /, PUT /:id, DELETE /:id, POST /:id/add-to-library)
// handlers. Internal guard via `router.use(protect)` at line 13 of bookRoutes.js
// correctly separates them — we must NOT wrap the whole router in protect here.
const legacyBookRoutes = require('./bookRoutes');

const router = express.Router();

// ── Public routes ──────────────────────────────────────────────────────────────
// Search: public but rate-limited. Auth is optional for future personalization.
router.get(
  '/search',
  searchLimiter,
  validateSearchQuery,
  bookController.searchBooks
);

// ── Authenticated-only routes ──────────────────────────────────────────────────
// Track preview clicks only for authenticated users.
router.post('/preview-click', protect, bookController.trackPreviewClick);

// ── Legacy book routes ─────────────────────────────────────────────────────────
// bookRoutes.js already applies optionalProtect on public GET routes and
// protect on all mutation routes via its own router.use(protect) at the split
// point. Do NOT add an outer protect here — it would block public catalog access.
router.use('/', legacyBookRoutes);

module.exports = router;



const express = require('express');
const { protect } = require('../middleware/auth');
const { handleUpload } = require('../middlewares/upload.middleware');
const readerController = require('../controllers/reader.controller');
const readerAnalyticsController = require('../controllers/readerAnalytics.controller');
const noteController = require('../controllers/note.controller');

const router = express.Router();

router.use(protect);

router.post('/upload', handleUpload, readerController.uploadPdf);
router.post('/session', readerController.createSession);
router.get('/progress', readerController.getProgress);
router.patch('/progress', readerController.updateProgress);
router.post('/progress', readerController.updateProgress);

// REST-style aliases used by the frontend reader page.
router.get('/progress/:bookId', (req, res, next) => {
  req.query.bookId = req.params.bookId;
  return readerController.getProgress(req, res, next);
});
router.post('/progress/:bookId', (req, res, next) => {
  req.body.bookId = req.params.bookId;
  return readerController.updateProgress(req, res, next);
});
router.patch('/progress/:bookId', (req, res, next) => {
  req.body.bookId = req.params.bookId;
  return readerController.updateProgress(req, res, next);
});

router.get('/dashboard/stats', readerAnalyticsController.getDashboardStats);
router.get('/dashboard/streak', readerAnalyticsController.getStreak);
router.get('/dashboard/activity', readerAnalyticsController.getActivity);
router.get('/dashboard/feed', readerAnalyticsController.getReadingActivityFeed);
router.get('/dashboard/recommendations', readerAnalyticsController.getRecommendations);
router.get('/goals', readerAnalyticsController.getGoalsSummary);
router.post('/goals', readerAnalyticsController.upsertGoal);

// Quick notes — must be BEFORE the /:bookId catch-all to avoid mis-routing
router.get('/notes/:bookId', noteController.getNotes);
router.post('/notes/:bookId', noteController.createNote);
router.delete('/notes/:bookId/:noteId', noteController.deleteNote);

router.get('/:bookId', readerController.getBook);

module.exports = router;


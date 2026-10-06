const express = require('express');
const router = express.Router();
const ai = require('../controllers/ai.controller');
const { protect } = require('../middleware/auth');

// All AI routes require authentication to prevent abuse
router.use(protect);

router.post('/summarize', ai.summarize);
router.post('/explain', ai.explain);
router.post('/define', ai.define);
router.post('/ask', ai.ask);
router.post('/smart-notes', ai.smartNotes);
router.post('/chapter-summary', ai.chapterSummary);

module.exports = router;

const aiService = require('../services/aiService');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');

const MAX_TEXT = 6000;

/**
 * POST /ai/summarize
 * Body: { text, bookTitle? }
 */
exports.summarize = catchAsync(async (req, res, next) => {
  const { text, bookTitle } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return next(new AppError('Please provide text with at least 20 characters to summarize.', 400));
  }
  const result = await aiService.summarize(text.slice(0, MAX_TEXT), bookTitle || '');
  if (!result.ok) return next(new AppError(result.error, 503));
  sendSuccess(res, { data: { summary: result.text } });
});

/**
 * POST /ai/explain
 * Body: { text }
 */
exports.explain = catchAsync(async (req, res, next) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return next(new AppError('Please provide text to explain.', 400));
  }
  const result = await aiService.explain(text.slice(0, MAX_TEXT));
  if (!result.ok) return next(new AppError(result.error, 503));
  sendSuccess(res, { data: { explanation: result.text } });
});

/**
 * POST /ai/define
 * Body: { word, context? }
 */
exports.define = catchAsync(async (req, res, next) => {
  const { word, context } = req.body;
  if (!word || typeof word !== 'string' || word.trim().length === 0) {
    return next(new AppError('Please provide a word to define.', 400));
  }
  const result = await aiService.define(word.trim(), context || '');
  if (!result.ok) return next(new AppError(result.error, 503));
  sendSuccess(res, { data: { definition: result.text } });
});

/**
 * POST /ai/ask
 * Body: { question, context? }
 */
exports.ask = catchAsync(async (req, res, next) => {
  const { question, context } = req.body;
  if (!question || typeof question !== 'string' || question.trim().length < 3) {
    return next(new AppError('Please provide a question.', 400));
  }
  const result = await aiService.ask(question, (context || '').slice(0, MAX_TEXT));
  if (!result.ok) return next(new AppError(result.error, 503));
  sendSuccess(res, { data: { answer: result.text } });
});

/**
 * POST /ai/smart-notes
 * Body: { highlights: Array<{text, page?}|string> }
 */
exports.smartNotes = catchAsync(async (req, res, next) => {
  const { highlights } = req.body;
  if (!Array.isArray(highlights) || highlights.length === 0) {
    return next(new AppError('Please provide an array of highlights.', 400));
  }
  if (highlights.length > 50) {
    return next(new AppError('Maximum 50 highlights per request.', 400));
  }
  const result = await aiService.smartNotes(highlights);
  if (!result.ok) return next(new AppError(result.error, 503));
  sendSuccess(res, { data: { notes: result.text } });
});

/**
 * POST /ai/chapter-summary
 * Body: { text, chapterTitle?, bookTitle? }
 */
exports.chapterSummary = catchAsync(async (req, res, next) => {
  const { text, chapterTitle, bookTitle } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length < 50) {
    return next(new AppError('Please provide chapter text with at least 50 characters.', 400));
  }
  const result = await aiService.chapterSummary(
    text.slice(0, MAX_TEXT),
    chapterTitle || '',
    bookTitle || ''
  );
  if (!result.ok) return next(new AppError(result.error, 503));
  sendSuccess(res, { data: { summary: result.text } });
});

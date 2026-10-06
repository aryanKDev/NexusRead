/**
 * Note controller — CRUD for quick notes attached to a book.
 * Notes are stored in the Note model: { user, book, content, page }.
 * "book" here references the catalog Book ObjectId.
 * For uploaded books the bookId param is the UploadedBook ObjectId; we allow
 * it to be stored as-is since the Note model just needs an ObjectId key.
 */
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { Note } = require('../models');

/**
 * GET /reader/notes/:bookId
 * Return all notes for this user × book, newest first.
 */
const getNotes = catchAsync(async (req, res, next) => {
  const { bookId } = req.params;
  if (!bookId) return next(new AppError('bookId is required.', 400));

  const notes = await Note.find({ user: req.user._id, book: bookId })
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, { data: notes });
});

/**
 * POST /reader/notes/:bookId
 * Create a new note.
 * Body: { content: string, page?: number }
 */
const createNote = catchAsync(async (req, res, next) => {
  const { bookId } = req.params;
  const { content, page } = req.body;

  if (!bookId) return next(new AppError('bookId is required.', 400));
  if (!content || typeof content !== 'string' || !content.trim()) {
    return next(new AppError('content is required.', 400));
  }

  const note = await Note.create({
    user: req.user._id,
    book: bookId,
    content: content.trim(),
    page: Number(page) || 0,
  });

  return sendSuccess(res, { data: note, statusCode: 201 });
});

/**
 * DELETE /reader/notes/:bookId/:noteId
 * Delete a single note (owner only).
 */
const deleteNote = catchAsync(async (req, res, next) => {
  const { bookId, noteId } = req.params;

  const note = await Note.findOne({ _id: noteId, user: req.user._id, book: bookId });
  if (!note) return next(new AppError('Note not found.', 404));

  await note.deleteOne();
  return sendSuccess(res, { data: null, message: 'Note deleted.' });
});

module.exports = { getNotes, createNote, deleteNote };

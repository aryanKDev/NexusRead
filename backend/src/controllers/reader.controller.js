const mongoose = require('mongoose');
const { Readable } = require('stream');
const path = require('path');
const fs = require('fs/promises');
const cloudinary = require('../../config/cloudinary');
const UploadedBook = require('../models/UploadedBook');
const UploadedBookReadingProgress = require('../models/UploadedBookReadingProgress');
const UploadedBookReadingSession = require('../models/UploadedBookReadingSession');
const Book = require('../models/Book');
const ReadingProgress = require('../models/ReadingProgress');
const ReadingSession = require('../models/ReadingSession');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');

const uploadPdf = catchAsync(async (req, res, next) => {
  if (!req.file || !req.file.buffer) {
    return next(new AppError('No file provided.', 400));
  }

  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) {
    return next(new AppError('Title is required.', 400));
  }

  // Default to local storage so PDFs can be served inline via express.static
  // (Cloudinary "raw" URLs often trigger downloads due to response headers).
  const useCloudinary = String(process.env.USE_CLOUDINARY_PDF || '').toLowerCase() === 'true';

  if (!useCloudinary) {
    const newId = new mongoose.Types.ObjectId();
    const fileName = `${newId}.pdf`;
    const pdfDir = path.join(__dirname, '..', '..', 'public', 'pdfs');
    await fs.mkdir(pdfDir, { recursive: true });
    await fs.writeFile(path.join(pdfDir, fileName), req.file.buffer);

    const fileUrl = `${req.protocol}://${req.get('host')}/api/v1/pdfs/${fileName}`;

    const uploadedBook = await UploadedBook.create({
      _id: newId,
      user: req.user._id,
      title,
      fileUrl,
      publicId: fileName,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    return sendSuccess(res, {
      data: uploadedBook,
      statusCode: 201,
    });
  }

  if (!cloudinary.isConfigured) {
    return next(
      new AppError(
        'Cloudinary storage is enabled but credentials are not configured.',
        500
      )
    );
  }

  const uploadOptions = {
    resource_type: 'raw',
    folder: 'bookt/pdfs',
  };

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      async (err, result) => {
        if (err) {
          return reject(
            new AppError(
              err.message || 'Failed to upload file to storage.',
              502
            )
          );
        }
        if (!result || !result.secure_url || !result.public_id) {
          return reject(new AppError('Invalid upload response.', 502));
        }

        try {
          const uploadedBook = await UploadedBook.create({
            user: req.user._id,
            title,
            fileUrl: result.secure_url,
            publicId: result.public_id,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
          });

          return resolve(
            sendSuccess(res, {
              data: uploadedBook,
              statusCode: 201,
            })
          );
        } catch (createErr) {
          return reject(
            new AppError(
              createErr.message || 'Failed to save book metadata.',
              500
            )
          );
        }
      }
    );

    const readable = Readable.from(req.file.buffer);
    readable.pipe(uploadStream);
  });
});

/**
 * Resolves a readable book by ID:
 * 1. Checks UploadedBook (user-owned PDF) - verifies user authorization
 * 2. Checks global catalog Book (accessible to all authenticated readers)
 * Returns { book, type: 'uploaded' | 'catalog' } or { error }
 */
async function resolveReadableBook(bookId, userId) {
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return { error: new AppError('Invalid book ID.', 400) };
  }

  // 1. Check UploadedBook first
  const uploaded = await UploadedBook.findById(bookId);
  if (uploaded) {
    if (uploaded.user.toString() !== userId.toString()) {
      return { error: new AppError('You do not have access to this book.', 403) };
    }
    return { book: uploaded, type: 'uploaded' };
  }

  // 2. Check global catalog Book
  const catalogBook = await Book.findById(bookId);
  if (catalogBook) {
    return { book: catalogBook, type: 'catalog' };
  }

  return { error: new AppError('Book not found.', 404) };
}

const getBook = catchAsync(async (req, res, next) => {
  const { bookId } = req.params;
  const resolution = await resolveReadableBook(bookId, req.user._id);

  if (resolution.error) {
    return next(resolution.error);
  }

  const { book, type } = resolution;
  if (type === 'uploaded') {
    return sendSuccess(res, { data: book });
  }

  // For catalog Book, provide normalized reader metadata
  const catalogData = {
    ...book.toObject(),
    id: book._id,
    fileUrl: book.pdfUrl || '',
    totalPages: book.pages || 0,
  };
  return sendSuccess(res, { data: catalogData });
});

const updateProgress = catchAsync(async (req, res, next) => {
  const { bookId, currentPage, totalPages } = req.body;

  if (!bookId) {
    return next(new AppError('bookId is required.', 400));
  }

  const page = Number(currentPage);
  const total = Number(totalPages);

  if (!Number.isInteger(page) || page < 1) {
    return next(new AppError('currentPage must be an integer >= 1.', 400));
  }
  if (!Number.isInteger(total) || total < 1) {
    return next(new AppError('totalPages must be an integer >= 1.', 400));
  }
  if (page > total) {
    return next(
      new AppError('currentPage must not exceed totalPages.', 400)
    );
  }

  const resolution = await resolveReadableBook(bookId, req.user._id);
  if (resolution.error) {
    return next(resolution.error);
  }

  const { book, type } = resolution;
  const percentage = Math.round((page / total) * 100);
  const now = new Date();

  if (type === 'uploaded') {
    const progress = await UploadedBookReadingProgress.findOneAndUpdate(
      { user: req.user._id, book: bookId },
      {
        currentPage: page,
        totalPages: total,
        percentage,
        lastReadAt: now,
        updatedAt: now,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    ).populate('book', 'title fileUrl totalPages');

    return sendSuccess(res, { data: progress });
  }

  // type === 'catalog'
  const catalogStatus = percentage >= 100 ? 'completed' : (page > 1 ? 'reading' : 'wishlist');
  const updateFields = {
    currentPage: page,
    percentage,
    lastReadAt: now,
    status: catalogStatus,
  };
  if (Array.isArray(req.body.bookmarks)) {
    updateFields.bookmarks = req.body.bookmarks;
  }
  if (Array.isArray(req.body.userHighlights)) {
    updateFields.userHighlights = req.body.userHighlights;
  }

  const progress = await ReadingProgress.findOneAndUpdate(
    { user: req.user._id, book: bookId },
    updateFields,
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  ).populate('book', 'title pages pdfUrl cover');

  return sendSuccess(res, {
    data: {
      ...progress.toObject(),
      currentPage: progress.currentPage,
      totalPages: total || book.pages || 1,
      percentage: progress.percentage,
    },
  });
});

const getProgress = catchAsync(async (req, res, next) => {
  const { bookId } = req.query;

  if (!bookId) {
    return next(new AppError('bookId is required.', 400));
  }

  const resolution = await resolveReadableBook(bookId, req.user._id);
  if (resolution.error) {
    return next(resolution.error);
  }

  const { book, type } = resolution;

  if (type === 'uploaded') {
    const progress = await UploadedBookReadingProgress.findOne({
      user: req.user._id,
      book: bookId,
    });

    if (!progress) {
      return sendSuccess(res, {
        data: {
          currentPage: 1,
          totalPages: 1,
          percentage: 0,
        },
      });
    }

    return sendSuccess(res, { data: progress });
  }

  // type === 'catalog'
  const progress = await ReadingProgress.findOne({
    user: req.user._id,
    book: bookId,
  });

  const totalPages = book.pages > 0 ? book.pages : 1;
  if (!progress) {
    return sendSuccess(res, {
      data: {
        currentPage: 1,
        totalPages,
        percentage: 0,
        status: 'reading',
        bookmarks: [],
        userHighlights: [],
      },
    });
  }

  return sendSuccess(res, {
    data: {
      ...progress.toObject(),
      currentPage: progress.currentPage || 1,
      totalPages: totalPages,
      percentage: progress.percentage || 0,
      status: progress.status || 'reading',
      bookmarks: progress.bookmarks || [],
      userHighlights: progress.userHighlights || [],
    },
  });
});

const createSession = catchAsync(async (req, res, next) => {
  const { bookId, durationInSeconds } = req.body;

  if (!bookId) {
    return next(new AppError('bookId is required.', 400));
  }

  const duration = Number(durationInSeconds);
  if (!Number.isFinite(duration) || duration < 0) {
    return next(new AppError('durationInSeconds must be a non-negative number.', 400));
  }

  const resolution = await resolveReadableBook(bookId, req.user._id);
  if (resolution.error) {
    return next(resolution.error);
  }

  const { type } = resolution;

  if (type === 'uploaded') {
    await UploadedBookReadingSession.create({
      user: req.user._id,
      book: bookId,
      durationInSeconds: Math.round(duration),
    });
  } else {
    await ReadingSession.create({
      user: req.user._id,
      book: bookId,
      duration: Math.round(duration),
    });
  }

  return sendSuccess(res, { data: { ok: true }, statusCode: 201 });
});

module.exports = {
  uploadPdf,
  getBook,
  getProgress,
  updateProgress,
  createSession,
};

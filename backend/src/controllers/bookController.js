const { Book, ReadingProgress, UploadedBook } = require('../models');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// Alias to match common naming used across Node/Express projects.
const asyncHandler = catchAsync;

/** Book metadata fields only (for create/update). */
const BOOK_META_FIELDS = ['title', 'author', 'pages', 'cover', 'genre', 'description'];

/** Normalize body: map legacy field names to current schema + sanitize. */
function normalizeBookMeta(body) {
  const meta = pick(body, BOOK_META_FIELDS);
  if (body.coverImage != null && meta.cover === undefined) meta.cover = body.coverImage;
  if (body.categories != null && meta.genre === undefined) meta.genre = body.categories;

  // --- Input sanitization ---
  if (typeof meta.title === 'string') meta.title = meta.title.trim().slice(0, 500);
  if (typeof meta.author === 'string') meta.author = meta.author.trim().slice(0, 300);
  if (typeof meta.description === 'string') meta.description = meta.description.trim().slice(0, 5000);
  if (typeof meta.cover === 'string') meta.cover = meta.cover.trim().slice(0, 1000);
  if (meta.pages != null) {
    meta.pages = Math.max(0, Math.floor(Number(meta.pages) || 0));
  }
  if (Array.isArray(meta.genre)) {
    meta.genre = meta.genre.slice(0, 20).map(g => String(g).trim().slice(0, 100)).filter(Boolean);
  }
  return meta;
}

/** Progress fields stored in ReadingProgress. */
const PROGRESS_FIELDS = ['currentPage', 'status', 'rating', 'startDate', 'endDate', 'percentage', 'lastReadAt'];

function pick(obj, keys) {
  return keys.reduce((acc, k) => {
    if (obj != null && obj.hasOwnProperty(k)) acc[k] = obj[k];
    return acc;
  }, {});
}

/**
 * Merge book document and optional progress document for API response.
 * Preserves _id as id and flattens progress onto the book object so frontend format is unchanged.
 */
function mergeBookWithProgress(bookDoc, progressDoc) {
  const book = bookDoc.toObject ? bookDoc.toObject() : { ...bookDoc };
  const id = book._id;
  const out = { ...book, id: id || book.id };
  if (out.cover != null && out.coverImage === undefined) out.coverImage = out.cover;
  if (out.genre != null && out.categories === undefined) out.categories = out.genre;
  if (progressDoc) {
    const prog = progressDoc.toObject ? progressDoc.toObject() : { ...progressDoc };
    out.currentPage = prog.currentPage;
    out.status = prog.status;
    out.rating = prog.rating;
    out.startDate = prog.startDate;
    out.endDate = prog.endDate;
    out.percentage = prog.percentage;
    out.lastReadAt = prog.lastReadAt;
  }
  return out;
}

/**
 * GET /books/explore
 * Global catalogue: all books from Book collection, no progress.
 * Works with or without auth (optionalProtect).
 */
exports.getExploreBooks = catchAsync(async (req, res, next) => {
  const books = await Book.find().sort('-createdAt');
  const normalized = books.map((b) => {
    const o = { ...b.toObject(), id: b._id };
    if (o.cover != null) o.coverImage = o.cover;
    if (o.genre != null) o.categories = o.genre;
    return o;
  });
  res.status(200).json({
    status: 'success',
    results: normalized.length,
    data: { books: normalized },
  });
});

/**
 * GET /books
 * Returns a unified, normalized list of books:
 * - external books from `Book`/`ReadingProgress`
 * - uploaded PDF books from `UploadedBook`
 *
 * Response:
 * {
 *   success: true,
 *   data: Array<{
 *     id: string;
 *     title: string;
 *     authors: string[];
 *     thumbnail: string | null;
 *     createdAt: string;
 *     type: "external" | "uploaded";
 *   }>
 * }
 */
exports.getAllBooks = asyncHandler(async (req, res, next) => {
  const userId = req.user && req.user._id;

  const normalizeExternal = (bookDoc, progressDoc) => {
    if (!bookDoc) return null;
    const merged = mergeBookWithProgress(bookDoc, progressDoc);
    const id = merged.id || merged._id;
    const title =
      typeof merged.title === 'string' && merged.title.trim().length > 0
        ? merged.title.trim()
        : 'Untitled';

    const authorsRaw = Array.isArray(merged.authors)
      ? merged.authors
      : typeof merged.author === 'string' && merged.author.trim()
      ? [merged.author.trim()]
      : [];

    const authors = authorsRaw
      .map((a) => (typeof a === 'string' ? a.trim() : ''))
      .filter(Boolean);

    const author =
      typeof merged.author === 'string' && merged.author.trim()
        ? merged.author.trim()
        : authors.length > 0
        ? authors.join(', ')
        : 'Unknown Author';

    const thumbnail =
      typeof merged.coverImage === 'string' && merged.coverImage.trim().length > 0
        ? merged.coverImage.trim()
        : typeof merged.cover === 'string' && merged.cover.trim().length > 0
        ? merged.cover.trim()
        : null;

    const createdAt =
      merged.createdAt instanceof Date
        ? merged.createdAt
        : merged.startDate instanceof Date
        ? merged.startDate
        : new Date(id ? String(id).toString().substring(0, 8) : Date.now());

    const pages = Number.isFinite(merged.pages) && merged.pages >= 0 ? merged.pages : 0;
    const currentPage = Number.isFinite(merged.currentPage) && merged.currentPage >= 0 ? merged.currentPage : 0;
    const percentage = Number.isFinite(merged.percentage) && merged.percentage >= 0
      ? merged.percentage
      : (pages > 0 && currentPage > 0 ? Math.round((currentPage / pages) * 100) : 0);

    const status = merged.status || (percentage >= 100 ? 'completed' : (currentPage > 0 ? 'reading' : 'wishlist'));
    const rating = Number.isFinite(merged.rating) && merged.rating >= 0
      ? merged.rating
      : (Number.isFinite(merged.averageRating) && merged.averageRating >= 0 ? merged.averageRating : 0);

    const genres = Array.isArray(merged.genre)
      ? merged.genre
      : (Array.isArray(merged.categories) ? merged.categories : []);

    return {
      id,
      title,
      author,
      authors: authors.length > 0 ? authors : (author !== 'Unknown Author' ? [author] : []),
      thumbnail,
      cover: thumbnail,
      coverImage: thumbnail,
      pages,
      currentPage,
      percentage,
      status,
      rating,
      genre: genres,
      categories: genres,
      description: merged.description || '',
      pdfUrl: merged.pdfUrl || '',
      startDate: merged.startDate ?? null,
      endDate: merged.endDate ?? null,
      lastReadAt: merged.lastReadAt ?? null,
      createdAt,
      type: 'external',
    };
  };

  const normalizeUploaded = (doc, progressDoc) => {
    if (!doc) return null;
    const id = doc._id || doc.id;
    const title =
      typeof doc.title === 'string' && doc.title.trim().length > 0
        ? doc.title.trim()
        : 'Untitled PDF';

    const createdAt =
      doc.createdAt instanceof Date ? doc.createdAt : new Date(Date.now());

    const currentPage =
      progressDoc && Number.isFinite(progressDoc.currentPage)
        ? progressDoc.currentPage
        : 1;
    const totalPages =
      progressDoc && Number.isFinite(progressDoc.totalPages)
        ? progressDoc.totalPages
        : (Number.isFinite(doc.totalPages) && doc.totalPages > 0 ? doc.totalPages : 1);
    const percentage =
      progressDoc && Number.isFinite(progressDoc.percentage)
        ? progressDoc.percentage
        : Math.round((currentPage / totalPages) * 100);

    return {
      id,
      title,
      author: 'Uploaded Document',
      authors: ['Uploaded Document'],
      thumbnail: null,
      cover: null,
      coverImage: null,
      createdAt,
      type: 'uploaded',
      pages: totalPages,
      totalPages,
      currentPage,
      percentage,
      status: percentage >= 100 ? 'completed' : 'reading',
      fileUrl: doc.fileUrl,
      lastReadAt: progressDoc?.lastReadAt ?? undefined,
    };
  };

  let external = [];
  if (userId) {
    const progresses = await ReadingProgress.find({ user: userId })
      .populate('book')
      .sort('-updatedAt');
    external = progresses
      .filter((p) => p && p.book)
      .map((p) => normalizeExternal(p.book, p))
      .filter(Boolean);
  } else {
    const books = await Book.find().sort('-createdAt');
    external = books.map((b) => normalizeExternal(b, null)).filter(Boolean);
  }

  let uploaded = [];
  if (userId) {
    const uploadedDocs = await UploadedBook.find({ user: userId })
      .sort('-createdAt')
      .lean();

    const uploadedIds = (Array.isArray(uploadedDocs) ? uploadedDocs : [])
      .map((d) => d && (d._id || d.id))
      .filter(Boolean);

    const uploadedProgresses = uploadedIds.length
      ? await require('../models').UploadedBookReadingProgress.find({
          user: userId,
          book: { $in: uploadedIds },
        })
          .select('book currentPage totalPages percentage lastReadAt updatedAt')
          .lean()
      : [];

    const progressByBookId = new Map(
      (Array.isArray(uploadedProgresses) ? uploadedProgresses : []).map((p) => [
        String(p.book),
        p,
      ])
    );

    uploaded = Array.isArray(uploadedDocs)
      ? uploadedDocs
          .map((u) => normalizeUploaded(u, progressByBookId.get(String(u._id || u.id))))
          .filter(Boolean)
      : [];
  }

  const unified = [...external, ...uploaded].sort((a, b) => {
    const aTime = a && a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b && b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  res.status(200).json({
    success: true,
    data: unified,
  });
});

/**
 * GET /books/:id
 * Returns book by id. If user is logged in, includes their progress.
 */
exports.getBook = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // 1) Try global/external Book first.
  const book = await Book.findById(id);
  if (book) {
    let progress = null;
    if (req.user) {
      progress = await ReadingProgress.findOne({
        user: req.user._id,
        book: id,
      });
    }
    const data = mergeBookWithProgress(book, progress);
    return res.status(200).json({
      status: 'success',
      data: { book: data },
    });
  }

  // 2) Fallback: Uploaded PDF books live in UploadedBook and are user-owned.
  // This keeps the existing API shape intact for the reader page, without changing routes.
  if (!req.user?._id) {
    return next(new AppError('Book not found.', 404));
  }

  const uploaded = await UploadedBook.findById(id);
  if (!uploaded) {
    return next(new AppError('Book not found.', 404));
  }
  if (String(uploaded.user) !== String(req.user._id)) {
    return next(new AppError('You do not have access to this book.', 403));
  }

  // Normalize to the same "book" envelope used by the frontend.
  const uploadedObj = uploaded.toObject ? uploaded.toObject() : { ...uploaded };
  const normalizedUploaded = {
    ...uploadedObj,
    id: uploadedObj._id || uploadedObj.id,
    pages: uploadedObj.totalPages ?? uploadedObj.pages ?? 0,
    pdfUrl: uploadedObj.fileUrl,
    fileUrl: uploadedObj.fileUrl,
    type: 'uploaded',
  };

  return res.status(200).json({
    status: 'success',
    data: { book: normalizedUploaded },
  });
});

/**
 * POST /books (protected)
 * Creates a new book (metadata) and the user's reading progress (from body).
 */
exports.createBook = catchAsync(async (req, res, next) => {
  const meta = normalizeBookMeta(req.body);
  const progressInput = pick(req.body, PROGRESS_FIELDS);
  const book = await Book.create(meta);
  const progress = await ReadingProgress.create({
    user: req.user._id,
    book: book._id,
    ...progressInput,
  });
  const data = mergeBookWithProgress(book, progress);
  res.status(201).json({
    status: 'success',
    data: { book: data },
  });
});

/**
 * PUT /books/:id (protected)
 * Updates book metadata and upserts the user's reading progress.
 */
exports.updateBook = catchAsync(async (req, res, next) => {
  const bookId = req.params.id;
  const book = await Book.findById(bookId);
  if (!book) {
    return next(new AppError('Book not found.', 404));
  }
  const meta = normalizeBookMeta(req.body);
  const progressInput = pick(req.body, PROGRESS_FIELDS);
  if (Object.keys(meta).length > 0) {
    await Book.findByIdAndUpdate(bookId, meta, {
      new: true,
      runValidators: true,
    });
  }
  const progress = await ReadingProgress.findOneAndUpdate(
    { user: req.user._id, book: bookId },
    progressInput,
    { upsert: true, new: true, runValidators: true }
  );
  const updatedBook = await Book.findById(bookId);
  const data = mergeBookWithProgress(updatedBook, progress);
  res.status(200).json({
    status: 'success',
    data: { book: data },
  });
});

/**
 * DELETE /books/:id (protected)
 * Removes this book from the user's library (deletes ReadingProgress only).
 * Does not delete the Book document so other users are unaffected.
 */
exports.deleteBook = catchAsync(async (req, res, next) => {
  const deleted = await ReadingProgress.findOneAndDelete({
    user: req.user._id,
    book: req.params.id,
  });
  if (!deleted) {
    return next(new AppError('Book not found in your library.', 404));
  }
  res.status(200).json({
    status: 'success',
    message: 'Book deleted successfully.',
  });
});

/**
 * POST /books/:id/add-to-library (protected)
 * Adds an existing global book to the user's library by creating ReadingProgress only.
 * Does not create a new Book document (no duplicates).
 */
exports.addToLibrary = catchAsync(async (req, res, next) => {
  const bookId = req.params.id;
  const book = await Book.findById(bookId);
  if (!book) {
    return next(new AppError('Book not found.', 404));
  }
  const progressInput = pick(req.body, PROGRESS_FIELDS);
  const progress = await ReadingProgress.findOneAndUpdate(
    { user: req.user._id, book: bookId },
    {
      ...progressInput,
      currentPage: progressInput.currentPage ?? 0,
      status: progressInput.status || 'reading',
    },
    { upsert: true, new: true, runValidators: true }
  );
  const data = mergeBookWithProgress(book, progress);
  res.status(201).json({
    status: 'success',
    data: { book: data },
  });
});

/**
 * POST /books/add-external (protected)
 * Creates a Book from external metadata and attaches it to the user's library.
 * Prevents duplicates per user based on (externalSource, externalId).
 */
exports.addExternalBook = catchAsync(async (req, res, next) => {
  const userId = req.user && req.user._id;
  if (!userId) {
    return next(
      new AppError('You are not logged in. Please log in to add books to your library.', 401)
    );
  }

  const rawId = req.body && req.body.id;
  const rawSource = req.body && req.body.source;

  const externalId =
    typeof rawId === 'string' ? rawId.trim() : rawId != null ? String(rawId).trim() : '';
  const externalSource =
    typeof rawSource === 'string' ? rawSource.trim() : rawSource != null ? String(rawSource).trim() : '';

  if (!externalId || !externalSource) {
    return next(new AppError('Missing external book identifier.', 400));
  }

  if (!['google', 'open-library'].includes(externalSource)) {
    return next(new AppError('Unsupported book source.', 400));
  }

  const existing = await ReadingProgress.findOne({
    user: userId,
    externalId,
    externalSource,
  }).select('_id');

  if (existing) {
    return res.status(409).json({
      success: false,
      message: 'Book already in library',
    });
  }

  const title =
    typeof req.body.title === 'string' && req.body.title.trim().length > 0
      ? req.body.title.trim()
      : 'Untitled';

  let author = '';
  if (Array.isArray(req.body.authors) && req.body.authors.length > 0) {
    author = req.body.authors.filter(Boolean).join(', ');
  } else if (typeof req.body.author === 'string') {
    author = req.body.author;
  }
  author = author && author.trim().length > 0 ? author.trim() : 'Unknown';

  const pages =
    typeof req.body.pageCount === 'number' && Number.isFinite(req.body.pageCount)
      ? req.body.pageCount
      : 0;

  const cover =
    typeof req.body.thumbnail === 'string' && req.body.thumbnail.trim().length > 0
      ? req.body.thumbnail.trim()
      : '';

  const description =
    typeof req.body.description === 'string' ? req.body.description : '';

  const book = await Book.create({
    title,
    author,
    pages,
    cover,
    description,
  });

  const progress = await ReadingProgress.create({
    user: userId,
    book: book._id,
    externalId,
    externalSource,
    currentPage: 0,
    status: 'reading',
  });

  const data = mergeBookWithProgress(book, progress);

  res.status(201).json({
    status: 'success',
    data: { book: data },
  });
});

/**
 * GET /books/user-external-ids (protected)
 * Returns the set of external keys already in the user's library.
 * Format: `${source}:${id}` – does not expose internal database identifiers.
 */
exports.getUserExternalIds = asyncHandler(async (req, res, next) => {
  const userId = req.user && req.user._id;
  if (!userId) {
    return next(
      new AppError('You are not logged in. Please log in to access your library.', 401)
    );
  }

  // ReadingProgress is the source of truth for external books.
  // Do not query UploadedBookReadingProgress here.
  const progresses = await ReadingProgress.find({
    user: userId,
    externalId: { $exists: true, $nin: [null, ''] },
    $or: [
      { externalSource: { $exists: true, $nin: [null, ''] } },
      // Backwards-compat if older docs used `source`.
      { source: { $exists: true, $nin: [null, ''] } },
    ],
  })
    .select('externalId externalSource source')
    .lean();

  const keys = (Array.isArray(progresses) ? progresses : [])
    .map((p) => {
      const rawExternalId = p && p.externalId;
      const rawSource = p && (p.externalSource ?? p.source);

      const externalId =
        typeof rawExternalId === 'string'
          ? rawExternalId.trim()
          : rawExternalId != null
            ? String(rawExternalId).trim()
            : '';

      const source =
        typeof rawSource === 'string'
          ? rawSource.trim()
          : rawSource != null
            ? String(rawSource).trim()
            : '';

      // Ensure both fields exist before mapping.
      if (!externalId || !source) return null;
      return `${source}:${externalId}`;
    })
    .filter(Boolean);

  res.status(200).json({
    status: 'success',
    data: { keys: Array.isArray(keys) ? keys : [] },
  });
});

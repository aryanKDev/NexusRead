const mongoose = require('mongoose');
const {
  ReadingProgress,
  UploadedBookReadingProgress,
  UploadedBookReadingSession,
  ReadingSession,
  Goal,
  Book,
  Highlight,
} = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');

const toObjectId = (value) =>
  typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;

const getMonthRange = (date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
};

const getYearRange = (year) => {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  return { start, end };
};

const getStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Normalize a Date to a YYYY-MM-DD key using UTC components.
 * Must match MongoDB's $dateToString '%Y-%m-%d' output (which uses UTC).
 */
const normalizeDateKey = (d) => {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDashboardStats = catchAsync(async (req, res, next) => {
  if (!req.user?._id) {
    return next(new AppError('Unauthorized', 401));
  }

  const userId = toObjectId(req.user._id);
  const now = new Date();
  const { start: monthStart, end: monthEnd } = getMonthRange(now);

  const [
    progressAgg,
    uploadedProgressAgg,
    sessionAgg,
    uploadedSessionAgg,
  ] = await Promise.all([
    ReadingProgress.aggregate([
      { $match: { user: userId } },
      {
        $lookup: {
          from: 'books',
          localField: 'book',
          foreignField: '_id',
          as: 'book',
        },
      },
      { $unwind: '$book' },
      {
        $group: {
          _id: null,
          completedBooks: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
            },
          },
          currentlyReading: {
            $sum: {
              $cond: [{ $eq: ['$status', 'reading'] }, 1, 0],
            },
          },
          pagesFromCompleted: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, '$book.pages', 0],
            },
          },
          pagesFromInProgress: {
            $sum: {
              $cond: [{ $ne: ['$status', 'completed'] }, '$currentPage', 0],
            },
          },
          booksCompletedThisMonth: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'completed'] },
                    { $gte: ['$endDate', monthStart] },
                    { $lt: ['$endDate', monthEnd] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          avgRating: { $avg: '$rating' },
        },
      },
    ]),
    UploadedBookReadingProgress.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          completedBooks: {
            $sum: {
              $cond: [{ $gte: ['$percentage', 100] }, 1, 0],
            },
          },
          pagesRead: { $sum: '$currentPage' },
          booksCompletedThisMonth: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$updatedAt', monthStart] },
                    { $lt: ['$updatedAt', monthEnd] },
                    { $gte: ['$percentage', 100] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    ReadingSession.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          totalDuration: { $sum: '$duration' },
        },
      },
    ]),
    UploadedBookReadingSession.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          totalDurationSeconds: { $sum: '$durationInSeconds' },
        },
      },
    ]),
  ]);

  const p = progressAgg[0] || {};
  const up = uploadedProgressAgg[0] || {};
  const s = sessionAgg[0] || {};
  const us = uploadedSessionAgg[0] || {};

  const totalBooksRead = (p.completedBooks || 0) + (up.completedBooks || 0);
  const pagesRead =
    (p.pagesFromCompleted || 0) +
    (p.pagesFromInProgress || 0) +
    (up.pagesRead || 0);
  const currentlyReadingCount = p.currentlyReading || 0;
  const booksCompletedThisMonth =
    (p.booksCompletedThisMonth || 0) + (up.booksCompletedThisMonth || 0);

  const totalMinutesFromReadingSession = s.totalDuration || 0;
  const totalMinutesFromUploaded =
    us.totalDurationSeconds != null ? us.totalDurationSeconds / 60 : 0;
  const totalReadingMinutes = Math.round(
    totalMinutesFromReadingSession + totalMinutesFromUploaded
  );

  const averageRating =
    typeof p.avgRating === 'number' ? Number(p.avgRating.toFixed(2)) : null;

  return sendSuccess(res, {
    data: {
      totalBooksRead,
      pagesRead,
      currentlyReadingCount,
      booksCompletedThisMonth,
      totalReadingMinutes,
      averageRating,
    },
  });
});

const getStreak = catchAsync(async (req, res, next) => {
  if (!req.user?._id) {
    return next(new AppError('Unauthorized', 401));
  }

  const userId = toObjectId(req.user._id);
  const today = getStartOfDay(new Date());
  // Use the start of TOMORROW as the upper bound so that sessions created
  // at any time during today (after midnight) are included in the streak.
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const oneYearAgo = new Date(today);
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);

  const [readingSessions, uploadedSessions] = await Promise.all([
    ReadingSession.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: oneYearAgo, $lt: tomorrow },
        },
      },
      {
        $project: {
          dateKey: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' },
          },
        },
      },
      {
        $group: {
          _id: '$dateKey',
        },
      },
    ]),
    UploadedBookReadingSession.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: oneYearAgo, $lt: tomorrow },
        },
      },
      {
        $project: {
          dateKey: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' },
          },
        },
      },
      {
        $group: {
          _id: '$dateKey',
        },
      },
    ]),
  ]);

  const activeDates = new Set([
    ...readingSessions.map((d) => d._id),
    ...uploadedSessions.map((d) => d._id),
  ]);

  const hasActivity = (dateObj) =>
    activeDates.has(normalizeDateKey(dateObj));

  let currentStreak = 0;
  // Use UTC midnight for cursor to match MongoDB $dateToString UTC output
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0); // UTC midnight today
  const cursorCopy = new Date(cursor);
  while (currentStreak < 400 && hasActivity(cursorCopy)) {
    currentStreak += 1;
    cursorCopy.setUTCDate(cursorCopy.getUTCDate() - 1);
  }

  const sortedDates = Array.from(activeDates)
    .map((d) => new Date(d))
    .sort((a, b) => a - b);

  let longestStreak = 0;
  let streak = 0;
  let prev = null;

  for (const d of sortedDates) {
    if (!prev) {
      streak = 1;
    } else {
      // Both d and prev are UTC date strings (YYYY-MM-DD); parse them as UTC midnight
      const diffDays = Math.round(
        (new Date(d) - new Date(prev)) / (1000 * 60 * 60 * 24)
      );
      if (diffDays === 1) {
        streak += 1;
      } else if (diffDays > 1) {
        streak = 1;
      }
    }
    if (streak > longestStreak) longestStreak = streak;
    prev = d;
  }

  const thisWeek = [];
  const dayOfWeekToday = today.getDay(); // 0 (Sun) - 6 (Sat)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeekToday);

  for (let i = 0; i < 7; i += 1) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    thisWeek.push(hasActivity(d));
  }

  return sendSuccess(res, {
    data: {
      current: currentStreak,
      longest: longestStreak,
      thisWeek,
    },
  });
});

const getActivity = catchAsync(async (req, res, next) => {
  if (!req.user?._id) {
    return next(new AppError('Unauthorized', 401));
  }

  const userId = toObjectId(req.user._id);
  const now = new Date();

  const startOfRange = new Date(now);
  startOfRange.setMonth(startOfRange.getMonth() - 11);
  startOfRange.setDate(1);
  startOfRange.setHours(0, 0, 0, 0);

  const oneYearAgo = new Date(now);
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);

  const [
    readingMonthly,
    uploadedMonthly,
    completedMonthly,
    uploadedCompletedMonthly,
    readingDaily,
    uploadedDaily,
    readingHourly,
    uploadedHourly,
  ] = await Promise.all([
    ReadingSession.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: startOfRange, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
          },
          sessionsCount: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
        },
      },
    ]),
    UploadedBookReadingSession.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: startOfRange, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
          },
          sessionsCount: { $sum: 1 },
          totalDurationSeconds: { $sum: '$durationInSeconds' },
        },
      },
    ]),
    ReadingProgress.aggregate([
      {
        $match: {
          user: userId,
          status: 'completed',
          endDate: { $gte: startOfRange, $lte: now },
        },
      },
      {
        $lookup: {
          from: 'books',
          localField: 'book',
          foreignField: '_id',
          as: 'book',
        },
      },
      { $unwind: '$book' },
      {
        $group: {
          _id: {
            year: { $year: '$endDate' },
            month: { $month: '$endDate' },
          },
          booksCompleted: { $sum: 1 },
          pagesRead: { $sum: '$book.pages' },
        },
      },
    ]),
    UploadedBookReadingProgress.aggregate([
      {
        $match: {
          user: userId,
          percentage: { $gte: 100 },
          updatedAt: { $gte: startOfRange, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$updatedAt' },
            month: { $month: '$updatedAt' },
          },
          booksCompleted: { $sum: 1 },
          pagesRead: { $sum: '$currentPage' },
        },
      },
    ]),
    ReadingSession.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: oneYearAgo, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            dateKey: {
              $dateToString: { format: '%Y-%m-%d', date: '$date' },
            },
          },
          totalDuration: { $sum: '$duration' },
        },
      },
    ]),
    UploadedBookReadingSession.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: oneYearAgo, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            dateKey: {
              $dateToString: { format: '%Y-%m-%d', date: '$date' },
            },
          },
          totalDurationSeconds: { $sum: '$durationInSeconds' },
        },
      },
    ]),
    // Hourly breakdown — uses actual $dayOfWeek and $hour from session timestamps.
    // dayOfWeek: 1=Sun, 2=Mon, …, 7=Sat (MongoDB convention).
    ReadingSession.aggregate([
      { $match: { user: userId, date: { $gte: oneYearAgo, $lte: now } } },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: '$date' },
            hour: { $hour: '$date' },
          },
          totalDuration: { $sum: '$duration' },
        },
      },
    ]),
    UploadedBookReadingSession.aggregate([
      { $match: { user: userId, date: { $gte: oneYearAgo, $lte: now } } },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: '$date' },
            hour: { $hour: '$date' },
          },
          totalDurationSeconds: { $sum: '$durationInSeconds' },
        },
      },
    ]),
  ]);

  const monthlyMap = new Map();
  const hourlyMap = new Map();

  // MongoDB $dayOfWeek: 1=Sun … 7=Sat. Map to the day names used by the heatmap.
  const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // index 0=Sun

  const upsertMonthly = (arr, isUploaded, fieldDurationName) => {
    arr.forEach((item) => {
      const { year, month } = item._id;
      const key = `${year}-${month}`;
      const existing = monthlyMap.get(key) || {
        year,
        month,
        booksCompleted: 0,
        pagesRead: 0,
        sessionsCount: 0,
        minutesRead: 0,
      };
      if ('sessionsCount' in item) {
        existing.sessionsCount += item.sessionsCount || 0;
      }
      if (fieldDurationName && item[fieldDurationName] != null) {
        const minutes =
          fieldDurationName === 'totalDurationSeconds'
            ? item[fieldDurationName] / 60
            : item[fieldDurationName];
        existing.minutesRead += minutes || 0;
      }
      if ('booksCompleted' in item) {
        existing.booksCompleted += item.booksCompleted || 0;
      }
      if ('pagesRead' in item) {
        existing.pagesRead += item.pagesRead || 0;
      }
      monthlyMap.set(key, existing);
    });
  };

  upsertMonthly(readingMonthly, false, 'totalDuration');
  upsertMonthly(uploadedMonthly, true, 'totalDurationSeconds');
  upsertMonthly(completedMonthly, false);
  upsertMonthly(uploadedCompletedMonthly, true);

  const monthlyActivity = [];
  const cursor = new Date(startOfRange);
  for (let i = 0; i < 12; i += 1) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const key = `${year}-${month}`;
    const base = monthlyMap.get(key) || {
      year,
      month,
      booksCompleted: 0,
      pagesRead: 0,
      sessionsCount: 0,
      minutesRead: 0,
    };
    monthlyActivity.push({
      ...base,
      minutesRead: Math.round(base.minutesRead),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const dailyMap = new Map();

  const upsertDaily = (arr, fieldDurationName) => {
    arr.forEach((item) => {
      const dateKey = item._id.dateKey;
      const existing = dailyMap.get(dateKey) || { date: dateKey, minutesRead: 0 };
      if (fieldDurationName && item[fieldDurationName] != null) {
        const minutes =
          fieldDurationName === 'totalDurationSeconds'
            ? item[fieldDurationName] / 60
            : item[fieldDurationName];
        existing.minutesRead += minutes || 0;
      }
      dailyMap.set(dateKey, existing);
    });
  };

  upsertDaily(readingDaily, 'totalDuration');
  upsertDaily(uploadedDaily, 'totalDurationSeconds');

  const dailyActivity = Array.from(dailyMap.values()).map((d) => ({
    date: d.date,
    minutesRead: Math.round(d.minutesRead),
  }));

  dailyActivity.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // ── Hourly activity — real reading timestamps ──────────────────────────────
  // MongoDB $dayOfWeek returns 1=Sunday … 7=Saturday (UTC-based).
  // We map to day name strings matching the frontend heatmap: Sun/Mon/…/Sat.
  // count = total minutes read in that day×hour bucket over the past year.
  const upsertHourly = (arr, fieldDurationName) => {
    (Array.isArray(arr) ? arr : []).forEach((item) => {
      const dow = item._id?.dayOfWeek;   // 1=Sun … 7=Sat
      const hr  = item._id?.hour;        // 0–23 (UTC)
      if (dow == null || hr == null) return;
      const dayName = DOW_NAMES[dow - 1]; // DOW_NAMES[0]=Sun … DOW_NAMES[6]=Sat
      const key = `${dayName}:${hr}`;
      const existing = hourlyMap.get(key) || { day: dayName, hour: hr, count: 0 };
      const rawVal = item[fieldDurationName];
      if (rawVal != null) {
        const minutes =
          fieldDurationName === 'totalDurationSeconds' ? rawVal / 60 : rawVal;
        existing.count += minutes || 0;
      }
      hourlyMap.set(key, existing);
    });
  };

  upsertHourly(readingHourly, 'totalDuration');
  upsertHourly(uploadedHourly, 'totalDurationSeconds');

  const hourlyActivity = Array.from(hourlyMap.values()).map((h) => ({
    day: h.day,
    hour: h.hour,
    count: Math.round(h.count),
  }));

  return sendSuccess(res, {
    data: {
      monthlyActivity,
      dailyActivity,
      // hourlyActivity: real reading-time distribution by day-of-week and hour (UTC).
      // count = cumulative minutes read in that bucket over the past year.
      // Empty for users with no ReadingSession records.
      hourlyActivity,
    },
  });
});

const getRecommendations = catchAsync(async (req, res, next) => {
  if (!req.user?._id) {
    return next(new AppError('Unauthorized', 401));
  }

  const userId = toObjectId(req.user._id);

  const progress = await ReadingProgress.find({ user: userId })
    .populate('book')
    .sort({ updatedAt: -1 })
    .limit(50);

  const genreCounts = new Map();
  const authorCounts = new Map();
  const recentBookIds = new Set();

  progress.forEach((p) => {
    const book = p.book;
    if (!book) return;
    recentBookIds.add(String(book._id));

    const genres = Array.isArray(book.genre) ? book.genre : [];
    genres.forEach((g) => {
      const key = String(g).trim();
      if (!key) return;
      genreCounts.set(key, (genreCounts.get(key) || 0) + 1);
    });

    const author = String(book.author || '').trim();
    if (author) {
      authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
    }
  });

  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([g]) => g);

  const topAuthors = Array.from(authorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([a]) => a);

  if (!topGenres.length && !topAuthors.length) {
    const fallback = await Book.find().sort({ createdAt: -1 }).limit(10);
    const suggestions = fallback.map((b, index) => ({
      id: b._id,
      title: b.title,
      author: b.author,
      genres: Array.isArray(b.genre) ? b.genre : [],
      pages: Number(b.pages) || 0,
      match: 50 - index * 3,
    }));

    return sendSuccess(res, { data: { suggestions } });
  }

  const candidates = await Book.find({
    $or: [
      { genre: { $in: topGenres } },
      { author: { $in: topAuthors } },
      { _id: { $in: Array.from(recentBookIds) } },
    ],
  }).limit(40);

  const scored = candidates.map((b) => {
    const genres = Array.isArray(b.genre) ? b.genre : [];
    const author = String(b.author || '').trim();

    let score = 0;
    if (author && topAuthors.includes(author)) {
      score += 40;
    }
    const matchingGenres = genres.filter((g) => topGenres.includes(g));
    score += matchingGenres.length * 15;
    if (recentBookIds.has(String(b._id))) {
      score += 20;
    }
    return {
      id: b._id,
      title: b.title,
      author: b.author,
      genres,
      pages: Number(b.pages) || 0,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const normalized = scored.slice(0, 10).map((s, index) => ({
    id: s.id,
    title: s.title,
    author: s.author,
    genres: s.genres,
    pages: Number(s.pages) || 0,
    match: Math.max(60, Math.min(95, s.score || 0)) - index * 2,
  }));

  return sendSuccess(res, {
    data: {
      suggestions: normalized,
    },
  });
});

const countCompletedBooksForYear = async (userId, year) => {
  const { start, end } = getYearRange(year);

  const [readingAgg, uploadedAgg] = await Promise.all([
    ReadingProgress.aggregate([
      {
        $match: {
          user: userId,
          status: 'completed',
          endDate: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
        },
      },
    ]),
    UploadedBookReadingProgress.aggregate([
      {
        $match: {
          user: userId,
          percentage: { $gte: 100 },
          updatedAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const r = readingAgg[0]?.count || 0;
  const u = uploadedAgg[0]?.count || 0;
  return r + u;
};

const getGoalsSummary = catchAsync(async (req, res, next) => {
  if (!req.user?._id) {
    return next(new AppError('Unauthorized', 401));
  }

  const userId = toObjectId(req.user._id);
  const yearParam = Number(req.query.year) || new Date().getFullYear();

  const [goal, completedBooks] = await Promise.all([
    Goal.findOne({ user: userId, year: yearParam }),
    countCompletedBooksForYear(userId, yearParam),
  ]);

  const targetBooks = goal?.targetBooks || 0;
  const safeCompleted = completedBooks;
  const progress =
    targetBooks > 0 ? Math.min(100, Math.round((safeCompleted / targetBooks) * 100)) : 0;

  if (goal && goal.completedBooks !== safeCompleted) {
    goal.completedBooks = safeCompleted;
    await goal.save();
  }

  return sendSuccess(res, {
    data: {
      year: yearParam,
      targetBooks,
      completedBooks: safeCompleted,
      progress,
    },
  });
});

const upsertGoal = catchAsync(async (req, res, next) => {
  if (!req.user?._id) {
    return next(new AppError('Unauthorized', 401));
  }

  const userId = toObjectId(req.user._id);
  const year = Number(req.body.year) || new Date().getFullYear();
  const targetBooks = Number(req.body.targetBooks);

  if (!Number.isInteger(targetBooks) || targetBooks <= 0) {
    return next(
      new AppError('targetBooks must be a positive integer.', 400)
    );
  }

  const completedBooks = await countCompletedBooksForYear(userId, year);

  const goal = await Goal.findOneAndUpdate(
    { user: userId, year },
    {
      $set: {
        targetBooks,
        completedBooks,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    }
  );

  const progress = Math.min(
    100,
    Math.round((completedBooks / targetBooks) * 100)
  );

  return sendSuccess(res, {
    data: {
      year: goal.year,
      targetBooks: goal.targetBooks,
      completedBooks: goal.completedBooks,
      progress,
    },
    statusCode: 201,
  });
});

function safeDate(value) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function toFeedItem({ type, date, title, meta }) {
  const d = safeDate(date) || new Date();
  return {
    type,
    date: d.toISOString(),
    title: typeof title === 'string' ? title : '',
    meta: meta && typeof meta === 'object' ? meta : {},
  };
}

const getReadingActivityFeed = catchAsync(async (req, res, next) => {
  if (!req.user?._id) {
    return next(new AppError('Unauthorized', 401));
  }

  const userId = toObjectId(req.user._id);
  const limit = Math.min(50, Math.max(10, Number(req.query.limit) || 20));

  const [progress, uploadedProgress, sessions, uploadedSessions, highlights] =
    await Promise.all([
      ReadingProgress.find({ user: userId })
        .populate('book', 'title pages')
        .sort({ lastReadAt: -1, updatedAt: -1 })
        .limit(25)
        .lean(),
      UploadedBookReadingProgress.find({ user: userId })
        .populate('book', 'title')
        .sort({ lastReadAt: -1, updatedAt: -1 })
        .limit(25)
        .lean(),
      ReadingSession.find({ user: userId })
        .populate('book', 'title')
        .sort({ date: -1, createdAt: -1 })
        .limit(25)
        .lean(),
      UploadedBookReadingSession.find({ user: userId })
        .populate('book', 'title')
        .sort({ date: -1, createdAt: -1 })
        .limit(25)
        .lean(),
      Highlight.find({ user: userId })
        .populate('book', 'title')
        .sort({ createdAt: -1 })
        .limit(25)
        .lean(),
    ]);

  const items = [];

  (Array.isArray(progress) ? progress : []).forEach((p) => {
    const title = p?.book?.title || '';
    const status = p?.status;
    if (status === 'wishlist') {
      items.push(
        toFeedItem({
          type: 'wishlist',
          date: p.createdAt || p.updatedAt,
          title,
        })
      );
      return;
    }
    if (status === 'completed') {
      items.push(
        toFeedItem({
          type: 'completed',
          date: p.endDate || p.updatedAt,
          title,
        })
      );
      return;
    }
    if (Number(p.currentPage) > 0) {
      items.push(
        toFeedItem({
          type: 'progress',
          date: p.lastReadAt || p.updatedAt,
          title,
          meta: { currentPage: Number(p.currentPage) || 0 },
        })
      );
    } else {
      items.push(
        toFeedItem({
          type: 'started',
          date: p.startDate || p.createdAt || p.updatedAt,
          title,
        })
      );
    }
  });

  (Array.isArray(uploadedProgress) ? uploadedProgress : []).forEach((p) => {
    const title = p?.book?.title || '';
    const currentPage = Number(p.currentPage) || 1;
    const percentage = Number(p.percentage) || 0;
    if (percentage >= 100) {
      items.push(
        toFeedItem({
          type: 'completed',
          date: p.updatedAt || p.lastReadAt,
          title,
        })
      );
      return;
    }
    items.push(
      toFeedItem({
        type: 'progress',
        date: p.lastReadAt || p.updatedAt,
        title,
        meta: { currentPage },
      })
    );
  });

  (Array.isArray(sessions) ? sessions : []).forEach((s) => {
    const title = s?.book?.title || '';
    const minutes = Math.round(Number(s.duration) || 0);
    if (!minutes) return;
    items.push(
      toFeedItem({
        type: 'session',
        date: s.date || s.createdAt,
        title,
        meta: { minutes },
      })
    );
  });

  (Array.isArray(uploadedSessions) ? uploadedSessions : []).forEach((s) => {
    const title = s?.book?.title || '';
    const minutes = Math.round((Number(s.durationInSeconds) || 0) / 60);
    if (!minutes) return;
    items.push(
      toFeedItem({
        type: 'session',
        date: s.date || s.createdAt,
        title,
        meta: { minutes },
      })
    );
  });

  (Array.isArray(highlights) ? highlights : []).forEach((h) => {
    const title = h?.book?.title || '';
    items.push(
      toFeedItem({
        type: 'highlight',
        date: h.createdAt,
        title,
        meta: { page: Number(h.page) || 1 },
      })
    );
  });

  items.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));

  return sendSuccess(res, {
    data: {
      items: items.slice(0, limit),
    },
  });
});

module.exports = {
  getDashboardStats,
  getStreak,
  getActivity,
  getReadingActivityFeed,
  getRecommendations,
  getGoalsSummary,
  upsertGoal,
};


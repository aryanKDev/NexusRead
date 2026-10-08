const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { protect } = require('./middleware/auth');
const {
  sanitizeData,
  sanitizeXss,
} = require('./middleware/security');

const app = express();

// Trust reverse proxy (Render, Vercel, Nginx) for accurate client IP resolution & rate limiting
app.set('trust proxy', 1);

// Lightweight top-level health probe for container orchestrators and platform monitoring
app.get('/health', (req, res) => {
  const isDbConnected = require('mongoose').connection.readyState === 1;
  res.status(isDbConnected ? 200 : 503).json({
    status: isDbConnected ? 'ok' : 'degraded',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: isDbConnected ? 'connected' : 'disconnected',
  });
});

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Credential-based auth: strict, explicit origin allow-list.
// - Production: Vercel frontend + any extra origins from CORS_ORIGIN
// - Development: localhost ports for Vite/CRA
const frontendUrl =
  process.env.FRONTEND_URL ||
  process.env.CORS_ORIGIN?.split(',')[0]?.trim();
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  : [];
const defaultDevOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:3000',
];
const envOrigins = frontendUrl ? [frontendUrl, ...corsOrigins] : corsOrigins;
const allowedOrigins = [...new Set([...envOrigins, ...defaultDevOrigins])];

// Expose allowed origins for debugging (/health) without leaking secrets.
app.locals.corsAllowedOrigins = allowedOrigins;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (e.g., Postman) that send no Origin header.
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Explicitly reject unknown origins. No CORS headers will be sent.
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(sanitizeData());
app.use(sanitizeXss());

// Serve PDF files inline with ownership verification.
// Prevents IDOR: each request is checked against the UploadedBook owner.
// The UploadedBook.publicId stores the filename (e.g. "60f9...abc.pdf").
const UploadedBook = require('./models/UploadedBook');
app.get(
  '/api/v1/pdfs/:filename',
  protect,
  (req, res, next) => {
    const { filename } = req.params;

    // Reject path traversal attempts before DB lookup.
    if (!filename || /[/\\]/.test(filename) || filename.includes('..')) {
      return res.status(400).json({ status: 'fail', message: 'Invalid filename.' });
    }

    UploadedBook.findOne({ publicId: filename })
      .then((book) => {
        // No record → either the file never existed or was deleted.
        // Return 404 rather than 403 to avoid confirming which files exist.
        if (!book) {
          return res.status(404).json({ status: 'fail', message: 'File not found.' });
        }

        // Ownership check: the requesting user must own the book.
        if (book.user.toString() !== req.user._id.toString()) {
          return res.status(403).json({ status: 'fail', message: 'Access denied.' });
        }

        // Ownership confirmed — serve the file.
        const filePath = path.join(__dirname, '..', 'public', 'pdfs', filename);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        res.sendFile(filePath, (err) => {
          if (err) {
            if (!res.headersSent) {
              res.status(404).json({ status: 'fail', message: 'File not found.' });
            }
          }
        });
      })
      .catch(next);
  }
);

// ── Global rate limiter ─────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production';

const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isProduction ? 200 : 2000,
  message: {
    status: 'error',
    message: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for AI endpoints (expensive Gemini API calls)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 15 : 200,
  message: {
    status: 'error',
    message: 'Too many AI requests. Please wait a moment.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/v1', globalLimiter);
app.use('/api/v1/ai', aiLimiter);

app.use('/api/v1', routes);

app.all('*', (req, res, next) => {
  const err = new (require('./utils/AppError'))(
    `Cannot find ${req.originalUrl} on this server`,
    404
  );
  next(err);
});

app.use(errorHandler);

module.exports = app;

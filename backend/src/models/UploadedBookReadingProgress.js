const mongoose = require('mongoose');

// Sub-schemas mirror those in ReadingProgress so the reader API
// can use the same payload shape for both book types.
const bookmarkSchema = new mongoose.Schema({
  page: { type: Number, required: true },
  label: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

const highlightSchema = new mongoose.Schema({
  text: { type: String, required: true },
  page: { type: Number, required: true },
  colorId: { type: String, default: 'yellow' },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

const noteSchema = new mongoose.Schema({
  content: { type: String, required: true },
  page: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const uploadedBookReadingProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UploadedBook',
      required: true,
    },
    currentPage: {
      type: Number,
      default: 1,
    },
    totalPages: {
      type: Number,
      default: 1,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },

    // ── Reader annotations ─────────────────────────────────────────────────
    bookmarks: { type: [bookmarkSchema], default: [] },
    userHighlights: { type: [highlightSchema], default: [] },
    notes: { type: [noteSchema], default: [] },
  },
  {
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

uploadedBookReadingProgressSchema.index(
  { user: 1, book: 1 },
  { unique: true }
);

uploadedBookReadingProgressSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const UploadedBookReadingProgress = mongoose.model(
  'UploadedBookReadingProgress',
  uploadedBookReadingProgressSchema
);
module.exports = UploadedBookReadingProgress;


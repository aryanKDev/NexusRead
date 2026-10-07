/**
 * Test entity factories.
 * All factories produce deterministic, minimal valid objects.
 * No real credentials, no external network calls.
 */
const mongoose = require('mongoose');
const { User, Book, UploadedBook, ReadingProgress, Note, ReadingSession } = require('../../src/models');

let _userSeq = 0;

/**
 * Create a real User in the test DB. Password is hashed by pre-save hook.
 */
const createUser = async (overrides = {}) => {
  _userSeq += 1;
  return User.create({
    name: `Test User ${_userSeq}`,
    email: `test${_userSeq}@nexusread.test`,
    password: 'Password123!',
    ...overrides,
  });
};

/**
 * Create an admin user.
 */
const createAdmin = async (overrides = {}) => {
  return createUser({ role: 'admin', ...overrides });
};

/**
 * Create a catalog Book in the test DB.
 */
const createBook = async (overrides = {}) => {
  return Book.create({
    title: 'Test Book Title',
    author: 'Test Author',
    pages: 200,
    cover: '',
    genre: ['Fiction'],
    description: 'A test book for automated tests.',
    ...overrides,
  });
};

/**
 * Create an UploadedBook belonging to a user.
 */
const createUploadedBook = async (userId, overrides = {}) => {
  return UploadedBook.create({
    user: userId,
    title: 'My Uploaded PDF',
    fileUrl: 'http://localhost:5000/api/v1/pdfs/testfile.pdf',
    publicId: 'testfile.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    ...overrides,
  });
};

/**
 * Create a ReadingProgress document for a user and catalog book.
 */
const createReadingProgress = async (userId, bookId, overrides = {}) => {
  return ReadingProgress.create({
    user: userId,
    book: bookId,
    currentPage: 1,
    status: 'reading',
    percentage: 0,
    ...overrides,
  });
};

/**
 * Create a Note.
 */
const createNote = async (userId, bookId, overrides = {}) => {
  return Note.create({
    user: userId,
    book: bookId,
    content: 'This is a test note.',
    page: 1,
    ...overrides,
  });
};

/**
 * Create a ReadingSession.
 */
const createReadingSession = async (userId, bookId, overrides = {}) => {
  return ReadingSession.create({
    user: userId,
    book: bookId,
    duration: 30,
    date: new Date(),
    ...overrides,
  });
};

module.exports = {
  createUser,
  createAdmin,
  createBook,
  createUploadedBook,
  createReadingProgress,
  createNote,
  createReadingSession,
};

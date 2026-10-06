/**
 * MongoDB Index Setup Script
 *
 * Run once in production to add indexes on frequently-queried collections.
 * Usage: node scripts/add-indexes.js
 *
 * Requires MONGODB_URI environment variable (or falls back to .env).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const INDEXES = [
  // ReadingProgress — most-queried collection
  {
    collection: 'readingprogresses',
    indexes: [
      { fields: { user: 1, book: 1 }, options: { unique: true, name: 'user_book_unique' } },
      { fields: { user: 1, status: 1 }, options: { name: 'user_status' } },
      { fields: { user: 1, updatedAt: -1 }, options: { name: 'user_recent' } },
    ],
  },
  // ReadingSession — used in analytics aggregation
  {
    collection: 'readingsessions',
    indexes: [
      { fields: { user: 1, date: -1 }, options: { name: 'user_date_desc' } },
    ],
  },
  // UploadedBookReadingSession
  {
    collection: 'uploadedbookreadingsessions',
    indexes: [
      { fields: { user: 1, date: -1 }, options: { name: 'user_date_desc' } },
    ],
  },
  // UploadedBookReadingProgress
  {
    collection: 'uploadedbookreadingprogresses',
    indexes: [
      { fields: { user: 1 }, options: { name: 'user_idx' } },
    ],
  },
  // Book — search and genre filtering
  {
    collection: 'books',
    indexes: [
      { fields: { genre: 1 }, options: { name: 'genre_idx' } },
      { fields: { title: 'text', author: 'text' }, options: { name: 'text_search' } },
      { fields: { createdAt: -1 }, options: { name: 'created_desc' } },
    ],
  },
  // RefreshToken — lookup by token and cleanup
  {
    collection: 'refreshtokens',
    indexes: [
      { fields: { user: 1 }, options: { name: 'user_idx' } },
      { fields: { expiresAt: 1 }, options: { expireAfterSeconds: 0, name: 'ttl_cleanup' } },
    ],
  },
  // Highlight
  {
    collection: 'highlights',
    indexes: [
      { fields: { user: 1, book: 1 }, options: { name: 'user_book' } },
    ],
  },
  // Goal
  {
    collection: 'goals',
    indexes: [
      { fields: { user: 1, year: 1 }, options: { unique: true, name: 'user_year_unique' } },
    ],
  },
];

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI / MONGO_URI not set. Please configure your .env file.');
    process.exit(1);
  }

  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log('✅ Connected\n');

  for (const { collection, indexes } of INDEXES) {
    console.log(`📦 ${collection}`);
    for (const { fields, options } of indexes) {
      try {
        await db.collection(collection).createIndex(fields, options);
        console.log(`   ✅ ${options.name || JSON.stringify(fields)}`);
      } catch (err) {
        console.log(`   ⚠️  ${options.name}: ${err.message}`);
      }
    }
  }

  console.log('\n🎉 Done! All indexes created.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Script failed:', err.message);
  process.exit(1);
});

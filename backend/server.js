require('dotenv').config();

// Validate Cloudinary config on startup (throws if env missing)
require('./config/cloudinary');

const app = require('./src/app');
const connectDB = require('./src/config/db');

connectDB();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

const gracefulShutdown = (signal) => {
  console.log(`${signal} received. Initiating graceful shutdown...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      const mongoose = require('mongoose');
      await mongoose.connection.close(false);
      console.log('MongoDB connection closed.');
      process.exit(0);
    } catch (err) {
      console.error('Error closing MongoDB connection:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('Forcefully terminating process after shutdown timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! Shutting down...', err);
  gracefulShutdown('UNHANDLED_REJECTION');
});

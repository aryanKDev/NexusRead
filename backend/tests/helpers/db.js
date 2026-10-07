/**
 * Isolated in-memory MongoDB test database helper.
 *
 * Uses mongodb-memory-server so tests NEVER touch a real developer database.
 * Lifecycle:
 *   connect()  – start MongoMemoryServer and connect Mongoose
 *   clear()    – drop all collections (call in beforeEach)
 *   close()    – stop server and disconnect (call in afterAll)
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod = null;

const connect = async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
};

const close = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
};

const clear = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

module.exports = { connect, close, clear };

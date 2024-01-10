const mongoose = require('mongoose');

const uri = process.env.MONGODB_URL;
const { log, error } = console;
let connection;
const connect = () => {
  if (connection) return connection;
  log('connecting to db...');
  try {
    connection = mongoose.createConnection(uri, {
      useNewUrlParser: true,
      useFindAndModify: false,
      useUnifiedTopology: true,
      bufferCommands: false, // Disable mongoose buffering
      bufferMaxEntries: 0, // and MongoDB driver buffering
    });
    return connection;
  } catch (e) {
    error('Could not connect to MongoDB...');
    throw e;
  }
};

function getConnection() {
  return connection;
}

module.exports = { connect, getConnection };

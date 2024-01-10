const awsServerlessExpress = require('aws-serverless-express');
const { connect } = require('./src/mongodb-connect');

const { log } = console;
const connectToDB = connect();
let connection;

module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  if (!connection) {
    log('db not connected, connecting...');
    connection = await connectToDB;
  }
  // eslint-disable-next-line global-require
  const app = require('./src/app');
  const server = awsServerlessExpress.createServer(app);
  return awsServerlessExpress.proxy(server, event, context, 'PROMISE').promise;
};

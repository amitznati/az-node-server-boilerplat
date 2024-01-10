const fs = require('fs');
const { execSync } = require('child_process');
const httpStatus = require('http-status');
const path = require('path');
const shell = require('shelljs');
const ApiError = require('./ApiError');
const logger = require('../config/logger');
const config = require('../config/config');

const { log } = console;

const deleteFolderRecursive = (dir) => {
  const execSyncCall = (command) => execSync(command, { stdio: 'inherit', cwd: __dirname });
  if (fs.existsSync(dir)) {
    logger.info(`Deleting folder: ${dir}`);
    execSyncCall(`rm -rf ${dir}`);
    logger.info('Folder deleted!');
  }
};


module.exports = {
  deleteFolderRecursive,
};

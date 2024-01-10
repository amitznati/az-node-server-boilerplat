const express = require('express');
const path = require('path');
const fs = require('fs');
const httpStatus = require('http-status');
const ApiError = require('../../utils/ApiError');
const config = require('../../config/config');

const router = express.Router();

function returnFileResponse(res, filePath) {
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.send(new ApiError(httpStatus.NOT_FOUND));
  }
}
router.route(`/${config.AWS_S3_BUCKET_REPO_FOLDER_PREFIX}/:userId/:appName/:version/:fileName`).get((req, res) => {
  const { userId, appName, version, fileName } = req.params;
  if (userId && appName && version && fileName) {
    const filePath = path.join(__dirname, '../../../', config.filesRepoDir, userId, appName, version, fileName);
    returnFileResponse(res, filePath);
  } else {
    res.send(new ApiError(httpStatus.NOT_FOUND));
  }
});

router
  .route(`/${config.AWS_S3_BUCKET_REPO_FOLDER_PREFIX}/:userId/:appName/:version/:updateVersion/:fileName`)
  .get((req, res) => {
    const { userId, appName, version, updateVersion, fileName } = req.params;
    if (userId && appName && version && updateVersion && fileName) {
      const filePath = path.join(
        __dirname,
        '../../../',
        config.filesRepoDir,
        userId,
        appName,
        version,
        updateVersion,
        fileName
      );
      returnFileResponse(res, filePath);
    } else {
      res.send(new ApiError(httpStatus.NOT_FOUND));
    }
  });

router
  .route(`/exampleConfigFile`)
  .get((req, res) => returnFileResponse(res, path.join(__dirname, '../../config/exampleConfigFile.zip')));

module.exports = router;

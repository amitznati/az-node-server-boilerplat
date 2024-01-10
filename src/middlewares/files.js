const multer = require('multer');
const httpStatus = require('http-status');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { Release, Application } = require('../models');
const config = require('../config/config');
const filesConfig = require('../config/files');
const { uploadRequest, deleteFolderFromS3 } = require('./S3hanler');
const { getIdPerUploadType, createFolderForTempUpload } = require('../utils/filesUtils');

const log = (msg, obj) => logger.info(`${msg}:${JSON.stringify(obj)}`);

const storage = (uploadType) =>
  multer.diskStorage({
    destination(req, file, cb) {
      createFolderForTempUpload(uploadType, req)
        .then((tmpFolder) => cb(null, tmpFolder))
        .catch(cb);
    },
    filename(req, file, cb) {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const fileName = `${file.fieldname}-${uniqueSuffix}`;
      const id = getIdPerUploadType(uploadType, req);
      if (!id) {
        return cb(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Mandatory fields missing for upload file!'));
      }
      let fileUrl = `${config.tmpUploadsDir}/${uploadType}/${id}/${fileName}`;
      const checkExt = (ext) => file.originalname && file.originalname.endsWith(ext);
      if (file.fieldname === 'apkFile') {
        if (file.mimetype !== 'application/vnd.android.package-archive' || !checkExt('.apk')) {
          log(file.mimetype);
          return cb(new ApiError(httpStatus.BAD_REQUEST, 'Bad file type given for apk file!'));
        }
        fileUrl = `${fileUrl}.apk`;
        req.body.apkUploadedURL = fileUrl;
        return cb(null, `${fileName}.apk`);
      }
      if (file.fieldname === 'ipaFile') {
        if (file.mimetype !== 'application/octet-stream' || !checkExt('.ipa')) {
          return cb(new ApiError(httpStatus.BAD_REQUEST, 'Bad file type given for ipa file!'));
        }
        fileUrl = `${fileUrl}.ipa`;
        req.body.ipaUploadedURL = fileUrl;
        return cb(null, `${fileName}.ipa`);
      }
      if (file.fieldname === 'updateFile') {
        if (!checkExt('.zip')) {
          return cb(new ApiError(httpStatus.BAD_REQUEST, 'Bad file type given for update zip file!'));
        }
        fileUrl = `${fileUrl}.zip`;
        req.body.updateUploadedURL = fileUrl;
        return cb(null, `${fileName}.zip`);
      }
      if (file.fieldname === 'certFile') {
        if (!checkExt('.p12')) {
          return cb(new ApiError(httpStatus.BAD_REQUEST, 'Bad file type given for update p12 file!'));
        }
        fileUrl = `${fileUrl}.p12`;
        req.body.certUploadedURL = fileUrl;
        return cb(null, `${fileName}.p12`);
      }
      return cb(new ApiError('unknown field name'));
    },
  });

const deleteFolderPercussively = async (folderPath) => {
  const execSyncCall = (command) => execSync(command, { stdio: 'inherit', cwd: __dirname });
  if (!folderPath) return;
  if (config.IS_FILES_REPO_S3) {
    return deleteFolderFromS3(`${config.AWS_S3_BUCKET_REPO_FOLDER_PREFIX}/${folderPath.replace(/\\/g, '/')}/`, true);
  }
  const dir = path.join(__dirname, '../../', config.filesRepoDir, folderPath);
  if (fs.existsSync(dir)) {
    log('Deleting folder: ', dir);
    execSyncCall(`rm -rf ${dir}`);
    log('Folder deleted!');
  }
};
const getPathsByIds = async (deleteType, req, cb) => {
  try {
    log('finding paths for type: ', deleteType);
    if (deleteType === 'update') {
      const release = await Release.findById(req.body.release).populate(['updates', 'application']);
      if (!release) {
        return cb(new ApiError(httpStatus.BAD_REQUEST, 'Release not found'));
      }
      return release.updates
        .filter((up) => req.body.updateIds.includes(up.id))
        .map((up) => [up.owner, release.application.name, release.version, up.version].join('\\'));
    }
    if (deleteType === 'release') {
      const app = await Application.findById(req.body.application).populate('releases');
      if (!app) {
        return cb(new ApiError(httpStatus.BAD_REQUEST, 'Application not found'));
      }
      return app.releases
        .filter((re) => req.body.releaseIds.includes(re.id))
        .map((rel) => {
          return [rel.owner, app.name, rel.version].join('\\');
        });
    }
    if (deleteType === 'app') {
      const app = await Application.findById(req.params.applicationId);
      if (!app) {
        return cb(new ApiError(httpStatus.BAD_REQUEST, 'Application not found'));
      }
      return [path.join(req.user.id, app.name)];
    }
    return [];
  } catch (e) {
    cb(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, e));
  }
};

const deleteFromFilesRepository = (deleteType) => (req, res, cb) => {
  getPathsByIds(deleteType, req, cb)
    .then((folders) => {
      log('paths found: ', folders);
      Promise.all(folders.map(deleteFolderPercussively)).then(() => cb()).catch((er) => cb(er));
    })
    .catch((err) => {
      log(err);
      cb(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, err), null);
    });
};

module.exports = {
  fileStorage: (uploadType) => {
    if (config.clientUploadMethod === 'S3') {
      return uploadRequest(uploadType);
    }
    const upload = multer({ storage: storage(uploadType) });
    if (['release', 'clientUploadRelease'].includes(uploadType)) {
      return upload.fields([
        { name: 'apkFile', maxCount: 1 },
        { name: 'ipaFile', maxCount: 1 },
      ]);
    }
    if (uploadType === filesConfig.UPLOAD_TYPES.UPLOAD_CERT) {
      return upload.single('certFile');
    }
    return upload.single('updateFile');
  },
  deleteFromFilesRepository,
};

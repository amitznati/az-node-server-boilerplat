const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const proxy = require('proxy-agent');
const config = require('../config/config');

const { log } = console;

AWS.config.update({
  accessKeyId: config.AWS_S3_ACCESS_KEY,
  secretAccessKey: config.AWS_S3_SECRET_ACCESS_KEY,
  httpOptions: config.AWS_S3_PROXY ? { agent: proxy(config.AWS_S3_PROXY) } : {},
});

const s3 = new AWS.S3({
  region: config.AWS_S3_REGION,
  useAccelerateEndpoint: true,
});

const downloadFileFromS3 = (s3Key, saveTo, fromRepoBucket = false) => {
  const params = {
    Bucket: fromRepoBucket ? config.AWS_S3_BUCKET_REPO : config.AWS_S3_BUCKET_TMP_UPLOAD,
    Key: s3Key,
  };
  log('downloading file from S3: ', { s3Key, saveTo, fromRepoBucket });
  const data = s3.getObject(params).createReadStream();
  const writer = fs.createWriteStream(saveTo);
  return new Promise((resolve, reject) => {
    data.pipe(writer);
    let error = null;
    writer.on('error', (err) => {
      error = err;
      writer.close();
      log('error downloading file from S3: ', err);
      reject(err);
    });
    writer.on('close', () => {
      if (!error) {
        log('done downloading file from S3: ');
        resolve();
      }
    });
  });
};

const deleteFileFromS3 = (fileKey, fromRepoBucket = false) => {
  log('Delete object from S3: ', { fileKey, fromRepoBucket });
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: fromRepoBucket ? config.AWS_S3_BUCKET_REPO : config.AWS_S3_BUCKET_TMP_UPLOAD,
      Key: fileKey,
    };
    s3.deleteObject(params, function (err, data) {
      if (err) {
        log('Failed to delete object from S3: ', err);
        reject(err);
      } else {
        log('Successfully deleted file from bucket ', data);
        resolve(data);
      }
    });
  });
};

const uploadFileToS3Repo = (fileKey, filePath) => {
  return new Promise((resolve, reject) => {
    log('uploading file to s3 repo: ', { fileKey, filePath });
    const fileContent = fs.readFileSync(filePath);
    const params = {
      Bucket: config.AWS_S3_BUCKET_REPO,
      Key: fileKey,
      Body: fileContent,
    };

    const options = {
      partSize: 10 * 1024 * 1024,
      // how many concurrent uploads
      queueSize: 5,
    };

    s3.upload(params, options)
      .on('httpUploadProgress', (evt) => {
        // setProgress(Math.round((evt.loaded / evt.total) * 100))
        log('httpUploadProgress...: ', Math.round((evt.loaded / evt.total) * 100));
      })
      .on('httpDone', () => {
        log('httpDone...: ');
      })
      .on('complete', () => {
        log('complete...: ');
      })
      .send((err) => {
        if (err) {
          log('upload failed: ', err);
          reject(err);
        }
        log('send done');
        resolve();
      });
  });
};

const uploadFolderToS3Repo = async (dirPath) => {
  const getFilesRecursively = (dir, filesList) => {
    const files = fs.readdirSync(dir);
    files.forEach(function (file) {
      if (fs.statSync(`${dir}/${file}`).isDirectory()) {
        getFilesRecursively(path.join(dir, file), filesList);
      } else {
        filesList.push(path.join(dir, file));
      }
    });
    return filesList;
  };
  const filesList = getFilesRecursively(dirPath, []);
  return Promise.all(
    filesList.map((filePath) => {
      const fileKey = filePath
        .replace(path.join(__dirname, '../../', config.filesRepoDir), config.AWS_S3_BUCKET_REPO_FOLDER_PREFIX)
        .replace(/\\/g, '/')
        .replace('/tmp/', '')
        .replace('tmp/', '');
      return uploadFileToS3Repo(fileKey, filePath);
    })
  );
};

const deleteFolderFromS3 = (folderPath, fromRepoBucket) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: fromRepoBucket ? config.AWS_S3_BUCKET_REPO : config.AWS_S3_BUCKET_TMP_UPLOAD,
      Prefix: folderPath,
    };

    s3.listObjects(params, function (err, data) {
      if (err) return reject(err);
      log(data);
      if (data.Contents.length === 0) resolve();
      const deleteParams = {
        Bucket: fromRepoBucket ? config.AWS_S3_BUCKET_REPO : config.AWS_S3_BUCKET_TMP_UPLOAD,
        Delete: { Objects: [] },
      };

      data.Contents.forEach(function (content) {
        deleteParams.Delete.Objects.push({ Key: content.Key });
      });
      s3.deleteObjects(deleteParams, function (err2, data2) {
        if (err2) return reject(err2);
        log(data2);
        resolve();
      });
    });
  });
};

module.exports = {
  uploadFolderToS3Repo,
  downloadFileFromS3,
  deleteFileFromS3,
  deleteFolderFromS3,
};

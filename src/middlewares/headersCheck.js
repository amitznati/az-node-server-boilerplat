const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');

/**
 * Determine the mobile operating system.
 * This function returns one of 'iOS', 'Android', 'Windows Phone', or 'unknown'.
 *
 * @returns {String}
 */
function getMobileOperatingSystem(userAgent) {
  // Windows Phone must come first because its UA also contains "Android"
  // if (/windows phone/i.test(userAgent)) {
  //   return 'Windows Phone';
  // }
  if (/android/i.test(userAgent)) {
    return 'Android';
  }
  // iOS detection from: http://stackoverflow.com/a/9039885/177710
  if (/iPad|iPhone/.test(userAgent)) {
    return 'iOS';
  }
  return null;
}

const headerCheck = (type) => async (req, res, next) => {
  try {
    if (type === 'mobileOnly') {
      const ua = req.headers['user-agent'];
      const os = getMobileOperatingSystem(ua);
      if (!os) {
        return next(new ApiError(httpStatus.FORBIDDEN, 'Invalid user agent', true, ' '));
      }
      req.mobileOS = os;
      return next();
    }
    return next(new ApiError(httpStatus.FORBIDDEN, 'Invalid user agent', true, ' '));
  } catch (e) {
    next(e);
  }
};

module.exports = headerCheck;

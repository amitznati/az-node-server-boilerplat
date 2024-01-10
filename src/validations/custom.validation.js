const config = require('../config/config');

const objectId = (value, helpers) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.message('"{{#label}}" must be a valid mongo id');
  }
  return value;
};

const password = (value, helpers) => {
  if (value.length < 4) {
    return helpers.message('password must be at least 8 characters');
  }
  // if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
  //   return helpers.message('password must contain at least 1 letter and 1 number');
  // }
  return value;
};

const mobileUA = (value, helpers) => {
  const toMatch = [/Android/i, /iPhone/i, /iPad/i];

  const isMobile = toMatch.some((toMatchItem) => {
    return value.match(toMatchItem);
  });
  if (!isMobile) {
    return helpers.message('Invalid user agent');
  }
  return value;
};

const versionCheck = (value, helpers) => {
  const isMatch = value.match(/^[1-9]{1,3}\.\d{1,3}\.\d{1,3}$/);
  if (!isMatch) {
    return helpers.message('Invalid version');
  }
  return value;
};

const validateRegisterSecret = (value, helpers) => {
  if (value !== config.jwt.secret) {
    return helpers.message('Register secret is incorrect!');
  }
  return value;
};

module.exports = {
  objectId,
  password,
  mobileUA,
  versionCheck,
  validateRegisterSecret,
};

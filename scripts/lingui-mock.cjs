// Redirect @lingui/macro to our stub before it gets resolved/loaded
const Module = require('module');
const path = require('path');

const stubPath = path.resolve(__dirname, 'lingui-stub.cjs');

const _resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === '@lingui/macro') {
    return stubPath;
  }
  return _resolveFilename.call(this, request, ...args);
};

// Clear cache in case it was already loaded
const resolved = require.resolve('@lingui/macro');
delete require.cache[resolved];

'use strict';

// core node modules
const fs = require('fs');

// 3rd party modules
const _ = require('lodash');

// internal modules

module.exports = fs.readdirSync(__dirname).reduce((result, fileName) => {
  if (fileName.match(/^index\.js$/)) {
    return result;
  }
  const fileWithoutExtension = /(.*)\.[^.]+/.exec(fileName)[1];
  return _.assign(result, {
    [_.camelCase(fileWithoutExtension)]: require(`./${fileWithoutExtension}`), // eslint-disable-line global-require, import/no-dynamic-require
  });
}, {});

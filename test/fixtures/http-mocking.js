'use strict';

// node core modules
const fs = require('fs');
const path = require('path');
const { EOL } = require('os');

// 3rd party modules
const nock = require('nock');

// internal modules

const RECORDINGS_PATH = path.resolve(__dirname, './nock-recordings.js');

const record = () => nock.recorder.rec({ dont_print: true });

const persist = () =>
  fs.writeFileSync(RECORDINGS_PATH, [
    '\'use strict\';',
    '',
    'const nock = require(\'nock\');',
    '',
    '/* eslint-disable */',
    ...nock.recorder.play(),
    '/* eslint-enable */',
    '',
  ].join(EOL), 'utf8');

// eslint-disable-next-line global-require, import/no-dynamic-require
const mock = () => require(RECORDINGS_PATH);

module.exports = {
  record,
  persist,
  mock,
};

'use strict';

// node core modules

// 3rd party modules
const test = require('ava');
const _ = require('lodash');

// internal modules
const IbmConnectionsProfilesService = require('../lib');
const vCardMapping = require('../lib/config/vcard-attribute-mapping.json');

// configure dotenv
require('dotenv').config();

// setting up variables
const userCredentials = process.env.USER_CREDENTIALS;
const userid = process.env.IBM_CONNECTIONS_ALBERT_USER_ID;

test.beforeEach((t) => {
  const auth = `Basic ${new Buffer(userCredentials).toString('base64')}`;
  const options = {
    headers: {
      Authorization: auth,
    },
    plugins: {
      formatUrlTemplate: {
        typeToNameMap: { basic: 'oauth' },
      },
    },
    authType: 'oauth',
  };
  const serviceInstance = new IbmConnectionsProfilesService('https://apps.na.collabserv.com/profiles', options);
  _.assign(t.context, {
    serviceInstance,
  });
});

/* Successful scenarios validations */

test.cb('validating retrieving profile entry using Profile service instance, userid provided', (t) => {
  const { serviceInstance } = t.context;
  serviceInstance.getProfileEntry({ userid }, {}, (err, result) => {
    t.true(_.isNull(err));
    _.keys(result).forEach((prop) => {
      t.true(_.values(vCardMapping).includes(prop), `${prop} should be mapped value from {{ vCardMapping }}`);
    });
    const { extattr, names } = result;
    t.true(_.isArray(extattr), 'extattr should be an array');
    ['surname', 'givenName'].forEach(prop => t.true(prop in names, `${prop} should be a member of {{ names }} object`));
    t.end();
  });
});

test.cb('validating retrieving network connections using Profile service instance, userid provided', (t) => {
  const { serviceInstance } = t.context;

  serviceInstance.getNetworkConnections({ userid, ps: 100 }, { authType: 'basic' }, (err, result) => {
    t.true(_.isNull(err));
    const properties = ['paginationLinks', 'totalResults', 'startIndex', 'itemsPerPage', 'networkConnections'];
    const colleagueProps = ['id', 'type', 'connectionType', 'status', 'updated', 'message', 'summary', 'links'];
    const { networkConnections, totalResults } = result;

    properties.forEach((prop) => {
      t.true(prop in result, `${prop} should be a member of {{ result }}`);
    });
    t.is(totalResults, _.keys(networkConnections).length, `${userid} should be a member of networkConnections`);
    _.keys(networkConnections).forEach((colleague) => {
      colleagueProps.forEach(prop => t.true(prop in networkConnections[colleague],
        `${prop} should be a member of colleague with id:${colleague}`));
      const { status } = networkConnections[colleague];

      const availableStatus = ['accepted', 'unconfirmed', 'pending'];
      t.true(availableStatus.includes(status),
        `{{ status }} ${status} should be one of the available statuses: ${availableStatus.join(', ')}`);
    });
    t.end();
  });
});

/* Error / Wrong input scenarios validations */

test.cb('validating retrieving profile entry using Profile service instance, userid not provided', (t) => {
  const { serviceInstance } = t.context;

  serviceInstance.getProfileEntry({}, { authType: 'basic' }, (error) => {
    t.is(error.name, 'Error', 'when userid is not available, return an Error');
    t.is(error.message, 'Wrong number of entry selectors provided to receive profile entry: {}');
    t.is(error.status, 400, 'Status number should be equal to 400');
    t.end();
  });
});

test.cb('validating retrieving network connections using Profile service instance, userid not provided', (t) => {
  const { serviceInstance } = t.context;

  serviceInstance.getNetworkConnections({}, { authType: 'basic' }, (error) => {
    t.is(error.name, 'Error', 'when userid is not available, return an Error');
    t.is(error.message, 'Wrong number of entry selectors provided to receive network connections: {}');
    t.is(error.status, 400, 'Status number should be equal to 400');
    t.end();
  });
});

test.cb('validating retrieving network connections using Profile service instance, bad userid provided', (t) => {
  const { serviceInstance } = t.context;

  serviceInstance.getNetworkConnections({ userid: 'mock user id' }, { authType: 'basic' }, (error, result) => {
    t.is(error.name, 'Error', 'with wrong serviceLoaderName we should get new Error when userid not available');
    t.true(_.isUndefined(result), 'there should be no result since error returned');
    t.end();
  });
});

'use strict';

// core node modules
const util = require('util');
const fs = require('fs');
const path = require('path');

// 3rd party modules
const _ = require('lodash');
const async = require('async');
const xmlUtils = require('oniyi-utils-xml');
const OniyiHttpClient = require('oniyi-http-client');
const OniyiVCardParser = require('oniyi-vcard-parser');
const credentialsPlugins = require('oniyi-http-plugin-credentials');
const formatUrlTemplatePlugins = require('oniyi-http-plugin-format-url-template');

// internal modules
const xpathSelect = require('./xpath-select');
const vCardMapping = require('./config/vcard-attribute-mapping.json');
const responseParser = require('./response-parsers');

const { parse: parseXML } = xmlUtils;

// local constiable definitions
const profileTagCategories = require('./config/profile-tag-categories.json');

const xmlTemplate = ['entry', 'follow-entry', 'make-friend', 'tags-document']
  .reduce((result, current) => {
    result[_.camelCase(current)] = fs.readFileSync(path.join(__dirname, 'xml-templates', `${current}.xml`), { // eslint-disable-line no-param-reassign
      encoding: 'utf8',
    });
    return result;
  }, {});

function IbmConnectionsProfilesService(baseUrl, options) {
  const modifiedOptions = _.merge({
    defaults: {
      baseUrl: baseUrl.charAt(baseUrl.length - 1) === '/' ? baseUrl : `${baseUrl}/`,
      headers: options.headers,
      followRedirect: true,
      authType: '',
    },
    vCardParser: {
      vCardToJSONAttributeMapping: vCardMapping,
      complexJSONAttributes: {
        /* Country is not implemented for writing in Profiles API --> when reading, this value get's resolved from "countryCode" */
        workLocation: ['skip_1', 'skip_2', 'address_1', 'address_2', 'city', 'state', 'postal_code', 'country'],
        names: ['surname', 'givenName'],
      },
    },
    ttl: {
      profileEntry: false,
      networkState: 300,
    },
  }, options);

  const httpClient = new OniyiHttpClient(modifiedOptions);
  const { plugins = {} } = modifiedOptions;
  if (plugins.credentials) {
    httpClient.use(credentialsPlugins(plugins.credentials));
  }

  const formatUrlTemplateOptions = _.merge({
    valuesMap: {
      authType: {
        saml: '',
        cookie: '',
      },
    },
  }, plugins.formatUrlTemplate || {});

  httpClient.use(formatUrlTemplatePlugins(formatUrlTemplateOptions));
  this.vCardParser = new OniyiVCardParser(modifiedOptions.vCardParser);
  this.options = modifiedOptions;
  this.httpClient = httpClient;

  this.omitDefaultRequestParams = (params, extraOmmit = []) => {
    const omit = ['uri', 'url', 'method', 'qs', 'baseUrl'];
    return _.omit(params, [...omit, ...extraOmmit]);
  };
}

IbmConnectionsProfilesService.prototype.getServiceDocument = function getServiceDocument(query, options, callback) {
  const { httpClient, omitDefaultRequestParams } = this;
  let error;

  const qsValidParameters = [
    'key', // although not documented in the API, key works as well
    'email',
    'userid',
  ];

  const requestOptions = _.merge(omitDefaultRequestParams(options), {
    qs: _.pick(query, qsValidParameters),
    headers: {
      accept: 'application/xml',
    },
    uri: '{ authType }/atom/profileService.do',
  });

  const entrySelector = _.pick(requestOptions.qs, qsValidParameters);
  if (_.size(entrySelector) > 1) {
    error = new Error(util.format(
      'Wrong number of entry selectors provided to get editable fields: %j', entrySelector));
    error.status = 400;
    callback(error);
    return;
  }

  httpClient.makeRequest(requestOptions, (err, response, body) => {
    if (err) {
      callback(err);
      return;
    }
    // expexted
    // status codes: 200, 400, 401
    // content-type: application/atomsvc+xml
    if (!response || response.statusCode !== 200 || !/application\/atomsvc\+xml/.test(response.headers['content-type'])) { // eslint-disable-line max-len
      callback(new Error('received invalid response'));
      return;
    }

    callback(null, responseParser.profileService(body));
  });
};

IbmConnectionsProfilesService.prototype.getProfileEntry = function getProfileEntry(query, options, callback) {
  const self = this;
  const { httpClient, omitDefaultRequestParams, vCardParser } = self;

  let error;

  const qsValidParameters = [
    'email',
    'key',
    'userid',
  ];

  // construct the request options
  const requestOptions = _.merge({
    // defining defaults in here
    qs: {
      format: 'full',
      output: 'vcard',
    },
  }, omitDefaultRequestParams(options), {
    qs: _.pick(query, qsValidParameters),
    headers: {
      accept: 'application/xml',
    },
    ttl: self.options.ttl.profileEntry,
    uri: '{ authType }/atom/profileEntry.do',
  });

  const entrySelector = _.pick(requestOptions.qs, ['email', 'key', 'userid']);
  if (_.size(entrySelector) !== 1) {
    error = new Error(
      util.format('Wrong number of entry selectors provided to receive profile entry: %j', entrySelector));
    error.status = 400;
    callback(error);
    return;
  }

  // the makeRequest function can take two or three arguments
  // the last has to be a function
  httpClient.makeRequest(requestOptions, (err, response, body) => {
    if (err) {
      callback(err);
      return;
    }
    // expexted
    // status codes: 200, 403, 404
    // content-type: application/atom+xml
    if (!response || response.statusCode !== 200) {
      error = new Error(body || 'received invalid response');
      error.httpStatus = response.statausCode;
      callback(error);
      return;
    }
    callback(null, responseParser.profileEntry(body, vCardParser));
  });
};

IbmConnectionsProfilesService.prototype.updateEntry = function updateEntry(entry, options, callback) {
  const self = this;
  const { httpClient, omitDefaultRequestParams } = self;
  let error;

  if (!entry || !entry.userid) {
    error = new Error(util.format('A valid profile entry must be provided and have a "userid" property %j', entry));
    error.status = 400;
    return callback(error);
  }

  return self.getServiceDocument({
    userid: entry.userid,
  }, options, (err, serviceDocument) => {
    if (err) {
      callback(err);
      return;
    }

    const editableFields = serviceDocument.editableFields;

    if (editableFields.indexOf('jobResp') > -1 && entry.jobResp && entry.jobResp.length > 128) {
      entry.jobResp = entry.jobResp.substr(0, 127); // eslint-disable-line no-param-reassign
    }

    // construct the request options
    const requestOptions = _.merge(omitDefaultRequestParams(options), {
      method: 'PUT',
      qs: {
        userid: entry.userid,
      },
      body: util.format(xmlTemplate.entry, self.vCardParser.toVcard(entry, editableFields)),
      headers: {
        accept: 'application/atom+xml',
      },
      uri: '{ authType }/atom/profileEntry.do',
    });

    httpClient.makeRequest(requestOptions, (error, response) => { // eslint-disable-line no-shadow
      if (error) {
        callback(error);
        return;
      }
      // expexted
      // status codes: 200, 400, 401, 403, 404
      if (!response || response.statusCode !== 200) {
        callback(new Error('received invalid response'));
        return;
      }

      // if there are no extension attributes provided, return here
      if (!Array.isArray(entry.extattr)) {
        callback(null, 'OK');
        return;
      }

      // make subsequent calls for all editable extension attributes
      async.each(
        entry.extattr.filter(extattr => editableFields.indexOf(extattr.id) > -1 && serviceDocument.extattrDetails[extattr.id]), // eslint-disable-line max-len
        (extattr, iteratorCallback) => {
          const extattrDetails = serviceDocument.extattrDetails[extattr.id];
          const extAttrRequestOptions = omitDefaultRequestParams(requestOptions, ['body']);

          extAttrRequestOptions.uri = extattrDetails.href.split(self.requestOptions.baseUrl).pop();

          extAttrRequestOptions.method = extattr.value ? 'PUT' : 'DELETE';

          if (extAttrRequestOptions.method === 'PUT') {
            extAttrRequestOptions.body = decodeURIComponent(extattr.value);
            _.merge(extAttrRequestOptions.headers, {
              'content-type': extattrDetails.type,
            });
          }
          httpClient.makeRequest(extAttrRequestOptions, iteratorCallback);
        },
        (err) => { // eslint-disable-line no-shadow
          if (err) {
            callback(err);
            return;
          }
          callback(null, 'OK');
        });
    });
  });
};

IbmConnectionsProfilesService.prototype.batchLoadEntries = function batchLoadEntries(entries, options) {
  const self = this;
  if (!Array.isArray(entries)) {
    return;
  }

  entries.forEach((entry) => {
    self.getProfileEntry(_.pick(entry, ['userid', 'key', 'email']), options, _.noop);
  });
};

IbmConnectionsProfilesService.prototype.getEditableFields = function getEditableFields(query, options, callback) {
  this.getServiceDocument(query, options, (err, serviceDoc) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, serviceDoc.editableFields);
  });
};

IbmConnectionsProfilesService.prototype.getNetworkConnections = function getNetworkConnections(query, options, callback) { // eslint-disable-line max-len
  const { httpClient, omitDefaultRequestParams, vCardParser, batchLoadEntries } = this;
  let error;

  const qsValidParameters = [
    // 'connectionType',
    'email',
    'key',
    'userid',
    'inclMessage',
    'inclUserStatus',
    'output',
    'outputType',
    'format',
    'page',
    'ps',
    'since',
    'sortBy',
    'sortOrder',
  ];

  // construct the request options
  const requestOptions = _.merge({
    // defining defaults in here
    qs: {
      connectionType: 'colleague',
      outputType: 'connection',
      page: 1,
    },
  }, omitDefaultRequestParams(options), {
    qs: _.pick(query, qsValidParameters),
    headers: {
      accept: 'application/xml',
    },
    uri: '{ authType }/atom/connections.do',
    disableCache: true,
  });

  // checking validity and sanity of request options
  const entrySelector = _.pick(requestOptions.qs, 'email', 'key', 'userid');
  if (_.size(entrySelector) !== 1) {
    error = new Error(util.format('Wrong number of entry selectors provided to receive network connections: %j',
      entrySelector));
    error.status = 400;
    callback(error);
    return;
  }

  if (!_.isString(requestOptions.qs.outputType) || requestOptions.qs.outputType !== 'profile') {
    requestOptions.qs.output = undefined;
    requestOptions.qs.format = undefined;
  }
  // output: 'vcard', // 'hcard' this parameter is ignored if "outputType" is not set to "profile"
  if (!_.isString(requestOptions.qs.output) || ['hcard', 'vcard'].indexOf(requestOptions.qs.output) < 0) {
    requestOptions.qs.output = 'vcard';
  }
  // format: 'lite',  // 'full'  this parameter is ignored if "outputType" is not set to "profile"
  if (!_.isString(requestOptions.qs.format) || ['lite', 'full'].indexOf(requestOptions.qs.format) < 0) {
    requestOptions.qs.format = 'lite';
  }
  if (!_.isString(requestOptions.qs.sortBy) || ['displayName', 'modified'].indexOf(requestOptions.qs.sortBy) < 0) {
    requestOptions.qs.sortBy = 'displayName';
  }
  if (!_.isString(requestOptions.qs.sortOrder) || ['asc', 'desc'].indexOf(requestOptions.qs.sortOrder) < 0) {
    requestOptions.qs.sortOrder = 'asc';
  }
  if (!_.isBoolean(requestOptions.qs.inclMessage)) {
    requestOptions.qs.inclMessage = undefined;
  }
  if (!_.isBoolean(requestOptions.qs.inclUserStatus)) {
    requestOptions.qs.inclUserStatus = undefined;
  }

  // the connections API does not allow page-sizes larger than 250
  // if fetchAll is set to "true", we increase the page size to maximum
  if (options.fetchAll === true) {
    requestOptions.qs.page = 1;
    requestOptions.qs.ps = 250;
  } else if (_.isNumber(requestOptions.qs.ps) && requestOptions.qs.ps > 250) {
    requestOptions.qs.ps = 250;
    options.fetchAll = true; // eslint-disable-line no-param-reassign
  }

  httpClient.makeRequest(requestOptions, (err, response, body) => {
    if (err) {
      callback(err);
      return;
    }

    // expexted
    // status codes: 200, 403, 404
    // content-type: application/atom+xml
    if (!response || response.statusCode !== 200) {
      error = new Error(body || 'received invalid response');
      error.httpStatus = response.statausCode;
      callback(error);
      return;
    }

    const data = responseParser.networkConnections(body, vCardParser);
    // if this was not a call to fetch all the entry's network connections, we're done
    if (!options.fetchAll) {
      callback(null, data);
      return;
    }

    // if it was... but all results fit into a single request, we're done, too
    if (data.totalResults === _.size(data.networkConnections)) {
      // notify('Page 1 contains all available results');
      data.paginationLinks = undefined;
      data.startIndex = undefined;
      data.itemsPerPage = undefined;
      callback(null, data);
      return;
    }

    // we have to request subsequent result pages in order to fetch a complete list of the entry's network connections
    const pageRequests = [];

    // run one subsequent request for each page of the result set. Instead of using the paginationLinks,
    // we simply overwrite the "page" parameter of our request's query object and execute all the requests in parallel
    // collecting all request promises in an arry
    for (let i = 2; i <= Math.ceil(data.totalResults / requestOptions.qs.ps); i += 1) {
      pageRequests.push(_.merge(_.clone(requestOptions), {
        qs: {
          page: i,
        },
      }));
    }

    async.map(pageRequests, (pageRequestOptions, iteratorCallback) => {
      /* eslint-disable no-shadow */
      httpClient.makeRequest(pageRequestOptions, (err, response, body) => {
        if (err) {
          iteratorCallback(err);
          return;
        }

        // expexted
        // status codes: 200, 403, 404
        // content-type: application/atom+xml
        if (!response || response.statusCode !== 200) {
          error = new Error(body || 'received invalid response');
          error.httpStatus = response.statausCode;
          iteratorCallback(error);
          return;
        }

        const data = responseParser.networkConnections(body, vCardParser);
        iteratorCallback(null, data);
      });
    }, (err, results) => {
      if (err) {
        callback(err);
        return;
      }
      const result = _.merge.apply(null, results);

      result.paginationLinks = undefined;
      result.startIndex = undefined;
      result.itemsPerPage = undefined;

      // start prefetching all involved profile entries
      batchLoadEntries(_.keys(result.networkConnections).map(userid => ({
        userid,
      })), options);

      callback(null, result);
    });
  });
};
/* eslint-enable no-shadow */

IbmConnectionsProfilesService.prototype.getNetworkState = function getNetworkState(query, options, callback) {
  const self = this;
  const { httpClient, omitDefaultRequestParams } = self;
  let error;

  const networkStatusHeaderName = 'x-profiles-connection-status';

  const qsValidParameters = [
    'targetUserid',
    'targetEmail',
    'targetKey',
    'sourceUserid',
    'sourceEmail',
    'sourceKey',
  ];

  // construct the request options
  const requestOptions = _.merge({
    qs: {
      connectionType: 'colleague',
    },
  }, omitDefaultRequestParams(options), {
    method: 'HEAD',
    qs: _.pick(query, qsValidParameters),
    ttl: self.options.ttl.networkState,
    responseValidators: [(response, evaluator) => {
      // overriding cache storable validation
      // ibm connections sends an HTTP/404 as response to HEAD requests if the two people are no network contacts
      if (response.statusCode === 404) {
        evaluator.flagStorable(true);
        return true;
      }
      return false;
    }],
    uri: '{ authType }/atom/connections.do',
  });

  const targetSelector = _.pick(requestOptions.qs, 'targetUserid', 'targetEmail', 'targetKey');
  if (_.size(targetSelector) !== 1) {
    error = new Error(util.format('Wrong number of targetEntry selectors provided to receive network state: %j',
      targetSelector));
    error.status = 400;
    callback(error);
    return;
  }
  const sourceSelector = _.pick(requestOptions.qs, 'sourceUserid', 'sourceEmail', 'sourceKey');
  if (_.size(sourceSelector) !== 1) {
    error = new Error(util.format('Wrong number of sourceEntry selectors provided to receive network state: %j',
      sourceSelector));
    error.status = 400;
    callback(error);
    return;
  }

  httpClient.makeRequest(requestOptions, (err, response) => {
    if (err) {
      callback(err);
      return;
    }
    if (response.statusCode === 404) {
      callback(null, false);
      return;
    }
    if (response.headers[networkStatusHeaderName] && ['accepted', 'pending', 'unconfirmed']
      .indexOf(response.headers[networkStatusHeaderName]) > -1) {
      callback(null, response.headers[networkStatusHeaderName]);
      return;
    }
    callback(new Error('No valid network status found'));
  });
};

IbmConnectionsProfilesService.prototype.inviteNetworkContact = function inviteNetworkContact(query, options, callback) {
  const { httpClient, omitDefaultRequestParams } = this;
  let error;

  const qsValidParameters = [
    'userid',
  ];

  // construct the request options
  const requestOptions = _.merge({
    qs: {
      connectionType: 'colleague',
    },
  }, omitDefaultRequestParams(options), {
    method: 'POST',
    qs: _.pick(query, qsValidParameters),
    headers: {
      'content-type': 'application/atom+xml',
    },
    body: util.format(xmlTemplate.makeFriend, options.message),
    uri: '{ authType }/atom/connection.do',
  });

  httpClient.makeRequest(requestOptions, (err, response) => {
    if (err) {
      callback(err);
      return;
    }
    if (response.statusCode === 400) {
      // logDebug('There is a pending invitation from {%s} to {%s} already', sourceentry.userid, targetentry.userid);
      error = new Error('A pending invitation exists already');
      error.httpStatus = 400;
      callback(error);
      return;
    }
    if (response.statusCode === 200) {
      // logDebug('Successfully created invite from {%s} to {%s}', sourceentry.userid, targetentry.userid);
      callback(null, 'pending');
      return;
    }
    callback(response.statusCode);
  });
};

IbmConnectionsProfilesService.prototype.removeFromNetwork = function removeFromNetwork(query, options, callback) {
  return callback(new Error('not implemented'));
  // resolve authenticated user
  // query: sourceUser, targetUser
  // get connection.do
  // extract edit href
  // send delete request to edit href
};

IbmConnectionsProfilesService.prototype.getFollowedProfiles = function getFollowedProfiles(query, options, callback) {
  const { httpClient, omitDefaultRequestParams, batchLoadEntries } = this;
  let error;

  const qsValidParameters = [
    'page',
    'ps',
    'resource',
  ];

  // construct the request options
  const requestOptions = _.merge({
    // defining defaults in here
    qs: {
      type: 'profile',
      source: 'profiles',
      page: 1,
    },
  }, omitDefaultRequestParams(options), {
    qs: _.pick(query, qsValidParameters),
    headers: {
      accept: 'application/xml',
    },
    uri: '/follow/{ authType }/atom/resources',
  });

  // the connections API does not allow page-sizes larger than 20
  // if fetchAll is set to "true", we increase the page size to maximum
  if (options.fetchAll) {
    requestOptions.qs.page = 1;
    requestOptions.qs.ps = 20;
  } else if (_.isNumber(requestOptions.qs.ps) && requestOptions.qs.ps > 20) {
    requestOptions.qs.ps = 20;
    options.fetchAll = true; // eslint-disable-line no-param-reassign
  }

  httpClient.makeRequest(requestOptions, (err, response, body) => {
    if (err) {
      callback(err);
      return;
    }

    // expexted
    // status codes: 200, 403, 404
    // content-type: application/atom+xml
    if (!response || response.statusCode !== 200) {
      error = new Error(body || 'received invalid response');
      error.httpStatus = response.statausCode;
      callback(error);
      return;
    }

    const data = responseParser.followedProfiles(body);
    // if this was not a call to fetch all the entry's network connections, we're done
    if (!options.fetchAll) {
      callback(null, data);
      return;
    }

    // if it was... but all results fit into a single request, we're don, too
    if (data.totalResults === _.size(data.followedProfiles)) {
      // notify('Page 1 contains all available results');
      data.paginationLinks = undefined;
      data.startIndex = undefined;
      data.itemsPerPage = undefined;
      callback(null, data);
      return;
    }

    // we have to request subsequent result pages in order to fetch a complete list of the followed resources
    const pageRequests = [];

    // run one subsequent request for each page of the result set. Instead of using the paginationLinks,
    // we simply overwrite the "page" parameter of our request's query object and execute all the requests in parallel
    // collecting all request promises in an arry
    for (let i = 2; i <= Math.ceil(data.totalResults / requestOptions.qs.ps); i += 1) {
      pageRequests.push(_.merge(_.clone(requestOptions), {
        qs: {
          page: i,
        },
      }));
    }

    async.map(pageRequests, (pageRequestOptions, iteratorCallback) => {
      /* eslint-disable no-shadow */
      httpClient.makeRequest(pageRequestOptions, (err, response, body) => {
        if (err) {
          iteratorCallback(err);
          return;
        }

        // expexted
        // status codes: 200, 403, 404
        // content-type: application/atom+xml
        if (!response || response.statusCode !== 200) {
          error = new Error(body || 'received invalid response');
          error.httpStatus = response.statausCode;
          iteratorCallback(error);
          return;
        }

        const data = responseParser.followedProfiles(body);
        iteratorCallback(null, data);
      });
    }, (err, results) => {
      if (err) {
        callback(err);
        return;
      }
      const result = _.merge.apply(null, results);

      result.paginationLinks = undefined;
      result.startIndex = undefined;
      result.itemsPerPage = undefined;

      // start prefetching all involved profile entries
      batchLoadEntries(_.keys(result.followedProfiles).map(userid => ({
        userid,
      })), options);

      callback(null, result);
    });
  });
  /* eslint-enable no-shadow */
};

IbmConnectionsProfilesService.prototype.getFollowState = function getFollowState(userid, options, callback) {
  const { httpClient, omitDefaultRequestParams } = this;
  let error;

  // construct the request options
  const requestOptions = _.merge(omitDefaultRequestParams(options), {
    qs: {
      type: 'profile',
      source: 'profiles',
      resource: userid,
    },
    disableCache: true,
    uri: '/follow/{ authType }/atom/resources',
  });

  httpClient.makeRequest(requestOptions, (err, response, body) => {
    if (err) {
      callback(err);
      return;
    }
    // expexted
    // status codes: 200, 403, 404
    // content-type: application/atom+xml
    if (!response || response.statusCode !== 200) {
      error = new Error(body || 'received invalid response');
      error.httpStatus = response.statausCode;
      callback(error);
      return;
    }

    const data = parseXML(body);

    const resourceId = xpathSelect('/atom:entry/atom:id/text()', data, true).toString();
    if (resourceId) {
      const validator = new RegExp(`urn:lsid:ibm.com:follow:resource-${userid}`, 'i');
      callback(null, validator.test(resourceId));
      return;
    }

    callback(null, false);
  });
};

IbmConnectionsProfilesService.prototype.follow = function follow(query, options, callback) {
  const { httpClient, omitDefaultRequestParams } = this;
  let error;

  if (!query.targetUserid) {
    error = new Error('entry.targetUserid must be provided');
    error.httpStatus = 400;
    callback(error);
    return;
  }

  // construct the request options
  const requestOptions = _.merge(omitDefaultRequestParams(options), {
    method: 'POST',
    qs: {
      type: 'profile',
      source: 'profiles',
    },
    body: util.format(xmlTemplate.followEntry, query.targetUserid),
    headers: {
      'content-type': 'application/atom+xml',
    },
    uri: '/follow/{ authType }/atom/resources',
  });

  httpClient.makeRequest(requestOptions, (err, response, body) => {
    if (err) {
      callback(err);
      return;
    }
    // expexted
    // status codes: 200, 403, 404
    // content-type: application/atom+xml
    if (!response || response.statusCode !== 200) {
      error = new Error(body || 'received invalid response');
      error.httpStatus = response.statausCode;
      callback(error);
      return;
    }
    const data = parseXML(body);

    const resourceId = xpathSelect('/atom:entry/atom:id/text()', data, true).toString();
    if (resourceId) {
      const validator = new RegExp(`urn:lsid:ibm.com:follow:resource-${query.targetUserid}`, 'i');
      callback(null, validator.test(resourceId));
      return;
    }

    callback(null, false);
  });
};

IbmConnectionsProfilesService.prototype.unfollow = function unfollow(query, options, callback) {
  const self = this;
  const { httpClient, omitDefaultRequestParams } = self;
  let error;

  if (!query.targetUserid) {
    error = new Error('query.targetUserid must be provided');
    error.httpStatus = 400;
    callback(error);
    return;
  }

  // construct the request options
  const requestOptions = _.merge(omitDefaultRequestParams(options), {
    qs: {
      type: 'profile',
      source: 'profiles',
      resource: query.targetUserid,
    },
    uri: '/follow/{ authType }/atom/resources',
  });

  httpClient.makeRequest(requestOptions, (err, response, body) => {
    if (err) {
      callback(err);
      return;
    }
    // expexted
    // status codes: 200, 403, 404
    // content-type: application/atom+xml
    if (!response || response.statusCode !== 200) {
      error = new Error(body || 'received invalid response');
      error.httpStatus = response.statausCode;
      callback(error);
      return;
    }
    const data = parseXML(body);

    const editLink = xpathSelect('/atom:entry/atom:link[rel="edit"]', data, true);
    if (!(editLink && editLink.getAttribute('href'))) {
      error = new Error(`Can not find followed resource: ${query.targetUserid}`);
      error.httpStatus = 400;
      callback(error);
      return;
    }

    const href = editLink.getAttribute('href').split(self.requestOptions.baseUrl).pop();

    httpClient.makeRequest(_.merge(requestOptions, {
      uri: href,
    }), (err, response) => { // eslint-disable-line no-shadow
      if (err) {
        callback(err);
        return;
      }
      // expexted
      // status codes: 204, 400, 403, 404
      // content-type: application/atom+xml
      if (!response || response.statusCode !== 204) {
        error = new Error(body || 'received invalid response');
        error.httpStatus = response.statausCode;
        callback(error);
        return;
      }
      callback(null, true);
    });
  });
};

IbmConnectionsProfilesService.prototype.getTags = function getTags(query, options, callback) {
  const { httpClient, omitDefaultRequestParams, batchLoadEntries } = this;
  let error;

  const qsValidParameters = [
    'targetUserid',
    'targetEmail',
    'targetKey',
    'sourceUserid',
    'sourceEmail',
    'sourceKey',
    'format',
    'lastMod',
  ];

  // construct the request options
  const requestOptions = _.merge({
    ttl: 1800,
  }, omitDefaultRequestParams(options), {
    qs: _.pick(query, qsValidParameters),
    headers: {
      accept: 'application/xml',
    },
    uri: '{ authType }/atom/profileTags.do',
  });

  const targetSelector = _.pick(requestOptions.qs, ['targetUserid', 'targetEmail', 'targetKey']);
  if (_.size(targetSelector) !== 1) {
    error = new Error(util.format('Wrong number of targetEntry selectors provided to receive tags: %j',
      targetSelector));
    error.status = 400;
    callback(error);
    return;
  }
  const sourceSelector = _.pick(requestOptions.qs, ['sourceUserid', 'sourceEmail', 'sourceKey']);
  if (_.size(sourceSelector) > 1) {
    error = new Error(util.format('Wrong number of sourceEntry selectors provided to receive tags: %j',
      sourceSelector));
    error.status = 400;
    callback(error);
    return;
  }

  // format will be ignores on server if a valid sourceSelector was provided
  if (_.isString(requestOptions.qs.format) && ['lite', 'full'].indexOf(requestOptions.qs.format) < 0) {
    requestOptions.qs.format = 'lite';
  }

  httpClient.makeRequest(requestOptions, (err, response, body) => {
    if (err) {
      callback(err);
      return;
    }
    // expexted
    // status codes: 200, 403, 404
    // content-type: application/atom+xml
    if (!response || response.statusCode !== 200) {
      error = new Error(body || 'received invalid response');
      error.httpStatus = response.statausCode;
      callback(error);
      return;
    }

    const data = responseParser.profileTags(body);

    // start prefetching all involved profile entries
    if (data.contributors) {
      batchLoadEntries(Object.keys(data.contributors).map(userid => ({
        userid,
      })), options);
    }

    callback(null, data);
  });
};

IbmConnectionsProfilesService.prototype.updateTags = function updateTags(query, tags, options, callback) {
  const { httpClient, omitDefaultRequestParams } = this;
  let error;

  if (!Array.isArray(tags)) {
    error = new Error('an Array of tags must be provided');
    error.status = 400;
    callback(error);
    return;
  }

  const qsValidParameters = [
    'targetUserid',
    'targetEmail',
    'targetKey',
    'sourceUserid',
    'sourceEmail',
    'sourceKey',
  ];

  // construct the request options
  const requestOptions = _.merge(omitDefaultRequestParams(options), {
    method: 'PUT',
    qs: _.pick(query, qsValidParameters),
    headers: {
      'content-type': 'application/atom+xml',
    },
    uri: '{ authType }/atom/profileTags.do',
  });

  const targetSelector = _.pick(requestOptions.qs, ['targetUserid', 'targetEmail', 'targetKey']);
  if (_.size(targetSelector) !== 1) {
    error = new Error(util.format('Wrong number of targetEntry selectors provided to update tags: %j', targetSelector));
    error.status = 400;
    callback(error);
    return;
  }
  const sourceSelector = _.pick(requestOptions.qs, ['sourceUserid', 'sourceEmail', 'sourceKey']);
  if (_.size(sourceSelector) > 1) {
    error = new Error(util.format('Wrong number of sourceEntry selectors provided to update tags: %j', sourceSelector));
    error.status = 400;
    callback(error);
    return;
  }

  const tagsDocument = parseXML(xmlTemplate.tagsDocument);
  const tagsDocumentParentNode = xpathSelect('app:categories', tagsDocument, true);

  tags.forEach((tag) => {
    const xmlTag = tagsDocument.createElement('atom:category');
    if (_.isString(tag)) {
      tag = { // eslint-disable-line no-param-reassign
        term: tag,
      };
    }
    xmlTag.setAttribute('term', _.escape(tag.term));
    if (_.isString(profileTagCategories[tag.category])) {
      xmlTag.setAttribute('scheme', profileTagCategories[tag.category]);
    }
    tagsDocumentParentNode.appendChild(xmlTag);
  });

  // this might require the XMLSerializer.serializeToString(tagsDocument) from xmldom package
  requestOptions.body = xmlUtils.serialize(tagsDocument);

  httpClient.makeRequest(requestOptions, (err, response) => {
    if (err) {
      callback(err);
      return;
    }
    // expexted
    // status codes: 200, 400
    // content-type: application/atom+xml
    if (!response || response.statusCode !== 200) {
      error = new Error('received invalid response');
      error.httpStatus = response.statausCode;
      callback(error);
      return;
    }
    callback(null, true);
  });
};

IbmConnectionsProfilesService.prototype.addTags = function addTags(query, tags, options, callback) {
  const { getTags, updateTags } = this;
  let error;

  if (!Array.isArray(tags)) {
    error = new Error('an Array of tags must be provided');
    error.status = 400;
    return callback(error);
  }

  // @TODO: resolve userid of authenticated user and attach to query.sourceUserid
  const sourceSelector = _.pick(query, ['sourceUserid', 'sourceEmail', 'sourceKey']);
  if (_.size(sourceSelector) > 1) {
    error = new Error(util.format('Wrong number of sourceEntry selectors provided to update tags: %j', sourceSelector));
    error.status = 400;
    return callback(error);
  }

  options.disableCache = true; // eslint-disable-line no-param-reassign

  return getTags(query, options, (err, existingTags) => {
    if (err) {
      return callback(err);
    }

    // normalize old tags
    const oldTags = existingTags.tags.map(tag => _.pick(tag, ['term', 'type']));

    // normalize new tags
    const newTags = tags.map((tag) => {
      if (_.isString(tag)) {
        tag = { // eslint-disable-line no-param-reassign
          term: tag,
        };
      }
      return tag;
    });

    // union new and old tags
    // put new set of tags to the API
    return updateTags(query, _.union(newTags, oldTags), options, callback);
  });
};

IbmConnectionsProfilesService.prototype.removeTags = function removeTags(query, tags, options, callback) {
  const { getTags, updateTags } = this;
  let error;

  if (!Array.isArray(tags)) {
    error = new Error('an Array of tags must be provided');
    error.status = 400;
    return callback(error);
  }

  // @TODO: resolve userid of authenticated user and attach to query.sourceUserid
  const sourceSelector = _.pick(query, ['sourceUserid', 'sourceEmail', 'sourceKey']);
  if (_.size(sourceSelector) > 1) {
    error = new Error(util.format('Wrong number of sourceEntry selectors provided to update tags: %j', sourceSelector));
    error.status = 400;
    return callback(error);
  }

  options.disableCache = true; // eslint-disable-line no-param-reassign

  return getTags(query, options, (err, existingTags) => {
    if (err) {
      return callback(err);
    }

    // normalize old tags
    // in this case, we create strings from all tag objects
    // --> easier to compare
    const oldTags = existingTags.tags.map(tag => JSON.stringify(_.pick(tag, 'term', 'type')));

    // normalize new tags
    const removeTags = tags.map((tag) => { // eslint-disable-line no-shadow
      if (_.isString(tag)) {
        tag = { // eslint-disable-line no-param-reassign
          term: tag,
        };
      }
      if (!_.isString(tag.type)) {
        tag.type = 'general'; // eslint-disable-line no-param-reassign
      }
      return JSON.stringify(tag);
    });

    // determine difference between old and to-be-removed tags
    // put new set of tags to the API
    return updateTags(query, _.difference(oldTags, removeTags).map(tag => JSON.parse(tag)), options, callback);
  });
};

module.exports = IbmConnectionsProfilesService;

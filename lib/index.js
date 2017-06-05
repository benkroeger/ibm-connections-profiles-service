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

// internal modules
const xmlNS = require('./xml-namespaces.json');
const vCardMapping = require('./vcard-attribute-mapping.json');

const parseXML = xmlUtils.parse;
const selectXPath = xmlUtils.selectUseNamespaces(xmlNS);

// local constiable definitions
const profileTagCategories = require('./profile-tag-categories.json');

const xmlTemplate = ['entry', 'follow-entry', 'make-friend', 'tags-document']
  .reduce((result, current) => {
    result[_.camelCase(current)] = fs.readFileSync(path.join(__dirname, 'xml-templates', `${current}.xml`), { // eslint-disable-line no-param-reassign
      encoding: 'utf8',
    });
    return result;
  }, {});

/**
 * Some selector fields, when called by /text() syntax, return undefined if they have no text.
 * Need to be sure that we are not calling '.toString()' on undefined object.
 *
 * @param collection      The collection/object we are trying to convert to string
 */
const safeConvertToString = collection => (collection ? collection.toString() : '');

// here begins the parser functions definition section
const responseParser = {
  profileService: function parseProfileServiceResponse(responseXML) {
    if (_.isString(responseXML)) {
      responseXML = parseXML(responseXML); // eslint-disable-line no-param-reassign
    }

    const result = {
      userid: selectXPath('/app:service/app:workspace/app:collection/snx:userid/text()', responseXML, true).toString(),
      editableFields: _.map(selectXPath(
        '/app:service/app:workspace/app:collection/snx:editableFields/snx:editableField',
        responseXML), element => element.getAttribute('name')),
      links: {},
      services: {},
      extattrDetails: {},
    };

    const serviceNames = [
      'http://www.ibm.com/xmlns/prod/sn/service/activities',
      'http://www.ibm.com/xmlns/prod/sn/service/dogear',
      'http://www.ibm.com/xmlns/prod/sn/service/profiles',
      'http://www.ibm.com/xmlns/prod/sn/service/communities',
      'http://www.ibm.com/xmlns/prod/sn/service/files',
      'http://www.ibm.com/xmlns/prod/sn/service/wikis',
      'http://www.ibm.com/xmlns/prod/sn/service/forums',
      'http://www.ibm.com/xmlns/prod/sn/service/blogs',
    ];

    const links = [
      'http://www.ibm.com/xmlns/prod/sn/profile-type',
      'http://www.ibm.com/xmlns/prod/sn/reporting-chain',
      'http://www.ibm.com/xmlns/prod/sn/connections/colleague',
      'http://www.ibm.com/xmlns/prod/sn/status',
      'http://www.ibm.com/xmlns/prod/sn/mv/theboard',
      'http://www.ibm.com/xmlns/prod/sn/tag-cloud',
    ];

    Array.prototype.forEach.call(selectXPath('/app:service/app:workspace/atom:link[@rel]', responseXML), (element) => {
      const rel = element.getAttribute('rel');
      let name;

      // process extension attributes
      if (rel === 'http://www.ibm.com/xmlns/prod/sn/ext-attr') {
        const extensionId = element.getAttributeNS(xmlNS.snx, 'extensionId');
        result.extattrDetails[extensionId] = {
          id: extensionId,
          type: element.getAttribute('type'),
          href: element.getAttribute('href'),
        };
        return;
      }

      // process profile type links
      if (links.indexOf(rel) > -1) {
        name = rel.split('http://www.ibm.com/xmlns/prod/sn/').pop();
        result.links[name] = {
          name,
          rel,
          type: element.getAttribute('type'),
          href: element.getAttribute('href'),
        };
        return;
      }

      // at this point, we would only process service rels
      if (serviceNames.indexOf(rel) < 0) {
        return;
      }

      // process service rels
      name = rel.split('/').pop();
      result.services[name] = {
        name,
        rel,
        type: element.getAttribute('type'),
        href: element.getAttribute('href'),
      };
    });

    return result;
  },
  profileEntry: function parseProfileEntryResponse(responseXML, parser, isEntryNode) {
    if (_.isString(responseXML)) {
      responseXML = parseXML(responseXML); // eslint-disable-line no-param-reassign
    }

    let xpathExpression = 'atom:content[@type="text"]/text()';
    if (!isEntryNode) {
      xpathExpression = `atom:entry/${xpathExpression}`;
    }
    // parse vCard String to JSON object
    const vcardString = safeConvertToString(selectXPath(xpathExpression, responseXML, true));
    if (!vcardString) {
      const error = new Error('No vcard content found in entry document');
      error.httpStatus = 404;
      throw error;
    }

    const entry = parser.toObject(vcardString);
    // parsing tags
    if (_.isString(entry.tags)) {
      if (entry.tags.length > 0) {
        entry.tags = entry.tags.split(',');
      }
    }
    if (!Array.isArray(entry.tags)) {
      entry.tags = [];
    }

    return entry;
  },
  networkConnections: function parseNetworkConnectionsResponse(responseXML, vCardParser) {
    if (_.isString(responseXML)) {
      responseXML = parseXML(responseXML); // eslint-disable-line no-param-reassign
    }
    const returnValue = {};

    // extract pagination information from received XML
    const paginationLinkElements = selectXPath('/atom:feed/atom:link[@rel]', responseXML);
    if (paginationLinkElements.length > 0) {
      returnValue.paginationLinks = {};
      Array.prototype.forEach.call(paginationLinkElements, (element) => {
        returnValue.paginationLinks[element.getAttribute('rel')] = element.getAttribute('href');
      });
    }

    returnValue.totalResults = parseInt(responseXML.getElementsByTagNameNS(
      xmlNS.openSearch, 'totalResults')[0].textContent, 10);
    returnValue.startIndex = parseInt(responseXML.getElementsByTagNameNS(
      xmlNS.openSearch, 'startIndex')[0].textContent, 10);
    returnValue.itemsPerPage = parseInt(responseXML.getElementsByTagNameNS(
      xmlNS.openSearch, 'itemsPerPage')[0].textContent, 10);

    returnValue.networkConnections = {};

    if (_.isString(returnValue.paginationLinks.self) && /outputType=profile/i.test(returnValue.paginationLinks.self)) {
      Array.prototype.forEach.call(selectXPath('/atom:feed/atom:entry', responseXML), (entryXML) => {
        const entry = responseParser.profileEntry(entryXML, vCardParser, true);
        if (entry && entry.userid) {
          returnValue.networkConnections[entry.userid] = entry;
        }
      });
    } else {
      _.forEach(selectXPath('/atom:feed/atom:entry', responseXML), (entry) => {
        // could also detect who initialized the connection (author vs. contributor)
        const connection = {
          id: selectXPath('atom:id/text()', entry, true).toString().split('tag:profiles.ibm.com,2006:entry').pop(),
          type: selectXPath('atom:category[@scheme="http://www.ibm.com/xmlns/prod/sn/type"]/@term', entry, true).value,
          connectionType: selectXPath('atom:category[@scheme="http://www.ibm.com/xmlns/prod/sn/connection/type"]/@term', entry, true).value,
          status: selectXPath('atom:category[@scheme="http://www.ibm.com/xmlns/prod/sn/status"]/@term', entry, true).value,
          updated: safeConvertToString(selectXPath('atom:updated/text()', entry, true)),
          message: safeConvertToString(selectXPath('atom:content/text()', entry, true)),
          summary: safeConvertToString(selectXPath('atom:summary/text()', entry, true)),
          links: {
            self: {
              href: selectXPath('atom:link[@rel="self"]/@href', entry, true).value,
              type: selectXPath('atom:link[@rel="self"]/@type', entry, true).value,
            },
            edit: {
              href: selectXPath('atom:link[@rel="edit"]/@href', entry, true).value,
              type: selectXPath('atom:link[@rel="edit"]/@type', entry, true).value,
            },
          },
        };
        _.forEach(entry.getElementsByTagName('contributor'), (contributor) => {
          // have to do this, because xml-utils currently don't support namespaced attribute names
          const rel = contributor.getAttributeNS(xmlNS.snx, 'rel');
          if (_.isString(rel) && rel === 'http://www.ibm.com/xmlns/prod/sn/connection/target') {
            returnValue.networkConnections[
              contributor.getElementsByTagNameNS(xmlNS.snx, 'userid')[0].textContent
              ] = connection;
          }
        });
      });
    }

    return returnValue;
  },
  followedProfiles: function parseFollowedProfilesResponse(responseXML) {
    if (_.isString(responseXML)) {
      responseXML = parseXML(responseXML); // eslint-disable-line no-param-reassign
    }

    const returnValue = {};

    // extract pagination information from received XML
    const paginationLinkElements = selectXPath('/atom:feed/atom:link[@rel]', responseXML);
    if (paginationLinkElements.length > 0) {
      returnValue.paginationLinks = {};
      Array.prototype.forEach.call(paginationLinkElements, (element) => {
        returnValue.paginationLinks[element.getAttribute('rel')] = element.getAttribute('href');
      });
    }

    returnValue.totalResults = parseInt(responseXML.getElementsByTagNameNS(
      xmlNS.openSearch, 'totalResults')[0].textContent, 10);
    returnValue.startIndex = parseInt(responseXML.getElementsByTagNameNS(
      xmlNS.openSearch, 'startIndex')[0].textContent, 10);
    returnValue.itemsPerPage = parseInt(responseXML.getElementsByTagNameNS(
      xmlNS.openSearch, 'itemsPerPage')[0].textContent, 10);

    returnValue.followedProfiles = {};
    Array.prototype.forEach.call(responseXML.getElementsByTagName('entry'), (followedEntry) => {
      const followedResourceId = followedEntry.getElementsByTagName('id')[0].textContent
        .split('urn:lsid:ibm.com:follow:resource-')[1];
      const userid = selectXPath('category[scheme="http://www.ibm.com/xmlns/prod/sn/resource-id"]/@term', followedEntry).value;

      returnValue.followedProfiles[userid] = followedResourceId;
    });
    return returnValue;
  },
  profileTags: function parseProfileTagsResponse(responseXML) {
    if (_.isString(responseXML)) {
      responseXML = parseXML(responseXML); // eslint-disable-line no-param-reassign
    }

    const categoriesTag = responseXML.getElementsByTagNameNS(xmlNS.app, 'categories')[0];
    const categoryTags = categoriesTag.getElementsByTagNameNS(xmlNS.atom, 'category');

    const returnValue = {
      numberOfContributors: parseInt(categoriesTag.getAttributeNS(xmlNS.snx, 'numberOfContributors'), 10),
      contributors: {},
      tags: [],
    };

    Array.prototype.forEach.call(categoryTags, (categoryTag) => {
      const contributorTags = categoryTag.getElementsByTagNameNS(xmlNS.atom, 'contributor');
      const tag = {
        term: _.unescape(categoryTag.getAttribute('term')),
        scheme: categoryTag.getAttribute('scheme'),
        frequency: categoryTag.getAttributeNS(xmlNS.snx, 'frequency'),
        intensityBin: categoryTag.getAttributeNS(xmlNS.snx, 'intensityBin'),
        visibilityBin: categoryTag.getAttributeNS(xmlNS.snx, 'visibilityBin'),
        type: categoryTag.getAttributeNS(xmlNS.snx, 'type'),
        contributors: [],
      };

      Array.prototype.forEach.call(contributorTags, (contributorTag) => {
        const contributorGuid = contributorTag.getAttributeNS(xmlNS.snx, 'profileGuid');
        const contributor = returnValue.contributors[contributorGuid] || {
          contribution: {},
        };

        _.merge(contributor, {
          key: contributorTag.getAttributeNS(xmlNS.snx, 'profileKey'),
          userid: contributorGuid,
          uid: contributorTag.getAttributeNS(xmlNS.snx, 'profileUid'),
          email: safeConvertToString(selectXPath('atom:email/text()', contributorTag, true)),
          userState: safeConvertToString(selectXPath('snx:userState/text()', contributorTag, true)),
          isExternal: safeConvertToString(selectXPath('snx:isExternal/text()', contributorTag, true)),
        });

        contributor.contribution[tag.type] = contributor.contribution[tag.type] || [];
        contributor.contribution[tag.type].push(tag.term);
        tag.contributors.push(contributor.userid);
        returnValue.contributors[contributorGuid] = contributor;
      });

      returnValue.tags.push(tag);
    });

    return returnValue;
  },
};

function IbmConnectionsProfilesService(baseUrl, options) {
  const modifiedOptions = _.merge({
    defaults: {
      baseUrl: baseUrl.charAt(baseUrl.length - 1) === '/' ? baseUrl : `${baseUrl}/`,
      headers: options.headers,
      followRedirect: true,
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
  if (modifiedOptions.user) {
    httpClient.use(credentialsPlugins(modifiedOptions.plugins.credentials));
  }

  this.vCardParser = new OniyiVCardParser(modifiedOptions.vCardParser);
  this.options = modifiedOptions;
  this.httpClient = httpClient;

  this.omitDefaultRequestParams = (params, extraOmmit) => {
    if (!_.isArray(extraOmmit)) {
      extraOmmit = []; // eslint-disable-line no-param-reassign
    }
    const omit = ['uri', 'method', 'qs', 'headers'];
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
    uri: 'oauth/atom/profileService.do',
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

IbmConnectionsProfilesService.prototype.getEntry = function getEntry(query, options, callback) {
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
    uri: 'atom/profileEntry.do',
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
      uri: 'oauth/atom/profileEntry.do',
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
    self.getEntry(_.pick(entry, ['userid', 'key', 'email']), options, _.noop);
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

IbmConnectionsProfilesService.prototype.getNetworkConnections = function getNetworkConnections(query, options, callback) {
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
    uri: 'oauth/atom/connections.do',
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
    uri: 'oauth/atom/connections.do',
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
    uri: 'oauth/atom/connection.do',
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
    uri: '/follow/oauth/atom/resources',
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
    uri: '/follow/oauth/atom/resources',
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

    const resourceId = selectXPath('/atom:entry/atom:id/text()', data, true).toString();
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
    uri: '/follow/oauth/atom/resources',
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

    const resourceId = selectXPath('/atom:entry/atom:id/text()', data, true).toString();
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
    uri: '/follow/oauth/atom/resources',
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

    const editLink = selectXPath('/atom:entry/atom:link[rel="edit"]', data, true);
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
    uri: 'oauth/atom/profileTags.do',
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
    uri: 'oatuh/atom/profileTags.do',
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
  const tagsDocumentParentNode = selectXPath('app:categories', tagsDocument, true);

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

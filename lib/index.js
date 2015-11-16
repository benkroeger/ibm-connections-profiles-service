'use strict';

// native node modules
var util = require('util');
var fs = require('fs');
var path = require('path');

// 3rd party modules
var _ = require('lodash');
var async = require('async');

var OniyiHttpClient = require('oniyi-http-client');
var OniyiVCardParser = require('oniyi-vcard-parser');

var xmlUtils = require('oniyi-utils-xml');
var xmlNS = require('./xml-namespaces.json');
var parseXML = xmlUtils.parse;
var selectXPath = xmlUtils.selectUseNamespaces(xmlNS);

// local variable definitions
var profileTagCategories = require('./profile-categories.json');

var xmlTemplate = ['entry', 'follow-entry', 'make-friend', 'tags-document']
  .reduce(function (result, current) {
    result[_.camelCase(current)] = fs.readFileSync(path.join(__dirname, 'templates', current + '.xml'), {
      encoding: 'utf8'
    });
    return result;
  }, {});

// local function definition
function getAuthPath(requestOptions) {
  if (requestOptions.auth && _.isString(requestOptions.auth.bearer)) {
    return '/oauth';
  }
  return '';
}

// here begins the parser functions definition section
var responseParser = {
  profileService: function parseProfileServiceResponse(responseXML) {
    if (_.isString(responseXML)) {
      responseXML = parseXML(responseXML);
    }

    var result = {
      editableFields: Array.prototype.map.call(selectXPath('/atom:service/atom:workspace/snx:editableField', responseXML), function (element) {
        return element.getAttribute('name');
      }),
      links: {},
      services: {},
      extattrDetails: {}
    };

    var serviceNames = [
      'http://www.ibm.com/xmlns/prod/sn/service/activities',
      'http://www.ibm.com/xmlns/prod/sn/service/dogear',
      'http://www.ibm.com/xmlns/prod/sn/service/profiles',
      'http://www.ibm.com/xmlns/prod/sn/service/communities',
      'http://www.ibm.com/xmlns/prod/sn/service/files',
      'http://www.ibm.com/xmlns/prod/sn/service/wikis',
      'http://www.ibm.com/xmlns/prod/sn/service/forums',
      'http://www.ibm.com/xmlns/prod/sn/service/blogs'
    ];

    var links = [
      'http://www.ibm.com/xmlns/prod/sn/profile-type',
      'http://www.ibm.com/xmlns/prod/sn/reporting-chain',
      'http://www.ibm.com/xmlns/prod/sn/connections/colleague',
      'http://www.ibm.com/xmlns/prod/sn/status',
      'http://www.ibm.com/xmlns/prod/sn/mv/theboard',
      'http://www.ibm.com/xmlns/prod/sn/tag-cloud'
    ];

    Array.prototype.forEach.call(selectXPath('/atom:service/atom:workspace/atom:link[rel]', responseXML), function (element) {
      var rel = element.getAttribute('rel');
      var name;

      // process extension attributes
      if (rel === 'http://www.ibm.com/xmlns/prod/sn/ext-attr') {
        var extensionId = element.getAttributeNS(xmlNS.snx, 'extensionId');
        result.extattrDetails[extensionId] = {
          id: extensionId,
          type: element.getAttribute('type'),
          href: element.getAttribute('href')
        };
        return;
      }

      // process profile type links
      if (links.indexOf(rel) > -1) {
        name = rel.split('http://www.ibm.com/xmlns/prod/sn/').pop();
        result.links[name] = {
          name: name,
          rel: rel,
          type: element.getAttribute('type'),
          href: element.getAttribute('href')
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
        name: name,
        rel: rel,
        type: element.getAttribute('type'),
        href: element.getAttribute('href')
      };
    });

    return result;
  },
  profileEntry: function parseProfileEntryResponse(responseXML, parser, isEntryNode) {
    if (_.isString(responseXML)) {
      responseXML = parseXML(responseXML);
    }

    var xpathExpression = 'atom:content[@type="text"]/text()';
    if (!isEntryNode) {
      xpathExpression = '/atom:entry/' + xpathExpression;
    }

    // parse vCard String to JSON object
    var vcardString = selectXPath(xpathExpression, responseXML, true).toString();
    if (vcardString === '') {
      var error = new Error('No vcard content found in entry document');
      error.httpStatus = 404;
      throw error;
    }

    var entry = parser.toObject(vcardString);

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
      responseXML = parseXML(responseXML);
    }
    var returnValue = {};

    // extract pagination information from received XML
    var paginationLinkElements = selectXPath('/atom:feed/atom:link[@rel]', responseXML);
    if (paginationLinkElements.length > 0) {
      returnValue.paginationLinks = {};
      Array.prototype.forEach.call(paginationLinkElements, function (element) {
        returnValue.paginationLinks[element.getAttribute('rel')] = element.getAttribute('href');
      });
    }

    returnValue.totalResults = parseInt(responseXML.getElementsByTagNameNS(xmlNS.openSearch, 'totalResults')[0].textContent, null);
    returnValue.startIndex = parseInt(responseXML.getElementsByTagNameNS(xmlNS.openSearch, 'startIndex')[0].textContent, null);
    returnValue.itemsPerPage = parseInt(responseXML.getElementsByTagNameNS(xmlNS.openSearch, 'itemsPerPage')[0].textContent, null);

    returnValue.networkConnections = {};

    if (_.isString(returnValue.paginationLinks.self) && /outputType\=profile/i.test(returnValue.paginationLinks.self)) {
      Array.prototype.forEach.call(selectXPath('/atom:feed/atom:entry', responseXML), function (entryXML) {
        var entry = responseParser.profileEntry(entryXML, vCardParser, true);
        if (entry && entry.userid) {
          returnValue.networkConnections[entry.userid] = entry;
        }
      });
    } else {
      Array.prototype.forEach.call(selectXPath('/atom:feed/atom:entry', responseXML), function (entry) {
        // could also detect who initialized the connection (author vs. contributor)
        var connection = {
          id: selectXPath('atom:id/text()', entry, true).toString().split('tag:profiles.ibm.com,2006:entry').pop(),
          type: selectXPath('atom:category[@scheme="http://www.ibm.com/xmlns/prod/sn/type"]/@term', entry, true).value,
          connectionType: selectXPath('atom:category[@scheme="http://www.ibm.com/xmlns/prod/sn/connection/type"]/@term', entry, true).value,
          status: selectXPath('atom:category[@scheme="http://www.ibm.com/xmlns/prod/sn/status"]/@term', entry, true).value,
          updated: selectXPath('atom:updated/text()', entry, true).toString(),
          message: selectXPath('atom:content/text()', entry, true).toString(),
          summary: selectXPath('atom:summary/text()', entry, true).toString(),
          links: {
            self: {
              href: selectXPath('atom:link[@rel="self"]/@href', entry, true).value,
              type: selectXPath('atom:link[@rel="self"]/@type', entry, true).value
            },
            edit: {
              href: selectXPath('atom:link[@rel="edit"]/@href', entry, true).value,
              type: selectXPath('atom:link[@rel="edit"]/@type', entry, true).value
            }
          }
        };
        Array.prototype.forEach.call(entry.getElementsByTagName('contributor'), function (contributor) {
          // have to do this, because xml-utils currently don't support namespaced attribute names
          var rel = contributor.getAttributeNS(xmlNS.snx, 'rel');
          if (_.isString(rel) && rel === 'http://www.ibm.com/xmlns/prod/sn/connection/target') {
            returnValue.networkConnections[contributor.getElementsByTagNameNS(xmlNS.snx, 'userid')[0].textContent] = connection;
            return false;
          }
        });
      });
    }

    return returnValue;
  },
  followedProfiles: function parseFollowedProfilesResponse(responseXML) {
    if (_.isString(responseXML)) {
      responseXML = parseXML(responseXML);
    }

    var returnValue = {};

    // extract pagination information from received XML
    var paginationLinkElements = selectXPath('/atom:feed/atom:link[@rel]', responseXML);
    if (paginationLinkElements.length > 0) {
      returnValue.paginationLinks = {};
      Array.prototype.forEach.call(paginationLinkElements, function (element) {
        returnValue.paginationLinks[element.getAttribute('rel')] = element.getAttribute('href');
      });
    }

    returnValue.totalResults = parseInt(responseXML.getElementsByTagNameNS(xmlNS.openSearch, 'totalResults')[0].textContent, null);
    returnValue.startIndex = parseInt(responseXML.getElementsByTagNameNS(xmlNS.openSearch, 'startIndex')[0].textContent, null);
    returnValue.itemsPerPage = parseInt(responseXML.getElementsByTagNameNS(xmlNS.openSearch, 'itemsPerPage')[0].textContent, null);

    returnValue.followedProfiles = {};
    Array.prototype.forEach.call(responseXML.getElementsByTagName('entry'), function (followedEntry) {
      var followedResourceId = followedEntry.getElementsByTagName('id')[0].textContent.split('urn:lsid:ibm.com:follow:resource-')[1];
      var userid = selectXPath('category[scheme="http://www.ibm.com/xmlns/prod/sn/resource-id"]/@term', followedEntry).value;

      returnValue.followedProfiles[userid] = followedResourceId;
    });
    return returnValue;
  },
  profileTags: function parseProfileTagsResponse(responseXML) {
    if (_.isString(responseXML)) {
      responseXML = parseXML(responseXML);
    }

    var categoriesTag = responseXML.getElementsByTagNameNS(xmlNS.app, 'categories')[0];
    var categoryTags = categoriesTag.getElementsByTagNameNS(xmlNS.atom, 'category');

    var returnValue = {
      numberOfContributors: parseInt(categoriesTag.getAttributeNS(xmlNS.snx, 'numberOfContributors'), null),
      contributors: {},
      tags: []
    };

    Array.prototype.forEach.call(categoryTags, function (categoryTag) {
      var contributorTags = categoryTag.getElementsByTagNameNS(xmlNS.atom, 'contributor');
      var tag = {
        term: _.unescape(categoryTag.getAttribute('term')),
        scheme: categoryTag.getAttribute('scheme'),
        frequency: categoryTag.getAttributeNS(xmlNS.snx, 'frequency'),
        intensityBin: categoryTag.getAttributeNS(xmlNS.snx, 'intensityBin'),
        visibilityBin: categoryTag.getAttributeNS(xmlNS.snx, 'visibilityBin'),
        type: categoryTag.getAttributeNS(xmlNS.snx, 'type'),
        contributors: []
      };

      Array.prototype.forEach.call(contributorTags, function (contributorTag) {
        var contributorGuid = contributorTag.getAttributeNS(xmlNS.snx, 'profileGuid');
        var contributor = returnValue.contributors[contributorGuid] || {
          contribution: {}
        };

        _.merge(contributor, {
          key: contributorTag.getAttributeNS(xmlNS.snx, 'profileKey'),
          userid: contributorGuid,
          uid: contributorTag.getAttributeNS(xmlNS.snx, 'profileUid'),
          email: selectXPath('atom:email/text()', contributorTag, true).toString(),
          userState: selectXPath('snx:userState/text()', contributorTag, true).toString(),
          isExternal: selectXPath('snx:isExternal/text()', contributorTag, true).toString()
        });

        contributor.contribution[tag.type] = contributor.contribution[tag.type] || [];
        contributor.contribution[tag.type].push(tag.term);
        tag.contributors.push(contributor.userid);
        returnValue.contributors[contributorGuid] = contributor;
      });

      returnValue.tags.push(tag);
    });

    return returnValue;
  }
};

// the "class" definition
function IbmConnectionsProfilesService(baseUrl, options) {
  options = _.merge({
    requestOptions: {
      baseUrl: baseUrl,
      headers: {},
      followRedirect: false
    },
    vCardParser: {
      vCardToJSONAttributeMapping: {
        'ADR;WORK': 'workLocation',
        'AGENT;VALUE=X_PROFILE_UID': 'secretary',
        'CATEGORIES': 'tags',
        'EMAIL;INTERNET': 'email',
        'EMAIL;X_GROUPWARE_MAIL': 'groupwareEmail',
        'FN': 'displayName',
        'HONORIFIC_PREFIX': 'courtesyTitle',
        'N': 'names',
        'NICKNAME': 'preferredFirstName',
        'ORG': 'organizationTitle',
        'PHOTO;VALUE=URL': 'photo',
        'REV': 'lastUpdate',
        'ROLE': 'employeeTypeDesc',
        'SOUND;VALUE=URL': 'pronounciation',
        'TEL;CELL': 'mobileNumber',
        'TEL;FAX': 'faxNumber',
        'TEL;PAGER': 'pagerNumber',
        'TEL;WORK': 'telephoneNumber',
        'TEL;X_IP': 'ipTelephoneNumber',
        'TITLE': 'jobResp',
        'TZ': 'timezone',
        'UID': 'guid',
        'URL': 'url',
        'X_ALTERNATE_LAST_NAME': 'alternateLastname',
        'X_BLOG_URL;VALUE=URL': 'blogUrl',
        'X_BUILDING': 'bldgId',
        'X_COUNTRY_CODE': 'countryCode',
        'X_DEPARTMENT_NUMBER': 'deptNumber',
        'X_DEPARTMENT_TITLE': 'deptTitle',
        'X_DESCRIPTION': 'description',
        'X_EMPLOYEE_NUMBER': 'employeeNumber',
        'X_EMPTYPE': 'employeeTypeCode',
        'X_EXPERIENCE': 'experience',
        'X_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID': 'extattr',
        'X_FLOOR': 'floor',
        'X_IS_MANAGER': 'isManager',
        'X_LCONN_USERID': 'userid',
        'X_MANAGER_UID': 'managerUid',
        'X_NATIVE_FIRST_NAME': 'nativeFirstName',
        'X_NATIVE_LAST_NAME': 'nativeLastName',
        'X_OFFICE_NUMBER': 'officeName',
        'X_ORGANIZATION_CODE': 'orgId',
        'X_PAGER_ID': 'pagerId',
        'X_PAGER_PROVIDER': 'pagerServiceProvider',
        'X_PAGER_TYPE': 'pagerType',
        'X_PREFERRED_LANGUAGE': 'preferredLanguage',
        'X_PREFERRED_LAST_NAME': 'preferredLastName',
        'X_PROFILE_KEY': 'key',
        'X_PROFILE_TYPE': 'profileType',
        'X_PROFILE_UID': 'uid',
        'X_SHIFT': 'shift',
        'X_WORKLOCATION_CODE': 'workLocationCode'
      },
      complexJSONAttributes: {
        workLocation: ['skip_1', 'skip_2', 'address_1', 'address_2', 'city', 'state', 'postal_code', 'country' /* Country is not implemented for writing in Profiles API --> when reading, this value get's resolved from "countryCode" */ ],
        names: ['surname', 'givenName']
      }
    },
    ttl: {
      profileEntry: false,
      networkState: 300
    }
  }, options);

  OniyiHttpClient.call(this, options);

  this.vCardParser = new OniyiVCardParser(options.vCardParser);
  this._options = options;

  var extractRequestParams = this.extractRequestParams;
  this.extractRequestParams = function (params, additionallyOmit) {
    var omit = ['baseUrl', 'uri', 'url', 'method', 'qs'];
    if (Array.isArray(additionallyOmit)) {
      omit = omit.concat(additionallyOmit).filter(function (e, i, arr) {
        return arr.lastIndexOf(e) === i;
      });
    }
    return extractRequestParams(params, omit);
  };
}
util.inherits(IbmConnectionsProfilesService, OniyiHttpClient);

IbmConnectionsProfilesService.prototype.getServiceDocument = function getServiceDocument(query, options, callback) {
  var self = this;
  var error;

  var qsValidParameters = [
    'key', // although not documented in the API, key works as well
    'email',
    'userid'
  ];

  var requestOptions = _.merge(self.extractRequestParams(options), {
    qs: _.pick(query, qsValidParameters),
    headers: {
      accept: 'application/xml'
    }
  });

  var authPath = getAuthPath(requestOptions);

  requestOptions.uri = authPath + '/atom/profileService.do';

  var entrySelector = _.pick(requestOptions.qs, qsValidParameters);
  if (_.size(entrySelector) !== 1) {
    error = new Error(util.format('Wrong number of entry selectors provided to get editable fields: %j', entrySelector));
    error.status = 400;
    return callback(error);
  }

  self.makeRequest(requestOptions, function (err, response, body) {
    if (err) {
      return callback(err);
    }
    // expexted
    // status codes: 200, 400, 401
    // content-type: application/atomsvc+xml
    if (!response || response.statusCode !== 200 || !/application\/atomsvc\+xml/.test(response.headers['content-type'])) {
      return callback(new Error('received invalid response'));
    }

    return callback(null, responseParser.profileService(body));
  });
};

IbmConnectionsProfilesService.prototype.getEntry = function getEntry(query, options, callback) {
  var self = this;
  var error;

  var qsValidParameters = [
    'email',
    'key',
    'userid'
  ];

  // construct the request options
  var requestOptions = _.merge({
    // defining defaults in here
    qs: {
      format: 'full',
      output: 'vcard'
    }
  }, self.extractRequestParams(options), {
    qs: _.pick(query, qsValidParameters),
    headers: {
      accept: 'application/xml'
    },
    ttl: self._options.ttl.profileEntry
  });

  var authPath = getAuthPath(requestOptions);

  requestOptions.uri = authPath + '/atom/profileEntry.do';

  var entrySelector = _.pick(requestOptions.qs, ['email', 'key', 'userid']);

  if (_.size(entrySelector) !== 1) {
    error = new Error(util.format('Wrong number of entry selectors provided to receive profile entry: %j', entrySelector));
    error.status = 400;
    return callback(error);
  }

  // the makeRequest function can take two or three arguments
  // the last has to be a function
  self.makeRequest(requestOptions, function (err, response, body) {
    if (err) {
      return callback(err);
    }
    // expexted
    // status codes: 200, 403, 404
    // content-type: application/atom+xml
    if (!response || response.statusCode !== 200) {
      error = new Error(body || 'received invalid response');
      error.httpStatus = response.statausCode;
      return callback(error);
    }
    callback(null, responseParser.profileEntry(body, self.vCardParser));
  });
};

IbmConnectionsProfilesService.prototype.updateEntry = function updateEntry(entry, options, callback) {
  var self = this;
  var error;

  if (!entry || !entry.userid) {
    error = new Error(util.format('A valid profile entry must be provided and have a "userid" property %j', entry));
    error.status = 400;
    return callback(error);
  }

  return self.getServiceDocument({
    userid: entry.userid
  }, options, function (err, serviceDocument) {
    if (err) {
      return callback(err);
    }

    var editableFields = serviceDocument.editableFields;

    if (editableFields.indexOf('jobResp') > -1 && entry.jobResp && entry.jobResp.length > 128) {
      entry.jobResp = entry.jobResp.substr(0, 127);
    }

    // construct the request options
    var requestOptions = _.merge(self.extractRequestParams(options), {
      method: 'PUT',
      qs: {
        userid: entry.userid
      },
      body: util.format(xmlTemplate.entry, self.vCardParser.toVcard(entry, editableFields)),
      headers: {
        accept: 'application/atom+xml'
      }
    });

    var authPath = getAuthPath(requestOptions);

    requestOptions.uri = authPath + '/atom/profileEntry.do';

    self.makeRequest(requestOptions, function (err, response) {
      if (err) {
        return callback(err);
      }
      // expexted
      // status codes: 200, 400, 401, 403, 404
      if (!response || response.statusCode !== 200) {
        return callback(new Error('received invalid response'));
      }

      // if there are no extension attributes provided, return here
      if (!Array.isArray(entry.extattr)) {
        return callback(null, 'OK');
      }

      // make subsequent calls for all editable extension attributes
      async.each(
        entry.extattr.filter(function (extattr) {
          return editableFields.indexOf(extattr.id) > -1 && serviceDocument.extattrDetails[extattr.id];
        }),
        function (extattr, iteratorCallback) {
          var extattrDetails = serviceDocument.extattrDetails[extattr.id];
          var extAttrRequestOptions = self.extractRequestParams(requestOptions, ['body']);

          extAttrRequestOptions.uri = authPath + extattrDetails.href.split(self.requestOptions.baseUrl).pop();

          extAttrRequestOptions.method = extattr.value ? 'PUT' : 'DELETE';

          if (extAttrRequestOptions.method === 'PUT') {
            extAttrRequestOptions.body = decodeURIComponent(extattr.value);
            _.merge(extAttrRequestOptions.headers, {
              'content-type': extattrDetails.type
            });
          }
          self.makeRequest(extAttrRequestOptions, iteratorCallback);
        },
        function (err) {
          if (err) {
            return callback(err);
          }
          callback(null, 'OK');
        });
    });
  });
};

IbmConnectionsProfilesService.prototype.batchLoadEntries = function batchLoadEntries(entries, options) {
  var self = this;
  if (!Array.isArray(entries)) {
    return;
  }

  entries.forEach(function (entry) {
    self.getEntry(_.pick(entry, ['userid', 'key', 'email']), options, _.noop);
  });
};

IbmConnectionsProfilesService.prototype.getEditableFields = function getEditableFields(query, options, callback) {
  this.getServiceDocument(query, options, function (err, serviceDoc) {
    if (err) {
      return callback(err);
    }
    callback(null, serviceDoc.editableFields);
  });
};

IbmConnectionsProfilesService.prototype.getNetworkConnections = function getNetworkConnections(query, options, callback) {
  var self = this;
  var error;

  var qsValidParameters = [
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
    'sortOrder'
  ];

  // construct the request options
  var requestOptions = _.merge({
    // defining defaults in here
    qs: {
      connectionType: 'colleague',
      outputType: 'connection',
      page: 1
    }
  }, self.extractRequestParams(options), {
    qs: _.pick(query, qsValidParameters),
    headers: {
      accept: 'application/xml'
    },
    disableCache: true
  });

  var authPath = getAuthPath(requestOptions);

  requestOptions.uri = authPath + '/atom/connections.do';

  // checking validity and sanity of request options
  var entrySelector = _.pick(requestOptions.qs, 'email', 'key', 'userid');
  if (_.size(entrySelector) !== 1) {
    error = new Error(util.format('Wrong number of entry selectors provided to receive network connections: %j', entrySelector));
    error.status = 400;
    return callback(error);
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
    options.fetchAll = true;
  }

  self.makeRequest(requestOptions, function (err, response, body) {
    if (err) {
      return callback(err);
    }

    // expexted
    // status codes: 200, 403, 404
    // content-type: application/atom+xml
    if (!response || response.statusCode !== 200) {
      error = new Error(body || 'received invalid response');
      error.httpStatus = response.statausCode;
      return callback(error);
    }

    var data = responseParser.networkConnections(body, self.vCardParser);
    // if this was not a call to fetch all the entry's network connections, we're done
    if (!options.fetchAll) {
      return callback(null, data);
    }

    // if it was... but all results fit into a single request, we're done, too
    if (data.totalResults === _.size(data.networkConnections)) {
      // notify('Page 1 contains all available results');
      data.paginationLinks = undefined;
      data.startIndex = undefined;
      data.itemsPerPage = undefined;
      return callback(null, data);
    }

    // we have to request subsequent result pages in order to fetch a complete list of the entry's network connections
    var pageRequests = [];

    // run one subsequent request for each page of the result set. Instead of using the paginationLinks,
    // we simply overwrite the "page" parameter of our request's query object and execute all the requests in parallel
    // collecting all request promises in an arry
    for (var i = 2; i <= Math.ceil(data.totalResults / requestOptions.qs.ps); i++) {
      pageRequests.push(_.merge(_.clone(requestOptions), {
        qs: {
          page: i
        }
      }));
    }

    async.map(pageRequests, function (pageRequestOptions, iteratorCallback) {
      self.makeRequest(pageRequestOptions, function (err, response, body) {
        if (err) {
          return iteratorCallback(err);
        }

        // expexted
        // status codes: 200, 403, 404
        // content-type: application/atom+xml
        if (!response || response.statusCode !== 200) {
          error = new Error(body || 'received invalid response');
          error.httpStatus = response.statausCode;
          return iteratorCallback(error);
        }

        var data = responseParser.networkConnections(body, self.vCardParser);
        iteratorCallback(null, data);
      });
    }, function (err, results) {
      if (err) {
        callback(err);
      }
      var result = _.merge.apply(null, results);

      result.paginationLinks = undefined;
      result.startIndex = undefined;
      result.itemsPerPage = undefined;

      // start prefetching all involved profile entries
      self.batchLoadEntries(_.keys(result.networkConnections).map(function (userid) {
        return {
          userid: userid
        };
      }), options);

      return callback(null, result);
    });
  });
};

IbmConnectionsProfilesService.prototype.getNetworkState = function getNetworkState(query, options, callback) {
  var self = this;
  var error;

  var networkStatusHeaderName = 'x-profiles-connection-status';

  var qsValidParameters = [
    'targetUserid',
    'targetEmail',
    'targetKey',
    'sourceUserid',
    'sourceEmail',
    'sourceKey'
  ];

  // construct the request options
  var requestOptions = _.merge({
    qs: {
      connectionType: 'colleague'
    }
  }, self.extractRequestParams(options), {
    method: 'HEAD',
    qs: _.pick(query, qsValidParameters),
    ttl: self._options.ttl.networkState,
    responseValidators: [function (response, evaluator) {
      // overriding cache storable validation
      // ibm connections sends an HTTP/404 as response to HEAD requests if the two people are no network contacts
      if (response.statusCode === 404) {
        evaluator.flagStorable(true);
        return true;
      }
      return false;
    }]
  });

  var authPath = getAuthPath(requestOptions);

  requestOptions.uri = authPath + '/atom/connection.do';

  var targetSelector = _.pick(requestOptions.qs, 'targetUserid', 'targetEmail', 'targetKey');
  if (_.size(targetSelector) !== 1) {
    error = new Error(util.format('Wrong number of targetEntry selectors provided to receive network state: %j', targetSelector));
    error.status = 400;
    return callback(error);
  }
  var sourceSelector = _.pick(requestOptions.qs, 'sourceUserid', 'sourceEmail', 'sourceKey');
  if (_.size(sourceSelector) !== 1) {
    error = new Error(util.format('Wrong number of sourceEntry selectors provided to receive network state: %j', sourceSelector));
    error.status = 400;
    return callback(error);
  }

  self.makeRequest(requestOptions, function (err, response) {
    if (err) {
      return callback(err);
    }
    if (response.statusCode === 404) {
      return callback(null, false);
    }
    if (response.headers[networkStatusHeaderName] && ['accepted', 'pending', 'unconfirmed'].indexOf(response.headers[networkStatusHeaderName]) > -1) {
      return callback(null, response.headers[networkStatusHeaderName]);
    }
    callback(new Error('No valid network status found'));
  });
};

IbmConnectionsProfilesService.prototype.inviteNetworkContact = function inviteNetworkContact(query, options, callback) {
  var self = this;
  var error;

  var qsValidParameters = [
    'userid'
  ];

  // construct the request options
  var requestOptions = _.merge({
    qs: {
      connectionType: 'colleague'
    }
  }, self.extractRequestParams(options), {
    method: 'POST',
    qs: _.pick(query, qsValidParameters),
    headers: {
      'content-type': 'application/atom+xml'
    },
    body: util.format(xmlTemplate.makeFriend, options.message)
  });

  var authPath = getAuthPath(requestOptions);

  requestOptions.uri = authPath + '/atom/connection.do';

  self.makeRequest(requestOptions, function (err, response) {
    if (err) {
      return callback(err);
    }
    if (response.statusCode === 400) {
      // logDebug('There is a pending invitation from {%s} to {%s} already', sourceentry.userid, targetentry.userid);
      error = new Error('A pending invitation exists already');
      error.httpStatus = 400;
      return callback(error);
    }
    if (response.statusCode === 200) {
      // logDebug('Successfully created invite from {%s} to {%s}', sourceentry.userid, targetentry.userid);
      return callback(null, 'pending');
    }
    callback(response.statusCode);
  });
};

IbmConnectionsProfilesService.prototype.removeFromNetwork = function removeFromNetwork(query, options, callback){
  return callback(new Error('not implemented'));
  // resolve authenticated user
  // query: sourceUser, targetUser
  // get connection.do
  // extract edit href
  // send delete request to edit href
};

IbmConnectionsProfilesService.prototype.getFollowedProfiles = function getFollowedProfiles(query, options, callback) {
  var self = this;
  var error;

  var qsValidParameters = [
    'page',
    'ps',
    'resource'
  ];

  // construct the request options
  var requestOptions = _.merge({
    // defining defaults in here
    qs: {
      type: 'profile',
      source: 'profiles',
      page: 1
    }
  }, self.extractRequestParams(options), {
    qs: _.pick(query, qsValidParameters),
    headers: {
      accept: 'application/xml'
    }
  });

  var authPath = getAuthPath(requestOptions);

  requestOptions.uri = '/follow' + authPath + '/atom/resources';

  // the connections API does not allow page-sizes larger than 20
  // if fetchAll is set to "true", we increase the page size to maximum
  if (options.fetchAll) {
    requestOptions.qs.page = 1;
    requestOptions.qs.ps = 20;
  } else if (_.isNumber(requestOptions.qs.ps) && requestOptions.qs.ps > 20) {
    requestOptions.qs.ps = 20;
    options.fetchAll = true;
  }

  self.makeRequest(requestOptions, function (err, response, body) {
    if (err) {
      return callback(err);
    }

    // expexted
    // status codes: 200, 403, 404
    // content-type: application/atom+xml
    if (!response || response.statusCode !== 200) {
      error = new Error(body || 'received invalid response');
      error.httpStatus = response.statausCode;
      return callback(error);
    }

    var data = responseParser.followedProfiles(body);
    // if this was not a call to fetch all the entry's network connections, we're done
    if (!options.fetchAll) {
      return callback(null, data);
    }

    // if it was... but all results fit into a single request, we're don, too
    if (data.totalResults === _.size(data.followedProfiles)) {
      // notify('Page 1 contains all available results');
      data.paginationLinks = undefined;
      data.startIndex = undefined;
      data.itemsPerPage = undefined;
      return callback(null, data);
    }

    // we have to request subsequent result pages in order to fetch a complete list of the followed resources
    var pageRequests = [];

    // run one subsequent request for each page of the result set. Instead of using the paginationLinks,
    // we simply overwrite the "page" parameter of our request's query object and execute all the requests in parallel
    // collecting all request promises in an arry
    for (var i = 2; i <= Math.ceil(data.totalResults / requestOptions.qs.ps); i++) {
      pageRequests.push(_.merge(_.clone(requestOptions), {
        qs: {
          page: i
        }
      }));
    }

    async.map(pageRequests, function (pageRequestOptions, iteratorCallback) {
      self.makeRequest(pageRequestOptions, function (err, response, body) {
        if (err) {
          return iteratorCallback(err);
        }

        // expexted
        // status codes: 200, 403, 404
        // content-type: application/atom+xml
        if (!response || response.statusCode !== 200) {
          error = new Error(body || 'received invalid response');
          error.httpStatus = response.statausCode;
          return iteratorCallback(error);
        }

        var data = responseParser.followedProfiles(body); // , self.vCardParser);
        iteratorCallback(null, data);
      });
    }, function (err, results) {
      if (err) {
        callback(err);
      }
      var result = _.merge.apply(null, results);

      result.paginationLinks = undefined;
      result.startIndex = undefined;
      result.itemsPerPage = undefined;

      // start prefetching all involved profile entries
      self.batchLoadEntries(_.keys(result.followedProfiles).map(function (userid) {
        return {
          userid: userid
        };
      }), options);

      return callback(null, result);
    });
  });
};

IbmConnectionsProfilesService.prototype.getFollowState = function getFollowState(userid, options, callback) {
  var self = this;
  var error;

  // construct the request options
  var requestOptions = _.merge(self.extractRequestParams(options), {
    qs: {
      type: 'profile',
      source: 'profiles',
      resource: userid
    },
    disableCache: true
  });

  var authPath = getAuthPath(requestOptions);

  requestOptions.uri = '/follow' + authPath + '/atom/resources';

  self.makeRequest(requestOptions, function (err, response, body) {
    if (err) {
      return callback(err);
    }
    // expexted
    // status codes: 200, 403, 404
    // content-type: application/atom+xml
    if (!response || response.statusCode !== 200) {
      error = new Error(body || 'received invalid response');
      error.httpStatus = response.statausCode;
      return callback(error);
    }

    var data = parseXML(body);

    var resourceId = selectXPath('/atom:entry/atom:id/text()', data, true).toString();
    if (resourceId) {
      var validator = new RegExp('urn:lsid:ibm.com:follow:resource-' + userid, 'i');
      return callback(null, validator.test(resourceId));
    }

    callback(null, false);
  });
};

IbmConnectionsProfilesService.prototype.follow = function follow(query, options, callback) {
  var self = this;
  var error;

  if (!query.targetUserid) {
    error = new Error('entry.targetUserid must be provided');
    error.httpStatus = 400;
    return callback(error);
  }

  // construct the request options
  var requestOptions = _.merge(self.extractRequestParams(options), {
    method: 'POST',
    qs: {
      type: 'profile',
      source: 'profiles'
    },
    body: util.format(xmlTemplate.followEntry, query.targetUserid),
    headers: {
      'content-type': 'application/atom+xml'
    }
  });

  var authPath = getAuthPath(requestOptions);

  requestOptions.uri = '/follow' + authPath + '/atom/resources';

  self.makeRequest(requestOptions, function (err, response, body) {
    if (err) {
      return callback(err);
    }
    // expexted
    // status codes: 200, 403, 404
    // content-type: application/atom+xml
    if (!response || response.statusCode !== 200) {
      error = new Error(body || 'received invalid response');
      error.httpStatus = response.statausCode;
      return callback(error);
    }
    var data = parseXML(body);

    var resourceId = selectXPath('/atom:entry/atom:id/text()', data, true).toString();
    if (resourceId) {
      var validator = new RegExp('urn:lsid:ibm.com:follow:resource-' + query.targetUserid, 'i');
      return callback(null, validator.test(resourceId));
    }
  });
};

IbmConnectionsProfilesService.prototype.unfollow = function unfollow(query, options, callback) {
  var self = this;
  var error;

  if (!query.targetUserid) {
    error = new Error('query.targetUserid must be provided');
    error.httpStatus = 400;
    return callback(error);
  }

  // construct the request options
  var requestOptions = _.merge(self.extractRequestParams(options), {
    qs: {
      type: 'profile',
      source: 'profiles',
      resource: query.targetUserid
    }
  });

  var authPath = getAuthPath(requestOptions);

  requestOptions.uri = '/follow' + authPath + '/atom/resources';

  self.makeRequest(requestOptions, function (err, response, body) {
    if (err) {
      return callback(err);
    }
    // expexted
    // status codes: 200, 403, 404
    // content-type: application/atom+xml
    if (!response || response.statusCode !== 200) {
      error = new Error(body || 'received invalid response');
      error.httpStatus = response.statausCode;
      return callback(error);
    }
    var data = parseXML(body);

    var editLink = selectXPath('/atom:entry/atom:link[rel="edit"]', data, true);
    if (!(editLink && editLink.getAttribute('href'))) {
      error = new Error('Can not find followed resource: ' + query.targetUserid);
      error.httpStatus = 400;
      return callback(error);
    }

    var href = editLink.getAttribute('href').split(self.requestOptions.baseUrl).pop();

    self.makeRequest(_.merge(requestOptions, {
      uri: href
    }), function (err, response) {
      if (err) {
        return callback(err);
      }
      // expexted
      // status codes: 204, 400, 403, 404
      // content-type: application/atom+xml
      if (!response || response.statusCode !== 204) {
        error = new Error(body || 'received invalid response');
        error.httpStatus = response.statausCode;
        return callback(error);
      }
      callback(null, true);
    });
  });
};

IbmConnectionsProfilesService.prototype.getTags = function getTags(query, options, callback) {
  var self = this;
  var error;

  var qsValidParameters = [
    'targetUserid',
    'targetEmail',
    'targetKey',
    'sourceUserid',
    'sourceEmail',
    'sourceKey',
    'format',
    'lastMod'
  ];

  // construct the request options
  var requestOptions = _.merge({
    ttl: 1800
  }, self.extractRequestParams(options), {
    qs: _.pick(query, qsValidParameters),
    headers: {
      accept: 'application/xml'
    }
  });

  var authPath = getAuthPath(requestOptions);

  requestOptions.uri = authPath + '/atom/profileTags.do';

  var targetSelector = _.pick(requestOptions.qs, ['targetUserid', 'targetEmail', 'targetKey']);
  if (_.size(targetSelector) !== 1) {
    error = new Error(util.format('Wrong number of targetEntry selectors provided to receive tags: %j', targetSelector));
    error.status = 400;
    return callback(error);
  }
  var sourceSelector = _.pick(requestOptions.qs, ['sourceUserid', 'sourceEmail', 'sourceKey']);
  if (_.size(sourceSelector) > 1) {
    error = new Error(util.format('Wrong number of sourceEntry selectors provided to receive tags: %j', sourceSelector));
    error.status = 400;
    return callback(error);
  }

  // format will be ignores on server if a valid sourceSelector was provided
  if (_.isString(requestOptions.qs.format) && ['lite', 'full'].indexOf(requestOptions.qs.format) < 0) {
    requestOptions.qs.format = 'lite';
  }

  self.makeRequest(requestOptions, function (err, response, body) {
    if (err) {
      return callback(err);
    }
    // expexted
    // status codes: 200, 403, 404
    // content-type: application/atom+xml
    if (!response || response.statusCode !== 200) {
      error = new Error(body || 'received invalid response');
      error.httpStatus = response.statausCode;
      return callback(error);
    }

    var data = responseParser.profileTags(body);

    // start prefetching all involved profile entries
    if (data.contributors) {
      self.batchLoadEntries(Object.keys(data.contributors).map(function (userid) {
        return {
          userid: userid
        };
      }), options);
    }

    callback(null, data);
  });
};

IbmConnectionsProfilesService.prototype.updateTags = function updateTags(query, tags, options, callback) {
  var self = this;
  var error;

  if (!Array.isArray(tags)) {
    error = new Error('an Array of tags must be provided');
    error.status = 400;
    return callback(error);
  }

  var qsValidParameters = [
    'targetUserid',
    'targetEmail',
    'targetKey',
    'sourceUserid',
    'sourceEmail',
    'sourceKey'
  ];

  // construct the request options
  var requestOptions = _.merge(self.extractRequestParams(options), {
    method: 'PUT',
    qs: _.pick(query, qsValidParameters),
    headers: {
      'content-type': 'application/atom+xml'
    }
  });

  var authPath = getAuthPath(requestOptions);

  requestOptions.uri = authPath + '/atom/profileTags.do';

  var targetSelector = _.pick(requestOptions.qs, ['targetUserid', 'targetEmail', 'targetKey']);
  if (_.size(targetSelector) !== 1) {
    error = new Error(util.format('Wrong number of targetEntry selectors provided to update tags: %j', targetSelector));
    error.status = 400;
    return callback(error);
  }
  var sourceSelector = _.pick(requestOptions.qs, ['sourceUserid', 'sourceEmail', 'sourceKey']);
  if (_.size(sourceSelector) > 1) {
    error = new Error(util.format('Wrong number of sourceEntry selectors provided to update tags: %j', sourceSelector));
    error.status = 400;
    return callback(error);
  }

  var tagsDocument = parseXML(xmlTemplate.tagsDocument);
  var tagsDocumentParentNode = selectXPath('app:categories', tagsDocument, true);

  tags.forEach(function (tag) {
    var xmlTag = tagsDocument.createElement('atom:category');
    if (_.isString(tag)) {
      tag = {
        term: tag
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

  self.makeRequest(requestOptions, function (err, response) {
    if (err) {
      return callback(err);
    }
    // expexted
    // status codes: 200, 400
    // content-type: application/atom+xml
    if (!response || response.statusCode !== 200) {
      error = new Error('received invalid response');
      error.httpStatus = response.statausCode;
      return callback(error);
    }
    callback(null, true);
  });
};

IbmConnectionsProfilesService.prototype.addTags = function addTags(query, tags, options, callback) {
  var self = this;
  var error;

  if (!Array.isArray(tags)) {
    error = new Error('an Array of tags must be provided');
    error.status = 400;
    return callback(error);
  }

  // @TODO: resolve userid of authenticated user and attach to query.sourceUserid
  var sourceSelector = _.pick(query, ['sourceUserid', 'sourceEmail', 'sourceKey']);
  if (_.size(sourceSelector) > 1) {
    error = new Error(util.format('Wrong number of sourceEntry selectors provided to update tags: %j', sourceSelector));
    error.status = 400;
    return callback(error);
  }

  options.disableCache = true;

  return self.getTags(query, options, function (err, existingTags) {
    if (err) {
      return callback(err);
    }

    // normalize old tags
    var oldTags = existingTags.tags.map(function (tag) {
      return _.pick(tag, ['term', 'type']);
    });

    // normalize new tags
    var newTags = tags.map(function (tag) {
      if (_.isString(tag)) {
        tag = {
          term: tag
        };
      }
      return tag;
    });

    // union new and old tags
    // put new set of tags to the API
    return self.updateTags(query, _.union(newTags, oldTags), options, callback);
  });
};

IbmConnectionsProfilesService.prototype.removeTags = function removeTags(query, tags, options, callback) {
  var self = this;
  var error;

  if (!Array.isArray(tags)) {
    error = new Error('an Array of tags must be provided');
    error.status = 400;
    return callback(error);
  }

  // @TODO: resolve userid of authenticated user and attach to query.sourceUserid
  var sourceSelector = _.pick(query, ['sourceUserid', 'sourceEmail', 'sourceKey']);
  if (_.size(sourceSelector) > 1) {
    error = new Error(util.format('Wrong number of sourceEntry selectors provided to update tags: %j', sourceSelector));
    error.status = 400;
    return callback(error);
  }

  options.disableCache = true;

  return self.getTags(query, options, function (err, existingTags) {
    if (err) {
      return callback(err);
    }

    // normalize old tags
    // in this case, we create strings from all tag objects
    // --> easier to compare
    var oldTags = existingTags.tags.map(function (tag) {
      return JSON.stringify(_.pick(tag, 'term', 'type'));
    });

    // normalize new tags
    var removeTags = tags.map(function (tag) {
      if (_.isString(tag)) {
        tag = {
          term: tag
        };
      }
      if (!_.isString(tag.type)) {
        tag.type = 'general';
      }
      return JSON.stringify(tag);
    });

    // determine difference between old and to-be-removed tags
    // put new set of tags to the API
    return self.updateTags(query, _.difference(oldTags, removeTags).map(function (tag) {
      return JSON.parse(tag);
    }), options, callback);
  });
};

module.exports = IbmConnectionsProfilesService;
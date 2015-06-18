'use strict';

// native node modules
var util = require('util');

// 3rd party modules
var _ = require('lodash'),
  q = require('q'),
  OniyiHttpClient = require('oniyi-http-client'),
  OniyiVCardParser = require('oniyi-vcard-parser');

var xml = require('./lib/xml-utils');

// local variable definitions
var xmlTemplate = {
    entry: '<entry xmlns="http://www.w3.org/2005/Atom"><category term="profile" scheme="http://www.ibm.com/xmlns/prod/sn/type"></category><content type="text">%s</content></entry>',
    followEntry: '<entry xmlns="http://www.w3.org/2005/Atom"><category term="profiles" scheme="http://www.ibm.com/xmlns/prod/sn/source"></category><category term="profile" scheme="http://www.ibm.com/xmlns/prod/sn/resource-type"></category><category term="%s" scheme="http://www.ibm.com/xmlns/prod/sn/resource-id"></category></entry>',
    makeFriend: '<?xml version="1.0" encoding="UTF-8"?><entry xmlns="http://www.w3.org/2005/Atom" xmlns:snx="http://www.ibm.com/xmlns/prod/sn"><category term="connection" scheme="http://www.ibm.com/xmlns/prod/sn/type" /><category term="colleague" scheme="http://www.ibm.com/xmlns/prod/sn/connection/type" /><category term="pending" scheme="http://www.ibm.com/xmlns/prod/sn/status" /><!-- Message to other user --><content type="html">%s</content></entry>',
    tagsDoc: '<app:categories xmlns:atom="http://www.w3.org/2005/Atom" xmlns:app="http://www.w3.org/2007/app" xmlns:snx="http://www.ibm.com/xmlns/prod/sn"></app:categories>'
  },
  profileTagCategories = {
    general: false,
    industries: 'http://www.ibm.com/xmlns/prod/sn/scheme/industries',
    clients: 'http://www.ibm.com/xmlns/prod/sn/scheme/clients',
    skills: 'http://www.ibm.com/xmlns/prod/sn/scheme/skills'
  },
  xmlNS = xml.nameSpaces;

// local function definition
function getAuthPath(requestOptions) {
  if (requestOptions.auth && _.isString(requestOptions.auth.bearer)) {
    return '/oauth';
  }
  return '';
}

function extractDataFromRequestPromise(response, data) {
  // just returning data here
  return data;
}

// here begins the parser functions definition section
var responseParser = {
  profileService: function parseProfileServiceResponse(responseXML) {
    if (_.isString(responseXML)) {
      responseXML = xml.parse(responseXML);
    }

    var result = {
      editableFields: Array.prototype.map.call(responseXML.getElementsByTagNameNS(xmlNS.snx, 'editableField'), function(element) {
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

    Array.prototype.forEach.call(responseXML.getElementsByTagNameNS(xmlNS.atom, 'link'), function(element) {
      if (!element.hasAttribute('rel')) {
        return;
      }

      var rel = element.getAttribute('rel'),
        name;

      // process extension attributes
      if (rel === 'http://www.ibm.com/xmlns/prod/sn/ext-attr') {
        var extensionId = element.getAttributeNS(xmlNS.snx, 'extensionId');
        result.extattrDetails[extensionId] = {
          name: extensionId,
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
  profileEntry: function parseProfileEntryResponse(responseXML, parser) {
    if (_.isString(responseXML)) {
      responseXML = xml.parse(responseXML);
    }

    // parse vCard String to JSON object
    var entry = parser.toObject((xml.find(responseXML, 'content[type="text"]')[0]).textContent);

    // parsing tags
    if (_.isString(entry.tags)) {
      if (entry.tags.length > 0) {
        entry.tags = entry.tags.split(',');
      }
    }
    if (!Array.isArray(entry.tags)) {
      entry.tags = [];
    }

    // also not implemented in xml library yet
    // parse extension attributes
    entry.extattrDetails = {};
    xml.find(responseXML, 'link[rel="http://www.ibm.com/xmlns/prod/sn/ext-attr"]').forEach(function(val) {
      var extensionId = val.getAttributeNS(xmlNS.snx, 'extensionId');
      entry.extattrDetails[extensionId] = {
        name: extensionId,
        type: val.getAttribute('type'),
        href: val.getAttribute('href'),
        content: entry.extattr[extensionId] || false
      };
    });

    return entry;
  },
  networkConnections: function parseNetworkConnectionsResponse(responseXML, vCardParser) {
    if (_.isString(responseXML)) {
      responseXML = xml.parse(responseXML);
    }
    var returnValue = {};


    // extract pagination information from received XML
    var paginationLinkElements = xml.select('//atom:feed/atom:link[@class="vcard"]', responseXML);
    // var paginationLinkElements = xml.select(responseXML, util.format("/*[local-name()='feed' and namespace-uri()='%s']/*[local-name()='link' and namespace-uri()='%s']", xmlNS.atom, xmlNS.atom));
    if (paginationLinkElements.length > 0) {
      returnValue.paginationLinks = {};
      Array.prototype.forEach.call(paginationLinkElements, function(element) {
        returnValue.paginationLinks[element.getAttribute('rel')] = element.getAttribute('href');
      });
    }

    returnValue.totalResults = parseInt(responseXML.getElementsByTagNameNS(xmlNS.openSearch, 'totalResults')[0].textContent, null);
    returnValue.startIndex = parseInt(responseXML.getElementsByTagNameNS(xmlNS.openSearch, 'startIndex')[0].textContent, null);
    returnValue.itemsPerPage = parseInt(responseXML.getElementsByTagNameNS(xmlNS.openSearch, 'itemsPerPage')[0].textContent, null);

    returnValue.networkConnections = {};

    if (_.isString(returnValue.paginationLinks.self) && returnValue.paginationLinks.self.containsIgnoreCase('outputType=profile')) {
      Array.prototype.forEach.call(responseXML.getElementsByTagName('entry'), function(entryXML) {
        var entry = responseParser.profileEntry(entryXML, vCardParser);
        if (entry && entry.userid) {
          returnValue.networkConnections[entry.userid] = entry;
        }
      });
    } else {
      Array.prototype.forEach.call(responseXML.getElementsByTagName('entry'), function(entry) {
        // could also detect who initialized the connection (author vs. contributor)
        var connection = {
          id: entry.getElementsByTagName('id')[0].textContent.substringFrom('tag:profiles.ibm.com,2006:entry'),
          type: (xml.find(entry, 'category[scheme="http://www.ibm.com/xmlns/prod/sn/type"]')[0]).getAttribute('term'),
          connectionType: (xml.find(entry, 'category[scheme="http://www.ibm.com/xmlns/prod/sn/connection/type"]')[0]).getAttribute('term'),
          status: (xml.find(entry, 'category[scheme="http://www.ibm.com/xmlns/prod/sn/status"]')[0]).getAttribute('term'),
          updated: entry.getElementsByTagName('updated')[0].textContent,
          message: entry.getElementsByTagName('content')[0].textContent,
          summary: entry.getElementsByTagName('summary')[0].textContent,
          links: {
            self: {
              href: (xml.find(entry, 'link[rel="self"]')[0]).getAttribute('href'),
              type: (xml.find(entry, 'link[rel="self"]')[0]).getAttribute('type')
            },
            edit: {
              href: (xml.find(entry, 'link[rel="edit"]')[0]).getAttribute('href'),
              type: (xml.find(entry, 'link[rel="edit"]')[0]).getAttribute('type')
            }
          }
        };
        Array.prototype.forEach.call(entry.getElementsByTagName('contributor'), function(contributor) {
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
      responseXML = xml.parse(responseXML);
    }

    var returnValue = {};

    // extract pagination information from received XML
    var paginationLinkElements = xml.select('//atom:feed/atom:link[@class="vcard"]', responseXML);
    // var paginationLinkElements = xml.select(responseXML, util.format("/*[local-name()='feed' and namespace-uri()='%s']/*[local-name()='link' and namespace-uri()='%s']", xmlNS.atom, xmlNS.atom));
    if (paginationLinkElements.length > 0) {
      returnValue.paginationLinks = {};
      Array.prototype.forEach.call(paginationLinkElements, function(element) {
        returnValue.paginationLinks[element.getAttribute('rel')] = element.getAttribute('href');
      });
    }

    returnValue.totalResults = parseInt(responseXML.getElementsByTagNameNS(xmlNS.openSearch, 'totalResults')[0].textContent, null);
    returnValue.startIndex = parseInt(responseXML.getElementsByTagNameNS(xmlNS.openSearch, 'startIndex')[0].textContent, null);
    returnValue.itemsPerPage = parseInt(responseXML.getElementsByTagNameNS(xmlNS.openSearch, 'itemsPerPage')[0].textContent, null);

    returnValue.followedProfiles = {};
    Array.prototype.forEach.call(responseXML.getElementsByTagName('entry'), function(followedEntry) {
      var followedResourceId = followedEntry.getElementsByTagName('id')[0].textContent.split('urn:lsid:ibm.com:follow:resource-')[1];
      var userid = xml.find(followedEntry, 'category[scheme="http://www.ibm.com/xmlns/prod/sn/resource-id"]')[0].getAttribute('term');

      returnValue.followedProfiles[userid] = followedResourceId;
    });
    return returnValue;
  },
  profileTags: function parseProfileTagsResponse(responseXML) {
    if (_.isString(responseXML)) {
      responseXML = xml.parse(responseXML);
    }

    var categoriesTag = responseXML.getElementsByTagNameNS(xmlNS.app, 'categories')[0];
    var categoryTags = categoriesTag.getElementsByTagNameNS(xmlNS.atom, 'category');

    var returnValue = {
      numberOfContributors: parseInt(categoriesTag.getAttributeNS(xmlNS.snx, 'numberOfContributors'), null),
      contributors: {},
      tags: []
    };

    Array.prototype.forEach.call(categoryTags, function(categoryTag) {
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

      Array.prototype.forEach.call(contributorTags, function(contributorTag) {
        var contributorGuid = contributorTag.getAttributeNS(xmlNS.snx, 'profileGuid');
        var contributor = returnValue.contributors[contributorGuid] || {
          contribution: {}
        };

        _.merge(contributor, {
          key: contributorTag.getAttributeNS(xmlNS.snx, 'profileKey'),
          userid: contributorGuid,
          uid: contributorTag.getAttributeNS(xmlNS.snx, 'profileUid'),
          email: (contributorTag.getElementsByTagNameNS(xmlNS.atom, 'email')[0]).textContent,
          userState: (contributorTag.getElementsByTagNameNS(xmlNS.snx, 'userState')[0]).textContent,
          isExternal: (contributorTag.getElementsByTagNameNS(xmlNS.snx, 'isExternal')[0]).textContent
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
  var self = this;

  options = _.merge({
    requestOptions: {
      baseUrl: baseUrl,
      headers: {
        'user-agent': 'Mozilla/5.0'
      }
    },
    vCardParser: {
      vCardToJSONAttributeMapping: {
        'ADR;WORK': 'workLocation',
        'AGENT;VALUE=X_PROFILE_UID': false,
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
        'TEL;PAGER': 'ipTelephoneNumber',
        'TEL;WORK': 'telephoneNumber',
        'TEL;X_IP': 'ipTelephoneNumber',
        'TITLE': 'jobResp',
        'TZ': 'timezone',
        'UID': 'uid',
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
        'X_SHIFT': false,
        'X_WORKLOCATION_CODE': 'workLocationCode'
      },
      complexJSONAttributes: {
        workLocation: ['skip_1', 'skip_2', 'address_1', 'address_2', 'city', 'state', 'postal_code' /*, 'country' Country is not implemented in Profiles API yet*/ ],
        names: ['surname', 'givenName']
      }
    }
  }, options);

  OniyiHttpClient.call(self, options);

  self.vCardParser = new OniyiVCardParser(options.vCardParser);
}
util.inherits(IbmConnectionsProfilesService, OniyiHttpClient);

IbmConnectionsProfilesService.prototype.getServiceDocument = function(options) {
  var self = this;
  var error;

  var qsValidParameters = [
    'key', // although not documented in the API, key works as well
    'email',
    'userid'
  ];

  var requestOptions = _.merge(self.extractRequestParams(options), {
    qs: _.pick(options, qsValidParameters),
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
    return q.reject(error);
  }

  return q.ninvoke(self, 'makeRequest', requestOptions)
    .spread(function(response, body) {
      // expexted
      // status codes: 200, 400, 401
      // content-type: application/atomsvc+xml
      if (!response || response.statusCode !== 200 ||  !/application\/atomsvc\+xml/.test(response.headers['content-type'])) {
        return q.reject(new Error('received invalid response'));
      }
      return responseParser.profileService(body);
    });
};

IbmConnectionsProfilesService.prototype.getEntry = function(options) {
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
  }, self.extractRequestParams(options, ['baseUrl', 'uri', 'method', 'qs']), {
    qs: _.pick(options, qsValidParameters),
    headers: {
      accept: 'application/xml'
    }
  });

  var authPath = getAuthPath(requestOptions);

  requestOptions.uri = authPath + '/atom/profileEntry.do';

  var entrySelector = _.pick(requestOptions.qs, ['email', 'key', 'userid']);

  if (_.size(entrySelector) !== 1) {
    error = new Error(util.format('Wrong number of entry selectors provided to receive profile entry: %j', entrySelector));
    error.status = 400;
    return q.reject(error);
  }

  // the makeRequest function can take two or three arguments
  // the last has to be a function (which is done by q.ninvoke --> passes a callback with node conventions (err, data))
  return q.ninvoke(self, 'makeRequest', requestOptions)
    .spread(function(response, body) {
      // expexted
      // status codes: 200, 403, 404
      // content-type: application/atom+xml
      if (!response || response.statusCode !== 200) {
        return q.reject(new Error('received invalid response'));
      }
      return responseParser.profileEntry(body, self.vCardParser);
    });
};

IbmConnectionsProfilesService.prototype.updateEntry = function(options) {
  var self = this;
  var error;

  var entry = options.entry;

  if (!entry || !entry.userid) {
    error = new Error(util.format('A valid profile entry must be provided and have a "userid" property %j', entry));
    error.status = 400;
    return q.reject(error);
  }

  return self.getEditableFields(_.merge({}, options, {
      userid: entry.userid
    }))
    .then(function(editableFields) {
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

      return q.ninvoke(self, 'makeRequest', requestOptions)
        .spread(function(response) {
          // expexted
          // status codes: 200, 400, 401, 403, 404
          if (!response || response.statusCode !== 200) {
            return q.reject(new Error('received invalid response'));
          }
          // make subsequent calls for all editable extension attributes
          var promisesArray = _.map(entry.extattrDetails, function(extAttr) {
            if (editableFields.indexOf(extAttr.name) > -1) {
              var extAttrRequestOptions = _.omit(_.clone(requestOptions), ['qs', 'body', 'method']);

              extAttrRequestOptions.uri = authPath + extAttr.href.substringFrom(self.requestOptions.baseUrl);

              extAttrRequestOptions.method = (entry.extattr[extAttr.name]) ? 'PUT' : 'DELETE';

              if (extAttrRequestOptions.method === 'PUT') {
                extAttrRequestOptions.body = decodeURIComponent(entry.extattr[extAttr.name]);
                _.merge(extAttrRequestOptions.headers, {
                  'content-type': extAttr.type
                });
              }
              return q.ninvoke(self, 'makeRequest', extAttrRequestOptions);
            }
          });
          return q.all(promisesArray);
        });
    });
};

IbmConnectionsProfilesService.prototype.batchLoadEntries = function(entries, options) {
  var self = this;
  if (!_.isArray(entries)) {
    return;
  }

  entries.forEach(function(entry) {
    self.getEntry(_.merge({}, options, _.pick(entry, ['userid', 'key', 'email'])));
  });
};

IbmConnectionsProfilesService.prototype.getEditableFields = function(options) {
  var self = this;

  return self.getServiceDocument(options)
    .then(function(serviceDoc) {
      return serviceDoc.editableFields;
    });
};

IbmConnectionsProfilesService.prototype.getNetworkConnections = function(options) {
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
    },
  }, self.extractRequestParams(options), {
    qs: _.pick(options, qsValidParameters),
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
    return q.reject(error);
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
  if (options.fetchAll) {
    requestOptions.qs.page = 1;
    requestOptions.qs.ps = 250;
  } else if (_.isNumber(requestOptions.qs.ps) && requestOptions.qs.ps > 250) {
    requestOptions.qs.ps = 250;
    options.fetchAll = true;
  }


  var promise = q.ninvoke(self, 'makeRequest', requestOptions)
    .spread(extractDataFromRequestPromise)
    .then(responseParser.networkConnections, self.vCardParser)
    .then(function(data) {
      // if this was not a call to fetch all the entry's network connections, we're done
      if (!options.fetchAll) {
        return data;
      }

      // if it was... but all results fit into a single request, we're don, too
      if (data.totalResults === _.size(data.networkConnections)) {
        // notify('Page 1 contains all available results');
        data.paginationLinks = undefined;
        data.startIndex = undefined;
        data.itemsPerPage = undefined;
        return data;
      }

      // we have to request subsequent result pages in order to fetch a complete list of the entry's network connections
      var promisesArray = [q(data)];

      // run one subsequent request for each page of the result set. Instead of using the paginationLinks,
      // we simply overwrite the "page" parameter of our request's query object and execute all the requests in parallel
      // collecting all request promises in an arry
      for (var i = 2; i <= Math.ceil(data.totalResults / requestOptions.qs.ps); i++) {
        var pageRequestOptions = _.merge(_.clone(requestOptions), {
          qs: {
            page: i
          }
        });

        promisesArray.push(q.ninvoke(self, 'makeRequest', pageRequestOptions)
          .spread(extractDataFromRequestPromise)
          .then(responseParser.networkConnections, self.vCardParser));
      }

      return q.all(promisesArray).then(function(results) {
        var result = _.merge.apply(null, results);

        result.paginationLinks = undefined;
        result.startIndex = undefined;
        result.itemsPerPage = undefined;

        return result;
      });
    });

  // when promise is fulfilled, start prefetching all involved profile entries
  promise.then(function(result) {
    self.batchLoadEntries(_.keys(result.networkConnections).map(function(userid) {
      return {
        userid: userid
      };
    }), options);
  });

  return promise;
};

IbmConnectionsProfilesService.prototype.getNetworkState = function getNetworkState(options) {
  var self = this;
  var error;

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
      connectionType: 'colleague',
    }
  }, self.extractRequestParams(options), {
    method: 'HEAD',
    qs: _.pick(options, qsValidParameters)
  });

  var authPath = getAuthPath(requestOptions);

  requestOptions.uri = authPath + '/atom/connection.do';

  var targetSelector = _.pick(requestOptions.qs, 'targetUserid', 'targetEmail', 'targetKey');
  if (_.size(targetSelector) !== 1) {
    error = new Error(util.format('Wrong number of targetEntry selectors provided to receive network state: %j', targetSelector));
    error.status = 400;
    return q.reject(error);
  }
  var sourceSelector = _.pick(requestOptions.qs, 'sourceUserid', 'sourceEmail', 'sourceKey');
  if (_.size(sourceSelector) > 1) {
    error = new Error(util.format('Wrong number of sourceEntry selectors provided to receive network state: %j', sourceSelector));
    error.status = 400;
    return q.reject(error);
  }

  return q.ninvoke(self, 'makeRequest', requestOptions)
    .spread(function(response) {
      // var networkStatusHeaderName = 'X-Profiles-Connection-Status';
      var networkStatusHeaderName = 'x-profiles-connection-status';
      if (response.statusCode === 404) {
        return false;
      }
      if (response.headers[networkStatusHeaderName] && ['accepted', 'pending', 'unconfirmed'].indexOf(response.headers[networkStatusHeaderName]) > -1) {
        return response.headers[networkStatusHeaderName];
      }
      return q.reject(new Error('No valid network status found'));
    });
};

IbmConnectionsProfilesService.prototype.inviteNetworkContact = function inviteNetworkContact(options) {
  var self = this;

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
    qs: _.pick(options, qsValidParameters),
    headers: {
      'Content-type': 'application/atom+xml'
    },
    body: util.format(xmlTemplate.makeFriend, options.message)
  });

  var authPath = getAuthPath(requestOptions);

  requestOptions.uri = authPath + '/atom/connection.do';


  return q.ninvoke(self, 'makeRequest', requestOptions)
    .spread(function(response) {
      if (response.statusCode === 400) {
        // logDebug('There is a pending invitation from {%s} to {%s} already', sourceentry.userid, targetentry.userid);
        return q.reject('pending');
      }
      if (response.statusCode === 200) {
        // logDebug('Successfully created invite from {%s} to {%s}', sourceentry.userid, targetentry.userid);
        return 'pending';
      }
      return q.reject(response.statusCode);
    });
};

IbmConnectionsProfilesService.prototype.getFollowedProfiles = function(options) {
  var self = this;

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
    qs: _.pick(options, qsValidParameters),
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

  var promise = q.ninvoke(self, 'makeRequest', requestOptions)
    .spread(extractDataFromRequestPromise)
    .then(responseParser.followedProfiles)
    .then(function(data) {
      // if this was not a call to fetch all the entry's network connections, we're done
      if (!options.fetchAll) {
        return data;
      }

      // if it was... but all results fit into a single request, we're don, too
      if (data.totalResults === _.size(data.followedProfiles)) {
        // notify('Page 1 contains all available results');
        data.paginationLinks = undefined;
        data.startIndex = undefined;
        data.itemsPerPage = undefined;
        return data;
      }

      // we have to request subsequent result pages in order to fetch a complete list of the entry's network connections
      var promisesArray = [q(data)];

      // run one subsequent request for each page of the result set. Instead of using the paginationLinks,
      // we simply overwrite the "page" parameter of our request's query object and execute all the requests in parallel
      // collecting all request promises in an arry
      for (var i = 2; i <= Math.ceil(data.totalResults / requestOptions.qs.ps); i++) {
        var pageRequestOptions = _.merge(_.clone(requestOptions), {
          qs: {
            page: i
          }
        });

        promisesArray.push(q.ninvoke(self, 'makeRequest', pageRequestOptions)
          .spread(extractDataFromRequestPromise)
          .then(responseParser.followedProfiles));
      }

      return q.all(promisesArray).then(function(results) {
        var result = _.merge.apply(null, results);

        result.paginationLinks = undefined;
        result.startIndex = undefined;
        result.itemsPerPage = undefined;

        return result;
      });
    });

  // when promise is fulfilled, start prefetching all involved profile entries
  promise.then(function(result) {
    self.batchLoadEntries(_.keys(result.followedProfiles).map(function(userid) {
      return {
        userid: userid
      };
    }), options);
  });

  return promise;
};

IbmConnectionsProfilesService.prototype.getTags = function(options) {
  var self = this;
  var error;

  var qsValidParameters = [
    'targetEmail',
    'targetKey',
    'sourceEmail',
    'sourceKey',
    'format',
    'lastMod'
  ];

  // construct the request options
  var requestOptions = _.merge({
    ttl: 1800
  }, self.extractRequestParams(options), {
    qs: _.pick(options, qsValidParameters),
    headers: {
      accept: 'application/xml'
    }
  });

  var authPath = getAuthPath(requestOptions);

  requestOptions.uri = '/follow' + authPath + '/atom/profileTags.do';

  var targetSelector = _.pick(requestOptions.qs, 'targetEmail', 'targetKey');
  if (_.size(targetSelector) !== 1) {
    error = new Error(util.format('Wrong number of targetEntry selectors provided to receive tags: %j', targetSelector));
    error.status = 400;
    return q.reject(error);
  }
  var sourceSelector = _.pick(requestOptions.qs, 'sourceEmail', 'sourceKey');
  if (_.size(sourceSelector) > 1) {
    error = new Error(util.format('Wrong number of sourceEntry selectors provided to receive tags: %j', sourceSelector));
    error.status = 400;
    return q.reject(error);
  }

  // format will be ignores on server if a valid sourceSelector was provided
  if (_.isString(requestOptions.qs.format) && ['lite', 'full'].indexOf(requestOptions.qs.format) < 0) {
    requestOptions.qs.format = 'lite';
  }

  var promise = q.ninvoke(self, 'makeRequest', requestOptions)
    .spread(extractDataFromRequestPromise)
    .then(responseParser.profileTags);

  // when promise is fulfilled, start prefetching all involved profile entries
  promise.then(function(result) {
    self.batchLoadEntries(_.keys(result.contributors).map(function(userid) {
      return {
        userid: userid
      };
    }), options);
  });

  return promise;
};

IbmConnectionsProfilesService.prototype.updateTags = function(options) {
  var self = this;
  var error;

  if (!_.isArray(options.tags)) {
    error = new Error('an Array of tags must be provided');
    error.status = 400;
    return q.reject(error);
  }

  var qsValidParameters = [
    'targetEmail',
    'targetKey',
    'sourceEmail',
    'sourceKey'
  ];

  // construct the request options
  var requestOptions = _.merge(self.extractRequestParams(options), {
    method: 'PUT',
    qs: _.pick(options, qsValidParameters),
    headers: {
      accept: 'application/xml'
    }
  });

  var authPath = getAuthPath(requestOptions);

  requestOptions.uri = authPath + '/atom/profileTags.do';

  var targetSelector = _.pick(requestOptions.qs, 'targetEmail', 'targetKey');
  if (_.size(targetSelector) !== 1) {
    error = new Error(util.format('Wrong number of targetEntry selectors provided to update tags: %j', targetSelector));
    error.status = 400;
    return q.reject(error);
  }
  var sourceSelector = _.pick(requestOptions.qs, 'sourceEmail', 'sourceKey');
  if (_.size(sourceSelector) > 1) {
    error = new Error(util.format('Wrong number of sourceEntry selectors provided to update tags: %j', sourceSelector));
    error.status = 400;
    return q.reject(error);
  }

  var tagsDoc = xml.parse(xmlTemplate.tagsDoc),
    tagsDocParentNode = tagsDoc.getElementsByTagNameNS(xmlNS.app, 'categories')[0];

  options.tags.forEach(function(tag) {
    var xmlTag = tagsDoc.createElement('atom:category');
    if (_.isString(tag)) {
      tag = {
        term: tag
      };
    }
    xmlTag.setAttribute('term', _.escape(tag.term));
    if (_.isString(profileTagCategories[tag.category])) {
      xmlTag.setAttribute('scheme', profileTagCategories[tag.category]);
    }
    tagsDocParentNode.appendChild(xmlTag);
  });

  // this might require the XMLSerializer.serializeToString(tagsDoc) from xmldom package
  requestOptions.body = tagsDoc.toString();

  return q.ninvoke(self, 'makeRequest', requestOptions)
    .spread(extractDataFromRequestPromise);
};

IbmConnectionsProfilesService.prototype.addTags = function(options) {
  var self = this,
    error;

  if (!_.isArray(options.tags)) {
    error = new Error('an Array of tags must be provided');
    error.status = 400;
    return q.reject(error);
  }

  options.disableCache = true;

  return self.getTags(options)
    .then(function(result) {
      // normalize old tags
      var oldTags = result.tags.map(function(tag) {
        return _.pick(tag, ['term', 'type']);
      });

      // normalize new tags
      var newTags = options.tags.map(function(tag) {
        if (_.isString(tag)) {
          tag = {
            term: tag
          };
        }
        return tag;
      });

      // union new and old tags
      options.tags = _.union(newTags, oldTags);

      // put new set of tags to the API
      return self.updateTags(options);
    });
};

IbmConnectionsProfilesService.prototype.removeTags = function(options) {
  var self = this,
    error;

  if (!_.isArray(options.tags)) {
    error = new Error('an Array of tags must be provided');
    error.status = 400;
    return q.reject(error);
  }

  options.disableCache = true;

  return self.getTags(options)
    .then(function(result) {

      // normalize old tags
      // in this case, we create strings from all tag objects
      // --> easier to compare
      var existingTags = result.tags.map(function(tag) {
        return JSON.stringify(_.pick(tag, 'term', 'type'));
      });

      // normalize new tags
      var removeTags = options.tags.map(function(tag) {
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
      options.tags = _.difference(existingTags, removeTags).map(function(tag) {
        return JSON.parse(tag);
      });
      // put new set of tags to the API
      return self.updateTags(options);
    });
};

module.exports = IbmConnectionsProfilesService;

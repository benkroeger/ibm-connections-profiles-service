'use strict';

// native node modules
var util = require('util');

// 3rd party modules
var _ = require('lodash'),
	q = require('q'),
	oniyiRequestorClient = require('oniyi-requestor-client'),
	oniyiVCardParser = require('oniyi-vcard-parser').factory;

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
	xmlNS = {
		atom: 'http://www.w3.org/2005/Atom',
		snx: 'http://www.ibm.com/xmlns/prod/sn',
		app: 'http://www.w3.org/2007/app',
		openSearch: 'http://a9.com/-/spec/opensearch/1.1/',
		ibmsc: 'http://www.ibm.com/search/content/2010',
		thr: 'http://purl.org/syndication/thread/1.0',
		fh: 'http://purl.org/syndication/history/1.0'
	};

var vCardParser = oniyiVCardParser({
	vCardToJSONAttributeMapping: {
		'UID': 'uid'
	}
});

// local function definition
function getAuthPath(requestOptions) {
	if (requestOptions.auth && _.isString(requestOptions.auth.bearer)) {
		return '/oauth';
	}
	return '';
}

function extractDataFromRequestPromise(response, data) {
		return data;
	}
	// here begins the parser functions definition section

var responseParser = {
	profileService: function parseProfileServiceResponse(responseXML) {
		if (_.isString(responseXML)) {
			responseXML = xml.parse(responseXML);
		}

		// @TODO: parse extension attributes and application links
		var result = {
			editableFields: Array.prototype.map.call(responseXML.getElementsByTagNameNS(xmlNS.snx, 'editableField'), function(element) {
				return element.getAttribute('name');
			})
		};

		return result;
	},
	profileEntry: function parseProfileEntryResponse(responseXML) {
		if (_.isString(responseXML)) {
			responseXML = xml.parse(responseXML);
		}

		// parse vCard String to JSON object
		var entry = vCardParser.toObject((xml.find(responseXML, 'content[type="text"]')[0]).textContent);

		// parsing tags
		try {
			entry.tags = entry.tags.split(',');
		} catch (e) {
			logWarn('Failed to parse tags for entry {%s}', entry.userid);
			logDebug(e);
		}

		// also not implemented in xml library yet
		// parse extension attributes
		entry.extattrDetails = {};
		try {
			xml.find(responseXML, 'link[rel="http://www.ibm.com/xmlns/prod/sn/ext-attr"]').forEach(function(val) {
				var extensionId = val.getAttributeNS(xmlNS.snx, 'extensionId');
				entry.extattrDetails[extensionId] = {
					name: extensionId,
					type: val.getAttribute('type'),
					href: val.getAttribute('href'),
					content: entry.extattr[extensionId] || false
				};
			});
		} catch (e) {
			logWarn('Failed to parse extension attributes for entry {%s}', entry.userid);
			logDebug(e);
		}

		return entry;
	},
	networkConnections: function parseNetworkConnectionsResponse(responseXML) {
		responseXML = xml.parse(responseXML);
		var returnValue = {};

		// extract pagination information from received XML
		var paginationLinkElements = xml.select(responseXML, util.format("/*[local-name()='feed' and namespace-uri()='%s']/*[local-name()='link' and namespace-uri()='%s']", xmlNS.atom, xmlNS.atom));
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
				var entry = responseParser.profileEntry(entryXML);
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
	}
};

function parseFollowedProfilesResponse(responseXML) {
	if (_.isString(responseXML)) {
		responseXML = xml.parse(responseXML);
	}

	var returnValue = {};

	// extract pagination information from received XML
	var paginationLinkElements = xml.select(responseXML, util.format("/*[local-name()='feed' and namespace-uri()='%s']/*[local-name()='link' and namespace-uri()='%s']", xmlNS.atom, xmlNS.atom));
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
}

function parseProfileTagsResponse(responseXML) {
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

// the "class" definition
function IbmConnectionsProfilesService(options) {
	var self = this;

	if (!_.isPlainObject(options)) {
		throw new TypeError('options need to be defined for IbmConnectionsProfiles');
	}

	options = _.merge({
		// define defaults here
		endpoint: {
			schema: 'https',
			host: false,
			contextRoot: '/profiles',
			throttle: {
				disable: false,
				limit: 120,
				duration: 60000
			},
			cache: {
				disable: false,
				storePrivate: false,
				storeNoStore: false,
				ignoreNoLastMod: false,
				requestValidators: [],
				responseValidators: []
			}
		},
		maxProfileAge: 1800
	}, options);

	oniyiRequestorClient.call(self, options);

	self.apiEntryPoint = util.format('%s://%s%s', options.endpoint.schema, options.endpoint.host, options.endpoint.contextRoot);
}
util.inherits(IbmConnectionsProfilesService, oniyiRequestorClient);

IbmConnectionsProfilesService.prototype.getEntry = function(options) {
	var self = this;
	var error;

	var requestOptions = self.getRequestOptions(options);

	var authPath = getAuthPath(requestOptions);

	requestOptions.uri = self.apiEntryPoint + authPath + '/atom/profileEntry.do';
	requestOptions.ttl = options.ttl || self._maxProfileAge;

	var qsValidParameters = [
    'email',
    'key',
    'userid'
  ];

	var qs = _.merge({
		format: 'full',
		output: 'vcard'
	}, _.pick(options, qsValidParameters));

	requestOptions.qs = qs;

	var entrySelector = _.pick(qs, ['email', 'key', 'userid']);

	if (_.size(entrySelector) !== 1) {
		error = new Error(util.format('Wrong number of entry selectors provided to receive profile entry: %j', entrySelector));
		error.status = 400;
		return q.reject(error);
	}

	return q.ninvoke(self, 'makeRequest', 'get', requestOptions, responseParser.profileEntry)
		.spread(function(response, data) {
			// @TODO: need to check if data was processed successfully
			return data;
		});
};

IbmConnectionsProfilesService.prototype.getEditableFields = function(options) {
	var self = this;
	var error;

	// @TODO: check if "key" is a valid parameter, too
	var qsValidParameters = [
    'email',
    'userid'
  ];

	var requestOptions = _.merge(self.getRequestOptions(options), {
		qs: _.pick(options, qsValidParameters),
		headers: {
			accept: 'application/xml'
		},
		disableCache: true
	});

	var authPath = getAuthPath(requestOptions);

	requestOptions.uri = self.apiEntryPoint + authPath + '/atom/profileService.do';

	var entrySelector = _.pick(requestOptions.qs, 'email', 'userid');
	if (_.size(entrySelector) !== 1) {
		error = new Error(util.format('Wrong number of entry selectors provided to receive network connections: %j', entrySelector));
		error.status = 400;
		return q.reject(error);
	}

	return q.ninvoke(self, 'makeRequest', 'get', requestOptions, responseParser.profileService)
		.spread(function(response, data) {
			return data;
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
		ttl: 1800
	}, self.getRequestOptions(options), {
		qs: _.pick(options, qsValidParameters),
		headers: {
			accept: 'application/xml'
		},
		disableCache: true
	});

	var authPath = getAuthPath(requestOptions);

	requestOptions.uri = self.apiEntryPoint + authPath + '/atom/connections.do';

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


	return q.ninvoke(self, 'makeRequest', 'get', requestOptions, responseParser.networkConnections)
		.spread(function(response, data) {
			// if this was not a call to fetch all the entry's network connections, we're done
			if (!options.fetchAll) {
				return extractDataFromRequestPromise(response, data);
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

				promisesArray.push(q.ninvoke(self, 'makeRequest', 'get', pageRequestOptions, responseParser.networkConnections)
					.spread(extractDataFromRequestPromise));
			}

			return q.all(promisesArray).then(function(results) {
				var result = _.merge.apply(null, results);

				result.paginationLinks = undefined;
				result.startIndex = undefined;
				result.itemsPerPage = undefined;

				return result;
			});
		});
};

module.exports = IbmConnectionsProfilesService;
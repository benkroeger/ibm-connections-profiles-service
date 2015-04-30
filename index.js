'use strict';

// native node modules
var util = require('util');

// 3rd party modules
var _ = require('lodash'),
	q = require('q'),
	OniyiRequestorClient = require('oniyi-requestor-client'),
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
	// just returning data here
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
			// @TODO logging
		}

		return entry;
	},
	networkConnections: function parseNetworkConnectionsResponse(responseXML) {
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
	},
	followedProfiles: function parseFollowedProfilesResponse(responseXML) {
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
function IbmConnectionsProfilesService(options) {
	var self = this;

	if (!_.isPlainObject(options)) {
		throw new TypeError('options must be defined for IbmConnectionsProfilesService');
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
		maxProfileAge: 1800,
		defaultRequestOptions: {
			headers: {
				'user-agent': 'Mozilla/5.0'
			}
		}
	}, options);

	OniyiRequestorClient.call(self, options);
	self.apiEntryPoint = util.format('%s://%s%s', options.endpoint.schema, options.endpoint.host, options.endpoint.contextRoot);
}
util.inherits(IbmConnectionsProfilesService, OniyiRequestorClient);

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

	requestOptions.uri = self.apiEntryPoint + authPath + '/atom/profileEntry.do';
	requestOptions.ttl = options.ttl || self._maxProfileAge;

	var entrySelector = _.pick(requestOptions.qs, ['email', 'key', 'userid']);

	if (_.size(entrySelector) !== 1) {
		error = new Error(util.format('Wrong number of entry selectors provided to receive profile entry: %j', entrySelector));
		error.status = 400;
		return q.reject(error);
	}

	return q.ninvoke(self, 'makeRequest', 'get', requestOptions, responseParser.profileEntry)
		.spread(extractDataFromRequestPromise);
};

IbmConnectionsProfilesService.prototype.updateEntry = function(options) {
	var self = this;
	var error;

	var entry = options.entry;

	if (!entry || !entry.key) {
		error = new Error(util.format('A valid entry must be provided to update it %j', entry));
		error.status = 400;
		return q.reject(error);
	}

	return self.getEditableFields(options)
		.then(function(editableFields) {
			if (editableFields.indexOf('jobResp') > -1 && entry.jobResp && entry.jobResp.length > 128) {
				entry.jobResp = entry.jobResp.substr(0, 127);
			}

			// construct the request options
			var requestOptions = _.merge(self.getRequestOptions(options), {
				qs: {
					key: entry.key
				},
				body: util.format(xmlTemplate.entry, vCardParser.toVcard(entry)),
				headers: {
					accept: 'application/atom+xml'
				}
			});

			var authPath = getAuthPath(requestOptions);

			requestOptions.uri = self.apiEntryPoint + authPath + '/atom/entry.do';

			return q.ninvoke(self, 'makeRequest', 'put', requestOptions)
				.then(function() {
					// make subsequent calls for all editable extension attributes
					var promisesArray = _.map(entry.extattrDetails, function(extAttr) {
						if (editableFields.indexOf(extAttr.name) > -1) {
							var extAttrRequestOptions = _.omit(_.clone(requestOptions), ['qs', 'body', 'method']);

							extAttrRequestOptions.uri = self._apiEntryPoint + authPath + extAttr.href.substringFrom(self._endpoint.host + self._endpoint.contextRoot);

							var requestMethod = (entry.extattr[extAttr.name]) ? 'put' : 'delete';

							if (requestMethod === 'put') {
								extAttrRequestOptions.body = decodeURIComponent(entry.extattr[extAttr.name]);
								_.merge(extAttrRequestOptions.headers, {
									'Content-type': extAttr.type
								});
							}
							return q.ninvoke(self, 'makeRequest', requestMethod, extAttrRequestOptions);
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
		self.getEntry(_.merge(options, _.pick(entry, ['userid', 'key', 'email'])));
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
		.spread(extractDataFromRequestPromise);
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


	var promise = q.ninvoke(self, 'makeRequest', 'get', requestOptions, responseParser.networkConnections)
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
    'targetEmail',
    'targetKey',
    'sourceEmail',
    'sourceKey'
  ];

	// construct the request options
	var requestOptions = _.merge({
		qs: {
			connectionType: 'colleague',
		}
	}, self.getRequestOptions(options), {
		qs: _.pick(options, qsValidParameters)
	});

	var authPath = getAuthPath(requestOptions);

	requestOptions.uri = self.apiEntryPoint + '/follow' + authPath + '/atom/connections.do';

	var targetSelector = _.pick(requestOptions.qs, 'targetEmail', 'targetKey');
	if (_.size(targetSelector) !== 1) {
		error = new Error(util.format('Wrong number of targetEntry selectors provided to receive network state: %j', targetSelector));
		error.status = 400;
		return q.reject(error);
	}
	var sourceSelector = _.pick(requestOptions.qs, 'sourceEmail', 'sourceKey');
	if (_.size(sourceSelector) > 1) {
		error = new Error(util.format('Wrong number of sourceEntry selectors provided to receive network state: %j', sourceSelector));
		error.status = 400;
		return q.reject(error);
	}

	return q.ninvoke(self, 'makeRequest', 'head', requestOptions, responseParser.profileEntry)
		.spread(function(response) {
			var networkStatusHeaderName = 'X-Profiles-Connection-Status';
			if (response.statusCode === 404) {
				return false;
			}
			if (response.headers[networkStatusHeaderName] && ['accepted', 'pending', 'unconfirmed'].indexOf(response.headers[networkStatusHeaderName]) > -1) {
				return response.headers[networkStatusHeaderName];
			}

			throw 'No valid network status found';
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
	}, self.getRequestOptions(options), {
		qs: _.pick(options, qsValidParameters),
		headers: {
			'Content-type': 'application/atom+xml'
		},
		body: util.format(xmlTemplate.makeFriend, options.message)
	});

	var authPath = getAuthPath(requestOptions);

	requestOptions.uri = self.apiEntryPoint + authPath + '/atom/connections.do';


	return q.ninvoke(self, 'makeRequest', 'post', requestOptions)
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
	}, self.getRequestOptions(options), {
		qs: _.pick(options, qsValidParameters),
		headers: {
			accept: 'application/xml'
		}
	});

	var authPath = getAuthPath(requestOptions);

	requestOptions.uri = self.apiEntryPoint + '/follow' + authPath + '/atom/resources';

	// the connections API does not allow page-sizes larger than 20
	// if fetchAll is set to "true", we increase the page size to maximum
	if (options.fetchAll) {
		requestOptions.qs.page = 1;
		requestOptions.qs.ps = 20;
	} else if (_.isNumber(requestOptions.qs.ps) && requestOptions.qs.ps > 20) {
		requestOptions.qs.ps = 20;
		options.fetchAll = true;
	}

	var promise = q.ninvoke(self, 'makeRequest', 'get', requestOptions, responseParser.followedProfiles)
		.spread(function(response, data) {
			// if this was not a call to fetch all the entry's network connections, we're done
			if (!options.fetchAll) {
				return extractDataFromRequestPromise(response, data);
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

				promisesArray.push(q.ninvoke(self, 'makeRequest', 'get', pageRequestOptions, responseParser.followedProfiles)
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
	}, self.getRequestOptions(options), {
		qs: _.pick(options, qsValidParameters),
		headers: {
			accept: 'application/xml'
		}
	});

	var authPath = getAuthPath(requestOptions);

	requestOptions.uri = self.apiEntryPoint + '/follow' + authPath + '/atom/profileTags.do';

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

	var promise = q.ninvoke(self, 'makeRequest', 'get', requestOptions, responseParser.profileEntry)
		.spread(function(response, data) {
			// @TODO: need to check if data was processed successfully
			return data;
		});

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
	var requestOptions = _.merge(self.getRequestOptions(options), {
		qs: _.pick(options, qsValidParameters),
		headers: {
			accept: 'application/xml'
		}
	});

	var authPath = getAuthPath(requestOptions);

	requestOptions.uri = self.apiEntryPoint + authPath + '/atom/profileTags.do';

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

	return q.ninvoke(self, 'makeRequest', 'put', requestOptions)
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
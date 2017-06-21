'use strict';

// core node modules

// 3rd party modules
const _ = require('lodash');
const { ensureXMLDoc } = require('oniyi-utils-xml');
const logger = require('oniyi-logger')('ibm-connections-profiles-service:response-parsers:profile-entry');

// internal modules
const xpathSelect = require('../xpath-select');
const { safeConvertToString } = require('./response-parser-utils');

const contentPath = isEntryNode => (isEntryNode ?
  'atom:content[@type="text"]/text()' : 'atom:entry/atom:content[@type="text"]/text()');

const parseEntryTags = ({ tags }) => {
  if (tags && _.isString(tags)) {
    return tags.split(',');
  }
  if (!_.isArray(tags)) {
    return [];
  }
  return tags;
};

module.exports = (stringOrXMLDoc, parser, isEntryNode) => {
  const xmlDoc = ensureXMLDoc(stringOrXMLDoc);
  const vcard = safeConvertToString(xpathSelect(contentPath(isEntryNode), xmlDoc, true));

  let entry = {};
  if (!vcard) {
    logger.debug('Expected vcard to be of type {String}, instead we got ', typeof vcard);
    return entry;
  }

  entry = parser.toObject(vcard);
  entry.tags = parseEntryTags(entry);

  return entry;
};

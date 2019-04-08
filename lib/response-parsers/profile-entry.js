'use strict';

// core node modules

// 3rd party modules
const _ = require('lodash');
const { ensureXMLDoc } = require('oniyi-utils-xml');

// internal modules
const xpathSelect = require('../xpath-select');

const contentPath = isEntryNode =>
  isEntryNode
    ? 'string(atom:content[@type="text"]/text())'
    : 'string(atom:entry/atom:content[@type="text"]/text())';

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
  const vcard = xpathSelect(contentPath(isEntryNode), xmlDoc, true);

  const profileEntry = parser.toObject(vcard);
  profileEntry.tags = parseEntryTags(profileEntry);

  return profileEntry;
};

'use strict';

// core node modules

// 3rd party modules
const _ = require('lodash');
const { ensureXMLDoc } = require('oniyi-utils-xml');

// internal modules
const xpathSelect = require('../xpath-select');
const { parseXmlNode } = require('./../utils/network-connections-node-parser');
const profileEntry = require('./profile-entry');
const { mapPaginationLinkElements, buildOpenSearchElements } = require('../utils/response-parser-utils');

const outputTypeRegex = /outputType=profile/i;

const buildNetworkConnections = (xmlDoc, entry, vcardParser) => {
  const { paginationLinks: { self: selfLink } } = entry;
  const networkConnections = {};

  const isOutputTypeProfile = outputTypeRegex.test(selfLink);
  const entryNode = xpathSelect('/atom:feed/atom:entry', xmlDoc);

  if (_.isString(selfLink) && isOutputTypeProfile) {
    _.forEach(entryNode, (entryXml) => {
      const profile = profileEntry(entryXml, vcardParser, true);
      if (profile && profile.userid) {
        networkConnections[profile.userid] = profile;
      }
    });
    return networkConnections;
  }
  _.forEach(entryNode, (entryXml) => {
    const connection = parseXmlNode(entryXml);
    const { contributor: contributorId } = connection;
    delete connection.contributor;
    if (contributorId) {
      networkConnections[contributorId] = connection;
    }
  });
  return {
    networkConnections,
  };
};

module.exports = (stringOrXMLDoc, vCardParser) => {
  const xmlDoc = ensureXMLDoc(stringOrXMLDoc);

  const entry = {};
  const openSearchElements = ['totalResults', 'startIndex', 'itemsPerPage'];
  _.assign(entry,
    buildOpenSearchElements(xmlDoc, openSearchElements),
    mapPaginationLinkElements(xmlDoc));

  return _.merge(entry, buildNetworkConnections(xmlDoc, entry, vCardParser));
};

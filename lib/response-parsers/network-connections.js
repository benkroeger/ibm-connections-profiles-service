'use strict';

// core node modules

// 3rd party modules
const _ = require('lodash');
const { ensureXMLDoc, parseXMLNode } = require('oniyi-utils-xml');

// internal modules
const xpath = require('../xpath-select');
const parseNetworkConnections = require('./../utils/network-connections-node-parser');
const profileEntry = require('./profile-entry');
const { parseOpenSearchElements, parseFeedLinks } = require('../utils/response-parser-utils');

const outputTypeRegex = /outputType=profile/i;
const openSearchElements = ['totalResults', 'startIndex', 'itemsPerPage'];

const buildNetworkConnections = (xmlDoc, feed, vcardParser) => {
  const { paginationLinks: { self: selfLink } } = feed;
  const networkConnections = {};

  const isOutputTypeProfile = outputTypeRegex.test(selfLink);
  const entryNode = xpath('/atom:feed/atom:entry', xmlDoc);

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
    const connection = parseNetworkConnections(entryXml);
    const { contributor: { userId } = {} } = connection;
    if (userId) {
      networkConnections[userId] = connection;
    }
  });
  return {
    networkConnections,
  };
};

const parsePaginationLinks = feedNode =>
  parseXMLNode(
    feedNode,
    {
      paginationLinks: {
        selector: 'atom:link',
        transform: parseFeedLinks,
        multi: true,
      },
    },
    xpath
  );

module.exports = (stringOrXMLDoc, vCardParser) => {
  const xmlDoc = ensureXMLDoc(stringOrXMLDoc);
  const feedNode = xpath('atom:feed', xmlDoc, true);
  const feed = {};

  _.assign(feed, parseOpenSearchElements(xmlDoc, openSearchElements), parsePaginationLinks(feedNode));

  return _.merge(feed, buildNetworkConnections(xmlDoc, feed, vCardParser));
};

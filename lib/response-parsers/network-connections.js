'use strict';

// core node modules

// 3rd party modules
const _ = require('lodash');
const { ensureXMLDoc } = require('oniyi-utils-xml');

// internal modules
const xpathSelect = require('../xpath-select');
const { parseXmlNode } = require('./../utils/network-connections-node-parser');
const xmlNS = require('../config/xml-namespaces.json');
const profileEntry = require('./profile-entry');

/* eslint-disable arrow-body-style */
const buildOpenSearchElements = (xmlDoc, elementsToBuild) => {
  return elementsToBuild.reduce((result, element) => {
    return _.assign(result, {
      [element]: parseInt(xmlDoc.getElementsByTagNameNS(xmlNS.openSearch, element)[0].textContent, 10),
    });
  }, {});
};
/* eslint-enable arrow-body-style */

const mapPaginationLinkElements = (xmlDoc) => {
  // extract pagination information from received XML
  const paginationLinkElements = xpathSelect('/atom:feed/atom:link[@rel]', xmlDoc);
  let paginationLinks = {};
  if (paginationLinkElements) {
    paginationLinks = _.reduce(paginationLinkElements, (result, link) => { // eslint-disable-line arrow-body-style
      return _.assign(result, {
        [link.getAttribute('rel')]: link.getAttribute('href'),
      });
    }, {});
  }
  return { paginationLinks };
};

const buildNetworkConnections = (xmlDoc, entry, vcardParser) => {
  const { paginationLinks: { self: selfLink } } = entry;
  const networkConnections = {};

  const isOutputTypeProfile = /outputType=profile/i.test(selfLink);
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

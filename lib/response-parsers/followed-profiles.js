'use strict';

// core node modules

// 3rd party modules
const _ = require('lodash');
const { ensureXMLDoc } = require('oniyi-utils-xml');

// internal modules
const xpathSelect = require('../xpath-select');
const { mapPaginationLinkElements, buildOpenSearchElements } = require('../utils/response-parser-utils');

const extractProfileId = profileUrnString => /^urn:lsid:ibm.com:follow:resource-(.*)/.exec(profileUrnString)[1];

const parseFollowedProfiles = (responseXML) => {
  let followedProfiles = {};
  const entries = responseXML.getElementsByTagName('entry');
  if (entries) {
    followedProfiles = _.reduce(entries, (result, entry) => {
      const profileUrnString = xpathSelect('atom:id', entry, true);
      const profileId = extractProfileId(profileUrnString);
      const userid = xpathSelect('category[scheme="http://www.ibm.com/xmlns/prod/sn/resource-id"]/@term', entry).value;
      return _.assign(result, {
        [userid]: profileId,
      });
    }, {});
  }
  return { followedProfiles };
};

module.exports = (responseXml) => {
  const xmlDoc = ensureXMLDoc(responseXml);

  const entry = {};
  const openSearchElements = ['totalResults', 'startIndex', 'itemsPerPage'];
  _.assign(entry,
    buildOpenSearchElements(xmlDoc, openSearchElements),
    mapPaginationLinkElements(xmlDoc),
    parseFollowedProfiles(xmlDoc));

  return entry;
};

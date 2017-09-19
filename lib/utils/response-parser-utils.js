'use strict';

// core node modules

// 3rd party modules
const _ = require('lodash');

// internal modules
const xpathSelect = require('../xpath-select');
const xmlNS = require('../config/xml-namespaces.json');

/**
 * Some selector fields, when called by /text() syntax, return undefined if they have no text.
 * Need to be sure that we are not calling '.toString()' on undefined object.
 *
 * @param collection      The collection/object we are trying to convert to string
 */

const safeConvertToString = collection => (collection && collection.toString()) || '';

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

/* eslint-disable arrow-body-style */
const buildOpenSearchElements = (xmlDoc, elementsToBuild) => {
  return elementsToBuild.reduce((result, element) => {
    return _.assign(result, {
      [element]: parseInt(xmlDoc.getElementsByTagNameNS(xmlNS.openSearch, element)[0].textContent, 10),
    });
  }, {});
};
/* eslint-enable arrow-body-style */

module.exports = {
  safeConvertToString,
  mapPaginationLinkElements,
  buildOpenSearchElements,
};

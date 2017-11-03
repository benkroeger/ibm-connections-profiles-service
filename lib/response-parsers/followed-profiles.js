'use strict';

// core node modules

// 3rd party modules
const _ = require('lodash');
const { ensureXMLDoc, parseXMLNode } = require('oniyi-utils-xml');

// internal modules
const xpath = require('../xpath-select');
const { parseFeedLinks, parseOpenSearchElements, urnToId } = require('../utils/response-parser-utils');
const categorySchemes = require('../config/category-schemes/followed-profiles.json');

const openSearchElements = ['totalResults', 'startIndex', 'itemsPerPage'];
const invertedCategorySchemes = _.invert(categorySchemes);

const linkRelToNameMap = {
  self: 'self',
  alternate: 'alternate',
  edit: 'edit',
  related: 'related',
};

const parseLinks = nodes =>
  _.reduce(
    nodes,
    (result, node) => {
      const link = parseXMLNode(
        node,
        {
          rel: 'string(@rel)',
          type: 'string(@type)',
          href: 'string(@href)',
        },
        xpath
      );

      const { [link.rel || '']: name } = linkRelToNameMap;

      return _.assign(result, { [name]: link });
    },
    {}
  );

const parseCategories = nodes =>
  _.reduce(
    nodes,
    (result, node) => {
      const category = parseXMLNode(
        node,
        {
          scheme: 'string(@scheme)',
          value: 'string(@term)',
        },
        xpath
      );

      const { [category.scheme || '']: name } = invertedCategorySchemes;

      return _.assign(result, { [name]: category.value });
    },
    {}
  );

const parseFollowedProfilesEntries = (responseXML) => {
  const xmlDoc = ensureXMLDoc(responseXML);
  const entryNodes = xpath('atom:entry', xmlDoc);

  const followedProfiles = _.reduce(
    entryNodes,
    (result, entryNode) => {
      const profile = parseXMLNode(
        entryNode,
        {
          id: {
            selector: 'string(atom:id)',
            transform: urnToId,
          },
          title: 'string(atom:title[@type="text"])',
          links: {
            selector: 'atom:link',
            transform: parseLinks,
            multi: true,
          },
          categories: {
            selector: 'atom:category',
            transform: parseCategories,
            multi: true,
          },
        },
        xpath
      );

      const { categories: { resourceId } = {} } = profile;

      // save profiles by their userid, since that ID will be used by other service methods
      return _.assign(result, {
        [resourceId]: profile,
      });
    },
    {}
  );

  return { followedProfiles };
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

module.exports = (responseXml) => {
  const xmlDoc = ensureXMLDoc(responseXml);
  const feedNode = xpath('atom:feed', xmlDoc, true);

  return _.assign(
    {},
    parseOpenSearchElements(xmlDoc, openSearchElements),
    parsePaginationLinks(feedNode),
    parseFollowedProfilesEntries(feedNode)
  );
};

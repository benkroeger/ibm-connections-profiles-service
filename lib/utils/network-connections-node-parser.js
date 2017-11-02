'use strict';

// core node modules

// 3rd party modules
const _ = require('lodash');

// internal modules
const xpath = require('../xpath-select');
const { parseXMLNode } = require('oniyi-utils-xml');
const categorySchemes = require('../config/category-schemes/network-connectinos.json');
const { toDate, urnToId, parseUserInfo } = require('./response-parser-utils');

const linkRelToNameMap = {
  self: 'self',
  edit: 'edit',
};
const invertedCategorySchemes = _.invert(categorySchemes);

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

      /* beautify preserve:start */
      return Object.assign(result, { [name]: link });
      /* beautify preserve:end */
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

      /* beautify preserve:start */
      return Object.assign(result, { [name]: category.value });
      /* beautify preserve:end */
    },
    {}
  );

const selectors = {
  id: {
    selector: 'string(atom:id)',
    transform: urnToId,
  },
  updated: {
    selector: 'string(atom:updated)',
    transform: toDate,
  },
  summary: 'string(atom:summary)',
  message: 'string(atom:content)',
  contributor: {
    selector: 'snx:connection/atom:contributor[@snx:rel="http://www.ibm.com/xmlns/prod/sn/connection/target"]',
    transform: parseUserInfo,
  },
  categories: {
    selector: 'atom:category',
    transform: parseCategories,
    multi: true,
  },
  links: {
    selector: 'atom:link',
    transform: parseLinks,
    multi: true,
  },
};

module.exports = xmlNode => parseXMLNode(xmlNode, selectors, xpath);

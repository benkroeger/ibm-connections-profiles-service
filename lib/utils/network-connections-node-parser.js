'use strict';

// core node modules

// 3rd party modules
const _ = require('lodash');

// internal modules
const xpathSelect = require('../xpath-select');

const extractIdFromProfiles = (profileId) => {
  const [, id] = profileId.split('tag:profiles.ibm.com,2006:entry');
  return id;
};

function parseXmlNode(xmlNode) {
  const connection = {};

  const textValueSelectors = {
    id: {
      selector: 'atom:id',
      transform: extractIdFromProfiles,
    },
    type: {
      selector: 'atom:category[@scheme="http://www.ibm.com/xmlns/prod/sn/type"]',
      attribute: 'term',
    },
    connectionType: {
      selector: 'atom:category[@scheme="http://www.ibm.com/xmlns/prod/sn/connection/type"]',
      attribute: 'term',
    },
    status: {
      selector: 'atom:category[@scheme="http://www.ibm.com/xmlns/prod/sn/status"]',
      attribute: 'term',
    },
    updated: 'atom:updated',
    summary: 'atom:summary',
    message: 'atom:content',
    contributor: 'snx:connection/atom:contributor[@snx:rel="http://www.ibm.com/xmlns/prod/sn/connection/target"]/snx:userid',
  };

  function getContent(value, node) {
    return value.attribute ? node.getAttribute(value.attribute) : node.textContent;
  }

  const textValues = _.reduce(textValueSelectors, (result, value, name) => {
    const selector = _.isString(value) ? value : value.selector;
    const node = xpathSelect(selector, xmlNode, true);
    if (!node) {
      return result;
    }
    return _.assign(result, {
      [name]: _.isFunction(value.transform) ? value.transform(node.textContent) : getContent(value, node),
    });
  }, {});

  // parse link nodes
  const linkSelectors = {
    edit: 'atom:link[@rel="edit"]',
    self: 'atom:link[@rel="self"]',
  };

  const links = _.reduce(linkSelectors, (result, selector, selectorKey) => {
    const linkNode = xpathSelect(selector, xmlNode, true);
    return _.assign(result, {
      [selectorKey]: {
        href: linkNode.getAttribute('href'),
        type: linkNode.getAttribute('type'),
      },
    });
  }, {});

  return _.assign(connection, textValues, { links });
}

module.exports = {
  parseXmlNode,
};

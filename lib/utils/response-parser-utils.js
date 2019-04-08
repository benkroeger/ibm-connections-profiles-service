'use strict';

// core node modules

// 3rd party modules
const _ = require('lodash');
const { parseXMLNode } = require('oniyi-utils-xml');

// internal modules
const xpath = require('../xpath-select');
const xmlNS = require('../config/xml-namespaces.json');

const linkRelToNameMap = {
  self: 'self',
  alternate: 'alternate',
};
const urnRegexp = /([a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12})$/;

const urnToId = val => val.match(urnRegexp)[1];
const toDate = val => val && Date.parse(val);

const parseFeedLinks = nodes =>
  _.reduce(
    nodes,
    (result, node) => {
      const link = parseXMLNode(
        node,
        {
          rel: 'string(@rel)',
          href: 'string(@href)',
        },
        xpath,
      );
      const { [link.rel || '']: name } = linkRelToNameMap;

      return Object.assign(result, { [name]: link });
    },
    {},
  );

const parseUserInfo = node =>
  parseXMLNode(
    node,
    {
      name: 'string(atom:name/text())',
      userId: 'string(snx:userid/text())',
      state: 'string(snx:userState/text())',
      email: 'string(atom:email/text())',
      external: 'boolean(snx:isExternal/text())',
    },
    xpath,
  );

const parseOpenSearchElements = (xmlDoc, elementsToBuild) =>
  elementsToBuild.reduce(
    (result, element) =>
      _.assign(result, {
        [element]: parseInt(
          xmlDoc.getElementsByTagNameNS(xmlNS.openSearch, element)[0]
            .textContent,
          10,
        ),
      }),
    {},
  );

module.exports = {
  urnToId,
  toDate,
  parseFeedLinks,
  parseUserInfo,
  parseOpenSearchElements,
};

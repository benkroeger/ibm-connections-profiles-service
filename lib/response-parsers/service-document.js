'use strict';

// core node modules

// 3rd party modules
const _ = require('lodash');
const { ensureXMLDoc } = require('oniyi-utils-xml');

// internal modules
const xpathSelect = require('../xpath-select');
const xmlNS = require('../config/xml-namespaces.json');

const serviceNames = [
  'http://www.ibm.com/xmlns/prod/sn/service/activities',
  'http://www.ibm.com/xmlns/prod/sn/service/dogear',
  'http://www.ibm.com/xmlns/prod/sn/service/profiles',
  'http://www.ibm.com/xmlns/prod/sn/service/communities',
  'http://www.ibm.com/xmlns/prod/sn/service/files',
  'http://www.ibm.com/xmlns/prod/sn/service/wikis',
  'http://www.ibm.com/xmlns/prod/sn/service/forums',
  'http://www.ibm.com/xmlns/prod/sn/service/blogs',
];

const profileLinkTypes = [
  'http://www.ibm.com/xmlns/prod/sn/profile-type',
  'http://www.ibm.com/xmlns/prod/sn/reporting-chain',
  'http://www.ibm.com/xmlns/prod/sn/connections/colleague',
  'http://www.ibm.com/xmlns/prod/sn/status',
  'http://www.ibm.com/xmlns/prod/sn/mv/theboard',
  'http://www.ibm.com/xmlns/prod/sn/tag-cloud',
];

const getLastPathSegment = (str) => {
  const [, val] = /([^/]+)$/.exec(str);
  return val;
};

const parseExtattrDetails = xmlNode => ({
  id: xmlNode.getAttributeNS(xmlNS.snx, 'extensionId'),
  type: xmlNode.getAttribute('type'),
  href: xmlNode.getAttribute('href'),
});

const parseProfileLinkType = (xmlNode, rel) => ({
  name: getLastPathSegment(rel),
  rel,
  type: xmlNode.getAttribute('type'),
  href: xmlNode.getAttribute('href'),
});

const parseServiceName = (xmlNode, rel) => ({
  name: getLastPathSegment(rel),
  rel,
  type: xmlNode.getAttribute('type'),
  href: xmlNode.getAttribute('href'),
});

const addToCatalog = ({ catalog, item, idPropName }) => {
  /* beautify preserve:start */
  const { [idPropName]: idProp } = item;
  Object.assign(catalog, { [idProp]: item });
  /* beautify preserve:end */
};

module.exports = (stringOrXMLDoc) => {
  const xmlDoc = ensureXMLDoc(stringOrXMLDoc);

  const userid = xpathSelect('/app:service/app:workspace/app:collection/snx:userid/text()', xmlDoc, true);
  const editableFields = _.map(
    xpathSelect('/app:service/app:workspace/app:collection/snx:editableFields/snx:editableField', xmlDoc),
    xmlNode => xmlNode.getAttribute('name')
  );

  const links = {};
  const services = {};
  const extattrDetails = {};

  _.map(xpathSelect('/app:service/app:workspace/atom:link[@rel]', xmlDoc),
      (xmlNode) => {
        const rel = xmlNode.getAttribute('rel');

        // process extension attributes
        if (rel === 'http://www.ibm.com/xmlns/prod/sn/ext-attr') {
          return {
            item: parseExtattrDetails(xmlNode),
            catalog: extattrDetails,
            idPropName: 'id',
          };
        }

        // process profile type links
        if (profileLinkTypes.includes(rel)) {
          return {
            item: parseProfileLinkType(xmlNode, rel),
            catalog: links,
            idPropName: 'name',
          };
        }

        // process service rels
        if (serviceNames.includes(rel)) {
          return {
            item: parseServiceName(xmlNode, rel),
            catalog: links,
            idPropName: 'name',
          };
        }

        // at this point, we would only process service rels
        return false;
      })
    .filter(entry => !!entry)
    .forEach(addToCatalog);

  return {
    userid,
    editableFields,
    links,
    services,
    extattrDetails,
  };
};

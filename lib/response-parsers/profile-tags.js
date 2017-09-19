'use strict';

// core node modules

// 3rd party modules
const _ = require('lodash');
const { ensureXMLDoc } = require('oniyi-utils-xml');

// internal modules
const xpathSelect = require('../xpath-select');
const { safeConvertToString } = require('./../utils/response-parser-utils');
const xmlNS = require('../config/xml-namespaces.json');

const categoryTag = xmlNode => ({
  term: _.unescape(xmlNode.getAttribute('term')),
  scheme: xmlNode.getAttribute('scheme'),
  frequency: xmlNode.getAttributeNS(xmlNS.snx, 'frequency'),
  intensityBin: xmlNode.getAttributeNS(xmlNS.snx, 'intensityBin'),
  visibilityBin: xmlNode.getAttributeNS(xmlNS.snx, 'visibilityBin'),
  type: xmlNode.getAttributeNS(xmlNS.snx, 'type'),
  contributors: [],
});

const findOrCreateContributor = (catalog, xmlNode) => {
  const profileGuid = xmlNode.getAttributeNS(xmlNS.snx, 'profileGuid');
  const contributor = _.get(catalog, profileGuid, { contributions: {} });

  Object.assign(contributor, {
    key: xmlNode.getAttributeNS(xmlNS.snx, 'profileKey'),
    userid: profileGuid,
    uid: xmlNode.getAttributeNS(xmlNS.snx, 'profileUid'),
    email: safeConvertToString(xpathSelect('atom:email/text()', xmlNode, true)),
    userState: safeConvertToString(xpathSelect('snx:userState/text()', xmlNode, true)),
    isExternal: safeConvertToString(xpathSelect('snx:isExternal/text()', xmlNode, true)),
  });

  return contributor;
};

const addValToNestedArray = (obj, path, val) =>
  _.set(obj, path, _.union(_.get(obj, path, []), [val]));

const addTagTermToContributions = (contributor, tag) =>
  addValToNestedArray(contributor, `contributions.${tag.type}`, tag.term);

const addContributorToTag = (contributor, tag) =>
  addValToNestedArray(tag, 'contributors', contributor.userid);

module.exports = (stringOrXMLDoc) => {
  const xmlDoc = ensureXMLDoc(stringOrXMLDoc);

  const [categoriesTagNode] = xmlDoc.getElementsByTagNameNS(xmlNS.app, 'categories');
  const categoryTagNodes = categoriesTagNode.getElementsByTagNameNS(xmlNS.atom, 'category');
  const numberOfContributors = parseInt(categoriesTagNode.getAttributeNS(xmlNS.snx, 'numberOfContributors'), 10);

  const contributors = {};
  const tags = _.map(categoryTagNodes, (categoryTagNode) => {
    const contributorTagNodes = categoryTagNode.getElementsByTagNameNS(xmlNS.atom, 'contributor');
    const tag = categoryTag(categoryTagNode);

    _.forEach(contributorTagNodes, (contributorTagNode) => {
      const contributor = findOrCreateContributor(contributors, contributorTagNode);

      addTagTermToContributions(contributor, tag);
      addContributorToTag(contributor, tag);

      // need to put our contributor (back) into the catalog, since we might have only created the
      // contributor object in this iteration
      Object.assign(contributors, { [contributor.userid]: contributor });
    });

    return tag;
  });

  return {
    numberOfContributors,
    contributors,
    tags,
  };
};

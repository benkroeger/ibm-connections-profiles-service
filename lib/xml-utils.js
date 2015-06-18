var DOMParser = require('xmldom').DOMParser,
  parser = new DOMParser(),
  xpath = require('xpath');

var xmlNS = {
  atom: 'http://www.w3.org/2005/Atom',
  snx: 'http://www.ibm.com/xmlns/prod/sn',
  app: 'http://www.w3.org/2007/app',
  openSearch: 'http://a9.com/-/spec/opensearch/1.1/',
  ibmsc: 'http://www.ibm.com/search/content/2010',
  thr: 'http://purl.org/syndication/thread/1.0',
  fh: 'http://purl.org/syndication/history/1.0'
};

function getQueryObject(queryString) {
  if (typeof queryString !== 'string') {
    return false;
  }

  var sep = queryString.split('[');
  var paths = sep[0].split(':');
  var query = {},
    attributes = [];

  switch (paths.length) {
    case 3:
      query.ns = paths[0];
      query.tag = paths[1];
      query.special = paths[2];
      break;
    case 2:
      if (['first-child'].indexOf(paths[paths.length - 1]) > -1) {
        query.tag = paths[0];
        query.special = paths[1];
      } else {
        query.ns = paths[0];
        query.tag = paths[1];
      }
      break;
    case 1:
      query.tag = paths[0];
      break;
    default:
      return false;
  }

  if (typeof sep[1] === 'string') {
    sep[1].replace(/[\[\]]/g, "").split(',').forEach(function(ele) {
      ele = ele.split('=');
      var attribute = {
        name: ele[0]
      };
      if (typeof ele[1] === 'string') {
        attribute.value = ele[1].replace(/["']/g, "");
      }
      attributes.push(attribute);
    });
    query.attr = attributes;
  }

  return query;
}

exports.parse = function(xmlString) {
  var xmlDoc = false;
  try {
    xmlDoc = parser.parseFromString(xmlString, "text/xml");
  } catch (e) {}
  return xmlDoc;
};

exports.find = function(xmlDoc, pathString) {
  if (typeof xmlDoc === 'string') {
    xmlDoc = exports.parse(xmlDoc);
  }

  if (typeof pathString !== 'string') {
    return false;
  }
  var pathArray = pathString.split(' '),
    resultsArray = [xmlDoc];
  //nameSpace:tagName:special[attr1="val1",attr2="val2"]

  pathArray.forEach(function(queryString) {
    var query = getQueryObject(queryString),
      results = [];
    if (typeof query.ns === 'string') {
      // @TDOD: implement namespace support; this esp. requires mapping from xmlns abbr to uri
      return false;
    }
    if (typeof query.special === 'string') {
      // @TDOD: implement special locators such as "first-child"
      return false;
    }
    if (typeof query.tag === 'string') {
      resultsArray.forEach(function(ele) {
        Array.prototype.forEach.call(ele.getElementsByTagName(query.tag), function(result) {
          var failedAttrs = 0;
          if (query.attr) {
            failedAttrs = query.attr.length;
            query.attr.forEach(function(attribute) {
              if (result.hasAttribute(attribute.name)) {
                if ((typeof attribute.value === 'string') && (result.getAttribute(attribute.name) === attribute.value)) {
                  failedAttrs--;
                } else if (typeof attribute.value !== 'string') {
                  failedAttrs--;
                }
              }
            });
          }
          if (failedAttrs === 0) {
            results.push(result);
          }
        });
      });
    }
    resultsArray = results;
  });
  return resultsArray;
};

exports.select = xpath.useNamespaces(xmlNS);
exports.nameSpaces = xmlNS;
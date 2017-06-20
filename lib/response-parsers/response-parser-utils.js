'use strict';

// core node modules

// 3rd party modules

// internal modules

/**
 * Some selector fields, when called by /text() syntax, return undefined if they have no text.
 * Need to be sure that we are not calling '.toString()' on undefined object.
 *
 * @param collection      The collection/object we are trying to convert to string
 */

const safeConvertToString = collection => (collection && collection.toString()) || '';

module.exports = { safeConvertToString };
